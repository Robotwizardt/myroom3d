/**
 * 探针15：验证「机身+DOM屏同 group」渲染链路。
 * 目的：确认 1)机身 body group 世界坐标 2)Html 挂点挂进 body group 后的屏幕矩形
 * 3)相机飞到机身正上方后 DOM 是否可见、click 是否命中。
 * 不修改任何源码——直接在浏览器里用 __SCENE__ 与 __cameraStore 检查。
 */
const { chromium } = require('playwright');

const URL = 'http://localhost:5173/';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    // 1) 机身世界坐标：scene traverse 找 RoundedBox 详细件
    const bodyInfo = await page.evaluate(() => {
        const scene = window.__SCENE__;
        if (!scene) return { found: false };
        const boxes = [];
        scene.traverse((o) => {
            if (o.geometry && o.geometry.type === 'BoxGeometry' && o.geometry.parameters) {
                // RoundedBox uses BoxGeometry? No - RoundedBoxGeometry. check name
            }
            if (o.name && o.name.includes('RoundedBox')) boxes.push(o.name);
        });
        // 找含 metalness 材质的 mesh，估算 world pos
        let found = [];
        scene.traverse((o) => {
            if (o.isMesh && o.material && o.material.metalness === 0.9) {
                o.updateWorldMatrix(true, false);
                const wp = o.getWorldPosition(new (o.position.constructor)());
                found.push({ name: o.name, world: wp.toArray() });
            }
        });
        return { found: true, boxes, metalCount: found.length, first: found[0] };
    });
    console.log('=== 1) 机身探查 ===');
    console.log(JSON.stringify(bodyInfo, null, 2));

    // 2) 进入特写前：找 body group 里是否已有 Html DOM
    const domBefore = await page.evaluate(() => {
        const el = document.querySelector('.htmlPhoneScreen');
        return el ? { found: true, rect: el.getBoundingClientRect().toJSON() } : { found: false };
    });
    console.log('=== 2) 特写前 DOM 屏 ===');
    console.log(JSON.stringify(domBefore, null, 2));

    // 3) 切到 smartphone 特写，看 DOM 屏 rect 与相机
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3000);

    const domAfter = await page.evaluate(() => {
        const el = document.querySelector('.htmlPhoneScreen');
        const inner = el && el.querySelector('div');
        let matrix = null;
        if (inner) {
            const t = getComputedStyle(inner).transform;
            if (t && t.startsWith('matrix3d')) {
                const v = t.slice(8, -1).split(',').map(Number);
                matrix = {
                    X: v.slice(0, 3),
                    Y: v.slice(4, 8),
                    Z: v
                        .slice(8, 11)
                        .concat(v[11])
                };
            }
        }
        return { found: !!el, rect: el ? el.getBoundingClientRect().toJSON() : null, matrix };
    });
    console.log('=== 3) 特写后 DOM 屏 ===');
    console.log('DOM 屏 rect:', JSON.stringify(domAfter, null, 2));

    // 4) 相机位置
    const cam = await page.evaluate(() => {
        const c = window.__SCENE__?.camera || null;
        return c ? { pos: c.position.toArray(), fov: c.fov } : null;
    });
    console.log('=== 4) 相机 ===');
    console.log(JSON.stringify(cam, null, 2));

    // 5) 截图
    await page.screenshot({ path: 'evidence/probe15_align_current.png' });

    console.log('=== 控制台错误 ===');
    console.log(errors.length ? errors.join('\n') : '(0 errors)');
    await browser.close();
})();
