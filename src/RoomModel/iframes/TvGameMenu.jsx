/* eslint-disable react/prop-types -- 面板是内部组件，props 形状由 ADR-0003 与调用方约定 */
import { useEffect } from 'react';

import { nextIndex, PLATFORM_LABEL } from '../../data/games';
import { TvScreenStyles } from './TvScreenStyles';

/** 卡带标签的配色，按顺序取（超过就循环） */
const LABEL_COLORS = [
    'linear-gradient(150deg, #f2604a, #c8302a)',
    'linear-gradient(150deg, #4f92f5, #2a55c8)',
    'linear-gradient(150deg, #4cc078, #25844a)',
    'linear-gradient(150deg, #e8b03f, #b87a12)',
    'linear-gradient(150deg, #a86ff0, #6a2fc0)',
    'linear-gradient(150deg, #ef7fae, #c03a72)'
];

/** 卡带尺寸：数量多了就整体缩一点，保证一排全塞进 1470 宽的居中层 */
const CART = { width: 224, height: 302, gap: 34, rowWidth: 1470 };

const layoutFor = (count) => {
    const width = count
        ? Math.min(
              CART.width,
              Math.floor((CART.rowWidth - (count - 1) * CART.gap) / count)
          )
        : CART.width;
    const k = width / CART.width;
    return { width, height: Math.round(CART.height * k), k, gap: CART.gap };
};

const stop = (e) => e.stopPropagation();

const wrapCenter = {
    maxWidth: 1470,
    margin: '0 auto',
    padding: 0
};

/**
 * 电视屏内的卡带菜单（见 ADR-0003）：
 *   ← →  选卡带 / 鼠标点非选中项也是选
 *   Enter 或点选中那张 → 开始
 *   Esc / Backspace    → 退出电视回房间
 * 尺寸跟模拟器 iframe 一样是 1610×852，这样切换时不跳。
 */
