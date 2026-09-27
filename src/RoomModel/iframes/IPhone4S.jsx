/* eslint-disable react/display-name */
/* eslint-disable react/prop-types -- 内部小组件用对象参数，不值得写 propTypes */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    createCalculator,
    dialogFor,
    DOCK_ICONS,
    HOME_EVENT,
    HOME_ICONS,
    LOCK_DATE,
    LOCK_TIME,
    NOTES
} from '../../data/iphone4s';
import { IOS6, springboardCell } from '../../data/ios6';
import { knobX, shouldUnlock, travelWidth } from '../../data/lockSlider';

/**
 * iPhone 4s 屏内 UI —— iOS 6（2012）。
 *
 * 版式尺寸全部来自 data/ios6.js：320×480pt（真机 640×960 @2x）、
 * 20pt 状态栏、4×5 图标网格（57pt 圆角方、列距 80、行距 69）、页码点、玻璃 Dock。
 *
 * 流程：锁屏（滑动解锁）→ 主屏（20 图标 + Dock 4）→ 真 App（时钟/计算器/备忘录）
 *       或弹窗彩蛋（地图「无网络连接」等）→ 机身 Home 键回主屏。
 *
 * 滑动解锁的判定走 data/lockSlider.js 的纯函数：pointer 的 clientX 是「视口 px」，
 * 这里按轨道「渲染宽 / 布局宽」换算回布局 px（屏被 three 缩放，两者不相等）。
 *
 * 纯 CSS 拟物（渐变 + 圆角 + 文字符号），零图片素材、零新依赖；时间一律 9:41。
 * 根节点 stopPropagation，防止点击穿透到 canvas 的 raycast（误触 3D mesh 导致镜头乱跳）。
 */

// ---------- 图标画法（iOS 6 风格的渐变圆角方 + 高光） ----------
const TILES = {
    messages: { bg: 'linear-gradient(#79f079,#12a812)', glyph: '💬' },
    photos: {
        bg: 'radial-gradient(circle at 50% 46%, #fff 0 15%, rgba(255,255,255,0) 16%), conic-gradient(from 20deg, #f7d040, #f28c28, #e8453c, #d0479f, #7c4fb0, #3f76d6, #2aa9d6, #59c05c, #f7d040)'
    },
    stocks: { bg: 'linear-gradient(#3f3f3f,#101010)', glyph: '📈' },
    maps: { bg: 'linear-gradient(#efe8d6,#c9c2ad)', glyph: '🗺' },
    weather: { bg: 'linear-gradient(#6fc0f2,#1b5ea8)', glyph: '☀' },
    passbook: { bg: 'linear-gradient(#9ad9ee,#2f7fb8)', glyph: '💳' },
    notes: { bg: 'linear-gradient(#ffeaa8,#f2c94c)', glyph: '📝' },
    reminders: { bg: 'linear-gradient(#fdfdfd,#d8d8d8)', glyph: '📋' },
    newsstand: { bg: 'linear-gradient(#6d6d6d,#282828)', glyph: '📰' },
    itunes: { bg: 'linear-gradient(#e660c8,#8b2f9c)', glyph: '🎵' },
    'app-store': { bg: 'linear-gradient(#6fd0f7,#1173c9)', glyph: 'A' },
    settings: { bg: 'linear-gradient(#dcdcdc,#949494)', glyph: '⚙' },
    'game-center': { bg: 'linear-gradient(#f8bd76,#c2521f)', glyph: '🎮' },
    videos: { bg: 'linear-gradient(#9c9c9c,#383838)', glyph: '🎬' },
    compass: { bg: 'linear-gradient(#3c3c3c,#080808)', glyph: '🧭' },
    contacts: { bg: 'linear-gradient(#f7f7f7,#c9c9c9)', glyph: '👤' },
    phone: { bg: 'linear-gradient(#8bf08b,#12a512)', glyph: '📞' },
    mail: { bg: 'linear-gradient(#9ad9f7,#1d7ec8)', glyph: '✉' },
    music: { bg: 'linear-gradient(#ff9ad2,#e8265e)', glyph: '♪' }
};

