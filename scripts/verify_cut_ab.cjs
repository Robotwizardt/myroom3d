/** 裁剪开/关的绿点 A/B 对照 + 三视角截图 */
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules/playwright-core/lib/utilsBundle.js');

const URL = 'http://localhost:5174/';
const AREA = [420, 140, 900, 720];   // 手机特写：机身四周（含烘焙绿板会露出的区域）
const SCREEN = [560, 190, 760, 660]; // 机身 DOM 屏大致范围，单独统计时排除

function scanGreen(png, rect, exclude) {
    const { width, data } = png;
    const [x0, y0, x1, y1] = rect;
    const out = [];
    for (let y = Math.max(0, y0); y < Math.min(png.height, y1); y += 1) {
        for (let x = Math.max(0, x0); x < Math.min(width, x1); x += 1) {
            if (exclude && x >= exclude[0] && x < exclude[2] && y >= exclude[1] && y < exclude[3]) continue;
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (g > 70 && g > r * 1.2 && g > b * 1.2) out.push([x, y, r, g, b]);
        }
    }
    return out;
}
const bb = (h) => (h.length ? [Math.min(...h.map((p) => p[0])), Math.min(...h.map((p) => p[1])), Math.max(...h.map((p) => p[0])), Math.max(...h.map((p) => p[1]))] : null);

const setCut = (page, on) =>
    page.evaluate((enable) => {
        let n = 0;
        window.__SCENE__.traverse((o) => {
            const u = o.material && o.material.uniforms;
            if (!u || !u.cutHalf) return;
            const m = o.material;
            if (!m.userData.__cutHalf) m.userData.__cutHalf = u.cutHalf.value.clone();
            const orig = m.userData.__cutHalf;
            u.cutHalf.value.copy(enable ? orig : new (orig.constructor)(-1, -1, -1));
            n += 1;
        });
        return n;
    }, on);

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(3500);

    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3500);

    const nOff = await setCut(page, false);
    await page.waitForTimeout(800);
    const offPng = PNG.sync.read(await page.screenshot());
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/ab_cut_off.png') });
    const offAll = scanGreen(offPng, AREA);
    console.log(`[裁剪关] 材质 ${nOff} 个；特写区绿点 ${offAll.length}，bbox ${JSON.stringify(bb(offAll))}`);
    console.log(`  DOM 屏框内绿点 ${scanGreen(offPng, SCREEN).length}（屏内本来就不该有绿）`);

    await setCut(page, true);
    await page.waitForTimeout(800);
    const onPng = PNG.sync.read(await page.screenshot());
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/ab_cut_on.png') });
    const onAll = scanGreen(onPng, AREA);
    console.log(`[裁剪开] 特写区绿点 ${onAll.length}，bbox ${JSON.stringify(bb(onAll))}`);

    console.log('\n控制台错误:', errors.length ? errors.join(' | ') : '(0)');
    await browser.close();
})();
