/** 几何法（不 raycast，快）：房间壳中「桌面之上、手机附近」的三角形 -> 世界 bbox + 2cm 位置簇 */
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
        const THREE = await import(/* @vite-ignore */ urls.find((u) => /three(\.module)?\.js/.test(u)));
        const scene = window.__SCENE__;
        const meshes = [];
        scene.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial) meshes.push(o); });
        const BOX = { mn: [1.45, -1.6060, -1.28], mx: [2.10, -1.4800, -0.32] };
        const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        const clusters = new Map();
        let tris = 0;
        const v = new THREE.Vector3();
        meshes.forEach((mesh) => {
            const g = mesh.geometry, pos = g.attributes.position, idx = g.index, mw = mesh.matrixWorld;
            const count = idx ? idx.count : pos.count;
            for (let i = 0; i < count; i += 3) {
                const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
                v.set((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3).applyMatrix4(mw);
                if (!(v.x > BOX.mn[0] && v.x < BOX.mx[0] && v.y > BOX.mn[1] && v.y < BOX.mx[1] && v.z > BOX.mn[2] && v.z < BOX.mx[2])) continue;
                tris++;
                for (const k of [a, b, c]) {
                    const w = new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(mw);
                    mn[0] = Math.min(mn[0], w.x); mx[0] = Math.max(mx[0], w.x);
                    mn[1] = Math.min(mn[1], w.y); mx[1] = Math.max(mx[1], w.y);
                    mn[2] = Math.min(mn[2], w.z); mx[2] = Math.max(mx[2], w.z);
                }
                const key = `${v.x.toFixed(2)},${v.z.toFixed(2)}`;
                const e = clusters.get(key) || { n: 0, ymin: 9, ymax: -9 };
                e.n++; e.ymin = Math.min(e.ymin, +v.y.toFixed(3)); e.ymax = Math.max(e.ymax, +v.y.toFixed(3));
                clusters.set(key, e);
            }
        });
        return {
            tris,
            mn: mn.map((x) => +x.toFixed(4)), mx: mx.map((x) => +x.toFixed(4)),
            size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]].map((x) => +x.toFixed(4)),
            clusters: [...clusters.entries()].sort((p, q) => q[1].n - p[1].n).slice(0, 25),
            clusterCount: clusters.size,
        };
    });
    console.log(JSON.stringify(res, null, 1));
    await browser.close();
})();
