/**
 * 量原项目烘焙「绿壳手机」的完整 3D 尺寸。
 * 技巧：three 模块 URL 从页面已加载资源里找出来，再动态 import（不改项目源码）。
 */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);

    const res = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const threeUrl = urls.find((u) => /three(\.module)?\.js/.test(u));
        if (!threeUrl) return { error: 'three module url not found', sample: urls.slice(0, 20) };
        const THREE = await import(/* @vite-ignore */ threeUrl);
        const scene = window.__SCENE__;
        let camera = null;
        scene.traverse((o) => { if (o.isPerspectiveCamera) camera = o; });
        if (!camera && window.__ctrl) camera = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        if (!camera) return { error: 'no camera' };

        const phone = new THREE.Vector3(1.6725, -1.5682, -0.7941);
        const bodyMeshes = [];
        const shaderMeshes = [];
        scene.traverse((o) => {
            if (!o.isMesh) return;
            const p = new THREE.Vector3();
            o.getWorldPosition(p);
            const d = p.distanceTo(phone);
            const isShader = !!(o.material && o.material.isShaderMaterial);
            if (isShader) shaderMeshes.push(o);
            else if (d < 0.6) bodyMeshes.push(o);
        });

        // 我们机身的世界 bbox
        const bodyBox = new THREE.Box3();
        bodyMeshes.forEach((m) => bodyBox.expandByObject(m));
        // 隐藏机身 + DOM
        bodyMeshes.forEach((m) => { m.visible = false; });
        document.querySelectorAll('.htmlPhoneScreen').forEach((el) => (el.style.display = 'none'));
        scene.updateMatrixWorld(true);

        // 网格 raycast：壳岛 uv 判定
        const CASE_UV = { u0: 0.573, u1: 0.610, v0: 0.008, v1: 0.172 }; // 大壳上的壳岛
        const CASE_UV2 = { u0: 0.393, u1: 0.412, v0: 0.157, v1: 0.176 }; // 另一 mesh 的桌面绿区
        const ray = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const pts = [];
        let hits = 0, uv1 = 0, uv2 = 0, other = 0;
        const uvSeen = [];
        for (let py = 190; py <= 680; py += 4) {
            for (let px = 480; px <= 830; px += 4) {
                ndc.set((px / 1280) * 2 - 1, -((py / 800) * 2 - 1));
                ray.setFromCamera(ndc, camera);
                const its = ray.intersectObjects(shaderMeshes, false);
                if (!its.length) continue;
                const it = its[0];
                hits++;
                const uv = it.uv;
                if (!uv) continue;
                const in1 = uv.x > CASE_UV.u0 && uv.x < CASE_UV.u1 && uv.y > CASE_UV.v0 && uv.y < CASE_UV.v1;
                const in2 = uv.x > CASE_UV2.u0 && uv.x < CASE_UV2.u1 && uv.y > CASE_UV2.v0 && uv.y < CASE_UV2.v1;
                if (in1) uv1++; else if (in2) uv2++; else { other++; continue; }
                pts.push([it.point.x, it.point.y, it.point.z]);
                if (uvSeen.length < 6) uvSeen.push([+uv.x.toFixed(4), +uv.y.toFixed(4), in1 ? 'case' : 'desk']);
            }
        }
        const bb = { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] };
        pts.forEach((p) => { for (let i = 0; i < 3; i++) { bb.mn[i] = Math.min(bb.mn[i], p[i]); bb.mx[i] = Math.max(bb.mx[i], p[i]); } });
        return {
            threeUrl,
            bodyWorldBox: {
                mn: bodyBox.min.toArray().map((v) => +v.toFixed(4)),
                mx: bodyBox.max.toArray().map((v) => +v.toFixed(4)),
                size: bodyBox.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4)),
            },
            hits, uv1, uv2, other,
            caseWorldBox: { mn: bb.mn.map((v) => +v.toFixed(4)), mx: bb.mx.map((v) => +v.toFixed(4)) },
            caseWorldSize: ptSize(bb),
            uvSamples: uvSeen,
            shaderMeshCount: shaderMeshes.length,
            bodyMeshCount: bodyMeshes.length,
        };
        function ptSize(b) { return [b.mx[0] - b.mn[0], b.mx[1] - b.mn[1], b.mx[2] - b.mn[2]].map((v) => +v.toFixed(4)); }
    });
    console.log(JSON.stringify(res, null, 1));
    await browser.close();
})();
