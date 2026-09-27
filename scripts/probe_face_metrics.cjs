/**
 * 正面比例核验 v2：相机放到机身正上方拍"产品照"，用像素量机身/显示区比例，
 * 与参考图真机值比对（见 b19 的测量表）：
 *   侧边框合计 / 显示区宽 = 8.73 / 49.87 = 0.1751
 *   上边框 / 显示区高     = 20.2 / 74.8  = 0.2701（显示区上下居中，上下同值）
 *   显示区宽 / 机身宽     = 49.87 / 58.6 = 0.8511
 *   显示区高 / 机身高     = 74.8 / 115.2 = 0.6493
 * 做法：从画面中心 flood fill 出机身轮廓（黑边或蓝屏都算机身），
 * 对轮廓点做 PCA 求长轴方向 θ，再把机身边缘与蓝屏像素都投到 (长轴, 短轴)
 * 坐标系里量长度 —— 这样即使机身在图里是斜的也不影响比例。
 */
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules/playwright-core/lib/utilsBundle.js');

const OUT = (f) => path.resolve(__dirname, '../evidence', f);

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);

    const geom = await page.evaluate(() => {
        const ctrl = window.__ctrl;
        ctrl.minPolarAngle = 0;
        ctrl.maxPolarAngle = Math.PI;
        ctrl.minAzimuthAngle = -Infinity;
        ctrl.maxAzimuthAngle = Infinity;
        // 机身长轴世界方向（绕 Y 55.3°）与中框世界中心
        const axis = { x: 0.569, z: -0.822 };
        const center = { x: 1.6725, y: -1.6135, z: -0.7941 };
        const R = 1.7;
        const pol = 0.012 * Math.PI;
        ctrl.setLookAt(
            center.x - R * Math.sin(pol) * axis.x,
            center.y + R * Math.cos(pol),
            center.z - R * Math.sin(pol) * axis.z,
            center.x,
            center.y,
            center.z,
            false
        );
        ctrl.update();
        const cam = ctrl.camera || ctrl._camera || ctrl.object;
        return { fov: cam.fov, dist: R };
    });
    console.log('相机', geom);
    await page.waitForTimeout(2500);
    const buf = await page.screenshot({ path: OUT('face_metrics_topdown.png') });
    const img = PNG.sync.read(buf);
    const { width: W, height: H, data } = img;

    const isDark = (i) => data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 140;
    const isScreen = (i) => data[i + 2] > data[i] + 15 && data[i + 2] > 60 && data[i + 1] > data[i];
    const cx0 = Math.round(W / 2);
    const cy0 = Math.round(H / 2);

    // flood fill 机身轮廓（从画面中心出发，黑边或蓝屏都算机身）
    const seen = new Uint8Array(W * H);
    const pts = [];
    const stack = [cy0 * W + cx0];
    seen[cy0 * W + cx0] = 1;
    while (stack.length) {
        const p = stack.pop();
        const x = p % W;
        const y = (p - x) / W;
        pts.push([x, y]);
        const nb = [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1]
        ];
        for (const [nx, ny] of nb) {
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const np = ny * W + nx;
            if (seen[np]) continue;
            const i = np * 4;
            if (!isDark(i) && !isScreen(i)) continue;
            seen[np] = 1;
            stack.push(np);
        }
    }

    // PCA 求长轴方向
    let mx = 0;
    let my = 0;
    for (const [x, y] of pts) {
        mx += x;
        my += y;
    }
    mx /= pts.length;
    my /= pts.length;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const [x, y] of pts) {
        const dx = x - mx;
        const dy = y - my;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
    }
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy); // 主轴与 x 轴夹角
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    console.log('轮廓点', pts.length, '中心', mx.toFixed(1), my.toFixed(1), '主轴角(度)', ((theta * 180) / Math.PI).toFixed(1));

    // 机身：投影到 (长轴 u, 短轴 v) 得两个方向的跨度
    const bodyU = [Infinity, -Infinity];
    const bodyV = [Infinity, -Infinity];
    for (const [x, y] of pts) {
        const du = (x - mx) * ux + (y - my) * uy;
        const dv = -(x - mx) * uy + (y - my) * ux;
        bodyU[0] = Math.min(bodyU[0], du);
        bodyU[1] = Math.max(bodyU[1], du);
        bodyV[0] = Math.min(bodyV[0], dv);
        bodyV[1] = Math.max(bodyV[1], dv);
    }

    // 蓝屏像素：同一坐标系下的跨度
    const scrU = [Infinity, -Infinity];
    const scrV = [Infinity, -Infinity];
    let scrCount = 0;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (!isScreen(i)) continue;
            if (!seen[y * W + x]) continue; // 只统计机身轮廓内的蓝屏像素（画面背景偏蓝会误导）
            const du = (x - mx) * ux + (y - my) * uy;
            const dv = -(x - mx) * uy + (y - my) * ux;
            scrU[0] = Math.min(scrU[0], du);
            scrU[1] = Math.max(scrU[1], du);
            scrV[0] = Math.min(scrV[0], dv);
            scrV[1] = Math.max(scrV[1], dv);
            scrCount++;
        }
    }

    const bodyLong = bodyU[1] - bodyU[0];
    const bodyShort = bodyV[1] - bodyV[0];
    const scrLong = scrU[1] - scrU[0];
    const scrShort = scrV[1] - scrV[0];
    const pxPerUnitU = bodyLong / 0.612;
    const pxPerUnitV = bodyShort / 0.3113125;
    console.log('机身长轴', bodyLong.toFixed(0), 'px →', pxPerUnitU.toFixed(0), 'px/单位；短轴', bodyShort.toFixed(0), 'px →', pxPerUnitV.toFixed(0), 'px/单位');
    console.log('蓝屏像素', scrCount, '长', scrLong.toFixed(0), 'px 短', scrShort.toFixed(0), 'px');
    console.log('显示区宽/机身宽   =', (scrShort / bodyShort).toFixed(4), ' 真机 0.8511');
    console.log('显示区高/机身高   =', (scrLong / bodyLong).toFixed(4), ' 真机 0.6493');
    // 上下边框：屏幕短轴中线到机身两端的距离（沿长轴）
    const bodyMidU = (bodyU[0] + bodyU[1]) / 2;
    const scrMidU = (scrU[0] + scrU[1]) / 2;
    const topB = scrU[0] - bodyU[0];
    const botB = bodyU[1] - scrU[1];
    console.log('长轴端点距（应≈相同）：靠近 -u 端', topB.toFixed(0), 'px；+u 端', botB.toFixed(0), 'px');
    console.log('中框偏移比 =', Math.abs((scrMidU - bodyMidU) / scrLong).toFixed(4), '（真机 0 = 显示区居中）');
    console.log('上下边框/显示区高 =', (((topB + botB) / 2) / scrLong).toFixed(4), ' 真机 0.2701；（左+右）/屏宽对比见下）');
    console.log('侧边框合计/显示区宽 =', ((bodyShort - scrShort) / scrShort).toFixed(4), ' 真机 0.1751');
    await browser.close();
})();
