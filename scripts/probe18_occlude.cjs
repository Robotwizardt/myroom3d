/**
 * 探针18：诊断 DOM 屏被 canvas 挡住的原因。
 * 1. .htmlPhoneScreen wrapper 的 display/zIndex
 * 2. 外层 transform 容器的 style.transform（含 getCameraCSSMatrix → 相机位姿）
 * 3. 场景里找 occlusion mesh（fragmentShader 输出全透明的 mesh），
 *    查它的世界坐标 / scale / visible
 */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(2500);

    const domInfo = await page.evaluate(() => {
        const wrap = document.querySelector('.htmlPhoneScreen');
        if (!wrap) return { err: 'no wrapper' };
        const cs = getComputedStyle(wrap);
        const outer = wrap.parentElement; // transform 外层
        const outerCs = outer ? getComputedStyle(outer) : null;
        return {
            wrapDisplay: cs.display,
            wrapZ: cs.zIndex,
            wrapPos: cs.position,
            outerTag: outer ? outer.tagName + '.' + outer.className : null,
            outerTransform: outerCs ? outerCs.transform.slice(0, 200) : null,
            outerZ: outerCs ? outerCs.zIndex : null,
            canvasZ: (() => {
                const c = document.querySelector('canvas');
                return c ? getComputedStyle(c).zIndex : null;
            })()
        };
    });
    console.log('DOM 结构:', JSON.stringify(domInfo, null, 1));

    const meshInfo = await page.evaluate(() => {
        const scene = window.__SCENE__;
        const found = [];
        scene.traverse((o) => {
            if (o.isMesh && o.material && o.material.isShaderMaterial &&
                /vec4\(0\.0, 0\.0, 0\.0, 0\.0\)/.test(o.material.fragmentShader || '')) {
                const wp = o.getWorldPosition(new (o.position.constructor)());
                found.push({
                    world: [wp.x.toFixed(3), wp.y.toFixed(3), wp.z.toFixed(3)],
                    scale: [o.scale.x.toFixed(3), o.scale.y.toFixed(3), o.scale.z.toFixed(3)],
                    visible: o.visible,
                    quaternion: o.quaternion.toArray().map((v) => +v.toFixed(3))
                });
            }
        });
        return found;
    });
    console.log('occlusion mesh:', JSON.stringify(meshInfo, null, 1));
    await browser.close();
})();
