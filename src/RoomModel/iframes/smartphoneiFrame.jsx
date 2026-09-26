/* eslint-disable react/display-name */
import { Html } from '@react-three/drei';
import React, { useMemo, useRef } from 'react';

import { useCameraStore } from '../../helper/CameraStore';

// 手机屏幕里的交互地图 —— OpenStreetMap 官方嵌入页（可拖拽/缩放，零依赖）。
// 想换城市/区域：到 openstreetmap.org 搜到你要的位置 → 右侧「分享」→ HTML →
// 复制 embed.html?bbox=...&layer=mapnik 那串贴到这里。bbox=左,下,右,上 经纬度。
// 下面默认框的是北京（天安门附近）。
const MAP_EMBED =
    'https://www.openstreetmap.org/export/embed.html?bbox=116.35,39.88,116.44,39.93&layer=mapnik&marker=39.905,116.397';

const SmartphoneiFrame = React.memo(() => {
    const cameraState = useCameraStore((state) => state.cameraState);
    const iframeRef = useRef(null);

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
                    <iframe
                        width={392}
                        height={809}
                        title="交互地图"
                        src={MAP_EMBED}
                        style={{ border: 'none', borderRadius: '22px' }}
                        ref={iframeRef}
                    />
                </Html>
            )}
        </group>
    );
});

export default SmartphoneiFrame;
