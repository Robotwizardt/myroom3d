/**
 * 绿色复查：修复后（隐藏旧 glb 机身 + 后玻璃 radius 修复）再扫一遍绿像素。
 * 同时列出手机位置附近所有 mesh 及 visible 状态，确认旧机身已藏。
 */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';
const PHONE_POS = [1.6725, -1.5682, -0.7941];
const NODE_PATH_HINT = 'NODE_PATH="C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules"';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => window.__ctrl && window.__ctrl._camera, null, { timeout: 30000 });
    await page.waitForTimeout(2000);

    // ---- 1. 场景遍历：手机 0.45 内 mesh 的 visible / 几何类型 ----
    const near = await page.evaluate((phonePos) => {
        const out = [];
        const scene = window.__ctrl._scene || window.__scene;
        if (!scene) return [{ err: 'no scene' }];
        const V = scene.children[0].position.constructor; // Vector3
        const tmp = new V();
        scene.traverse((o) => {
            if (!o.isMesh || !o.geometry) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const bb = o.geometry.boundingBox;
            const c = bb.getCenter(tmp.clone());
            c.applyMatrix4(o.matrixWorld);
            const d = Math.hypot(c.x - phonePos[0], c.y - phonePos[1], c.z - phonePos[2]);
            if (d > 0.45) return;
            const sz = bb.getSize(tmp.clone());
            const mat = o.material;
            out.push({
                d: +d.toFixed(3),
                visible: o.visible,
                visibleInTree: (() => { let p = o, v = true; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } return v; })(),
                geoType: o.geometry.type,
                size: [+sz.x.toFixed(3), +sz.y.toFixed(3), +sz.z.toFixed(3)],
                color: mat && mat.color ? '#' + mat.color.getHexString() : null,
                hasMap: !!(mat && mat.map),
            });
        });
        out.sort((a, b) => a.d - b.d);
        return out;
    }, PHONE_POS);
    console.log('=== 手机 0.45 内 mesh（修复后） ===');
    near.forEach((m) => console.log(JSON.stringify(m)));

    // ---- 2. 全屏绿像素扫描（默认视角） ----
    async function scanGreen(label) {
        const res = await page.evaluate(() => {
            const c = document.querySelector('canvas');
            const shot = document.createElement('canvas');
            shot.width = c.width; shot.height = c.height;
            const ctx = shot.getContext('2d');
            ctx.drawImage(c, 0, 0);
            const img = ctx.getImageData(0, 0, shot.width, shot.height).data;
            const hits = [];
            let n = 0;
            for (let y = 0; y < shot.height; y += 3) {
                for (let x = 0; x < shot.width; x += 3) {
                    const i = (y * shot.width + x) * 4;
                    const r = img[i], g = img[i + 1], b = img[i + 2];
                    // 明显偏绿且不是亮白/暖色
                    if (g > 80 && g > r * 1.25 && g > b * 1.25) {
                        hits.push([x, y, r, g, b]); n++;
                    }
                }
            }
            return { w: shot.width, h: shot.height, n, hits: hits.slice(0, 20) };
        });
        console.log(`=== 绿像素 [${label}] canvas ${res.w}x${res.h}: ${res.n} 点 ===`);
        res.hits.forEach((h) => console.log(`  [${h[0]},${h[1]}] rgb(${h[2]},${h[3]},${h[4]})`));
        return res;
    }

    const g1 = await scanGreen('默认视角 t0');
    await page.waitForTimeout(1500);
    const g2 = await scanGreen('默认视角 t+1.5s');
    await page.waitForTimeout(1500);
    const g3 = await scanGreen('默认视角 t+3s');

    await page.screenshot({ path: path.resolve(__dirname, '../evidence/green_check_default.png') });

    // ---- 3. 进手机特写再扫一遍（用户说"手机下面"，特写里最明显） ----
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(2500);
    const g4 = await scanGreen('手机特写');
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/green_check_closeup.png') });

    console.log('=== 控制台错误 ===');
    console.log(errors.length ? errors.join('\n') : '(0)');

    const greenTotal = g1.n + g2.n + g3.n + g4.n;
    console.log(`\n结论: 四轮绿像素合计 ${greenTotal}${greenTotal === 0 ? ' ✓ 全部清除' : ' ✗ 仍有绿色'}`);

    await browser.close();
})();
