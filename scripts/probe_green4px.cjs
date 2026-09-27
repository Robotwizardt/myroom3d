/** 特写里残留的 4 个绿像素是什么 */
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(3500);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3500);
    const out = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const ctrl = window.__ctrl;
        const cam = ctrl.camera || ctrl._camera || ctrl.object;
        const rc = new THREE.Raycaster();
        const v = new THREE.Vector2();
        const C = new THREE.Vector3(1.6762, -1.5845, -0.8014);
        const H = new THREE.Vector3(0.335, 0.022, 0.178);
        const R = (60 * Math.PI) / 180;
        const res = [];
        for (const [px, py] of [[626, 531], [627, 532], [626, 533], [625, 530]]) {
            v.set((px / 1280) * 2 - 1, -(py / 800) * 2 + 1);
            rc.setFromCamera(v, cam);
            const hits = rc.intersectObjects(window.__SCENE__.children, true);
            res.push({
                px, py,
                hits: hits.slice(0, 3).map((h) => {
                    const d = h.point.clone().sub(C);
                    const c = Math.cos(R), s = Math.sin(R);
                    const p = [c * d.x - s * d.z, d.y, s * d.x + c * d.z];
                    return {
                        uuid: h.object.uuid.slice(0, 6),
                        geo: h.object.geometry.boundingBox
                            ? (() => { const sz = new THREE.Vector3(); h.object.geometry.boundingBox.getSize(sz); return [sz.x, sz.y, sz.z].map((n) => +n.toFixed(2)); })()
                            : null,
                        uv: h.uv ? [+h.uv.x.toFixed(4), +h.uv.y.toFixed(4)] : null,
                        wp: [h.point.x, h.point.y, h.point.z].map((n) => +n.toFixed(3)),
                        inCutBox: Math.abs(p[0]) < H.x && Math.abs(p[1]) < H.y && Math.abs(p[2]) < H.z,
                        dist: +h.distance.toFixed(3),
                    };
                }),
            });
        }
        return res;
    });
    for (const s of out) {
        console.log('px', s.px, s.py, JSON.stringify(s.hits, null, 0));
    }
    await browser.close();
})();
