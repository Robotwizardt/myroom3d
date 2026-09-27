/**
 * 锁屏「滑动解锁」的纯几何逻辑（不碰 DOM / React，方便单测）。
 *
 * 为什么需要它：DOM 屏挂在 three 的 <Html transform> 里，被缩放成布局尺寸的
 * 0.36~0.48 倍渲染。于是 pointer 事件的 clientX 是「视口 px」，而轨道
 * offsetWidth 是「布局 px」——旧代码拿视口位移直接和布局阈值比，
 * 导致真人把滑条拖到底也解不开（实测：可见行程只有 72 视口 px，阈值却是 111 布局 px）。
 *
 * 这里统一：视口位移 ÷ (渲染宽/布局宽) = 布局位移，再按布局行程算「拖了几成」。
 * 判定只看比例（默认拖过一半即解锁），所以镜头拉近拉远、屏大屏小都不影响手感。
 */

export const KNOB_WIDTH = 56; // 把手默认宽（布局 px）
export const FALLBACK_TRACK_WIDTH = 258; // 轨道还没量到时的回退宽（iOS 6 滑条布局宽）
export const UNLOCK_AT = 0.5; // 拖过可见行程的一半即解锁

/** 轨道布局宽：量不到就用回退值（jsdom 里所有尺寸都是 0） */
export function trackWidth(offsetWidth = 0) {
    return offsetWidth > 0 ? offsetWidth : FALLBACK_TRACK_WIDTH;
}

/** 渲染缩放 = 渲染宽 / 布局宽；量不到渲染宽时按 1:1 */
export function renderScale({ rectWidth = 0, offsetWidth = 0 } = {}) {
    if (!(rectWidth > 0)) return 1;
    return rectWidth / trackWidth(offsetWidth);
}

/** 可拖动行程（布局 px）= 轨道宽 - 把手宽 */
export function travelWidth({ offsetWidth = 0, knobWidth = KNOB_WIDTH } = {}) {
    return Math.max(1, trackWidth(offsetWidth) - knobWidth);
}

/** 视口位移 → 布局位移 */
export function toLocalDelta({ dx = 0, rectWidth = 0, offsetWidth = 0 } = {}) {
    return dx / renderScale({ rectWidth, offsetWidth });
}

/** 把手的布局 x（夹在 0..行程内，反向拖与超拖都不会越界） */
export function knobX({ dx = 0, rectWidth = 0, offsetWidth = 0, knobWidth = KNOB_WIDTH } = {}) {
    const travel = travelWidth({ offsetWidth, knobWidth });
    const local = toLocalDelta({ dx, rectWidth, offsetWidth });
    return Math.max(0, Math.min(travel, local));
}

/** 拖动进度 0..1（1 = 拖到底） */
export function unlockRatio(opts = {}) {
    const { offsetWidth = 0, knobWidth = KNOB_WIDTH } = opts;
    return knobX(opts) / travelWidth({ offsetWidth, knobWidth });
}

/** 是否该解锁 */
export function shouldUnlock(opts = {}) {
    return unlockRatio(opts) >= UNLOCK_AT;
}
