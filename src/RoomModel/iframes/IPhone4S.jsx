/* eslint-disable react/display-name */
/* eslint-disable react/prop-types -- 内部小组件用对象参数，不值得写 propTypes */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    createCalculator,
    dialogFor,
    DOCK_ICONS,
    HOME_ICONS,
    LOCK_DATE,
    LOCK_TIME,
    NOTES
} from '../../data/iphone4s';

/**
 * iPhone 4s 复古模拟器 —— 整个手机屏幕（392x809）。
 *
 * 流程：锁屏（滑动解锁）→ 主屏（16 图标 + Dock 4）→
 *       真 App（时钟/计算器/备忘录）或弹窗彩蛋 → Home 键回主屏。
 *
 * 纯 CSS 拟物（渐变 + 圆角 + 文字符号），零图片素材、零新依赖。
 * 时间一律 9:41（Apple 发布会梗）；只有时钟 App 的秒针在真走。
 *
 * 根节点用 onPointerDown/Up/onClick stopPropagation 拦截事件冒泡，
 * 防止点击穿透到 canvas 的 raycast（误触 3D mesh 导致镜头乱跳）。
 */

// ---------- 各图标的 CSS 画法 ----------
// 返回 {bg, inner}: bg 是图标底板样式，inner 是图标内容（文字/符号组合）

function IconArt({ id }) {
    // 每个图标一个拟物小画，全部用渐变+文字符号拼出来
    const A = {
        messages:
            'linear-gradient(#7ec3f0,#4a90d9)',
        calendar: 'linear-gradient(#fff,#e8e8e8)',
        photos: 'linear-gradient(#fdfdfd,#d8d8d8)',
        camera: 'linear-gradient(#8e9a9f,#5c666b)',
        youtube: 'linear-gradient(#f5f5f5,#e0e0e0)',
        stocks: 'linear-gradient(#2b2b2b,#000)',
        maps: 'linear-gradient(#eef3d8,#cdd8a8)',
        weather: 'linear-gradient(#5db8ff,#2f7fd6)',
        'voice-memos': 'linear-gradient(#3a3a3a,#111)',
        clock: 'linear-gradient(#1a1a1a,#000)',
        calculator: 'linear-gradient(#d0d0d0,#a8a8a8)',
        notes: 'linear-gradient(#f7f0c8,#e8dca0)',
        compass: 'linear-gradient(#2c2c2c,#0a0a0a)',
        settings: 'linear-gradient(#c9c9c9,#9a9a9a)',
        itunes: 'linear-gradient(#ff6f9e,#d94b7d)',
        'app-store': 'linear-gradient(#5ac8fa,#2a8fd8)',
        phone: 'linear-gradient(#8ee07a,#4caf38)',
        mail: 'linear-gradient(#bfe3ff,#7fbdf5)',
        ipod: 'linear-gradient(#ff8f8f,#e05a5a)',
        safari: 'linear-gradient(#e6f4ff,#bfe0ff)'
    };
    const glyphs = {
        messages: '💬',
        calendar: '9日',
        photos: '🌸',
        camera: '📷',
        youtube: '▶',
        stocks: '📈',
        maps: '🗺',
        weather: '☀',
        'voice-memos': '🎙',
        clock: '🕘',
        calculator: '🧮',
        notes: '📝',
        compass: '🧭',
        settings: '⚙',
        itunes: '🎵',
        'app-store': 'A',
        phone: '📞',
        mail: '✉',
        ipod: '♪',
        safari: '🧭'
    };
    // Safari 跟指南针撞了符号，微调
    if (id === 'safari') glyphs[id] = '🌐';
    return (
        <div style={{ ...S.iconTile, background: A[id] || '#888' }}>
            <span style={S.iconGlyph}>{glyphs[id] || '?'}</span>
            {id === 'clock' && <ClockFace tiny />}
        </div>
    );
}

/** 小表盘：给主屏时钟图标用（时分针停 9:41，秒针真走） */
function ClockFace({ tiny }) {
    const [sec, setSec] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setSec((s) => (s + 1) % 60), 1000);
        return () => clearInterval(t);
    }, []);
    const size = tiny ? 30 : 170;
    return (
        <div
            style={{
                ...S.clockDial(tiny),
                position: 'relative',
                width: size,
                height: size,
                borderRadius: '50%'
            }}
        >
            {/* 时针：永停 9:41 → 9 点过 41 分 ≈ 292.5°（360°表盘从12点起） */}
            <Hand w={tiny ? 3 : 6} len={tiny ? 8 : 45} deg={292.5} />
            {/* 分针：永停 41 分 → 246° */}
            <Hand w={tiny ? 2 : 4} len={tiny ? 12 : 70} deg={246} />
            {/* 秒针：真走 */}
            <Hand w={tiny ? 1 : 2} len={tiny ? 13 : 78} deg={sec * 6} sec />
            {/* 中心点 */}
            <div style={S.clockDot(tiny)} />
        </div>
    );
}

