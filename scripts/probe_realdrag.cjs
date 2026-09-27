/** 真实鼠标：特写里拖动解锁 + 点图标，并打印 DOM 命中情况 */
const path = require('path');
const { chromium } = require('playwright');
const BASE = 'http://localhost:5174/';
const elemAt = (page, x, y) =>
    page.evaluate(([px, py]) => {
        const el = document.elementFromPoint(px, py);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, cls: String(el.className).slice(0, 60), testid: el.dataset ? el.dataset.testid : null,
                 rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
                 txt: (el.textContent || '').slice(0, 20) };
    }, [x, y]);
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3500);

    const domInfo = await page.evaluate(() => {
        const wrap = document.querySelector('.htmlPhoneScreen');
        const inner = wrap && wrap.firstElementChild;
        const slider = document.querySelector('[data-testid="lock-slider"]');
        const sr = slider ? slider.getBoundingClientRect() : null;
        const ir = inner ? inner.getBoundingClientRect() : null;
        return {
            canvasPE: getComputedStyle(document.querySelector('canvas')).pointerEvents,
            canvasZ: getComputedStyle(document.querySelector('canvas')).zIndex,
            wrapPE: wrap ? getComputedStyle(wrap).pointerEvents : null,
            innerPE: inner ? getComputedStyle(inner).pointerEvents : null,
            innerRect: ir ? [Math.round(ir.x), Math.round(ir.y), Math.round(ir.width), Math.round(ir.height)] : null,
            innerTransform: inner ? inner.style.transform.slice(0, 80) : null,
            sliderRect: sr ? [Math.round(sr.x), Math.round(sr.y), Math.round(sr.width), Math.round(sr.height)] : null,
            sliderOffsetW: slider ? slider.offsetWidth : null,
        };
    });
    console.log('DOM 情况', JSON.stringify(domInfo, null, 1));
    if (!domInfo.sliderRect) { console.log('没找到滑条'); await browser.close(); return; }
    const [sx, sy, sw, sh] = domInfo.sliderRect;
    console.log('滑条中心命中元素', JSON.stringify(await elemAt(page, sx + sh / 2, sy + sh / 2)));
    console.log('滑条中心偏右命中', JSON.stringify(await elemAt(page, sx + sw * 0.5, sy + sh / 2)));

    // 真实拖动：从滑条左端把手拖到右端
    const kx = sx + sh / 2;
    const ky = sy + sh / 2;
    await page.mouse.move(kx, ky);
    await page.mouse.down();
    for (let i = 1; i <= 15; i++) {
        await page.mouse.move(kx + ((sw - sh) * i) / 15, ky, { steps: 1 });
        await page.waitForTimeout(25);
    }
    await page.mouse.up();
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({
        lock: !!document.querySelector('[data-testid="lock-slider"]'),
        text: (document.querySelector('.htmlPhoneScreen')?.textContent || '').slice(0, 80),
    }));
    console.log('解锁结果', JSON.stringify(after));
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/rd_unlock.png') });
    console.log('pageerror', errs.length, errs.slice(0, 2));
    await browser.close();
})();
