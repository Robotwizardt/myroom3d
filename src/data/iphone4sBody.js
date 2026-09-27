/**
 * iPhone 4s 机身的几何与布局常量（单位：米，跟房间场景一致）。
 *
 * 布局（竖版）：
 *   局部 X = 手机长轴（0.612，听筒端为 +X / 顶部，Home 键端为 -X / 底部）
 *   局部 Z = 手机宽（0.3113125）
 *   局部 Y = 厚度（0.04940625，屏幕朝 +Y 平躺桌上）
 * 机身挂在 glb smartphoneDisp 的变换上（绕 Y 55.3°），并由 DispFrame 整体下移
 * BODY_DROP_TO_DESK 让底面贴桌面。
 *
 * 【1:1 复刻真机】真机规格（Apple 官方 / DeviceBeast / phonedb）：
 *   机身 115.2 × 58.6 × 9.3 mm，140 g；
 *   屏幕有效显示区 49.87 × 74.8 mm（960×640 @326ppi，3:2）；
 *   左右边框各 4.365 mm（Horizontal Full Bezel Width 8.73 mm）；
 *   上下边框：参考图逐像素测得 上 20.40 / 下 20.32 mm → 显示区在机身上「上下居中」。
 * 场景里长轴固定 0.612（= 桌上烘焙手机道具的长度，改它会让机身和道具/阴影错位），
 * 于是换算系数 k = 0.612 / 115.2 = 0.0053125 /mm，其余尺寸全按真机 mm × k。
 *
 * 参考图（Wikimedia Commons，白色 4s 正视图）像素测量结果：
 *   evidence/ref_iphone4s_front.png（759 × 1485 px，12.891 px/mm）
 *   圆角半径拟合最优 R = 11.0 mm（squircle，圆角拟合残差大，取整）
 *   听筒格栅：水平居中，9.7 × 1.55 mm，中心距顶 10.2 mm
 *   前置摄像头：直径 2.7 mm，中心距左 20.8 mm（= 中线左 8.5 mm），中心距顶 10.55 mm
 *   传感器窗：3.5 × 1.8 mm，中心距左 30.2 mm（中线右 0.9 mm），中心距顶 5.3 mm
 *   Home 键：直径 11.6 mm，圆心距底 11.5 mm
 *   侧键（距设备顶端）：静音 13.03~18.31（中心 15.67，长 5.35，凸出 0.54）
 *                      音量+ 23.51~27.54（中心 25.52，长 4.11，凸出 0.47）
 *                      音量− 33.67~37.70（中心 35.68，长 4.11，凸出 0.47）
 *   顶键（距设备左端）：电源 39.64~48.87（中心 44.26，长 9.31，凸出 0.54）
 * 换算到「沿长轴从机身中心算」：xCenter = 115.2/2 − 距顶。
 *
 * 中框用 ExtrudeGeometry 圆角矩形 + 倒角（bevel）做出 4s 的斜切钢边，
 * 因为 RoundedBox 的圆角受厚度限制最大只能 0.015。
 */

const K = 0.612 / 115.2; // 米 / 真机毫米

/** 真机毫米 → 场景米（方便按下表读数） */
export const mm = (v) => v * K;

export const BODY = {
    length: 0.612, // X（长轴，含中框）= 真机 115.2mm
    width: mm(58.6), // Z（手机宽）≈ 0.3113125
    depth: mm(9.3), // Y（厚度）≈ 0.04940625
    cornerRadius: mm(11), // 外轮廓圆角半径（XZ 平面内）≈ 0.0584375
    glassInset: mm(1.0), // 前后玻璃比中框内缩 ≈ 0.0053125
    glassProud: mm(0.2), // 玻璃略凸出中框（真机手感）
    // 中框（不锈钢带）：带倒角的斜切边，靠环境反射出金属感
    frameColor: '#c9cbcd',
    frameMetalness: 1,
    frameRoughness: 0.22,
    bevelSize: mm(0.45), // 斜切边宽度
    bevelThickness: mm(0.55), // 斜切边深度（占厚度）
    // 前后面板（黑色玻璃）
    glassColor: '#08080a',
    glassRoughness: 0.1,
};

