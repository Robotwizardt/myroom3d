/**
 * 项目卡 UI（纯本地 DOM，不请求任何外网）
 *
 * 导出两个东西：
 *   ProjectScreen —— 贴在 3D 屏幕上的紧凑版（给电脑屏幕 / 手机屏幕用）
 *   ProjectOverlay —— 浮在最上层的可读大面板（点击卡片后弹出，能用键盘操作）
 *
 * 【新增】文件，没有改动原项目的任何 UI 逻辑。
 */
/* eslint-disable react/prop-types */
/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';

import { PROJECTS } from '../data/projects';
import { useProjectStore } from '../helper/ProjectStore';

const FONT =
    '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif';

/* ---------------- 下面这层是纯展示，不含任何状态 ---------------- */

const Tags = ({ tags, accent }) => (
    <div
        style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            margin: '10px 0 0'
        }}
    >
        {(tags || []).map((t) => (
            <span
                key={t}
                style={{
                    fontSize: 13,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: `${accent}22`,
                    color: accent,
                    border: `1px solid ${accent}55`
                }}
            >
                {t}
            </span>
        ))}
    </div>
);

const Links = ({ links, accent }) =>
    !links || links.length === 0 ? null : (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {links.map((l) => (
                <a
                    key={l.url + l.label}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        fontSize: 14,
                        textDecoration: 'none',
                        padding: '7px 14px',
                        borderRadius: 8,
                        background: accent,
                        color: '#0d0a18',
                        fontWeight: 600
                    }}
                >
                    {l.label} ↗
                </a>
            ))}
        </div>
    );

/* ---------------- 3D 屏幕里用的紧凑版 ---------------- */

export const ProjectScreen = ({ index, width, height, phone }) => {
    const p = PROJECTS[index] || PROJECTS[0];
    const s = width / 1000; // 按宽度等比缩放字号，换屏幕尺寸不用重调
    return (
        <div
            style={{
                width,
                height,
                boxSizing: 'border-box',
                background: '#141024',
                color: '#f2eefc',
                fontFamily: FONT,
                padding: 34 * s + 14,
                overflow: 'hidden',
                borderTop: `${6 * s + 2}px solid ${p.accent}`
            }}
        >
            <div style={{ fontSize: 13 * s + 8, color: p.accent, letterSpacing: 2 }}>
                {String(index + 1).padStart(2, '0')} / PROJECT
            </div>
            <div
                style={{
                    fontSize: 46 * s + 12,
                    fontWeight: 800,
                    marginTop: 6,
                    lineHeight: 1.15
                }}
            >
                {p.title}
            </div>
            <div style={{ fontSize: 20 * s + 9, opacity: 0.75, marginTop: 8 }}>
                {p.subtitle}
            </div>

            <Tags tags={p.tags} accent={p.accent} />

            <div style={{ marginTop: 18 * s + 10, fontSize: 17 * s + 9, lineHeight: 1.6 }}>
                {(p.desc || []).map((d, i) => (
                    <p key={i} style={{ margin: '0 0 8px' }}>
                        {d}
                    </p>
                ))}
            </div>

            {!phone && <Links links={p.links} accent={p.accent} />}
        </div>
    );
};

/* ---------------- 点击卡片后弹出的可读大面板 ---------------- */

export const ProjectOverlay = () => {
    const panelOpen = useProjectStore((s) => s.panelOpen);
    const index = useProjectStore((s) => s.activeIndex);
    const close = useProjectStore((s) => s.closeProject);
    const next = useProjectStore((s) => s.nextProject);
    const prev = useProjectStore((s) => s.prevProject);

    // Esc 关闭，左右方向键切换上一个/下一个项目
    useEffect(() => {
        if (!panelOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowRight') next();
            else if (e.key === 'ArrowLeft') prev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [panelOpen, close, next, prev]);

    if (!panelOpen) return null;

    const p = PROJECTS[index] || PROJECTS[0];
    const total = PROJECTS.length;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(8,6,16,0.55)',
                backdropFilter: 'blur(3px)',
                fontFamily: FONT
            }}
            onClick={close}
        >
            <div
                style={{
                    width: 'min(720px, 92vw)',
                    maxHeight: '86vh',
                    overflowY: 'auto',
                    background: '#171129',
                    borderRadius: 18,
                    boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
                    border: `1px solid ${p.accent}44`,
                    borderTop: `5px solid ${p.accent}`,
                    padding: 30,
                    color: '#f3efff',
                    position: 'relative'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 关闭按钮 */}
                <button
                    onClick={close}
                    style={{
                        position: 'absolute',
                        top: 14,
                        right: 16,
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        background: '#ffffff14',
                        color: '#f3efff',
                        fontSize: 18,
                        lineHeight: 1
                    }}
                >
                    ✕
                </button>

                <div style={{ fontSize: 13, letterSpacing: 3, color: p.accent }}>
                    {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                </div>
                <h2 style={{ margin: '6px 0 0', fontSize: 34, lineHeight: 1.2 }}>
                    {p.title}
                </h2>
                <p style={{ margin: '8px 0 0', opacity: 0.75, fontSize: 16 }}>
                    {p.subtitle}
                </p>

                <Tags tags={p.tags} accent={p.accent} />

                <div style={{ marginTop: 20, lineHeight: 1.75, fontSize: 16 }}>
                    {(p.desc || []).map((d, i) => (
                        <p key={i} style={{ margin: '0 0 10px' }}>
                            {d}
                        </p>
                    ))}
                </div>

                <Links links={p.links} accent={p.accent} />

                {/* 上一个 / 下一个 */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 26,
                        gap: 12
                    }}
                >
                    <button
                        onClick={prev}
                        style={navBtn}
                    >
                        ← 上一个
                    </button>
                    <span style={{ fontSize: 13, opacity: 0.5, alignSelf: 'center' }}>
                        ← → 切换 · Esc 关闭
                    </span>
                    <button
                        onClick={next}
                        style={navBtn}
                    >
                        下一个 →
                    </button>
                </div>
            </div>
        </div>
    );
};

const navBtn = {
    padding: '9px 16px',
    borderRadius: 9,
    border: '1px solid #ffffff26',
    background: '#ffffff10',
    color: '#f3efff',
    cursor: 'pointer',
    fontSize: 14
};

export default ProjectOverlay;
