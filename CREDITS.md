# 第三方素材署名（CREDITS）

这一页登记仓库里用到的第三方素材、它们的许可与原出处。往 `public/assets/`
或 `public/data` 里放第三方文件时，顺手在这里补一行。

## 电视里的同人游戏（GB / GBC）

电视模拟器只放**作者授权分发的免费同人游戏（homebrew）**，商业 ROM 不放。
下面这些 ROM 取自 [Homebrew Hub](https://hh.gbdev.io) 维护的公开数据库
[`gbdev/database`](https://github.com/gbdev/database)——每个条目自带 `game.json`
元数据（作者、许可、文件），ROM 本体就放在同一个目录里。我只把文件名改成了
易读的写法，文件内容没动。

| 游戏 | 平台 | 作者 | 许可 | 仓库里的文件 | 作者仓库 | 数据条目 |
| --- | --- | --- | --- | --- | --- | --- |
| Tobu Tobu Girl Deluxe | GB | Tangram Games | MIT | `public/assets/TobuTobuGirlDeluxe.gb` | [SimonLarsen/tobutobugirl-dx](https://github.com/SimonLarsen/tobutobugirl-dx) | [entries/tobutobugirldeluxe](https://github.com/gbdev/database/tree/master/entries/tobutobugirldeluxe) |
| uCity | GBC | AntonioND | GPL-3.0-or-later | `public/assets/uCity.gbc` | [AntonioND/ucity](https://github.com/AntonioND/ucity) | [entries/ucity](https://github.com/gbdev/database/tree/master/entries/ucity) |
| GBHack | GBC | statico | MIT | `public/assets/GBHack.gbc` | [statico/gbhack](https://github.com/statico/gbhack) | [entries/gbhack](https://github.com/gbdev/database/tree/master/entries/gbhack) |
| 2048gb | GB | Sanqui | Zlib | `public/assets/2048gb.gb` | [Sanqui/2048-gb](https://github.com/Sanqui/2048-gb) | [entries/2048gb](https://github.com/gbdev/database/tree/master/entries/2048gb) |
| Big2Small | GB | mdsteele | GPL-3.0-or-later | `public/assets/Big2Small.gb` | [mdsteele/big2small](https://github.com/mdsteele/big2small) | [entries/big2small](https://github.com/gbdev/database/tree/master/entries/big2small) |

游戏清单写在 `src/data/games.js`，条目里的 `author` / `license` / `source`
就是上表那三列，菜单底栏会把「作者 · 许可」显示出来。加游戏只改这两个地方。

> `public/assets/SuperMarioAdvance4.gba` 不在上表：它是自备的商业 ROM
> （《超级马力欧 Advance 4》），**不该随仓库分发**，请见下面的「注意」一节。

## 模拟器

| 组件 | 许可 | 出处 | 仓库里的位置 |
| --- | --- | --- | --- |
| EmulatorJS 4.2.3（浏览器端模拟器前端） | GPL-3.0 | <https://github.com/EmulatorJS/EmulatorJS> | `public/data/emulator.min.js`、`loader.js`、`localization/` 等 |
| mGBA 核心（`mgba-wasm.data` / `mgba-legacy-wasm.data`） | MPL-2.0 | <https://github.com/mgba-emu/mgba> | `public/data/cores/` |

`public/data` 是从官方 CDN `https://cdn.emulatorjs.org/stable/data/` 抓下来的
一份镜像（省得每次开电视都连外网），版本 4.2.3。

## 注意：商业 ROM

`public/assets/SuperMarioAdvance4.gba` 是自备的商业卡带 ROM。它一旦进了 git，
就会随仓库公开分发——这是有版权风险的事，别推到公开仓库。要自己玩，把它放在
本地 `public/assets/` 即可（其余同人 ROM 不受影响）。
