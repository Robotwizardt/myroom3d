/* eslint-disable react/display-name */
/* eslint-disable react/prop-types -- 内部建模组件，对象 props 不写 propTypes */
/**
 * iPhone 4s 实体机身（程序化建模，1:1 复刻真机）—— 竖版对齐版。
 *
 * 摆放：挂在 glb smartphoneDisp 同款变换（绕 Y 55.3°，平躺桌上）。
 * 局部坐标：X=长轴（听筒端 +X）、Z=宽、Y=厚度（屏朝 +Y）。
 *
 * 建模要点（对着真机参考图 evidence/ref_iphone4s_front.png 逐项对齐）：
 *   1. 中框：ExtrudeGeometry 圆角矩形 + 倒角（bevelSize 0.45mm）→ 4s 的斜切钢边；
 *      材质 metalness 1 + RoomEnvironment 环境反射（只挂手机材质，不动 scene.environment）。
 *   2. 前后玻璃：从中框内缩 1mm 的圆角面板；前玻璃中间挖出「真机有效显示区」大小的孔
 *      （74.8 × 49.87mm）——occlude="blending" 的镂空洞要求屏投影区内没有任何不透明面。
 *   3. 正面细节（听筒格栅 / 前摄 / 传感器窗 / Home 键）用 canvas 贴图画细节，
 *      位置尺寸全部来自参考图像素测量（见 src/data/iphone4sBody.js 注释）。
 *   4. 侧键：沿中框高度方向的扁条（Y = bandHeight），只凸出 0.5mm 左右，
 *      不再是原先那种穿出前后玻璃的粗黑块。
 * 布局常量见 src/data/iphone4sBody.js。
 */
import { RoundedBox } from '@react-three/drei';
import React, { useMemo } from 'react';
import * as THREE from 'three';

import { HOME_EVENT } from '../data/iphone4s';
import { BACK, BODY, FRONT, mm, SCREEN, SIDE, sideButtonRadius } from '../data/iphone4sBody';
import { useCameraStore } from '../helper/CameraStore';

/* ---------------- canvas 贴图（画正反面细节，比堆 mesh 更像真机） ---------------- */

// 苹果 logo（背面中央）：银色剪影 + 咬痕 + 叶子
function useAppleLogoTexture() {
    return useMemo(() => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#d3d5d8');
        g.addColorStop(0.5, '#9c9ea1');
        g.addColorStop(1, '#cfd1d4');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.6, size * 0.26, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(size * 0.75, size * 0.51, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(size * 0.52, size * 0.3);
        ctx.rotate(-0.5);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.085, size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);
}

// Home 键：黑圆盘 + 一圈细金属边 + 圆角方形刻痕（4s 的标志）
function useHomeButtonTexture() {
    return useMemo(() => {
        const s = 256;
        const c = document.createElement('canvas');
        c.width = c.height = s;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.5);
        g.addColorStop(0, '#232427');
        g.addColorStop(0.7, '#111214');
        g.addColorStop(1, '#0a0a0c');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.49, 0, Math.PI * 2);
        ctx.fill();
        // 金属细边
        ctx.strokeStyle = 'rgba(190,193,197,0.35)';
        ctx.lineWidth = s * 0.02;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.485, 0, Math.PI * 2);
        ctx.stroke();
        // 圆角方形刻痕
        const w = s * 0.3;
        const r = s * 0.055;
        const x = s * 0.5 - w / 2;
        const y = s * 0.5 - w / 2;
        ctx.strokeStyle = '#c9ccd0';
        ctx.lineWidth = s * 0.022;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + w - r);
        ctx.quadraticCurveTo(x + w, y + w, x + w - r, y + w);
        ctx.lineTo(x + r, y + w);
        ctx.quadraticCurveTo(x, y + w, x, y + w - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.stroke();
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);
}

