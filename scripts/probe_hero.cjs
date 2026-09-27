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
    // 3/4 俯视（看正面 + 侧边中框 + Home 键）
    await page.evaluate(() => window.__cameraStore.setState({ minDistance: 0.2, maxDistancce: 3, minPolarAngle: 0, maxPolarAngle: Math.PI, minAzimuthAngle: -Math.PI * 4, maxAzimuthAngle: Math.PI * 4 }));
    await page.evaluate(() => window.__ctrl.setLookAt(1.15, -1.15, -0.85, 1.6725, -1.60, -0.7941, false));
    await sleep(2000);
    await page.screenshot({ path: 'evidence/hero_34.png' });
    // 正侧（看厚度/中框带/侧键）
    await page.evaluate(() => window.__ctrl.setLookAt(1.05, -1.60, -0.60, 1.6725, -1.60, -0.7941, false));
    await sleep(2000);
    await page.screenshot({ path: 'evidence/hero_side.png' });
    console.log('hero done');
    await browser.close();
})();
