/**
 * 播放器面板的注入式样式（黑胶转盘是纯 DOM 画的，需要一小段全局 CSS）。
 * 与 PlayerArt.jsx（封面件）分开：这里只负责样式，改样式不会碰到封面逻辑。
 */

/** 转盘旋转用的 keyframes，挂在播放器面板里（面板只有一个，不会重复） */
export const VinylKeyframes = () => (
    <style>{`@keyframes vinylSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
);

/**
 * 播放器面板里的滚动条样式（歌单列表 + 歌词盒）。
 * 面板是深色拟物风，浏览器默认那根亮白滚动条很突兀，这里统一改成细的深色条。
 * 用 [data-testid] 圈定范围，避免影响页面其它地方。
 */
export const PlayerScrollbars = () => (
    <style>{`
[data-testid="song-list"], [data-testid="lyric-box"] { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.28) transparent; }
[data-testid="song-list"]::-webkit-scrollbar, [data-testid="lyric-box"]::-webkit-scrollbar { width: 8px; }
[data-testid="song-list"]::-webkit-scrollbar-track, [data-testid="lyric-box"]::-webkit-scrollbar-track { background: transparent; }
[data-testid="song-list"]::-webkit-scrollbar-thumb, [data-testid="lyric-box"]::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.22); border-radius: 4px; }
[data-testid="song-list"]::-webkit-scrollbar-thumb:hover, [data-testid="lyric-box"]::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
`}</style>
);
