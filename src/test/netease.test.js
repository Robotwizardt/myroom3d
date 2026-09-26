import { beforeEach,describe, expect, it, vi } from 'vitest';

import {
    activeLyricIndex,
    formatDuration,
    getDefaultPlaylistId,
    getPlaylistTracks,
    normalizeSong,
    normalizeTrack,
    parseLrc
} from '../data/netease';

// ---------- 歌单（新格式 playlist.tracks 用 ar/dt/al） ----------

describe('歌单接口封装', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('normalizeTrack 整理歌单曲目（ar/dt 格式）', () => {
        const t = normalizeTrack({
            id: 2735916112,
            name: '小情歌',
            ar: [{ name: '姜眠' }],
            dt: 273631,
            al: { name: '小情歌（女生版）', picUrl: 'http://x/cover.jpg' }
        });
        expect(t.id).toBe(2735916112);
        expect(t.name).toBe('小情歌');
        expect(t.artist).toBe('姜眠');
        expect(t.duration).toBe('4:34');
        expect(t.picUrl).toBe('http://x/cover.jpg');
    });

    it('getDefaultPlaylistId 返回第一个推荐歌单 id', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            json: async () => ({ result: [{ id: 7085429026, name: '旧歌都杀回来了' }] })
        });
        expect(await getDefaultPlaylistId()).toBe(7085429026);
    });

    it('getPlaylistTracks 拉歌单并整理曲目列表', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            json: async () => ({
                playlist: {
                    name: '旧歌都杀回来了',
                    tracks: [
                        { id: 1, name: 'A', ar: [{ name: '姜眠' }], dt: 60000 },
                        { id: 2, name: 'B', ar: [{ name: '周杰' }, { name: '伦' }], dt: 90000 }
                    ]
                }
            })
        });
        const out = await getPlaylistTracks(7085429026);
        expect(out.name).toBe('旧歌都杀回来了');
        expect(out.tracks).toHaveLength(2);
        expect(out.tracks[0]).toEqual({ id: 1, name: 'A', artist: '姜眠', duration: '1:00', picUrl: undefined });
        expect(out.tracks[1].artist).toBe('周杰/伦');
    });

    it('getPlaylistTracks 拉失败时抛错（不静默吞）', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('网络炸了'));
        await expect(getPlaylistTracks(1)).rejects.toThrow('网络炸了');
    });
});

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
