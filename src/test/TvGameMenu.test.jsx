import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TvGameMenu } from '../RoomModel/iframes/TvGameMenu';

const A = { id: 'a', name: '游戏 A', rom: './assets/a.gba', core: 'gba', desc: '第一个' };
const B = { id: 'b', name: '游戏 B', rom: './assets/b.gba', core: 'gba' };
const GAMES = [A, B];

const setup = (props = {}) => {
    const handlers = {
        onSelect: vi.fn(),
        onStart: vi.fn(),
        onExit: vi.fn()
    };
    render(<TvGameMenu games={GAMES} index={0} probe={{}} saved={new Set()} {...handlers} {...props} />);
    return handlers;
};

const key = (code) => fireEvent.keyDown(window, { code });

describe('TvGameMenu 卡带菜单', () => {
    afterEach(cleanup);

    it('每个游戏一张卡带，只有 index 那张是选中的', () => {
        setup();
        const carts = screen.getAllByTestId('tv-cartridge');
        expect(carts).toHaveLength(2);
        expect(carts[0]).toHaveAttribute('data-selected', 'true');
        expect(carts[1]).toHaveAttribute('data-selected', 'false');
        expect(screen.getByTestId('tv-selected-name')).toHaveTextContent('游戏 A');
    });

    it('→ 选下一张，← 从头绕到最后一张', () => {
        const { onSelect } = setup();
        key('ArrowRight');
        expect(onSelect).toHaveBeenLastCalledWith(1);
        cleanup();
        const again = setup();
        key('ArrowLeft');
        expect(again.onSelect).toHaveBeenLastCalledWith(1);
    });

    it('只有一个游戏时左右键不动', () => {
        const { onSelect } = setup({ games: [A] });
        key('ArrowRight');
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('Enter 开始当前选中的游戏', () => {
        const { onStart } = setup();
        key('Enter');
        expect(onStart).toHaveBeenCalledWith(A);
    });

    it('ROM 缺失的卡带变灰、显示缺失提示，Enter 也点不动', () => {
        const { onStart } = setup({ probe: { a: 'missing' } });
        expect(screen.getAllByTestId('tv-cartridge')[0]).toHaveAttribute('data-missing', 'true');
        expect(screen.getByTestId('tv-missing-a')).toBeInTheDocument();
        expect(screen.getByTestId('tv-start-hint')).toHaveTextContent('卡带文件缺失');
        key('Enter');
        expect(onStart).not.toHaveBeenCalled();
    });

    it('点非选中卡带只切高亮，点选中那张才开始', () => {
        const { onSelect, onStart } = setup();
        fireEvent.click(screen.getAllByTestId('tv-cartridge')[1]);
        expect(onSelect).toHaveBeenCalledWith(1);
        expect(onStart).not.toHaveBeenCalled();
        fireEvent.click(screen.getAllByTestId('tv-cartridge')[0]);
        expect(onStart).toHaveBeenCalledWith(A);
    });

    it('有存档的游戏卡带上有存档点，没有的不显示', () => {
        setup({ saved: new Set(['b']) });
        expect(screen.queryByTestId('tv-save-dot-a')).not.toBeInTheDocument();
        expect(screen.getByTestId('tv-save-dot-b')).toBeInTheDocument();
    });

    it('右上角 ✕ 与 Esc 都是退出电视', () => {
        const { onExit } = setup();
        fireEvent.click(screen.getByTestId('tv-menu-exit'));
        expect(onExit).toHaveBeenCalledTimes(1);
        key('Escape');
        expect(onExit).toHaveBeenCalledTimes(2);
        key('Backspace');
        expect(onExit).toHaveBeenCalledTimes(3);
    });

    it('空清单给一句提示，不崩', () => {
        setup({ games: [] });
        expect(screen.getByTestId('tv-game-menu')).toBeInTheDocument();
        expect(screen.getByTestId('tv-selected-name')).toHaveTextContent('—');
    });

    it('底部常驻两行按键说明', () => {
        setup();
        const hint = screen.getByTestId('tv-keys-hint');
        expect(hint).toHaveTextContent('← → 选卡带');
        expect(hint).toHaveTextContent('Z = A');
    });
});
