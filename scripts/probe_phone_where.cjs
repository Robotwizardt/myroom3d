/** 诊断：机身还在不在原位？从正上方俯视手机 + 列出手机附近 mesh */
const path = require('path');
const { chromium } = require('playwright');

const shot = (page, name) =>
    page.screenshot({ path: path.resolve(__dirname, `../evidence/${name}.png`) });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore && window.__ctrl, null, {
        timeout: 40000
    });
    await page.waitForTimeout(5000);
    console.log(
        'DEFAULT view',
        JSON.stringify(
            await page.evaluate(() => {
                const cam = window.__ctrl.camera;
                return {
                    camPos: [cam.position.x, cam.position.y, cam.position.z].map((v) => +v.toFixed(3)),
                    state: window.__cameraStore.getState().cameraState
                };
            })
        )
    );
    await shot(page, 'diag_default');

    // 手机附近有哪些 mesh（含 <IPhone4SBody> 的件）
    const near = await page.evaluate(() => {
        const out = [];
        const P = { x: 1.6725, y: -1.6135, z: -0.7941 };
        window.__SCENE__.traverse((o) => {
            if (!o.isMesh || !o.geometry) return;
            const g = o.geometry;
            g.computeBoundingBox();
            const bb = g.boundingBox.clone();
            const ctr = bb.getCenter(new bb.min.constructor()).applyMatrix4(o.matrixWorld);
            const d = Math.hypot(ctr.x - P.x, ctr.y - P.y, ctr.z - P.z);
            if (d < 0.6) {
                out.push({
                    name: o.name || '(anon)',
                    type: g.type,
                    color:
                        o.material && o.material.color ? '#' + o.material.color.getHexString() : '-',
                    visible: o.visible,
                    ctr: [ctr.x, ctr.y, ctr.z].map((v) => +v.toFixed(3)),
                    dist: +d.toFixed(3)
                });
            }
        });
        return out.sort((a, b) => a.dist - b.dist);
    });
    console.log('MESHES_NEAR_PHONE', JSON.stringify(near, null, 1).slice(0, 2600));

    // 相机移到手机正上方（纯三轴对齐，方便看机身是否在原位）
    await page.evaluate(() => {
        window.__cameraStore.getState().smartphone();
    });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
        window.__ctrl.setLookAt(1.6725, -0.85, -0.7941, 1.6725, -1.6135, -0.7941, false);
    });
    await page.waitForTimeout(1500);
    await shot(page, 'diag_topdown');
    await browser.close();
})();
