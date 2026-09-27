import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

import fragmentShader from '../shaders/Room/fragment.glsl';
import vertexShader from '../shaders/Room/vertex.glsl';

const TextureMaterial = shaderMaterial(
    {
        nbakedm: new THREE.Texture(),
        dbakedm: new THREE.Texture(),
        lightMapm: new THREE.Texture(),

        NightMix: 0,

        lightBoardColor: new THREE.Color('#ff2d88'),
        lightBoardStrength: 1.35,

        lightPcColor: new THREE.Color('#4b7eff'),
        lightPcStrength: 1.2,

        lightDeskColor: new THREE.Color('#ff7236'),
        lightDeskStrength: 1.55,

        // 世界空间「有向」裁剪盒（绕 Y 旋转）：用来抠掉烘焙在房间壳里的旧手机道具
        // （数值见 data/iphone4sBody.js 的 BAKED_PHONE_PROP_CUT）。
        // 默认 half = (-1,-1,-1) → abs(p) < half 永不成立 = 不裁剪。
        cutCenter: new THREE.Vector3(0, 0, 0),
        cutHalf: new THREE.Vector3(-1, -1, -1),
        cutRotY: 0
    },
    vertexShader,
    fragmentShader
);

export default TextureMaterial;
