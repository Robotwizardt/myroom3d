/* eslint-disable react/prop-types */
import { useState } from 'react';

/**
 * 播放器里的封面件（见 ADR-0002）：
 *   AlbumArt  = 封面图 + 加载失败/无图时降级成灰底 ♪ 占位块（尺寸不变，布局不跳）
 *   VinylDisc = 黑胶片 + 中心圆形封面 + 唱针（播放时 20s/圈、唱针落在盘上；暂停时静止、唱针抬起）
 * 拆成单独文件是为了能在 jsdom 里直接测（MusicPlayer 整体要 fetch + audio，不好测）。
 * 面板的 keyframes / 滚动条样式在 ./PlayerStyles.jsx。
 */

/** 黑胶转盘尺寸与转速。唱针的尺寸都按 plate 换算，改这一个数整盘一起缩放。 */
const VINYL = {
    plate: 140, // 黑胶片直径
    cover: 100, // 中心封面直径
    spinSeconds: 20, // 转一圈要几秒
    needleMs: 300 // 唱针落下/抬起耗时
};

const PLACEHOLDER_BG = 'rgba(255,255,255,0.09)';

/**
 * 封面图。url 为空或加载失败时显示灰底 ♪ 占位块。
 * 失败的记的是「哪个 url 失败了」，所以换歌（新 url）会自动重新尝试加载。
 */
export const AlbumArt = ({ url, size = 36, radius = 5, alt = '', testId = 'album-art' }) => {
    const [failedUrl, setFailedUrl] = useState(null);
    const box = {
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: PLACEHOLDER_BG,
        overflow: 'hidden'
    };

    if (!url || failedUrl === url) {
        return (
            <div data-testid={`${testId}-placeholder`} style={box} aria-label={alt || '暂无封面'}>
                <span
                    style={{
                        fontSize: Math.round(size * 0.45),
                        color: 'rgba(255,255,255,0.42)',
                        lineHeight: 1
                    }}
                >
                    ♪
                </span>
            </div>
        );
    }

    return (
        <img
            data-testid={testId}
            src={url}
            alt={alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setFailedUrl(url)}
            style={{ ...box, objectFit: 'cover', display: 'block' }}
        />
    );
};

/** 黑胶转盘：点一下 = 播放/暂停（命中面积比 header 的小按钮大得多） */
export const VinylDisc = ({ url, spinning = false, onToggle, alt = '' }) => (
    <button
        type="button"
        data-testid="vinyl-disc"
        aria-label={spinning ? '暂停' : '播放'}
        title={spinning ? '暂停' : '播放'}
        onClick={(e) => {
            // 别让点击漏到 canvas 的 raycast 上（会误触 3D mesh 把镜头带跑）
            e.stopPropagation();
            if (onToggle) onToggle();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        style={{
            position: 'relative',
            width: VINYL.plate + 8,
            height: VINYL.plate + 8,
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
        }}
    >
        <div
            data-testid="vinyl-plate"
            style={{
                width: VINYL.plate,
                height: VINYL.plate,
                borderRadius: '50%',
                // 黑胶纹路：中心孔 → 亮圈 → 暗槽交替，纯 CSS 画，不引用图片
                background:
                    'radial-gradient(circle at 50% 50%, #0b0b0d 0 44%, #26262b 44% 47%, #131316 47% 62%, #222228 62% 64%, #101013 64% 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(0,0,0,0.55)',
                animation: `vinylSpin ${VINYL.spinSeconds}s linear infinite`,
                animationPlayState: spinning ? 'running' : 'paused'
            }}
        >
            <AlbumArt url={url} size={VINYL.cover} radius="50%" testId="vinyl-cover" alt={alt} />
        </div>
        <span
            data-testid="vinyl-needle"
            style={{
                position: 'absolute',
                top: -2,
                left: '50%',
                marginLeft: Math.round(VINYL.plate * 0.072),
                width: Math.max(4, Math.round(VINYL.plate * 0.036)),
                height: Math.round(VINYL.plate * 0.414),
                borderRadius: 3,
                background: 'linear-gradient(180deg, #f2f3f5, #9aa0a6)',
                transformOrigin: 'top center',
                transform: spinning ? 'rotate(24deg)' : 'rotate(0deg)',
                transition: `transform ${VINYL.needleMs}ms ease`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.6)'
            }}
        />
    </button>
);
