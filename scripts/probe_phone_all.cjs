/* 列出手机中心 0.5 内全部 mesh，含 ShaderMaterial 和可见性 */
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
            const wp = new V();
            o.getWorldPosition(wp);
            const d = wp.distanceTo(phonePos);
            if (d > 0.5) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            const bb = o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox);
            const sz = new V(); bb.getSize(sz);
            out.push({
                d: +d.toFixed(3),
                size: [+sz.x.toFixed(3), +sz.y.toFixed(3), +sz.z.toFixed(3)],
                wpos: [+wp.x.toFixed(3), +wp.y.toFixed(3), +wp.z.toFixed(3)],
                visible: o.visible,
                renderOrder: o.renderOrder,
                matTypes: mats.map((m) => m.type),
                shaderUniforms: mats.map((m) =>
                    m.type === 'ShaderMaterial' ? Object.keys(m.uniforms || {}).slice(0, 8) : null
                )
            });
        });
        out.sort((a, b2) => a.d - b2.d);
        return out;
    });
    console.log(JSON.stringify(info, null, 1));
    await b.close();
})();
