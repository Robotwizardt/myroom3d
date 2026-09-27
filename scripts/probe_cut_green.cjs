/**
 * 诊断 5（决定性）：关掉裁剪后，遍历所有房间壳三角形，
 * 找出「uv 落在烘焙绿岛 + 世界位置在手机附近」的三角形集合，
 * 输出其世界/局部包围盒、数量、按 mesh 分布，以及鼠标等真实网格的位置做对照。
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
        if (o.isMesh && o.material && o.material.color && !o.material.uniforms) {
            if (o.material.color.getHexString() === 'c8cacc') phoneMesh = o;
        }
    });
    phoneMesh.updateWorldMatrix(true, false);
    const phoneWorld = phoneMesh.matrixWorld.clone();
    const phoneInv = phoneWorld.clone().invert();
    const pPos = new THREE.Vector3().setFromMatrixPosition(phoneWorld);

    const greenUV = (u, v) =>
        (u >= 0.575 && u <= 0.610 && v >= 0.010 && v <= 0.168) ||
        (u >= 0.392 && u <= 0.414 && v >= 0.158 && v <= 0.176);

    const meshes = [];
    scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.uniforms) {
            o.updateWorldMatrix(true, false);
            meshes.push(o);
        }
    });

    const found = [];       // 绿岛 + 手机附近
    const allGreen = [];    // 绿岛（全场）
    for (const m of meshes) {
        const g = m.geometry, pos = g.attributes.position, uvA = g.attributes.uv, idx = g.index;
        if (!uvA) continue;
        const n = idx ? idx.count : pos.count;
        const mw = m.matrixWorld;
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), uv = new THREE.Vector2();
        for (let i = 0; i < n; i += 3) {
            const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
            let hitUv = null;
            for (const ii of [i0, i1, i2]) {
                uv.fromBufferAttribute(uvA, ii);
                if (greenUV(uv.x, uv.y)) { hitUv = [+uv.x.toFixed(4), +uv.y.toFixed(4)]; break; }
            }
            if (!hitUv) continue;
            a.fromBufferAttribute(pos, i0).applyMatrix4(mw);
            b.fromBufferAttribute(pos, i1).applyMatrix4(mw);
            c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
            const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
            allGreen.push([cx, cy, cz]);
            if (Math.hypot(cx - pPos.x, cz - pPos.z) > 0.5) continue;
            const l = [a, b, c].map((v) => v.clone().applyMatrix4(phoneInv));
            found.push({ mesh: m.uuid.slice(0, 6), uv: hitUv, world: [+cx.toFixed(4), +cy.toFixed(4), +cz.toFixed(4)], local: l.map((v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]) });
        }
    }

    const box = (arr, k) => {
        let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (const t of arr) for (const v of (k === 'world' ? [t.world] : t.local)) {
            for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], v[i]); mx[i] = Math.max(mx[i], v[i]); }
        }
        return { min: mn.map((x) => +x.toFixed(4)), max: mx.map((x) => +x.toFixed(4)), size: mx.map((x, i) => +(x - mn[i]).toFixed(4)) };
    };

    // 附近真实网格（鼠标等）
    const props = [];
    scene.traverse((o) => {
        if (o.isMesh && o.visible && (!o.material || !o.material.uniforms)) {
            const bb = new THREE.Box3().setFromObject(o);
            const c = bb.getCenter(new THREE.Vector3());
            if (Math.hypot(c.x - pPos.x, c.z - pPos.z) > 0.75) return;
            const lc = c.clone().applyMatrix4(phoneInv);
            props.push({
                mat: `${o.material.type}#${o.material.color ? o.material.color.getHexString() : '-'}`,
                localC: [+lc.x.toFixed(3), +lc.y.toFixed(3), +lc.z.toFixed(3)],
                size: bb.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3)),
                y: [+bb.min.y.toFixed(4), +bb.max.y.toFixed(4)]
            });
        }
    });

    return {
        phonePos: [+pPos.x.toFixed(4), +pPos.y.toFixed(4), +pPos.z.toFixed(4)],
        foundCount: found.length,
        worldBox: box(found, 'world'),
        localBox: box(found, 'local'),
        byMesh: [...new Set(found.map((f) => f.mesh))].map((id) => ({ mesh: id, n: found.filter((f) => f.mesh === id).length })),
        allGreenCount: allGreen.length,
        sample: found.slice(0, 25),
        propsNear: props
    };
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(PAGE_FN);
    console.log(JSON.stringify(r, null, 1));
    await browser.close();
})();
