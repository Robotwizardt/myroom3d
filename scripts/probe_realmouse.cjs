/** 真实鼠标路径复现：默认视角点手机能不能进特写；特写里拖动解锁能不能解锁 */
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'http://localhost:5174/';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(4000);

    // 手机中心投影到屏幕像素
    const proj = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const v = new THREE.Vector3(1.6725, -1.6, -0.7941).project(cam);
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, state: window.__cameraStore.getState().cameraState };
    });
    console.log('默认视角手机投影像素', JSON.stringify(proj));
    console.log('该点元素', await page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.tagName + '.' + (el.className || '') : null;
    }, [proj.x, proj.y]));

    // 1) 真实鼠标点击手机
    await page.mouse.move(proj.x, proj.y);
    await page.mouse.click(proj.x, proj.y);
    await page.waitForTimeout(2500);
    console.log('点击后 cameraState =', await page.evaluate(() => window.__cameraStore.getState().cameraState));
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/rm_after_click.png') });

    // 2) 特写里找解锁条并真实拖动
    const info = await page.evaluate(() => {
        const wrap = document.querySelector('.htmlPhoneScreen');
        if (!wrap) return { wrap: false };
        const r = wrap.getBoundingClientRect();
        const bar = document.querySelector('.htmlPhoneScreen .slider-knob') || document.querySelector('.htmlPhoneScreen [class*=slider]');
        const br = bar ? bar.getBoundingClientRect() : null;
        return {
            wrap: true,
            rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
            barRect: br ? [Math.round(br.x), Math.round(br.y), Math.round(br.width), Math.round(br.height)] : null,
            barClass: bar ? bar.className : null,
        };
    });
    console.log('DOM 屏信息', JSON.stringify(info));
    if (info.barRect) {
        const [bx, by, bw, bh] = info.barRect;
        const sx = bx + bw / 2;
        const sy = by + bh / 2;
        console.log('解锁条中心上方元素', await page.evaluate(([x, y]) => {
            const el = document.elementFromPoint(x, y);
            return el ? el.tagName + '.' + (el.className || '') : null;
        }, [sx, sy]));
        await page.mouse.move(sx, sy);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(sx + (bw * 0.85 * i) / 12, sy, { steps: 2 });
            await page.waitForTimeout(30);
        }
        await page.mouse.up();
        await page.waitForTimeout(1200);
        console.log('真实拖动后 锁屏还在吗 =', await page.evaluate(() => !!document.querySelector('.htmlPhoneScreen .lock-screen')));
        await page.screenshot({ path: path.resolve(__dirname, '../evidence/rm_after_drag.png') });
    }
    console.log('控制台错误', errors.length, errors.slice(0, 3));
    await browser.close();
})();
