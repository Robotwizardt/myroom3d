// 诊断 v5：一旦发现 disc 跑到屏幕外（y<0），立即深挖整条链的 scroll/transform，
// 并对比「正常态」与「异常态」的差异。
const { chromium } = require('playwright');

const BASE = 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deep = (page) =>
    page.evaluate(() => {
        const chainOf = (node) => {
            const out = [];
            let n = node;
            while (n && n !== document.documentElement) {
                const cs = getComputedStyle(n);
                const r = n.getBoundingClientRect();
                out.push({
                    tag: n.tagName + (n.dataset && n.dataset.testid ? '#' + n.dataset.testid : ''),
                    cls: String(n.className).slice(0, 20),
                    rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
                    scroll: [n.scrollTop, n.scrollLeft, n.scrollHeight, n.clientHeight],
                    overflow: cs.overflow,
                    transform: cs.transform === 'none' ? 'none' : cs.transform.slice(0, 48),
                    animation: cs.animationName
                });
                n = n.parentElement;
            }
            return out;
        };
        const disc = document.querySelector('[data-testid="vinyl-disc"]');
        const lyric = document.querySelector('[data-testid="lyric-box"]');
        const list = document.querySelector('[data-testid="song-row"]');
        return {
            disc: disc ? chainOf(disc) : null,
            listRow: list ? chainOf(list) : null,
            lyricSelf: lyric
                ? { scroll: [lyric.scrollTop, lyric.scrollHeight, lyric.clientHeight], text: lyric.textContent.slice(0, 40) }
                : null
        };
    });

const discY = (page) =>
    page.evaluate(() => {
        const d = document.querySelector('[data-testid="vinyl-disc"]');
        return d ? Math.round(d.getBoundingClientRect().y) : null;
    });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
    await page.goto(BASE);
    await sleep(6000);
    await page.evaluate(() => window.__cameraStore.getState().laptop());
    await sleep(4500);
    await page.locator('[data-testid="song-row"]').nth(2).click();

    let gotNormal = false;
    let gotBad = false;
    for (let i = 0; i < 80 && !(gotNormal && gotBad); i++) {
        await sleep(120);
        const y = await discY(page);
        if (y !== null && y > 0 && !gotNormal) {
            gotNormal = true;
            const d = await deep(page);
            console.log('\n===== 正常态 (discY=' + y + ') =====');
            console.log('disc 链:', JSON.stringify(d.disc, null, 0));
            console.log('lyricSelf:', JSON.stringify(d.lyricSelf));
        }
        if (y !== null && y < 0 && !gotBad) {
            gotBad = true;
            const d = await deep(page);
            console.log('\n===== 异常态 (discY=' + y + ') =====');
            console.log('disc 链:', JSON.stringify(d.disc, null, 0));
            console.log('行链:', JSON.stringify(d.listRow, null, 0));
            console.log('lyricSelf:', JSON.stringify(d.lyricSelf));
            await page.screenshot({ path: 'evidence/jump_bad.png' });
        }
    }
    console.log('\n正常态采样到:', gotNormal, '异常态采样到:', gotBad);
    await browser.close();
})();
