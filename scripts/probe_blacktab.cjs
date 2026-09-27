/** 查手机下方伸出的「黑色小舌」是什么网格 */
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
        const res = [];
        for (const [px, py] of [[600, 640], [610, 620], [560, 600], [660, 620], [520, 560]]) {
            v.set((px / 1280) * 2 - 1, -(py / 800) * 2 + 1);
            rc.setFromCamera(v, cam);
            const hits = rc.intersectObjects(window.__SCENE__.children, true);
            res.push({
                px, py,
                hits: hits.slice(0, 4).map((h) => {
                    const g = h.object.geometry;
                    g.computeBoundingBox();
                    const s = new THREE.Vector3();
                    g.boundingBox.getSize(s);
                    return {
                        uuid: h.object.uuid.slice(0, 6),
                        mat: h.object.material.type,
                        color: h.object.material.color ? '#' + h.object.material.color.getHexString() : '-',
                        geo: [s.x, s.y, s.z].map((n) => +n.toFixed(3)),
                        visible: h.object.visible,
                        dist: +h.distance.toFixed(3),
                        wp: [h.point.x, h.point.y, h.point.z].map((n) => +n.toFixed(3)),
                    };
                }),
            });
        }
        return res;
    });
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
})();
