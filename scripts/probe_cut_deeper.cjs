const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    await page.goto('http://localhost:5174/');
    await page.waitForFunction(() => window.__cameraStore && window.__SCENE__ && window.__ctrl, null, { timeout: 40000 });
    await sleep(6000);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await sleep(4000);
    const info = await page.evaluate(() => {
        let n = 0;
        let before = null;
        window.__SCENE__.traverse((o) => {
            const u = o.material && o.material.uniforms;
            if (!u || !u.cutHalf) return;
            n++;
            if (!before) before = { c: u.cutCenter.value.toArray(), h: u.cutHalf.value.toArray() };
            u.cutCenter.value.set(1.6762, -1.5879, -0.8014);
            u.cutHalf.value.set(0.335, 0.0254, 0.178);
        });
        return { n, before };
    });
    console.log('裁剪材质数:', info.n, '原参数:', JSON.stringify(info.before));
    await sleep(1200);
    await page.screenshot({ path: 'evidence/edge_bottom_deep.png', clip: { x: 380, y: 560, width: 560, height: 240 } });
    await page.screenshot({ path: 'evidence/edge_full_deep.png' });
    console.log('done');
    await browser.close();
})();
