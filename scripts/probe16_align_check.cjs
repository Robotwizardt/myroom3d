/**
 * 探针16：验证「机身 + DOM 屏 + 相机」三者对齐。
 * 1. 进特写（smartphone）后截图：相机应从机身正上方俯视，
 *    看到 DOM 屏嵌在机身屏幕开口里。
 * 2. 读机身中框 mesh 世界坐标（metalness 0.9）和 DOM 屏内层 div 的
 *    matrix3d 世界位置，两者应重合（差 < 0.1m）。
 * 3. 输出相机位置验证 setLookAt 生效。
 */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    const before = await page.evaluate(() => {
        const scene = window.__SCENE__;
        if (!scene) return { err: 'no __SCENE__' };
        let frame = null;
        scene.traverse((o) => {
            if (o.isMesh && o.material && o.material.metalness === 0.9) frame = o;
        });
        if (!frame) return { err: 'no frame mesh' };
        const wp = frame.getWorldPosition(new (frame.position.constructor)());
        return { frameWorld: [wp.x, wp.y, wp.z] };
    });
    console.log('特写前机身中框:', JSON.stringify(before));

    // 进特写
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(2500);

    const after = await page.evaluate(() => {
        const scene = window.__SCENE__;
        let frame = null;
        scene.traverse((o) => {
            if (o.isMesh && o.material && o.material.metalness === 0.9) frame = o;
        });
        const wp = frame
            ? frame.getWorldPosition(new (frame.position.constructor)())
            : null;
        // DOM 屏内层 div 的 matrix3d
        const inner = document.querySelector('.htmlPhoneScreen > div > div');
        const r = inner ? inner.getBoundingClientRect() : null;
        const transform = inner ? inner.style.transform : null;
        // 相机：canvas 的 WebGLCamera 拿不到，但可以从渲染画布近似；
        // 用 __SCENE__ 上挂的 camera（若有）
        const cam = window.__SCENE__.camera;
        const camPos = cam ? [cam.position.x, cam.position.y, cam.position.z] : null;
        return {
            frameWorld: wp ? [wp.x, wp.y, wp.z] : null,
            innerRect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
            transform: transform ? transform.slice(0, 160) : null,
            camPos
        };
    });
    console.log('特写后:', JSON.stringify(after, null, 1));

    await page.screenshot({ path: 'evidence/probe16_align_check.png' });
    console.log('截图: evidence/probe16_align_check.png');
    console.log('控制台错误数:', errors.length);
    errors.slice(0, 5).forEach((e) => console.log('  ERR:', e));
    await browser.close();
})();
