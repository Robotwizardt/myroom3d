/* eslint-disable react/display-name */
import { Html } from '@react-three/drei';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { activeLyricIndex, getLyric, getSongUrl, searchSongs } from '../../data/netease';
import { useCameraStore } from '../../helper/CameraStore';

/**
 * 网易云音乐播放器 —— 嵌在笔记本屏幕里（<Html> 包一层真实 DOM）。
 * 功能：搜索关键词 → 出歌曲列表 → 点歌播放 → 暂停/进度 → 滚动歌词高亮。
 * 数据来自用户自建的 NeteaseCloudMusicApiEnhanced (见 src/data/netease.js)。
 */
const MusicPlayer = React.memo(() => {
    const cameraState = useCameraStore((state) => state.cameraState);
    const isLaptop = useMemo(() => cameraState === 'laptop', [cameraState]);

    // 不用 transform：用 screen-space Html，播放器以真实 CSS 像素尺寸
    // 钉在笔记本屏幕的世界坐标处，镜头特写时正好盖住那块烘焙出来的假 Spotify 界面。
    // position 是笔记本屏幕中心的世界坐标（按 laptop 镜头视角调出来）。
    return (
        <group>
            {isLaptop && (
                <Html
                    wrapperClass="htmlMusicPlayer"
                    center
                    position={[-2.4, 1.9, 5.18]}
                    zIndexRange={[3, 1]}
                >
                    <PlayerPanel />
                </Html>
            )}
        </group>
    );
});

const PlayerPanel = () => {
    const [query, setQuery] = useState('');
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [current, setCurrent] = useState(null); // 当前播的歌 {id,name,artist}
    const [playing, setPlaying] = useState(false);
    const [lyrics, setLyrics] = useState([]);
    const [time, setTime] = useState(0);
    const audioRef = useRef(null);
    const lyricBoxRef = useRef(null);

    const doSearch = useCallback(async () => {
        const q = query.trim();
        if (!q) return;
        setLoading(true);
        setError('');
        try {
            const list = await searchSongs(q);
            setSongs(list);
            if (list.length === 0) setError('没找到相关歌曲');
        } catch (e) {
            setError('搜索失败：' + e.message);
        } finally {
            setLoading(false);
        }
    }, [query]);

    const playSong = useCallback(async (song) => {
        setError('');
        try {
            const url = await getSongUrl(song.id);
            if (!url) { setError('这首歌拿不到播放地址'); return; }
            const audio = audioRef.current;
            audio.src = url;
            setCurrent(song);
            setTime(0);
            await audio.play();
            setPlaying(true);
            const lrc = await getLyric(song.id);
            setLyrics(lrc);
        } catch (e) {
            setError('播放失败：' + e.message);
        }
    }, []);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;
        if (playing) { audio.pause(); setPlaying(false); }
        else { audio.play(); setPlaying(true); }
    }, [playing]);

    // 高亮当前歌词并滚动到可见
    const activeIdx = activeLyricIndex(lyrics, time);
    useEffect(() => {
        const box = lyricBoxRef.current;
        if (!box || activeIdx < 0) return;
        const el = box.children[activeIdx];
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, [activeIdx]);

    const S = styles;
    return (
        <div style={S.wrap}>
            <div style={S.header}>☁️ 网易云音乐</div>
            <div style={S.searchRow}>
                <input
                    style={S.input}
                    value={query}
                    placeholder="搜歌，比如：周杰伦"
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                />
                <button style={S.btn} onClick={doSearch} disabled={loading}>
                    {loading ? '…' : '搜索'}
                </button>
            </div>
            {error && <div style={S.error}>{error}</div>}

            {/* 正在播放 + 控制 */}
            {current && (
                <div style={S.nowPlaying}>
                    <div style={S.npText}>
                        <div style={S.npName}>{current.name}</div>
                        <div style={S.npArtist}>{current.artist}</div>
                    </div>
                    <button style={S.playBtn} onClick={togglePlay}>
                        {playing ? '⏸' : '▶'}
                    </button>
                </div>
            )}

            <div style={S.body}>
                {/* 左：搜索结果 */}
                <div style={S.list}>
                    {songs.map((s) => (
                        <div
                            key={s.id}
                            style={{
                                ...S.songRow,
                                background:
                                    current && current.id === s.id
                                        ? 'rgba(236,65,65,0.25)'
                                        : 'transparent'
                            }}
                            onClick={() => playSong(s)}
                        >
                            <div style={S.songName}>{s.name}</div>
                            <div style={S.songMeta}>{s.artist} · {s.duration}</div>
                        </div>
                    ))}
                    {songs.length === 0 && !loading && (
                        <div style={S.hint}>输入关键词，搜一首想听的歌</div>
                    )}
                </div>

                {/* 右：歌词 */}
                <div style={S.lyricBox} ref={lyricBoxRef}>
                    {lyrics.length > 0 ? (
                        lyrics.map((l, i) => (
                            <div
                                key={i}
                                style={{
                                    ...S.lyricLine,
                                    color: i === activeIdx ? '#ff5b5b' : 'rgba(255,255,255,0.45)',
                                    fontWeight: i === activeIdx ? 700 : 400
                                }}
                            >
                                {l.text}
                            </div>
                        ))
                    ) : (
                        <div style={S.hint}>{current ? '歌词加载中…' : '播放后显示歌词'}</div>
                    )}
                </div>
            </div>

            {/* 隐藏的 audio 元素：真正发声的是它 */}
            <audio
                ref={audioRef}
                onTimeUpdate={(e) => setTime(e.target.currentTime)}
                onEnded={() => setPlaying(false)}
            />
        </div>
    );
};

// 内联样式，避免引入新的 CSS 文件/依赖
const styles = {
    wrap: {
        width: 560,
        height: 380,
        background: 'rgba(18,18,22,0.96)',
        borderRadius: 10,
        color: '#fff',
        fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: 12,
        boxSizing: 'border-box',
        overflow: 'hidden'
    },
    header: { fontSize: 18, fontWeight: 700, color: '#ec4141', marginBottom: 8 },
    searchRow: { display: 'flex', gap: 8, marginBottom: 8 },
    input: {
        flex: 1,
        padding: '6px 10px',
        borderRadius: 6,
        border: '1px solid #444',
        background: '#232329',
        color: '#fff',
        fontSize: 14,
        outline: 'none'
    },
    btn: {
        padding: '6px 14px',
        borderRadius: 6,
        border: 'none',
        background: '#ec4141',
        color: '#fff',
        fontSize: 14,
        cursor: 'pointer'
    },
    error: { color: '#ff8080', fontSize: 12, marginBottom: 6 },
    nowPlaying: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(236,65,65,0.15)',
        borderRadius: 6,
        padding: '6px 10px',
        marginBottom: 8
    },
    npText: { minWidth: 0 },
    npName: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    npArtist: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
    playBtn: {
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: 'none',
        background: '#ec4141',
        color: '#fff',
        fontSize: 15,
        cursor: 'pointer',
        flexShrink: 0
    },
    body: { flex: 1, display: 'flex', gap: 10, minHeight: 0 },
    list: {
        flex: 1.2,
        overflowY: 'auto',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 6,
        padding: 4
    },
    songRow: { padding: '6px 8px', borderRadius: 4, cursor: 'pointer', marginBottom: 2 },
    songName: { fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    songMeta: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
    lyricBox: {
        flex: 1,
        overflowY: 'auto',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 6,
        padding: 8
    },
    lyricLine: { fontSize: 12, lineHeight: 1.9, transition: 'color 0.2s' },
    hint: { fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 30 }
};

export default MusicPlayer;
