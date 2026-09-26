// 端到端验收：笔记本屏幕 = 网易云播放器（左歌单右歌词），点击不穿透、不乱跳、不自动播
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(BASE);
    await sleep(6000); // 等房间加载

    // 1. 进笔记本特写
    await page.evaluate(() => window.__cameraStore.getState().laptop());
    await sleep(3500); // 等镜头动画 + 歌单接口

    const panel = page.locator('.htmlMusicPlayer').first();
    console.log('播放器面板可见:', await panel.isVisible().catch(() => false));

    // 2. 检查歌单加载（左列表有歌）
    const songRows = await page.locator('.htmlMusicPlayer .songRow, .htmlMusicPlayer [style*="cursor: pointer"]').count();
    console.log('左列表行数(粗查):', songRows);
    const headerText = await panel.textContent().catch(() => '');
    console.log('面板文字前120字:', (headerText || '').slice(0, 120).replace(/\n/g, ' | '));

    // 3. 验证没自动播放（无 audio 时间流动）
    const autoPlay = await page.evaluate(() => {
        const a = document.querySelector('.htmlMusicPlayer audio');
        return a ? { hasSrc: !!a.src, currentTime: a.currentTime, paused: a.paused } : null;
    });
    console.log('audio 状态(应无src且paused):', JSON.stringify(autoPlay));

    // 4. 记录当前镜头状态，然后点播放器界面各处，验证镜头不变（不穿透乱跳）
    const before = await page.evaluate(() => window.__cameraStore.getState().cameraState);
    const box = await panel.boundingBox();
    if (box) {
        // 点面板四角+中间，模拟用户乱点
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        for (const [dx, dy] of [[-0.4, -0.35], [0.4, -0.35], [0, 0], [-0.4, 0.35], [0.4, 0.35]]) {
            await page.mouse.click(cx + box.width * dx, cy + box.height * dy);
            await sleep(400);
        }
    }
    const after = await page.evaluate(() => window.__cameraStore.getState().cameraState);
    console.log('乱点后镜头状态:', before, '->', after, before === after ? '✓ 没乱跳' : '✗ 穿透了！');

    // 5. 点第一首歌播放
    const firstSong = page.locator('.htmlMusicPlayer [style*="cursor: pointer"]').first();
    if (await firstSong.count()) {
        await firstSong.click();
        await sleep(4000); // 等拿url+起播+拉歌词
        const st = await page.evaluate(() => {
            const a = document.querySelector('.htmlMusicPlayer audio');
            return a ? { hasSrc: !!a.src, t: a.currentTime, paused: a.paused } : null;
        });
        console.log('点歌后 audio:', JSON.stringify(st), st && st.hasSrc && !st.paused && st.t > 0 ? '✓ 在播' : '✗ 没播');
        const lyricTxt = await panel.textContent();
        const hasLyric = /[\u4e00-\u9fa5]/.test(lyricTxt.slice(0, 500));
        console.log('歌词区有内容:', hasLyric ? '✓' : '✗');
    } else {
        console.log('✗ 歌单没加载出来，没歌可点');
    }

    // 6. 全景看笔记本：还有没有 Spotify 假贴图（材质应为纯色 #100a1d）
    await page.evaluate(() => window.__cameraStore.getState().default());
    await sleep(3000);
    const matCheck = await page.evaluate(() => {
        // 无法直接查 gl 材质，改为截图后人工看；这里先记录状态
        return window.__cameraStore.getState().cameraState;
    });
    console.log('回全景状态:', matCheck);
    await page.screenshot({ path: 'evidence/ux_final_default.png' });

    await page.evaluate(() => window.__cameraStore.getState().laptop());
    await sleep(3000);
    await page.screenshot({ path: 'evidence/ux_final_laptop.png' });

    console.log('控制台错误数:', errors.length, errors.slice(0, 5));
    await browser.close();
})();
