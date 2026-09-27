/**
 * 精确测量"烘焙绿色道具"（房间壳体里那块手机形状的贴图道具）的朝向与尺寸：
 * 取房间壳体 ShaderMaterial mesh 里、位于机身附近且 y 在桌面之上那一薄层内的三角形，
 * 对世界坐标 (x,z) 做 0.25° 步长扫描求最小面积外接矩形。
 * 输出可直接用于 fragment.glsl 的 cutCenter / cutHalf / cutRotY。
 */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    // 等壳体真正加载（有 ShaderMaterial 且顶点数很大）
    await page.waitForFunction(
        () => {
            let ok = false;
            window.__SCENE__.traverse((o) => {
                if (o.isMesh && o.material && o.material.type === 'ShaderMaterial' && o.geometry.attributes.position.count > 10000) ok = true;
            });
            return ok;
        },
        null,
        { timeout: 60000 }
    );

    const out = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((r) => r.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const shells = [];
        window.__SCENE__.traverse((o) => {
            if (o.isMesh && o.material && o.material.type === 'ShaderMaterial') shells.push(o);
        });
        const report = [];
        for (const shell of shells) {
            shell.updateWorldMatrix(true, false);
            const g = shell.geometry;
            const pos = g.attributes.position;
            const idx = g.index ? g.index.array : null;
            const triCount = idx ? idx.length / 3 : Math.floor(pos.count / 3);
            const m = shell.matrixWorld;
            const e = m.elements;
            const toWorld = (k) => {
                const x = pos.getX(k);
                const y = pos.getY(k);
                const z = pos.getZ(k);
                return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
            };
            const pts = [];
            for (let t = 0; t < triCount; t++) {
                const keys = idx ? [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]] : [t * 3, t * 3 + 1, t * 3 + 2];
                const w = keys.map(toWorld);
                let ok = true;
                for (const p of w) {
                    if (p[1] < -1.606 || p[1] > -1.562) ok = false;
                    else if (Math.abs(p[0] - 1.6762) > 0.4 || Math.abs(p[2] + 0.8014) > 0.4) ok = false;
                }
                if (ok) for (const p of w) pts.push(p);
            }
            if (pts.length < 3) {
                report.push({ name: shell.name || '(unnamed)', triCount, found: 0 });
                continue;
            }
            let best = null;
            for (let deg = -90; deg <= 90; deg += 0.25) {
                const th = (deg * Math.PI) / 180;
                const c = Math.cos(th);
                const s = Math.sin(th);
                let u0 = Infinity;
                let u1 = -Infinity;
                let v0 = Infinity;
                let v1 = -Infinity;
                for (const [px, , pz] of pts) {
                    const u = c * px + s * pz;
                    const v = -s * px + c * pz;
                    if (u < u0) u0 = u;
                    if (u > u1) u1 = u;
                    if (v < v0) v0 = v;
                    if (v > v1) v1 = v;
                }
                const area = (u1 - u0) * (v1 - v0);
                if (!best || area < best.area) best = { deg, area, u0, u1, v0, v1, c, s };
            }
            const cu = (best.u0 + best.u1) / 2;
            const cv = (best.v0 + best.v1) / 2;
            const cx = best.c * cu - best.s * cv;
            const cz = best.s * cu + best.c * cv;
            let y0 = Infinity;
            let y1 = -Infinity;
            for (const [, py] of pts) {
                if (py < y0) y0 = py;
                if (py > y1) y1 = py;
            }
            report.push({
                name: shell.name || '(unnamed)',
                triCount,
                propTris: pts.length / 3,
                deg: best.deg,
                center: [cx, (y0 + y1) / 2, cz],
                halfU: (best.u1 - best.u0) / 2,
                halfV: (best.v1 - best.v0) / 2,
                yRange: [y0, y1]
            });
        }
        void THREE;
        return report;
    });
    for (const r of out) console.log(JSON.stringify(r));
    await browser.close();
})();
