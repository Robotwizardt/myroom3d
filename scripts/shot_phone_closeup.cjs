// 进手机特写拍一张（默认锁定视角），用于肉眼核对机身轮廓上的侧键/电源键。
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5174/';
const OUT = process.env.OUT || 'evidence/phone_keys_fixed.png';
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
    await page.waitForFunction(() => window.__cameraStore.getState().cameraState === 'smartphone', null, { timeout: 8000 }).catch(() => {});
    await sleep(5000);
    await page.screenshot({ path: OUT });
    console.log('saved', OUT);
    await browser.close();
})();
