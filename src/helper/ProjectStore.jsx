/* eslint-disable react-refresh/only-export-components */
import { create } from 'zustand';

import { PROJECTS } from '../data/projects';

/**
 * 记录"当前打开的是第几个项目"。
 * 【新增】的独立 store —— 没有改动原项目的 CameraStore，避免互相干扰。
 */
export const useProjectStore = create((set) => ({
    activeIndex: 0,
    // 弹出面板是否打开（点了某张卡才会 true）
    panelOpen: false,

    openProject: (index) => set({ activeIndex: index, panelOpen: true }),
    nextProject: () =>
        set((s) => ({ activeIndex: (s.activeIndex + 1) % PROJECTS.length })),
    prevProject: () =>
        set((s) => ({
            activeIndex: (s.activeIndex - 1 + PROJECTS.length) % PROJECTS.length
        })),
    closeProject: () => set({ panelOpen: false })
}));
