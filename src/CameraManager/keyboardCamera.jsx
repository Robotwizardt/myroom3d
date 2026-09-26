/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/display-name */
/* eslint-disable react/prop-types */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import { useCameraStore } from '../helper/CameraStore';

// 和 CameraManager.jsx 里 default 分支的 setLookAt 保持一致
const DEFAULT_VIEW = [14, 10, -14, 0, -1, 0];
// 房间实际尺寸约 13.6 x 6.4 x 14 单位。
// 初版设 5 单位/秒，实测按住 2.5 秒位移 12.4 单位＝一把直接从房间这头飞到那头。
// 降到 2 单位/秒（按住 2.5 秒约 5 单位），配合 Shift 加速到 4，走位更可控。
const MOVE_SPEED = 2; // 单位/秒
const SHIFT_MULTIPLIER = 2; // 按住 Shift 时的加速倍率
const ROT_SPEED = 0.6; // 弧度/秒（初版 1.2，实测 2.5 秒能转 1.5 弧度，太快）

/**
 * 键盘移动 —— 这是在原项目基础上【新增】的功能。
 * 原项目 src/ 下没有任何键盘监听，只能用鼠标拖拽 / 滚轮操作相机。
 *
 * 说明：聚焦状态（desktop / laptop / tv / smartphone / displayBoard）下
 * camera-controls 的角度被 CameraManager 锁死，所以此时移动会被夹回去；
 * 必须先按 R 回到 default 全景状态才能自由走动。
 *
 * 键位：
 *   W / S      前进 / 后退
 *   A / D      左移 / 右移
 *   Q / E      下降 / 上升
 *   ↑ ↓ ← →    转动视角（绕注视点环绕）
 *   Shift      加速（按住时移动速度翻倍）
 *   R          回到房间全景视角
 */

/** 每帧调用的驱动逻辑，单独导出方便复用 */
export const KeyboardMoveDriver = ({ controlsRef }) => {
    const keys = useRef(new Set());

    useEffect(() => {
        const isTyping = (t) =>
            t &&
            (t.tagName === 'INPUT' ||
                t.tagName === 'TEXTAREA' ||
                t.isContentEditable);

        const onDown = (e) => {
            if (isTyping(e.target)) return;
            keys.current.add(e.code);
            if (e.code.startsWith('Arrow')) e.preventDefault();
        };
        const onUp = (e) => keys.current.delete(e.code);
        // 窗口失焦时清空按键，避免"卡键"
        const onBlur = () => keys.current.clear();

        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
            window.removeEventListener('blur', onBlur);
        };
    }, []);

    // 开发模式下的调试出口：把控制器挂到 window，方便脚本读取真实相机坐标做验收
    // （生产构建不会打包这段代码）
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const id = setInterval(() => {
            if (controlsRef.current) window.__ctrl = controlsRef.current;
        }, 500);
        return () => clearInterval(id);
    }, []);

    useFrame((_, delta) => {
        const controls = controlsRef.current;
        if (!controls) return;

        const k = keys.current;
        if (k.size === 0) return;

        // 和系统代理一样，限制单帧步长：切后台再回来时 delta 会很大，不限制会瞬移
        const dt = Math.min(delta, 0.1);
        // 按住 Shift 加速
        const move = (k.has('ShiftLeft') || k.has('ShiftRight') ? MOVE_SPEED * SHIFT_MULTIPLIER : MOVE_SPEED) * dt;
        const rot = ROT_SPEED * dt; // 转向速度（弧度/秒）

        // W/S 前后  A/D 左右  Q/E 升降
        if (k.has('KeyW')) controls.forward(move, false);
        if (k.has('KeyS')) controls.forward(-move, false);
        if (k.has('KeyA')) controls.truck(-move, 0, false);
        if (k.has('KeyD')) controls.truck(move, 0, false);
        if (k.has('KeyQ')) controls.elevate(-move, false);
        if (k.has('KeyE')) controls.elevate(move, false);

        // 方向键转视角（default 状态下 azimuth/polar 有范围限制，超出会被自动夹回来）
        if (k.has('ArrowLeft')) controls.rotate(-rot, 0, false);
        if (k.has('ArrowRight')) controls.rotate(rot, 0, false);
        if (k.has('ArrowUp')) controls.rotate(0, -rot, false);
        if (k.has('ArrowDown')) controls.rotate(0, rot, false);
    });

    return null;
};

/** 按 R 回到房间全景视角 */
export const ResetKey = ({ controlsRef }) => {
    useEffect(() => {
        const onDown = (e) => {
            if (e.code !== 'KeyR') return;
            const t = e.target;
            if (
                t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.isContentEditable)
            )
                return;
            useCameraStore.getState().default();
            // 关键：如果当前已经是 default 状态，光改 store 不会触发 CameraManager 重渲染，
            // 相机就不会被拉回去。所以这里再直接对控制器下一次 setLookAt，保证 R 一定能复位。
            const controls = controlsRef.current;
            if (controls) controls.setLookAt(...DEFAULT_VIEW, true);
        };
        window.addEventListener('keydown', onDown);
        return () => window.removeEventListener('keydown', onDown);
    }, []);
    return null;
};

export default KeyboardMoveDriver;
