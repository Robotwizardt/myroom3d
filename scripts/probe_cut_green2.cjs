/**
 * 诊断 7：把「手机附近的绿岛三角形」按 3cm 距离做贪心聚类，
 * 输出每个簇的对象空间包围盒 / 主方向角（扫描最小面积 XZ 盒）/ 顶点数，
 * 用来确认哪一个簇才是"压在机身下的那块绿板"。
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
    const phoneWorld = phoneMesh.matrixWorld.clone();
    const pWorld = new THREE.Vector3().setFromMatrixPosition(phoneWorld);

    const greenUV = (u, v) =>
        (u >= 0.575 && u <= 0.610 && v >= 0.010 && v <= 0.168) ||
        (u >= 0.392 && u <= 0.414 && v >= 0.158 && v <= 0.176);

    // 收集：房间壳对象空间里的绿三角形（世界距离手机 <0.5m）
    const tris = [];   // { v: [Vector3 x3] }  raw object-space
    scene.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.uniforms) return;
        o.updateWorldMatrix(true, false);
        const g = o.geometry, pos = g.attributes.position, uvA = g.attributes.uv, idx = g.index;
        if (!uvA) return;
        const n = idx ? idx.count : pos.count, mw = o.matrixWorld, t = new THREE.Vector3();
        for (let i = 0; i < n; i += 3) {
            const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
            t.fromBufferAttribute(pos, i0).applyMatrix4(mw);
            if (Math.hypot(t.x - pWorld.x, t.z - pWorld.z) > 0.55) continue;
            let isG = false;
            for (const ii of [i0, i1, i2]) {
                const uv = new THREE.Vector2().fromBufferAttribute(uvA, ii);
                if (greenUV(uv.x, uv.y)) { isG = true; break; }
            }
            if (!isG) continue;
            tris.push({ v: [i0, i1, i2].map((ii) => new THREE.Vector3().fromBufferAttribute(pos, ii)), mesh: o.uuid.slice(0, 6) });
        }
    });

    // 贪心聚类（3cm）
    const R = 0.03;
    const clusters = [];
    for (const tr of tris) {
        const c = tr.v[0].clone().add(tr.v[1]).add(tr.v[2]).multiplyScalar(1 / 3);
        let hit = null;
        for (const cl of clusters) if (cl.c.distanceTo(c) < R * 3) { hit = cl; break; }
        if (hit) { hit.items.push(tr); hit.c.add(c).multiplyScalar(1 / (hit.items.length + 1)).multiplyScalar(1); hit.sum.add(c); hit.c = hit.sum.clone().multiplyScalar(1 / hit.items.length); }
        else clusters.push({ sum: c.clone(), c: c.clone(), items: [tr] });
    }

    // 用「顶点是否落在已知桌面之上」过滤出贴桌面的簇
    const summarize = (cl) => {
        const verts = [];
        for (const tr of cl.items) verts.push(...tr.v);
        // 主方向：扫描找出最小面积 XZ 盒
        let best = null;
        for (let a = 0; a < 180; a += 1) {
            const th = (a * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
            let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, mny = 1e9, mxy = -1e9;
            for (const v of verts) {
                const x = cs * v.x - sn * v.z, z = sn * v.x + cs * v.z;
                mnx = Math.min(mnx, x); mxx = Math.max(mxx, x);
                mnz = Math.min(mnz, z); mxz = Math.max(mxz, z);
                mny = Math.min(mny, v.y); mxy = Math.max(mxy, v.y);
            }
            const area = (mxx - mnx) * (mxz - mnz);
            if (!best || area < best.area) best = { a, area, mnx, mxx, mnz, mxz, mny, mxy };
        }
        const cx = [], cz = [];
        const th = (best.a * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
        for (const v of verts) { cx.push(cs * v.x - sn * v.z); cz.push(sn * v.x + cs * v.z); }
        const mx = (cx.reduce((s, v) => s + v, 0) / cx.length), mz = (cz.reduce((s, v) => s + v, 0) / cz.length);
        // 旋转中心回到对象空间
        const oC = new THREE.Vector3(cs * mx + sn * mz, (best.mny + best.mxy) / 2, -sn * mx + cs * mz);
        const wC = oC.clone().applyMatrix4(phoneWorld).applyMatrix4(new THREE.Matrix4().copy(phoneWorld).invert());
        const wObj = oC.clone();
        const localC = oC.clone().applyMatrix4(phoneWorld).applyMatrix4(new THREE.Matrix4().copy(phoneWorld).invert());
        void wC; void wObj; void localC;
        return {
            angleDeg: +best.a.toFixed(1),
            center: oC.toArray().map((v) => +v.toFixed(4)),
            half: [+((best.mxx - best.mnx) / 2).toFixed(4), +((best.mxy - best.mny) / 2).toFixed(4), +((best.mxz - best.mnz) / 2).toFixed(4)],
            yRange: [+best.mny.toFixed(4), +best.mxy.toFixed(4)],
            verts: verts.length,
            tris: cl.items.length,
            meshes: [...new Set(cl.items.map((i) => i.mesh))]
        };
    };

    const out = clusters.filter((c) => c.items.length > 3).map(summarize).sort((a, b) => b.tris - a.tris);
    return { totalGreenTris: tris.length, clusters: out.slice(0, 8) };
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
