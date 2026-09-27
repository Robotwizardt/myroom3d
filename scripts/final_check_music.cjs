// 端到端验收：笔记本播放器加专辑封面（ADR-0002）
// 覆盖：转盘兜底封面=歌单封面 / 行内小图 / 点歌换封面 / 点转盘切播放 / 图片挂掉降级占位块且不影响播放
// 跑法（本机没把 playwright 装进项目，用全局那份）：
//   NODE_PATH="C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules" \
//     node scripts/final_check_music.cjs            # 端口默认 5174，可 BASE=... 覆盖
const { chromium } = require('playwright');
const { PNG } = require('playwright-core/lib/utilsBundle');

const BASE = process.env.BASE || 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, cond, extra = '') => {
    results.push({ name, pass: !!cond, extra });
    console.log(`${cond ? '✓' : '✗'} ${name}${extra ? '  [' + extra + ']' : ''}`);
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(BASE);
    await sleep(6000);

    // 1. 进笔记本特写，等歌单接口回来
    await page.evaluate(() => window.__cameraStore.getState().laptop());
    await sleep(4000);

    const rows = page.locator('[data-testid="song-row"]');
    const rowCount = await rows.count();
    check('歌单曲目列表加载出来', rowCount > 5, `${rowCount} 行`);
    if (rowCount === 0) {
        await page.screenshot({ path: 'evidence/music_art_fail.png' });
        console.log('控制台错误:', errors.slice(0, 5));
        await browser.close();
        process.exit(1);
    }

    // 2. 还没点歌：转盘中心应显示歌单封面（https + param=256y256）
    const fallbackSrc = await page.locator('[data-testid="vinyl-cover"]').getAttribute('src');
    check(
        '未选歌时转盘中心 = 歌单封面（https + ?param=256y256）',
        !!fallbackSrc && fallbackSrc.startsWith('https://') && fallbackSrc.includes('param=256y256'),
        fallbackSrc || '(无)'
    );

    // 3. 每行左侧 36px 小图，全部 https + param=72y72
    const rowArts = await page.locator('[data-testid="song-art"]').count();
    check('每行都有行内小封面', rowArts === rowCount, `${rowArts}/${rowCount}`);
    const artSrcs = await page.locator('[data-testid="song-art"]').evaluateAll((els) =>
        els.slice(0, 5).map((e) => e.getAttribute('src') || '')
    );
    check(
        '行内小图都用 https + CDN 缩放',
        artSrcs.length > 0 && artSrcs.every((s) => s.startsWith('https://') && s.includes('param=72y72')),
        artSrcs[0] || '(无)'
    );
    const thumbBox = await page.locator('[data-testid="song-art"]').first().boundingBox();
    check('行内小图有实际尺寸（36px 量级）', !!thumbBox && thumbBox.width > 10, thumbBox ? `${thumbBox.width.toFixed(1)}px` : '无');

    await page.screenshot({ path: 'evidence/music_art_panel.png' });

    // 4. 真实鼠标点第 3 首 → 转盘封面换成它的专辑封面 + 出现播放标记
    const thirdRow = rows.nth(2);
    const thirdArtSrc = await thirdRow.locator('[data-testid="song-art"]').getAttribute('src');
    const expectDiscSrc = (thirdArtSrc || '').replace('param=72y72', 'param=256y256');
    await thirdRow.click();
    await sleep(6000);
    const discSrc = await page.locator('[data-testid="vinyl-cover"]').getAttribute('src');
    check('点歌后转盘封面 = 该曲专辑封面', discSrc === expectDiscSrc, `${discSrc}`);
    check('该行出现播放标记（🔊）', (await thirdRow.textContent()).includes('🔊'));
    const audio1 = await page.evaluate(() => {
        const a = document.querySelector('.htmlMusicPlayer audio');
        return a ? { hasSrc: !!a.src, t: a.currentTime, paused: a.paused } : null;
    });
    check('这首歌真的在播', !!audio1 && audio1.hasSrc && !audio1.paused, JSON.stringify(audio1));

    const spin1 = await page.evaluate(() => {
        const p = document.querySelector('[data-testid="vinyl-plate"]');
        const n = document.querySelector('[data-testid="vinyl-needle"]');
        return {
            playState: getComputedStyle(p).animationPlayState,
            needle: getComputedStyle(n).transform
        };
    });
    check('播放中：黑胶片在转 + 唱针落下', spin1.playState === 'running' && spin1.needle !== 'none', JSON.stringify(spin1));

    await page.screenshot({ path: 'evidence/music_art_playing.png' });

    // 4b. 回归（2026-09-27 修）：歌词自动滚动不能把面板滚出屏幕。
    //    过去用 el.scrollIntoView() 会连带滚动 drei <Html transform> 的 overflow:hidden 容器，
    //    那个容器内部是 ~26× 缩放层，几个 layout 像素 = 屏幕上几千像素，面板整块飞出可见窗。
    //    判据：drei 容器的 scrollTop/scrollLeft 必须一直是 0，且转盘始终落在视口内。
    const panelState = () =>
        page.evaluate(() => {
            const el = document.querySelector('.htmlMusicPlayer');
            const disc = document.querySelector('[data-testid="vinyl-disc"]');
            const r = disc ? disc.getBoundingClientRect() : null;
            return {
                scrollTop: el ? Math.abs(el.scrollTop) : -1,
                scrollLeft: el ? Math.abs(el.scrollLeft) : -1,
                discRect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
                inView: !!r && r.top > 0 && r.bottom < innerHeight && r.left > 0 && r.right < innerWidth
            };
        });
    let worst = { scrollTop: 0, scrollLeft: 0, inView: true, discRect: null };
    for (let i = 0; i < 12; i++) {
        // 12 秒足够跨过好几行歌词（每次换行都会触发一次自动滚动）
        await sleep(1000);
        const s = await panelState();
        worst.scrollTop = Math.max(worst.scrollTop, s.scrollTop);
        worst.scrollLeft = Math.max(worst.scrollLeft, s.scrollLeft);
        worst.inView = worst.inView && s.inView;
        worst.discRect = s.discRect;
    }
    check(
        '歌词换行 12 秒内面板没被滚出屏幕（drei 容器 scrollTop 恒为 0）',
        worst.scrollTop === 0 && worst.scrollLeft === 0 && worst.inView,
        JSON.stringify(worst)
    );

    // 4c. 面板不只是「DOM 在」——真的画出来了：截图歌词区数亮像素
    const lyricPng = PNG.sync.read(await page.locator('[data-testid="lyric-box"]').screenshot());
    let lightPx = 0;
    for (let i = 0; i < lyricPng.data.length; i += 4) {
        const lum = 0.299 * lyricPng.data[i] + 0.587 * lyricPng.data[i + 1] + 0.114 * lyricPng.data[i + 2];
        if (lum > 120) lightPx++;
    }
    check('歌词区确实被绘制出来（亮像素 > 50，没画出来会接近 0）', lightPx > 50, `${lightPx} 亮像素`);
    await page.screenshot({ path: 'evidence/music_art_lyrics.png' });

    // 4d. 歌单滚动条已改成深色细条（原生亮白条已修）
    const sb = await page.evaluate(() => {
        const list = document.querySelector('[data-testid="song-list"]');
        const cs = getComputedStyle(list);
        return { width: cs.scrollbarWidth, color: cs.scrollbarColor };
    });
    check('歌单滚动条改成细深色', sb.width === 'thin' && !!sb.color, JSON.stringify(sb));

    // 5. 真实鼠标点转盘 = 播放/暂停
    await page.locator('[data-testid="vinyl-disc"]').click();
    await sleep(800);
    const paused = await page.evaluate(() => {
        const a = document.querySelector('.htmlMusicPlayer audio');
        const p = document.querySelector('[data-testid="vinyl-plate"]');
        return { paused: a.paused, playState: getComputedStyle(p).animationPlayState };
    });
    check('点转盘：暂停且转盘停住', paused.paused === true && paused.playState === 'paused', JSON.stringify(paused));

    await page.locator('[data-testid="vinyl-disc"]').click();
    await sleep(800);
    const resumed = await page.evaluate(() => document.querySelector('.htmlMusicPlayer audio').paused === false);
    check('再点转盘：继续播放', resumed);

    // 6. 图片挂掉（断掉封面 CDN）→ 降级成占位块，但播放不受影响
    await page.route('**/*.126.net/**', (route) =>
        route.request().resourceType() === 'image' ? route.abort() : route.continue()
    );
    const errorsBeforeOffline = errors.length;
    const fifthRow = rows.nth(4);
    await fifthRow.click();
    await sleep(6000);
    const ph = await page.evaluate(() => ({
        disc: !!document.querySelector('[data-testid="vinyl-cover-placeholder"]'),
        row: !!document.querySelector('[data-testid="song-art-placeholder"]'),
        text: (document.querySelector('[data-testid="vinyl-cover-placeholder"]') || {}).textContent || ''
    }));
    check('图片挂了 → 转盘显示灰底 ♪ 占位块', ph.disc && ph.text.includes('♪'), JSON.stringify(ph));
    const audio2 = await page.evaluate(() => document.querySelector('.htmlMusicPlayer audio').paused === false);
    check('封面挂了不影响播放', audio2);
    await page.screenshot({ path: 'evidence/music_art_offline.png' });
    const offlineErrors = errors.slice(errorsBeforeOffline).filter((t) => !/126\.net|ERR_FAILED|Failed to load resource/.test(t));
    check('离线阶段没有别的 JS 报错', offlineErrors.length === 0, offlineErrors.slice(0, 3).join(' | '));

    // 7. 全程没有把镜头顶出笔记本特写（点转盘/点歌都没穿透）
    const camState = await page.evaluate(() => window.__cameraStore.getState().cameraState);
    check('全程仍在笔记本特写（点击没穿透到 canvas）', camState === 'laptop', camState);

    const realErrors = errors.filter((t) => !/126\.net|ERR_FAILED|Failed to load resource/.test(t));
    check('控制台无真实报错', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

    const failed = results.filter((r) => !r.pass);
    console.log(`\n===== ${results.length - failed.length}/${results.length} 项通过 =====`);
    if (failed.length) console.log('失败项:', failed.map((f) => f.name).join(' / '));
    await browser.close();
    process.exit(failed.length ? 1 : 0);
})();
