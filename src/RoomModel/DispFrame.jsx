/* eslint-disable react/display-name */
/* eslint-disable react/prop-types */
import { useTexture, useVideoTexture } from '@react-three/drei';
import { Select } from '@react-three/postprocessing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

import { useCameraStore } from '../helper/CameraStore';
import { BODY_DROP_TO_DESK } from '../data/iphone4sBody';
import DesktopiFrame from './iframes/desktopiFrame';
import MusicPlayer from './iframes/MusicPlayer';
import SmartphoneiFrame from './iframes/smartphoneiFrame';
import TvEmulator from './iframes/tvEmulator';
import IPhone4SBody from './IPhone4SBody';

const DispFrame = React.memo(({ nodes }) => {
    // Retrieve camera states from the store
    const cameraState = useCameraStore((state) => state.cameraState);
    const desktopState = useCameraStore((state) => state.desktop);
    const laptopState = useCameraStore((state) => state.laptop);
    const tvState = useCameraStore((state) => state.tv);
    const smartphoneState = useCameraStore((state) => state.smartphone);
    const displayBoardState = useCameraStore((state) => state.displayBoard);

    const [hovered, setHover] = useState(false);
    const [hoveredMonitor, setHoveredMonitor] = useState(null);
    const [hoveredLaptop, setHoveredLaptop] = useState(null);
    const [hoveredTv, setHoveredTv] = useState(null);
    const [hoveredSmartphone, setHoveredSmartphone] = useState(null);
    const [hoveredDisplayBoard, setHoveredDisplayBoard] = useState(null);

    // Change cursor style based on hover state
    useEffect(() => {
        document.body.style.cursor = hovered ? 'pointer' : 'auto';
    }, [hovered]);

    // Callbacks for hover events
    const onPointerOver = useCallback(() => setHover(true), []);
    const onPointerOut = useCallback(() => setHover(false), []);

    // Load video and image textures
    const desktopWallpaper = useVideoTexture('./assets/desktopWallpaper.mp4');
    const tvWallpaper = useVideoTexture('./assets/marioWallpaper.mp4');
    const smartphoneWallpaper = useTexture('./assets/smartphoneWallpaper.webp');

    // iPhone 4s 机身挂点：旧贴图面 mesh 的几何顶点自带大偏移（约 [1.97,-0.33,-2.28]），
    // 节点 translation 并不是画面位置。真正的画面中心 = position + rotation × 几何中心，
    // 否则机身会落在节点原点上，与原手机画面差近 3 米。
    // 再叠加 BODY_DROP_TO_DESK：让机身底面落到烘焙桌面（y = -1.6145）上，
    // 而不是坐在那块烘焙旧道具的顶面上（会悬空 4.6cm，见 data/iphone4sBody.js）。
    const phoneBodyTransform = useMemo(() => {
        const node = nodes.smartphoneDisp;
        node.geometry.computeBoundingBox();
        const center = node.geometry.boundingBox
            .getCenter(new THREE.Vector3())
            .applyEuler(node.rotation)
            .add(node.position);
        center.y += BODY_DROP_TO_DESK;
        return { position: center, rotation: node.rotation };
    }, [nodes.smartphoneDisp]);

    return (
        <>
            {/* Render various iFrames and display components */}
            <DesktopiFrame />
            <MusicPlayer />
            <TvEmulator />

            {/* Desktop monitor */}
            <Select enabled={hoveredMonitor}>
                <mesh
                    geometry={nodes.monitor.geometry}
                    position={nodes.monitor.position}
                    rotation={nodes.monitor.rotation}
                    onClick={
                        cameraState === 'default'
                            ? () => {
                                  desktopState();
                                  setHoveredMonitor(false);
                                  onPointerOut();
                              }
                            : undefined
                    }
                    onPointerOver={
                        cameraState === 'default'
                            ? () => {
                                  onPointerOver();
                                  setHoveredMonitor(true);
                              }
                            : undefined
                    }
                    onPointerOut={
                        cameraState === 'default'
                            ? () => {
                                  onPointerOut();
                                  setHoveredMonitor(false);
                              }
                            : undefined
                    }
                >
                    <meshBasicMaterial
                        map={desktopWallpaper}
                        toneMapped={false}
                    />
                </mesh>
            </Select>

            {/* Laptop display */}
            <Select enabled={hoveredLaptop}>
                <mesh
                    geometry={nodes.laptop.geometry}
                    position={nodes.laptop.position}
                    rotation={nodes.laptop.rotation}
                    onClick={
                        cameraState === 'default'
                            ? () => {
                                  laptopState();
                                  setHoveredLaptop(false);
                                  onPointerOut();
                              }
                            : undefined
                    }
                    onPointerOver={
                        cameraState === 'default'
                            ? () => {
                                  onPointerOver();
                                  setHoveredLaptop(true);
                              }
                            : undefined
                    }
                    onPointerOut={
                        cameraState === 'default'
                            ? () => {
                                  onPointerOut();
                                  setHoveredLaptop(false);
                              }
                            : undefined
                    }
                >
                    {/* 笔记本屏幕彻底交给网易云播放器（MusicPlayer）：
                        任何镜头状态都是深色底，不再显示原作者的 Spotify 假屏保贴图 */}
                    <meshBasicMaterial color="#100a1d" toneMapped={false} />
                </mesh>
            </Select>

            {/* TV display */}
            <Select enabled={hoveredTv}>
                <mesh
                    geometry={nodes.tvdisplay.geometry}
                    position={nodes.tvdisplay.position}
                    rotation={nodes.tvdisplay.rotation}
                    onClick={
                        cameraState === 'default'
                            ? () => {
                                  tvState();
                                  setHoveredTv(false);
                                  onPointerOut();
                              }
                            : undefined
                    }
                    onPointerOver={
                        cameraState === 'default'
                            ? () => {
                                  onPointerOver();
                                  setHoveredTv(true);
                              }
                            : undefined
                    }
                    onPointerOut={
                        cameraState === 'default'
                            ? () => {
                                  onPointerOut();
                                  setHoveredTv(false);
                              }
                            : undefined
                    }
                >
                    <meshBasicMaterial map={tvWallpaper} toneMapped={false} />
                </mesh>
            </Select>

            {/* iPhone 4s 实体机身（替换原纸片手机；挂在 smartphoneDisp 同款变换上）。
                手机特写 DOM 屏（SmartphoneiFrame）挂进机身 group 的屏幕开口处。 */}
            <IPhone4SBody
                position={phoneBodyTransform.position}
                rotation={phoneBodyTransform.rotation}
            >
                <SmartphoneiFrame />
            </IPhone4SBody>

            {/* Smartphone display：旧纸片贴图面隐藏，特写时由 IPhone4S DOM 接管 */}
            {cameraState !== 'smartphone' && (
                <Select enabled={hoveredSmartphone}>
                    <mesh
                        geometry={nodes.smartphoneDisp.geometry}
                        position={nodes.smartphoneDisp.position}
                        rotation={nodes.smartphoneDisp.rotation}
                        visible={false}
                        onClick={
                            cameraState === 'default'
                                ? () => {
                                      smartphoneState();
                                      setHoveredSmartphone(false);
                                      onPointerOut();
                                  }
                                : undefined
                        }
                        onPointerOver={
                            cameraState === 'default'
                                ? () => {
                                      onPointerOver();
                                      setHoveredSmartphone(true);
                                  }
                                : undefined
                        }
                        onPointerOut={
                            cameraState === 'default'
                                ? () => {
                                      onPointerOut();
                                      setHoveredSmartphone(false);
                                  }
                                : undefined
                        }
                    >
                        <meshBasicMaterial map={smartphoneWallpaper} />
                    </mesh>
                </Select>
            )}

            {/* Display board */}
            <Select enabled={hoveredDisplayBoard}>
                <mesh
                    position={[-5.2, 2.95, -1.95]}
                    rotation={[0, Math.PI / 2, 0]}
                    scale={[2.8, 1.6, 1]}
                    onClick={
                        cameraState === 'default'
                            ? () => {
                                  displayBoardState();
                                  setHoveredDisplayBoard(false);
                                  onPointerOut();
                              }
                            : undefined
                    }
                    onPointerOver={
                        cameraState === 'default'
                            ? () => {
                                  onPointerOver();
                                  setHoveredDisplayBoard(true);
                              }
                            : undefined
                    }
                    onPointerOut={
                        cameraState === 'default'
                            ? () => {
                                  onPointerOut();
                                  setHoveredDisplayBoard(false);
                              }
                            : undefined
                    }
                >
                    <meshBasicMaterial
                        transparent={true}
                        opacity={0}
                        color={'#d9d9d9'}
                    />
                    <planeGeometry />
                </mesh>
            </Select>
        </>
    );
});

export default DispFrame;

// Preload textures
useTexture.preload('./assets/smartphoneWallpaper.webp');
