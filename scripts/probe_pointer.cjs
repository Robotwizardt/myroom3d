/** 判定 DOM 屏到底收不收得到鼠标事件 + 事件是否被 scale 影响 */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await sleep(3500);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await sleep(3500);

    const info = await page.evaluate(() => {
        const root = [...document.querySelectorAll('div')].find((n) => n.style && n.style.width === '392px');
        const slider = [...document.querySelectorAll('div')].find((n) => n.style && n.style.width === '220px' && n.style.height === '44px');
        const pe = (el) => (el ? getComputedStyle(el).pointerEvents : null);
        const chain = [];
        for (let el = slider; el && chain.length < 6; el = el.parentElement) {
            const r = el.getBoundingClientRect();
            chain.push(`${el.tagName}.${el.className || '-'} pe=${getComputedStyle(el).pointerEvents} rect=${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return {
            rootPE: pe(root), rootRect: root ? (() => { const r = root.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() : null,
            rootOffset: root ? [root.offsetWidth, root.offsetHeight] : null,
            sliderPE: pe(slider),
            sliderRect: slider ? (() => { const r = slider.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() : null,
            sliderOffset: slider ? [slider.offsetWidth, slider.offsetHeight] : null,
            chain,
        };
    });
    console.log(JSON.stringify(info, null, 1));

    // 真实拖拽：按「看得见宽度」的 1.0 倍 vs 2.2 倍各试一次
    for (const mult of [1.0, 2.2]) {
        await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find((n) => n.style?.width === '220px'); if (s) s.__x = 0; });
        const [x, y, w, h] = info.sliderRect;
        const yMid = y + h / 2;
        await page.mouse.move(x + 6, yMid);
        await page.mouse.down();
        const dist = w * mult;
        for (let i = 1; i <= 12; i += 1) { await page.mouse.move(x + 6 + (dist * i) / 12, yMid); await sleep(25); }
        await page.mouse.up();
        await sleep(900);
        const locked = await page.evaluate(() => document.body.innerText.includes('滑动来解锁'));
        console.log(`拖拽 ${mult} × 可见宽度（${Math.round(dist)}px，阈值 91 CSS px）：仍在锁屏 = ${locked}`);
        if (!locked) break;
    }
    await browser.close();
})();
