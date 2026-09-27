/**
 * 诊断 6（定案）：在「房间壳对象空间」里定出手机的朝向 + 绿壳道具的有向包围盒，
 * 并检查鼠标等真道具是否落在盒内（避免误裁）。
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
    const pWorld = new THREE.Vector3().setFromMatrixPosition(phoneWorld);
    const pQuatWorld = new THREE.Quaternion().setFromRotationMatrix(phoneWorld);

    const greenUV = (u, v) =>
        (u >= 0.575 && u <= 0.610 && v >= 0.010 && v <= 0.168) ||
        (u >= 0.392 && u <= 0.414 && v >= 0.158 && v <= 0.176);

    const meshes = [];
    scene.traverse((o) => { if (o.isMesh && o.material && o.material.uniforms) { o.updateWorldMatrix(true, false); meshes.push(o); } });

    const results = [];
    for (const m of meshes) {
        const g = m.geometry, pos = g.attributes.position, uvA = g.attributes.uv, idx = g.index;
        if (!uvA) continue;
        const n = idx ? idx.count : pos.count;
        const mw = m.matrixWorld;
        const tmp = new THREE.Vector3();
        const greenRaw = [];       // 绿岛 + 手机附近的原始（对象空间）顶点
        const allTrisRaw = [];     // 手机附近的全部三角形（对象空间，用于碰撞检查）
        for (let i = 0; i < n; i += 3) {
            const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
            // 世界质心粗筛（先算一个顶点即可）
            tmp.fromBufferAttribute(pos, i0).applyMatrix4(mw);
            const closeToPhone = Math.hypot(tmp.x - pWorld.x, tmp.z - pWorld.z) < 0.5;
            if (!closeToPhone) continue;
            const raw = [i0, i1, i2].map((ii) => new THREE.Vector3().fromBufferAttribute(pos, ii));
            allTrisRaw.push(raw);
            let isGreen = false;
            for (const ii of [i0, i1, i2]) {
                const uv = new THREE.Vector2().fromBufferAttribute(uvA, ii);
                if (greenUV(uv.x, uv.y)) { isGreen = true; break; }
            }
            if (isGreen) greenRaw.push(...raw);
        }
        if (!greenRaw.length) continue;

        // 相对朝向（对象空间里手机的 Y 角）
        const qRoom = new THREE.Quaternion().setFromRotationMatrix(mw);
        const qRel = qRoom.clone().invert().multiply(pQuatWorld);
        const relEuler = new THREE.Euler().setFromQuaternion(qRel, 'YXZ');

        // 世界 AABB → 对象空间
        const wBox = new THREE.Box3();
        for (const t of allTrisRaw) for (const v of t) wBox.expandByPoint(v.clone().applyMatrix4(mw));
        const gBox = new THREE.Box3();
        for (const v of greenRaw) gBox.expandByPoint(v.clone().applyMatrix4(mw));

        // 在「对象空间 + 手机朝向」的旋转坐标系里量绿壳
        const center = gBox.getCenter(new THREE.Vector3());
        const inv = qRel.clone().invert();
        let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (const v of greenRaw) {
            const p = v.clone().sub(center).applyQuaternion(inv);
            mn = [Math.min(mn[0], p.x), Math.min(mn[1], p.y), Math.min(mn[2], p.z)];
            mx = [Math.max(mx[0], p.x), Math.max(mx[1], p.y), Math.max(mx[2], p.z)];
        }
        const half = mx.map((v, i) => +((v - mn[i]) / 2).toFixed(4));
        // 中心修正（把旋转坐标系的盒中心换算回对象空间）
        const localMid = new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
        const objCenter = localMid.clone().applyQuaternion(qRel).add(center);

        // 碰撞检查：非绿三角形有几个顶点落在盒内
        const insideNonGreen = [];
        for (const t of allTrisRaw) {
            let green = false;
            for (const v of t) {
                // 该三角形是否绿岛：用顶点的 uv 判断（按索引回查）
                const ii = [0, 1, 2].map(() => 0); // 占位
                void ii;
            }
            void green;
            const ps = t.map((v) => v.clone().sub(objCenter).applyQuaternion(inv));
            const inN = ps.filter((p) => Math.abs(p.x) <= half[0] && Math.abs(p.y) <= half[1] && Math.abs(p.z) <= half[2]).length;
            if (inN === 3) {
                // 取其一顶点世界坐标用于确认身份
                const w = t[0].clone().applyMatrix4(mw).applyMatrix4(phoneInv);
                insideNonGreen.push([+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)]);
            }
        }

        results.push({
            meshUuid: m.uuid.slice(0, 6),
            meshName: m.name || '(no name)',
            geomSize: (() => { g.computeBoundingBox(); const s = new THREE.Vector3(); g.boundingBox.getSize(s); return [+s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2)]; })(),
            relRotYDeg: +(relEuler.y * 180 / Math.PI).toFixed(2),
            objCenter: objCenter.toArray().map((v) => +v.toFixed(4)),
            half: half,
            greenVerts: greenRaw.length,
            trisNearPhone: allTrisRaw.length,
            trisFullyInsideNonGreen: insideNonGreen.length,
            insideSampleLocal: insideNonGreen.slice(0, 8)
        });
    }

    // 鼠标位置（特写视角右侧像素射线）
    const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
    cam.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const all = [];
    scene.traverse((o) => { if (o.isMesh && o.visible) all.push(o); });
    const mouse = [];
    for (const [px, py] of [[960, 400], [985, 380], [935, 450]]) {
        const ndc = new THREE.Vector2((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1);
        ray.setFromCamera(ndc, cam);
        const h = ray.intersectObjects(all, true)[0];
        if (!h) continue;
        const lc = h.point.clone().applyMatrix4(phoneInv);
        const robj = h.object.uuid === undefined ? null : h.object.uuid.slice(0, 6);
        mouse.push({ px: [px, py], d: +h.distance.toFixed(3), mesh: robj, mat: h.object.material.uniforms ? 'Shader' : h.object.material.type, local: lc.toArray().map((v) => +v.toFixed(3)) });
    }

    return { phoneWorld: pWorld.toArray().map((v) => +v.toFixed(4)), results, mouse };
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3000);
    const r = await page.evaluate(PAGE_FN);
    console.log(JSON.stringify(r, null, 1));
    await browser.close();
})();
