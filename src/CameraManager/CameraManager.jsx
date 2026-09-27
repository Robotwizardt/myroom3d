import { CameraControls } from '@react-three/drei';
import { useRef } from 'react';
import { useEffect } from 'react';

import { useCameraStore } from '../helper/CameraStore';
import { KeyboardMoveDriver, ResetKey } from './keyboardCamera';

export const CameraManager = () => {
    const cameraControle = useRef();

    const cameraState = useCameraStore((state) => state.cameraState);

    const maxDistancce = useCameraStore((state) => state.maxDistancce);
    const minDistance = useCameraStore((state) => state.minDistance);
    const maxAzimuthAngle = useCameraStore((state) => state.maxAzimuthAngle);
    const minAzimuthAngle = useCameraStore((state) => state.minAzimuthAngle);
    const minPolarAngle = useCameraStore((state) => state.minPolarAngle);
    const maxPolarAngle = useCameraStore((state) => state.maxPolarAngle);
    const truckSpeed = useCameraStore((state) => state.truckSpeed);
    const dollyToCursor = useCameraStore((state) => state.dollyToCursor);
    const enable = useCameraStore((state) => state.enable);

    useEffect(() => {
        if (cameraState === 'default') {
            useCameraStore.setState({ truckSpeed: 0.5 });
            useCameraStore.setState({ dollyToCursor: true });
            useCameraStore.setState({ minDistance: 2 });
            useCameraStore.setState({ maxDistancce: 25 });
            useCameraStore.setState({ minPolarAngle: Math.PI * 0.1 });
            useCameraStore.setState({ maxPolarAngle: Math.PI * 0.45 });
            useCameraStore.setState({ minAzimuthAngle: Math.PI * 0.5 });
            useCameraStore.setState({ maxAzimuthAngle: Math.PI });
            cameraControle.current.setLookAt(14, 10, -14, 0, -1, 0, true);
        }

        if (cameraState === 'desktop') {
            useCameraStore.setState({ truckSpeed: 0 });
            useCameraStore.setState({ dollyToCursor: false });
            useCameraStore.setState({ minDistance: 5.65 });
            useCameraStore.setState({ maxDistancce: 7.1 });
            useCameraStore.setState({ minPolarAngle: Math.PI * 0.5 });
            useCameraStore.setState({ maxPolarAngle: Math.PI * 0.5 });
            useCameraStore.setState({ minAzimuthAngle: Math.PI });
            useCameraStore.setState({ maxAzimuthAngle: Math.PI });
            cameraControle.current.setLookAt(2.1, 0.3, 2, 2.1, 0.3, 8, true);
        }

        if (cameraState === 'laptop') {
            useCameraStore.setState({ truckSpeed: 0 });
            useCameraStore.setState({ dollyToCursor: false });
            useCameraStore.setState({ minDistance: 4.2 });
            useCameraStore.setState({ maxDistancce: 6 });
            useCameraStore.setState({ minPolarAngle: Math.PI * 0.435 });
            useCameraStore.setState({ maxPolarAngle: Math.PI * 0.435 });
            useCameraStore.setState({ minAzimuthAngle: Math.PI * 0.689 });
            useCameraStore.setState({ maxAzimuthAngle: Math.PI * 0.689 });
            cameraControle.current.setLookAt(2, 0, 2.5, -2, -1, 5.2, true);
        }

        if (cameraState === 'tv') {
            useCameraStore.setState({ truckSpeed: 0 });
            useCameraStore.setState({ dollyToCursor: false });
            useCameraStore.setState({ minDistance: 5.6 });
            useCameraStore.setState({ maxDistancce: 6.5 });
            useCameraStore.setState({ minPolarAngle: Math.PI * 0.5 });
            useCameraStore.setState({ maxPolarAngle: Math.PI * 0.5 });
            useCameraStore.setState({ minAzimuthAngle: 0 });
            useCameraStore.setState({ maxAzimuthAngle: 0 });
            cameraControle.current.setLookAt(2.5, -0.1, 1, 2.5, -0.1, -5, true);
        }

        if (cameraState === 'smartphone') {
            // 特写：相机飞到机身正上方偏 12°（近乎垂直的「产品照」机位），
            // 看「实体机身 + DOM 屏」。机身世界中心 [1.6725,-1.6135,-0.7941]
            // （旧贴图面画面中心再叠加 BODY_DROP_TO_DESK = -0.0453，让机身底面落到桌面）。
            // 机位水平方向取「Home 键那一侧」的反方向（机身局部 +X 在世界里指向
            // (0.569, -0.822)，相机放在 -X 侧 → 屏幕上的 iOS 界面在画面里是正着的；
            // 从听筒那一侧看会把整块 UI 看成倒转 180°）。
            // 极角/方位角约束跟实拍视角对齐（polar≈0.067π、azimuth≈-0.205π），
            // 否则一拖动就会被约束「吸」回旧机位、视角突然跳开。
            // 屏被 3D 缩放时「视口 px ≠ 布局 px」，所以滑动解锁靠
            // data/lockSlider.js 的换算（按渲染宽/布局宽），不会因为镜头远近失效。
            useCameraStore.setState({ truckSpeed: 0 });
            useCameraStore.setState({ dollyToCursor: false });
            useCameraStore.setState({ minDistance: 1.0 });
            useCameraStore.setState({ maxDistancce: 1.35 });
            useCameraStore.setState({ minPolarAngle: Math.PI * 0.05 });
            useCameraStore.setState({ maxPolarAngle: Math.PI * 0.085 });
            useCameraStore.setState({ minAzimuthAngle: -Math.PI * 0.225 });
            useCameraStore.setState({ maxAzimuthAngle: -Math.PI * 0.185 });
            cameraControle.current.setLookAt(
                1.52904,
                -0.48868,
                -0.60283,
                1.6725,
                -1.6135,
                -0.7941,
                true
            );
        }

        if (cameraState === 'displayBoard') {
            useCameraStore.setState({ truckSpeed: 0 });
            useCameraStore.setState({ dollyToCursor: true });
            useCameraStore.setState({ minDistance: 4 });
            useCameraStore.setState({ maxDistancce: 8 });
            useCameraStore.setState({ minPolarAngle: Math.PI * 0.4999 });
            useCameraStore.setState({ maxPolarAngle: Math.PI * 0.5 });
            useCameraStore.setState({ minAzimuthAngle: Math.PI * 0.5 });
            useCameraStore.setState({ maxAzimuthAngle: Math.PI * 0.50001 });
            cameraControle.current.setLookAt(
                -2,
                0.12,
                -1.5,
                -8,
                0.12,
                -1.5,
                true
            );
        }
    });

    return (
        <>
            <CameraControls
                makeDefault={true}
                ref={cameraControle}
                dollyToCursor={dollyToCursor}
                dollySpeed={1.2}
                truckSpeed={truckSpeed}
                minDistance={minDistance}
                maxDistance={maxDistancce}
                smoothTime={0.8}
                maxAzimuthAngle={maxAzimuthAngle}
                minAzimuthAngle={minAzimuthAngle}
                minPolarAngle={minPolarAngle}
                maxPolarAngle={maxPolarAngle}
                polarRotateSpeed={0.3}
                azimuthRotateSpeed={0.3}
                maxSpeed={20}
                enableTransition={true}
                boundaryFriction={0}
                boundaryEnclosesCamera={true}
                interactiveArea={[0.5, 0.5, 1, 1]}
                enabled={enable}
            />

            {/* 键盘移动（【新增】）：和上面的 CameraControls 共用同一个 ref，直接驱动同一个控制器 */}
            <KeyboardMoveDriver controlsRef={cameraControle} />
            {/* 按 R 回到全景视角（【新增】） */}
            <ResetKey controlsRef={cameraControle} />
        </>
    );
};
