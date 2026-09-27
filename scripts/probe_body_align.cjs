// 探针14：iPhone 4s 实体机身接线后视觉验收
// 1. 远景截图（桌上手机应为立体机身而非纸片）
// 2. 进特写：机身与 DOM 屏是否对齐（DOM 屏四边应落在玻璃面板内）
// 3. 点击机身进特写（点击行为）
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('http://localhost:5173');
    await sleep(6000);
    await page.screenshot({ path: 'evidence/body_far.png' });

    // 找机身 mesh：场景里 RoundedBox 的名字特征不明显，直接用世界坐标点手机位置附近
    const bodyInfo = await page.evaluate(() => {
        const hits = [];
        window.__SCENE__?.traverse((o) => {
            if (o.isMesh && o.geometry?.type === 'BoxGeometry') {
                const p = new DOMPointReadOnly(
                    o.matrixWorld.elements[12],
                    o.matrixWorld.elements[13],
                    o.matrixWorld.elements[14]
                );
                // 找桌上手机附近（世界 [2.429,-1.242,2.122] 半径 0.6 内）
                const d = Math.hypot(p.x - 2.429, p.y - -1.242, p.z - 2.122);
                if (d < 0.8) hits.push({ name: o.name || o.parent?.name, d: d.toFixed(3), pos: [p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3)] });
            }
        });
        return hits;
    });
    console.log('手机附近 BoxGeometry mesh:', JSON.stringify(bodyInfo, null, 1));

    // 点击世界坐标 [2.429, -1.242, 2.122] 处 → 应进特写
    // 屏幕投影：用 raycast 从相机往该点打不太方便，直接点屏幕中央偏手机区域
    // 手机在视口何处？先用 evaluate 把 3D 点投影到屏幕
    const proj = await page.evaluate(() => {
        // 找相机
        const cam = window.__SCENE__?.children.find((c) => c.isCamera) || null;
        if (!cam) return null;
        return 'found-cam';
    });
    console.log('相机:', proj);

    // 直接试：进特写后截图看对齐
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    // 等待期间 __SCENE__ 可能还没挂上，重试检查
    const hasScene = await page.evaluate(() => !!window.__SCENE__);
    console.log('__SCENE__ 存在:', hasScene);
    await sleep(3500);
    await page.screenshot({ path: 'evidence/body_closeup.png' });

    // DOM 屏与机身对齐检查：wrapper 的 rect 应在视口中合理位置
    const info = await page.evaluate(() => {
        const wrap = document.querySelector('.htmlPhoneScreen');
        const r = wrap.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    console.log('DOM wrapper rect:', JSON.stringify(info));

    console.log('控制台错误数:', errors.length);
    errors.slice(0, 3).forEach((e) => console.log('  err:', e.slice(0, 140)));
    await browser.close();
})();
