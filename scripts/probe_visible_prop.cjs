/**
 * 诊断 10（定案）：掀掉我们的机身/DOM 屏，然后从特写视角向整个画面打射线网格，
 * 收集「命中房间壳、且距手机 <1.5m」的表面点 —— 这些点就是用户看到的那块绿壳道具。
 * 用它算最小面积（有向）包围盒，并统计误裁风险点（鼠标等真道具的表面点）。
 */
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

const PAGE_FN = async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name);
    const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
    const scene = window.__SCENE__;

    // 1) 恢复真实材质（万一之前被 debug 覆盖）：重新加载页面即可保证，此处只关裁剪
    scene.traverse((o) => {
        if (o.material && o.material.uniforms && o.material.uniforms.cutMin) {
            o.material.uniforms.cutMin.value.set(1, 1, 1);
            o.material.uniforms.cutMax.value.set(-1, -1, -1);
        }
    });

    // 2) 找手机中框
    let phoneMesh = null;
    scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && !o.material.uniforms && o.material.color.getHexString() === 'c8cacc') phoneMesh = o;
    });
    phoneMesh.updateWorldMatrix(true, false);
    const pWorld = new THREE.Vector3().setFromMatrixPosition(phoneMesh.matrixWorld);
    const phoneInv = phoneMesh.matrixWorld.clone().invert();

    // 3) 隐藏我们的机身（在手机 1m 内、无 uniforms 的 mesh）
    let hidden = 0;
    const bodyMeshes = [];
    scene.traverse((o) => {
        if (o.isMesh && o.material && !o.material.uniforms) {
            const bb = new THREE.Box3().setFromObject(o);
            const c = bb.getCenter(new THREE.Vector3());
            if (Math.hypot(c.x - pWorld.x, c.z - pWorld.z) < 1.0) { o.visible = false; hidden++; bodyMeshes.push(`${o.material.type}#${o.material.color ? o.material.color.getHexString() : '-'}`); }
        }
    });
    document.querySelectorAll('.htmlPhoneScreen').forEach((e) => { e.style.display = 'none'; });

    const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
    cam.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const targets = [];
    scene.traverse((o) => { if (o.isMesh && o.visible) targets.push(o); });

    const pts = [];      // 房间壳表面点（世界）
    const localPts = []; // 同一批点的手机局部坐标
    const others = [];   // 非房间壳（真道具）表面点
    const W = innerWidth, H = innerHeight;
    for (let py = 0; py < H; py += 6) {
        for (let px = 0; px < W; px += 6) {
            const ndc = new THREE.Vector2((px / W) * 2 - 1, -(py / H) * 2 + 1);
            ray.setFromCamera(ndc, cam);
            const hits = ray.intersectObjects(targets, true);
            if (!hits.length) continue;
            const h = hits[0];
            const d = Math.hypot(h.point.x - pWorld.x, h.point.z - pWorld.z);
            if (d > 1.5) continue;
            if (h.object.material && h.object.material.uniforms) {
                pts.push(h.point.clone());
                localPts.push(h.point.clone().applyMatrix4(phoneInv));
            } else if (d < 1.0) {
                others.push(h.point.clone().applyMatrix4(phoneInv));
            }
        }
    }

    // 4) 最小面积有向盒（XZ 平面，扫描角度）
    let best = null;
    for (let a = 0; a < 180; a += 0.5) {
        const th = (a * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
        let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, mny = 1e9, mxy = -1e9;
        for (const p of pts) {
            const x = cs * p.x - sn * p.z, z = sn * p.x + cs * p.z;
            if (x < mnx) mnx = x; if (x > mxx) mxx = x;
            if (z < mnz) mnz = z; if (z > mxz) mxz = z;
            if (p.y < mny) mny = p.y; if (p.y > mxy) mxy = p.y;
        }
        const area = (mxx - mnx) * (mxz - mnz);
        if (!best || area < best.area) best = { a, area, mnx, mxx, mnz, mxz, mny, mxy, cs, sn };
    }
    const { cs, sn } = best;
    const cx = (best.mnx + best.mxx) / 2, cz = (best.mnz + best.mxz) / 2;
    const center = new THREE.Vector3(cs * cx + sn * cz, (best.mny + best.mxy) / 2, -sn * cx + cs * cz);
    const half = [((best.mxx - best.mnx) / 2), ((best.mxy - best.mny) / 2), ((best.mxz - best.mnz) / 2)].map((v) => +v.toFixed(4));
    const rotYDeg = +(best.a).toFixed(1);
    const relToPhoneDeg = (() => {
        // 在手机局部坐标系里，房间壳朝向相对手机的夹角
        const q = new THREE.Quaternion().setFromRotationMatrix(phoneMesh.matrixWorld);
        const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
        return +(e.y * 180 / Math.PI).toFixed(2);
    })();

    // 5) 误裁风险：真道具（鼠标等）点是否落在盒内
    const inBox = (p, margin = 0) => {
        const d = p.clone().sub(center);
        const x = cs * d.x - sn * d.z, z = sn * d.x + cs * d.z;
        return Math.abs(x) <= half[0] + margin && Math.abs(d.y) <= half[1] + margin && Math.abs(z) <= half[2] + margin;
    };
    const risk = others.filter((p) => inBox(p, 0));
    const riskLo = others.filter((p) => inBox(p, -0.01));

    // 6) 点的世界范围
    const wb = (arr) => {
        let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (const v of arr) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], v[i]); mx[i] = Math.max(mx[i], v[i]); }
        return { min: mn.map((v) => +v.toFixed(4)), max: mx.map((v) => +v.toFixed(4)), size: mx.map((v, i) => +(v - mn[i]).toFixed(4)) };
    };

    return {
        hiddenBodyMeshes: hidden,
        bodyMeshList: bodyMeshes.slice(0, 20),
        roomShellPts: pts.length,
        otherPropPts: others.length,
        worldBoxOfProp: wb(pts),
        orientedBox: {
            angleDeg: rotYDeg,
            phoneRotYDeg: relToPhoneDeg,
            angleRelativeToPhoneDeg: +(rotYDeg - relToPhoneDeg).toFixed(2),
            center: center.toArray().map((v) => +v.toFixed(4)),
            half,
            yRange: [+best.mny.toFixed(4), +best.mxy.toFixed(4)]
        },
        riskPtsInside: risk.length,
        riskPtsInsideNoMargin: riskLo.length,
        riskSample: this,
        othersLocalRange: (() => {
            if (!others.length) return null;
            const b = wb(others.map((p) => [p.x, p.y, p.z]));
            return b;
        })()
    };
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    const r = await page.evaluate(PAGE_FN);
    delete r.riskSample;
    console.log(JSON.stringify(r, null, 1));
    await page.screenshot({ path: 'evidence/dbg_visible_prop.png' });
    await browser.close();
})();
