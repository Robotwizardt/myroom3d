/**
 * 卡片数据 + 卡片-图标映射 的单元测试
 * 接缝（公开接口）：PROJECTS、CARD_TO_PROJECT、useProjectStore
 */
import { describe, expect, it } from 'vitest';

import { CARD_TO_PROJECT, PROJECTS } from '../data/projects';
import { useProjectStore } from '../helper/ProjectStore';

describe('PROJECTS 卡片数据', () => {
    it('正好有 6 张卡', () => {
        expect(PROJECTS).toHaveLength(6);
    });

    it('每张卡都有 id / type / title / subtitle / accent', () => {
        for (const p of PROJECTS) {
            expect(p.id).toBeTruthy();
            expect(p.type).toBeTruthy();
            expect(typeof p.title).toBe('string');
            expect(typeof p.subtitle).toBe('string');
            expect(p.accent).toMatch(/^#/);
        }
    });

    it('id 不重复', () => {
        const ids = PROJECTS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('覆盖 6 种功能类型：bilibili/map/game/music/home 各就位', () => {
        const types = PROJECTS.map((p) => p.type);
        expect(types).toContain('bilibili');
        expect(types).toContain('map');
        expect(types).toContain('game');
        expect(types).toContain('music');
        expect(types).toContain('home');
    });
});

describe('CARD_TO_PROJECT 图标→卡片映射', () => {
    it('6 个图标各自映射到一张卡', () => {
        expect(CARD_TO_PROJECT.desktop).toBeDefined();
        expect(CARD_TO_PROJECT.smartphone).toBeDefined();
        expect(CARD_TO_PROJECT.tv).toBeDefined();
        expect(CARD_TO_PROJECT.laptop).toBeDefined();
        expect(CARD_TO_PROJECT.music).toBeDefined();
        expect(CARD_TO_PROJECT.home).toBeDefined();
    });

    it('映射的索引都落在 PROJECTS 范围内', () => {
        for (const key of Object.keys(CARD_TO_PROJECT)) {
            const idx = CARD_TO_PROJECT[key];
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(PROJECTS.length);
        }
    });

    it('显示器→bilibili，手机→map，电视→game', () => {
        expect(PROJECTS[CARD_TO_PROJECT.desktop].type).toBe('bilibili');
        expect(PROJECTS[CARD_TO_PROJECT.smartphone].type).toBe('map');
        expect(PROJECTS[CARD_TO_PROJECT.tv].type).toBe('game');
    });
});

describe('useProjectStore 状态', () => {
    it('openProject 打开面板并定位到指定卡', () => {
        useProjectStore.getState().openProject(2);
        const s = useProjectStore.getState();
        expect(s.panelOpen).toBe(true);
        expect(s.activeIndex).toBe(2);
    });

    it('closeProject 只关面板，不重置索引', () => {
        useProjectStore.getState().openProject(3);
        useProjectStore.getState().closeProject();
        const s = useProjectStore.getState();
        expect(s.panelOpen).toBe(false);
        expect(s.activeIndex).toBe(3);
    });

    it('next/prev 循环切换', () => {
        const n = PROJECTS.length;
        useProjectStore.getState().openProject(n - 1);
        useProjectStore.getState().nextProject();
        expect(useProjectStore.getState().activeIndex).toBe(0);
        useProjectStore.getState().prevProject();
        expect(useProjectStore.getState().activeIndex).toBe(n - 1);
    });
});
