/** 当前手机「正上方产品照」取景，用于评估机身比例与 UI 观感 */
const path = require('path');
const { chromium } = require('playwright');
const BASE = 'http://localhost:5174/';
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 2 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__cameraStore && window.__ctrl, null, { timeout: 40000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3500);

    // 记录当前机位
    const cam0 = await page.evaluate(() => {
        const c = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        return { pos: c.position.toArray(), fov: c.fov, target: window.__ctrl._targetEnd ? window.__ctrl._targetEnd.toArray() : null };
    });
    console.log('特写机位', JSON.stringify(cam0));

    // 放宽极角限制 → 正上方俯视（沿机身长轴方向偏 8°）
    const cam1 = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const st = window.__cameraStore;
        st.setState({ minPolarAngle: 0, maxPolarAngle: Math.PI * 0.5 });
        const T = new THREE.Vector3(1.6725, -1.6135, -0.7941);
        const axis = new THREE.Vector3(Math.cos(0.966), 0, -Math.sin(0.966)); // 机身 +X（听筒端）
        const polar = (8 * Math.PI) / 180;
        const dir = axis.clone().multiplyScalar(-Math.sin(polar)); // 站在 Home 键那侧
        dir.y = Math.cos(polar);
        dir.normalize().multiplyScalar(0.92);
        const P = T.clone().add(dir);
        window.__ctrl.setLookAt(P.x, P.y, P.z, T.x, T.y, T.z, false);
        return { pos: P.toArray().map((n) => +n.toFixed(4)) };
    });
    await page.waitForTimeout(2500);
    console.log('产品照机位', JSON.stringify(cam1));
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/look_lock.png') });

    // 真实拖动解锁后取主屏
    const r = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="lock-slider"]');
        const b = s.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height];
    });
    const kx = r[0] + r[3] / 2;
    const ky = r[1] + r[3] / 2;
    await page.mouse.move(kx, ky);
    await page.mouse.down();
    for (let i = 1; i <= 15; i++) { await page.mouse.move(kx + ((r[2] - r[3]) * i) / 15, ky, { steps: 1 }); await page.waitForTimeout(20); }
    await page.mouse.up();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/look_home.png') });
    console.log('解锁后仍在锁屏?', await page.evaluate(() => !!document.querySelector('[data-testid="lock-slider"]')));
    await browser.close();
})();
