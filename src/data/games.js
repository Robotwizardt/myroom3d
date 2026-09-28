/**
 * 电视 GBA 模拟器的游戏清单 + 与模拟器有关的纯逻辑（见 ADR-0003）。
 *
 * 这里是「加游戏」唯一要改的地方：往 GAMES 里加一条，再把对应的 ROM 丢进
 * `public/assets/`。
 *
 * 只放**作者授权分发的免费同人游戏**（GB/GBC/GBA），来源与许可见仓库根目录的
 * `CREDITS.md`；商业 ROM 不进仓库。带 `license` 的条目必须同时写 `author` 与
 * `source`，菜单会把「作者 · 许可」显示出来。
 *
 * 几条来自 EmulatorJS 4.2.3 源码的硬事实（改动前先读 ADR-0003）：
 *   - 换游戏只能换 React key 强制重挂 iframe，改 EJS_gameUrl 无效；
 *   - 每个游戏必须传 EJS_gameName = id，否则 react-emulatorjs 会填
 *     "gameNamePlaceholder"，所有游戏的即时存档与设置互相覆盖；
 *   - SRAM 电池存档落在 IndexedDB 库 `/data/saves`、store `FILE_DATA`，
 *     key 是 `/data/saves/<ROM 文件名>.srm`（**按 ROM 文件名**，不按 id）。
 */

/**
 * 电视里能玩的游戏。
 * `core` 一律是 gba：本地只镜像了 mGBA 核心，而 mGBA 同时吃 GB / GBC / GBA
 * （所以别填 `gb` 平台 id，那会指向没下过的 gambatte 核心）。
 * `platform` 只影响卡带上那行字与署名展示。
 */
export const GAMES = [
    {
        id: 'smbadv4',
        name: '超级马力欧 Advance 4',
        rom: './assets/SuperMarioAdvance4.gba',
        core: 'gba',
        platform: 'gba',
        desc: '2003 · 马力欧 Advance 系列第四作，电视里先从这个开始'
    },
    {
        id: 'tobudx',
        name: 'Tobu Tobu Girl Deluxe',
        rom: './assets/TobuTobuGirlDeluxe.gb',
        core: 'gba',
        platform: 'gb',
        desc: '2019 · 向上飞的像素动作，Game Boy 上少见的爽快手感',
        author: 'Tangram Games',
        license: 'MIT',
        source: 'https://github.com/SimonLarsen/tobutobugirl-dx'
    },
    {
        id: 'ucity',
        name: 'uCity',
        rom: './assets/uCity.gbc',
        core: 'gba',
        platform: 'gbc',
        desc: '城市建造 · 铺路盖楼看小人有班上，GBC 上的迷你模拟城市',
        author: 'AntonioND',
        license: 'GPL-3.0-or-later',
        source: 'https://github.com/AntonioND/ucity'
    },
    {
        id: 'gbhack',
        name: 'GBHack',
        rom: './assets/GBHack.gbc',
        core: 'gba',
        platform: 'gbc',
        desc: '地下城 roguelike · NetHack 风爬塔，一命到底',
        author: 'statico',
        license: 'MIT',
        source: 'https://github.com/statico/gbhack'
    },
    {
        id: '2048gb',
        name: '2048gb',
        rom: './assets/2048gb.gb',
        core: 'gba',
        platform: 'gb',
        desc: '益智 · 只有 32KB 的 2048，方向键推方块',
        author: 'Sanqui',
        license: 'Zlib',
        source: 'https://github.com/Sanqui/2048-gb'
    },
    {
        id: 'big2small',
        name: 'Big2Small',
        rom: './assets/Big2Small.gb',
        core: 'gba',
        platform: 'gb',
        desc: '推箱益智 · 靠变大变小钻窄道，关卡自动存档',
        author: 'mdsteele',
        license: 'GPL-3.0-or-later',
        source: 'https://github.com/mdsteele/big2small'
    }
];

/** 卡带底部那行平台字样（真机卡带也是这么印的） */
export const PLATFORM_LABEL = {
    gba: 'GAME BOY ADVANCE',
    gbc: 'GAME BOY COLOR',
    gb: 'GAME BOY'
};

/** EmulatorJS 的 SRAM 存档落在哪个 IndexedDB（库名就是它的挂载点字符串） */
export const SAVE_DB = '/data/saves';
/** 该库里的 object store 名（Emscripten IDBFS 固定用这个） */
export const SAVE_STORE = 'FILE_DATA';

/** localStorage 里记「上次玩的游戏」的键 */
export const LAST_PLAYED_KEY = 'tv-last-game';

/** 取 ROM 的文件名：去掉 `./`、目录、query 与 hash */
export const romBaseName = (rom) => {
    if (typeof rom !== 'string') return '';
    const clean = rom.split('#')[0].split('?')[0];
    const parts = clean.split('/');
    return parts[parts.length - 1] || '';
};

/** 这个 ROM 在浏览器里的 SRAM 存档 key（EmulatorJS 用绝对路径当 key） */
export const saveKeyFor = (rom) =>
    `${SAVE_DB}/${romBaseName(rom).replace(/\.(gba|gbc|gb)$/i, '')}.srm`;

/** 卡带轮播：从 index 走 step 格，越界两头循环 */
export const nextIndex = (index, length, step) => {
    if (!length || length < 1) return 0;
    return (((index + step) % length) + length) % length;
};

/**
 * HEAD 探测结果的判据。
 * Vite（和多数 SPA 服务器）对 public 下不存在的文件会兜底返回 200 + text/html，
 * 所以不能只看状态码。
 */
export const romProbeVerdict = ({ ok, type } = {}) => {
    if (!ok) return 'missing';
    const t = String(type || '').toLowerCase();
    if (t.includes('text/html')) return 'missing';
    return 'ok';
};

/** 探测单个 ROM 是否存在（HEAD，任何异常都算缺失） */
export const probeRom = async (rom, fetchImpl = fetch) => {
    if (!rom) return 'missing';
    try {
        const res = await fetchImpl(rom, { method: 'HEAD' });
        return romProbeVerdict({
            ok: !!res?.ok,
            type: res?.headers?.get?.('content-type')
        });
    } catch {
        return 'missing';
    }
};

/** 探测整份清单，返回 { [id]: 'ok' | 'missing' } */
export const probeRoms = async (games = GAMES, fetchImpl = fetch) => {
    const entries = await Promise.all(
        games.map(async (g) => [g.id, await probeRom(g.rom, fetchImpl)])
    );
    return Object.fromEntries(entries);
};

/** 读「上次玩的游戏」，没记录 / 隐私模式取不到都返回 null */
export const readLastPlayed = (storage = globalThis.localStorage) => {
    try {
        const v = storage?.getItem?.(LAST_PLAYED_KEY);
        return typeof v === 'string' && v.trim() ? v : null;
    } catch {
        return null;
    }
};

/** 记「上次玩的游戏」，写不进去也不影响游戏 */
export const writeLastPlayed = (id, storage = globalThis.localStorage) => {
    try {
        storage?.setItem?.(LAST_PLAYED_KEY, String(id));
    } catch {
        /* 隐私模式写不进去，忽略 */
    }
};

/** 进菜单时默认高亮哪一张：上次玩的，没有就是第一个 */
export const defaultIndex = (games = GAMES, storage = globalThis.localStorage) => {
    const last = readLastPlayed(storage);
    const i = games.findIndex((g) => g.id === last);
    return i >= 0 ? i : 0;
};
