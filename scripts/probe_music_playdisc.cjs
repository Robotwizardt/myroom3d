// 诊断：点歌之后播放器面板为什么在截图里消失（相机状态？DOM 被卸载？z-index？）
const { chromium } = require('playwright');

const BASE = 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dump = async (page, tag) => {
    const info = await page.evaluate(() => {
        const panel = document.querySelector('.htmlMusicPlayer');
        const out = { tag: '', cameraState: window.__cameraStore.getState().cameraState };
        out.panelCount = document.querySelectorAll('.htmlMusicPlayer').length;
        if (!panel) return out;
        const cs = getComputedStyle(panel);
        const r = panel.getBoundingClientRect();
        out.panel = {
            rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
            zIndex: cs.zIndex,
            position: cs.position,
            transform: (cs.transform || '').slice(0, 60)
        };
        // 往上找祖先，看看谁被隐藏/改了 z-index
        const chain = [];
        let el = panel;
        for (let i = 0; i < 5 && el; i++) {
            const c = getComputedStyle(el);
            chain.push({
                tag: el.tagName + (el.className ? '.' + String(el.className).slice(0, 30) : ''),
                display: c.display,
                visibility: c.visibility,
                opacity: c.opacity,
                zIndex: c.zIndex,
                position: c.position,
                overflow: c.overflow,
                scrollTop: el.scrollTop,
                scrollLeft: el.scrollLeft,
                scrollH: el.scrollHeight,
                pointerEvents: c.pointerEvents,
                rect: ((r2) => [Math.round(r2.x), Math.round(r2.y), Math.round(r2.width), Math.round(r2.height)])(el.getBoundingClientRect())
            });
            el = el.parentElement;
        }
        out.chain = chain;
        const canvas = document.querySelector('canvas');
        const ccs = canvas ? getComputedStyle(canvas) : null;
        const cr = canvas ? canvas.getBoundingClientRect() : null;
        out.canvas = canvas
            ? {
                  zIndex: ccs.zIndex,
                  position: ccs.position,
                  rect: [Math.round(cr.x), Math.round(cr.y), Math.round(cr.width), Math.round(cr.height)],
                  parentZ: getComputedStyle(canvas.parentElement).zIndex,
                  parentPos: getComputedStyle(canvas.parentElement).position
              }
            : null;
        const mid = [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
        const hit = document.elementFromPoint(mid[0], mid[1]);
        out.hitAtPanelCenter = hit ? hit.tagName + '.' + String(hit.className).slice(0, 40) : null;
        out.scroll = [window.scrollX, window.scrollY, document.documentElement.scrollHeight];
        return out;
    });
    console.log(`\n---- ${tag} ----`);
    console.log(JSON.stringify(info, null, 1));
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
    await page.goto(BASE);
    await sleep(6000);
    await page.evaluate(() => window.__cameraStore.getState().laptop());
    await sleep(4000);
    await dump(page, '进特写后（点歌前）');
    await page.screenshot({ path: 'evidence/probe_before_play.png' });

    await page.locator('[data-testid="song-row"]').nth(2).click();
    await sleep(3000);
    await dump(page, '点歌后 3s');
    await page.screenshot({ path: 'evidence/probe_after_play_3s.png' });

    await sleep(4000);
    await dump(page, '点歌后 7s');
    await page.screenshot({ path: 'evidence/probe_after_play_7s.png' });

    await browser.close();
})();
