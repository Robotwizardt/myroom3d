const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:5174/');
    await page.waitForFunction(() => window.__cameraStore && window.__SCENE__ && window.__ctrl, null, { timeout: 40000 });
    await sleep(6000);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await sleep(3500);
    const out = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const phone = new THREE.Vector3(1.6725, -1.6135, -0.7941);
        let best = null;
        window.__SCENE__.traverse((o) => {
            const hex = o.material && o.material.color ? '#' + o.material.color.getHexString() : '';
            if (hex !== '#16171a' && hex !== '#3a3b40') return;
            const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
            if (!best || c.distanceTo(phone) < best.d) best = { d: c.distanceTo(phone), c };
        });
        const p = best.c.clone().project(cam);
        const ndc = { x: p.x, y: p.y };
        const screen = { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), cam);
        const hits = ray.intersectObjects(window.__SCENE__.children, true).slice(0, 8).map((h) => ({
            d: +h.distance.toFixed(3),
            obj: h.object.type,
            col: h.object.material && h.object.material.color ? '#' + h.object.material.color.getHexString() : '-',
            geo: h.object.geometry ? h.object.geometry.type : '-',
            parentHasClick: !!(h.object.parent && h.object.parent.__r3f && h.object.parent.__r3f.handlers && h.object.parent.__r3f.handlers.onClick),
            selfHasClick: !!(h.object.__r3f && h.object.__r3f.handlers && h.object.__r3f.handlers.onClick)
        }));
        return { homeWorld: best.c.toArray().map((v) => +v.toFixed(3)), ndc: [+ndc.x.toFixed(3), +ndc.y.toFixed(3)], screen: [+screen.x.toFixed(0), +screen.y.toFixed(0)], hits };
    });
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
})();
