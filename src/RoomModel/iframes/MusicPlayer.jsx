/* eslint-disable react/display-name */
import { Html } from '@react-three/drei';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    activeLyricIndex,
    getDefaultPlaylistId,
    getLyric,
    getPlaylistTracks,
    getSongUrl
} from '../../data/netease';
import { useCameraStore } from '../../helper/CameraStore';

/**
 * 网易云音乐播放器 —— 焊在笔记本屏幕里（<Html transform>，同 GBA 模拟器做法）。
 * 布局：左边真实歌单曲目列表，右边当前歌的歌词。
 * 数据来自用户自建的 NeteaseCloudMusicApiEnhanced（见 src/data/netease.js）。
 * 不自动播放：进来只是把歌单列出来，点了哪首才播哪首。
 */
const MusicPlayer = React.memo(() => {
    const cameraState = useCameraStore((state) => state.cameraState);
    const isLaptop = useMemo(() => cameraState === 'laptop', [cameraState]);

    // Html transform 把 DOM 焊进笔记本屏幕平面，参数说明见 git 历史（屏幕基拟合）：
    //   position/rotation 是父级空间坐标；distanceFactor 0.585 + wrap 700x400 ≈ 铺满屏幕。
    return (
        <group>
            {isLaptop && (
                <Html
                    transform
                    wrapperClass="htmlMusicPlayer"
                    distanceFactor={0.585}
                    position={[0.26532, 2.37605, 3.20977]}
                    rotation={[-2.86114, 0.9649, 2.90937]}
                    zIndexRange={[3, 1]}
                >
                    <PlayerPanel />
                </Html>
            )}
        </group>
    );
});

const PlayerPanel = () => {
    const [playlistName, setPlaylistName] = useState('');
    const [songs, setSongs] = useState([]); // 歌单曲目 [{id,name,artist,duration,picUrl}]
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [current, setCurrent] = useState(null); // 当前播的歌
    const [playing, setPlaying] = useState(false);
    const [lyrics, setLyrics] = useState([]);
    const [time, setTime] = useState(0);
    const audioRef = useRef(null);
    const lyricBoxRef = useRef(null);

    // 进面板就拉默认歌单（不播放任何东西）
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const pid = await getDefaultPlaylistId();
                if (!pid) throw new Error('拿不到推荐歌单');
                const detail = await getPlaylistTracks(pid);
                if (!alive) return;
                setPlaylistName(detail.name);
                setSongs(detail.tracks);
            } catch (e) {
                if (alive) setError('歌单加载失败：' + e.message);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const playSong = useCallback(async (song) => {
        setError('');
        try {
            const url = await getSongUrl(song.id);
            if (!url) {
                setError('这首歌拿不到播放地址');
                return;
            }
            const audio = audioRef.current;
            audio.src = url;
            setCurrent(song);
            setTime(0);
            setLyrics([]);
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
        if (playing) {
            audio.pause();
            setPlaying(false);
        } else {
            audio.play();
            setPlaying(true);
        }
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
        // 根 div 拦截指针事件冒泡：不让点击穿透到 canvas 的 raycast，
        // 否则会误触底下 3D mesh（比如误点到显示器导致镜头乱跳）。
        <div
            style={S.wrap}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div style={S.header}>
                <span>☁️ {playlistName || '网易云音乐'}</span>
                {current && (
                    <button style={S.playBtn} onClick={togglePlay}>
                        {playing ? '⏸' : '▶'}
                    </button>
                )}
            </div>
            {error && <div style={S.error}>{error}</div>}

            <div style={S.body}>
                {/* 左：歌单曲目 */}
                <div style={S.list}>
                    {loading && <div style={S.hint}>歌单加载中…</div>}
                    {songs.map((s, i) => (
                        <div
                            key={s.id}
                            style={{
                                ...S.songRow,
                                background:
                                    current && current.id === s.id
                                        ? 'rgba(255,114,54,0.22)'
                                        : 'transparent'
                            }}
                            onClick={() => playSong(s)}
                        >
                            <span style={S.songIdx}>{i + 1}</span>
                            <div style={S.songText}>
                                <div style={S.songName}>{s.name}</div>
                                <div style={S.songMeta}>
                                    {s.artist} · {s.duration}
                                </div>
                            </div>
                        </div>
                    ))}
                    {!loading && songs.length === 0 && !error && (
                        <div style={S.hint}>歌单是空的</div>
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
                                    color:
                                        i === activeIdx
                                            ? '#ff8b5e'
                                            : 'rgba(255,255,255,0.45)',
                                    fontWeight: i === activeIdx ? 700 : 400
                                }}
                            >
                                {l.text}
                            </div>
                        ))
                    ) : (
                        <div style={S.hint}>
                            {current ? '歌词加载中…' : '点左边一首歌开始听'}
                        </div>
                    )}
                </div>
            </div>

            {/* 真正发声的隐藏 audio 元素 */}
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
        width: 700,
        height: 400,
        background: 'rgba(16,10,29,0.97)',
        borderRadius: 10,
        color: '#fff',
        fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: 12,
        boxSizing: 'border-box',
        overflow: 'hidden'
    },
    header: {
        fontSize: 15,
        fontWeight: 700,
        color: '#ff7236',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        whiteSpace: 'nowrap',
        overflow: 'hidden'
    },
    playBtn: {
        width: 30,
        height: 30,
        borderRadius: '50%',
        border: 'none',
        background: '#ff7236',
        color: '#fff',
        fontSize: 13,
        cursor: 'pointer',
        flexShrink: 0
    },
    error: { color: '#ff8080', fontSize: 12, marginBottom: 6 },
    body: { flex: 1, display: 'flex', gap: 10, minHeight: 0 },
    list: {
        flex: 1.2,
        overflowY: 'auto',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 6,
        padding: 4
    },
    songRow: {
        padding: '5px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        marginBottom: 2,
        display: 'flex',
        gap: 8,
        alignItems: 'center'
    },
    songIdx: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.35)',
        width: 18,
        textAlign: 'right',
        flexShrink: 0
    },
    songText: { minWidth: 0 },
    songName: {
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    songMeta: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
    lyricBox: {
        flex: 1,
        overflowY: 'auto',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 6,
        padding: 8
    },
    lyricLine: { fontSize: 12, lineHeight: 1.9, transition: 'color 0.2s' },
    hint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'center',
        marginTop: 30
    }
};

export default MusicPlayer;
