/**
 * 诊断 8（修正版）：不再用"第一个顶点在手机附近"做粗筛（大三角形会被漏掉），
 * 而是遍历全部房间壳三角形，按 uv 判定绿岛，再用「三角形任一顶点世界坐标距手机 <0.6m」筛选，
 * 输出包围盒 + 分簇 + 大三角形尺寸。
 */
const { chromium } = require('playwright');

const URL = 'http://localhost:5174/';

const PAGE_FN = async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name);
    const THREE = await import(urls.find((u) => /three(\.module)?\.js/.test(u)));
    const scene = window.__SCENE__;
    scene.traverse((o) => {
        if (o.material && o.material.uniforms && o.material.uniforms.cutMin) {
            o.material.uniforms.cutMin.value.set(1, 1, 1);
            o.material.uniforms.cutMax.value.set(-1, -1, -1);
        }
    });

    let phoneMesh = null;
    scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.color && !o.material.uniforms && o.material.color.getHexString() === 'c8cacc') phoneMesh = o;
    });
    phoneMesh.updateWorldMatrix(true, false);
    const phoneWorld = phoneMesh.matrixWorld.clone();
    const phoneInv = phoneWorld.clone().invert();
    const pWorld = new THREE.Vector3().setFromMatrixPosition(phoneWorld);
    const frameBox = new THREE.Box3().setFromObject(phoneMesh);

    const greenUV = (u, v) =>
        (u >= 0.575 && u <= 0.610 && v >= 0.010 && v <= 0.168) ||
        (u >= 0.392 && u <= 0.414 && v >= 0.158 && v <= 0.176);

    const sel = [];   // 手机附近的绿三角形（世界顶点）
    let allGreen = 0;
    scene.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.uniforms) return;
        o.updateWorldMatrix(true, false);
        const g = o.geometry, pos = g.attributes.position, uvA = g.attributes.uv, idx = g.index;
        if (!uvA) return;
        const n = idx ? idx.count : pos.count, mw = o.matrixWorld;
        for (let i = 0; i < n; i += 3) {
            const ids = [idx ? idx.getX(i) : i, idx ? idx.getX(i + 1) : i + 1, idx ? idx.getX(i + 2) : i + 2];
            let isG = false;
            for (const ii of ids) {
                const uv = new THREE.Vector2().fromBufferAttribute(uvA, ii);
                if (greenUV(uv.x, uv.y)) { isG = true; break; }
            }
            if (!isG) continue;
            allGreen++;
            const w = ids.map((ii) => new THREE.Vector3().fromBufferAttribute(pos, ii).applyMatrix4(mw));
            const near = w.some((v) => Math.hypot(v.x - pWorld.x, v.z - pWorld.z) < 0.6);
            if (!near) continue;
            sel.push({
                mesh: o.uuid.slice(0, 6),
                world: w.map((v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]),
                local: w.map((v) => { const l = v.clone().applyMatrix4(phoneInv); return [+l.x.toFixed(4), +l.y.toFixed(4), +l.z.toFixed(4)]; })
            });
        }
    });

    const bounds = (arr, key) => {
        let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (const t of arr) for (const v of t[key]) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], v[i]); mx[i] = Math.max(mx[i], v[i]); }
        return { min: mn.map((v) => +v.toFixed(4)), max: mx.map((v) => +v.toFixed(4)), size: mx.map((v, i) => +(v - mn[i]).toFixed(4)) };
    };

    // 三角形尺寸分布（世界最大边长）
    const sizes = sel.map((t) => {
        let m = 0;
        const w = t.world.map((v) => new THREE.Vector3(...v));
        for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) m = Math.max(m, w[a].distanceTo(w[b]));
        return +m.toFixed(3);
    }).sort((a, b) => b - a);

    return {
        phonePos: pWorld.toArray().map((v) => +v.toFixed(4)),
        frameBoxWorld: { min: frameBox.min.toArray().map((v) => +v.toFixed(4)), max: frameBox.max.toArray().map((v) => +v.toFixed(4)) },
        allGreenTris: allGreen,
        selected: sel.length,
        meshIds: [...new Set(sel.map((s) => s.mesh))],
        worldBox: bounds(sel, 'world'),
        localBox: bounds(sel, 'local'),
        biggestTris: sizes.slice(0, 10),
        trisOver5cm: sizes.filter((s) => s > 0.05).length,
        sampleLarge: sel.map((t, i) => ({ i, size: +sizes[i] || 0, world: t.world, local: t.local }))
            .filter((t) => t.size > 0.02).slice(0, 12)
    };
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    console.log(JSON.stringify(await page.evaluate(PAGE_FN), null, 1));
    await browser.close();
})();
