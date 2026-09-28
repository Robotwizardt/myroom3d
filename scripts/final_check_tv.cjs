// 端到端验收：电视 = GBA 模拟器 + 卡带菜单（见 ADR-0003）
// 链路（全部真实鼠标 / 键盘）：
//   全景真实点击电视屏 → 进电视特写 → 屏内出现卡带菜单（不是直接开机）→
//   ← → 换高亮 / 鼠标点卡带 → Enter 或点选中卡带开始 → 「正在开机…」遮罩 →
//   模拟器起来（遮罩消失 + iframe 里出现 canvas）→ 点进模拟器给 iframe 焦点 →
//   Esc 回菜单 → 再开一次 → 点右上角 ✕ 回菜单 → 菜单 ✕ 回房间全景 →
//   拦截 *.gba 404 后重载：卡带变灰「文件缺失」且点不动 → 控制台 0 真实报错
//
// 跑法（本机没把 playwright 装进项目，用全局那份）：
//   NODE_PATH="C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules" \
//     node scripts/final_check_tv.cjs            # 端口默认 5174，可 BASE=... 覆盖
const { chromium } = require('playwright');
const { PNG } = require('playwright-core/lib/utilsBundle');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, extra = '') => {
    results.push(ok);
    console.log(`${ok ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
};

/**
 * 截图时用：模拟器的 WebGL 画布是 preserveDrawingBuffer:false，Playwright 抓图会随机抓到黑屏
 * （实测同一画面亮度在 12 与 208 之间跳），所以多抓几张，留最亮的那张。
 */
const brightShot = async (page, path, tries = 15) => {
    let best = null;
    for (let i = 0; i < tries; i++) {
        const buf = await page.screenshot();
        const png = PNG.sync.read(buf);
        let sum = 0;
        let n = 0;
        for (let y = Math.floor(png.height * 0.15); y < png.height * 0.8; y += 6) {
            for (let x = Math.floor(png.width * 0.25); x < png.width * 0.75; x += 6) {
                const o = (y * png.width + x) * 4;
                sum += (png.data[o] + png.data[o + 1] + png.data[o + 2]) / 3;
                n++;
            }
        }
        const mean = sum / n;
        if (!best || mean > best.mean) best = { mean, buf };
        if (mean > 40) break;
        await sleep(200);
    }
    fs.writeFileSync(path, best.buf);
    return +best.mean.toFixed(1);
};

/** 等卡带菜单出现 */
const waitMenu = (page, timeout = 20000) =>
    page.waitForSelector('[data-testid="tv-game-menu"]', { state: 'visible', timeout });

/**
 * 列出当前状态里挂了事件的可点 mesh（R3F v8：__r3f.handlers）及其投影像素。
 * 用 mesh 的"几何 bbox 世界中心"而不是 mesh 原点——glb 的节点原点很多不在几何上。
 */
const listClickables = async (page) =>
    page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const out = [];
        window.__SCENE__.traverse((o) => {
            if (!o.isMesh || !o.__r3f) return;
            if (!Object.keys(o.__r3f.handlers || {}).length) return;
            o.geometry.computeBoundingBox();
            const box = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
            const c = box.getCenter(new THREE.Vector3());
            const p = c.clone().project(cam);
            const mat = Array.isArray(o.material) ? o.material[0] : o.material;
            out.push({
                opacity: mat?.opacity,
                wpos: box.getCenter(new THREE.Vector3()).toArray(),
                center: c.toArray().map((n) => +n.toFixed(2)),
                px: +((p.x * 0.5 + 0.5) * innerWidth).toFixed(0),
                py: +((-p.y * 0.5 + 0.5) * innerHeight).toFixed(0)
            });
        });
        return out;
    });

/** 展示板上电视图标的几何世界中心（实测映射：板内 6 个可点 mesh 里 z 最小的那个） */
const BOARD_TV_ICON = [-5.22, 0.64, -1.74];

/**
 * 真实鼠标把镜头点进电视特写。
 * 电视屏本身在默认视角是几乎侧对着相机的（射线打不到），所以走原项目自带的展示板入口：
 * 全景点透明展示板 → displayBoard → 点板上的电视图标 → tv 特写。
 */
async function clickIntoTv(page) {
    const state = () => page.evaluate(() => window.__cameraStore.getState().cameraState);
    let tried = 0;

    // 1) 全景里点那块 opacity=0 的展示板 plane
    const board = (await listClickables(page)).find(
        (c) => c.opacity === 0 && c.px > 4 && c.py > 4 && c.px < 1276 && c.py < 796
    );
    if (!board) return { ok: false, tried };
    await page.mouse.click(board.px, board.py);
    tried++;
    await sleep(3200); // 等镜头动画停稳（板内像素才算得准）
    if ((await state()) !== 'displayBoard') return { ok: false, tried };

    // 2) 板内点电视图标
    const icons = (await listClickables(page)).filter(
        (c) => c.px > 4 && c.py > 4 && c.px < 1276 && c.py < 796
    );
    const tv = icons.find(
        (c) =>
            Math.hypot(
                c.center[0] - BOARD_TV_ICON[0],
                c.center[1] - BOARD_TV_ICON[1],
                c.center[2] - BOARD_TV_ICON[2]
            ) < 0.2
    );
    if (!tv) return { ok: false, tried };
    await page.mouse.click(tv.px, tv.py);
    tried++;
    await sleep(2600);
    return { ok: (await state()) === 'tv', tried, at: { x: tv.px, y: tv.py } };
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    const state = () => page.evaluate(() => window.__cameraStore.getState().cameraState);
    const booting = () =>
        page.locator('[data-testid="tv-boot-overlay"]').count().then((n) => n > 0);

    await page.goto(BASE);
    await page.waitForFunction(
        () => window.__cameraStore && window.__SCENE__ && window.__ctrl,
        null,
        { timeout: 40000 }
    );
    await sleep(6000); // 等房间加载

    // ── 1. 全景真实点电视 → 电视特写 ────────────────────────────────────
    const hit = await clickIntoTv(page);
    check('全景点电视屏 → 进入电视特写', hit.ok, hit.ok ? `第 ${hit.tried} 个采样点命中` : '所有采样点都没命中');
    await sleep(3500); // 等镜头动画

    const menu = page.locator('[data-testid="tv-game-menu"]');
    check('屏内出现卡带菜单（不直接开机）', await menu.isVisible().catch(() => false));
    check('菜单里没有模拟器 iframe（还没开机）', (await page.locator('.htmlScreen iframe').count()) === 0);

    const menuText = await menu.textContent().catch(() => '');
    check('菜单标题「游戏库」', menuText.includes('游戏库'));
    check('菜单列出超级马力欧 Advance 4', menuText.includes('超级马力欧 Advance 4'));
    const cartCount = await page.locator('[data-testid="tv-cartridge"]').count();
    check('6 张卡带都列出来（1 张自备 + 5 张同人）', cartCount === 6, `实际 ${cartCount} 张`);
    check(
        '同人游戏在列（Tobu Tobu Girl Deluxe / uCity / Big2Small）',
        menuText.includes('Tobu Tobu Girl Deluxe') &&
            menuText.includes('uCity') &&
            menuText.includes('Big2Small')
    );
    check('菜单底部常驻 ↕ 按键说明', menuText.includes('← → 选卡带') && menuText.includes('Z = A'));
    check('选中卡带有「按 Enter 开始」提示', (await page.locator('[data-testid="tv-start-hint"]').textContent()).includes('开始'));
    const selected = page.locator('[data-testid="tv-cartridge"][data-selected="true"]');
    check('卡带选中态用 data-selected 标出', (await selected.count()) === 1);
    const missingNow = await page.locator('[data-testid="tv-cartridge"][data-missing="true"]').count();
    check('真实 ROM 存在 → 卡带不是灰态', missingNow === 0, `灰态 ${missingNow} 张`);
    const plat = async (id) =>
        (await page.locator(`[data-testid="tv-platform-${id}"]`).textContent().catch(() => '')) || '';
    check(
        '每张卡带印自己的平台字样',
        (await plat('smbadv4')) === 'GAME BOY ADVANCE' &&
            (await plat('tobudx')) === 'GAME BOY' &&
            (await plat('ucity')) === 'GAME BOY COLOR',
        `${await plat('smbadv4')} / ${await plat('tobudx')} / ${await plat('ucity')}`
    );
    await page.screenshot({ path: 'evidence/tv_menu.png' });

    // ── 2. ← → 换高亮（多张卡带能移动、能两头循环）＋ Enter 开机 ──────────
    const idOf = () =>
        page
            .locator('[data-testid="tv-cartridge"][data-selected="true"]')
            .getAttribute('data-game-id');
    const firstId = await idOf();
    await page.keyboard.press('ArrowRight');
    await sleep(320);
    const secondId = await idOf();
    check('→ 把高亮移到下一张卡带', !!secondId && secondId !== firstId, `${firstId} → ${secondId}`);
    const attr = (await page.locator('[data-testid="tv-attribution"]').textContent().catch(() => '')) || '';
    check(
        '选中同人卡带 → 底栏显示作者与许可',
        attr.includes('Tangram Games') && attr.includes('MIT'),
        `底栏「${attr.trim()}」`
    );
    await page.keyboard.press('ArrowLeft');
    await sleep(320);
    check('← 移回上一张', (await idOf()) === firstId);
    await page.keyboard.press('ArrowLeft');
    await sleep(320);
    check('← 从第一张绕到最后一张（两头循环）', (await idOf()) !== firstId, `高亮 = ${await idOf()}`);
    await page.keyboard.press('ArrowRight');
    await sleep(320);
    check('→ 再按一下回到第一张', (await idOf()) === firstId);

    await page.keyboard.press('Enter');
    await sleep(700);
    check('按 Enter 进「正在开机…」遮罩', await booting());
    const overlayText = await page.locator('[data-testid="tv-boot-overlay"]').textContent().catch(() => '');
    check('遮罩文案是「正在开机…」', overlayText.includes('正在开机'));
    await page.screenshot({ path: 'evidence/tv_booting.png' });

    // ── 3. 等模拟器真的起来 ─────────────────────────────────────────────
    await page
        .waitForFunction(() => !document.querySelector('[data-testid="tv-boot-overlay"]'), null, {
            timeout: 40000
        })
        .catch(() => {});
    const overlayGone = (await page.locator('[data-testid="tv-boot-overlay"]').count()) === 0;
    check('模拟器起来后遮罩自动消失', overlayGone);
    const iframe = page.locator('.htmlScreen iframe');
    check('屏内挂上模拟器 iframe', (await iframe.count()) === 1);
    const childCanvas = await page.evaluate(() => {
        const f = document.querySelector('.htmlScreen iframe');
        return !!f?.contentDocument?.querySelector('canvas');
    });
    check('iframe 里出现 GBA 画面（canvas）', childCanvas);
    check('游戏里右上角有 ✕ 返回按钮', (await page.locator('[data-testid="tv-game-exit"]').count()) === 1);

    // 「真的在画」不能看截图：画布 preserveDrawingBuffer:false，Playwright 截图会随机抓到空缓冲
    // （实测同一画面亮度在 12 与 208 之间跳）。改成在 iframe 里给 drawArrays 打桩，紧跟绘制之后
    // readPixels 读默认 framebuffer —— 这才是屏幕上真正显示的东西。
    // 抽成可复用的两个小函数：iframe 每次重挂都是新 window，旧的打桩会跟着丢掉。
    const installPaintHook = () =>
        page.evaluate(() => {
            const f = document.querySelector('.htmlScreen iframe');
        const w = f?.contentWindow;
        if (!w || w.__paintHook) return;
        w.__paintFrame = null;
        const patch = (G) => {
            if (!G?.prototype?.drawArrays) return;
            const draw = G.prototype.drawArrays;
            G.prototype.drawArrays = function (...a) {
                const r = Reflect.apply(draw, this, a);
                if (!w.__paintFrame && this.canvas && /ejs_canvas/.test(String(this.canvas.className))) {
                    const W = this.drawingBufferWidth;
                    const H = this.drawingBufferHeight;
                    const px = new Uint8Array(4);
                    const pts = [];
                    let bright = 0;
                    let sum = 0;
                    for (const [fx, fy] of [
                        [0.5, 0.5],
                        [0.3, 0.3],
                        [0.5, 0.7],
                        [0.2, 0.5],
                        [0.7, 0.5]
                    ]) {
                        this.readPixels(
                            Math.floor(W * fx),
                            Math.floor(H * fy),
                            1,
                            1,
                            this.RGBA,
                            this.UNSIGNED_BYTE,
                            px
                        );
                        const l = (px[0] + px[1] + px[2]) / 3;
                        pts.push(Math.round(l));
                        sum += l;
                        if (l > 24) bright++;
                    }
                    w.__paintFrame = {
                        bright,
                        pts,
                        mean: +(sum / pts.length).toFixed(1),
                        size: [W, H]
                    };
                }
                return r;
            };
        };
        patch(w.WebGLRenderingContext);
        patch(w.WebGL2RenderingContext);
        w.__paintHook = true;
        });

    const readPaint = () =>
        page.evaluate(
            () => document.querySelector('.htmlScreen iframe')?.contentWindow?.__paintFrame || null
        );

    await installPaintHook();
    await sleep(1500);
    const paint = await readPaint();
    check(
        'GBA 画面真的在画（GL 帧缓冲有内容，非截图判定）',
        !!paint && paint.bright >= 2,
        JSON.stringify(paint)
    );
    const playLum = await brightShot(page, 'evidence/tv_playing.png');
    console.log(`  （tv_playing.png 用的那张截图中央亮度 ${playLum}，亮度 12 左右说明截到了空缓冲）`);

    // ── 4. 点进模拟器给 iframe 焦点 → Esc 回菜单 ────────────────────────
    const box = await iframe.boundingBox();
    if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.72);
        await sleep(600);
    }
    const focusedInIframe = await page.evaluate(() => {
        const f = document.querySelector('.htmlScreen iframe');
        return !!f?.contentDocument?.hasFocus?.();
    });
    check('点进模拟器后焦点在 iframe 里（键盘交给游戏）', focusedInIframe);
    await page.keyboard.press('Escape');
    await sleep(900);
    check('游戏里按 Esc → 回卡带菜单', await menu.isVisible().catch(() => false));
    check('回菜单后 iframe 被卸载（声音/画面都停）', (await page.locator('.htmlScreen iframe').count()) === 0);

    // ── 5. 换一张同人 GB 卡带（2048gb，32KB）再开一次，同样要真画出画面 ────────────────────────────
    const targetId = '2048gb';
    for (let i = 0; i < cartCount + 1 && (await idOf()) !== targetId; i++) {
        await page.keyboard.press('ArrowRight');
        await sleep(200);
    }
    check('高亮能走到同人卡带 2048gb', (await idOf()) === targetId, `高亮 = ${await idOf()}`);
    await page.locator('[data-testid="tv-cartridge"][data-selected="true"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="tv-boot-overlay"]'), null, {
        timeout: 40000
    });
    await sleep(500);
    const exitBtn = page.locator('[data-testid="tv-game-exit"]');
    check('第二次开机也成功（换了游戏、连点不卡）', (await page.locator('.htmlScreen iframe').count()) === 1);
    await installPaintHook();
    await sleep(1500);
    const paint2 = await readPaint();
    check(
        'GB 卡带也真的画出画面（mGBA 同时吃 GB/GBC/GBA）',
        !!paint2 && paint2.bright >= 1,
        JSON.stringify(paint2)
    );
    await brightShot(page, 'evidence/tv_game_gb.png');
    await exitBtn.click();
    await sleep(900);
    check('点 ✕ → 回卡带菜单', await menu.isVisible().catch(() => false));

    // ── 6. 菜单 ✕ 退出电视 → 回房间全景 ────────────────────────────────
    await page.locator('[data-testid="tv-menu-exit"]').click();
    await sleep(2600);
    check('菜单 ✕ → 回房间全景', (await state()) === 'default', `cameraState = ${await state()}`);
    await page.screenshot({ path: 'evidence/tv_back_to_room.png' });

    // ── 7. ROM 缺失的灰态（拦截 *.gba 为 404 后重载，探测才会重跑）──────
    await page.route('**/*.gba', (route) => route.fulfill({ status: 404, body: 'nope' }));
    await page.reload();
    await page.waitForFunction(
        () => window.__cameraStore && window.__SCENE__ && window.__ctrl,
        null,
        { timeout: 40000 }
    );
    await sleep(6000);
    const hit2 = await clickIntoTv(page);
    await sleep(3000);
    await waitMenu(page).catch(() => {});
    const grey = await page.locator('[data-testid="tv-cartridge"][data-missing="true"]').count();
    check('ROM 404 时卡带变灰（data-missing）', grey === 1, `灰态 ${grey} 张`);
    const greyText = await menu.textContent().catch(() => '');
    check('灰态卡带写清「文件缺失」+ 放哪', greyText.includes('文件缺失') && greyText.includes('public/assets/'));
    // 点一下灰卡带只切高亮（不会被选不了），底栏才会出现那句缺失提示
    await page.locator('[data-testid="tv-cartridge"][data-missing="true"]').first().click();
    await sleep(320);
    const missingHint = await page.locator('[data-testid="tv-start-hint"]').textContent().catch(() => '');
    check('灰态时提示别开始', missingHint.includes('卡带文件缺失'), `提示「${missingHint.trim()}」`);
    await page.locator('[data-testid="tv-cartridge"][data-missing="true"]').first().click();
    await sleep(1000);
    check('点灰态卡带不会开机', (await page.locator('.htmlScreen iframe').count()) === 0);
    await page.screenshot({ path: 'evidence/tv_missing.png' });
    check('探测失败也让菜单可用（不崩）', (await menu.isVisible().catch(() => false)) && hit2.tried > 0);

    // ── 8. 控制台错误 ───────────────────────────────────────────────────
    const realErrors = errors.filter(
        (e) => !/Failed to load resource|ERR_|net::|favicon/i.test(e)
    );
    check('控制台 0 真实报错', realErrors.length === 0, `${realErrors.length} 条（原始 ${errors.length} 条）`);
    realErrors.slice(0, 5).forEach((e) => console.log('  err:', e.slice(0, 160)));

    console.log(`\n结果：${results.filter(Boolean).length}/${results.length} 项通过`);
    await sleep(800);
    await browser.close();
    process.exit(results.every(Boolean) ? 0 : 1);
})();
