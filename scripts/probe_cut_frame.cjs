/**
 * 在「手机机身局部坐标系」里量烘焙道具的真实包围盒：
 *  - 找到机身中框 mesh（材质色 #c8cacc）的世界矩阵 → 得到手机朝向/位置
 *  - 取房间壳里「桌面之上、手机附近」的三角形，变换到手机局部坐标
 *  - 输出局部 AABB + 直方图（区分 道具本体 / 鼠标 / 笔 等）
 */
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

const PAGE_FN = async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name);
    const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
    const scene = window.__SCENE__;

    // 1) 找机身中框（color #c8cacc）
    let phoneMat = null;
    scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && !o.material.uniforms) {
            if (o.material.color.getHexString() === 'c8cacc') phoneMat = o;
        }
    });
    if (!phoneMat) return { error: '找不到机身中框 mesh' };
    phoneMat.updateWorldMatrix(true, false);
    const phoneWorld = phoneMat.matrixWorld.clone();
    const phoneInv = phoneWorld.clone().invert();

    // 手机的世界位置/朝向
    const pPos = new THREE.Vector3().setFromMatrixPosition(phoneWorld);
    const pQuat = new THREE.Quaternion().setFromRotationMatrix(phoneWorld);
    const pEuler = new THREE.Euler().setFromQuaternion(pQuat, 'YXZ');

    // 2) 桌面高度（远离道具取参考点）
    const ray = new THREE.Raycaster();
    const roomMeshes = [];
    scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.uniforms && o.visible) roomMeshes.push(o);
    });
    const down = new THREE.Vector3(0, -1, 0);
    const tableYs = [];
    for (const [px, pz] of [[2.4, -1.2], [2.0, -0.2], [2.6, -0.4], [1.2, -0.2], [2.2, -1.9]]) {
        ray.set(new THREE.Vector3(px, 1.0, pz), down);
        const hit = ray.intersectObjects(roomMeshes, false)[0];
        if (hit) tableYs.push(+hit.point.y.toFixed(4));
    }
    const tableY = tableYs.length ? Math.max(...tableYs) : null;

    // 3) 房间壳三角形 → 手机局部坐标
    const out = [];
    const perMesh = [];
    for (const m of roomMeshes) {
        const g = m.geometry;
        const pos = g.attributes.position;
        const idx = g.index;
        const n = idx ? idx.count : pos.count;
        m.updateWorldMatrix(true, false);
        const mw = m.matrixWorld;
        let kept = 0;
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = 0; i < n; i += 3) {
            const i0 = idx ? idx.getX(i) : i;
            const i1 = idx ? idx.getX(i + 1) : i + 1;
            const i2 = idx ? idx.getX(i + 2) : i + 2;
            a.fromBufferAttribute(pos, i0).applyMatrix4(mw);
            b.fromBufferAttribute(pos, i1).applyMatrix4(mw);
            c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
            const cy = (a.y + b.y + c.y) / 3;
            if (tableY !== null && cy < tableY + 0.002) continue;
            const cx = (a.x + b.x + c.x) / 3;
            const cz = (a.z + b.z + c.z) / 3;
            // 只取手机附近（局部坐标内判断更准，但先用世界半径粗筛）
            if (Math.hypot(cx - pPos.x, cz - pPos.z) > 0.45) continue;
            kept++;
            for (const v of [a, b, c]) {
                const lv = v.clone().applyMatrix4(phoneInv);
                out.push([+lv.x.toFixed(4), +lv.y.toFixed(4), +lv.z.toFixed(4)]);
            }
        }
        perMesh.push({
            uuid: m.uuid.slice(0, 8),
            verts: pos.count,
            tris: n / 3,
            kept,
            size: (() => {
                g.computeBoundingBox();
                const s = new THREE.Vector3();
                g.boundingBox.getSize(s);
                return [+s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2)];
            })()
        });
    }

    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const v of out) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); }

    // 直方图：局部 X/Z 的分布（2cm 网格）
    const grid = {};
    for (const v of out) {
        const k = `${Math.round(v[0] / 0.02) * 0.02},${Math.round(v[2] / 0.02) * 0.02}`;
        grid[k] = (grid[k] || 0) + 1;
    }
    const cells = Object.entries(grid).sort((x, y) => y[1] - x[1]).slice(0, 30);

    return {
        tableY,
        phonePos: [+pPos.x.toFixed(4), +pPos.y.toFixed(4), +pPos.z.toFixed(4)],
        phoneRotYDeg: +(pEuler.y * 180 / Math.PI).toFixed(2),
        verts: out.length,
        localAABB: { min: mn, max: mx, size: mx.map((v, i) => +(v - mn[i]).toFixed(4)) },
        perMesh,
        topCells: cells
    };
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
