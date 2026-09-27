uniform sampler2D nbakedm;
uniform sampler2D dbakedm;
uniform sampler2D lightMapm;

uniform float NightMix;

uniform vec3 lightBoardColor;
uniform float lightBoardStrength;

uniform vec3 lightPcColor;
uniform float lightPcStrength;

uniform vec3 lightDeskColor;
uniform float lightDeskStrength;

// 世界空间「有向」裁剪盒（绕 Y 旋转）：中心 cutCenter、半尺寸 cutHalf、朝向 cutRotY。
// 旋转约定：x' = cos·dx − sin·dz, z' = sin·dx + cos·dz（与探针脚本同式）。
// 默认 cutHalf = (-1,-1,-1)，abs(p) < half 永不成立 → 不裁剪。
uniform vec3 cutCenter;
uniform vec3 cutHalf;
uniform float cutRotY;

varying vec2 vUv;
varying vec3 vWorldPosition;

#include "../partials/blend.glsl"

void main(){

    vec3 cutD = vWorldPosition - cutCenter;
    float cutC = cos(cutRotY);
    float cutS = sin(cutRotY);
    vec3 cutP = vec3(cutC * cutD.x - cutS * cutD.z, cutD.y, cutS * cutD.x + cutC * cutD.z);
    if (all(lessThan(abs(cutP), cutHalf))) discard;

    vec3 bakedNightColor = texture2D(nbakedm, vUv).rgb;
    vec3 bakedDayColor = texture2D(dbakedm, vUv).rgb;
    vec3 bakedColor = mix(bakedDayColor, bakedNightColor, NightMix);
    vec3 lightMapColor = texture2D(lightMapm, vUv).rgb;


    float boardLightS = lightMapColor.r * lightBoardStrength;
    bakedColor = blendLighten(bakedColor, lightBoardColor, boardLightS);

    float deskLightS = lightMapColor.g * lightDeskStrength;
    bakedColor = blendLighten(bakedColor, lightDeskColor, deskLightS);

    float pcLightS = lightMapColor.b * lightPcStrength;
    bakedColor = blendLighten(bakedColor, lightPcColor, pcLightS);


    gl_FragColor = vec4(bakedColor, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}