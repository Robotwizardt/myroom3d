/** 诊断：真人操作路径 —— 默认视角点手机 → 进特写 → 拖锁屏滑块，看哪一步断 */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 160)));
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await sleep(4000);

    const state = () => page.evaluate(() => window.__cameraStore.getState().cameraState);
    console.log('初始 cameraState:', await state());

    // 手机机身世界坐标投影到屏幕
    const proj = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const ctrl = window.__ctrl;
        const cam = ctrl.camera || ctrl._camera || ctrl.object;
        const p = new THREE.Vector3(1.6725, -1.6135, -0.7941).project(cam);
        return [Math.round((p.x * 0.5 + 0.5) * 1280), Math.round((-p.y * 0.5 + 0.5) * 800)];
    });
    console.log('手机机身投影到屏幕:', proj);

    // 1) 真人点击（视口坐标）
    await page.mouse.click(proj[0], proj[1]);
    await sleep(3500);
    console.log('点击后 cameraState:', await state());

    // 2) DOM 屏有没有出现？尺寸多少？
    const dom = await page.evaluate(() => {
        const el = document.querySelector('.htmlPhoneScreen');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const inner = el.querySelector('div');
        return {
            wrapperRect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
            innerCSS: inner ? [inner.offsetWidth, inner.offsetHeight] : null,
            innerRect: inner ? (() => { const q = inner.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; })() : null,
            pointerEvents: getComputedStyle(el).pointerEvents,
        };
    });
    console.log('DOM 屏:', JSON.stringify(dom));

    // 3) 锁屏滑块拖动（按视觉尺寸拖，模拟真人）
    const track = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('div')];
        const t = nodes.find((n) => n.style && n.style.width === '220px' && n.style.height === '44px');
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], offsetWidth: t.offsetWidth };
    });
    console.log('解锁轨道:', JSON.stringify(track));
    if (track) {
        const [x, y, w, h] = track.rect;
        const yMid = y + h / 2;
        await page.mouse.move(x + 22, yMid);
        await page.mouse.down();
        for (let i = 1; i <= 12; i += 1) {
            await page.mouse.move(x + 22 + ((w - 44) * i) / 12, yMid);
            await sleep(30);
        }
        await page.mouse.up();
        await sleep(1200);
        const after = await page.evaluate(() => {
            const t = [...document.querySelectorAll('div')].find((n) => n.style && n.style.width === '220px');
            return t ? t.parentElement.parentElement.textContent.includes('滑动来解锁') : null;
        });
        console.log('拖完滑块后仍在锁屏:', after);
    }

    console.log('控制台错误:', errors.length ? errors.join(' | ') : '(0)');
    await page.screenshot({ path: 'evidence/user_path_after_drag.png' });
    await browser.close();
})();
