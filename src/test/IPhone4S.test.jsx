import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LOCK_TIME, NOTES } from '../data/iphone4s';
import IPhone4S from '../RoomModel/iframes/IPhone4S';

// 392x809 是 3D 手机屏幕 DOM 的实际尺寸（见 smartphoneiFrame.jsx 的 transform 参数）
function renderPhone() {
    return render(<IPhone4S />);
}

// jsdom 没有 PointerEvent，testing-library 会退回普通 Event（clientX 丢失）。
// 用 MouseEvent 构造器伪造 pointer 事件：React 只认事件名，坐标能带上。
function pointerEvent(type, clientX) {
    return new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        pointerId: 1
    });
}

// 解锁：在滑条上按下 → 拖到最右 → 抬起
function unlockPhone() {
    const track = document.querySelector('div[style*="cursor: grab"]');
    fireEvent(track, pointerEvent('pointerdown', 30));
    fireEvent(track, pointerEvent('pointermove', 230));
    fireEvent(track, pointerEvent('pointerup', 230));
}

describe('iPhone4S 组件', () => {
    afterEach(cleanup);

    it('初始显示锁屏：9:41 + 滑动来解锁', () => {
        renderPhone();
        // 9:41 有两处（状态栏 + 大时钟），用 getAllAll 匹配多个
        expect(screen.getAllByText(LOCK_TIME).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('滑动来解锁')).toBeTruthy();
    });

    it('滑动解锁后进入主屏，Dock 上有 Safari', async () => {
        renderPhone();
        unlockPhone();
        expect(await screen.findByText('Safari')).toBeTruthy();
    });

    it('主屏点计算器图标进入计算器，按 1 + 2 = 显示 3', async () => {
        const { container } = renderPhone();
        unlockPhone();
        await screen.findByText('Safari');

        fireEvent.click(screen.getByText('计算器'));
        fireEvent.click(screen.getByText('1'));
        fireEvent.click(screen.getByText('+'));
        fireEvent.click(screen.getByText('2'));
        fireEvent.click(screen.getByText('='));
        // 显示屏的 3（'=' 后的结果），排除计算器数字键 3
        const display = container.querySelector(
            'div[style*="font-size: 56px"]'
        );
        expect(display.textContent).toBe('3');
    });

    it('虚拟 Home 键：进了计算器后点它回到主屏', async () => {
        renderPhone();
        unlockPhone();
        await screen.findByText('Safari');

        fireEvent.click(screen.getByText('计算器'));
        // 计算器界面独有元素：C 键
        expect(screen.getByText('C')).toBeTruthy();
        // Home 键（无文字，靠 title 找）
        fireEvent.click(screen.getByTitle('Home'));
        // 回主屏：Safari 重新出现
        expect(await screen.findByText('Safari')).toBeTruthy();
    });

    it('备忘录 App 显示预存纸条', async () => {
        renderPhone();
        unlockPhone();
        await screen.findByText('Safari');

        fireEvent.click(screen.getByText('备忘录'));
        expect(await screen.findByText(NOTES[0].title)).toBeTruthy();
    });
});
