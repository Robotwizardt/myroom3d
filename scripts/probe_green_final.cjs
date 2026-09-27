/* 终极绿色定位：绿区多点 raycast 全命中 + 视频/Shader材质 mesh 屏幕投影比对 */
const { chromium } = require('playwright');

(async () => {
    const b = await chromium.launch({ channel: 'msedge', headless: false });
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__ctrl && window.__ctrl._camera, null, { timeout: 40000 });
    await p.waitForTimeout(3000);

    const shot = await p.screenshot();
    await p.screenshot({ path: 'evidence/green_final.png' });

    const result = await p.evaluate(async (shotBytes) => {
        const blob = new Blob([Uint8Array.from(shotBytes)], { type: 'image/png' });
        const bmp = await createImageBitmap(blob);
        const cv = document.createElement('canvas');
        cv.width = bmp.width; cv.height = bmp.height;
        const ctx = cv.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        const data = ctx.getImageData(0, 0, cv.width, cv.height).data;

        const scene = window.__SCENE__;
        const cam = window.__ctrl._camera;
        const V = cam.position.constructor;
        // R3F raycaster
        let rc = null;
        scene.traverse((o) => { if (!rc && o.isMesh && o.__r3f && o.__r3f.root) { const st = o.__r3f.root.getState(); if (st.raycaster) rc = st.raycaster; } });

        // 1. 绿色多点采样
        const greenPts = [];
        for (let y = 268; y <= 544; y += 40) {
            for (let x = 256; x <= 466; x += 40) {
                const i = (y * cv.width + x) * 4;
                const r = data[i], g = data[i + 1], bl = data[i + 2];
                if (g > 60 && g > r + 25 && g > bl + 25) greenPts.push([x, y]);
            }
        }
        const rayHits = [];
        for (const [x, y] of greenPts) {
            const ndc = new V((x / cv.width) * 2 - 1, -(y / cv.height) * 2 + 1, 0.5);
            rc.setFromCamera(ndc, cam);
            const hits = rc.intersectObjects(scene.children, true);
            // 取最近的 3 个命中
            rayHits.push({
                pt: [x, y],
                hits: hits.slice(0, 3).map((h) => {
                    const o = h.object;
                    const m = Array.isArray(o.material) ? o.material[0] : o.material;
                    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
                    const sz = new V(); o.geometry.boundingBox.getSize(sz);
                    return {
                        dist: +h.distance.toFixed(2),
                        size: [+sz.x.toFixed(2), +sz.y.toFixed(2), +sz.z.toFixed(2)],
                        mat: m.type,
                        color: m.color ? '#' + m.color.getHexString() : null,
                        map: m.map ? (m.map.isVideoTexture ? 'VIDEO' : m.map.image ? 'IMG' : '?') : null
                    };
                })
            });
        }

        // 2. 所有带贴图的 mesh / ShaderMaterial mesh，投影到屏幕
        const projected = [];
        const W = cv.width, H = cv.height;
        scene.traverse((o) => {
            if (!o.isMesh) return;
            const m = Array.isArray(o.material) ? o.material[0] : o.material;
            const interesting = (m.type === 'ShaderMaterial') || (m.map && m.map.isVideoTexture) || (m.map && m.map.image && m.map.image.width >= 500 && m.type !== 'MeshStandardMaterial');
            if (!interesting) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const c = o.geometry.boundingBox.getCenter(new V());
            o.updateWorldMatrix(true, false);
            c.applyMatrix4(o.matrixWorld);
            const sp = c.clone().project(cam);
            const sx = Math.round((sp.x * 0.5 + 0.5) * W);
            const sy = Math.round((-sp.y * 0.5 + 0.5) * H);
            const sz = new V(); o.geometry.boundingBox.getSize(sz);
            projected.push({
                screen: [sx, sy],
                inGreenBox: sx >= 256 && sx <= 466 && sy >= 268 && sy <= 544,
                mat: m.type,
                video: !!(m.map && m.map.isVideoTexture),
                mapSize: m.map && m.map.image ? (m.map.image.width || m.map.image.videoWidth) + 'x' + (m.map.image.height || m.map.image.videoHeight) : null,
                size: [+sz.x.toFixed(2), +sz.y.toFixed(2), +sz.z.toFixed(2)],
                visible: o.visible,
                wpos: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)]
            });
        });

        // 3. 手机中心投影
        const phone = new V(1.6725, -1.5682, -0.7941);
        const pp = phone.clone().project(cam);
        const phoneScreen = [Math.round((pp.x * 0.5 + 0.5) * W), Math.round((-pp.y * 0.5 + 0.5) * H)];

        // 4. 绿色区域平均色
        let cnt = 0, rs = 0, gs = 0, bs = 0;
        for (let y = 268; y <= 544; y += 4) for (let x = 256; x <= 466; x += 4) {
            const i = (y * cv.width + x) * 4;
            const r = data[i], g = data[i + 1], bl = data[i + 2];
            if (g > 60 && g > r + 25 && g > bl + 25) { cnt++; rs += r; gs += g; bs += bl; }
        }
        const avg = cnt ? [Math.round(rs / cnt), Math.round(gs / cnt), Math.round(bs / cnt)] : null;

        return { greenSampleCount: greenPts.length, avgGreen: avg, rayHits, projected, phoneScreen };
    }, Array.from(shot));
    console.log(JSON.stringify(result, null, 1));
    await b.close();
})();
