/* 在手机下方区域找绿色来源：遍历所有 mesh，列出发光/动画/绿色材质的 */
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
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
                // 条件：材质颜色偏绿 / 发光 / 有动画贴图 / 半透明
                let greenish = false, isEmissive = false, isAnim = false, isTrans = false;
                if (m.color) {
                    const c = m.color;
                    if (c.g > 0.15 && c.g > c.r + 0.08 && c.g > c.b + 0.08) greenish = true;
                }
                if (m.emissive && (m.emissive.g > 0.1 || m.emissiveIntensity > 0.5)) isEmissive = true;
                if (m.map && m.map.userData) isAnim = true;
                if (m.transparent && m.opacity < 0.98) isTrans = true;
                if (greenish || isEmissive || isTrans) {
                    // 世界坐标
                    const wp = new V();
                    o.getWorldPosition(wp);
                    const d = wp.distanceTo(phonePos);
                    const bb = o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox);
                    const sz = new V(); bb.getSize(sz);
                    out.push({
                        dToPhone: +d.toFixed(2),
                        size: [sz.x.toFixed(3), sz.y.toFixed(3), sz.z.toFixed(3)],
                        wpos: [wp.x.toFixed(2), wp.y.toFixed(2), wp.z.toFixed(2)],
                        mat: {
                            type: m.type,
                            color: m.color ? '#' + m.color.getHexString() : null,
                            emissive: m.emissive ? '#' + m.emissive.getHexString() : null,
                            emissiveIntensity: m.emissiveIntensity,
                            transparent: m.transparent, opacity: m.opacity != null ? +m.opacity.toFixed(2) : null,
                            hasMap: !!m.map,
                            mapIsVideo: !!(m.map && m.map.isVideoTexture),
                            skinning: m.userData ? !!m.userData : false
                        }
                    });
                }
            }
        });
        out.sort((a, b) => a.dToPhone - b.dToPhone);
        return out.slice(0, 25);
    });
    console.log(JSON.stringify(info, null, 1));
    await b.close();
})();
