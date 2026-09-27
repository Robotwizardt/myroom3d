/* eslint-disable react/display-name */
/* eslint-disable react/prop-types -- 内部组件，children 由 DispFrame 传入 */
import { Html } from '@react-three/drei';
import React, { useMemo } from 'react';

import { BODY, HOME_HIT, SCREEN } from '../../data/iphone4sBody';
import { HOME_EVENT } from '../../data/iphone4s';
import { useCameraStore } from '../../helper/CameraStore';
import IPhone4S from './IPhone4S';

/**
 * 手机屏幕 —— iPhone 4s 复古模拟器（本地 React 组件，非 iframe）。
 *
 * 对齐版：Html 不再挂在悬空位置，而是挂在机身 group 的屏幕开口处——
 * 机身（IPhone4SBody）与 DOM 屏共用 glb smartphoneDisp 的变换，
 * 相机特写时飞到机身正上方，看到「实体机身 + 屏在机身里」。
 *
 * 转向（两层嵌套 group）：
 *   外层 rotation=[0,-π/2,0]：把 Html 的默认朝向转成局部 X=DOM 的竖向；
 *   Html 自身 rotation-x=-π/2：让 DOM 平躺、内容朝 +Y（屏幕面法线）。
 *   合成映射：DOM 顶边 → 机身 +X（听筒端）、DOM 法线 → +Y。
 *   挂点在屏幕开口中心（SCREEN.centerX，BODY.depth+ε）——与机身暗面重合。
 *
 * 世界尺寸换算（探针13验证）：worldSize = cssPx × distanceFactor/400。
 * distanceFactor 见 src/data/iphone4sBody.js 的 SCREEN。
 *
 * 屏内容：锁屏（滑动解锁）→ 主屏 20 个拟物图标 →
 * 时钟/计算器/备忘录三个真 App + 地图「无网络连接」彩蛋 → Home 键回主屏。
 * 详见 src/data/iphone4s.js 和 src/RoomModel/iframes/IPhone4S.jsx。
 *
 * 机身 Home 键：特写里 canvas 的 pointerEvents 被 drei 设成 none，
 * R3F 的 mesh onClick 拿不到鼠标事件，所以在 DOM 层补一块透明热区
 * （位置尺寸见 iphone4sBody.js 的 HOME_HIT），点它派发 HOME_EVENT。
 */
const stopPhoneEvent = (e) => e.stopPropagation();

const SmartphoneiFrame = React.memo(({ children }) => {
    const cameraState = useCameraStore((state) => state.cameraState);

    const isSmartphone = useMemo(
        () => cameraState === 'smartphone',
        [cameraState]
    );

    return (
        <>
            {isSmartphone && (
                <group
                    rotation={[0, -Math.PI / 2, 0]}
                    position={[SCREEN.centerX, BODY.depth + 0.002, 0]}
                >
                    <Html
                        occlude="blending"
                        rotation-x={-Math.PI / 2}
                        transform
                        wrapperClass="htmlPhoneScreen"
                        distanceFactor={SCREEN.distanceFactor}
                        zIndexRange={[2, 1]}
                    >
                        <IPhone4S />
                        {/* 机身 Home 键的透明点击区（在屏幕下方，见 HOME_HIT 注释）。
                            它不在 <IPhone4S /> 里，所以要自己 stopPropagation，
                            否则点击会冒泡到 canvas → 相机误判为「点空了」退出特写。 */}
                        <button
                            type="button"
                            data-testid="phone-home-key"
                            aria-label="Home 键"
                            onPointerDown={stopPhoneEvent}
                            onPointerUp={stopPhoneEvent}
                            onClick={(e) => {
                                stopPhoneEvent(e);
                                window.dispatchEvent(new Event(HOME_EVENT));
                            }}
                            style={{
                                position: 'absolute',
                                left: HOME_HIT.left,
                                top: HOME_HIT.top,
                                width: HOME_HIT.size,
                                height: HOME_HIT.size,
                                padding: 0,
                                border: 'none',
                                borderRadius: '50%',
                                background: 'transparent',
                                cursor: 'pointer',
                                WebkitTapHighlightColor: 'transparent'
                            }}
                        />
                    </Html>
                </group>
            )}
            {children}
        </>
    );
});

export default SmartphoneiFrame;
