/**
 * 查「这个 ROM 在浏览器里有没有 SRAM 电池存档」（见 ADR-0003）。
 *
 * EmulatorJS 把 `/data/saves` 挂成 IndexedDB（库名就是这个挂载点字符串），
 * store 是 `FILE_DATA`，key 是挂载点下的绝对路径 `/data/saves/<ROM 文件名>.srm`。
 * 这里就是照着它的内部结构直接读，用来给菜单里的卡带点一颗「存档点」。
 *
 * 三条设计约束：
 *   1. **绝不创建空库**：`indexedDB.open` 会把不存在的库建出来，所以先
 *      `indexedDB.databases()` 确认 `/data/saves` 真的存在再 open；
 *      不支持 `databases()` 的浏览器（Firefox < 126）就直接不显示存档点。
 *   2. **绝不抛错**：存档点只是装饰，隐私模式 / 被其它标签页占用 / store 缺失
 *      都返回「没有存档」。
 *   3. 存档是**退出游戏时**才落盘的，所以刚玩完回到菜单才会亮。
 */
import { SAVE_DB, SAVE_STORE, saveKeyFor } from '../data/games';

/** 打开库（调用方先确认过库存在） */
const openDb = (idb, name) =>
    new Promise((resolve, reject) => {
        const req = idb.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('indexedDB.open failed'));
    });

/** 读 Object store 里某个 key 是否存在 */
const readKey = (db, key) =>
    new Promise((resolve, reject) => {
        const store = db.transaction(SAVE_STORE, 'readonly').objectStore(SAVE_STORE);
        const req = store.getKey(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('getKey failed'));
    });

/** 列出浏览器里所有库名；不支持 databases() 时返回 null（= 不知道，别乱 open） */
const listDbNames = async (idb) => {
    if (typeof idb?.databases !== 'function') return null;
    try {
        const dbs = await idb.databases();
        return Array.isArray(dbs) ? dbs.map((d) => d?.name) : null;
    } catch {
        return null;
    }
};

/** 某个 ROM 在浏览器里有没有存档 */
export const hasSave = async (rom, idb = globalThis.indexedDB) => {
    if (!idb || !rom) return false;
    try {
        const names = await listDbNames(idb);
        if (names === null || !names.includes(SAVE_DB)) return false;
        const db = await openDb(idb, SAVE_DB);
        try {
            return !!(await readKey(db, saveKeyFor(rom)));
        } finally {
            db.close?.();
        }
    } catch {
        return false;
    }
};

/** 整份清单里哪些游戏有存档，返回 id 的集合（给菜单一次性用） */
export const listSavedGames = async (games = [], idb = globalThis.indexedDB) => {
    const saved = new Set();
    if (!idb || !Array.isArray(games) || games.length === 0) return saved;

    const names = await listDbNames(idb);
    if (names === null || !names.includes(SAVE_DB)) return saved;

    let db = null;
    try {
        db = await openDb(idb, SAVE_DB);
        for (const g of games) {
            if (!g?.rom) continue;
            try {
                if (await readKey(db, saveKeyFor(g.rom))) saved.add(g.id);
            } catch {
                // 单个 key 读失败（store 缺失等）不影响其它游戏
            }
        }
    } catch {
        return new Set();
    } finally {
        db?.close?.();
    }
    return saved;
};