// 正面细节（竖版：xFromTop/xFromBottom 沿长轴 X 算「到边缘的距离」，
//          zFromCenter 沿宽 Z 算「相对机身中线」；xFromTop 指元素中心）
export const FRONT = {
    // 听筒格栅：水平居中，9.7 × 1.55 mm，中心距顶 10.2 mm
    earpiece: { len: mm(1.55), wide: mm(9.7), xFromTop: mm(10.2) },
    // 前置摄像头：直径 2.7 mm，中心距左 20.8 mm（中线左 8.5 mm），距顶 10.55 mm
    camera: { r: mm(1.35), zFromCenter: -mm(8.5), xFromTop: mm(10.55) },
    // 传感器窗（环境光/距离）：3.5 × 1.8 mm，中线右 0.9 mm，距顶 5.3 mm
    sensor: { len: mm(1.8), wide: mm(3.5), xFromTop: mm(5.3), zFromCenter: mm(0.9) },
    // Home 键：直径 11.6 mm，圆心距底 11.5 mm；中间圆角方刻痕 3.5 mm
    homeBtn: { r: mm(5.8), xFromBottom: mm(11.5), glyph: mm(3.5) },
    // 屏幕开口边距：真机上 20.2mm / 下 20.2mm（居中）/ 侧 4.365mm
    screen: { marginSide: mm(4.365), marginTop: mm(20.2), marginBottom: mm(20.2) },
};

// 侧面细节（竖版：左静音+音量± 在 -Z 边，顶电源在 +X 端）
export const SIDE = {
    // 真机侧键凸出 0.47~0.54mm；这里刻意收到 0.3mm 以下，让它们与中框几乎齐平
    // （用户反馈原来的键斜看像一块黑凸块，实测根因是 RoundedBox 的 radius 鼓包，
    //  已在 IPhone4SBody.jsx 的 SideButton 里修掉，这里再把凸出量也压小）。
    // 静音拨片：距顶 15.67mm（中心）→ 距机身中心 57.6−15.67 mm，长 5.35mm
    muteSwitch: { len: mm(5.35), thick: mm(0.28), xCenter: mm(57.6 - 15.67), side: 'left' },
    // 音量 +：距顶 25.52mm（中心）→ 31. 长 4.11mm
    volumeUp: { len: mm(4.11), thick: mm(0.25), xCenter: mm(57.6 - 25.52), side: 'left' },
    // 音量 -：距顶 35.68mm（中心）→ 长 4.11mm
    volumeDown: { len: mm(4.11), thick: mm(0.25), xCenter: mm(57.6 - 35.68), side: 'left' },
    // 电源键：顶边（+X 端），距左 44.26mm（中心）→ 相对中线 +14.96mm，长 9.31mm
    powerBtn: { len: mm(9.31), thick: mm(0.28), zCenter: mm(44.26 - 29.3), side: 'top' },
    // 侧键在中框高度方向上的尺寸（中框带高 ≈ 4.4mm）
    bandHeight: mm(4.4),
    // 天线分割线（黑色小缝，左右边上下各一）
    antennaGaps: true,
};

/**
 * 侧键的倒角半径：必须按「最小的那条边」算。
 *
 * 坑：drei 的 RoundedBox 在 radius 大于某条边的一半时会沿该方向鼓出去
 * （球面段外凸，不是简单夹到边长/2）。曾经用 min(bandHeight, thick) 得到
 * radius 10.5mm，而电源键厚度只有 2.9mm → 网格沿厚度方向胀到 47.8mm，
 * 就是特写里顶部那块「黑舌头」（探针 scripts/probe_side_keys_geo.cjs 实测）。
 */
export const sideButtonRadius = (size) => Math.min(...size) * 0.45;

// 背面细节（竖版：xFromTop 沿长轴，zFromCenter 沿宽）
export const BACK = {
    // 后摄：距顶边 5.5mm、距左边 8mm（直径 7.2mm）
    camera: { r: mm(3.6), xFromTop: mm(6.5), zFromCenter: -mm(58.6 / 2 - 9) },
    // 闪光灯：后摄右侧（距左边 16mm）
    flash: { r: mm(1.4), xFromTop: mm(6.5), zFromCenter: -mm(58.6 / 2 - 16.5) },
    // 苹果 logo（个人本地使用，真机 ~12mm）
    logo: { size: mm(12) },
};

/**
 * 机身落地偏移（世界 Y）：
 * 烘焙桌面平面在 y = -1.6145，而机身在 glb 里是按「旧手机道具顶面」摆的（底面 y = -1.5682），
 * 也就是说机身原本悬空 4.6cm（下面正好垫着那块烘焙旧道具）。
 * 把机身整体下移这么多，底面落到 y = -1.6135（留 1mm 余量避免与桌面 z-fighting），
 * 看起来才是「手机躺在桌上」。相机特写挂点同步下移同样的量（CameraManager.jsx）。
 */
