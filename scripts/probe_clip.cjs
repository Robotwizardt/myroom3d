/**
 * 运行时实验：只给房间 ShaderMaterial 挂 6 个裁剪面（盒=原项目烘焙绿壳的范围），
 * 看绿壳是否消失、桌子是否完好（有没有洞）。
 */
const path = require('path');
const { chromium } = require('playwright');
const URL = 'http://localhost:5174/';

const BOX = { mn: [1.60, -1.590, -1.20], mx: [2.03, -1.510, -0.40] };

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 30000 });
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/clip_before.png') });

    const info = await page.evaluate(async (BOX) => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name);
        const threeUrl = urls.find((u) => /three(\.module)?\.js/.test(u));
        const THREE = await import(/* @vite-ignore */ threeUrl);
        const scene = window.__SCENE__;
        let n = 0;
        const planes = [
            new THREE.Plane(new THREE.Vector3(1, 0, 0), -BOX.mn[0]),
            new THREE.Plane(new THREE.Vector3(-1, 0, 0), BOX.mx[0]),
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOX.mn[1]),
            new THREE.Plane(new THREE.Vector3(0, -1, 0), BOX.mx[1]),
            new THREE.Plane(new THREE.Vector3(0, 0, 1), -BOX.mn[2]),
            new THREE.Plane(new THREE.Vector3(0, 0, -1), BOX.mx[2]),
        ];
        scene.traverse((o) => {
            if (o.isMesh && o.material && o.material.isShaderMaterial) {
                o.material.clippingPlanes = planes;
                o.material.needsUpdate = true;
                n++;
            }
        });
        // 开启局部裁剪
        const r3f = document.querySelector('canvas');
        window.__gl = null;
        scene.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial && !window.__gl) window.__gl = o.material; });
        // 通过 material 反查 renderer 不易，直接从 r3f 根 state 取
        return { shaderMatCount: n };
    }, BOX);
    console.log('裁剪面已挂到', info.shaderMatCount, '个 ShaderMaterial');
    console.log('（需要 renderer.localClippingEnabled=true，下面两步都用 evaluate 直接试）');

    // 打开 localClippingEnabled：通过 __r3f 根
    const ok = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        const store = c && c.__r3f && c.__r3f.root ? c.__r3f.root.getState && c.__r3f.root.getState() : null;
        const gl = store && store.gl;
        if (gl) { gl.localClippingEnabled = true; return true; }
        return false;
    });
    console.log('localClippingEnabled:', ok);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/clip_after_smartphone.png') });

    // 侧视：从桌面高度斜看手机，看有没有洞
    await page.evaluate(() => window.__cameraStore.getState().displayBoard());
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
        const ctrl = window.__ctrl;
        if (ctrl && ctrl.setLookAt) ctrl.setLookAt(2.35, -0.85, -1.35, 1.75, -1.57, -0.75, false);
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/clip_after_side.png') });
    console.log('已保存 clip_before / clip_after_smartphone / clip_after_side');

    await browser.close();
})();
