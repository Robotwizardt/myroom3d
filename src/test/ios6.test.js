// seam 2：iOS 6（iPhone 4s，320×480pt）的布局数据表。
// 测的是数据之间的相互关系（能不能装进屏、顺序对不对、数量对不对），不是抄一遍常量。
import { describe, expect, it } from 'vitest';

import { IOS6, SPRINGBOARD_CAPACITY } from '../data/ios6';
import { DOCK_ICONS, HOME_ICONS } from '../data/iphone4s';

const { screen, statusBar, springboard, pageDots, dock, lockScreen } = IOS6;

// 主屏图标网格的实际占位（含图标下方文字）
const gridBottom =
    springboard.gridTop +
    (springboard.rows - 1) * springboard.rowPitch +
    springboard.iconSize +
    springboard.labelGap +
    springboard.labelHeight;

describe('iOS 6 屏幕', () => {
    it('屏是 4s 的 3:2 且 2 倍图（320×480pt = 640×960px）', () => {
        expect(screen.width / screen.height).toBeCloseTo(2 / 3, 5);
        expect(screen.nativeWidth).toBe(screen.width * screen.scale);
        expect(screen.nativeHeight).toBe(screen.height * screen.scale);
    });

    it('状态栏 20pt，网格从状态栏下方开始', () => {
        expect(statusBar.height).toBe(20);
        expect(springboard.gridTop).toBeGreaterThan(statusBar.height);
    });
});

describe('主屏图标网格（4×5）', () => {
    it('4 列 5 行，容量 20', () => {
        expect(springboard.columns).toBe(4);
        expect(springboard.rows).toBe(5);
        expect(SPRINGBOARD_CAPACITY).toBe(20);
    });

    it('横向居中且不超出屏宽', () => {
        const used = (springboard.columns - 1) * springboard.columnPitch + springboard.iconSize;
        expect(used).toBeLessThanOrEqual(screen.width);
        const side = (screen.width - used) / 2;
        expect(side).toBeGreaterThanOrEqual(6);
        expect(side).toBeCloseTo((screen.width - used) / 2, 5);
    });

    it('纵向：网格、页码点、Dock 依次排到底，且互不重叠', () => {
        expect(gridBottom).toBeLessThanOrEqual(pageDots.y);
        expect(pageDots.y + pageDots.size).toBeLessThanOrEqual(dock.top);
        expect(dock.top + dock.height).toBeCloseTo(screen.height, 5);
    });

    it('图标尺寸和圆角是 4s 的 57pt 圆角方（不是胶囊）', () => {
        expect(springboard.iconSize).toBe(57);
        expect(springboard.iconRadius).toBeGreaterThan(8);
        expect(springboard.iconRadius).toBeLessThan(springboard.iconSize / 2);
    });
});

describe('页码点与 Dock', () => {
    it('页码点数量与当前页都在合理范围', () => {
        expect(pageDots.count).toBeGreaterThanOrEqual(2);
        expect(pageDots.active).toBeGreaterThanOrEqual(0);
        expect(pageDots.active).toBeLessThan(pageDots.count);
    });

    it('Dock 装 4 个图标，图标与主屏同尺寸', () => {
        expect(DOCK_ICONS.length).toBe(4);
        expect(dock.iconSize).toBe(springboard.iconSize);
        expect(dock.iconTop).toBeGreaterThan(dock.top);
        expect(dock.iconTop + dock.iconSize).toBeLessThan(screen.height);
    });
});

describe('App 表与主屏容量一致', () => {
    it('主屏正好放满 4×5 = 20 个 App', () => {
        expect(HOME_ICONS.length).toBe(SPRINGBOARD_CAPACITY);
    });

    it('每个 App 有唯一 id 和名字', () => {
        const ids = HOME_ICONS.map((icon) => icon.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const icon of [...HOME_ICONS, ...DOCK_ICONS]) {
            expect(icon.name.length).toBeGreaterThan(0);
        }
    });
});

describe('锁屏', () => {
    it('大时钟在状态栏下方，滑条靠近底部', () => {
        expect(lockScreen.clockTop).toBeGreaterThan(statusBar.height);
        expect(lockScreen.clockTop + lockScreen.clockSize).toBeLessThan(pageDots.y);
        expect(lockScreen.slider.bottom).toBeGreaterThanOrEqual(20);
        expect(lockScreen.slider.bottom + lockScreen.slider.height).toBeLessThan(
            screen.height
        );
    });

    it('滑条比屏窄、把手比轨道短（留得下拖动行程）', () => {
        expect(lockScreen.slider.width).toBeLessThan(screen.width);
        expect(lockScreen.slider.knob).toBeLessThan(lockScreen.slider.width / 2);
        expect(lockScreen.slider.height).toBeGreaterThanOrEqual(lockScreen.slider.knob);
    });
});
