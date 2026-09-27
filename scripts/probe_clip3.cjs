/** 补丁后：默认房间视角 + 低角度侧视（看桌子有没有洞）*/
const path = require('path');
const { chromium } = require('playwright');
const URL = 'http://localhost:5174/';
const BOX = { mn: [1.60, -1.592, -1.20], mx: [2.04, -1.505, -0.40] };

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(9000);
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/clip3_default_before.png') });

    await page.evaluate((BOX) => {
        const scene = window.__SCENE__;
        const min = BOX.mn.join(', '), max = BOX.mx.join(', ');
        scene.traverse((o) => {
            if (!(o.isMesh && o.material && o.material.isShaderMaterial)) return;
            const mat = o.material;
            mat.onBeforeCompile = (shader) => {
                shader.vertexShader = shader.vertexShader
                    .replace('varying vec2 vUv;', 'varying vec2 vUv;\nvarying vec3 vWPos;')
                    .replace('vUv = uv;', 'vUv = uv;\n    vWPos = modelPosition.xyz;');
                shader.fragmentShader = shader.fragmentShader.replace('varying vec2 vUv;',
                    `varying vec2 vUv;\nvarying vec3 vWPos;\nconst vec3 CLIP_MIN = vec3(${min});\nconst vec3 CLIP_MAX = vec3(${max});`
                ).replace('void main(){',
                    'void main(){\n    if (all(greaterThan(vWPos, CLIP_MIN)) && all(lessThan(vWPos, CLIP_MAX))) discard;');
            };
            mat.needsUpdate = true;
        });
    }, BOX);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/clip3_default_after.png') });

    // 低角度侧视：切到 displayBoard（自由视角）后手动摆到桌面高度
    await page.evaluate(() => window.__cameraStore.getState().displayBoard());
    await page.waitForTimeout(4500);
    for (const pos of [[2.6, -1.15, -1.9], [2.45, -1.25, -1.75]]) {
        await page.evaluate((p) => {
            const c = window.__ctrl;
            if (c && c.setLookAt) c.setLookAt(p[0], p[1], p[2], 1.72, -1.56, -0.78, false);
        }, pos);
        await page.waitForTimeout(700);
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/clip3_side_low.png') });
    console.log('saved clip3_default_before/after, clip3_side_low');
    await browser.close();
})();
