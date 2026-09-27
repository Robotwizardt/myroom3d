precision mediump float;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main()
{
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;
    gl_Position = projectionPosition;

    vUv = uv;
    // 世界坐标传给片元，用于抠掉烘焙在壳里的旧手机道具
    vWorldPosition = modelPosition.xyz;
}