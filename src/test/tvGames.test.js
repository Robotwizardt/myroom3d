import { describe, expect, it, vi } from 'vitest';

import {
    GAMES,
    LAST_PLAYED_KEY,
    nextIndex,
    PLATFORM_LABEL,
    probeRom,
    readLastPlayed,
    romBaseName,
    romProbeVerdict,
    saveKeyFor,
    writeLastPlayed
} from '../data/games';

// ---------- 清单本身 ----------

describe('游戏清单', () => {
    it('每条都有 id / name / rom / core / platform，且 id 不重复', () => {
        expect(GAMES.length).toBeGreaterThan(0);
        const ids = GAMES.map((g) => g.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const g of GAMES) {
            expect(typeof g.id).toBe('string');
            expect(g.id).not.toBe('');
            expect(typeof g.name).toBe('string');
            expect(typeof g.rom).toBe('string');
            expect(g.core).toBe('gba');
            expect(g.rom).toMatch(/\.(gba|gbc|gb)$/);
            expect(Object.keys(PLATFORM_LABEL)).toContain(g.platform);
        }
    });

    it('每条都指向 public/assets 下的 ROM', () => {
        for (const g of GAMES) {
            expect(g.rom.startsWith('./assets/')).toBe(true);
        }
    });

    it('带 license 的条目必须写清作者与来源（同人游戏的署名要求）', () => {
        for (const g of GAMES.filter((x) => x.license)) {
            expect(typeof g.author).toBe('string');
            expect(g.author).not.toBe('');
            expect(typeof g.source).toBe('string');
            expect(g.source).toMatch(/^https?:\/\//);
        }
    });

    it('带 license 的都是免费同人游戏，没有商业 ROM 混进来', () => {
        const licensed = GAMES.filter((g) => g.license);
        expect(licensed.length).toBeGreaterThan(0);
        for (const g of licensed) {
            expect(g.platform).toMatch(/^(gb|gbc)$/);
        }
    });
});

// ---------- 平台字样 ----------

describe('卡带平台字样', () => {
    it('三个平台各一句，和真机卡带一致', () => {
        expect(PLATFORM_LABEL.gba).toBe('GAME BOY ADVANCE');
        expect(PLATFORM_LABEL.gbc).toBe('GAME BOY COLOR');
        expect(PLATFORM_LABEL.gb).toBe('GAME BOY');
    });
});

// ---------- ROM 文件名 / 存档 key ----------

describe('ROM 文件名与存档 key', () => {
    it('romBaseName 取最后一段，去掉 ./ 与 query/hash', () => {
        expect(romBaseName('./assets/SuperMarioAdvance4.gba')).toBe('SuperMarioAdvance4.gba');
        expect(romBaseName('/assets/x.gba?v=1')).toBe('x.gba');
        expect(romBaseName('assets/roms/a/b/y.gba#frag')).toBe('y.gba');
        expect(romBaseName('http://host/a/b/z.gba')).toBe('z.gba');
        expect(romBaseName('')).toBe('');
    });

    it('saveKeyFor 拼出 EmulatorJS 的 IDBFS 绝对路径', () => {
        // EmulatorJS 把 /data/saves 挂成 IndexedDB 库，key 是挂载点下的绝对路径
        expect(saveKeyFor('./assets/SuperMarioAdvance4.gba')).toBe(
            '/data/saves/SuperMarioAdvance4.srm'
        );
        expect(saveKeyFor('./assets/x.gba?v=2')).toBe('/data/saves/x.srm');
        // GB / GBC 的 ROM 也要能对上自己的存档
        expect(saveKeyFor('./assets/uCity.gbc')).toBe('/data/saves/uCity.srm');
        expect(saveKeyFor('./assets/2048gb.gb')).toBe('/data/saves/2048gb.srm');
    });
});

// ---------- 轮播索引 ----------

describe('卡带轮播索引', () => {
    it('前后都能循环', () => {
        expect(nextIndex(0, 3, 1)).toBe(1);
        expect(nextIndex(2, 3, 1)).toBe(0);
        expect(nextIndex(0, 3, -1)).toBe(2);
        expect(nextIndex(1, 3, -1)).toBe(0);
    });

    it('空清单或跨多项都安全', () => {
        expect(nextIndex(0, 0, 1)).toBe(0);
        expect(nextIndex(0, 3, 5)).toBe(2);
    });
});

// ---------- ROM 探测 ----------

describe('ROM 探测', () => {
    it('2xx + 二进制类型算存在；text/html 是 Vite 的 SPA 兜底，算缺失', () => {
        expect(romProbeVerdict({ ok: true, type: 'application/octet-stream' })).toBe('ok');
        expect(romProbeVerdict({ ok: true, type: '' })).toBe('ok');
        expect(romProbeVerdict({ ok: true, type: 'application/x-gba-rom' })).toBe('ok');
        expect(romProbeVerdict({ ok: true, type: 'text/html; charset=utf-8' })).toBe('missing');
        expect(romProbeVerdict({ ok: false, type: 'text/html' })).toBe('missing');
    });

    it('probeRom 用 HEAD 探测并读出 content-type', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true,
            headers: { get: () => 'application/octet-stream' }
        }));
        await expect(probeRom('./assets/x.gba', fetchImpl)).resolves.toBe('ok');
        expect(fetchImpl).toHaveBeenCalledWith('./assets/x.gba', { method: 'HEAD' });
    });

    it('网络异常一律算缺失，不抛', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new Error('offline');
        });
        await expect(probeRom('./assets/x.gba', fetchImpl)).resolves.toBe('missing');
        await expect(probeRom('./assets/x.gba', undefined)).resolves.toBe(
            romProbeVerdict({ ok: false, type: '' })
        );
    });
});

// ---------- 上次玩的游戏 ----------

describe('上次玩的游戏', () => {
    const fakeStorage = (init = {}) => {
        const map = new Map(Object.entries(init));
        return {
            getItem: (k) => (map.has(k) ? map.get(k) : null),
            setItem: (k, v) => map.set(k, String(v)),
            dump: () => Object.fromEntries(map)
        };
    };

    it('写了能读回来', () => {
        const storage = fakeStorage();
        writeLastPlayed('smbadv4', storage);
        expect(readLastPlayed(storage)).toBe('smbadv4');
        expect(storage.dump()[LAST_PLAYED_KEY]).toBe('smbadv4');
    });

    it('没记录或存了垃圾时返回 null', () => {
        expect(readLastPlayed(fakeStorage())).toBeNull();
        expect(readLastPlayed(fakeStorage({ [LAST_PLAYED_KEY]: '   ' }))).toBeNull();
        expect(readLastPlayed(null)).toBeNull();
        expect(readLastPlayed(undefined)).toBeNull();
    });

    it('storage 抛错（隐私模式）也不炸', () => {
        const broken = {
            getItem: () => {
                throw new Error('denied');
            },
            setItem: () => {
                throw new Error('denied');
            }
        };
        expect(readLastPlayed(broken)).toBeNull();
        expect(() => writeLastPlayed('x', broken)).not.toThrow();
    });
});
