# ai-project-radar

本机的 AI 项目控制台——一屏看清你用 AI(Claude / Codex)推进的所有项目:做到哪了、谁在动、下一步干啥、哪些等你拍板。

> 同时用 AI 推好几个项目、开一堆会话,过两天就乱:哪个项目到哪了?这个会话上次让它干啥来着?这工具把每个项目的计划 + 实时 AI 会话渲染成一个看板。本机跑、零依赖。

## 能干啥

- **项目看板**:每个项目一张卡——概要 / 谁在做(codex·claude 分色) / 下一步 / 待拍板 / 阶段 / 状态。有待拍板或卡住的**自动排最前**。
- **实时会话监控**:读本机 Claude / Codex 的会话记录,看**此刻哪个 AI 在动、挂在哪个项目、最后一步在干啥**。会话按"最近改过的文件"自动归到项目;归不到具体项目的(在仓库外干活的)进一张"未归项目"卡。纯读本机文件、不联网。
- **未提交改动信号** 🔥:哪个项目堆着一批没提交的改动(正在大改),一眼可见——不靠提交、不靠回写,`git status` 就照得出。
- **自动更新进度**:点项目卡的「🔄 更新进度」,让 AI 读这个项目的 git(提交 + 未提交)**自动改写 PLAN 的进度**,不用手动维护。(这步会调一次本机 `claude` CLI、用一点 token。)
- **会话接力**:每张卡能复制一段"接手提示",贴给新 AI 会话就接上,不用重新交代。
- **菜单栏常驻**(可选,SwiftBar):菜单栏一直挂着摘要(几个项目、几个在跑、几个待拍板),点开看全部。

## 快速开始

```bash
# 需要 node ≥ 18
cp registry/projects.example.json registry/projects.json
#   每条填: id / name / path(项目绝对路径) / mode / plan_source
node server.js
# 打开 http://localhost:7777
```

双击 `start.command` 也能起(自动开浏览器)。「🔄 更新进度」按钮需要本机装了 `claude` CLI。

## 项目计划 PLAN.md

每个项目一个 `PLAN.md`,两种放法(registry 的 `mode`):

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

可以手动维护,也可以让「🔄 更新进度」按钮交给 AI 自动改写。约定:开工先读 PLAN。把这条写进项目的 `CLAUDE.md` / `AGENTS.md`,AI 开会话就会自动接上。

## 菜单栏(可选,需 SwiftBar)

```bash
brew install --cask swiftbar
```

1. SwiftBar 插件目录选本仓库的 `menubar/`。
2. 改 `menubar/tower.10s.js` 第一行的 node 路径为你的(`which node` 查)。

## 隐私

纯本机:不联网、不上传任何东西。

- 会**读**本机的 git 记录和 Claude / Codex 会话文件(`~/.claude`、`~/.codex`),只读最近活动、只在本机渲染。
- 真实项目名单 `registry/projects.json` 和代管计划 `projects/` 已 gitignore,不进 git。
- 「🔄 更新进度」调用本机 `claude` CLI(走你自己的账号 / 额度)。

## 协议

MIT
