/** 诊断：smartphone 特写相机到底飞到哪了（旧参数 vs 新参数对照） */
const path = require('path');
const { chromium } = require('playwright');

const shot = (page, name) =>
    page.screenshot({ path: path.resolve(__dirname, `../evidence/${name}.png`) });

const camInfo = (page) =>
    page.evaluate(() => {
        const ctrl = window.__ctrl;
        const cam = ctrl.camera || ctrl._camera || ctrl.object;
        const t = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
        let target = null;
        try {
            const tt = ctrl._target || ctrl.target;
            if (tt && typeof tt.x === 'number') target = { x: tt.x, y: tt.y, z: tt.z };
        } catch (e) {
            target = 'err';
        }
        const d = target
            ? Math.hypot(t.x - target.x, t.y - target.y, t.z - target.z)
            : null;
        return {
            camPos: [t.x.toFixed(3), t.y.toFixed(3), t.z.toFixed(3)],
            target: target
                ? [target.x.toFixed(3), target.y.toFixed(3), target.z.toFixed(3)]
                : target,
            distance: d ? d.toFixed(3) : d,
            ctrlDistance: typeof ctrl.distance === 'number' ? ctrl.distance.toFixed(3) : null,
            fov: cam.fov,
            state: window.__cameraStore.getState().cameraState
        };
    });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore && window.__ctrl, null, {
        timeout: 40000
    });
    await page.waitForTimeout(3500);

    // 旧参数（上一轮验证通过的那组）
    await page.evaluate(() => {
        const s = window.__cameraStore.getState();
        s.smartphone();
    });
    await page.waitForTimeout(3000);
    console.log('AFTER smartphonestate()', JSON.stringify(await camInfo(page)));
    await shot(page, 'cam_new');

    await page.evaluate(() => {
        window.__ctrl.setLookAt(2.24, -0.3453, -1.55, 1.6725, -1.6135, -0.7941, false);
    });
    await page.waitForTimeout(1500);
    console.log('OLD setLookAt', JSON.stringify(await camInfo(page)));
    await shot(page, 'cam_old');

    await page.evaluate(() => {
        window.__ctrl.setLookAt(2.0314, -0.8116, -1.2721, 1.6725, -1.6135, -0.7941, false);
    });
    await page.waitForTimeout(1500);
    console.log('NEW setLookAt', JSON.stringify(await camInfo(page)));
    await shot(page, 'cam_new2');
    await browser.close();
})();
