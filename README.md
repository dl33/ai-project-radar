# ai-project-radar

本机的 AI 项目控制台——一屏看清你用 AI(Claude / Codex 等)推进的所有项目:做到哪了、谁在做、下一步干啥、哪些等你拍板。

> 同时开多个 AI 项目、会话一多就乱、做完一段忘了下一步?这个工具读你的项目计划文件,渲染成一个看板。本机跑、零依赖、不烧 token、不读聊天记录。

## 能干啥

- **看板**:每个项目一张卡——概要 / 谁在做(codex·claude 分色) / 下一步 / 待拍板 / 阶段 / 实时状态。有待拍板或卡住的**自动排最前**。
- **实时状态**:代码项目读 git 自动判"进行中 / 停滞";非代码项目靠手维护的计划文件。
- **会话接力**:每张卡能复制一段"接手提示",贴给新 AI 会话就接上,不用重新交代。
- **菜单栏常驻**(可选):配 SwiftBar 后,菜单栏一直挂着摘要,点开看全部。

## 快速开始

```bash
# 需要 node ≥ 18
cp registry/projects.example.json registry/projects.json
#   每条填: id / name / path(项目绝对路径) / mode / plan_source
node server.js
# 打开 http://localhost:7777
```

双击 `start.command` 也能起(自动开浏览器)。

## 项目计划 PLAN.md

塔台靠每个项目的 `PLAN.md` 渲染,两种放法(registry 的 `mode`):

- `in_repo`:计划放项目自己根目录的 `PLAN.md`。
- `tower_managed`:不方便往项目里放文件(比如别人维护的 repo),计划放本仓库 `projects/<id>.md`。

格式见 `registry/PLAN.template.md`:

```
更新日期: 2026-01-01
状态: active            # active | paused | blocked
## 概要
一句话这项目是干啥的
## 谁在做
- codex: ...
- claude: ...
## 接下来做
- [ ] 一条一行
## 等你拍板
- 有就写，没有删掉这节
```

约定:开工先读 PLAN、收工更新它。写进项目的 `CLAUDE.md` / `AGENTS.md`,AI 开会话就会自动接上。

## 菜单栏(可选,需 SwiftBar)

```bash
brew install --cask swiftbar
```

1. SwiftBar 插件目录选本仓库的 `menubar/`。
2. 改 `menubar/tower.10s.js` 第一行的 node 路径为你的(`which node` 查)。

## 隐私

纯本机,不联网、不读聊天记录。真实名单 `registry/projects.json` 和代管计划 `projects/` 都已 gitignore,不进 git。

## 协议

MIT