// 听筒格栅：白色胶囊凹槽 + 里面深色网点（参考图 ref_earpiece_zoom.png）
function useEarpieceTexture() {
    return useMemo(() => {
        const w = 512;
        const h = 96;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        const r = h * 0.42;
        const cap = new Path2D();
        cap.moveTo(r, h * 0.08);
        cap.lineTo(w - r, h * 0.08);
        cap.arcTo(w, h * 0.08, w, h * 0.5, r);
        cap.arcTo(w, h * 0.92, w - r, h * 0.92, r);
        cap.lineTo(r, h * 0.92);
        cap.arcTo(0, h * 0.92, 0, h * 0.5, r);
        cap.arcTo(0, h * 0.08, r, h * 0.08, r);
        ctx.fillStyle = '#15161a';
        ctx.fill(cap);
        // 网点
        ctx.fillStyle = '#3a3c42';
        for (let x = 6; x < w - 6; x += 7) {
            for (let y = 14; y < h - 14; y += 7) {
                ctx.beginPath();
                ctx.arc(x, y, 1.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // 上缘高光
        ctx.strokeStyle = 'rgba(220,222,226,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r, h * 0.14);
        ctx.lineTo(w - r, h * 0.14);
        ctx.stroke();
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);
}

// 前置摄像头：金属圈 + 深色镜身 + 蓝紫镜片 + 高光点
function useFrontCameraTexture() {
    return useMemo(() => {
        const s = 256;
        const c = document.createElement('canvas');
        c.width = c.height = s;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(s * 0.42, s * 0.36, s * 0.05, s * 0.5, s * 0.5, s * 0.5);
        g.addColorStop(0, '#33343a');
        g.addColorStop(0.75, '#191a1e');
        g.addColorStop(1, '#0d0e11');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.49, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,203,208,0.35)';
        ctx.lineWidth = s * 0.025;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.47, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#2b1a5e';
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a2ea8';
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(230,235,255,0.8)';
        ctx.beginPath();
        ctx.arc(s * 0.44, s * 0.44, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);
}

// 传感器窗（环境光/距离）：很小的深色渐变胶囊
function useSensorTexture() {
    return useMemo(() => {
        const w = 256;
        const h = 128;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        const r = h * 0.45;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#34363c');
        g.addColorStop(1, '#0c0d10');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(r, 4);
        ctx.lineTo(w - r, 4);
        ctx.arcTo(w, 4, w, h / 2, r);
        ctx.arcTo(w, h - 4, w - r, h - 4, r);
        ctx.lineTo(r, h - 4);
        ctx.arcTo(0, h - 4, 0, h / 2, r);
        ctx.arcTo(0, 4, r, 4, r);
        ctx.fill();
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);
}

// 后摄：金属圈 + 玻璃镜片
function useBackCameraTexture() {
    return useMemo(() => {
        const s = 256;
        const c = document.createElement('canvas');
        c.width = c.height = s;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#15171b';
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.49, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(205,208,213,0.5)';
        ctx.lineWidth = s * 0.05;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        const g = ctx.createRadialGradient(s * 0.4, s * 0.35, s * 0.03, s * 0.5, s * 0.5, s * 0.36);
        g.addColorStop(0, '#3b4a6b');
        g.addColorStop(0.5, '#12172a');
        g.addColorStop(1, '#05070d');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(s * 0.4, s * 0.36, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);
}

/* ---------------- 几何工具 ---------------- */

// 圆角矩形 Shape（局部 XY 平面，挤出后 rotateX(-π/2) 变成 XZ）
function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
}

// 任意中心的圆角矩形 Shape（用于玻璃挖孔）
function roundedRectShapeAt(cx, cy, w, h, r) {
    const s = new THREE.Shape();
    const x = cx - w / 2;
    const y = cy - h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
}

// 侧键：贴着中框侧面的扁圆角条（只凸出 0.5mm 左右，不再是粗黑块）
function SideButton({ size, position }) {
    // 注意：radius 必须按「最小的那条边」算。之前写成 min(height, depth)，
    // 于是电源键（厚度只有 2.9mm、bandHeight 却有 23mm）的 radius 变成 10.5mm，
    // 远大于厚度的一半 → drei RoundedBox 会沿厚度方向鼓出 ~18mm，
    // 那就是特写里顶部那块「黑舌头」（探针 probe_side_keys_geo 实测 X 尺寸 47.8mm）。
    const radius = sideButtonRadius(size);
    return (
        <RoundedBox args={size} radius={radius} smoothness={3} position={position}>
            <meshStandardMaterial color="#c9cbcd" metalness={1} roughness={0.25} />
        </RoundedBox>
    );
}

const IPhone4SBody = React.memo(({ position, rotation, children }) => {
    const smartphoneState = useCameraStore((s) => s.smartphone);
    const cameraState = useCameraStore((s) => s.cameraState);

    const logoTex = useAppleLogoTexture();
    const homeTex = useHomeButtonTexture();
    const earpieceTex = useEarpieceTexture();
    const frontCamTex = useFrontCameraTexture();
    const sensorTex = useSensorTexture();
    const backCamTex = useBackCameraTexture();

    // 环境反射：试过用 three 的 RoomEnvironment + PMREM 给钢中框上反射，但
    // 那个房间环境的辐亮度远高于本场景自己的灯光，黑玻璃上会糊出一大片过曝白斑
    // （探针 evidence/body_parts_noenv.png 对照证实：去掉 envMap 后黑边、听筒、
    // Home 键全部回归正常）。所以这里不给 envMap，金属感靠 metalness + 场景灯光。

    const { length: L, width: W, depth: D } = BODY;
    const scrLen = SCREEN.length;
    const scrW = SCREEN.width;
    const scrCenterX = SCREEN.centerX;

    // 中框：圆角矩形挤出 + 倒角 → 斜切钢边（挤出总厚 = depth）
    const frameGeo = useMemo(() => {
        const shape = roundedRectShape(L, W, BODY.cornerRadius);
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth: D - BODY.bevelThickness * 2,
            bevelEnabled: true,
            bevelThickness: BODY.bevelThickness,
            bevelSize: BODY.bevelSize,
            bevelSegments: 3,
            curveSegments: 32
        });
        geo.rotateX(-Math.PI / 2); // Shape XY → XZ，挤出方向 → Y
        geo.translate(0, BODY.bevelThickness, 0); // y 落到 [0, D]
        geo.computeVertexNormals();
        return geo;
    }, [L, W, D]);

    // 前玻璃：环（中间挖屏幕开口）。occlude="blending" 的镂空洞要求
    // 屏投影区内没有任何不透明面，所以前玻璃必须是带孔的环，不能是实心整面板。
    // 孔 = 真机有效显示区（与 DOM 屏世界尺寸一致，DOM 每边多 bleed 0.3mm 压住缝）。
    const frontGlassGeo = useMemo(() => {
        const inset = BODY.glassInset;
        const outer = roundedRectShapeAt(
            0,
            0,
            L - inset * 2,
            W - inset * 2,
            BODY.cornerRadius - inset
        );
        const hole = roundedRectShapeAt(scrCenterX, 0, scrLen, scrW, mm(1.6));
        outer.holes.push(hole);
        const glassDepth = BODY.depth * 0.34;
        const geo = new THREE.ExtrudeGeometry(outer, {
            depth: glassDepth,
            bevelEnabled: true,
            bevelThickness: BODY.bevelSize * 0.6,
            bevelSize: BODY.bevelSize * 0.6,
            bevelSegments: 2,
            curveSegments: 32
        });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, D + BODY.glassProud - glassDepth - BODY.bevelSize * 0.6, 0);
        geo.computeVertexNormals();
        return geo;
    }, [L, W, D, scrLen, scrW, scrCenterX]);

    const glassMat = {
        color: BODY.glassColor,
        metalness: 0.18,
        roughness: BODY.glassRoughness
    };

    const onClick =
        cameraState === 'default' || cameraState === 'displayBoard'
            ? (e) => {
                  // 挡住事件继续传到后面的房间地板/墙面：那些 mesh 上挂着
                  // 「点空白处回全景」的 defaultState，点到手机也会被一并触发。
                  e.stopPropagation();
                  smartphoneState();
              }
            : null;

    return (
        <group position={position} rotation={rotation}>
            <group onClick={onClick}>
                {/* ===== 中框：不锈钢带（带斜切倒角） ===== */}
                <mesh geometry={frameGeo}>
                    <meshStandardMaterial
                        color={BODY.frameColor}
                        metalness={BODY.frameMetalness}
                        roughness={BODY.frameRoughness}
                    />
                </mesh>

                {/* ===== 前面板：黑色玻璃环（挖出显示区，顶面略凸出中框） ===== */}
                <mesh geometry={frontGlassGeo}>
                    <meshStandardMaterial {...glassMat} />
                </mesh>

                {/* ===== 后面板：黑色玻璃（底面略凸出中框） ===== */}
                <RoundedBox
                    args={[L - BODY.glassInset * 2, D * 0.34, W - BODY.glassInset * 2]}
                    radius={0.012}
                    smoothness={6}
                    position={[0, -BODY.glassProud + BODY.depth * 0.17, 0]}
                >
                    <meshStandardMaterial {...glassMat} />
                </RoundedBox>

                {/* 熄屏暗面（接收点击：旧隐藏贴图面 mesh 不可见，R3F raycaster
                    跳过 invisible mesh，点击进特写全靠这块）；特写时隐藏，
                    否则会堵死 occlude 镂空洞 */}
                <mesh
                    position={[scrCenterX, D + 0.001, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    visible={cameraState !== 'smartphone'}
                    onClick={onClick}
                >
                    <planeGeometry args={[scrLen + SCREEN.bleed, scrW + SCREEN.bleed * 0.667]} />
                    <meshStandardMaterial color="#000" roughness={0.04} metalness={0.2} />
                </mesh>
            </group>

            {/* ===== 正面细节（都在屏幕开口之外的黑边里） ===== */}
            {/* 听筒格栅 */}
            <mesh
                position={[L / 2 - FRONT.earpiece.xFromTop, D + BODY.glassProud + 0.0015, 0]}
                rotation={[-Math.PI / 2, 0, Math.PI / 2]}
            >
                <planeGeometry args={[FRONT.earpiece.wide, FRONT.earpiece.len * 2.2]} />
                <meshBasicMaterial map={earpieceTex} transparent alphaTest={0.35} toneMapped={false} />
            </mesh>
            {/* 前置摄像头 */}
            <mesh
                position={[L / 2 - FRONT.camera.xFromTop, D + BODY.glassProud + 0.0015, FRONT.camera.zFromCenter]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <circleGeometry args={[FRONT.camera.r, 32]} />
                <meshBasicMaterial map={frontCamTex} toneMapped={false} />
            </mesh>
            {/* 传感器窗 */}
            <mesh
                position={[L / 2 - FRONT.sensor.xFromTop, D + BODY.glassProud + 0.0015, FRONT.sensor.zFromCenter]}
                rotation={[-Math.PI / 2, 0, Math.PI / 2]}
            >
                <planeGeometry args={[FRONT.sensor.wide, FRONT.sensor.len * 1.6]} />
                <meshBasicMaterial map={sensorTex} transparent alphaTest={0.3} toneMapped={false} />
            </mesh>

            {/* ===== Home 键（-X 端）；点它 = 真机按 Home 键 → 给屏内 UI 派发 HOME_EVENT ===== */}
            <group
                name="phoneHomeKey"
                position={[-L / 2 + FRONT.homeBtn.xFromBottom, D + BODY.glassProud + 0.0012, 0]}
                onClick={(e) => {
                    // 同样挡住「点空白回全景」，否则按 Home 键会把镜头一并拉走
                    e.stopPropagation();
                    if (cameraState === 'smartphone') {
                        window.dispatchEvent(new Event(HOME_EVENT));
                    } else {
                        onClick?.(e);
                    }
                }}
            >
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[FRONT.homeBtn.r, 48]} />
                    <meshBasicMaterial map={homeTex} toneMapped={false} />
                </mesh>
            </group>

            {/* ===== 侧面按键（左 -Z 边：静音 + 音量±；顶 +X 端：电源） ===== */}
            <SideButton
                size={[SIDE.muteSwitch.len, SIDE.bandHeight, SIDE.muteSwitch.thick]}
                position={[
                    SIDE.muteSwitch.xCenter,
                    D / 2,
                    -W / 2 - SIDE.muteSwitch.thick / 2
                ]}
            />
            <SideButton
                size={[SIDE.volumeUp.len, SIDE.bandHeight, SIDE.volumeUp.thick]}
                position={[SIDE.volumeUp.xCenter, D / 2, -W / 2 - SIDE.volumeUp.thick / 2]}
            />
            <SideButton
                size={[SIDE.volumeDown.len, SIDE.bandHeight, SIDE.volumeDown.thick]}
                position={[SIDE.volumeDown.xCenter, D / 2, -W / 2 - SIDE.volumeDown.thick / 2]}
            />
            {/* 电源键：+X 顶边 */}
            <SideButton
                size={[SIDE.powerBtn.thick, SIDE.bandHeight, SIDE.powerBtn.len]}
                position={[L / 2 + SIDE.powerBtn.thick / 2, D / 2, SIDE.powerBtn.zCenter]}
            />

            {/* 天线分割线（黑色小缝，左右边靠近上下角各一） */}
            {[-1, 1].map((zs) =>
                [-1, 1].map((xs) => (
                    <mesh
                        key={`ag-${zs}-${xs}`}
                        position={[
                            xs * (L / 2 - mm(6)),
                            D / 2,
                            zs * (W / 2 - 0.0002)
                        ]}
                    >
                        <boxGeometry args={[mm(1.1), SIDE.bandHeight * 0.96, mm(0.6)]} />
                        <meshStandardMaterial color="#08080a" roughness={0.55} />
                    </mesh>
                ))
            )}

            {/* ===== 背面细节（-Y 面） ===== */}
            {/* 后摄 */}
            <mesh
                position={[L / 2 - BACK.camera.xFromTop, -BODY.glassProud - 0.0015, BACK.camera.zFromCenter]}
                rotation={[Math.PI / 2, 0, 0]}
            >
                <circleGeometry args={[BACK.camera.r, 32]} />
                <meshBasicMaterial map={backCamTex} toneMapped={false} />
            </mesh>
            {/* 闪光灯 */}
            <mesh
                position={[L / 2 - BACK.camera.xFromTop, -BODY.glassProud - 0.0015, BACK.flash.zFromCenter]}
                rotation={[Math.PI / 2, 0, 0]}
            >
                <circleGeometry args={[BACK.flash.r, 24]} />
                <meshStandardMaterial color="#d9d5c9" roughness={0.25} />
            </mesh>
            {/* 苹果 logo（背面中央） */}
            <mesh
                position={[0.02, -BODY.glassProud - 0.0015, 0]}
                rotation={[Math.PI / 2, 0, Math.PI / 2]}
            >
                <planeGeometry args={[BACK.logo.size, BACK.logo.size]} />
                <meshBasicMaterial map={logoTex} transparent toneMapped={false} />
            </mesh>

            {/* 手机特写 DOM 屏（SmartphoneiFrame 的 Html）挂在屏幕开口处 */}
            {children}
        </group>
    );
});

export default IPhone4SBody;
