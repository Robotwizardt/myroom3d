/**
 * 探针17：程序化像素验证（不依赖人眼/模型读图）。
 * 截图后把 PNG 读回页面 canvas 采样像素：
 * 1. DOM 屏内层 div rect 区域的像素亮度 → DOM 内容是否真被看到
 *    （锁屏是深色渐变但有时间白字与滑块，平均亮度应明显高于黑玻璃 #0a0a0c）
 * 2. rect 中心与机身在屏上的投影位置对比
 * 3. rect 外围像素（机身方向）应该是桌子/环境色而非 DOM 内容
 */
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(2500);

    const buf = await page.screenshot();
    fs.writeFileSync('evidence/probe17_pixel_check.png', buf);

    const inner = await page.evaluate(() => {
        const el = document.querySelector('.htmlPhoneScreen > div > div');
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    console.log('innerRect:', JSON.stringify(inner));

    const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
    const analysis = await page.evaluate(async ([url, rect]) => {
        const img = new Image();
        img.src = url;
        await new Promise((res) => (img.onload = res));
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const avg = (x, y, w, h) => {
            const d = ctx.getImageData(
                Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))
            ).data;
            let r = 0, g = 0, b = 0, n = 0;
            for (let i = 0; i < d.length; i += 40) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
            return [r / n | 0, g / n | 0, b / n | 0];
        };
        const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        return {
            domCenter: avg(cx, cy, 30, 30),
            domTopQuarter: avg(rect.x + rect.w * 0.2, rect.y + rect.h * 0.25, 40, 40),
            domBottomQuarter: avg(rect.x + rect.w * 0.2, rect.y + rect.h * 0.75, 40, 40),
            aboveRect: avg(cx - 15, Math.max(0, rect.y - 40), 30, 30),
            belowRect: avg(cx - 15, Math.min(img.height - 30, rect.y + rect.h + 40), 30, 30),
            leftOfRect: avg(Math.max(0, rect.x - 40), cy - 15, 30, 30),
            rightOfRect: avg(Math.min(img.width - 30, rect.x + rect.w + 40), cy - 15, 30, 30),
            blackGlassRef: [10, 10, 12]
        };
    }, [dataUrl, inner]);
    console.log('像素分析:', JSON.stringify(analysis, null, 1));
    await browser.close();
})();
