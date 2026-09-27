/**
 * 诊断 3（精确）：用射线在手机上方向下打网格，找出所有「烘焙绿岛 uv」命中的三角形，
 * 直接得到绿壳道具的精确三角形集合与其在手机局部坐标下的包围盒；
 * 同时用屏幕像素射线定位鼠标，确认两者不重叠。
 */
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

const PAGE_FN = async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name);
    const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
    const scene = window.__SCENE__;

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
    scene.traverse((o) => { if (o.isMesh && o.material && o.material.uniforms && o.visible) roomMeshes.push(o); });

    const inGreenIsland = (u, v) =>
        (u >= 0.578 && u <= 0.608 && v >= 0.012 && v <= 0.165) ||
        (u >= 0.394 && u <= 0.412 && v >= 0.160 && v <= 0.174);

    // 手机上方向下打网格，收集绿岛命中的三角形（用三角形身份去重）
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const seen = new Map();
    const hitLog = [];
    const local3 = (t) => t.map((v) => v.clone().applyMatrix4(phoneInv));
    for (let ix = -3; ix <= 3; ix++) {
        for (let iz = -3; iz <= 3; iz++) {
            const lx = ix * 0.1, lz = iz * 0.055;
            const wp = new THREE.Vector3(lx, 0, lz).applyMatrix4(phoneWorld);
            ray.set(new THREE.Vector3(wp.x, -1.0, wp.z), down);
            const hits = ray.intersectObjects(roomMeshes, false);
            for (const h of hits) {
                if (!h.uv) continue;
                const g = h.object.geometry, idx = g.index, pos = g.attributes.position;
                const f = h.faceIndex;
                const t = [];
                for (let k = 0; k < 3; k++) {
                    const vi = idx ? idx.getX(f * 3 + k) : f * 3 + k;
                    t.push(new THREE.Vector3().fromBufferAttribute(pos, vi).applyMatrix4(h.object.matrixWorld));
                }
                const l = local3(t);
                hitLog.push({
                    localXZ: [+lx.toFixed(3), +lz.toFixed(3)],
                    y: +h.point.y.toFixed(4),
                    uv: [+h.uv.x.toFixed(4), +h.uv.y.toFixed(4)],
                    green: inGreenIsland(h.uv.x, h.uv.y),
                    triLocal: l.map((v) => [+v.x.toFixed(3), +v.y.toFixed(4), +v.z.toFixed(3)]),
                    objSize: (() => { const s = new THREE.Vector3(); h.object.geometry.computeBoundingBox(); h.object.geometry.boundingBox.getSize(s); return [+s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2)]; })()
                });
                if (inGreenIsland(h.uv.x, h.uv.y)) {
                    const key = `${h.object.uuid}#${f}`;
                    if (!seen.has(key)) seen.set(key, { obj: h.object, face: f, local: l, uv: h.uv });
                }
            }
        }
    }

    // 绿三角形集合的包围盒（局部 + 世界）
    let lmn = [1e9, 1e9, 1e9], lmx = [-1e9, -1e9, -1e9];
    let wmn = [1e9, 1e9, 1e9], wmx = [-1e9, -1e9, -1e9];
    const triCount = seen.size;
    for (const rec of seen.values()) {
        for (const v of rec.local) {
            lmn = [Math.min(lmn[0], v.x), Math.min(lmn[1], v.y), Math.min(lmn[2], v.z)];
            lmx = [Math.max(lmx[0], v.x), Math.max(lmx[1], v.y), Math.max(lmx[2], v.z)];
        }
        for (const v of rec.local) {
            const w = v.clone().applyMatrix4(phoneWorld);
            wmn = [Math.min(wmn[0], w.x), Math.min(wmn[1], w.y), Math.min(wmn[2], w.z)];
            wmx = [Math.max(wmx[0], w.x), Math.max(wmx[1], w.y), Math.max(wmx[2], w.z)];
        }
    }

    // 屏幕像素射线：定位鼠标（特写视角下鼠标在右侧）
    const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
    cam.updateMatrixWorld(true);
    const pxRay = new THREE.Raycaster();
    const probePixels = [[960, 400], [1000, 350], [930, 460]];
    const pixelHits = [];
    for (const [px, py] of probePixels) {
        const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
        pxRay.setFromCamera(ndc, cam);
        const all = [];
        scene.traverse((o) => { if (o.isMesh && o.visible) all.push(o); });
        const hits = pxRay.intersectObjects(all, true).slice(0, 4).map((h) => {
            const lc = h.point.clone().applyMatrix4(phoneInv);
            const isShader = !!(h.object.material && h.object.material.uniforms);
            return {
                d: +h.distance.toFixed(3),
                mat: isShader ? 'Shader' : `${h.object.material.type}#${h.object.material.color ? h.object.material.color.getHexString() : '-'}`,
                point: [+h.point.x.toFixed(3), +h.point.y.toFixed(3), +h.point.z.toFixed(3)],
                local: [+lc.x.toFixed(3), +lc.y.toFixed(4), +lc.z.toFixed(3)],
                uv: h.uv ? [+h.uv.x.toFixed(4), +h.uv.y.toFixed(4)] : null
            };
        });
        pixelHits.push({ px: [px, py], hits });
    }

    return {
        phonePos: [+pPos.x.toFixed(4), +pPos.y.toFixed(4), +pPos.z.toFixed(4)],
        greenTriangles: triCount,
        localBox: { min: lmn.map((v) => +v.toFixed(4)), max: lmx.map((v) => +v.toFixed(4)), size: lmx.map((v, i) => +(v - lmn[i]).toFixed(4)) },
        worldBox: { min: wmn.map((v) => +v.toFixed(4)), max: wmx.map((v) => +v.toFixed(4)) },
        sampleHits: hitLog.slice(0, 40),
        pixelHits
    };
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
