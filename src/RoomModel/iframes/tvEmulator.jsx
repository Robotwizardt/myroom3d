import { Html } from '@react-three/drei';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmulatorJS } from 'react-emulatorjs';

import { defaultIndex, GAMES, probeRoms, writeLastPlayed } from '../../data/games';
import { useCameraStore } from '../../helper/CameraStore';
import { listSavedGames } from '../../helper/emulatorSaves';
import { TvBootOverlay } from './TvBootOverlay';
import { TvGameMenu } from './TvGameMenu';
import { TvScreenStyles } from './TvScreenStyles';

/** 屏幕尺寸：跟模拟器 iframe 完全一致，切换时不跳 */
const SCREEN_W = 1610;
const SCREEN_H = 852;

/** 等多久算「慢」（补提示）／算「失败」（给可读错误 + 返回菜单） */
const BOOT_SLOW_MS = 8000;
const BOOT_FAIL_MS = 25000;
/** 进游戏后按键提示浮多久 */
const KEYS_HINT_MS = 3000;

/** 模拟器自带按钮：全开（含虚拟手柄，默认收起）；fullscreen 故意关掉 ——
 *  在 3D 场景里让 iframe 全屏没有意义 */
const TV_BUTTONS = {
    playPause: true,
    restart: true,
    mute: true,
    settings: true,
    fullscreen: false,
    saveState: true,
    loadState: true,
    screenRecord: true,
    gamepad: true,
    cheat: true,
    volume: true,
    saveSavFiles: true,
    loadSavFiles: true,
    quickSave: true,
    quickLoad: true,
    screenshot: true,
    cacheManager: true
};

/**
 * 电视里的 GBA 模拟器（见 ADR-0003）。
 *
 * 三个阶段：menu（卡带菜单）→ booting（开机遮罩 + iframe 已经在后台加载）→
 * playing（模拟器露面）。
 * 换游戏靠换 React key 强制重挂 iframe —— react-emulatorjs 只在子窗口挂一次
 * EJS_* 全局，改 props 不会重载（详见 ADR-0003）。
 */