/** 需要自己画的图标（其余用上面的 glyph 文字） */
const SPECIAL = {
    // 日历：iOS 6 的白色日历块 —— 顶部红色星期，下面大号日期
    calendar: (size) => (
        <div style={S.calendarTile(size)}>
            <div style={S.calendarWeek(size)}>周二</div>
            <div style={S.calendarDay(size)}>{LOCK_DATE.match(/(\d+)$/)?.[1] || '8'}</div>
        </div>
    ),
    // 相机：深色机身 + 镜头
    camera: (size) => (
        <div style={S.cameraTile(size)}>
            <div style={S.cameraLens(size)} />
            <div style={S.cameraFlash(size)} />
        </div>
    ),
    // 计算器：深色面板上的迷你键盘
    calculator: (size) => (
        <div style={S.calcTile(size)}>
            <div style={S.calcTileScreen(size)} />
            <div style={S.calcTileKeys(size)}>
                {Array.from({ length: 12 }, (_, i) => (
                    <i key={i} style={S.calcTileKey(size)} />
                ))}
            </div>
        </div>
    ),
    // 时钟：真会走的表盘
    clock: (size) => (
        <ClockFace size={size * 0.92} theme="light" />
    ),
    // Safari：白圈罗盘 + 指针
    safari: (size) => (
        <div style={S.safariTile(size)}>
            <div style={S.safariRing(size)}>
                <div style={S.safariNeedle(size)} />
            </div>
        </div>
    )
};

function IconTile({ id, size }) {
    const art = TILES[id] || { bg: 'linear-gradient(#8f8f8f,#4a4a4a)', glyph: '▪' };
    const draw = SPECIAL[id];
    return (
        <div
            style={{
                ...S.tile,
                width: size,
                height: size,
                borderRadius: size * (IOS6.springboard.iconRadius / IOS6.springboard.iconSize),
                background: art.bg
            }}
        >
            {draw ? (
                draw(size)
            ) : (
                <span style={{ fontSize: size * (id === 'app-store' ? 0.62 : 0.46), lineHeight: 1 }}>
                    {art.glyph}
                </span>
            )}
            {/* iOS 高光 */}
            <span style={S.tileGloss} />
        </div>
    );
}

// ---------- 表盘 ----------
function Hand({ w, len, deg, color, z = 2 }) {
    return (
        <div
            style={{
                position: 'absolute',
                left: '50%',
                bottom: '50%',
                width: w,
                height: len,
                marginLeft: -w / 2,
                background: color,
                borderRadius: w / 2,
                transformOrigin: '50% 100%',
                transform: `rotate(${deg}deg)`,
                zIndex: z
            }}
        />
    );
}

function ClockFace({ size, theme = 'dark' }) {
    const [sec, setSec] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setSec((v) => (v + 1) % 60), 1000);
        return () => clearInterval(t);
    }, []);

    // 9:41 → 时针 290.5°、分针 246°（发布会时刻），秒针真走
    const hourDeg = (9 + 41 / 60) * 30;
    const minDeg = 41 * 6;
    const dark = theme === 'dark';

    return (
        <div
            style={{
                ...S.clockFace,
                width: size,
                height: size,
                background: dark
                    ? 'radial-gradient(circle at 50% 40%, #2e2e2e, #000 75%)'
                    : 'radial-gradient(circle at 50% 35%, #fff, #e2e2e2)',
                border: dark ? '2px solid #3a3a3a' : '2px solid #b8b8b8'
            }}
        >
            {/* 12 个刻度 */}
            {Array.from({ length: 12 }, (_, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: 2,
                        width: i % 3 === 0 ? 2 : 1,
                        height: i % 3 === 0 ? size * 0.075 : size * 0.04,
                        marginLeft: i % 3 === 0 ? -1 : -0.5,
                        background: dark ? '#e8e8e8' : '#333',
                        transformOrigin: `50% ${size / 2 - 2}px`,
                        transform: `rotate(${i * 30}deg)`,
                        borderRadius: 1
                    }}
                />
            ))}
            <Hand w={size * 0.045} len={size * 0.26} deg={hourDeg} color={dark ? '#fff' : '#111'} />
            <Hand w={size * 0.035} len={size * 0.36} deg={minDeg} color={dark ? '#fff' : '#111'} />
            <Hand w={size * 0.018} len={size * 0.4} deg={sec * 6} color="#ff9500" z={4} />
            <div style={{ ...S.clockPin, width: size * 0.05, height: size * 0.05, margin: -size * 0.025 }} />
        </div>
    );
}