export const BODY_DROP_TO_DESK = -0.0453;

/**
 * 原项目把整间房烘焙成了合并大壳 roomFurniture —— 里面连「那台手机」也一起烘焙了：
 * 一块手机大小（0.62 × 0.31 × 0.033）的绿色壳平板，与机身同一位置、同一朝向、
 * 顶面正好在机身底面（y = -1.5681），并且合并进了房间壳的几何与贴图里，
 * 所以 visible / 隐藏 mesh 都关不掉它 —— 新机身盖上去后，绿壳的立边就从机身四周露出来。
 *
 * 唯一干净的办法：在房间壳着色器里把这块「有向体积」的片元 discard 掉，
 * 露出下面完好的桌面（桌面烘焙在 y = -1.6145，裁剪盒下界特意留在它之上）。
 *
 * 数值为运行时探针实测（scripts/probe_green_components.cjs 的连通分量分析，
 * 该分量 = 300 三角形 / 176 顶点，最小面积有向盒 0.619 × 0.309）：
 *   center 世界坐标、half 半尺寸、rotY 绕 Y 朝向（弧度）。
 * 旋转约定与探针扫描一致：x' = cos·dx − sin·dz，z' = sin·dx + cos·dz（片元着色器同式）。
 * 盒内下界 y = -1.6065（道具底 -1.6009 之下、桌面 -1.6145 之上），
 * 上界 y = -1.5625（道具顶 -1.5681 之上，机身是另一个 mesh 不受影响）；
 * 鼠标在机身局部 -z 方向约 0.37m 处，天然落在盒外，不会被误裁。
 * 半尺寸在实测值（0.3095 × 0.1545 × 0.0164）之外多留了约 2cm 余量，
 * 因为在盒边界上「部分覆盖」的片元插值后位置可能落在盒外，会残留一圈绿边。
 */
export const BAKED_PHONE_PROP_CUT = {
    center: [1.6762, -1.5845, -0.8014],
    half: [0.335, 0.022, 0.178],
    rotY: (60 * Math.PI) / 180,
};

// 屏幕开口（供机身暗面 + DOM 屏对齐共用）
export const SCREEN = {
    // 开口尺寸：长沿 X、宽沿 Z（= 真机有效显示区 74.8 × 49.87 mm）
    get length() {
        return BODY.length - FRONT.screen.marginTop - FRONT.screen.marginBottom;
    },
    get width() {
        return BODY.width - FRONT.screen.marginSide * 2;
    },
    // 开口中心沿 X 偏移（上下边距相同 → 0）
    get centerX() {
        return (FRONT.screen.marginBottom - FRONT.screen.marginTop) / 2;
    },
    // 开口长宽比（真机 74.8/49.87 = 1.4999）
    get ratio() {
        return this.length / this.width;
    },
    // DOM 屏（IPhone4S 组件）320×480 pt = iOS 6 的 4s 屏；Html transform 世界尺寸
    // worldSize = cssPx × distanceFactor/400（探针13验证）。
    // distanceFactor 让 DOM 比开口每边多出约 0.3mm（bleed，防止边缘露出缝）：
    // (0.397343 + 0.00425) × 400 / 480 ≈ 0.334661
    domW: 320,
    domH: 480,
    bleed: mm(0.8),
    get distanceFactor() {
        return ((this.length + this.bleed) * 400) / this.domH;
    },
};

/**
 * 机身 Home 键的 DOM 透明点击区（css px，相对 320×480 屏幕左上角）。
 *
 * 为什么需要它：特写里 drei Html 会把 canvas 的 pointerEvents 设成 none，
 * R3F 的 mesh onClick 收不到鼠标事件（见 b20），所以真机 Home 键的"按键"
 * 只能靠 DOM 层里一块透明热区来承接点击 → 派发 HOME_EVENT 给屏内 UI。
 * Home 键在屏幕下方（下边框内），故 top = domH + 一段距离。
 */
export const HOME_HIT = (() => {
    const pxPerMm = SCREEN.domH / (SCREEN.length / mm(1)); // 显示区 css px / 真机 mm
    const half = (FRONT.homeBtn.r / mm(1)) * pxPerMm; // 半径 css px
    const cy = SCREEN.domH + ((FRONT.screen.marginBottom - FRONT.homeBtn.xFromBottom) / mm(1)) * pxPerMm;
    return {
        left: SCREEN.domW / 2 - half,
        top: cy - half,
        size: half * 2
    };
})();
