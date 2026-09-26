/**
 * 大面板（ProjectOverlay）渲染与交互测试
 * 接缝：组件渲染出来的 DOM + ProjectStore 状态联动
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PROJECTS } from '../data/projects';
import { useProjectStore } from '../helper/ProjectStore';
import { ProjectOverlay } from '../RoomModel/ProjectPanel';

beforeEach(() => {
    useProjectStore.setState({ activeIndex: 0, panelOpen: false });
});
afterEach(cleanup);

describe('ProjectOverlay 大面板', () => {
    it('面板关闭时不渲染任何内容', () => {
        const { container } = render(<ProjectOverlay />);
        expect(container.firstChild).toBeNull();
    });

    it('openProject 后显示对应卡的标题与简介', () => {
        useProjectStore.getState().openProject(0);
        render(<ProjectOverlay />);
        expect(screen.getByText(PROJECTS[0].title)).toBeInTheDocument();
        expect(screen.getByText(PROJECTS[0].subtitle)).toBeInTheDocument();
    });

    it('显示当前序号 / 总数', () => {
        useProjectStore.getState().openProject(2);
        render(<ProjectOverlay />);
        const total = String(PROJECTS.length).padStart(2, '0');
        expect(screen.getByText(new RegExp(`03 / ${total}`))).toBeInTheDocument();
    });

    it('按 Escape 关闭面板', () => {
        useProjectStore.getState().openProject(1);
        render(<ProjectOverlay />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(useProjectStore.getState().panelOpen).toBe(false);
    });

    it('按右方向键切到下一张', () => {
        useProjectStore.getState().openProject(1);
        render(<ProjectOverlay />);
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(useProjectStore.getState().activeIndex).toBe(2);
    });
});
