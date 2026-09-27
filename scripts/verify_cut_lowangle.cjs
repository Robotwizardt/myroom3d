/** 低角度侧视：确认机身躺平在桌面上、桌面无破洞、鼠标完好 */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(3500);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3500);
    const shots = [
        ['lowangle_a.png', [1.35, -1.40, -0.30]],
        ['lowangle_b.png', [2.05, -1.42, -1.22]],
        ['lowangle_c.png', [1.05, -1.62, -1.45]],
    ];
    for (const [file, pos] of shots) {
        await page.evaluate((p) => {
            const ctrl = window.__ctrl;
            ctrl.setLookAt(p[0], p[1], p[2], 1.6725, -1.60, -0.7941, false);
        }, pos);
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.resolve(__dirname, '../evidence/' + file) });
        console.log('saved', file, JSON.stringify(pos));
    }
    await browser.close();
})();