// ---------- 状态栏（iOS 6：左信号+运营商，中时间，右电池） ----------
function StatusBar() {
    return (
        <div style={S.status}>
            <span style={S.statusLeft}>
                <span style={S.signal}>●●●●●</span>
                <span style={S.carrier}>中国移动</span>
            </span>
            <span style={S.statusTime}>{LOCK_TIME}</span>
            <span style={S.battery}>
                <i style={S.batteryIcon}>
                    <b style={S.batteryFill} />
                </i>
            </span>
        </div>
    );
}

// ---------- 锁屏 ----------
function LockScreen({ onUnlock }) {
    const trackRef = useRef(null);
    const drag = useRef(null);
    const [x, setX] = useState(0);
    const { slider } = IOS6.lockScreen;

    // 量轨道：rectWidth 是「渲染 px」，offsetWidth 是「布局 px」（屏被 3D 缩放）
    const measure = () => {
        const el = trackRef.current;
        if (!el) return { rectWidth: 0, offsetWidth: 0 };
        return {
            rectWidth: el.getBoundingClientRect().width,
            offsetWidth: el.offsetWidth
        };
    };

    const onDown = (e) => {
        e.stopPropagation();
        drag.current = { startX: e.clientX, maxDx: 0 };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const onMove = (e) => {
        if (!drag.current) return;
        const dx = Math.max(drag.current.maxDx, e.clientX - drag.current.startX);
        drag.current.maxDx = dx;
        setX(knobX({ dx, ...measure() }));
    };

    const onUp = (e) => {
        if (!drag.current) return;
        const { maxDx } = drag.current;
        drag.current = null;
        const m = measure();
        if (shouldUnlock({ dx: maxDx, ...m })) {
            setX(travelWidth(m));
            onUnlock();
        } else {
            setX(0);
        }
    };

    return (
        <div style={S.lock}>
            <StatusBar />
            <div style={S.lockClock}>{LOCK_TIME}</div>
            <div style={S.lockDate}>{LOCK_DATE}</div>
            <div
                ref={trackRef}
                data-testid="lock-slider"
                style={{ ...S.sliderTrack, width: slider.width, height: slider.height }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
            >
                <span style={S.sliderHint}>滑动来解锁</span>
                <div
                    style={{
                        ...S.sliderKnob,
                        width: slider.knob,
                        height: slider.knob,
                        borderRadius: slider.knob / 2,
                        lineHeight: `${slider.knob}px`,
                        transform: `translateX(${x}px)`
                    }}
                >
                    ›
                </div>
            </div>
        </div>
    );
}

// ---------- 主屏 ----------
function HomeScreen({ openApp }) {
    const { springboard, pageDots, dock } = IOS6;
    return (
        <div style={S.home}>
            <div style={S.wallpaper} />
            <StatusBar />
            <div style={S.springboard}>
                {HOME_ICONS.map((icon, i) => {
                    const cell = springboardCell(i);
                    return (
                        <button
                            key={icon.id}
                            style={{
                                ...S.iconBtn,
                                left: cell.left,
                                top: cell.top,
                                width: springboard.iconSize
                            }}
                            onClick={() => openApp(icon)}
                        >
                            <IconTile id={icon.id} size={springboard.iconSize} />
                            <span style={S.iconLabel}>{icon.name}</span>
                        </button>
                    );
                })}
            </div>
            <div style={{ ...S.pageDots, top: pageDots.y }}>
                {Array.from({ length: pageDots.count }, (_, i) => (
                    <i
                        key={i}
                        style={{
                            ...S.pageDot,
                            width: pageDots.size,
                            height: pageDots.size,
                            marginRight: i === pageDots.count - 1 ? 0 : pageDots.gap,
                            opacity: i === pageDots.active ? 1 : 0.42
                        }}
                    />
                ))}
            </div>
            <div
                style={{
                    ...S.dock,
                    top: dock.top,
                    height: dock.height,
                    left: dock.shelfMargin,
                    right: dock.shelfMargin
                }}
            >
                {DOCK_ICONS.map((icon) => (
                    <button key={icon.id} style={S.dockBtn} onClick={() => openApp(icon)}>
                        <IconTile id={icon.id} size={dock.iconSize} />
                        <span style={S.iconLabel}>{icon.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---------- 弹窗（iOS 6 警告框） ----------
function Dialog({ dialog, onClose }) {
    return (
        <div style={S.dialogMask} onClick={onClose}>
            <div style={{ ...S.dialogBox, width: IOS6.dialog.width }} onClick={(e) => e.stopPropagation()}>
                <div style={S.dialogTitle}>{dialog.title}</div>
                <div style={S.dialogBody}>{dialog.body}</div>
                <button style={S.dialogBtn} onClick={onClose}>
                    好
                </button>
            </div>
        </div>
    );
}

// ---------- App：备忘录 ----------
function NotesApp() {
    const [openIndex, setOpenIndex] = useState(null);
    const note = openIndex === null ? null : NOTES[openIndex];

    return (
        <div style={S.appScreen}>
            <StatusBar />
            {note ? (
                <>
                    <div style={S.appBar}>
                        <span style={S.backLink} onClick={() => setOpenIndex(null)}>
                            ‹ 备忘录
                        </span>
                    </div>
                    <div style={S.notePaper}>
                        <div style={S.noteDate}>2010年6月8日</div>
                        <div style={S.noteTitle}>{note.title}</div>
                        <div style={S.noteBody}>{note.body}</div>
                    </div>
                </>
            ) : (
                <>
                    <div style={S.appBarTitle}>备忘录</div>
                    <div style={S.notesList}>
                        {NOTES.map((n, i) => (
                            <div key={n.title} style={S.noteRow} onClick={() => setOpenIndex(i)}>
                                <div style={S.noteRowTitle}>{n.title}</div>
                                <div style={S.noteRowBody}>
                                    {n.body.slice(0, 22)}
                                    {n.body.length > 22 ? '…' : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ---------- App：计算器 ----------
function CalculatorApp() {
    const calc = useMemo(() => createCalculator(), []);
    const [display, setDisplay] = useState(calc.display);
    const rows = [
        ['C', '±', '%', '÷'],
        ['7', '8', '9', '×'],
        ['4', '5', '6', '-'],
        ['1', '2', '3', '+'],
        ['0', '.', '=']
    ];

    return (
        <div style={{ ...S.appScreen, background: '#000' }}>
            <StatusBar />
            <div data-testid="calc-display" style={S.calcDisplay}>
                {display}
            </div>
            <div style={S.calcPad}>
                {rows.flat().map((key) => (
                    <button
                        key={key}
                        style={{
                            ...S.calcKey,
                            ...(key === '0' ? S.calcKeyZero : null),
                            ...('+−×÷'.includes(key) || key === '=' ? S.calcKeyOp : null),
                            ...('C±%'.includes(key) ? S.calcKeyFn : null)
                        }}
                        onClick={() => setDisplay(calc.press(key))}
                    >
                        {key}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---------- App：时钟（iOS 6：世界时钟） ----------
function ClockApp() {
    const tabs = ['世界时钟', '闹钟', '秒表', '计时器'];
    return (
        <div style={{ ...S.appScreen, background: '#000' }}>
            <StatusBar />
            <div style={S.clockBar}>时钟</div>
            <div style={S.clockBody}>
                <div style={S.clockCityRow}>
                    <span style={S.clockCityName}>北京</span>
                    <span style={S.clockCityTime}>{LOCK_TIME}</span>
                    <span style={S.clockCityDay}>今天</span>
                </div>
                <ClockFace size={168} theme="dark" />
                <div style={S.clockCaption}>永远停在 9:41 —— 发布会时刻</div>
            </div>
            <div style={S.tabBar}>
                {tabs.map((t, i) => (
                    <span key={t} style={{ ...S.tab, color: i === 0 ? '#fff' : '#9a9a9a' }}>
                        {t}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ---------- 主组件 ----------
const IPhone4S = () => {
    const [screen, setScreen] = useState('lock');
    const [app, setApp] = useState(null);
    const [dialog, setDialog] = useState(null);

    const goHome = useCallback(() => {
        setDialog(null);
        setApp(null);
        setScreen('home');
    }, []);

    const unlock = useCallback(() => setScreen('home'), []);

    const openApp = useCallback((icon) => {
        const popup = dialogFor(icon);
        if (popup) {
            setDialog(popup);
            return;
        }
        setApp(icon.id);
        setScreen('app');
    }, []);

    // 机身实体 Home 键 → 回主屏（锁屏时停在锁屏，和真机一致）
    useEffect(() => {
        const onHome = () => {
            setScreen((current) => (current === 'lock' ? current : 'home'));
            setDialog(null);
            setApp(null);
        };
        window.addEventListener(HOME_EVENT, onHome);
        return () => window.removeEventListener(HOME_EVENT, onHome);
    }, []);

    const stop = {
        onPointerDown: (e) => e.stopPropagation(),
        onPointerUp: (e) => e.stopPropagation(),
        onClick: (e) => e.stopPropagation()
    };

    return (
        <div data-testid="phone-screen" style={S.phone} {...stop}>
            {screen === 'lock' && <LockScreen onUnlock={unlock} />}
            {screen === 'home' && <HomeScreen openApp={openApp} />}
            {screen === 'app' && app === 'clock' && <ClockApp />}
            {screen === 'app' && app === 'calculator' && <CalculatorApp />}
            {screen === 'app' && app === 'notes' && <NotesApp />}
            {dialog && <Dialog dialog={dialog} onClose={() => setDialog(null)} />}
        </div>
    );
};

export default IPhone4S;

// ---------- 样式表（尺寸尽量从 IOS6 数据表来） ----------
const WALLPAPER =
    'radial-gradient(ellipse at 50% 28%, #4a86c8 0%, #23558f 38%, #102a4c 70%, #060e1c 100%)';

const S = {
    phone: {
        width: IOS6.screen.width,
        height: IOS6.screen.height,
        borderRadius: 6,
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        pointerEvents: 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        fontFamily: '"Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
        color: '#fff'
    },

    // 状态栏
    status: {
        position: 'relative',
        height: IOS6.statusBar.height,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 6px',
        fontSize: IOS6.statusBar.fontSize,
        fontWeight: 600,
        zIndex: 30
    },
    statusLeft: { display: 'flex', alignItems: 'center', gap: 3 },
    signal: { fontSize: 9, letterSpacing: -1, transform: 'translateY(-1px)' },
    carrier: { letterSpacing: 0.2 },
    statusTime: {
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        fontWeight: 700,
        pointerEvents: 'none'
    },
    battery: { display: 'flex', alignItems: 'center' },
    batteryIcon: {
        position: 'relative',
        display: 'block',
        width: 22,
        height: 11,
        borderRadius: 2.5,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.8)'
    },
    batteryFill: {
        position: 'absolute',
        left: 1.5,
        top: 1.5,
        width: 19,
        height: 8,
        borderRadius: 1.5,
        background: '#5ee05e'
    },

    // 锁屏
    lock: {
        position: 'absolute',
        inset: 0,
        background: WALLPAPER,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    lockClock: {
        marginTop: IOS6.lockScreen.clockTop - IOS6.statusBar.height,
        fontSize: IOS6.lockScreen.clockSize,
        fontWeight: 200,
        letterSpacing: -1,
        textShadow: '0 2px 10px rgba(0,0,0,0.55)'
    },
    lockDate: {
        marginTop: 2,
        fontSize: IOS6.lockScreen.dateSize,
        color: 'rgba(255,255,255,0.9)',
        textShadow: '0 1px 4px rgba(0,0,0,0.6)'
    },
    sliderTrack: {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: IOS6.lockScreen.slider.bottom,
        borderRadius: IOS6.lockScreen.slider.height / 2,
        background:
            'linear-gradient(rgba(255,255,255,0.32), rgba(255,255,255,0.14))',
        border: '1px solid rgba(255,255,255,0.45)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.25)',
        cursor: 'grab',
        touchAction: 'none'
    },
    sliderHint: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.85)',
        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
        pointerEvents: 'none'
    },
    sliderKnob: {
        position: 'absolute',
        top: 1,
        left: 1,
        textAlign: 'center',
        fontWeight: 400,
        fontSize: 22,
        color: '#7a7a7a',
        background: 'linear-gradient(#ffffff,#c4c4c4)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.9)',
        cursor: 'grab'
    },

    // 主屏
    home: { position: 'absolute', inset: 0, background: WALLPAPER },
    wallpaper: {
        position: 'absolute',
        inset: 0,
        background:
            'radial-gradient(ellipse at 50% 22%, rgba(255,255,255,0.16), rgba(255,255,255,0) 60%)'
    },
    springboard: { position: 'absolute', inset: 0 },
    iconBtn: {
        position: 'absolute',
        padding: 0,
        border: 'none',
        background: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer'
    },
    iconLabel: {
        marginTop: IOS6.springboard.labelGap,
        fontSize: IOS6.springboard.labelSize,
        lineHeight: `${IOS6.springboard.labelHeight}px`,
        color: '#fff',
        whiteSpace: 'nowrap',
        textShadow: '0 -1px 0 rgba(0,0,0,0.45)'
    },
    tile: {
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.25)'
    },
    tileGloss: {
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        pointerEvents: 'none',
        background:
            'linear-gradient(rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.12) 47%, rgba(255,255,255,0) 48%)'
    },

    // 日历图标
    calendarTile: (size) => ({
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(#fdfdfd,#e4e4e4)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start'
    }),
    calendarWeek: (size) => ({
        fontSize: size * 0.19,
        color: '#d0362c',
        fontWeight: 700,
        marginTop: size * 0.09,
        lineHeight: 1
    }),
    calendarDay: (size) => ({
        fontSize: size * 0.46,
        color: '#1a1a1a',
        fontWeight: 300,
        lineHeight: 1.1
    }),
    // 相机图标
    cameraTile: (size) => ({
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(#6d6d6d,#2a2a2a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }),
    cameraLens: (size) => ({
        width: size * 0.5,
        height: size * 0.5,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 35%, #7ec8f0 0 18%, #2b5f80 40%, #101c26 70%)',
        boxShadow: '0 0 0 2px #1a1a1a, inset 0 0 6px rgba(255,255,255,0.35)'
    }),
    cameraFlash: (size) => ({
        position: 'absolute',
        right: size * 0.14,
        top: size * 0.12,
        width: size * 0.1,
        height: size * 0.1,
        borderRadius: '50%',
        background: '#ffe9a8'
    }),
    // 计算器图标
    calcTile: (size) => ({ position: 'absolute', inset: 0, background: 'linear-gradient(#3d3d3d,#151515)', padding: size * 0.1 }),
    calcTileScreen: (size) => ({
        height: size * 0.16,
        borderRadius: 2,
        background: 'linear-gradient(#c9d6a8,#9fb07a)',
        marginBottom: size * 0.06
    }),
    calcTileKeys: (size) => ({
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: size * 0.045
    }),
    calcTileKey: (size) => ({
        display: 'block',
        height: size * 0.1,
        borderRadius: 2,
        background: '#6e6e6e'
    }),
    // Safari 图标
    safariTile: (size) => ({
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 40%, #6fc3f7, #1b6fc0 70%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }),
    safariRing: (size) => ({
        width: '82%',
        height: '82%',
        borderRadius: '50%',
        background: 'linear-gradient(#fdfdfd,#dcdcdc)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)'
    }),
    safariNeedle: (size) => ({
        width: '62%',
        height: '14%',
        background: 'linear-gradient(90deg, #e8453c 0 50%, #2f6fb5 50% 100%)',
        transform: 'rotate(-45deg)',
        borderRadius: 2
    }),

    // 页码点
    pageDots: {
        position: 'absolute',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },
    pageDot: { display: 'block', borderRadius: '50%', background: '#fff' },

    // Dock（iOS 6 玻璃条）
    dock: {
        position: 'absolute',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        paddingTop: IOS6.dock.iconTop - IOS6.dock.top,
        borderRadius: IOS6.dock.shelfRadius,
        background:
            'linear-gradient(rgba(255,255,255,0.34), rgba(255,255,255,0.16))',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)',
        backdropFilter: 'blur(2px)'
    },
    dockBtn: {
        border: 'none',
        background: 'none',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer'
    },

    // 弹窗
    dialogMask: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 90
    },
    dialogBox: {
        borderRadius: IOS6.dialog.radius,
        overflow: 'hidden',
        textAlign: 'center',
        background: 'linear-gradient(#eceef2,#c9cdd6)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.45)'
    },
    dialogTitle: { fontSize: 13, fontWeight: 700, color: '#222', padding: '12px 12px 0' },
    dialogBody: { fontSize: 11, color: '#4a4a4a', padding: '5px 14px 12px', lineHeight: 1.45 },
    dialogBtn: {
        width: '100%',
        border: 'none',
        borderTop: '1px solid rgba(90,100,120,0.6)',
        background: 'linear-gradient(#9fb6dd,#6f8cc0)',
        color: '#fff',
        fontWeight: 700,
        fontSize: 14,
        padding: '9px 0',
        cursor: 'pointer'
    },

    // 通用 App 屏
    appScreen: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#f4f4f4',
        color: '#111'
    },
    appBar: {
        background: 'linear-gradient(#dbe3ef,#a9b7cd)',
        borderBottom: '1px solid #7d8ba1',
        padding: '7px 10px',
        fontSize: 14,
        flexShrink: 0
    },
    appBarTitle: {
        background: 'linear-gradient(#dbe3ef,#a9b7cd)',
        borderBottom: '1px solid #7d8ba1',
        padding: '7px 0',
        fontSize: 14,
        fontWeight: 700,
        textAlign: 'center',
        color: '#111',
        flexShrink: 0
    },
    backLink: { color: '#1b4f9c', fontWeight: 600, cursor: 'pointer' },

    // 备忘录
    notesList: { flex: 1, overflowY: 'auto', background: '#fdf9e3' },
    noteRow: {
        padding: '8px 12px',
        borderBottom: '1px solid #e2ddc8',
        cursor: 'pointer'
    },
    noteRowTitle: { fontSize: 14, fontWeight: 700, color: '#3a3220' },
    noteRowBody: { fontSize: 11, color: '#8b8168', marginTop: 2 },
    notePaper: {
        flex: 1,
        overflowY: 'auto',
        padding: '12px 14px',
        background: 'repeating-linear-gradient(#fdf9e3 0 23px, #efe8cf 23px 24px)'
    },
    noteDate: { fontSize: 10, color: '#a89d80', textAlign: 'center' },
    noteTitle: { fontSize: 17, fontWeight: 700, textAlign: 'center', margin: '5px 0 8px', color: '#3a3220' },
    noteBody: { fontSize: 13, lineHeight: '24px', color: '#3a3220' },

    // 计算器
    calcDisplay: {
        fontSize: 46,
        fontWeight: 200,
        color: '#fff',
        textAlign: 'right',
        padding: '10px 14px 6px',
        flexShrink: 0,
        overflow: 'hidden'
    },
    calcPad: {
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: 'repeat(5, 1fr)',
        gap: 1,
        background: '#3a3a3a',
        borderTop: '1px solid #3a3a3a'
    },
    calcKey: {
        border: 'none',
        fontSize: 22,
        fontWeight: 400,
        background: 'linear-gradient(#6e6e6e,#3f3f3f)',
        color: '#fff',
        cursor: 'pointer'
    },
    calcKeyOp: { background: 'linear-gradient(#ffb03a,#f08a00)', color: '#fff', fontSize: 24 },
    calcKeyFn: { background: 'linear-gradient(#e8e8e8,#bdbdbd)', color: '#111' },
    calcKeyZero: { gridColumn: 'span 2' },

    // 时钟
    clockBar: {
        background: 'linear-gradient(#5a5a5a,#1f1f1f)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
        textAlign: 'center',
        padding: '7px 0',
        borderBottom: '1px solid #000',
        flexShrink: 0
    },
    clockBody: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12
    },
    clockCityRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        width: '86%',
        justifyContent: 'space-between'
    },
    clockCityName: { fontSize: 15, fontWeight: 600, color: '#fff' },
    clockCityTime: { fontSize: 30, fontWeight: 200, color: '#fff' },
    clockCityDay: { fontSize: 11, color: '#9a9a9a' },
    clockCaption: { fontSize: 10, color: '#8a8a8a' },
    clockFace: {
        position: 'relative',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    clockPin: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        borderRadius: '50%',
        background: '#ff9500',
        zIndex: 5
    },
    tabBar: {
        display: 'flex',
        background: 'linear-gradient(#4a4a4a,#141414)',
        borderTop: '1px solid #000',
        flexShrink: 0
    },
    tab: { flex: 1, textAlign: 'center', fontSize: 10, padding: '7px 0' }
};
