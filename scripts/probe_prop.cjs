/** 量桌面 y 与「原手机道具」完整 bbox（隐藏我们的机身+DOM 后 raycast） */
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
        const threeUrl = urls.find((u) => /three(\.module)?\.js/.test(u));
        const THREE = await import(/* @vite-ignore */ threeUrl);
        const scene = window.__SCENE__;
        const camera = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const shader = [], body = [];
        const phone = new THREE.Vector3(1.6725, -1.5682, -0.7941);
        scene.traverse((o) => {
            if (!o.isMesh) return;
            const isS = !!(o.material && o.material.isShaderMaterial);
            if (isS) shader.push(o); else {
                const p = new THREE.Vector3(); o.getWorldPosition(p);
                if (p.distanceTo(phone) < 0.6) body.push(o);
            }
        });
        // 我们机身世界 bbox
        const bb = new THREE.Box3(); body.forEach((m) => bb.expandByObject(m));
        const bodyBox = { mn: bb.min.toArray().map((v) => +v.toFixed(4)), mx: bb.max.toArray().map((v) => +v.toFixed(4)) };
        body.forEach((m) => (m.visible = false));
        document.querySelectorAll('.htmlPhoneScreen').forEach((el) => (el.style.display = 'none'));
        scene.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
        function cast(x, y) {
            ndc.set((x / 1280) * 2 - 1, -((y / 800) * 2 - 1));
            ray.setFromCamera(ndc, camera);
            const its = ray.intersectObjects(shader, false);
            return its.length ? its[0].point : null;
        }
        // 桌面参考点（远离道具）
        const desk = [[1080, 700], [300, 700], [1120, 300], [640, 750], [250, 300]];
        const deskPts = desk.map(([x, y]) => { const p = cast(x, y); return p ? { x, y, p: p.toArray().map((v) => +v.toFixed(4)) } : { x, y, p: null }; });
        // 道具 box 内网格
        const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        let n = 0;
        for (let y = 220; y <= 652; y += 8) for (let x = 505; x <= 804; x += 8) {
            const p = cast(x, y); if (!p) continue; n++;
            mn[0] = Math.min(mn[0], p.x); mx[0] = Math.max(mx[0], p.x);
            mn[1] = Math.min(mn[1], p.y); mx[1] = Math.max(mx[1], p.y);
            mn[2] = Math.min(mn[2], p.z); mx[2] = Math.max(mx[2], p.z);
        }
        return { bodyBox, deskPts, propHits: n, propMn: mn.map((v) => +v.toFixed(4)), propMx: mx.map((v) => +v.toFixed(4)), propSize: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]].map((v) => +v.toFixed(4)) };
    });
    console.log(JSON.stringify(res, null, 1));
    await browser.close();
})();
