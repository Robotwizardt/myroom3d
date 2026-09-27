/* 对比绿色区域与 DOM 屏 wrapper 的位置，并 dump 屏内容主色 */
const { chromium } = require('playwright');

(async () => {
    const b = await chromium.launch({ channel: 'msedge', headless: false });
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__ctrl && window.__ctrl._camera, null, { timeout: 40000 });
    await p.waitForTimeout(3000);

    // 1. 找 htmlPhoneScreen wrapper 的屏幕位置
    const domInfo = await p.evaluate(() => {
        const els = document.querySelectorAll('.htmlPhoneScreen, [class*="htmlPhone"]');
        const out = [];
        for (const el of els) {
            const r = el.getBoundingClientRect();
            out.push({
                cls: el.className,
                rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
                childCount: el.children.length,
                style: {
                    position: el.style.position,
                    transform: el.style.transform ? el.style.transform.slice(0, 80) : '',
                    zIndex: el.style.zIndex,
                    display: getComputedStyle(el).display,
                    visibility: getComputedStyle(el).visibility
                }
            });
        }
        // 也找所有 wrapperClass 含 phone 的 canvas 外 DOM
        const all = [...document.querySelectorAll('body *')].filter((el) =>
            el.className && typeof el.className === 'string' && el.className.toLowerCase().includes('phone')
        );
        for (const el of all) {
            if (!out.find((o) => o.cls === el.className)) {
                const r = el.getBoundingClientRect();
                out.push({ cls: el.className, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] });
            }
        }
        return out;
    });
    console.log('DOM 屏元素位置:', JSON.stringify(domInfo, null, 1));

    // 2. 绿色 bbox 内有没有 DOM 元素
    const greenDom = await p.evaluate(() => {
        const hits = [];
        const cx = 361, cy = 406;
        let el = document.elementFromPoint(cx, cy);
        while (el && hits.length < 6) {
            hits.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), id: el.id });
            el = el.parentElement;
        }
        // 采样绿色区域几个点的元素
        const pts = [[280, 300], [361, 406], [440, 500], [300, 500]];
        const ptsInfo = pts.map(([x, y]) => {
            const e = document.elementFromPoint(x, y);
            return { pt: [x, y], tag: e ? e.tagName : null, cls: e ? String(e.className).slice(0, 60) : null };
        });
        return { chainFromCenter: hits, ptsInfo };
    });
    console.log('绿色中心元素链:', JSON.stringify(greenDom, null, 1));

    const shot = await p.screenshot({ path: 'evidence/green_dom_check.png' });
    // 3. 采样 DOM 屏 wrapper 区域和绿色区域的像素对比
    const px = await p.evaluate(async (shotBytes) => {
        const blob = new Blob([Uint8Array.from(shotBytes)], { type: 'image/png' });
        const bmp = await createImageBitmap(blob);
        const cv = document.createElement('canvas');
        cv.width = bmp.width; cv.height = bmp.height;
        const ctx = cv.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const pick = (x, y) => { const i = (y * cv.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
        return {
            greenCenter: pick(361, 406),
            greenCorners: [pick(260, 270), pick(464, 542), pick(361, 300), pick(361, 520)]
        };
    }, Array.from(shot));
    console.log('绿色区像素:', JSON.stringify(px));
    await b.close();
})();
