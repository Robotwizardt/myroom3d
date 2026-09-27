/**
 * 歌词自动滚动（只动歌词盒自己）。
 *
 * ⚠️ 绝对不要用 element.scrollIntoView()：它会滚动「所有可滚动祖先」，其中就包括
 * drei <Html transform> 那个 overflow:hidden 的容器（overflow 只是不显示滚动条，
 * 依旧能被程序滚动）。那个容器内部是缩放约 26 倍的变换层，几个 layout 像素的滚动
 * 会被放大成几千像素，把整个播放器面板推出 1440×900 的可见窗
 * —— 现象就是「点了歌之后笔记本屏变黑，但 DOM 还在、zIndex 也正常」。
 * 证据：scripts/probe_music_jump_deep.cjs（异常态 .htmlMusicPlayer 的 scrollTop 非 0，
 * 其外层变换 DIV 的 rect 从 [695,154,18335,7196] 变成 [695,-36917,18335,44317]）。
 */

/** 目标行居中时歌词盒应有的 scrollTop；没有这一行返回 null。 */
export const lyricScrollTop = (box, index) => {
    const line = box && box.children ? box.children[index] : null;
    if (!line) return null;
    return Math.max(0, line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2);
};

/** 把第 index 行滚到歌词盒中间；支持 scrollTo 就用平滑滚动，否则直接写 scrollTop。 */
export const scrollLyricBox = (box, index) => {
    const top = lyricScrollTop(box, index);
    if (top === null) return;
    if (typeof box.scrollTo === 'function') box.scrollTo({ top, behavior: 'smooth' });
    else box.scrollTop = top;
};
