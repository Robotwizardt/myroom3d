/**
 * 掀开手机：隐藏我们自己的 iPhone 机身 + DOM 屏，看原项目在手机位置烘焙进去的到底是什么。
 */
const path = require('path');
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);

    const info = await page.evaluate(() => {
        const scene = window.__SCENE__;
        const phone = [1.6725, -1.5682, -0.7941];
        const hidden = [];
        scene.traverse((o) => {
            if (!o.isMesh) return;
            const m = o.material;
            if (m && m.isShaderMaterial) return; // 保留房间烘焙壳
            const p = o.position.clone();
            if (o.parent) o.parent.localToWorld(p);
            const d = Math.hypot(p.x - phone[0], p.y - phone[1], p.z - phone[2]);
            let size = [0, 0, 0];
            if (o.geometry && o.geometry.computeBoundingBox) {
                o.geometry.computeBoundingBox();
                const bb = o.geometry.boundingBox;
                size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
            }
            if (d < 0.6) {
                hidden.push({
                    d: +d.toFixed(3),
                    size: size.map((v) => +v.toFixed(3)),
                    mat: m && m.type,
                    color: m && m.color ? m.color.getHexString() : null,
                    visible: o.visible,
                });
                o.visible = false;
            }
        });
        document.querySelectorAll('.htmlPhoneScreen').forEach((el) => (el.style.display = 'none'));
        return hidden;
    });

    console.log('隐藏的 mesh（手机 0.6m 内、非 ShaderMaterial）:');
    info.forEach((h, i) => console.log(`  #${i} d=${h.d} size=${h.size} ${h.mat} #${h.color} vis=${h.visible}`));

    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/reveal_plate.png') });
    console.log('已保存 evidence/reveal_plate.png');

    // 顺带：把摄像机抬高一点再看一眼桌面
    await page.evaluate(() => window.__cameraStore.getState().displayBoard());
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
        const ctrl = window.__ctrl;
        ctrl.setLookAt(2.6, 0.2, -1.0, 1.7, -1.55, -0.8, false);
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/reveal_plate_wide.png') });
    console.log('已保存 evidence/reveal_plate_wide.png');

    await browser.close();
})();
