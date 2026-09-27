/**
 * 验证「烘焙旧手机道具」裁剪盒修复：
 *  1) 手机特写里 DOM 屏之外的绿点应为 0
 *  2) 默认视角绿点数量应与修复前一致（≈5143，属原素材显示器绿图+绿植）
 *  3) 裁掉道具后桌面不能出现黑洞
 *  4) 控制台不能有 shader 报错
 */
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules/playwright-core/lib/utilsBundle.js');

const URL = 'http://localhost:5174/';

function decode(buf) {
    return PNG.sync.read(buf);
}

/** 绿点扫描；rect 限定窗口；exclude 排除框（DOM 屏） */
function scanGreen(png, rect, exclude) {
    const { width, data } = png;
    const [x0, y0, x1, y1] = rect;
    const hits = [];
    for (let y = Math.max(0, y0); y < Math.min(png.height, y1); y += 1) {
        for (let x = Math.max(0, x0); x < Math.min(width, x1); x += 1) {
            if (exclude && x >= exclude[0] && x < exclude[2] && y >= exclude[1] && y < exclude[3]) continue;
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (g > 70 && g > r * 1.2 && g > b * 1.2) hits.push([x, y, r, g, b]);
        }
    }
    return hits;
}

function bboxOf(hits) {
    if (!hits.length) return null;
    let mn = [1e9, 1e9], mx = [-1e9, -1e9];
    for (const [x, y] of hits) {
        mn = [Math.min(mn[0], x), Math.min(mn[1], y)];
        mx = [Math.max(mx[0], x), Math.max(mx[1], y)];
    }
    return [...mn, ...mx];
}

/** 深色（鼠标等真道具）像素计数，用来确认没有被裁剪误伤 */
function scanDark(png, rect) {
    const { width, data } = png;
    const [x0, y0, x1, y1] = rect;
    let n = 0;
    for (let y = Math.max(0, y0); y < Math.min(png.height, y1); y += 1) {
        for (let x = Math.max(0, x0); x < Math.min(width, x1); x += 1) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (r < 95 && g < 95 && b < 110) n += 1;
        }
    }
    return n;
}

/** 在页面里开关裁剪（用于 A/B 对照） */
const setCut = (page, on) =>
    page.evaluate((enable) => {
        let n = 0;
        window.__SCENE__.traverse((o) => {
            const u = o.material && o.material.uniforms;
            if (!u || !u.cutHalf) return;
            const m = o.material;
            if (!m.userData.__cutHalf) m.userData.__cutHalf = u.cutHalf.value.clone();
            const orig = m.userData.__cutHalf;
            u.cutHalf.value.copy(enable ? orig : new (orig.constructor)(-1, -1, -1));
            n += 1;
        });
        return n;
    }, on);

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(3500);

    // 1) 默认视角（手机很小，看整体没有变化/没有黑洞）
    const defPng = decode(await page.screenshot());
    const defAll = scanGreen(defPng, [0, 0, defPng.width, defPng.height]);
    console.log(`[默认视角] 全屏绿点 ${defAll.length}（修复前基线 ~5143，属原素材，可不同但应同量级）`);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/cut_default.png') });

    // 2) 手机特写
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3500);

    // DOM 屏矩形（排除掉，屏里有蓝色壁纸，不含绿）
    const domRect = await page.evaluate(() => {
        const el = document.querySelector('.htmlPhoneScreen');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return [Math.round(r.x), Math.round(r.y), Math.round(r.right), Math.round(r.bottom)];
    });
    console.log('DOM 屏矩形:', JSON.stringify(domRect));

    const closePng = decode(await page.screenshot());
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/cut_closeup.png') });
    const area = [420, 140, 900, 720];
    const all = scanGreen(closePng, area);
    const outside = scanGreen(closePng, area, domRect);
    console.log(`[手机特写 ${area.join(',')}] 绿点 ${all.length}；去掉 DOM 屏后 ${outside.length}（修复前 ~5038-5123）`);
    console.log('  绿点 bbox:', JSON.stringify(bboxOf(outside)));
    outside.slice(0, 12).forEach((h) => console.log(`   [${h[0]},${h[1]}] rgb(${h[2]},${h[3]},${h[4]})`));

    // 2b) 鼠标完好性 A/B：裁剪开 / 关，鼠标窗口里的深色像素应基本一致
    const MOUSE = [840, 280, 1120, 520];
    const darkCut = scanDark(closePng, MOUSE);
    await setCut(page, false);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/cut_closeup_nocut.png') });
    const noCutPng = decode(await page.screenshot());
    const darkNoCut = scanDark(noCutPng, MOUSE);
    const greenNoCut = scanGreen(noCutPng, area, domRect);
    await setCut(page, true);
    await page.waitForTimeout(600);
    console.log(`[鼠标完好性] 鼠标窗口深色像素：裁剪开 ${darkCut} / 裁剪关 ${darkNoCut}（差值 ${Math.abs(darkCut - darkNoCut)}）`);
    console.log(`[对照] 同一窗口：裁剪关时绿点 ${greenNoCut.length}，裁剪开时 ${outside.length}`);

    // 4) 低角度侧视（最容易看出道具残留）
    await page.evaluate(() => {
        const ctrl = window.__ctrl;
        const cam = ctrl.camera || ctrl._camera || ctrl.object;
        if (cam) {
            cam.position.set(1.2, -1.05, -0.2);
            cam.lookAt(1.6725, -1.60, -0.7941);
            cam.updateProjectionMatrix();
        }
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/cut_side.png') });

    console.log('\n控制台错误:', errors.length ? errors.join(' | ') : '(0)');
    await browser.close();
})();
