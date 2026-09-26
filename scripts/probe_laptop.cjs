/* eslint-disable */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const logs = [];
    page.on('console', (msg) => {
        const t = msg.text();
        if (t.includes('[LAPTOP-WORLD]')) logs.push(t);
    });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(9000);
    console.log('=== CONSOLE ===');
    logs.forEach((l) => console.log(l));
    // 切到 laptop 特写
    await page.evaluate(() => window.__cameraStore && window.__cameraStore.getState().laptop());
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'shots/laptop_closeup_1.png' });
    await browser.close();
})();
