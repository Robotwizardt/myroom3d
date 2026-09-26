/**
 * 网易云音乐 API 封装 —— 对接用户自建服务 NeteaseCloudMusicApiEnhanced。
 * 部署在 http://101.35.40.219:3000 ，浏览器直连可通（无需代理）。
 * 这是老版 NeteaseCloudMusicApi 的返回格式：
 *   /search  → { result: { songs: [{id,name,artists:[{name}],album,duration}] } }
 *   /song/url → { code, data: [{url}] }
 *   /lyric   → { lrc: { lyric: "[mm:ss.xx]歌词\n..." } }
 */
export const API_BASE = 'http://101.35.40.219:3000';

/** 把毫秒时长格式化成 m:ss */
export const formatDuration = (ms) => {
    const total = Math.round((ms || 0) / 1000);
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
};

/** 把一首歌的原始字段整理成播放器要用的形状 */
export const normalizeSong = (raw) => ({
    id: raw.id,
    name: raw.name,
    artist: (raw.artists || []).map((a) => a.name).join('/'),
    duration: formatDuration(raw.duration)
});

/** 关键词搜歌，返回整理好的歌曲数组。失败/无结果返回空数组 */
export const searchSongs = async (keywords, limit = 12) => {
    const res = await fetch(
        `${API_BASE}/search?keywords=${encodeURIComponent(keywords)}&limit=${limit}`
    );
    const json = await res.json();
    const songs = json?.result?.songs || [];
    return songs.map(normalizeSong);
};

/** 拿一首歌的播放地址（mp3 url），拿不到返回 null */
export const getSongUrl = async (id) => {
    const res = await fetch(`${API_BASE}/song/url?id=${id}`);
    const json = await res.json();
    return json?.data?.[0]?.url || null;
};

/**
 * 拿歌词并解析成 [{time:秒, text}] 数组（按时间升序），用于滚动高亮。
 * 解析 LRC 的 [mm:ss.xx] 时间戳；无歌词返回空数组。
 */
export const getLyric = async (id) => {
    const res = await fetch(`${API_BASE}/lyric?id=${id}`);
    const json = await res.json();
    return parseLrc(json?.lrc?.lyric || '');
};

/** 解析 LRC 文本 → [{time, text}]，纯函数便于测试 */
export const parseLrc = (lrc) => {
    if (!lrc) return [];
    const out = [];
    const re = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
    for (const line of lrc.split('\n')) {
        const text = line.replace(re, '').trim();
        if (!text) continue;
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) {
            const time = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
            out.push({ time, text });
        }
    }
    return out.sort((a, b) => a.time - b.time);
};

/** 给定当前播放秒数，返回应高亮的歌词下标（最后一个 time<=current） */
export const activeLyricIndex = (lyrics, current) => {
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= current) idx = i;
        else break;
    }
    return idx;
};
