/**
 * 找出机身轮廓外那几块"黑色小凸块"是谁：逐组隐藏候选 mesh，比较像素差异的 bbox。
 *   A 基线
 *   B 隐藏侧键（颜色 ≈ #b9bbbe）
 *   C 隐藏正面细节贴图（听筒/前摄/传感器/Home 键，带 map 的 basic 材质）
 *   D 隐藏房间壳体（ShaderMaterial）
 *   E 隐藏我们自己的机身（颜色 #c9cbcd / #08080a）
 */
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules/playwright-core/lib/utilsBundle.js');

const OUT = (f) => path.resolve(__dirname, '../evidence', f);
const decode = (buf) => PNG.sync.read(buf);

const diffBox = (a, b) => {
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1;
    let y1 = -1;
    let n = 0;
    for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < a.width; x++) {
            const i = (y * a.width + x) * 4;
            const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
            if (d > 40) {
                n++;
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }
    return { n, box: n ? [x0, y0, x1, y1] : null };
};

const HIDE = {
    sidebuttons: `const want = [0xb9, 0xbb, 0xbe]; let n = 0;
        window.__SCENE__.traverse(o => { if (o.isMesh && o.material && o.material.color) {
            const c = o.material.color; const r = Math.round(c.r*255), g = Math.round(c.g*255), b = Math.round(c.b*255);
            if (Math.abs(r-want[0])<8 && Math.abs(g-want[1])<8 && Math.abs(b-want[2])<8) { o.visible = false; n++; } } });
        return n;`,
    faceDetails: `let n = 0;
        window.__SCENE__.traverse(o => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial && o.material.map) { o.visible = false; n++; } });
        return n;`,
    shells: `let n = 0;
        window.__SCENE__.traverse(o => { if (o.isMesh && o.material && o.material.type === 'ShaderMaterial') { o.visible = false; n++; } });
        return n;`,
    ourBody: `const want = [0xc9, 0xcb, 0xcd, 0x08, 0x08, 0x0a]; let n = 0;
        window.__SCENE__.traverse(o => { if (o.isMesh && o.material && o.material.color) {
            const c = o.material.color; const r = Math.round(c.r*255), g = Math.round(c.g*255), b = Math.round(c.b*255);
            if ((Math.abs(r-0xc9)<8 && Math.abs(g-0xcb)<8 && Math.abs(b-0xcd)<8) || (r<20 && g<20 && b<24)) { o.visible = false; n++; } } });
        return n;`
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);

    const base = decode(await page.screenshot({ path: OUT('tab_a_base.png') }));
    for (const [name, src] of Object.entries(HIDE)) {
        const n = await page.evaluate(`(() => { ${src} })()`);
        await page.waitForTimeout(900);
        const img = decode(await page.screenshot({ path: OUT(`tab_${name}.png`) }));
        console.log(name, '隐藏 mesh', n, '差异像素', JSON.stringify(diffBox(base, img)));
        await page.evaluate(`(() => { window.__SCENE__.traverse(o => { if (o.isMesh) o.visible = true; }); })()`);
        await page.waitForTimeout(700);
    }
    await browser.close();
})();
