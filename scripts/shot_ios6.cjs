/** iOS 6 UI 目视检查截图：默认全景 / 手机特写锁屏 / 解锁后主屏 */
const path = require('path');
const { chromium } = require('playwright');

const shot = (page, name) =>
    page.screenshot({ path: path.resolve(__dirname, `../evidence/${name}.png`) });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, {
        timeout: 40000
    });
    await page.waitForTimeout(4000);
    await shot(page, 'ios6_default');

    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    await shot(page, 'ios6_lock');

    // UI 根 + 滑条的实际渲染尺寸
    const info = await page.evaluate(() => {
        const root = document.querySelector('.htmlPhoneScreen');
        const inner = root && root.firstElementChild;
        const slider = document.querySelector('[data-testid="lock-slider"]');
        const r = (el) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return {
                x: Math.round(b.x),
                y: Math.round(b.y),
                w: Math.round(b.width),
                h: Math.round(b.height)
            };
        };
        return {
            wrapper: r(root),
            inner: r(inner),
            slider: r(slider),
            sliderOffsetW: slider ? slider.offsetWidth : null,
            phoneStyle: slider
                ? getComputedStyle(slider.parentElement.parentElement).width
                : null
        };
    });
    console.log('SIZES', JSON.stringify(info));

    // 只拖「看得见的那段」：从滑条左端到右端（真人能做的最大动作）
    const s = info.slider;
    if (s) {
        await page.mouse.move(s.x + 6, s.y + s.h / 2);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(s.x + 6 + ((s.w - 12) * i) / 12, s.y + s.h / 2, { steps: 2 });
            await page.waitForTimeout(20);
        }
        await page.mouse.up();
    }
    await page.waitForTimeout(1500);
    await shot(page, 'ios6_home');
    const stillLocked = await page.evaluate(
        () => !!document.querySelector('[data-testid="lock-slider"]')
    );
    console.log('STILL_LOCKED_AFTER_VISIBLE_DRAG', stillLocked);
    console.log('CONSOLE_ERRORS', errors.length, errors.slice(0, 3));
    await browser.close();
})();
