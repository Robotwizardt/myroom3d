# AGENTS

本仓库是 AT010303/Room_Portfolio 的个人改造版：一个 3D 房间作品集小宇宙（React Three Fiber + Vite）。
目标：把展示板上的项目卡换成本人自己的本地项目卡，不联网。

## Agent skills

### Issue tracker

Issues 建在你自己的仓库 `Robotwizardt/myroom3d`（远程名 `mine`），用 `gh` 并加 `-R Robotwizardt/myroom3d`。See `docs/agents/issue-tracker.md`.

### Domain docs

单上下文（single-context）：根目录 `CONTEXT.md` + `docs/adr/`。See `docs/agents/domain.md`.

## 环境要点（本机实测）

- dev server：`npm run dev` → http://localhost:5173/
- 本机 git/网络走代理：`git -c http.proxy=http://127.0.0.1:7897 ...`（直连 github.com 推送会超时）
- Playwright 验收：`playwright-cli ... --browser=msedge`（本机无 Chrome，用 Edge）
