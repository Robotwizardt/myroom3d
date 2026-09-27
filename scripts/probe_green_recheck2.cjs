/**
 * 绿色复查 v2：page.screenshot → PNG.sync 解码 → 真实像素扫描。
 * （canvas drawImage 对 WebGL 无 preserveDrawingBuffer 是全黑假阴性，已弃用）
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { PNG } = require('C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules/playwright-core/lib/utilsBundle.js');

const URL = 'http://localhost:5174/';

function scanGreen(buf, label) {
    const png = PNG.sync.read(buf);
    const { width, height, data } = png;
    const hits = [];
    let n = 0;
    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (g > 70 && g > r * 1.2 && g > b * 1.2) {
                n++;
                if (hits.length < 15) hits.push([x, y, r, g, b]);
            }
        }
    }
    console.log(`[green ${label}] ${width}x${height}: ${n} 点`);
    hits.forEach((h) => console.log(`   [${h[0]},${h[1]}] rgb(${h[2]},${h[3]},${h[4]})`));
    return n;
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 30000 });
    await page.waitForTimeout(2500);

    let total = 0;
    total += scanGreen(await page.screenshot(), '默认视角 t0');
    await page.waitForTimeout(1500);
    total += scanGreen(await page.screenshot(), '默认 t+1.5s');
    await page.waitForTimeout(1500);
    total += scanGreen(await page.screenshot(), '默认 t+3s');

    await page.screenshot({ path: path.resolve(__dirname, '../evidence/green_check_default.png') });

    // 手机特写
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(3000);
    total += scanGreen(await page.screenshot(), '手机特写 t0');
    await page.waitForTimeout(1500);
    total += scanGreen(await page.screenshot(), '手机特写 t+1.5s');
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/green_check_closeup.png') });

    console.log('控制台错误:', errors.length ? errors.join(' | ') : '(0)');
    console.log(`\n结论: 绿像素合计 ${total}${total === 0 ? ' ✓' : ' ✗ 仍有绿色'}`);
    await browser.close();
})();
