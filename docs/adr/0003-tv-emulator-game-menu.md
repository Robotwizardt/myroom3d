# ADR 0003: 电视 GBA 模拟器的卡带菜单、本地化与存档

- 状态：已确认
- 日期：2026-09-28
- 决策人：仓库所有者（Robotwizardt）

## 背景

电视特写里原来只有一个写死 ROM 的模拟器（`src/RoomModel/iframes/tvEmulator.jsx`
里 `EJS_gameUrl="./assets/SuperMarioAdvance4.gba"`），一进去就自动开机，
没有选择界面。所有者要「能有个选择界面选择游戏」，并接受 ROM 由自己丢进
`public/assets`。

动手前查到三件决定实现方式的事实（`react-emulatorjs@2.2.6` 源码 + EmulatorJS 4.2.3 实测）：

1. **换模拟器不能热切**。`react-emulatorjs` 只渲染一个 `<iframe srcDoc>`
   （`node_modules/react-emulatorjs/src/EmulatorJS.tsx:54-60`），`EJS_*` 不是写进 HTML、
   而是在子 window 上挂全局（同文件 `:17-26`）。改 `EJS_gameUrl` 不会重挂文档、
   还会漏一个永不清除的 100ms interval（`:34-42`）。**换 React `key` 是唯一可行的重挂方式。**
   组件没有 destroy/quit API，也没有 forward ref。
2. **整个模拟器默认走 CDN**（`src/defaultPathToData.ts:1-5`），断网就玩不了。
   官方支持 `EJS_pathtodata` 指到本地目录。
3. **存档在 IndexedDB**：SRAM 电池存档落在库名 `"/data/saves"`、store `"FILE_DATA"`、
   key 为绝对路径 `/data/saves/<ROM文件名>.srm`；而即时存档默认是「下载文件」，
   只有改成 Keep in Browser 才写 `EmulatorJS-states/states/<gameName>.state`。
   `getBaseFileName`（`emulator.js:650`）在 SRAM 路径上**优先用 ROM 的 URL 基名**，
   在即时存档/settings 上**优先用 `EJS_gameName`**。

## 决定

1. **菜单自己做，做成拟物卡带轮播**：进电视特写先出菜单（不自动开机），
   ←→ 切当前卡带、Enter 或点卡带开始；屏右上角一个半透明 ✕ 与 Esc/Backspace 回菜单。
   清单读 `src/data/games.js`（`id` / `name` / `rom` / `core` 必填，`desc` 可选）。
2. **换游戏 = 换 React `key` 强制重挂 iframe**，并把每个游戏的 `EJS_gameName`
   设成清单里的 `id`（不设时 `react-emulatorjs` 会填 `gameNamePlaceholder`，
   导致所有游戏共用一份即时存档与设置）。
3. **本地化到 `public/data`**：只下 GBA 需要的最小集合（`loader.js`、
   `emulator.min.js`、`emulator.min.css`、`localization/en-US.json`、
   `compression/extract7z.js`、`cores/mgba-wasm.data`、`cores/reports/mgba.json`，
   合计 1.72 MiB），组件传 `EJS_pathtodata="/data"`。只备默认的 `mgba-wasm.data`
   变体（本机是 Edge + WebGL2），不备 legacy/thread 变体。GBA 不需要 BIOS。
   这批文件提交进 git，clone 下来即可离线玩。
4. **存档按真实浏览器状态显示**：菜单加载时查 IndexedDB（先 `indexedDB.databases()`
   确认 `/data/saves` 存在，再 `getKey('/data/saves/<ROM基名>.srm')`），
   有档的卡带点一颗小黄点。查询失败/不支持时静默不显示，绝不抛错。
5. **键盘相机在电视特写里停用**（`cameraState === 'tv'` 时不再吃方向键与 WASD），
   让方向键归菜单与 GBA 十字键；R 回全景保留。
6. **键位照 EmulatorJS 默认**（`emulator.js initControlVars` 实测）：GBA 为
   方向键 = 十字键、`Z` = A、`X` = B、`Q` = L、`E` = R、`Enter` = Start、`V` = Select。
   菜单底部常驻这行小字，进游戏后再浮一个 3 秒自动淡出的提示。
7. **加载与故障可见**：点卡带后先盖黑底「正在开机…」遮罩，模拟器 `start` 事件
   （`loader.js:155-157` 把 `EJS_onGameStart` 挂在 `start` 上）后淡出；
   超过 8 秒补一行提示，出错则显示可读错误 + 「返回菜单」。
8. **ROM 缺失在菜单里就地降级**：加载时对每条 `rom` 发 HEAD 请求，
   返回 `text/html`（Vite 对不存在文件的 SPA 兜底）或非 2xx 的条目变灰标「文件缺失」，
   点了不启动，并提示把 ROM 放进 `public/assets/`。
9. **只放作者授权分发的免费同人游戏**（GB / GBC / GBA），商业 ROM 不进仓库。
   条目带 `platform`（决定卡带底部印 `GAME BOY` / `GAME BOY COLOR` /
   `GAME BOY ADVANCE`）与 `author` / `license` / `source`（带 `license` 就必须
   三个都写），菜单底栏把「作者 · 许可」显示出来，逐条的出处与许可汇总在仓库
   根目录的 `CREDITS.md`。同人 ROM 主要来自 Homebrew Hub 的公开数据库
   `gbdev/database`（每个条目自带许可元数据）。
10. **`core` 一律填 `gba`**：本地只镜像了 mGBA 核心，它同时吃 GB / GBC / GBA；
    填 `gb` 平台 id 会指向没下过的 gambatte 核心，反而开不了机。

## 考虑过并否掉的替代

- **改 `EJS_gameUrl` 热换游戏**：实测无效（不会重挂 iframe），且会漏 interval。
- **给每个 ROM 常驻一个 iframe**：内存与音频都浪费，存档落盘时机互相干扰。
- **在房间 glb 里加实体卡带物件**：`public/assets/RoomModel.glb` 的 22 个节点里
  没有任何卡带/游戏机，要新建模 + 拾取交互，收益不如屏内菜单。
- **保持走 CDN**：少几 MB 仓库，但断网玩不了；所有者已明确选本地化。
- **把即时存档也做进菜单**：默认模式下它是「下载文件」，语义与 SRAM 不同，
  菜单只管 SRAM 那颗存档点。

## 后果

- 加/换游戏：改 `src/data/games.js` + 丢 ROM 进 `public/assets`，不用碰组件。
  卡带数量变了会自动缩尺寸，保证一排装得下（6 张时每张约 216px）。
- 仓库多 1.72 MiB 二进制（`public/data`）。
- 切换游戏会有一次 iframe 重挂，期间显示开机遮罩。
- **存档跟着 ROM 文件名走**：重命名 ROM 文件等于丢档；改 `id` 只影响即时存档与设置。
