// 端到端验收（iOS 6 版）：手机屏幕 = iPhone 4s 复古模拟器
// 链路：全景点手机进特写 → 锁屏 9:41/星期二 二月 8/滑动来解锁 → 按机身 Home 键不该解锁 →
//       按「看得见的行程」拖滑条 → 主屏 20 图标 + Dock 4 + 页码点 3 → 计算器 12×8=96 →
//       备忘录纸条 → 机身 Home 键回主屏（HOME_EVENT 桥）→ 地图彩蛋弹窗 → 时钟走秒 →
//       乱点不穿透 → 按 R 回全景 → 控制台 0 错
//
// 注意：这里所有交互都是真实鼠标/键盘事件。老的版本为了让解锁通过，
// 把滑条拖了 trackWidth × 2.2（超出屏幕外的 CSS 距离），属于「测试迁就 bug」，
// 已删除；现在只按渲染出来的可见行程拖，拖到底就必须解锁。
// 跑法（本机没把 playwright 装进项目，用全局那份）：
//   NODE_PATH="C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules" \
//     node scripts/final_check_iphone.cjs           # 端口默认 5174，可 BASE=... 覆盖
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, extra = '') => {
    results.push(ok);
    console.log(`${ok ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(BASE);
    await page.waitForFunction(() => window.__cameraStore && window.__SCENE__ && window.__ctrl, null, { timeout: 40000 });
    await sleep(6000); // 等房间加载

    const state = () => page.evaluate(() => window.__cameraStore.getState().cameraState);

    // ── 1. 全景视角用真实鼠标点手机机身 → 应该进特写 ──────────────────────
    const phonePoint = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const p = new THREE.Vector3(1.6725, -1.6135, -0.7941).project(cam);
        return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
    });
    await page.mouse.click(phonePoint.x, phonePoint.y);
    await page.waitForFunction(() => window.__cameraStore.getState().cameraState === 'smartphone', null, { timeout: 8000 }).catch(() => {});
    check('全景点手机机身 → 进入手机特写', (await state()) === 'smartphone', `点击 (${phonePoint.x.toFixed(0)}, ${phonePoint.y.toFixed(0)})`);
    await sleep(3500); // 等镜头动画

    // 注意：.htmlPhoneScreen 是 drei 生成的「视口大小」外壳（bbox = 整个视口），
    // 真正代表屏幕的是 IPhone4S 的根节点 data-testid="phone-screen"（320×480）——
    // 文字断言与坐标计算都用它。
    const screen = page.locator('[data-testid="phone-screen"]').first();
    check('手机屏 DOM 挂载', await screen.isVisible().catch(() => false));

    // ── 2. iOS 6 锁屏 ────────────────────────────────────────────────
    const lockText = await screen.textContent().catch(() => '');
    check('锁屏时间 9:41', lockText.includes('9:41'));
    check('锁屏日期 星期二 二月 8（iOS 6 版式）', lockText.includes('星期二') && lockText.includes('二月'));
    check('滑动来解锁提示', lockText.includes('滑动来解锁'));
    check('状态栏运营商 中国移动', lockText.includes('中国移动'));
    await page.screenshot({ path: 'evidence/iphone_lock.png' });

    // 机身实体 Home 键：特写里 canvas 的 pointerEvents 被 drei 设成 none，
    // 所以点击目标是 DOM 层那块透明热区（data-testid=phone-home-key），
    // 用真实鼠标点它的屏幕中心 —— 与用户手指按真机 Home 键同一条链路。
    const homeBox = await page.locator('[data-testid="phone-home-key"]').boundingBox().catch(() => null);
    const homePos = homeBox
        ? { x: homeBox.x + homeBox.width / 2, y: homeBox.y + homeBox.height / 2, d: homeBox.width }
        : null;
    check('找到机身 Home 键热区', !!homePos, homePos ? `热区直径 ${homePos.d.toFixed(0)}px` : '');

    // ── 3. 锁屏时按机身 Home 键：不应该跳过锁屏 ─────────────────────────
    if (homePos) {
        await page.mouse.click(homePos.x, homePos.y);
        await sleep(600);
    }
    const stillLocked = (await screen.textContent().catch(() => '')).includes('滑动来解锁');
    check('锁屏时按机身 Home 键 → 仍在锁屏', stillLocked);

    // ── 4. 按「看得见的行程」拖滑条解锁 ────────────────────────────────
    const track = page.locator('.htmlPhoneScreen div[data-testid="lock-slider"]');
    const tb = await track.boundingBox();
    const travel = tb ? tb.width - tb.height : 0;
    if (tb) {
        const y = tb.y + tb.height / 2;
        const startX = tb.x + tb.height / 2;
        const endX = tb.x + tb.width - tb.height / 2;
        await page.mouse.move(startX, y);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) await (page.mouse.move(startX + ((endX - startX) * i) / 10, y), sleep(40));
        await page.mouse.up();
    }
    await sleep(900);
    const homeText = await screen.textContent().catch(() => '');
    check('拖可见行程解锁（不超出轨道）', homeText.includes('Safari'), `轨道渲染宽 ${tb ? tb.width.toFixed(0) : '?'}px，拖动 ${travel.toFixed(0)}px（行程占比 ${tb ? (travel / tb.width).toFixed(2) : '?'}）`);

    // ── 5. iOS 6 主屏：20 图标 + Dock 4 + 页码点 3 ─────────────────────
    // 注意：屏内 24 个图标按钮之外，.htmlPhoneScreen 里还有一块机身 Home 键的透明热区
    // （data-testid=phone-home-key），计数时排掉它。
    const iconCount = await page.locator('.htmlPhoneScreen button:not([data-testid="phone-home-key"])').count();
    check('主屏图标 20 + Dock 4', iconCount === 24, `按钮数 ${iconCount}`);
    for (const label of ['信息', '日历', '照片', '相机', '地图', '时钟', '计算器', '备忘录', '设置', '电话', '邮件', '音乐', 'Safari']) {
        if (!homeText.includes(label)) check(`主屏有「${label}」`, false);
    }
    check('主屏图标标签齐全（信息/日历/照片/相机/地图/时钟/计算器/备忘录/设置/电话/邮件/音乐/Safari）',
        ['信息', '日历', '照片', '相机', '地图', '时钟', '计算器', '备忘录', '设置', '电话', '邮件', '音乐', 'Safari'].every((l) => homeText.includes(l)));
    const dots = await page.locator('.htmlPhoneScreen div[style*="border-radius: 50%"]').count();
    check('主屏页码点存在', dots >= 3, `圆形元素 ${dots}`);
    await page.screenshot({ path: 'evidence/iphone_home.png' });

    // ── 6. 计算器：12 × 8 = 96 ────────────────────────────────────────
    const press = async (label) => {
        const k = page.locator('.htmlPhoneScreen button').filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first();
        if (await k.count()) await k.click();
        await sleep(140);
    };
    await page.locator('.htmlPhoneScreen button').filter({ hasText: '计算器' }).first().click();
    await sleep(500);
    await press('1');
    await press('2');
    await press('×');
    await press('8');
    await press('=');
    const display = (await page.locator('.htmlPhoneScreen [data-testid="calc-display"]').textContent().catch(() => '')).trim();
    check('计算器 12×8=96', display === '96', `显示「${display}」`);
    await page.screenshot({ path: 'evidence/iphone_calc.png' });

    // ── 7. 机身 Home 键 → 回主屏（HOME_EVENT 桥）+ 备忘录 ───────────────
    if (homePos) await page.mouse.click(homePos.x, homePos.y);
    await sleep(700);
    const backHome = (await screen.textContent().catch(() => '')).includes('Safari');
    check('按机身 Home 键 → 回主屏', backHome);
    await page.locator('.htmlPhoneScreen button').filter({ hasText: '备忘录' }).first().click();
    await sleep(500);
    await page.locator('.htmlPhoneScreen div').filter({ hasText: '修好了台灯' }).first().click().catch(() => {});
    await sleep(500);
    const notesText = await screen.textContent().catch(() => '');
    check('备忘录纸条（修好了台灯）', notesText.includes('修好了台灯'));

    // ── 8. 地图彩蛋：无网络连接弹窗 ───────────────────────────────────
    if (homePos) await page.mouse.click(homePos.x, homePos.y);
    await sleep(600);
    await page.locator('.htmlPhoneScreen button').filter({ hasText: '地图' }).first().click();
    await sleep(500);
    const dlgText = await screen.textContent().catch(() => '');
    check('地图彩蛋弹窗（无网络连接）', dlgText.includes('无网络连接'));
    await page.screenshot({ path: 'evidence/iphone_map_dialog.png' });
    await page.locator('.htmlPhoneScreen button').filter({ hasText: '好' }).first().click().catch(() => {});
    await sleep(300);

    // ── 9. 时钟走秒 ──────────────────────────────────────────────────
    if (homePos) await page.mouse.click(homePos.x, homePos.y);
    await sleep(600);
    await page.locator('.htmlPhoneScreen button').filter({ hasText: '时钟' }).first().click();
    await sleep(2200);
    const clockText = await screen.textContent().catch(() => '');
    check('时钟 App（9:41 + 发布会时刻）', clockText.includes('9:41') && clockText.includes('发布会时刻'));
    await page.screenshot({ path: 'evidence/iphone_clock.png' });

    // ── 10. 乱点不穿透：镜头状态不能变 ────────────────────────────────
    // 注意：手机屏在 3D 里是斜的，screen 的 bbox 角点会落到机身之外 →
    // 那些点本来就该点到桌子/画布上，不算「穿透」。所以只把 elementFromPoint
    // 落在手机 DOM（.htmlPhoneScreen 内）上的点击算作有效样本。
    const before = await state();
    const pb = await screen.boundingBox();
    let hits = 0;
    const flips = [];
    if (pb) {
        const cx = pb.x + pb.width / 2;
        const cy = pb.y + pb.height / 2;
        for (const [dx, dy] of [
            [-0.35, -0.3],
            [0.35, -0.3],
            [0, 0],
            [-0.35, 0.3],
            [0.35, 0.3]
        ]) {
            const x = cx + pb.width * dx;
            const y = cy + pb.height * dy;
            const onPhone = await page.evaluate(
                ([px, py]) => {
                    const el = document.elementFromPoint(px, py);
                    return !!(el && el.closest('.htmlPhoneScreen'));
                },
                [x, y]
            );
            await page.mouse.click(x, y);
            await sleep(280);
            if (!onPhone) continue;
            hits += 1;
            const now = await state();
            if (now !== before) flips.push(`(${x.toFixed(0)},${y.toFixed(0)})`);
        }
    }
    const after = await state();
    check('乱点手机屏不穿透（镜头不跳）', before === after, `${before} -> ${after}，有效点击 ${hits} 处${flips.length ? '，穿透：' + flips.join(' ') : ''}`);

    // ── 11. 按 R 回房间全景 ──────────────────────────────────────────
    await page.keyboard.press('KeyR');
    await sleep(2600);
    check('按 R 回房间全景', (await state()) === 'default', `cameraState = ${await state()}`);
    await page.screenshot({ path: 'evidence/iphone_back_to_room.png' });

    // ── 12. 控制台错误 ───────────────────────────────────────────────
    check('控制台 0 错误', errors.length === 0, `${errors.length} 条`);
    errors.slice(0, 5).forEach((e) => console.log('  err:', e.slice(0, 160)));

    console.log(`\n结果：${results.filter(Boolean).length}/${results.length} 项通过`);
    await sleep(800);
    await browser.close();
    process.exit(results.every(Boolean) ? 0 : 1);
})();
