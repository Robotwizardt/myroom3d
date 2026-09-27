// seam 1：锁屏滑条「拖了多少 → 解不解锁」的纯函数。
//
// 这条缝要锁住的真实 bug：DOM 屏被 three 的 <Html transform> 缩放（约 0.36~0.48 倍）
// 渲染，pointer 事件的 clientX 是「视口 px」，而轨道 offsetWidth 是「布局 px」。
// 旧代码直接拿视口 px 跟布局 px 的阈值比 → 真人把滑条拖到底也解不开。
import { describe, expect, it } from 'vitest';

import {
    FALLBACK_TRACK_WIDTH,
    KNOB_WIDTH,
    knobX,
    renderScale,
    shouldUnlock,
    travelWidth,
    UNLOCK_AT,
    unlockRatio
} from '../data/lockSlider';

// 布局 258px 的 iOS 6 滑条，在屏幕上渲染成 92px（缩放 ≈ 0.357，探针实测值）
const VIS = { offsetWidth: 258, rectWidth: 92 };

describe('锁屏滑条：视口位移换算成布局位移', () => {
    it('按「渲染宽 / 布局宽」算缩放，未挂载时为 1:1', () => {
        expect(renderScale(VIS)).toBeCloseTo(92 / 258, 5);
        expect(renderScale({ offsetWidth: 258, rectWidth: 0 })).toBe(1);
        expect(renderScale({ offsetWidth: 0, rectWidth: 0 })).toBe(1);
    });

    it('行程 = 轨道宽 - 把手宽（布局 px）', () => {
        expect(travelWidth({ offsetWidth: 258 })).toBeCloseTo(258 - KNOB_WIDTH, 5);
        // 轨道还没量到时回退到 iOS 6 布局宽
        expect(travelWidth({ offsetWidth: 0 })).toBeCloseTo(
            FALLBACK_TRACK_WIDTH - KNOB_WIDTH,
            5
        );
    });

    it('拖过可见行程的一半即解锁', () => {
        const travel = travelWidth(VIS); // 202 布局 px
        const scale = renderScale(VIS);
        const visibleHalf = (travel * scale) / 2; // ≈36 视口 px

        expect(shouldUnlock({ dx: visibleHalf, ...VIS })).toBe(true);
        expect(unlockRatio({ dx: visibleHalf, ...VIS })).toBeCloseTo(UNLOCK_AT, 2);
        expect(shouldUnlock({ dx: visibleHalf * 0.9, ...VIS })).toBe(false);
    });

    it('回归：在可见轨道里拖到底，必须解锁', () => {
        // 真人从把手左端拖到轨道右端：视口位移 = 可见行程
        const visibleTravel = travelWidth(VIS) * renderScale(VIS);
        expect(shouldUnlock({ dx: visibleTravel, ...VIS })).toBe(true);
        // 旧逻辑：阈值 (258-56)*0.55 = 111 布局 px，而视口里最多只能拖 72 px → 永远 false
        expect(visibleTravel).toBeLessThan((258 - KNOB_WIDTH) * 0.55);
    });

    it('判定只看「拖了几成可见行程」，与缩放无关', () => {
        // 同样 46 视口 px：屏小（0.357 倍）时已过半 → 解锁；屏大（0.714 倍）时不够 → 不解锁
        const small = { offsetWidth: 258, rectWidth: 92 };
        const large = { offsetWidth: 258, rectWidth: 184 };
        expect(shouldUnlock({ dx: 46, ...small })).toBe(true);
        expect(shouldUnlock({ dx: 46, ...large })).toBe(false);
        // 屏放大一倍，需要的视口位移也翻倍
        expect(shouldUnlock({ dx: 92, ...large })).toBe(true);
    });

    it('jsdom / 未挂载时也能解锁（offsetWidth 与 rect 都是 0）', () => {
        expect(shouldUnlock({ dx: 200 })).toBe(true);
        expect(shouldUnlock({ dx: 0 })).toBe(false);
    });

    it('没拖 / 反向拖 / 超拖都不会越界', () => {
        expect(shouldUnlock({ dx: 0, ...VIS })).toBe(false);
        expect(shouldUnlock({ dx: -40, ...VIS })).toBe(false);
        expect(knobX({ dx: -40, ...VIS })).toBe(0);
        expect(knobX({ dx: 99999, ...VIS })).toBeCloseTo(travelWidth(VIS), 5);
        expect(unlockRatio({ dx: 99999, ...VIS })).toBeCloseTo(1, 5);
    });
});
