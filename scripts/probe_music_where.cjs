// 诊断 v2：点歌后 DOM 到底跑哪去了 —— 量各个元素的实际屏幕位置 + 谁在最上层
const { chromium } = require('playwright');

const BASE = 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dump = async (page, tag) => {
    const info = await page.evaluate(() => {
        const rect = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
        };
        const wrap = document.querySelector('.htmlMusicPlayer');
        const el = wrap ? wrap.parentElement : null;
        const elCs = el ? getComputedStyle(el) : null;
        // 面板里的内容 div（wrap 的直接子，绕过 drei 的转换层）
        const inner = wrap ? wrap.firstElementChild : null;
        const innerCs = inner ? getComputedStyle(inner) : null;
        const disc = rect('[data-testid="vinyl-disc"]');
        const out = {
            cameraState: window.__cameraStore.getState().cameraState,
            disc,
            row0: rect('[data-testid="song-row"]'),
            lyric: rect('[data-testid="lyric-box"]'),
            cover: rect('[data-testid="vinyl-cover"], [data-testid="vinyl-cover-placeholder"]'),
            wrap: rect('.htmlMusicPlayer'),
            el: el
                ? ((r2) => [Math.round(r2.x), Math.round(r2.y), Math.round(r2.width), Math.round(r2.height)])(
                      el.getBoundingClientRect()
                  )
                : null,
            elOverflow: elCs ? elCs.overflow + ' / t:' + elCs.transform.slice(0, 40) : null,
            innerTransform: innerCs ? innerCs.transform.slice(0, 90) : null,
            canvas: rect('canvas')
        };
        if (disc) {
            const [x, y, w, h] = disc;
            const at = document.elementsFromPoint(x + w / 2, y + h / 2).slice(0, 4);
            out.topAtDisc = at.map((e) => e.tagName + '.' + String(e.className).slice(0, 24));
        }
        return out;
    });
    console.log(`\n---- ${tag} ----\n` + JSON.stringify(info, null, 1));
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
    page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE-ERR', m.text().slice(0, 200)));
    await page.goto(BASE);
    await sleep(6000);
    await page.evaluate(() => window.__cameraStore.getState().laptop());
    await sleep(4000);
    await dump(page, '点歌前');
    await page.screenshot({ path: 'evidence/probe2_before.png' });

    await page.locator('[data-testid="song-row"]').nth(2).click();
    await sleep(7000);
    await dump(page, '点歌后 7s');
    await page.screenshot({ path: 'evidence/probe2_after.png' });

    // 把面板整体 z-index 抬到非常高层，看是不是被 canvas 盖住（只改截图用，不改源码）
    await page.evaluate(() => {
        const wrap = document.querySelector('.htmlMusicPlayer');
        if (wrap) wrap.style.zIndex = '99999';
        if (wrap && wrap.parentElement) wrap.parentElement.style.zIndex = '99999';
    });
    await sleep(1500);
    await page.screenshot({ path: 'evidence/probe2_after_zfix.png' });
    await dump(page, '抬高 z-index 后');

    await browser.close();
})();
