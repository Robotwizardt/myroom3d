import { afterEach, describe, expect, it, vi } from 'vitest';

import { lyricScrollTop, scrollLyricBox } from '../RoomModel/iframes/lyricScroll';

// 造一个假歌词盒：children[index] 是歌词行，行有 offsetTop（相对盒子内容顶部）
const makeBox = ({ scrollTop = 0, clientHeight = 100, lineTop = 300, lineHeight = 20, withScrollTo = false }) => {
    const calls = [];
    const line = { offsetTop: lineTop, clientHeight: lineHeight };
    const box = {
        children: [line],
        clientHeight,
        scrollTop,
        scrollTo: withScrollTo ? (opts) => calls.push(opts) : undefined
    };
    return { box, calls };
};

describe('歌词自动滚动（lyricScroll）', () => {
    // 被改过的全局方法一律用完还原，不要污染同进程里其它测试文件
    afterEach(() => {
        vi.restoreAllMocks();
        // jsdom 本身没实现 scrollIntoView，用完把这个桩删掉
        delete Element.prototype.scrollIntoView;
    });

    it('把目标行居中：行顶 - 盒子半高 + 行半高', () => {
        const { box } = makeBox({ clientHeight: 100, lineTop: 300, lineHeight: 20 });
        expect(lyricScrollTop(box, 0)).toBe(260);
    });

    it('没有这一行时返回 null（不滚）', () => {
        const { box } = makeBox({});
        expect(lyricScrollTop(box, 5)).toBeNull();
    });

    it('支持平滑滚动时只对歌词盒自己 scrollTo', () => {
        const { box, calls } = makeBox({ withScrollTo: true });
        scrollLyricBox(box, 0);
        expect(calls).toEqual([{ top: 260, behavior: 'smooth' }]);
        expect(box.scrollTop).toBe(0); // scrollTo 由浏览器执行，这里不该直接改 scrollTop
    });

    it('不支持平滑滚动时退回到直接写 scrollTop', () => {
        const { box } = makeBox({ withScrollTo: false });
        scrollLyricBox(box, 0);
        expect(box.scrollTop).toBe(260);
    });

    // 回归：曾经用 el.scrollIntoView()，它会连带滚动 drei <Html transform> 那个
    // overflow:hidden 的容器（内部是约 26× 的缩放变换层），几个 layout 像素的滚动
    // 就会把整个播放器面板推出屏幕 —— 现象是「点歌之后笔记本屏变黑」。
    it('绝不调用 scrollIntoView（那会滚跑 drei 的 Html 容器）', () => {
        // jsdom 没实现 scrollIntoView，先放一个空实现再监听（spyOn 需要方法先存在）
        Element.prototype.scrollIntoView = () => {};
        const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
        const box = document.createElement('div');
        box.appendChild(document.createElement('span'));
        box.appendChild(document.createElement('span'));
        scrollLyricBox(box, 1);
        expect(spy).not.toHaveBeenCalled();
    });
});
