const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(15000);
    await page.evaluate(() => window.__cameraStore.getState().laptop());
    await page.waitForTimeout(6000);
    await page.screenshot({ path: 'shots/final_1_closeup.png' });

    // 搜索周杰伦
    const input = page.locator('.htmlMusicPlayer input');
    await input.fill('周杰伦');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'shots/final_2_search.png' });

    // 点第一首歌播放
    const firstSong = page.locator('.htmlMusicPlayer div[style*="cursor: pointer"]').first();
    if (await firstSong.count()) {
        await firstSong.click();
        await page.waitForTimeout(4000);
        await page.screenshot({ path: 'shots/final_3_playing.png' });
    }

    // 镜头轻微偏转: 拖拽画面
    await page.mouse.move(720, 450);
    await page.mouse.down();
    await page.mouse.move(800, 430, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'shots/final_4_rotated.png' });

    await browser.close();
})();
