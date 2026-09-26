import { describe, expect, it } from 'vitest';

import {
    activeLyricIndex,
    formatDuration,
    normalizeSong,
    parseLrc
} from '../data/netease';

describe('netease API 封装（纯函数）', () => {
    it('formatDuration 毫秒转 m:ss', () => {
        expect(formatDuration(319039)).toBe('5:19');
        expect(formatDuration(0)).toBe('0:00');
        expect(formatDuration(61000)).toBe('1:01');
    });

    it('normalizeSong 整理原始字段', () => {
        const s = normalizeSong({
            id: 5257138,
            name: '屋顶',
            artists: [{ name: '周杰伦' }, { name: '温岚' }],
            duration: 319039
        });
        expect(s.id).toBe(5257138);
        expect(s.name).toBe('屋顶');
        expect(s.artist).toBe('周杰伦/温岚');
        expect(s.duration).toBe('5:19');
    });

    it('parseLrc 解析 LRC 时间戳并升序', () => {
        const lrc =
            '[00:00.00] 作曲 : 周杰伦\n[00:23.97]半夜睡不着觉\n[00:29.23]只好到屋顶找另一个梦境';
        const out = parseLrc(lrc);
        expect(out).toHaveLength(3);
        expect(out[0]).toEqual({ time: 0, text: '作曲 : 周杰伦' });
        expect(out[1].time).toBeCloseTo(23.97);
        expect(out[1].text).toBe('半夜睡不着觉');
        expect(out[2].text).toBe('只好到屋顶找另一个梦境');
    });

    it('parseLrc 空/无歌词返回空数组', () => {
        expect(parseLrc('')).toEqual([]);
        expect(parseLrc(null)).toEqual([]);
    });

    it('activeLyricIndex 返回当前高亮行', () => {
        const lyrics = [
            { time: 0, text: 'a' },
            { time: 10, text: 'b' },
            { time: 20, text: 'c' }
        ];
        expect(activeLyricIndex(lyrics, 0)).toBe(0);
        expect(activeLyricIndex(lyrics, 5)).toBe(0);
        expect(activeLyricIndex(lyrics, 15)).toBe(1);
        expect(activeLyricIndex(lyrics, 25)).toBe(2);
    });
});
