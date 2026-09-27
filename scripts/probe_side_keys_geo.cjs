// 深入：侧键网格的本地几何尺寸 / 父链缩放 / 是不是我们自己的 SideButton
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5174/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__cameraStore && window.__SCENE__ && window.__ctrl, null, { timeout: 40000 });
    await sleep(6000);

    const rows = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const out = [];
        window.__SCENE__.traverse((o) => {
            if (!o.isMesh || !o.material || !o.material.color) return;
            const hex = '#' + o.material.color.getHexString();
            if (hex !== '#b9bbbe') return;
            o.geometry.computeBoundingBox();
            const gb = o.geometry.boundingBox;
            const chain = [];
            let p = o;
            while (p) {
                chain.push(
                    `${p.type}${p.name ? ':' + p.name : ''} pos=${p.position.toArray().map((v) => +v.toFixed(3))} scale=${p.scale.toArray().map((v) => +v.toFixed(3))}`
                );
                p = p.parent;
            }
            out.push({
                geoParams: o.geometry.parameters ? JSON.stringify(o.geometry.parameters).slice(0, 90) : o.geometry.type,
                geoBox: [
                    +(gb.max.x - gb.min.x).toFixed(4),
                    +(gb.max.y - gb.min.y).toFixed(4),
                    +(gb.max.z - gb.min.z).toFixed(4)
                ],
                geoMin: gb.min.toArray().map((v) => +v.toFixed(4)),
                chain
            });
        });
        // 顺便报三 version / RoundedBox 是否来自 drei
        return out;
    });
    rows.forEach((r, i) => {
        console.log(`#${i} geoParams=${r.geoParams}`);
        console.log(`   geoBox=${JSON.stringify(r.geoBox)} geoMin=${JSON.stringify(r.geoMin)}`);
        r.chain.slice(0, 4).forEach((c) => console.log('   chain:', c));
    });
    await browser.close();
})();
