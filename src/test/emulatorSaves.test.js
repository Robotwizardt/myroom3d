import { describe, expect, it, vi } from 'vitest';

import { SAVE_DB, SAVE_STORE } from '../data/games';
import { hasSave, listSavedGames } from '../helper/emulatorSaves';

/**
 * 假 IndexedDB：只实现 emulatorSaves 用到的那几个接口。
 * 注意 open 的 onsuccess 必须异步触发（调用方是先拿到 request 再挂 onsuccess 的）。
 */
const makeFakeIdb = ({ dbs = [], keys = {}, noDatabases = false, storeMissing = false } = {}) => {
    const calls = { open: [], getKey: [] };
    const idb = {
        open: (name) => {
            calls.open.push(name);
            const req = {};
            setTimeout(() => {
                req.result = {
                    close: () => {},
                    transaction: () => ({
                        objectStore: () => {
                            if (storeMissing) throw new Error('no such object store');
                            return {
                                getKey: (key) => {
                                    calls.getKey.push([name, key]);
                                    const q = {};
                                    setTimeout(() => {
                                        q.result = keys[name]?.[key];
                                        q.onsuccess?.();
                                    }, 0);
                                    return q;
                                }
                            };
                        }
                    })
                };
                req.onsuccess?.();
            }, 0);
            return req;
        }
    };
    if (!noDatabases) idb.databases = vi.fn(async () => dbs.map((name) => ({ name })));

    const withKey = {
        ...idb,
        open: (name) => {
            const req = idb.open(name);
            return req;
        }
    };
    return { idb: withKey, calls };
};

const ROM = './assets/SuperMarioAdvance4.gba';
const KEY = '/data/saves/SuperMarioAdvance4.srm';

describe('浏览器存档查询（hasSave）', () => {
    it('库存在且 key 在 → true', async () => {
        const { idb, calls } = makeFakeIdb({
            dbs: [SAVE_DB],
            keys: { [SAVE_DB]: { [KEY]: { timestamp: 123, mode: 33206, contents: [1] } } }
        });
        await expect(hasSave(ROM, idb)).resolves.toBe(true);
        expect(calls.open).toEqual([SAVE_DB]);
        expect(calls.getKey).toEqual([[SAVE_DB, KEY]]);
    });

    it('库在但没这个档 → false（不新增空库）', async () => {
        const { idb, calls } = makeFakeIdb({ dbs: [SAVE_DB], keys: { [SAVE_DB]: {} } });
        await expect(hasSave(ROM, idb)).resolves.toBe(false);
        expect(calls.open).toEqual([SAVE_DB]);
    });

    it('IndexedDB 里根本没有 /data/saves 时，不去 open（否则会创建空库）', async () => {
        const { idb, calls } = makeFakeIdb({ dbs: ['EmulatorJS-roms'] });
        await expect(hasSave(ROM, idb)).resolves.toBe(false);
        expect(calls.open).toEqual([]);
    });

    it('不支持 databases() 的浏览器：不显示存档点，也不创建库', async () => {
        const { idb, calls } = makeFakeIdb({ dbs: [SAVE_DB], noDatabases: true });
        await expect(hasSave(ROM, idb)).resolves.toBe(false);
        expect(calls.open).toEqual([]);
    });

    it('store 缺失 / 环境没有 indexedDB 都不抛', async () => {
        const { idb } = makeFakeIdb({ dbs: [SAVE_DB], storeMissing: true });
        await expect(hasSave(ROM, idb)).resolves.toBe(false);
        await expect(hasSave(ROM, undefined)).resolves.toBe(false);
        await expect(hasSave(ROM, null)).resolves.toBe(false);
    });

    it('没有 rom 或浏览器不支持时直接 false', async () => {
        const { idb, calls } = makeFakeIdb({ dbs: [SAVE_DB], keys: {} });
        await expect(hasSave('', idb)).resolves.toBe(false);
        expect(calls.open).toEqual([]);
    });
});

describe('整份清单的存档状态（listSavedGames）', () => {
    const games = [
        { id: 'smbadv4', name: 'a', rom: ROM, core: 'gba' },
        { id: 'other', name: 'b', rom: './assets/Other.gba', core: 'gba' }
    ];

    it('返回有存档的 id 集合', async () => {
        const { idb, calls } = makeFakeIdb({
            dbs: [SAVE_DB],
            keys: { [SAVE_DB]: { [KEY]: { timestamp: 1 } } }
        });
        const ids = await listSavedGames(games, idb);
        expect([...ids]).toEqual(['smbadv4']);
        expect(idb.databases).toHaveBeenCalledTimes(1);
        expect(calls.open).toEqual([SAVE_DB]);
    });

    it('库不存在 / 没有 indexedDB → 空集合', async () => {
        const { idb } = makeFakeIdb({ dbs: [] });
        await expect(listSavedGames(games, idb)).resolves.toEqual(new Set());
        await expect(listSavedGames(games, undefined)).resolves.toEqual(new Set());
        await expect(listSavedGames([], idb)).resolves.toEqual(new Set());
    });

    it('查询过程中抛错也只返回空集合', async () => {
        const broken = {
            databases: async () => {
                throw new Error('blocked');
            }
        };
        await expect(listSavedGames(games, broken)).resolves.toEqual(new Set());
    });
});

describe('存档常量', () => {
    it('与 EmulatorJS 内部的库名/store 名一致', () => {
        expect(SAVE_DB).toBe('/data/saves');
        expect(SAVE_STORE).toBe('FILE_DATA');
    });
});
