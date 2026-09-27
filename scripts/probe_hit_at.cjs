const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:5174/');
    await page.waitForFunction(() => window.__cameraStore && window.__SCENE__ && window.__ctrl, null, { timeout: 40000 });
    await sleep(6000);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await sleep(4000);
    const pts = [[430, 745], [470, 762], [640, 775], [860, 745], [640, 630], [560, 700]];
    for (const [sx, sy] of pts) {
        const out = await page.evaluate(async ({ sx, sy }) => {
            const urls = performance.getEntriesByType('resource').map((e) => e.name);
            const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
            const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
            const ndc = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
            const ray = new THREE.Raycaster();
            ray.setFromCamera(ndc, cam);
            const hits = ray.intersectObjects(window.__SCENE__.children, true).filter((h) => h.object.visible).slice(0, 3);
            return hits.map((h) => ({
                d: +h.distance.toFixed(3),
                col: h.object.material && h.object.material.color ? '#' + h.object.material.color.getHexString() : (h.object.material ? 'shader' : '-'),
                geo: h.object.geometry ? h.object.geometry.type : '-',
                p: h.point.toArray().map((v) => +v.toFixed(3))
            }));
        }, { sx, sy });
        console.log(`(${sx},${sy}) →`, JSON.stringify(out));
    }
    await browser.close();
})();
