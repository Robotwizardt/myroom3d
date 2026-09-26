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

## 阅读指引

- 决定记录：`docs/adr/`
- issue：建在自己仓库 `Robotwizardt/myroom3d`，见 `docs/agents/issue-tracker.md`