export const TvGameMenu = ({
    games = [],
    index = 0,
    onSelect,
    onStart,
    onExit,
    probe = {},
    saved
}) => {
    const current = games[index];
    const missing = !!current && probe[current.id] === 'missing';
    const cart = layoutFor(games.length);

    useEffect(() => {
        const onKey = (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                e.preventDefault();
                if (games.length > 1) {
                    onSelect?.(nextIndex(index, games.length, e.code === 'ArrowRight' ? 1 : -1));
                }
            } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
                e.preventDefault();
                if (current && !missing) onStart?.(current);
            } else if (e.code === 'Escape' || e.code === 'Backspace') {
                e.preventDefault();
                onExit?.();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [games, index, current, missing, onSelect, onStart, onExit]);

    return (
        <div
            data-testid="tv-game-menu"
            onPointerDown={stop}
            onPointerUp={stop}
            onClick={stop}
            style={{
                position: 'relative',
                width: 1610,
                height: 852,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 70px 24px',
                borderRadius: 8,
                overflow: 'hidden',
                background:
                    'radial-gradient(120% 90% at 50% 0%, #202a44 0%, #131a2e 45%, #0a0e18 100%)',
                color: '#e8ecf5',
                fontFamily:
                    '"PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif',
                userSelect: 'none',
                animation: 'tvFadeIn 260ms ease'
            }}
        >
            <TvScreenStyles />

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, ...wrapCenter, width: '100%' }}>
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>游戏库</span>
                <span style={{ fontSize: 15, color: 'rgba(232,236,245,0.45)' }}>
                    {games.length} 个游戏 · 换游戏只改 src/data/games.js
                </span>
            </div>

            <button
                data-testid="tv-menu-exit"
                aria-label="退出电视"
                title="退出电视（Esc）"
                onClick={(e) => {
                    stop(e);
                    onExit?.();
                }}
                style={{
                    position: 'absolute',
                    top: 26,
                    right: 30,
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(255,255,255,0.10)',
                    color: '#fff',
                    fontSize: 22,
                    lineHeight: 1,
                    cursor: 'pointer',
                    opacity: 0.85
                }}
            >
                ✕
            </button>

            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: cart.gap,
                    paddingTop: 16
                }}
            >
                {games.length === 0 && (
                    <div style={{ fontSize: 20, color: 'rgba(232,236,245,0.5)' }}>
                        游戏清单是空的 —— 去 src/data/games.js 里加一条
                    </div>
                )}
                {games.map((g, i) => {
                    const selected = i === index;
                    const gone = probe[g.id] === 'missing';
                    const hasSave = !!saved?.has?.(g.id);
                    return (
                        <button
                            key={g.id}
                            data-testid="tv-cartridge"
                            data-game-id={g.id}
                            data-selected={selected ? 'true' : 'false'}
                            data-missing={gone ? 'true' : 'false'}
                            aria-label={g.name}
                            onClick={(e) => {
                                stop(e);
                                // 缺文件的卡带可以选中（好看清底栏那句「文件缺失」），但永远不开机
                                if (gone) {
                                    if (!selected) onSelect?.(i);
                                    return;
                                }
                                if (selected) onStart?.(g);
                                else onSelect?.(i);
                            }}
                            style={{
                                position: 'relative',
                                width: cart.width,
                                height: cart.height,
                                padding: 0,
                                borderRadius: 14,
                                border: '2px solid rgba(255,255,255,0.10)',
                                background:
                                    'linear-gradient(160deg, #3a4152 0%, #22283a 60%, #1a1f2e 100%)',
                                boxShadow: '0 18px 26px rgba(0,0,0,0.45)',
                                cursor: gone ? 'not-allowed' : 'pointer',
                                opacity: gone ? 0.45 : selected ? 1 : 0.82,
                                filter: gone ? 'grayscale(0.75)' : 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'stretch',
                                textAlign: 'center',
                                color: 'inherit',
                                font: 'inherit'
                            }}
                        >
                            {/* 卡带顶部的凹槽（GBA 卡带的标志性缺口） */}
                            <span
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: 84,
                                    height: 11,
                                    background: '#11151f',
                                    borderRadius: '0 0 7px 7px'
                                }}
                            />

                            {hasSave && (
                                <span
                                    data-testid={`tv-save-dot-${g.id}`}
                                    title="有存档，进去自动续玩"
                                    style={{
                                        position: 'absolute',
                                        top: 9,
                                        right: 10,
                                        width: 15,
                                        height: 15,
                                        borderRadius: '50%',
                                        background:
                                            'radial-gradient(circle at 35% 35%, #fff6cb, #f2c53d 60%, #b98a12)',
                                        border: '1.5px solid rgba(0,0,0,0.4)',
                                        boxShadow: '0 0 10px rgba(242,197,61,0.75)'
                                    }}
                                />
                            )}

                            <span
                                style={{
                                    margin: '22px 18px 0',
                                    height: Math.round(112 * cart.k),
                                    borderRadius: '10px 10px 5px 5px',
                                    background: LABEL_COLORS[i % LABEL_COLORS.length],
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 12px',
                                    fontSize: Math.round(20 * cart.k),
                                    fontWeight: 700,
                                    lineHeight: 1.25,
                                    letterSpacing: 1,
                                    color: '#fff',
                                    textShadow: '0 1px 3px rgba(0,0,0,0.55)',
                                    boxShadow: 'inset 0 -6px 12px rgba(0,0,0,0.22)'
                                }}
                            >
                                {gone ? '?' : g.name}
                            </span>

                            <span
                                style={{
                                    margin: '14px 18px 0',
                                    fontSize: Math.round(17 * cart.k),
                                    fontWeight: 600,
                                    lineHeight: 1.3
                                }}
                            >
                                {g.name}
                            </span>
                            {g.desc && !gone && (
                                <span
                                    style={{
                                        margin: '8px 18px 0',
                                        fontSize: Math.max(11, Math.round(12.5 * cart.k)),
                                        lineHeight: 1.5,
                                        color: 'rgba(232,236,245,0.55)'
                                    }}
                                >
                                    {g.desc}
                                </span>
                            )}
                            {gone && (
                                <span
                                    data-testid={`tv-missing-${g.id}`}
                                    style={{
                                        margin: '8px 18px 0',
                                        fontSize: Math.max(11, Math.round(12.5 * cart.k)),
                                        lineHeight: 1.5,
                                        color: '#ffb4a8'
                                    }}
                                >
                                    文件缺失：把 ROM 放进 public/assets/
                                </span>
                            )}

                            <span
                                data-testid={`tv-platform-${g.id}`}
                                style={{
                                    marginTop: 'auto',
                                    paddingBottom: Math.round(14 * cart.k),
                                    fontSize: Math.max(8, Math.round(10 * cart.k)),
                                    letterSpacing: Math.max(1.5, 3 * cart.k),
                                    color: 'rgba(232,236,245,0.35)'
                                }}
                            >
                                {PLATFORM_LABEL[g.platform] || 'GAME BOY ADVANCE'}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div style={{ ...wrapCenter, width: '100%', textAlign: 'center' }}>
                <div
                    data-testid="tv-selected-name"
                    style={{ fontSize: 34, fontWeight: 700, letterSpacing: 2 }}
                >
                    {current ? current.name : '—'}
                </div>
                {current?.desc && (
                    <div
                        style={{
                            marginTop: 8,
                            fontSize: 15.5,
                            color: 'rgba(232,236,245,0.6)'
                        }}
                    >
                        {current.desc}
                    </div>
                )}
                {current?.author && (
                    <div
                        data-testid="tv-attribution"
                        title={current.source ? `来源：${current.source}` : undefined}
                        style={{
                            marginTop: 4,
                            fontSize: 13,
                            color: 'rgba(232,236,245,0.42)'
                        }}
                    >
                        {current.author}
                        {current.license ? ` · ${current.license}` : ''}
                        {current.source ? ' · 来源见 CREDITS.md' : ''}
                    </div>
                )}
                <div
                    data-testid="tv-start-hint"
                    style={{
                        marginTop: 12,
                        fontSize: 16,
                        fontWeight: 600,
                        color: missing ? '#ff9a8b' : 'rgba(255,255,255,0.88)'
                    }}
                >
                    {missing
                        ? '⚠ 卡带文件缺失，先放进 public/assets/ 再刷新'
                        : 'Enter 或点一下这张卡带，开始游戏'}
                </div>
                <div
                    data-testid="tv-keys-hint"
                    style={{
                        marginTop: 14,
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: 'rgba(232,236,245,0.42)'
                    }}
                >
                    ← → 选卡带 · Enter 开始 · Esc 退出电视
                    <br />
                    游戏里：方向键 = 十字键 · Z = A · X = B · Q/E = L/R · Enter = Start · V = Select
                </div>
            </div>
        </div>
    );
};

export default TvGameMenu;
