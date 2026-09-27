# AGENTS

本仓库是 AT010303/Room_Portfolio 的个人改造版：一个 3D 房间作品集小宇宙（React Three Fiber + Vite）。
目标：把展示板上的项目卡换成本人自己的本地项目卡，不联网。

## Agent skills

### Issue tracker

Issues 建在你自己的仓库 `Robotwizardt/myroom3d`（远程名 `mine`），用 `gh` 并加 `-R Robotwizardt/myroom3d`。See `docs/agents/issue-tracker.md`.

### Domain docs

单上下文（single-context）：根目录 `CONTEXT.md` + `docs/adr/`。See `docs/agents/domain.md`.

## 环境要点（本机实测）

- dev server：`npm run dev` → 默认 http://localhost:5173/；**若 5173 被占用 Vite 会自动换到 5174**，
  本仓库的 e2e 脚本默认打 5174，可用 `BASE=http://localhost:5173 node scripts/xxx.cjs` 覆盖
- 本机 git/网络走代理：`git -c http.proxy=http://127.0.0.1:7897 ...`（直连 github.com 推送会超时）
- Playwright 验收：`playwright-cli ... --browser=msedge`（本机无 Chrome，用 Edge）
- 跑 `scripts/final_check_*.cjs` 需要全局装的 playwright，用 NODE_PATH 指过去：
  `NODE_PATH="C:/Users/admin/node_modules_global/node_modules/@playwright/cli/node_modules" node scripts/final_check_music.cjs`
  （仓库没把 playwright 列进 devDependencies，免得再下一份浏览器）
