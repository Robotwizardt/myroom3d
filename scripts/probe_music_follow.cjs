// 诊断 v3：点歌后 12 秒里每秒采样「相机位置 + 面板 DOM 的变换矩阵 + 面板 bbox」，
// 判断是「DOM 没跟着相机走（陈旧）」还是「DOM 在正确位置却不画」。
const { chromium } = require('playwright');

const BASE = 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sample = (page) =>
    page.evaluate(() => {
        const wrap = document.querySelector('.htmlMusicPlayer');
        const inner = wrap ? wrap.firstElementChild : null;
        const disc = document.querySelector('[data-testid="vinyl-disc"]');
        const r = disc ? disc.getBoundingClientRect() : null;
        const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const cp = cam ? cam.position.toArray().map((v) => +v.toFixed(3)) : null;
        return {
            cam: cp,
            camDist: cam ? +cam.position.distanceTo(new (cam.position.constructor)(1.6725, -1.6135, -0.7941)).toFixed(3) : null,
            innerT: inner ? inner.style.transform.slice(0, 60) : null,
            outerT: wrap ? wrap.style.transform.slice(0, 60) : null,
            discRect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
            innerOpacity: inner ? getComputedStyle(inner).opacity : null,
            discCount: document.querySelectorAll('[data-testid="vinyl-disc"]').length
        };
    });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
    await page.goto(BASE);
    await sleep(6000);
    await page.evaluate(() => window.__cameraStore.getState().laptop());
    await sleep(4500);
    console.log('进入特写稳定后:', JSON.stringify(await sample(page)));
    await page.screenshot({ path: 'evidence/follow_t0.png' });

    await page.locator('[data-testid="song-row"]').nth(2).click();
    for (let i = 1; i <= 12; i++) {
        await sleep(1000);
        console.log(`t=${i}s`, JSON.stringify(await sample(page)));
        if ([2, 4, 6, 9, 12].includes(i)) await page.screenshot({ path: `evidence/follow_t${i}.png` });
    }
    await browser.close();
})();
