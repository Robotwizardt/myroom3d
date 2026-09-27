/**
 * 诊断 2：把「桌面之上、手机附近」的三角形分簇，看每一簇是什么（道具 / 鼠标 / 笔 …），
 * 并给出手机局部坐标系下的位置，用于设计精确的裁剪盒。
 */
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

const PAGE_FN = async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name);
    const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
    const scene = window.__SCENE__;

    // 机身中框
    let phoneMesh = null;
    scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && !o.material.uniforms) {
            if (o.material.color.getHexString() === 'c8cacc') phoneMesh = o;
        }
    });
    phoneMesh.updateWorldMatrix(true, false);
    const phoneWorld = phoneMesh.matrixWorld.clone();
    const phoneInv = phoneWorld.clone().invert();
    const pPos = new THREE.Vector3().setFromMatrixPosition(phoneWorld);

    // 机身中框自身几何在局部坐标里的尺寸（验证局部坐标系方向）
    phoneMesh.geometry.computeBoundingBox();
    const bb = phoneMesh.geometry.boundingBox;
    const frameLocalSize = [+(bb.max.x - bb.min.x).toFixed(4), +(bb.max.y - bb.min.y).toFixed(4), +(bb.max.z - bb.min.z).toFixed(4)];

    // 附近所有非 shader 网格（鼠标/笔等真实网格）
    phoneMesh.parent.updateWorldMatrix(true, true);
    const nearMeshes = [];
    scene.traverse((o) => {
        if (!o.isMesh || o === phoneMesh) return;
        const isShader = !!(o.material && o.material.uniforms);
        const box = new THREE.Box3().setFromObject(o);
        const c = box.getCenter(new THREE.Vector3());
        const d = Math.hypot(c.x - pPos.x, c.z - pPos.z);
        if (d > 0.7) return;
        const s = box.getSize(new THREE.Vector3());
        const lc = c.clone().applyMatrix4(phoneInv);
        nearMeshes.push({
            mat: isShader ? 'Shader' : (o.material.type + '#' + (o.material.color ? o.material.color.getHexString() : '-')),
            color: o.visible ? '' : '(hidden)',
            worldCenter: [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)],
            localCenter: [+lc.x.toFixed(3), +lc.y.toFixed(3), +lc.z.toFixed(3)],
            size: [+s.x.toFixed(3), +s.y.toFixed(3), +s.z.toFixed(3)],
            yMin: +box.min.y.toFixed(4),
            yMax: +box.max.y.toFixed(4),
            distXZ: +d.toFixed(3)
        });
    });
    nearMeshes.sort((a, b) => a.distXZ - b.distXZ);

    // 桌面高度：多个参考点
    const ray = new THREE.Raycaster();
    const roomMeshes = [];
    scene.traverse((o) => { if (o.isMesh && o.material && o.material.uniforms && o.visible) roomMeshes.push(o); });
    const tableYs = [];
    for (const [px, pz] of [[2.35, -1.35], [2.6, -0.9], [2.55, -0.25], [1.1, -0.15], [2.9, -1.5]]) {
        ray.set(new THREE.Vector3(px, 1.0, pz), new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObjects(roomMeshes, false);
        tableYs.push([px, pz, hits.slice(0, 3).map((h) => +h.point.y.toFixed(4))]);
    }

    // 房间壳三角形 → 分簇（2cm 网格）
    const clusterMap = new Map();
    const triWorld = [];
    for (const m of roomMeshes) {
        const g = m.geometry, pos = g.attributes.position, idx = g.index;
        const n = idx ? idx.count : pos.count;
        m.updateWorldMatrix(true, false);
        const mw = m.matrixWorld;
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = 0; i < n; i += 3) {
            const i0 = idx ? idx.getX(i) : i;
            const i1 = idx ? idx.getX(i + 1) : i + 1;
            const i2 = idx ? idx.getX(i + 2) : i + 2;
            a.fromBufferAttribute(pos, i0).applyMatrix4(mw);
            b.fromBufferAttribute(pos, i1).applyMatrix4(mw);
            c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
            const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
            if (cy < -1.575 || cy > -1.45) continue;                 // 桌面以上、道具最高处附近
            if (Math.hypot(cx - pPos.x, cz - pPos.z) > 0.45) continue;
            const key = `${Math.round(cx / 0.02) * 0.02}|${Math.round(cy / 0.02) * 0.02}|${Math.round(cz / 0.02) * 0.02}`;
            const rec = clusterMap.get(key) || { n: 0, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] };
            rec.n++;
            for (const v of [a, b, c]) {
                rec.mn = [Math.min(rec.mn[0], v.x), Math.min(rec.mn[1], v.y), Math.min(rec.mn[2], v.z)];
                rec.mx = [Math.max(rec.mx[0], v.x), Math.max(rec.mx[1], v.y), Math.max(rec.mx[2], v.z)];
            }
            clusterMap.set(key, rec);
            triWorld.push([a.clone(), b.clone(), c.clone()]);
        }
    }

    // 合并相邻格子成簇（简单并查集，按 2cm 邻接）
    const keys = [...clusterMap.keys()];
    const parent = new Map(keys.map((k) => [k, k]));
    const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const cellToXYZ = (k) => k.split('|').map(Number);
    for (const k of keys) {
        const [x, y, z] = cellToXYZ(k);
        for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
            const nk = `${x + dx * 0.02}|${y + dy * 0.02}|${z + dz * 0.02}`;
            if (parent.has(nk)) {
                const ra = find(k), rb = find(nk);
                if (ra !== rb) parent.set(ra, rb);
            }
        }
    }
    const groups = new Map();
    for (const k of keys) {
        const r = find(k);
        const rec = clusterMap.get(k);
        const g0 = groups.get(r) || { cells: 0, tris: 0, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] };
        g0.cells++; g0.tris += rec.n;
        for (let i = 0; i < 3; i++) { g0.mn[i] = Math.min(g0.mn[i], rec.mn[i]); g0.mx[i] = Math.max(g0.mx[i], rec.mx[i]); }
        groups.set(r, g0);
    }
    const clusters = [...groups.values()].map((g0) => {
        const c = [(g0.mn[0] + g0.mx[0]) / 2, (g0.mn[1] + g0.mx[1]) / 2, (g0.mn[2] + g0.mx[2]) / 2];
        const lc = new THREE.Vector3(c[0], c[1], c[2]).applyMatrix4(phoneInv);
        const lmn = new THREE.Vector3(g0.mn[0], g0.mn[1], g0.mn[2]).applyMatrix4(phoneInv);
        const lmx = new THREE.Vector3(g0.mx[0], g0.mx[1], g0.mx[2]).applyMatrix4(phoneInv);
        const lmin = [Math.min(lmn.x, lmx.x), Math.min(lmn.y, lmx.y), Math.min(lmn.z, lmx.z)].map((v) => +v.toFixed(3));
        const lmax = [Math.max(lmn.x, lmx.x), Math.max(lmn.y, lmx.y), Math.max(lmn.z, lmx.z)].map((v) => +v.toFixed(3));
        return {
            tris: g0.tris,
            cells: g0.cells,
            worldMN: g0.mn.map((v) => +v.toFixed(3)),
            worldMX: g0.mx.map((v) => +v.toFixed(3)),
            size: g0.mx.map((v, i) => +(v - g0.mn[i]).toFixed(3)),
            localMN: lmin,
            localMX: lmax,
            localSize: lmax.map((v, i) => +(v - lmin[i]).toFixed(3)),
            distXZ: +Math.hypot(c[0] - pPos.x, c[2] - pPos.z).toFixed(3)
        };
    }).sort((a, b) => b.tris - a.tris);

    return { tableYs, phonePos: [+pPos.x.toFixed(4), +pPos.y.toFixed(4), +pPos.z.toFixed(4)], frameLocalSize, nearMeshes, clusters: clusters.slice(0, 12), totalTris: triWorld.length };
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(3000);
    const r = await page.evaluate(PAGE_FN);
    console.log(JSON.stringify(r, null, 1));
    await browser.close();
})();
