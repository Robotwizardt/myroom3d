/* 终极识别：按世界 bbox 中心算距离（旧glb网格顶点带偏移，原点不可信），
   并读 __r3f.props 识别每个 mesh 是哪个 JSX 元素 */
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
            // 世界 bbox 中心 = 渲染位置（顶点偏移也正确）
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const bb = o.geometry.boundingBox;
            const c = bb.getCenter(new V());
            o.updateWorldMatrix(true, false);
            c.applyMatrix4(o.matrixWorld);
            const d = c.distanceTo(phonePos);
            if (d > 0.45) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            const sz = new V(); bb.getSize(sz);
            // R3F props 识别
            const props = o.__r3f && o.__r3f.props ? o.__r3f.props : null;
            out.push({
                d: +d.toFixed(3),
                localSize: [+sz.x.toFixed(3), +sz.y.toFixed(3), +sz.z.toFixed(3)],
                renderedAt: [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)],
                originAt: (() => { const wp = new V(); o.getWorldPosition(wp); return [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)]; })(),
                matTypes: mats.map((m) => m.type),
                colors: mats.map((m) => (m.color ? '#' + m.color.getHexString() : null)),
                r3fProps: props ? JSON.stringify({
                    position: props.position, rotation: props.rotation,
                    args: props.args, visible: props.visible,
                    onClick: typeof props.onClick
                }) : null
            });
        });
        out.sort((a, b2) => a.d - b2.d);
        return out;
    });
    console.log(JSON.stringify(info, null, 1));
    await b.close();
})();