function Hand({ w, len, deg, sec }) {
    return (
        <div
            style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: w,
                height: len,
                background: sec ? '#ff9500' : '#fff',
                borderRadius: w,
                transformOrigin: '50% 0%',
                transform: `translate(-50%,0) rotate(${deg}deg)`,
                boxShadow: '0 0 1px rgba(0,0,0,0.8)'
            }}
        />
    );
}

// ---------- 弹窗 ----------
function Dialog({ dialog, onClose }) {
    return (
        <div style={S.dialogMask}>
            <div style={S.dialogBox}>
                <div style={S.dialogTitle}>{dialog.title}</div>
                <div style={S.dialogBody}>{dialog.body}</div>
                <button style={S.dialogBtn} onClick={onClose}>
                    好
                </button>
            </div>
        </div>
    );
}

// ---------- 备忘录 ----------
function NotesApp() {
    const [openIdx, setOpenIdx] = useState(null);
    if (openIdx === null) {
        return (
            <div style={S.appScreen}>
                <div style={S.appTitle}>备忘录</div>
                <div style={S.notesList}>
                    {NOTES.map((n, i) => (
                        <div
                            key={i}
                            style={S.noteRow}
                            onClick={() => setOpenIdx(i)}
                        >
                            <div style={S.noteRowTitle}>{n.title}</div>
                            <div style={S.noteRowBody}>
                                {n.body.slice(0, 24)}…
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    const n = NOTES[openIdx];
    return (
        <div style={S.appScreen}>
            <div style={S.appBar}>
                <span
                    style={S.backLink}
                    onClick={() => setOpenIdx(null)}
                >
                    ‹ 备忘录
                </span>
            </div>
            <div style={S.notePaper}>
                <div style={S.noteDate}>2010年6月8日</div>
                <div style={S.noteTitle}>{n.title}</div>
                <div style={S.noteBody}>{n.body}</div>
            </div>
        </div>
    );
}

// ---------- 计算器 ----------
function CalculatorApp() {
    const calc = useMemo(() => createCalculator(), []);
    const [display, setDisplay] = useState('0');
    const press = useCallback(
        (k) => setDisplay(calc.press(k)),
        [calc]
    );
    const rows = [
        ['C', '±', '%', '÷'],
        ['7', '8', '9', '×'],
        ['4', '5', '6', '-'],
        ['1', '2', '3', '+'],
        ['0', '.', '=']
    ];
    return (
        <div style={{ ...S.appScreen, background: '#111' }}>
            <div style={S.calcDisplay}>{display}</div>
            <div style={S.calcPad}>
                {rows.flat().map((k) => (
                    <button
                        key={k}
                        style={{
                            ...S.calcKey,
                            ...(['+', '-', '×', '÷', '='].includes(k)
                                ? S.calcKeyOp
                                : {}),
                            ...(k === '0' ? S.calcKeyZero : {})
                        }}
                        onClick={() => press(k)}
                    >
                        {k}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---------- 时钟 App ----------
function ClockApp() {
    return (
        <div style={{ ...S.appScreen, background: '#000' }}>
            <div style={S.appTitleLight}>时钟</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClockFace />
            </div>
            <div style={S.clockCaption}>
                永远停在 {LOCK_TIME} —— 发布会时刻
            </div>
        </div>
    );
}

// ---------- 锁屏 ----------
function LockScreen({ onUnlock }) {
    const trackRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const startX = useRef(0);
    const [x, setX] = useState(0);
    // x 的镜像：pointerUp 的闭包里读 state 会拿到旧值（React 批处理还没提交），
    // 用 ref 同步最新拖动位置。
    const xRef = useRef(0);

    const onDown = (e) => {
        setDragging(true);
        startX.current = e.clientX - x;
        e.target.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
        if (!dragging) return;
        const w = trackRef.current?.offsetWidth || 220;
        const dx = Math.max(0, Math.min(w - 56, e.clientX - startX.current));
        setX(dx);
        xRef.current = dx; // 同步到 ref，pointerUp 闭包里能读到最新值
    };
    const onUp = () => {
        console.log("DBG onUp: dragging=", dragging, "xRef=", xRef.current);
        if (!dragging) return;
        setDragging(false);
        const w = trackRef.current?.offsetWidth || 220;
        if (xRef.current > (w - 56) * 0.55) {
            onUnlock(); // 拖过一半 → 解锁
        } else {
            setX(0);
            xRef.current = 0;
        }
    };

    return (
        <div style={S.lock}>
            {/* 状态栏 */}
            <StatusBar />
            <div style={S.lockClock}>{LOCK_TIME}</div>
            <div style={S.lockDate}>{LOCK_DATE}</div>
            <div style={{ flex: 1 }} />
            {/* 解锁滑条 */}
            <div
                ref={trackRef}
                style={S.sliderTrack}
                onPointerDown={onDown}
                onPointerMove={onMove}
            onPointerUp={onUp}
            >
                <div style={{ ...S.sliderKnob, left: x }}>›</div>
            </div>
            <div style={S.lockHint}>滑动来解锁</div>
            <div style={{ height: 46 }} />
        </div>
    );
}

function StatusBar() {
    return (
        <div style={S.statusBar}>
            <span>▪▪▪▪ 中国移动 ▸</span>
            <span style={S.statusTime}>{LOCK_TIME}</span>
            <span>🔋 100%</span>
        </div>
    );
}

// ---------- 主屏 ----------
function HomeScreen({ openApp }) {
    return (
        <div style={S.home}>
            <StatusBar />
            <div style={S.iconGrid}>
                {HOME_ICONS.map((icon) => (
                    <button
                        key={icon.id}
                        style={S.iconBtn}
                        onClick={() => openApp(icon)}
                    >
                        <IconArt id={icon.id} />
                        <span style={S.iconLabel}>{icon.name}</span>
                    </button>
                ))}
            </div>
            <div style={S.dock}>
                {DOCK_ICONS.map((icon) => (
                    <button
                        key={icon.id}
                        style={S.iconBtn}
                        onClick={() => openApp(icon)}
                    >
                        <IconArt id={icon.id} />
                        <span style={S.iconLabel}>{icon.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---------- 主组件 ----------
const IPhone4S = () => {
    const [screen, setScreen] = useState('lock'); // lock | home | app
    const [app, setApp] = useState(null);
    const [dialog, setDialog] = useState(null);

    const unlock = useCallback(() => setScreen('home'), []);

    const openApp = useCallback((icon) => {
        const d = dialogFor(icon);
        if (d) {
            setDialog(d);
            return;
        }
        setApp(icon.id);
        setScreen('app');
    }, []);

    const goHome = useCallback(() => {
        setScreen('home');
        setApp(null);
    }, []);

    const stop = { onPointerDown: (e) => e.stopPropagation(), onPointerUp: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation() };

    return (
        <div style={S.phone} {...stop}>
            {screen === 'lock' && <LockScreen onUnlock={unlock} />}
            {screen === 'home' && <HomeScreen openApp={openApp} />}
            {screen === 'app' && app === 'clock' && <ClockApp />}
            {screen === 'app' && app === 'calculator' && <CalculatorApp />}
            {screen === 'app' && app === 'notes' && <NotesApp />}
            {dialog && <Dialog dialog={dialog} onClose={() => setDialog(null)} />}
            {/* 虚拟 Home 键（锁屏时隐藏，进系统后出现） */}
            {screen !== 'lock' && (
                <button style={S.homeBtn} onClick={goHome} title="Home" />
            )}
        </div>
    );
};

export default IPhone4S;

// ---------- 样式表 ----------
const S = {
    phone: {
        width: 392,
        height: 809,
        borderRadius: 22,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: '"Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
        background: '#000',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        display: 'flex',
        flexDirection: 'column'
    },
    statusBar: {
        height: 26,
        fontSize: 11,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        textShadow: '0 1px 2px rgba(0,0,0,0.7)',
        flexShrink: 0
    },
    statusTime: { fontWeight: 700 },

    // 锁屏
    lock: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background:
            'radial-gradient(ellipse at 30% 20%, #4a7bc0 0%, #23405e 45%, #0d1b2a 100%)',
        padding: '60px 20px 0'
    },
    lockClock: {
        fontSize: 64,
        fontWeight: 200,
        color: '#fff',
        textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        marginTop: 20
    },
    lockDate: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 4,
        marginBottom: 30
    },
    sliderTrack: {
        width: 220,
        height: 44,
        borderRadius: 22,
        background: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.25)',
        position: 'relative',
        cursor: 'grab',
        flexShrink: 0
    },
    sliderKnob: {
        position: 'absolute',
        top: 1,
        left: 0,
        width: 42,
        height: 42,
        borderRadius: '50%',
        background: 'linear-gradient(#fdfdfd,#c8c8c8)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
        color: '#666',
        fontSize: 20,
        textAlign: 'center',
        lineHeight: '42px',
        fontWeight: 700
    },
    lockHint: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 8
    },

    // 主屏
    home: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background:
            'radial-gradient(ellipse at 50% 35%, #3d6db5 0%, #1c3557 50%, #101b2e 100%)',
        padding: '6px 10px 0'
    },
    iconGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '14px 4px',
        paddingTop: 14,
        flex: 1,
        alignContent: 'start'
    },
    iconBtn: {
        background: 'none',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        padding: 0,
        ':active': { filter: 'brightness(0.6)' }
    },
    iconTile: {
        width: 54,
        height: 54,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 5px rgba(0,0,0,0.45)',
        overflow: 'hidden',
        position: 'relative'
    },
    iconGlyph: { fontSize: 26 },
    iconLabel: {
        fontSize: 10,
        color: '#fff',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        whiteSpace: 'nowrap'
    },
    dock: {
        height: 76,
        margin: '6px 4px 0',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        flexShrink: 0
    },

    // 虚拟 Home 键
    homeBtn: {
        position: 'absolute',
        bottom: 4,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: 'linear-gradient(#5a5a5a,#2a2a2a)',
        border: '1px solid #111',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25)',
        cursor: 'pointer',
        zIndex: 50
    },

    // 弹窗
    dialogMask: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 90
    },
    dialogBox: {
        width: 260,
        borderRadius: 12,
        background: 'linear-gradient(#e8e8ec,#c8c8cc)',
        border: '1px solid #999',
        textAlign: 'center',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    },
    dialogTitle: {
        fontSize: 14,
        fontWeight: 700,
        padding: '14px 12px 0',
        color: '#222'
    },
    dialogBody: {
        fontSize: 12,
        color: '#444',
        padding: '6px 14px 14px',
        lineHeight: 1.5
    },
    dialogBtn: {
        width: '100%',
        borderTop: '1px solid #9a9a9a',
        background: 'linear-gradient(#fdfdfd,#d0d0d4)',
        border: 'none',
        padding: '10px 0',
        fontSize: 15,
        color: '#16388a',
        fontWeight: 600,
        cursor: 'pointer'
    },

    // 通用 App 屏
    appScreen: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#f2f2f2',
        color: '#111',
        overflow: 'hidden'
    },
    appTitle: {
        fontSize: 17,
        fontWeight: 700,
        textAlign: 'center',
        padding: '10px 0 4px',
        borderBottom: '1px solid #bbb',
        background: 'linear-gradient(#e8e8e8,#d0d0d0)'
    },
    appTitleLight: {
        fontSize: 17,
        fontWeight: 700,
        textAlign: 'center',
        color: '#fff',
        padding: '10px 0'
    },
    appBar: {
        background: 'linear-gradient(#e8e8e8,#d0d0d0)',
        borderBottom: '1px solid #bbb',
        padding: '8px 10px',
        fontSize: 15
    },
    backLink: { color: '#16388a', fontWeight: 600, cursor: 'pointer' },

    // 备忘录
    notesList: { flex: 1, overflowY: 'auto', background: '#fff' },
    noteRow: {
        padding: '10px 12px',
        borderBottom: '1px solid #e2ddc8',
        cursor: 'pointer'
    },
    noteRowTitle: { fontSize: 15, fontWeight: 700 },
    noteRowBody: { fontSize: 12, color: '#777', marginTop: 2 },
    notePaper: {
        flex: 1,
        background:
            'repeating-linear-gradient(#fdf9e3 0 27px, #f0ead0 27px 28px)',
        padding: '14px 16px',
        overflowY: 'auto'
    },
    noteDate: { fontSize: 11, color: '#a09880', textAlign: 'center' },
    noteTitle: { fontSize: 19, fontWeight: 700, textAlign: 'center', margin: '6px 0 10px' },
    noteBody: { fontSize: 15, lineHeight: '28px' },

    // 计算器
    calcDisplay: {
        fontSize: 56,
        fontWeight: 200,
        color: '#fff',
        textAlign: 'right',
        padding: '24px 18px 10px',
        overflow: 'hidden',
        flexShrink: 0
    },
    calcPad: {
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1,
        background: '#333',
        padding: 1
    },
    calcKey: {
        border: 'none',
        fontSize: 22,
        background: 'linear-gradient(#fafafa,#d8d8d8)',
        color: '#111',
        cursor: 'pointer'
    },
    calcKeyOp: {
        background: 'linear-gradient(#ffae42,#ff8c00)',
        color: '#fff',
        fontSize: 26
    },
    calcKeyZero: { gridColumn: 'span 2' },

    // 时钟
    clockDial: (tiny) => ({
        background: tiny ? 'transparent' : 'radial-gradient(#2a2a2a,#000)',
        border: tiny ? 'none' : '3px solid #444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }),
    clockDot: (tiny) => ({
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: tiny ? 3 : 8,
        height: tiny ? 3 : 8,
        margin: tiny ? '-1.5px' : '-4px',
        borderRadius: '50%',
        background: '#fff'
    }),
    clockCaption: {
        color: '#777',
        fontSize: 12,
        textAlign: 'center',
        padding: '12px 0 18px'
    }
};
