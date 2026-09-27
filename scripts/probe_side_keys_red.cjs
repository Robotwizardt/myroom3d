// 把机身侧键（材质色 #b9bbbe）临时染成红色，拍照看「顶部那块凸块」到底是不是它们。
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5174/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200)));
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__cameraStore && window.__SCENE__ && window.__ctrl, null, { timeout: 40000 });
    await sleep(6000);

    const phonePoint = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const p = new THREE.Vector3(1.6725, -1.6135, -0.7941).project(cam);
        return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
    });
    await page.mouse.click(phonePoint.x, phonePoint.y);
    await sleep(4500);

    // 只把「侧键/电源键」那一组染色（材质 #b9bbbe），并在控制台报出它们的世界包围盒中心
    const info = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const rows = [];
        window.__SCENE__.traverse((o) => {
            if (!o.isMesh || !o.material || !o.material.color) return;
            const hex = '#' + o.material.color.getHexString();
            if (hex !== '#b9bbbe') return;
            o.material.color.set('#ff0000');
            o.material.emissive && o.material.emissive.set('#330000');
            const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
            const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
            const p = c.clone().project(window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object);
            rows.push({
                center: [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)],
                size: [+s.x.toFixed(4), +s.y.toFixed(4), +s.z.toFixed(4)],
                px: [(p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight].map((v) => +v.toFixed(0))
            });
        });
        return rows;
    });
    info.forEach((r) => console.log(JSON.stringify(r)));
    await sleep(500);
    await page.screenshot({ path: 'evidence/probe_side_keys_red.png' });
    await browser.close();
})();
