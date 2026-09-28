/* eslint-disable react/prop-types -- 面板是内部组件，props 形状由 ADR-0003 与调用方约定 */
import { useEffect } from 'react';

import { TvScreenStyles } from './TvScreenStyles';

const stop = (e) => e.stopPropagation();

/**
 * 换游戏时的「正在开机…」遮罩（见 ADR-0003）。
 * status：
 *   booting —— 正常等待（模拟器在解析 core + ROM）
 *   timeout —— 超过 8s 还没 start，补一句提示
 *   error   —— 起不来，显示可读错误 + 「返回菜单」
 * Esc 任何时候都能取消，退回卡带菜单。
 */
export const TvBootOverlay = ({ game, status = 'booting', message, onBack }) => {
    useEffect(() => {
        const onKey = (e) => {
            if (e.code === 'Escape' || e.code === 'Backspace') {
                e.preventDefault();
                onBack?.();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onBack]);

    const failed = status === 'error';

    return (
        <div
            data-testid="tv-boot-overlay"
            onPointerDown={stop}
            onPointerUp={stop}
            onClick={stop}
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 18,
                background: 'rgba(3,5,12,0.95)',
                color: '#e8ecf5',
                fontFamily:
                    '"PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif',
                userSelect: 'none',
                textAlign: 'center',
                animation: 'tvFadeIn 200ms ease'
            }}
        >
            <TvScreenStyles />

            {!failed && (
                <div
                    style={{
                        width: 78,
                        height: 6,
                        borderRadius: 3,
                        background: '#7b5cff',
                        animation: 'tvPulse 1.1s ease-in-out infinite'
                    }}
                />
            )}

            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4 }}>
                {failed ? '没能开机' : '正在开机…'}
            </div>
            {game?.name && (
                <div style={{ fontSize: 17, color: 'rgba(232,236,245,0.6)' }}>{game.name}</div>
            )}

            {status === 'timeout' && (
                <div
                    data-testid="tv-boot-timeout-hint"
                    style={{ fontSize: 14.5, color: '#ffd9a8', maxWidth: 760, lineHeight: 1.6 }}
                >
                    等得有点久了：模拟器可能还在下核心，或者本地 public/data 里的文件不全（见
                    ADR-0003）。再等一会儿，或者按 Esc 回菜单。
                </div>
            )}

            {failed && (
                <div
                    data-testid="tv-boot-error"
                    style={{ fontSize: 14.5, color: '#ffb4a8', maxWidth: 820, lineHeight: 1.6 }}
                >
                    {message || '模拟器没能启动。'}
                </div>
            )}

            <button
                data-testid="tv-boot-back"
                onClick={(e) => {
                    stop(e);
                    onBack?.();
                }}
                style={{
                    marginTop: 6,
                    padding: '11px 26px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.22)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontSize: 15.5,
                    cursor: 'pointer'
                }}
            >
                返回菜单（Esc）
            </button>
        </div>
    );
};

export default TvBootOverlay;
