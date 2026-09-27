// 诊断：锁屏时点机身 Home 键之后，为什么「滑动来解锁」不见了？
// 1) 用和 e2e 一样的方式进特写；2) 打印热区 box；3) 真实鼠标点它；
// 4) 打印点击前后：手机屏文本、锁屏滑条是否还在、相机状态、HOME_EVENT 触发次数。
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5174/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__cameraStore && window.__SCENE__ && window.__ctrl, null, { timeout: 40000 });
    await sleep(6000);

    const phonePoint = await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
        const cam = window.__ctrl.camera || window.__ctrl._camera || window.__ctrl.object;
        const p = new THREE.Vector3(1.6725, -1.6135, -0.7941).project(cam);
        return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
    });
    await page.mouse.click(phonePoint.x, phonePoint.y);
    await page.waitForFunction(() => window.__cameraStore.getState().cameraState === 'smartphone', null, { timeout: 8000 }).catch(() => {});
    await sleep(3500);

    // 统计 HOME_EVENT 触发次数
    await page.evaluate(() => {
        window.__homeCount = 0;
        window.addEventListener('iphone-home', () => (window.__homeCount += 1));
        
    });

    const snap = async (tag) => {
        const info = await page.evaluate(() => {
            const host = document.querySelector('.htmlPhoneScreen');
            const btn = document.querySelector('[data-testid="phone-home-key"]');
            return {
                cam: window.__cameraStore ? window.__cameraStore.getState().cameraState : null,
                hostText: host ? host.textContent.slice(0, 40) : null,
                hasLock: !!document.querySelector('[data-testid="lock-slider"]'),
                btn: btn ? btn.getBoundingClientRect().toJSON() : null,
                btnVisible: btn ? getComputedStyle(btn).visibility + '/' + getComputedStyle(btn).pointerEvents : null,
                hit: btn
                    ? (() => {
                          const r = btn.getBoundingClientRect();
                          const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                          return el ? el.tagName + '#' + el.getAttribute('data-testid') + '.' + el.className : null;
                      })()
                    : null,
                homeCount: window.__homeCount
            };
        });
        console.log(tag, JSON.stringify(info, null, 0));
    };

    await snap('before:');
    const b = await page.locator('[data-testid="phone-home-key"]').boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(900);
    await snap('after :');
    await page.screenshot({ path: 'evidence/probe_homeclick.png' });
    console.log('errors', errs.length, errs.slice(0, 3));
    await browser.close();
})();
