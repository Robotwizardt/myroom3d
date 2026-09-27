import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AlbumArt, VinylDisc } from '../RoomModel/iframes/PlayerArt';

// 封面 DOM 件（ADR-0002）：AlbumArt = 图 + 加载失败降级成灰底 ♪ 占位块；
// VinylDisc = 黑胶片 + 中心圆形封面 + 唱针，播放时转/针落下，暂停时静止/针抬起。

describe('AlbumArt 封面图与占位块', () => {
    afterEach(cleanup);

    it('有 url 时渲染 img，带懒加载与 no-referrer', () => {
        render(<AlbumArt url="https://x/a.jpg?param=72y72" alt="封面" />);
        const img = screen.getByTestId('album-art');
        expect(img.tagName).toBe('IMG');
        expect(img).toHaveAttribute('src', 'https://x/a.jpg?param=72y72');
        expect(img).toHaveAttribute('loading', 'lazy');
        expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
        expect(screen.queryByTestId('album-art-placeholder')).toBeNull();
    });

    it('url 为空时直接是占位块（灰底 + ♪），尺寸与真封面一致', () => {
        render(<AlbumArt url="" size={36} />);
        expect(screen.queryByTestId('album-art')).toBeNull();
        const ph = screen.getByTestId('album-art-placeholder');
        expect(ph).toHaveTextContent('♪');
        expect(ph.style.width).toBe('36px');
        expect(ph.style.height).toBe('36px');
    });

    it('图片加载失败时降级成占位块，且尺寸不变（布局不跳）', () => {
        render(<AlbumArt url="https://x/broken.jpg" size={36} />);
        fireEvent.error(screen.getByTestId('album-art'));
        const ph = screen.getByTestId('album-art-placeholder');
        expect(ph).toHaveTextContent('♪');
        expect(ph.style.width).toBe('36px');
    });

    it('换成新 url 后重新尝试加载（不再记着上一次的失败）', () => {
        const { rerender } = render(<AlbumArt url="https://x/broken.jpg" />);
        fireEvent.error(screen.getByTestId('album-art'));
        expect(screen.queryByTestId('album-art')).toBeNull();
        rerender(<AlbumArt url="https://x/ok.jpg" />);
        expect(screen.getByTestId('album-art')).toHaveAttribute('src', 'https://x/ok.jpg');
    });
});

describe('VinylDisc 黑胶转盘', () => {
    afterEach(cleanup);

    it('播放时黑胶片转、唱针落在盘上', () => {
        render(<VinylDisc url="https://x/c.jpg?param=256y256" spinning />);
        expect(screen.getByTestId('vinyl-plate').style.animationPlayState).toBe('running');
        expect(screen.getByTestId('vinyl-needle').style.transform).toBe('rotate(24deg)');
    });

    it('暂停时黑胶片停、唱针抬起', () => {
        render(<VinylDisc url="https://x/c.jpg?param=256y256" spinning={false} />);
        expect(screen.getByTestId('vinyl-plate').style.animationPlayState).toBe('paused');
        expect(screen.getByTestId('vinyl-needle').style.transform).toBe('rotate(0deg)');
    });

    it('点击转盘触发播放/暂停', () => {
        const onToggle = vi.fn();
        render(<VinylDisc url="https://x/c.jpg" spinning={false} onToggle={onToggle} />);
        fireEvent.click(screen.getByTestId('vinyl-disc'));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('中心封面用圆形，且点转盘不会把事件漏出去（防穿透）', () => {
        const onToggle = vi.fn();
        const onOuter = vi.fn();
        render(
            <div onClick={onOuter}>
                <VinylDisc url="https://x/c.jpg" spinning={false} onToggle={onToggle} />
            </div>
        );
        fireEvent.click(screen.getByTestId('vinyl-disc'));
        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(onOuter).not.toHaveBeenCalled();
        expect(screen.getByTestId('vinyl-cover').style.borderRadius).toBe('50%');
    });
});
