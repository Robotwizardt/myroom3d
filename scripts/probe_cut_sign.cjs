/**
 * 机身下方/上方的黑色小凸块溯源：分三种裁剪设置各拍一张特写，
 * 统计"暗像素"数量（机身本身固定不变，凸块消失 → 暗像素显著减少）。
 *   A 默认（cutRotY 60°、half [0.335,0.022,0.178]）
 *   B 超大裁剪盒（half [0.6,0.03,0.6]）—— 道具整块被切掉
 *   C cutRotY 改成 -60°
 */
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules/playwright-core/lib/utilsBundle.js');

const OUT = (f) => path.resolve(__dirname, '../evidence', f);

const shoot = async (page, name, mutate) => {
    if (mutate) {
        const ok = await page.evaluate((src) => {
            const fn = new Function('u', src);
            let n = 0;
            window.__SCENE__.traverse((o) => {
                if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.cutHalf) {
                    fn(o.material.uniforms);
                    n++;
                }
            });
            return n;
        }, mutate);
        console.log('  变体生效 mesh 数', ok);
    }
    await page.waitForTimeout(1200);
    const buf = await page.screenshot({ path: OUT(name) });
    const img = PNG.sync.read(buf);
    const { width: W, height: H, data } = img;
    let dark = 0;
    let veryDark = 0;
    for (let i = 0; i < W * H * 4; i += 4) {
        if (data[i] < 90 && data[i + 1] < 90 && data[i + 2] < 100) dark++;
        if (data[i] < 40 && data[i + 1] < 40 && data[i + 2] < 50) veryDark++;
    }
    console.log(' ', name, '暗像素', dark, '极暗像素', veryDark);
    return { dark, veryDark };
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);

    console.log('A 默认裁剪');
    const a = await shoot(page, 'tabcut_a_default.png');
    console.log('B 超大裁剪盒');
    const b = await shoot(page, 'tabcut_b_huge.png', 'u.cutHalf.value.set(0.6, 0.03, 0.6);');
    console.log('C 旋转 -60°');
    const c = await shoot(page, 'tabcut_c_neg60.png', 'u.cutHalf.value.set(0.335, 0.022, 0.178); u.cutRotY.value = -Math.PI / 3;');
    console.log('D 恢复默认');
    await shoot(page, 'tabcut_d_restore.png', 'u.cutRotY.value = Math.PI / 3;');

    console.log('差值：B-A =', b.dark - a.dark, ' C-A =', c.dark - a.dark);
    console.log('console error', errs.length, errs.slice(0, 3));
    await browser.close();
})();
