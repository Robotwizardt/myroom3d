/** 机身观感检查：默认全景 + 特写（俯视产品照）+ 侧视（看中框倒角/侧键） */
const path = require('path');
const { chromium } = require('playwright');

const OUT = (f) => path.resolve(__dirname, '../evidence', f);

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: OUT('body_v2_default.png') });

    // 进特写
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    await page.screenshot({ path: OUT('body_v2_closeup.png') });

    // 屏内 DOM 与滑条几何
    const domInfo = await page.evaluate(() => {
        const el = document.querySelector('.htmlPhoneScreen');
        const slider = document.querySelector('[data-testid="lock-slider"]');
        const r = (e) => {
            if (!e) return null;
            const b = e.getBoundingClientRect();
            return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
        };
        return {
            screen: r(el),
            slider: r(slider),
            screenCss: el ? getComputedStyle(el).transform : null,
            dpr: window.devicePixelRatio
        };
    });
    console.log('DOM:', JSON.stringify(domInfo));

    // 侧视：稍微压低相机看中框与侧键（手动 setLookAt，绕过约束）
    await page.evaluate(() => {
        const ctrl = window.__ctrl;
        ctrl.minPolarAngle = 0;
        ctrl.maxPolarAngle = Math.PI;
        ctrl.minAzimuthAngle = -Infinity;
        ctrl.maxAzimuthAngle = Infinity;
        ctrl.setLookAt(1.28, -1.1, -0.42, 1.6725, -1.6135, -0.7941, false);
        ctrl.update();
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: OUT('body_v2_side.png') });

    // 更近的斜上特写（看听筒/前摄/Home 键细节）
    await page.evaluate(() => {
        const ctrl = window.__ctrl;
        ctrl.setLookAt(1.36, -1.02, -0.58, 1.6725, -1.6135, -0.7941, false);
        ctrl.update();
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: OUT('body_v2_detail.png') });

    console.log('console errors:', errors.length, errors.slice(0, 5));
    await browser.close();
})();
