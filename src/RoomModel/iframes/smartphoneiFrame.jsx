/* eslint-disable react/display-name */
import { Html } from '@react-three/drei';
import React, { useMemo } from 'react';

import { useCameraStore } from '../../helper/CameraStore';
import IPhone4S from './IPhone4S';

/**
 * 手机屏幕 —— iPhone 4s 复古模拟器（本地 React 组件，非 iframe）。
 * 进手机特写后：锁屏（滑动解锁）→ 主屏 20 个拟物图标 →
 * 时钟/计算器/备忘录三个真 App + 地图「无网络连接」彩蛋 → Home 键回主屏。
 * 详见 src/data/iphone4s.js 和 src/RoomModel/iframes/IPhone4S.jsx。
 */
const SmartphoneiFrame = React.memo(() => {
    const cameraState = useCameraStore((state) => state.cameraState);

    const isSmartphone = useMemo(
        () => cameraState === 'smartphone',
        [cameraState]
    );

    return (
        <group>
            {isSmartphone && (
                <Html
                    occlude="blending"
                    rotation-y={Math.PI}
                    rotation-x={Math.PI / 2}
                    rotation-z={-Math.PI / 6}
                    transform
                    wrapperClass="htmlPhoneScreen"
                    distanceFactor={0.285}
                    position={[1.6395, 1.125, -1.373]}
                    zIndexRange={[2, 1]}
                >
                    <IPhone4S />
                </Html>
            )}
        </group>
    );
});

export default SmartphoneiFrame;
