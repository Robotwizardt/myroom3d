/** 下载真机正面参考图（用于像素级比例测量） */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.resolve(__dirname, '../evidence/');
const FILES = {
    'ref_iphone4_front.jpg': 'https://commons.wikimedia.org/wiki/Special:FilePath/IPhone%204%20-%20front.jpg',
    'ref_iphone4s_front.jpg': 'https://commons.wikimedia.org/wiki/Special:FilePath/IPhone%204S%20white%20YsOD.png',
};
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const ctx = await browser.newContext();
    for (const [name, url] of Object.entries(FILES)) {
        try {
            const r = await ctx.request.get(url, { timeout: 60000, headers: { 'User-Agent': 'myroom-replica/1.0 (local research; contact: local)', Accept: 'image/*,*/*' } });
            const body = await r.body();
            fs.writeFileSync(path.join(OUT, name), body);
            console.log(name, r.status(), body.length, 'bytes', r.headers()['content-type']);
        } catch (e) {
            console.log(name, 'FAIL', e.message);
        }
    }
    await browser.close();
})();
