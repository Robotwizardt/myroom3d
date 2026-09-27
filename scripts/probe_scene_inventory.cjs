/** 场景盘点：mesh 数量 + 最大的几个 mesh 的世界位置/尺寸（判断房间/机身是否还在原位） */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.waitForTimeout(6000);

    const info = await page.evaluate(() => {
        const scene = window.__SCENE__;
        const meshes = [];
        let groups = 0;
        scene.traverse((o) => {
            if (o.isGroup) groups++;
            if (!o.isMesh || !o.geometry) return;
            o.geometry.computeBoundingBox();
            const V = o.geometry.boundingBox.min.constructor;
            const ctr = o.geometry.boundingBox.getCenter(new V()).applyMatrix4(o.matrixWorld);
            const size = o.geometry.boundingBox.getSize(new V());
            meshes.push({
                name: o.name || '-',
                type: o.geometry.type,
                color: o.material && o.material.color ? '#' + o.material.color.getHexString() : '-',
                visible: o.visible,
                ctr: [ctr.x, ctr.y, ctr.z].map((v) => +v.toFixed(2)),
                size: [size.x, size.y, size.z].map((v) => +v.toFixed(2))
            });
        });
        meshes.sort((a, b) => b.size[0] * b.size[1] * b.size[2] - a.size[0] * a.size[1] * a.size[2]);
        return {
            meshCount: meshes.length,
            groups,
            top: meshes.slice(0, 12),
            names: meshes.filter((m) => m.name !== '-').map((m) => m.name).slice(0, 40)
        };
    });
    console.log('MESH_COUNT', info.meshCount, 'GROUPS', info.groups);
    console.log('TOP', JSON.stringify(info.top, null, 1));
    console.log('NAMES', JSON.stringify(info.names));
    console.log('ERRORS', JSON.stringify(errs.slice(0, 8), null, 1));
    await browser.close();
})();
