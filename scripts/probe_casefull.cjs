/**
 * 隐藏我们的机身+DOM（露出原烘焙绿壳），扫描屏幕上所有绿色像素，
 * 再把这些像素在页面里 raycast 到房间壳，得到绿壳的完整世界 bbox。
 * 同时量桌面顶面 y（用不绿的表面对照）。
 */
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules/playwright-core/lib/utilsBundle.js');
const URL = 'http://localhost:5174/';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 30000 });
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
        const scene = window.__SCENE__;
        const phone = [1.6725, -1.5682, -0.7941];
        scene.traverse((o) => {
            if (!o.isMesh || (o.material && o.material.isShaderMaterial)) return;
            const p = o.position.clone();
            if (o.parent) o.parent.localToWorld(p);
            const d = Math.hypot(p.x - phone[0], p.y - phone[1], p.z - phone[2]);
            if (d < 0.6) o.visible = false;
        });
        document.querySelectorAll('.htmlPhoneScreen').forEach((el) => (el.style.display = 'none'));
    });
    await page.waitForTimeout(1500);
    const buf = await page.screenshot();
    const png = PNG.sync.read(buf);
    const { width, height, data } = png;
    const greens = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (g > 60 && g > r * 1.15 && g > b * 1.15) greens.push([x, y]);
        }
    }
    console.log('绿像素数:', greens.length);
    // 逐行取 bbox 便于看形状
    const bb = [1e9, 1e9, -1e9, -1e9];
    greens.forEach(([x, y]) => { bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y); });
    console.log('屏幕 bbox:', bb);

    const res = await page.evaluate(async (pts) => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const threeUrl = urls.find((u) => /three(\.module)?\.js/.test(u));
        const THREE = await import(/* @vite-ignore */ threeUrl);
        const scene = window.__SCENE__;
        let camera = window.__ctrl && (window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object);
        const meshes = [];
        scene.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial) meshes.push(o); });
        const ray = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        let hit = 0, miss = 0, far = 0;
        const uvMin = [9, 9], uvMax = [-9, -9];
        const phone = new THREE.Vector3(1.6725, -1.5682, -0.7941);
        pts.forEach(([x, y]) => {
            ndc.set((x / 1280) * 2 - 1, -((y / 800) * 2 - 1));
            ray.setFromCamera(ndc, camera);
            const its = ray.intersectObjects(meshes, false);
            if (!its.length) { miss++; return; }
            const it = its[0];
            if (it.point.distanceTo(phone) > 0.6) { far++; return; }
            hit++;
            mn[0] = Math.min(mn[0], it.point.x); mx[0] = Math.max(mx[0], it.point.x);
            mn[1] = Math.min(mn[1], it.point.y); mx[1] = Math.max(mx[1], it.point.y);
            mn[2] = Math.min(mn[2], it.point.z); mx[2] = Math.max(mx[2], it.point.z);
            if (it.uv) { uvMin[0] = Math.min(uvMin[0], it.uv.x); uvMax[0] = Math.max(uvMax[0], it.uv.x); uvMin[1] = Math.min(uvMin[1], it.uv.y); uvMax[1] = Math.max(uvMax[1], it.uv.y); }
        });
        return { hit, miss, far, mn: mn.map((v) => +v.toFixed(4)), mx: mx.map((v) => +v.toFixed(4)), size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]].map((v) => +v.toFixed(4)), uvMin: uvMin.map((v) => +v.toFixed(4)), uvMax: uvMax.map((v) => +v.toFixed(4)) };
    }, greens.filter((_, i) => i % 3 === 0));
    console.log(JSON.stringify(res, null, 1));

    // 桌面顶面 y：取手机旁边一点（屏幕坐标往右下 60px）
    const deskY = await page.evaluate(async (p) => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const threeUrl = urls.find((u) => /three(\.module)?\.js/.test(u));
        const THREE = await import(/* @vite-ignore */ threeUrl);
        const scene = window.__SCENE__;
        const camera = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const meshes = [];
        scene.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial) meshes.push(o); });
        const ray = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const out = [];
        [[p[0] + 80, p[1] + 80], [p[0] - 80, p[1] + 80], [p[0], p[1] + 120]].forEach(([x, y]) => {
            ndc.set((x / 1280) * 2 - 1, -((y / 800) * 2 - 1));
            ray.setFromCamera(ndc, camera);
            const its = ray.intersectObjects(meshes, false);
            if (its.length) out.push({ x, y, p: [its[0].point.x, its[0].point.y, its[0].point.z].map((v) => +v.toFixed(4)) });
        });
        return out;
    }, [640, 400]);
    console.log('桌面参考点射线命中:', JSON.stringify(deskY));
    await browser.close();
})();
