/**
 * 诊断 9（可视化）：把所有房间壳材质的输出改成「绿岛 uv → 红，其它 → 蓝」，
 * 再看默认视角 / 手机特写 / 掀掉机身 三种图，直接看出绿岛 uv 到底长在哪些几何上。
 */
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

const DEBUG_FN = async () => {
    const scene = window.__SCENE__;
    const DEBUG = `
    bool gUv = ((vUv.x>=0.575 && vUv.x<=0.610 && vUv.y>=0.010 && vUv.y<=0.168) || (vUv.x>=0.392 && vUv.x<=0.414 && vUv.y>=0.158 && vUv.y<=0.176));
    gl_FragColor = gUv ? vec4(1.0,0.0,0.0,1.0) : vec4(0.05,0.25,0.85,1.0);
`;
    let n = 0;
    scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.cutMin) {
            o.material.onBeforeCompile = (sh) => {
                sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor = vec4(bakedColor, 1.0);', DEBUG);
            };
            o.material.needsUpdate = true;
            n++;
        }
    });
    return n;
};

const HIDE_BODY_FN = () => {
    const scene = window.__SCENE__;
    let n = 0;
    scene.traverse((o) => {
        if (o.isMesh && o.visible && (!o.material || !o.material.uniforms)) {
            let p = o;
            while (p) { if (typeof p.name === 'string' && /iPhone|Phone/i.test(p.name)) break; p = p.parent; }
            // 只在手机附近（1m 内）隐藏非房间壳
            if (p) return;
        }
    });
    // 用世界包围盒判断
    scene.traverse((o) => {
        if (o.isMesh && o.visible && o.geometry && (!o.material || !o.material.uniforms)) {
            o.geometry.computeBoundingBox();
            const c = o.geometry.boundingBox.getCenter(o.geometry.boundingBox.min.clone());
            const d = Math.hypot(c.x - 1.6725, c.z + 0.7941);
            if (d < 0.9 && o.scale.x < 2) { o.visible = false; n++; }
        }
    });
    document.querySelectorAll('.htmlPhoneScreen').forEach((e) => { e.style.display = 'none'; });
    return n;
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(2500);

    const nMat = await page.evaluate(DEBUG_FN);
    console.log('patched materials:', nMat);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'evidence/dbg_greenuv_default.png' });

    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'evidence/dbg_greenuv_smartphone.png' });

    const nHidden = await page.evaluate(HIDE_BODY_FN);
    console.log('hidden body meshes:', nHidden);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'evidence/dbg_greenuv_reveal.png' });

    await browser.close();
})();
