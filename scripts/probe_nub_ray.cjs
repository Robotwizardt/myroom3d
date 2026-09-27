/**
 * 射线溯源：在与 face_metrics_topdown 相同的机位下，向"机身轮廓外的黑色小凸块"
 * 的像素位置投射射线，报告命中的物体（名字/材质颜色/材质类型/世界坐标/距离）。
 * 用法：node scripts/probe_nub_ray.cjs
 */
const path = require('path');
const { chromium } = require('playwright');

const PIXELS = [
    ['左上边缘', 566, 300],
    ['左下凸块', 600, 680],
    ['右下凸块', 856, 596],
    ['顶部凸块', 790, 185],
    ['机身中心', 720, 450],
    ['桌面参考', 1000, 300]
];

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
        const ctrl = window.__ctrl;
        ctrl.minPolarAngle = 0;
        ctrl.maxPolarAngle = Math.PI;
        const axis = { x: 0.569, z: -0.822 };
        const center = { x: 1.6725, y: -1.6135, z: -0.7941 };
        const R = 1.7;
        const pol = 0.012 * Math.PI;
        ctrl.setLookAt(center.x - R * Math.sin(pol) * axis.x, center.y + R * Math.cos(pol), center.z - R * Math.sin(pol) * axis.z, center.x, center.y, center.z, false);
        ctrl.update();
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/nub_ray_view.png') });

    const out = await page.evaluate((pixels) => {
        const scene = window.__SCENE__;
        let ray = null;
        let cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        scene.traverse((o) => {
            if (!ray && o.isMesh && o.__r3f && o.__r3f.root) {
                const st = o.__r3f.root.getState();
                ray = st.raycaster;
                cam = cam || st.camera;
            }
        });
        if (!ray) return { err: 'no raycaster' };
        const W = 1440;
        const H = 900;
        return pixels.map(([label, x, y]) => {
            ray.setFromCamera({ x: (x / W) * 2 - 1, y: -(y / H) * 2 + 1 }, cam);
            const hits = ray.intersectObjects(scene.children, true).slice(0, 3);
            return {
                label,
                px: [x, y],
                hits: hits.map((h) => ({
                    name: h.object.name || '(unnamed)',
                    type: h.object.type,
                    mat: h.object.material ? h.object.material.type : null,
                    color: h.object.material && h.object.material.color ? '#' + h.object.material.color.getHexString() : null,
                    tri: h.face ? h.face.materialIndex : null,
                    point: [h.point.x, h.point.y, h.point.z].map((v) => +v.toFixed(4)),
                    dist: +h.distance.toFixed(3)
                }))
            };
        });
    }, PIXELS);
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
})();
