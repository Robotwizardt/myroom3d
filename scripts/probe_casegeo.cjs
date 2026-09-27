/**
 * 用几何法量「绿壳手机」：遍历 ShaderMaterial 壳的三角形，
 * 取 uv 落在壳岛范围内的三角形，统计其世界坐标 bbox 与位置簇。
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
    const res = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const threeUrl = urls.find((u) => /three(\.module)?\.js/.test(u));
        const THREE = await import(/* @vite-ignore */ threeUrl);
        const scene = window.__SCENE__;
        const meshes = [];
        scene.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial) meshes.push(o); });

        const BOXES = [
            { tag: 'caseA', u0: 0.573, u1: 0.612, v0: 0.005, v1: 0.175 },
            { tag: 'deskB', u0: 0.392, u1: 0.413, v0: 0.155, v1: 0.178 },
        ];
        const out = {};
        for (const B of BOXES) {
            const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
            const clusters = new Map();
            let tris = 0;
            const v = new THREE.Vector3();
            meshes.forEach((mesh) => {
                const g = mesh.geometry;
                const pos = g.attributes.position, uv = g.attributes.uv, idx = g.index;
                const count = idx ? idx.count : pos.count;
                const mw = mesh.matrixWorld;
                for (let i = 0; i < count; i += 3) {
                    const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
                    const ua = uv.getX(a), va = uv.getY(a), ub = uv.getX(b), vb = uv.getY(b), uc = uv.getX(c), vc = uv.getY(c);
                    const cu = (ua + ub + uc) / 3, cv = (va + vb + vc) / 3;
                    if (!(cu > B.u0 && cu < B.u1 && cv > B.v0 && cv < B.v1)) continue;
                    tris++;
                    for (const k of [a, b, c]) {
                        v.set(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(mw);
                        mn[0] = Math.min(mn[0], v.x); mx[0] = Math.max(mx[0], v.x);
                        mn[1] = Math.min(mn[1], v.y); mx[1] = Math.max(mx[1], v.y);
                        mn[2] = Math.min(mn[2], v.z); mx[2] = Math.max(mx[2], v.z);
                    }
                    v.set(pos.getX(a), pos.getY(a), pos.getZ(a)).applyMatrix4(mw);
                    const key = `${v.x.toFixed(2)},${v.z.toFixed(2)}`;
                    clusters.set(key, (clusters.get(key) || 0) + 1);
                }
            });
            out[B.tag] = {
                tris,
                mn: mn.map((x) => +x.toFixed(4)), mx: mx.map((x) => +x.toFixed(4)),
                size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]].map((x) => +x.toFixed(4)),
                topClusters: [...clusters.entries()].sort((p, q) => q[1] - p[1]).slice(0, 12),
                clusterCount: clusters.size,
            };
        }
        return out;
    });
    console.log(JSON.stringify(res, null, 1));
    await browser.close();
})();
