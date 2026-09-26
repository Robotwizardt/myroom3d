/* eslint-disable react/display-name */
import { Html } from '@react-three/drei';
import React, { useMemo, useRef } from 'react';

import { useCameraStore } from '../../helper/CameraStore';

// B站视频嵌入地址。想换成你喜欢的视频：打开那个 B站视频 → 分享 → 嵌入代码，
// 复制里面的 player.bilibili.com/player.html?... 那串贴到这里。
// 参数 &autoplay=0 表示不自动播放，&muted=1 静音（浏览器通常要求静音才允许自动播）。
const BILIBILI_EMBED =
    'https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7&autoplay=0&muted=1';

const DesktopiFrame = React.memo(() => {
    const cameraState = useCameraStore((state) => state.cameraState);
    const iframeRef = useRef(null);

    const isDesktop = useMemo(() => cameraState === 'desktop', [cameraState]);

    return (
        <group>
            {isDesktop && (
                <Html
                    rotation-y={Math.PI}
                    transform
                    wrapperClass="htmlScreen"
                    distanceFactor={0.52}
                    occlude="blending"
                    position={[2.125, 3.03, 3.69]}
                    zIndexRange={[2, 1]}
                >
                    <iframe
                        width={1511}
                        height={852}
                        title="B站视频"
                        src={BILIBILI_EMBED}
                        style={{ border: 'none' }}
                        scrolling="no"
                        allowFullScreen
                        ref={iframeRef}
                    />
                </Html>
            )}
        </group>
    );
});

export default DesktopiFrame;
