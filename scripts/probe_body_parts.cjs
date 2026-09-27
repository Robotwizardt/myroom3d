/** 机身零件体检：列出手机机身各 mesh（尺寸/颜色/贴图），并可 A/B 隐藏截图 */
const path = require('path');
const { chromium } = require('playwright');

const OUT = (f) => path.resolve(__dirname, '../evidence', f);

async function loadThree(page) {
    await page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((r) => r.name);
        const u = urls.find((x) => /three(\.module)?\.js/.test(x));
        window.__THREE__ = await import(u);
    });
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__SCENE__ && window.__cameraStore, null, { timeout: 40000 });
    await page.evaluate(() => window.__cameraStore.getState().smartphone());
    await page.waitForTimeout(4000);
    await loadThree(page);

    const info = await page.evaluate(() => {
        const THREE = window.__THREE__;
        const out = [];
        window.__SCENE__.traverse((o) => {
            if (!o.isMesh || !o.__r3f) return;
            const m = Array.isArray(o.material) ? o.material[0] : o.material;
            if (!m) return;
            const bb = new THREE.Box3().setFromObject(o);
            const s = bb.getSize(new THREE.Vector3());
            const c = bb.getCenter(new THREE.Vector3());
            const hex = m.color ? '#' + m.color.getHexString() : null;
            const known = ['#c9cbcd', '#08080a', '#000000', '#b9bbbe', '#15171b'].includes(hex);
            if (!known && !m.map) return;
            out.push({
                geom: o.geometry.type,
                color: hex,
                map: !!m.map,
                basic: m.isMeshBasicMaterial === true,
                met: m.metalness,
                rgh: m.roughness,
                env: !!m.envMap,
                size: [s.x, s.y, s.z].map((v) => +v.toFixed(4)),
                ctr: [c.x, c.y, c.z].map((v) => +v.toFixed(4))
            });
        });
        return out;
    });
    console.log(JSON.stringify(info));

    const variants = [
        ['all', { what: null }],
        ['nohome', { map: true }],
        ['noglass', { color: '#08080a', geom: 'ExtrudeGeometry' }],
        ['noframe', { color: '#c9cbcd' }],
        ['noenv', { what: 'env' }]
    ];
    for (const [name, cfg] of variants) {
        const n = await page.evaluate((cfg) => {
            let cnt = 0;
            window.__SCENE__.traverse((o) => {
                if (!o.isMesh || !o.__r3f) return;
                o.visible = true;
                const m = Array.isArray(o.material) ? o.material[0] : o.material;
                if (!m) return;
                if (cfg.what === 'env') {
                    if (m.envMap) {
                        m.envMap = null;
                        m.needsUpdate = true;
                        cnt++;
                    }
                    return;
                }
                if (!cfg.what) return;
                if (cfg.color && (!m.color || '#' + m.color.getHexString() !== cfg.color)) return;
                if (cfg.geom && o.geometry.type !== cfg.geom) return;
                if (cfg.map && !m.map) return;
                o.visible = false;
                cnt++;
            });
            return cnt;
        }, cfg);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: OUT(`body_parts_${name}.png`) });
        console.log(name, 'touched', n);
    }
    await browser.close();
})();
