// 探针13：从 DOM wrapper 的 matrix3d 反推屏幕的世界朝向和尺寸
// - wrapper div 的 CSS transform matrix3d 列向量 = div 局部轴在"祖先坐标系"的方向
// - 内层 392x809 屏 div 的 getBoundingClientRect + 旋转角 → 视口内可见尺寸
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:5173');
    await sleep(6000);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await sleep(3500);

    const info = await page.evaluate(() => {
        const wrap = document.querySelector('.htmlPhoneScreen');
        if (!wrap) return { err: 'no wrapper' };
        // wrapper 本身 transform:none —— matrix3d 在更内层的 div 上（Html 组件生成的结构：
        // wrapper > div(style=transform:matrix3d...)）。找带 matrix3d 的那层。
        let tf = 'none';
        let tfEl = null;
        [wrap, ...wrap.querySelectorAll('div')].forEach((d) => {
            const t = getComputedStyle(d).transform;
            if (t && t.startsWith('matrix3d') && !tfEl) { tfEl = d; tf = t; }
        });
        // 找 392x809 的内层屏
        let screenEl = null;
        wrap.querySelectorAll('div').forEach((d) => {
            if (!screenEl && d.style.width === '392px' && d.style.height === '809px') screenEl = d;
        });
        const r = screenEl ? screenEl.getBoundingClientRect() : null;
        return {
            transform: tf,
            wrapRect: {
                x: Math.round(wrap.getBoundingClientRect().x),
                y: Math.round(wrap.getBoundingClientRect().y),
                w: Math.round(wrap.getBoundingClientRect().width),
                h: Math.round(wrap.getBoundingClientRect().height)
            },
            screenRect: r && {
                x: Math.round(r.x), y: Math.round(r.y),
                w: Math.round(r.width), h: Math.round(r.height)
            }
        };
    });
    console.log(JSON.stringify(info, null, 1));
    await browser.close();
})();
