/* 绿色像素反查：截图找绿色区域 → 用 R3F store 的 raycaster 从相机过绿色中心发射线 → 命中 mesh 清单 */
const { chromium } = require('playwright');

(async () => {
    const b = await chromium.launch({ channel: 'msedge', headless: false });
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__ctrl && window.__ctrl._camera, null, { timeout: 40000 });
    await p.waitForTimeout(3000);

    const shot = await p.screenshot();
    await p.screenshot({ path: 'evidence/green_probe_full.png' });

    const greenInfo = await p.evaluate(async (shotBytes) => {
        const blob = new Blob([Uint8Array.from(shotBytes)], { type: 'image/png' });
        const bmp = await createImageBitmap(blob);
        const cv = document.createElement('canvas');
        cv.width = bmp.width; cv.height = bmp.height;
        const ctx = cv.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const greens = [];
        for (let y = 0; y < cv.height; y += 2) {
            for (let x = 0; x < cv.width; x += 2) {
                const i = (y * cv.width + x) * 4;
                const r = data[i], g = data[i + 1], bl = data[i + 2];
                if (g > 60 && g > r + 25 && g > bl + 25) greens.push([x, y, r, g, bl]);
            }
        }
        if (!greens.length) return { count: 0 };
        let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
        for (const [x, y] of greens) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        const cx = Math.round((minX + maxX) / 2);
        const cy = Math.round((minY + maxY) / 2);

        const cam = window.__ctrl._camera;
        // R3F store 挂在 mesh.__r3f.root（zustand store），state 里有 raycaster/camera
        const scene = window.__SCENE__;
        let rc = null;
        let anyMesh = null;
        scene.traverse((o) => { if (!anyMesh && o.isMesh && o.__r3f) anyMesh = o; });
        if (anyMesh && anyMesh.__r3f.root && anyMesh.__r3f.root.getState) {
            const st = anyMesh.__r3f.root.getState();
            if (st.raycaster) rc = st.raycaster;
        }
        if (!rc) return { count: greens.length, bbox: [minX, minY, maxX, maxY], err: 'no raycaster' };
        const V = cam.position.constructor;
        const ndc = new V((cx / cv.width) * 2 - 1, -(cy / cv.height) * 2 + 1, 0.5);
        rc.setFromCamera(ndc, cam);
        const hits = rc.intersectObjects(scene.children, true);
        const hitInfo = hits.slice(0, 8).map((h) => {
            const o = h.object;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            const bb = o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox);
            const sz = new V(); bb.getSize(sz);
            return {
                dist: +h.distance.toFixed(3),
                size: [sz.x.toFixed(3), sz.y.toFixed(3), sz.z.toFixed(3)],
                mats: mats.map((m) => ({
                    type: m.type,
                    color: m.color ? '#' + m.color.getHexString() : null,
                    hasMap: !!m.map
                })),
                type: o.type,
                visible: o.visible
            };
        });
        return {
            count: greens.length,
            bbox: [minX, minY, maxX, maxY],
            center: [cx, cy],
            sampleColors: greens.slice(0, 5).map((g) => [g[2], g[3], g[4]]),
            hitInfo
        };
    }, Array.from(shot));
    console.log(JSON.stringify(greenInfo, null, 1));
    await b.close();
})();
