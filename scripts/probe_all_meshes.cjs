const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(6000);
    const rows = await page.evaluate(() => {
        const out = [];
        window.__SCENE__.traverse((o) => {
            if (!o.isMesh || !o.geometry) return;
            o.geometry.computeBoundingBox();
            const V = o.geometry.boundingBox.min.constructor;
            const ctr = o.geometry.boundingBox.getCenter(new V()).applyMatrix4(o.matrixWorld);
            const size = o.geometry.boundingBox.getSize(new V());
            out.push([
                o.geometry.type.slice(0, 6),
                o.material && o.material.color ? '#' + o.material.color.getHexString() : '-',
                o.visible ? 'v' : '-',
                [ctr.x, ctr.y, ctr.z].map((v) => +v.toFixed(2)).join(','),
                [size.x, size.y, size.z].map((v) => +v.toFixed(3)).join('x'),
                o.parent && o.parent.type ? o.parent.type : '-'
            ]);
        });
        return out;
    });
    rows.forEach((r, i) => console.log(String(i).padStart(2), r.join(' | ')));
    console.log('ERRORS', JSON.stringify(errs.slice(0, 6)));
    await browser.close();
})();
