/** 只量「原手机道具」本体（y 高于桌面 1cm 以上的命中点）的 x/z 足迹 + 最高点，并量我们机身的世界盒 */
const path = require('path');
const { chromium } = require('playwright');
const URL = 'http://localhost:5174/';
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 30000 });
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    const res = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(/* @vite-ignore */ urls.find((u) => /three(\.module)?\.js/.test(u)));
        const scene = window.__SCENE__;
        const camera = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const shader = [], body = [];
        const phone = new THREE.Vector3(1.6725, -1.5682, -0.7941);
        scene.traverse((o) => {
            if (!o.isMesh) return;
            if (o.material && o.material.isShaderMaterial) shader.push(o);
            else { const p = new THREE.Vector3(); o.getWorldPosition(p); if (p.distanceTo(phone) < 0.6) body.push(o); }
        });
        const bb = new THREE.Box3(); body.forEach((m) => bb.expandByObject(m));
        const out = { bodyMn: bb.min.toArray().map((v) => +v.toFixed(4)), bodyMx: bb.max.toArray().map((v) => +v.toFixed(4)) };
        body.forEach((m) => (m.visible = false));
        document.querySelectorAll('.htmlPhoneScreen').forEach((el) => (el.style.display = 'none'));
        scene.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
        const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        let n = 0; const topHits = [];
        for (let y = 200; y <= 700; y += 4) for (let x = 480; x <= 830; x += 4) {
            ndc.set((x / 1280) * 2 - 1, -((y / 800) * 2 - 1));
            ray.setFromCamera(ndc, camera);
            const its = ray.intersectObjects(shader, false);
            if (!its.length) continue;
            const p = its[0].point;
            if (p.y < -1.6045) continue; // 排除桌面本身（桌面 y=-1.6145）
            n++;
            mn[0] = Math.min(mn[0], p.x); mx[0] = Math.max(mx[0], p.x);
            mn[1] = Math.min(mn[1], p.y); mx[1] = Math.max(mx[1], p.y);
            mn[2] = Math.min(mn[2], p.z); mx[2] = Math.max(mx[2], p.z);
            if (p.y > -1.55 && topHits.length < 8) topHits.push([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)]);
        }
        out.prop = { n, mn: mn.map((v) => +v.toFixed(4)), mx: mx.map((v) => +v.toFixed(4)), size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]].map((v) => +v.toFixed(4)), topHits };
        return out;
    });
    console.log(JSON.stringify(res, null, 1));
    await browser.close();
})();
