const { chromium } = require('playwright');
const W = Number(process.argv[2] || 1280), H = Number(process.argv[3] || 800);
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(6000);
    const out = await page.evaluate(() => {
        let frame = null, shells = [], roots = [];
        window.__SCENE__.traverse((o) => {
            if (o.isMesh && o.geometry && o.geometry.type === 'ExtrudeGeometry' && o.material && o.material.color && o.material.color.getHexString() === 'c8cacc') {
                o.geometry.computeBoundingBox();
                const V = o.geometry.boundingBox.min.constructor;
                const c = o.geometry.boundingBox.getCenter(new V()).applyMatrix4(o.matrixWorld);
                frame = [c.x, c.y, c.z].map(v => +v.toFixed(4));
            }
            if (o.isMesh && o.geometry && o.geometry.type === 'BufferGeometry') {
                o.geometry.computeBoundingBox();
                const V = o.geometry.boundingBox.min.constructor;
                const s = o.geometry.boundingBox.getSize(new V());
                if (s.x > 8) {
                    const c = o.geometry.boundingBox.getCenter(new V()).applyMatrix4(o.matrixWorld);
                    shells.push([+s.x.toFixed(2), +c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)]);
                }
            }
        });
        let g = null, n = 0;
        window.__SCENE__.traverse((o) => { if (o.isGroup) { n++; if (n === 1) g = o; } });
        const top = [];
        for (const c of window.__SCENE__.children) {
            top.push([c.type, [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(3)).join(','), [c.scale.x, c.scale.y, c.scale.z].map(v => +v.toFixed(3)).join(','), c.children.length]);
        }
        return { frame, shells, top };
    });
    console.log(`VIEWPORT ${W}x${H}`);
    console.log('  phoneFrameCtr', JSON.stringify(out.frame));
    console.log('  bigShells', JSON.stringify(out.shells));
    console.log('  sceneChildren', JSON.stringify(out.top));
    await browser.close();
})();
