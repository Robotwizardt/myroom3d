# CONTEXT

本仓库是 AT010303/Room_Portfolio 的个人改造版：一个 3D 房间作品集小宇宙
（React Three Fiber + Vite）。目标：把展示板上的项目卡换成本人内容。

## 术语表

- **展示板 (displayBoard)**：房间红墙上那块黑色公告板，上面有 6 个可点图标，
  是整个作品集的「项目导航板」。见 ADR-0001。
- **6 张卡 / 卡片 (card)**：展示板上的 6 个可点图标——显示器 desktop、
  手机 smartphone、电视 tv、笔记本 laptop、音乐 music、主页 home。
  点一张卡，镜头飞到对应设备并显示内容。
- **项目卡 / 大面板 (ProjectPanel / Overlay)**：点卡后浮在屏幕最上层的可读面板，
  显示项目标题/描述，能 Esc 关闭、左右键切换。
- **设备屏幕 (device screen / Html screen)**：3D 场景里嵌在设备上的那块内容
  （用 drei 的 `<Html transform>` 渲染），如显示器屏幕、手机屏幕。
- **镜头状态 (cameraState)**：zustand 里的相机目标——default / desktop / laptop /
  tv / smartphone / displayBoard。切换它镜头会 setLookAt 飞过去。
- **键盘移动 (keyboard move)**：WASD 平移 + 方向键转视角 + Q/E 升降 + R 回全景，
  自加功能。弹大面板时临时禁用。
- **网易云 API**：所有者自建的音乐接口 `http://101.35.40.219:3000`，
  播放器用它搜索/点歌/取歌词。
- **专辑封面 (albumArt)**：一首歌曲的封面图，来自网易云接口的 `al.picUrl`
  （`src/data/netease.js` 里 `normalizeTrack` 已读成 `picUrl`）。
  **歌单封面** 另指 `playlist.coverImgUrl`（整个歌单的图，不是某一首歌的）。见 ADR-0002。
- **封面占位块 (albumArtFallback)**：封面图加载失败（断网/403）时显示的灰底 ♪ 方块，
  尺寸与真封面一致，避免布局跳动。见 ADR-0002。
- **黑胶转盘 (vinylDisc)**：播放器右侧那块「黑胶片 + 中心封面 + 唱针」的图形，
  播放时旋转、暂停时静止。见 ADR-0002。
- **游戏清单 (games)**：电视 GBA 模拟器的卡带列表，写在 `src/data/games.js`，
  每项含 `id` / `name` / `rom`（指向 `public/assets`）/ `core`，可选 `desc`。
  ROM 本体不进仓库，由所有者自己丢。见 ADR-0003。
- **卡带菜单 (cartridgeMenu)**：进电视特写后先出现的那屏拟物卡带轮播
  （←→ 选、Enter 开始），选定后才重挂并启动模拟器。见 ADR-0003。
- **存档点 (saveMark)**：卡带角上那颗小黄点，表示这个 ROM 在浏览器里已有 SRAM
  电池存档（IndexedDB 库 `/data/saves`）。刚玩完回菜单才亮。见 ADR-0003。
- **开机遮罩 (bootOverlay)**：点卡带后盖住屏幕的「正在开机…」黑底层，
  模拟器发出 start 事件后淡出；超时/出错时换成可读文案。见 ADR-0003。

## 阅读指引

- 决定记录：`docs/adr/`
- issue：建在自己仓库 `Robotwizardt/myroom3d`，见 `docs/agents/issue-tracker.md`
