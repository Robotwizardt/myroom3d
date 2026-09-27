// 量一下机身自己的侧键/电源键在世界坐标里的实际尺寸与朝向，
// 找出「顶部那块像黑舌头的凸块」到底是哪个网格、凸出多少。
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
    await sleep(4000);

    const out = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const COLORS = ['#b9bbbe', '#c8cacc', '#c9cbcd', '#08080a', '#0a0a0c'];
        const rows = [];
        window.__SCENE__.traverse((o) => {
            if (!o.isMesh || !o.material || !o.material.color) return;
            const hex = '#' + o.material.color.getHexString();
            if (!COLORS.includes(hex)) return;
            const box = new THREE.Box3().setFromObject(o);
            const size = box.getSize(new THREE.Vector3());
            rows.push({
                name: o.name || '(unnamed)',
                parent: o.parent && o.parent.name,
                hex,
                mat: o.material.type,
                size: [+size.x.toFixed(4), +size.y.toFixed(4), +size.z.toFixed(4)],
                min: [+box.min.x.toFixed(4), +box.min.y.toFixed(4), +box.min.z.toFixed(4)],
                max: [+box.max.x.toFixed(4), +box.max.y.toFixed(4), +box.max.z.toFixed(4)],
                geo: o.geometry.parameters
                    ? JSON.stringify(o.geometry.parameters).slice(0, 120)
                    : o.geometry.type
            });
        });
        return rows;
    });
    console.log('meshes', out.length);
    out.forEach((r) => console.log(JSON.stringify(r)));
    await page.screenshot({ path: 'evidence/probe_side_keys.png' });
    await browser.close();
})();
