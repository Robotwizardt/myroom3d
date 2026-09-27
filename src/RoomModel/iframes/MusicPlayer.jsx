/* eslint-disable react/display-name */
import { Html } from '@react-three/drei';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    activeLyricIndex,
    albumArtUrl,
    ART_SIZE,
    getDefaultPlaylistId,
    getLyric,
    getPlaylistTracks,
    getSongUrl
} from '../../data/netease';
import { useCameraStore } from '../../helper/CameraStore';
import { scrollLyricBox } from './lyricScroll';
import { AlbumArt, VinylDisc } from './PlayerArt';
import { PlayerScrollbars, VinylKeyframes } from './PlayerStyles';

/**
 * 网易云音乐播放器 —— 焊在笔记本屏幕里（<Html transform>，同 GBA 模拟器做法）。
 * 布局：左边歌单曲目（每行带专辑封面），右边黑胶转盘 + 当前歌的歌词。
 * 封面来源与降级策略见 ADR-0002；转盘/占位块在 ./PlayerArt.jsx。
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
    const [playlistCover, setPlaylistCover] = useState(''); // 歌单封面（没选歌时转盘中心用它兜底）
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
                setPlaylistCover(detail.coverImgUrl || '');
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

    const togglePlay = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;
        if (playing) {
            audio.pause();
            setPlaying(false);
            return;
        }
        try {
            await audio.play();
            setPlaying(true);
        } catch (e) {
            // 比如浏览器拦了自动播放、或音频链接失效 —— 必须 catch，否则 unhandled rejection
            setPlaying(false);
            setError('继续播放失败：' + e.message);
        }
    }, [playing]);

    // 高亮当前歌词并滚动到可见。只滚歌词盒自己 —— 见 lyricScroll.js 里那段警告，
    // 用 scrollIntoView 会把 drei 的 Html 容器一起滚跑（面板整块飞出屏幕）。
    const activeIdx = activeLyricIndex(lyrics, time);
    useEffect(() => {
        scrollLyricBox(lyricBoxRef.current, activeIdx);
    }, [activeIdx]);

    const S = styles;
    // 转盘中心显示的封面：还没选歌就用歌单封面；选中的歌没有封面就交给 AlbumArt 显示占位块
    // （规格 item4：加载失败「或为空」都降级成占位块）。缩到 256 省带宽（ADR-0002）
    const discArt = current ? albumArtUrl(current.picUrl, ART_SIZE.disc) : albumArtUrl(playlistCover, ART_SIZE.disc);
    return (
        // 根 div 拦截指针事件冒泡：不让点击穿透到 canvas 的 raycast，
        // 否则会误触底下 3D mesh（比如误点到显示器导致镜头乱跳）。
        <div
            style={S.wrap}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <VinylKeyframes />
            <PlayerScrollbars />
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
                <div style={S.list} data-testid="song-list">
                    {loading && <div style={S.hint}>歌单加载中…</div>}
                    {songs.map((s, i) => {
                        const isCurrent = !!current && current.id === s.id;
                        return (
                            <div
                                key={s.id}
                                data-testid="song-row"
                                style={{
                                    ...S.songRow,
                                    background: isCurrent
                                        ? 'rgba(255,255,255,0.10)'
                                        : 'transparent'
                                }}
                                onClick={() => playSong(s)}
                            >
                                <AlbumArt
                                    url={albumArtUrl(s.picUrl, ART_SIZE.row)}
                                    size={36}
                                    alt={s.name}
                                    testId="song-art"
                                />
                                {/* 行号位置：正在播的那行换成小喇叭 */}
                                <span style={S.songIdx}>{isCurrent ? '🔊' : i + 1}</span>
                                <div style={S.songText}>
                                    <div
                                        style={{
                                            ...S.songName,
                                            color: isCurrent ? '#fff' : undefined
                                        }}
                                    >
                                        {s.name}
                                    </div>
                                    <div style={S.songMeta}>
                                        {s.artist} · {s.duration}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {!loading && songs.length === 0 && !error && (
                        <div style={S.hint}>歌单是空的</div>
                    )}
                </div>

                {/* 右：黑胶转盘 + 歌词（点转盘切播放/暂停） */}
                <div style={S.rightCol}>
                    <VinylDisc
                        url={discArt}
                        spinning={playing}
                        onToggle={togglePlay}
                        alt={current ? current.name : playlistName}
                    />
                    <div style={S.lyricBox} ref={lyricBoxRef} data-testid="lyric-box">
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
        padding: '6px 8px',
        minHeight: 56,
        boxSizing: 'border-box',
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
    // 右半边：上面黑胶转盘，下面歌词（转盘占 148px，歌词就剩 5~6 行，见 ADR-0002）
    rightCol: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        minHeight: 0
    },
    lyricBox: {
        flex: 1,
        overflowY: 'auto',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 6,
        padding: 8,
        alignSelf: 'stretch',
        minHeight: 0
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
