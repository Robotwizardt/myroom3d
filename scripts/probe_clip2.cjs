/**
 * 实验：给房间 ShaderMaterial 打 shader 补丁——世界坐标落在「原绿壳盒」内的片元直接 discard。
 * 目的：判断绿壳下面桌子是否完好（会不会出洞）。纯运行时，不改源码。
 */
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

    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/clip2_before_smartphone.png') });

    const n = await page.evaluate((BOX) => {
        const scene = window.__SCENE__;
        let n = 0;
        scene.traverse((o) => {
            if (!(o.isMesh && o.material && o.material.isShaderMaterial)) return;
            const mat = o.material;
            if (mat.userData.__clipped) return;
            mat.userData.__clipped = true;
            const min = BOX.mn.join(', '), max = BOX.mx.join(', ');
            mat.onBeforeCompile = (shader) => {
                shader.vertexShader = shader.vertexShader
                    .replace('varying vec2 vUv;', 'varying vec2 vUv;\nvarying vec3 vWPos;')
                    .replace('vUv = uv;', 'vUv = uv;\n    vWPos = modelPosition.xyz;');
                shader.fragmentShader = shader.fragmentShader.replace(
                    'varying vec2 vUv;',
                    `varying vec2 vUv;\nvarying vec3 vWPos;\nconst vec3 CLIP_MIN = vec3(${min});\nconst vec3 CLIP_MAX = vec3(${max});`
                ).replace(
                    'void main(){',
                    'void main(){\n    if (all(greaterThan(vWPos, CLIP_MIN)) && all(lessThan(vWPos, CLIP_MAX))) discard;'
                );
            };
            mat.needsUpdate = true;
            n++;
        });
        return n;
    }, BOX);
    console.log('已补丁 ShaderMaterial 数:', n);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.resolve(__dirname, '../evidence/clip2_after_smartphone.png') });

    for (const st of ['displayBoard', 'desktop']) {
        await page.evaluate((s) => window.__cameraStore.getState()[s](), st);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.resolve(__dirname, `../evidence/clip2_after_${st}.png`) });
    }
    console.log('已保存 4 张：before/after smartphone + after displayBoard/desktop');
    await browser.close();
})();
