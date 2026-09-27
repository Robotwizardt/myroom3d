/**
 * 诊断 4（决定性）：先把裁剪盒在页面里临时关掉（空盒），再量「烘焙道具」的真实几何。
 *  - 手机上方向下打网格，列出每个命中点的世界 y / 局部坐标 / uv / 是否绿岛
 *  - 收集绿岛命中的三角形，给出精确的世界+局部包围盒（用于设计精确裁剪盒）
 */
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

const PAGE_FN = async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name);
    const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
    const scene = window.__SCENE__;

    // 0) 临时关闭裁剪（空盒）
    let cutMats = 0;
    scene.traverse((o) => {
        if (o.material && o.material.uniforms && o.material.uniforms.cutMin) {
            o.material.uniforms.cutMin.value.set(1, 1, 1);
            o.material.uniforms.cutMax.value.set(-1, -1, -1);
            cutMats++;
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

    const roomMeshes = [];
    scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.uniforms) roomMeshes.push(o);
    });

    // 本机所有「非房间壳」的网格（真实道具：鼠标/笔等）
    const propMeshes = [];
    scene.traverse((o) => {
        if (o.isMesh && !(o.material && o.material.uniforms)) {
            const b = new THREE.Box3().setFromObject(o);
            const c = b.getCenter(new THREE.Vector3());
            if (Math.hypot(c.x - pPos.x, c.z - pPos.z) > 0.8) return;
            const lc = c.clone().applyMatrix4(phoneInv);
            const s = b.getSize(new THREE.Vector3());
            propMeshes.push({
                mat: `${o.material.type}#${o.material.color ? o.material.color.getHexString() : '-'}${o.visible ? '' : ' (hidden)'}`,
                worldC: [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)],
                localC: [+lc.x.toFixed(3), +lc.y.toFixed(3), +lc.z.toFixed(3)],
                size: [+s.x.toFixed(3), +s.y.toFixed(3), +s.z.toFixed(3)],
                y: [+b.min.y.toFixed(4), +b.max.y.toFixed(4)],
                distXZ: +Math.hypot(c.x - pPos.x, c.z - pPos.z).toFixed(3)
            });
        }
    });
    propMeshes.sort((a, b) => a.distXZ - b.distXZ);

    // 手机上方网格射线
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const hits = [];
    for (let ix = -4; ix <= 4; ix++) {
        for (let iz = -4; iz <= 4; iz++) {
            const lx = ix * 0.075, lz = iz * 0.04;
            const wp = new THREE.Vector3(lx, 0, lz).applyMatrix4(phoneWorld);
            ray.set(new THREE.Vector3(wp.x, -1.0, wp.z), down);
            const h = ray.intersectObjects(roomMeshes, false)[0];
            if (!h) continue;
            hits.push({
                localXZ: [+lx.toFixed(3), +lz.toFixed(3)],
                y: +h.point.y.toFixed(4),
                uv: [+h.uv.x.toFixed(4), +h.uv.y.toFixed(4)],
                objSize: (() => { const s = new THREE.Vector3(); h.object.geometry.computeBoundingBox(); h.object.geometry.boundingBox.getSize(s); return [+s.x.toFixed(2), +s.z.toFixed(2)]; })(),
                face: h.faceIndex
            });
        }
    }

    // 桌面参考高度（远离手机，验证）
    const refY = [];
    for (const [px, pz] of [[2.35, -1.35], [1.1, -0.15], [2.75, -0.6], [2.2, -1.8]]) {
        ray.set(new THREE.Vector3(px, -1.0, pz), down);
        const hs = ray.intersectObjects(roomMeshes, false);
        refY.push([px, pz, hs.slice(0, 2).map((x) => +x.point.y.toFixed(4))]);
    }

    // y 值分布
    const hist = {};
    for (const h of hits) {
        const k = h.y.toFixed(3);
        hist[k] = (hist[k] || 0) + 1;
    }

    return { cutMatsDisabled: cutMats, phonePos: [+pPos.x.toFixed(4), +pPos.y.toFixed(4), +pPos.z.toFixed(4)], refY, yHistogram: hist, propMeshes, sampleHits: hits.slice(0, 30), totalRays: hits.length };
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
