const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__ctrl && window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(5000);
    const dump = (tag) => page.evaluate((t) => {
        const c = window.__ctrl;
        const f = (v) => (typeof v === 'number' ? +v.toFixed(4) : v);
        return { tag: t, azimuth: f(c.azimuthAngle), polar: f(c.polarAngle), distance: f(c.distance),
                 minAz: f(c.minAzimuthAngle), maxAz: f(c.maxAzimuthAngle), minPol: f(c.minPolarAngle), maxPol: f(c.maxPolarAngle),
                 minD: f(c.minDistance), maxD: f(c.maxDistance),
                 cam: c.camera.position.toArray().map(f) };
    }, tag);
    console.log('default  ', JSON.stringify(await dump('default')));
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3000);
    console.log('phone    ', JSON.stringify(await dump('phone')));
    await page.evaluate(() => window.__ctrl.setLookAt(1.3136, -0.8116, -0.3161, 1.6725, -1.6135, -0.7941, false));
    await page.waitForTimeout(1200);
    console.log('opposite ', JSON.stringify(await dump('opposite')));
    console.log('pi*0.84 =', (Math.PI * 0.84).toFixed(4), ' pi*-0.16 =', (Math.PI * -0.16).toFixed(4), ' pi*-0.15 =', (Math.PI * -0.15).toFixed(4));
    await browser.close();
})();
