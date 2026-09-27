/**
 * 诊断 11：用「连通分量」把手机附近的绿岛三角形拆开 —— 大块连通面片 = 压在机身下的那块平板，
 * 小块 = 盆栽叶子之类。对每个分量输出世界包围盒 + 最小面积有向盒 + uv 范围。
 */
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

const PAGE_FN = async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name);
    const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
    const scene = window.__SCENE__;
    scene.traverse((o) => {
        if (o.material && o.material.uniforms && o.material.uniforms.cutMin) {
            o.material.uniforms.cutMin.value.set(1, 1, 1);
            o.material.uniforms.cutMax.value.set(-1, -1, -1);
        }
    });

    let phoneMesh = null;
    scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && !o.material.uniforms && o.material.color.getHexString() === 'c8cacc') phoneMesh = o;
    });
    phoneMesh.updateWorldMatrix(true, false);
    const pWorld = new THREE.Vector3().setFromMatrixPosition(phoneMesh.matrixWorld);

    const greenUV = (u, v) =>
        (u >= 0.575 && u <= 0.610 && v >= 0.010 && v <= 0.168) ||
        (u >= 0.392 && u <= 0.414 && v >= 0.158 && v <= 0.176);

    const out = [];
    scene.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.uniforms) return;
        o.updateWorldMatrix(true, false);
        const g = o.geometry, pos = g.attributes.position, uvA = g.attributes.uv, idx = g.index;
        if (!uvA) return;
        const n = idx ? idx.count : pos.count, mw = o.matrixWorld;
        // 收集绿三角形（世界顶点 + uv）
        const tris = [];
        for (let i = 0; i < n; i += 3) {
            const ids = [idx ? idx.getX(i) : i, idx ? idx.getX(i + 1) : i + 1, idx ? idx.getX(i + 2) : i + 2];
            let isG = false, uvs = [];
            for (const ii of ids) {
                const uv = new THREE.Vector2().fromBufferAttribute(uvA, ii);
                uvs.push(uv);
                if (greenUV(uv.x, uv.y)) isG = true;
            }
            if (!isG) continue;
            const w = ids.map((ii, k) => { const v = new THREE.Vector3().fromBufferAttribute(pos, ii).applyMatrix4(mw); v.userData = uvs[k]; return v; });
            if (!w.some((v) => Math.hypot(v.x - pWorld.x, v.z - pWorld.z) < 0.9)) continue;
            tris.push(w);
        }
        if (!tris.length) return;

        // 位置哈希 + 并查集（按顶点位置合并）
        const key = (v) => `${Math.round(v.x * 1e4)}|${Math.round(v.y * 1e4)}|${Math.round(v.z * 1e4)}`;
        const parent = new Map();
        const find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
        const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };
        for (const w of tris) for (const v of w) { const k = key(v); if (!parent.has(k)) parent.set(k, k); }
        for (const w of tris) { union(key(w[0]), key(w[1])); union(key(w[1]), key(w[2])); }

        const groups = new Map();
        for (const w of tris) {
            const r = find(key(w[0]));
            if (!groups.has(r)) groups.set(r, { tris: [], verts: new Map() });
            const G = groups.get(r);
            G.tris.push(w);
            for (const v of w) { const k = key(v); if (!G.verts.has(k)) G.verts.set(k, v); }
        }

        for (const [, G] of groups) {
            const verts = [...G.verts.values()];
            const bb = new THREE.Box3();
            for (const v of verts) bb.expandByPoint(v);
            // 最小面积有向盒
            let best = null;
            for (let a = 0; a < 180; a += 0.5) {
                const th = (a * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
                let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
                for (const v of verts) { const x = cs * v.x - sn * v.z, z = sn * v.x + cs * v.z; if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (z < mnz) mnz = z; if (z > mxz) mxz = z; }
                const area = (mxx - mnx) * (mxz - mnz);
                if (!best || area < best.area) best = { a, area, mnx, mxx, mnz, mxz };
            }
            const uvs = verts.map((v) => v.userData).filter(Boolean);
            const ur = [Math.min(...uvs.map((u) => u.x)), Math.max(...uvs.map((u) => u.x))];
            const vr = [Math.min(...uvs.map((u) => u.y)), Math.max(...uvs.map((u) => u.y))];
            out.push({
                mesh: o.uuid.slice(0, 6),
                tris: G.tris.length,
                verts: verts.length,
                worldBox: { min: bb.min.toArray().map((v) => +v.toFixed(4)), max: bb.max.toArray().map((v) => +v.toFixed(4)), size: bb.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(4)) },
                angleDeg: +best.a.toFixed(1),
                xzHalf: [+((best.mxx - best.mnx) / 2).toFixed(4), +((best.mxz - best.mnz) / 2).toFixed(4)],
                uvRange: [ur.map((v) => +v.toFixed(4)), vr.map((v) => +v.toFixed(4))]
            });
        }
    });

    out.sort((a, b) => b.tris - a.tris);
    return { components: out.slice(0, 12), phonePos: pWorld.toArray().map((v) => +v.toFixed(4)) };
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    console.log(JSON.stringify(await page.evaluate(PAGE_FN), null, 1));
    await browser.close();
})();
