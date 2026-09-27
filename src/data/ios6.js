/**
 * iOS 6 主屏 / 锁屏的布局数据表（iPhone 4s：320×480 pt，@2x 640×960 px）。
 *
 * 单位一律是「pt = DOM 屏的 CSS px」，屏在 3D 场景里的世界尺寸由
 * iphone4sBody.js 的 SCREEN.distanceFactor 换算，UI 这边不关心世界尺寸。
 *
 * 版式对齐真机 iOS 6：
 *   ┌──────────────────┐ 0
 *   │ 状态栏 20pt       │
 *   ├──────────────────┤ 20
 *   │ 4×5 图标网格 57pt │ 26 起，列距 80、行距 69
 *   │                  │ 网格底 373（含图标下文字）
 *   │ 页码点            │ 376
 *   ├──────────────────┤ 384
 *   │ 玻璃 Dock 96pt    │ 图标 57pt，与主屏同尺寸
 *   └──────────────────┘ 480
 */

export const IOS6 = {
    screen: {
        width: 320,
        height: 480,
        scale: 2, // @2x
        nativeWidth: 640,
        nativeHeight: 960
    },
    statusBar: {
        height: 20,
        fontSize: 12 // iOS 6 状态栏字重粗、无阴影
    },
    springboard: {
        columns: 4,
        rows: 5,
        iconSize: 57,
        iconRadius: 10, // 圆角方（4s 的 10.5pt 缩放后取整）
        columnPitch: 80,
        rowPitch: 69,
        gridTop: 26,
        labelGap: 2,
        labelHeight: 12,
        labelSize: 11
    },
    pageDots: {
        count: 3,
        active: 0, // 0 基
        size: 7,
        gap: 9,
        y: 376
    },
    dock: {
        top: 384,
        height: 96,
        iconSize: 57, // 与主屏图标等大
        iconTop: 396,
        shelfMargin: 6,
        shelfRadius: 12
    },
    lockScreen: {
        clockTop: 64,
        clockSize: 60,
        dateTop: 132,
        dateSize: 15,
        slider: { width: 258, height: 48, bottom: 56, knob: 44 }
    },
    dialog: {
        width: 240,
        radius: 9
    },
    // 应用内通用
    navBar: { height: 44 },
    homeIndicator: { size: 34 } // 屏内的 Home 键热区（真机在边框上，这里做成可点热区）
};

/** 主屏一页能放多少个 App（4×5） */
export const SPRINGBOARD_CAPACITY = IOS6.springboard.columns * IOS6.springboard.rows;

/** 第 index 个图标在网格里的位置（0 基，行/列 + 左上角 + 中心点） */
export function springboardCell(index) {
    const { columns, rows, iconSize, columnPitch, rowPitch, gridTop } = IOS6.springboard;
    if (!Number.isInteger(index) || index < 0 || index >= columns * rows) return null;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const used = (columns - 1) * columnPitch + iconSize;
    const left = (IOS6.screen.width - used) / 2 + col * columnPitch;
    const top = gridTop + row * rowPitch;
    return {
        row,
        col,
        left,
        top,
        centerX: left + iconSize / 2,
        centerY: top + iconSize / 2
    };
}
