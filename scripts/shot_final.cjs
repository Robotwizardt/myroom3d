/** 最终交付截图：默认全景 + 手机特写（修复后） */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/final_default.png') });
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/final_smartphone.png') });
    await browser.close();
})();
