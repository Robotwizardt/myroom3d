// 探测自建网易云 API 的歌单接口字段结构（在真实浏览器里 fetch，绕开 curl SSL 问题）
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage();
    await page.goto('about:blank');

    const probe = async (label, url, pick) => {
        try {
            const data = await page.evaluate(async ({ url, pick }) => {
                const r = await fetch(url);
                const j = await r.json();
                try { return eval(pick); } catch { return '(pick 失败)'; }
            }, { url, pick });
            console.log(`\n===== ${label} =====`);
            console.log(JSON.stringify(data, null, 2).slice(0, 1200));
        } catch (e) {
            console.log(`\n===== ${label} ===== 失败: ${e.message}`);
        }
    };

    await probe('个性化推荐歌单 /personalized', 'http://101.35.40.219:3000/personalized?limit=3',
        `({ n: j.result.length, first: { id: j.result[0].id, name: j.result[0].name, picUrl: j.result[0].picUrl }, keys: Object.keys(j.result[0]) })`);

    await probe('热门歌单 /top/playlist', 'http://101.35.40.219:3000/top/playlist?limit=3',
        `({ n: j.playlists.length, first: { id: j.playlists[0].id, name: j.playlists[0].name }, keys: Object.keys(j.playlists[0]) })`);

    // 先拿一个真实歌单 id，再看 detail 的 tracks 字段
    const pid = await page.evaluate(async () => {
        const r = await fetch('http://101.35.40.219:3000/personalized?limit=1');
        const j = await r.json();
        return j.result[0].id;
    });
    console.log('\n歌单 id =', pid);

    await probe(`歌单详情 /playlist/detail?id=${pid}`, `http://101.35.40.219:3000/playlist/detail?id=${pid}`,
        `({ name: j.playlist.name, n: j.playlist.tracks.length,
            firstTrackKeys: Object.keys(j.playlist.tracks[0]),
            first: {
                id: j.playlist.tracks[0].id,
                name: j.playlist.tracks[0].name,
                ar: j.playlist.tracks[0].ar ? j.playlist.tracks[0].ar.map(a=>a.name) : null,
                artists: j.playlist.tracks[0].artists ? j.playlist.tracks[0].artists.map(a=>a.name) : null,
                dt: j.playlist.tracks[0].dt, duration: j.playlist.tracks[0].duration,
                al: j.playlist.tracks[0].al ? { name: j.playlist.tracks[0].al.name, picUrl: !!j.playlist.tracks[0].al.picUrl } : null
            } })`);

    await browser.close();
})();
