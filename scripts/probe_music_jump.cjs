// 诊断 v4：100ms 采样，抓「DOM 偶发跳到屏幕外」时的完整变换矩阵与相机姿态
const { chromium } = require('playwright');

const BASE = 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sample = (page) =>
    page.evaluate(() => {
        const el = document.querySelector('.htmlMusicPlayer');
        const outer = el ? el.firstElementChild : null;
        const inner = outer ? outer.firstElementChild : null;
        const disc = document.querySelector('[data-testid="vinyl-disc"]');
        const r = disc ? disc.getBoundingClientRect() : null;
        const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const q = cam ? cam.quaternion : null;
        return {
            camPos: cam ? cam.position.toArray().map((v) => +v.toFixed(3)) : null,
            camQuat: q ? [q.x, q.y, q.z, q.w].map((v) => +v.toFixed(5)) : null,
            display: el ? getComputedStyle(el).display : null,
            outer: outer ? outer.style.transform : null,
            innerLen: inner ? inner.style.transform.length : null,
            discY: r ? Math.round(r.y) : null,
            discH: r ? Math.round(r.height) : null
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

    const initial = await sample(page);
    console.log('基线 outer =', initial.outer);
    console.log('基线 cam =', JSON.stringify(initial.camPos), JSON.stringify(initial.camQuat));

    await page.locator('[data-testid="song-row"]').nth(2).click();
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
        await sleep(100);
        const s = await sample(page);
        const key = s.discY + '';
        if (!seen.has(key)) {
            seen.add(key);
            console.log(`#${i} discY=${s.discY} h=${s.discH} display=${s.display}`);
            console.log('   outer =', s.outer);
            console.log('   camPos =', JSON.stringify(s.camPos), 'quat =', JSON.stringify(s.camQuat));
        }
    }
    console.log('出现过的 discY 状态数:', seen.size, [...seen].join(','));
    await browser.close();
})();
