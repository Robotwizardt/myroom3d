const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(6000);
    const out = await page.evaluate(() => {
        const cam = window.__ctrl.camera;
        const canvas = document.querySelector('canvas');
        // 找一个大壳 mesh，往上打印父链
        let target = null;
        window.__SCENE__.traverse((o) => {
            if (target) return;
            if (o.isMesh && o.geometry && o.geometry.type === 'BufferGeometry') {
                o.geometry.computeBoundingBox();
                const V = o.geometry.boundingBox.min.constructor;
                const s = o.geometry.boundingBox.getSize(new V());
                if (s.x > 10) target = o;
            }
        });
        const chain = [];
        let p = target;
        while (p) {
            chain.push({
                type: p.type,
                name: p.name || '-',
                pos: [p.position.x, p.position.y, p.position.z].map((v) => +v.toFixed(4)).join(','),
                rot: [p.rotation.x, p.rotation.y, p.rotation.z].map((v) => +v.toFixed(4)).join(','),
                scale: [p.scale.x, p.scale.y, p.scale.z].map((v) => +v.toFixed(4)).join(',')
            });
            p = p.parent;
        }
        return {
            canvas: [canvas.clientWidth, canvas.clientHeight, canvas.width, canvas.height],
            innerW: window.innerWidth, innerH: window.innerHeight, dpr: window.devicePixelRatio,
            aspect: +cam.aspect.toFixed(4), fov: cam.fov,
            chain
        };
    });
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
})();
