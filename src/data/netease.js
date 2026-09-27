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

/**
 * 把接口给的图片地址统一成 https（见 ADR-0002）：
 * 接口返回的专辑封面是 http 链接，部署到 https 站点时会被浏览器当混合内容拦掉。
 * 空值/非字符串一律返回空串，界面据此显示封面占位块。
 */
export const toHttps = (url) => {
    if (typeof url !== 'string' || !url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`;
    return url;
};

/**
 * 封面在界面上的两处用法对应的 CDN 档位（ADR-0002：URL 归一化与尺寸只在这里定，
 * 界面层只调 albumArtUrl(url, ART_SIZE.xxx)，换尺寸不用改 jsx）。
 * 行内小图 72 对应 36px 显示框（2x 屏），转盘中心 256 对应 100px 圆。
 */
export const ART_SIZE = { row: '72y72', disc: '256y256' };

/**
 * 拼上网易云 CDN 的缩放参数（`?param=72y72`），size 省略则返回原图。
 * 实测 `?param=120y120` 能把单张封面从 3955B 降到 1968B。
 */
export const albumArtUrl = (url, size) => {
    const base = toHttps(url);
    if (!base || !size) return base;
    return `${base}${base.includes('?') ? '&' : '?'}param=${size}`;
};

/** 把一首歌的原始字段整理成播放器要用的形状（/search 老格式：artists/duration） */
export const normalizeSong = (raw) => ({
    id: raw.id,
    name: raw.name,
    artist: (raw.artists || []).map((a) => a.name).join('/'),
    duration: formatDuration(raw.duration)
});

/**
 * 把歌单里的曲目（/playlist/detail 新格式：ar/dt/al）整理成统一形状。
 * 歌单接口的歌手字段叫 ar、时长叫 dt（毫秒）、专辑封面在 al.picUrl ——
 * 和 /search 的 artists/duration 不同，实测自建 API 返回结构如此。
 */
export const normalizeTrack = (raw) => ({
    id: raw.id,
    name: raw.name,
    artist: (raw.ar || []).map((a) => a.name).join('/'),
    duration: formatDuration(raw.dt),
    picUrl: toHttps(raw?.al?.picUrl)
});

/** 拿个性化推荐歌单列表，返回第一个歌单的 id（作为默认歌单） */
export const getDefaultPlaylistId = async () => {
    const res = await fetch(`${API_BASE}/personalized?limit=1`);
    const json = await res.json();
    const first = json?.result?.[0];
    return first ? first.id : null;
};

/**
 * 拉取某个歌单的详情，返回 { name, tracks, coverImgUrl }：
 *   name         歌单名
 *   tracks       整理好的曲目数组 [{id,name,artist,duration,picUrl}]
 *   coverImgUrl  歌单封面（https，没有时为空串）—— 没选歌时转盘中心的兜底图
 * 网络失败会抛错，由调用方提示用户。
 */
export const getPlaylistTracks = async (playlistId) => {
    const res = await fetch(`${API_BASE}/playlist/detail?id=${playlistId}`);
    const json = await res.json();
    const playlist = json?.playlist;
    if (!playlist) throw new Error('歌单信息拿不到');
    return {
        name: playlist.name,
        coverImgUrl: toHttps(playlist.coverImgUrl),
        tracks: (playlist.tracks || []).map(normalizeTrack)
    };
};

/** 关键词搜歌，返回整理好的歌曲数组。失败/无结果返回空数组（保留给搜索场景备用） */
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
