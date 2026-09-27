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
    // 机身下缘（靠近观察者那一端）局部放大
    await page.screenshot({ path: 'evidence/edge_bottom.png', clip: { x: 380, y: 560, width: 560, height: 240 } });
    await page.screenshot({ path: 'evidence/edge_top.png', clip: { x: 420, y: 60, width: 480, height: 200 } });
    console.log('shots done');
    await browser.close();
})();
