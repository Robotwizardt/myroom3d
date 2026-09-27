/**
 * 裁剪开关 A/B：同一机位拍两张（裁剪开启 / 关闭），用于人工比对
 * "机身轮廓外的黑色小凸块"是不是裁剪挖出的洞。
 */
const path = require('path');
const { chromium } = require('playwright');
const OUT = (f) => path.resolve(__dirname, '../evidence', f);

const CUT_SRC = (on) =>
    `(() => { let n = 0; window.__SCENE__.traverse(o => { const u = o.material && o.material.uniforms; if (u && u.cutHalf) { u.cutHalf.value.set(${on ? '0.335, 0.022, 0.178' : '-1, -1, -1'}); n++; } }); return n; })()`;

(async () => {
    const b = await chromium.launch({ channel: 'msedge', headless: false });
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await p.evaluate(() => window.__cameraStore.getState().smartphone());
    await p.waitForTimeout(4500);
    console.log('cut on  mesh', await p.evaluate(CUT_SRC(true)));
    await p.waitForTimeout(1200);
    await p.screenshot({ path: OUT('cutnow_on.png') });
    console.log('cut off mesh', await p.evaluate(CUT_SRC(false)));
    await p.waitForTimeout(1200);
    await p.screenshot({ path: OUT('cutnow_off.png') });
    await b.close();
})();
