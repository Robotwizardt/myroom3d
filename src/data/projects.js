/**
 * ============================================================
 *  展示板 6 张卡的数据 —— 【以后改内容只动这一个文件】
 * ============================================================
 * 每张卡对应展示板上的一个可点图标。点图标 → 镜头飞到对应设备 +
 * 弹出中文大面板（标题 + 简介）。
 *
 * 字段说明：
 *   id       唯一标识，别重复
 *   type     功能类型，决定设备屏幕里渲染什么：
 *              'bilibili' 显示器 → 嵌 B站 视频页（联网）
 *              'map'      手机   → 交互地图（联网）
 *              'game'     电视   → 复古游戏模拟器（本地）
 *              'music'    笔记本/音乐 → 网易云播放器（联网）
 *              'home'     主页   → 退回全景（本地）
 *   title    大面板标题
 *   subtitle 大面板一句话简介
 *   accent   主题色（CSS 颜色）
 *
 * 说明：bilibili / map / music 需要联网；game / home 本地可用。
 */

export const PROJECTS = [
    {
        id: 'desktop',
        type: 'bilibili',
        title: 'B站',
        subtitle: '在房间显示器里刷 B站 视频',
        accent: '#00a1d6'
    },
    {
        id: 'smartphone',
        type: 'map',
        title: '地图',
        subtitle: '手机里能拖拽缩放的交互地图',
        accent: '#4ecdc4'
    },
    {
        id: 'tv',
        type: 'game',
        title: '复古游戏',
        subtitle: '电视里的 GBA 模拟器，本地可玩',
        accent: '#ff6b6b'
    },
    {
        id: 'laptop',
        type: 'music',
        title: '网易云音乐',
        subtitle: '笔记本里的音乐播放器，能搜能放能看词',
        accent: '#ec4141'
    },
    {
        id: 'music',
        type: 'music',
        title: '网易云音乐',
        subtitle: '点这里同样打开笔记本的音乐播放器',
        accent: '#ec4141'
    },
    {
        id: 'home',
        type: 'home',
        title: '回到房间',
        subtitle: '退回房间全景，重新逛逛',
        accent: '#a06bff'
    }
];

/**
 * 展示板图标（glb 节点名）→ PROJECTS 索引。
 * dispItem.jsx 里 6 个可点 mesh 按这个映射打开对应卡片。
 */
export const CARD_TO_PROJECT = {
    desktop: 0,
    smartphone: 1,
    tv: 2,
    laptop: 3,
    music: 4,
    home: 5
};
