/* 身份钉死探针：几何类型+贴图+visible+材质名，0.45 内全部 mesh */
const { chromium } = require('playwright');

(async () => {
    const b = await chromium.launch({ channel: 'msedge', headless: false });
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__ctrl && window.__ctrl._camera, null, { timeout: 40000 });
    await p.waitForTimeout(3000);

    const info = await p.evaluate(() => {
        const scene = window.__SCENE__;
        const cam = window.__ctrl._camera;
        const V = cam.position.constructor;
        const phonePos = new V(1.6725, -1.5682, -0.7941);
        const out = [];
        scene.traverse((o) => {
            if (!o.isMesh) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const bb = o.geometry.boundingBox;
            const c = bb.getCenter(new V());
            o.updateWorldMatrix(true, false);
            c.applyMatrix4(o.matrixWorld);
            const d = c.distanceTo(phonePos);
            if (d > 0.45) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            const sz = new V(); bb.getSize(sz);
            // 父链类型（识别挂载结构）
            const chain = [];
            let el = o;
            while (el && chain.length < 4) {
                chain.push(el.type + (el.__r3f && el.__r3f.type ? ':' + el.__r3f.type : ''));
                el = el.parent;
            }
            out.push({
                d: +d.toFixed(3),
                size: [+sz.x.toFixed(3), +sz.y.toFixed(3), +sz.z.toFixed(3)],
                geo: o.geometry.type,
                visible: o.visible,
                mat: mats.map((m) => ({
                    type: m.type, color: m.color ? '#' + m.color.getHexString() : null,
                    hasMap: !!m.map,
                    mapImg: m.map && m.map.image ? (m.map.image.width || m.map.image.videoWidth || '?') + 'x' + (m.map.image.height || m.map.image.videoHeight || '?') : null,
                    uniforms: m.uniforms ? Object.keys(m.uniforms).slice(0, 6) : undefined
                })),
                chain
            });
        });
        out.sort((a, b2) => a.d - b2.d);
        return out;
    });
    console.log(JSON.stringify(info, null, 1));
    await b.close();
})();