const TvEmulator = memo(function TvEmulator() {
    const cameraState = useCameraStore((state) => state.cameraState);
    const isTv = useMemo(() => cameraState === 'tv', [cameraState]);

    const [phase, setPhase] = useState('menu');
    const [game, setGame] = useState(null);
    const [index, setIndex] = useState(() => defaultIndex(GAMES));
    const [probe, setProbe] = useState({});
    const [saved, setSaved] = useState(() => new Set());
    const [showKeys, setShowKeys] = useState(false);

    const rootRef = useRef(null);
    const timersRef = useRef([]);

    const clearTimers = useCallback(() => {
        timersRef.current.forEach((t) => clearTimeout(t));
        timersRef.current = [];
    }, []);

    /** 重新读一遍浏览器里的存档（退出游戏后 IDBFS 才落盘，所以要晚一点再读） */
    const refreshSaved = useCallback((delay = 0) => {
        const t = setTimeout(() => {
            listSavedGames(GAMES)
                .then(setSaved)
                .catch(() => {});
        }, delay);
        timersRef.current.push(t);
    }, []);

    // 探测 ROM 是否存在（缺文件的卡带变灰）
    useEffect(() => {
        let alive = true;
        probeRoms(GAMES).then((r) => {
            if (alive) setProbe(r);
        });
        return () => {
            alive = false;
        };
    }, []);

    // 进菜单 / 回到菜单时刷新存档点
    useEffect(() => {
        if (isTv && phase === 'menu') refreshSaved();
    }, [isTv, phase, refreshSaved]);

    // 离开电视特写就复位，下次进来还是菜单
    useEffect(() => {
        if (!isTv) {
            clearTimers();
            setPhase('menu');
            setGame(null);
            setShowKeys(false);
        }
    }, [isTv, clearTimers]);

    useEffect(() => clearTimers, [clearTimers]);

    /** 开始一个游戏：iframe 挂上（遮罩盖着它），等 EJS_onGameStart 才进 playing */
    const startGame = useCallback(
        (g) => {
            if (!g) return;
            clearTimers();
            setGame(g);
            setPhase('booting');
            writeLastPlayed(g.id);
            timersRef.current.push(setTimeout(() => setPhase('booting-slow'), BOOT_SLOW_MS));
            timersRef.current.push(setTimeout(() => setPhase('boot-failed'), BOOT_FAIL_MS));
        },
        [clearTimers]
    );

    const onGameStart = useCallback(() => {
        clearTimers();
        setPhase('playing');
        setShowKeys(true);
        timersRef.current.push(setTimeout(() => setShowKeys(false), KEYS_HINT_MS));
    }, [clearTimers]);

    /** 回卡带菜单（游戏里的 ✕ / Esc，或开机失败后的「返回菜单」） */
    const backToMenu = useCallback(() => {
        clearTimers();
        setPhase('menu');
        setGame(null);
        setShowKeys(false);
        refreshSaved(600);
        refreshSaved(1800);
    }, [clearTimers, refreshSaved]);

    /** 退出电视，回房间全景 */
    const exitTv = useCallback(() => {
        useCameraStore.getState().default();
    }, []);

    // 游戏里 Esc / Backspace 回菜单、R 回全景。
    // 注意：iframe 抢了焦点后按键走子窗口，父窗口收不到，所以给子窗口也挂一份。
    useEffect(() => {
        if (!isTv || phase !== 'playing') return undefined;
        const onKey = (e) => {
            if (e.code === 'KeyR') {
                e.preventDefault();
                e.stopPropagation();
                exitTv();
                return;
            }
            if (e.code === 'Escape' || e.code === 'Backspace') {
                e.preventDefault();
                e.stopPropagation();
                backToMenu();
            }
        };
        window.addEventListener('keydown', onKey, true);
        const childWin = rootRef.current?.querySelector('iframe')?.contentWindow;
        let attached = false;
        try {
            childWin?.addEventListener?.('keydown', onKey, true);
            attached = !!childWin;
        } catch {
            /* 跨源不可能，但真出问题也不该炸掉电视 */
        }
        return () => {
            window.removeEventListener('keydown', onKey, true);
            if (attached) {
                try {
                    childWin?.removeEventListener?.('keydown', onKey, true);
                } catch {
                    /* 子窗口可能已经销毁 */
                }
            }
        };
    }, [isTv, phase, backToMenu, exitTv]);

    const booting = phase === 'booting' || phase === 'booting-slow' || phase === 'boot-failed';
    const bootStatus =
        phase === 'booting-slow' ? 'timeout' : phase === 'boot-failed' ? 'error' : 'booting';

    return (
        <group>
            {isTv && (
                <Html
                    transform
                    wrapperClass="htmlScreen"
                    distanceFactor={0.925}
                    occlude="blending"
                    position={[2.28, 2.72, -3.6]}
                    zIndexRange={[2, 1]}
                >
                    <div
                        ref={rootRef}
                        style={{ position: 'relative', width: SCREEN_W, height: SCREEN_H }}
                    >
                        {phase === 'menu' && (
                            <TvGameMenu
                                games={GAMES}
                                index={index}
                                onSelect={setIndex}
                                onStart={startGame}
                                onExit={exitTv}
                                probe={probe}
                                saved={saved}
                            />
                        )}

                        {/* key 换掉 = iframe 重挂 = 真的换游戏；开机时它已经在遮罩后面加载 */}
                        {game && phase !== 'menu' && (
                            <EmulatorJS
                                key={game.id}
                                width={SCREEN_W}
                                height={SCREEN_H}
                                EJS_core={game.core}
                                EJS_gameUrl={game.rom}
                                EJS_gameName={game.id}
                                EJS_pathtodata="/data"
                                EJS_startOnLoaded={true}
                                EJS_onGameStart={onGameStart}
                                EJS_Buttons={TV_BUTTONS}
                            />
                        )}

                        {booting && (
                            <TvBootOverlay
                                game={game}
                                status={bootStatus}
                                message={
                                    bootStatus === 'error'
                                        ? `「${game?.name}」在 ${
                                              BOOT_FAIL_MS / 1000
                                          } 秒内没有启动起来。先确认 public/data 里的 mgba 核心文件在（ADR-0003），或者从菜单换一张卡带再试。`
                                        : undefined
                                }
                                onBack={backToMenu}
                            />
                        )}

                        {phase === 'playing' && (
                            <>
                                <button
                                    data-testid="tv-game-exit"
                                    aria-label="返回游戏列表"
                                    title="返回游戏列表（Esc）"
                                    onClick={backToMenu}
                                    style={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 14,
                                        width: 44,
                                        height: 44,
                                        borderRadius: '50%',
                                        border: 'none',
                                        background: 'rgba(0,0,0,0.45)',
                                        color: '#fff',
                                        fontSize: 20,
                                        lineHeight: 1,
                                        cursor: 'pointer',
                                        opacity: 0.75
                                    }}
                                >
                                    ✕
                                </button>

                                {showKeys && (
                                    <div
                                        data-testid="tv-keys-toast"
                                        style={{
                                            position: 'absolute',
                                            left: '50%',
                                            bottom: 22,
                                            transform: 'translateX(-50%)',
                                            padding: '9px 20px',
                                            borderRadius: 999,
                                            background: 'rgba(0,0,0,0.55)',
                                            color: 'rgba(255,255,255,0.92)',
                                            fontSize: 14.5,
                                            letterSpacing: 0.4,
                                            pointerEvents: 'none',
                                            fontFamily:
                                                '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
                                            transition: 'opacity 400ms ease',
                                            animation: 'tvFadeIn 300ms ease'
                                        }}
                                    >
                                        方向键 十字键 · Z = A · X = B · Q/E = L/R · Enter = Start · V =
                                        Select
                                    </div>
                                )}
                            </>
                        )}

                        <TvScreenStyles />
                    </div>
                </Html>
            )}
        </group>
    );
});

export default TvEmulator;
