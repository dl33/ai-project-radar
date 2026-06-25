#!/bin/bash
# AI 工作塔台 — 启动 server（双击，或 SwiftBar 菜单「启动 / 重启服务」都可）
cd "$(dirname "$0")"
# 若已在运行，先停掉旧的
lsof -ti tcp:7777 | xargs kill -9 2>/dev/null
# 起一个独立后台进程——脱离终端 / SwiftBar / 父进程，关了都不停
nohup node server.js > /tmp/ai-tower.log 2>&1 &
disown
sleep 1
open "http://localhost:7777"
echo "✓ AI 工作塔台已在后台启动 → http://localhost:7777"
echo "  独立进程，关终端 / 菜单栏都不影响。"
echo "  要停：菜单「停止服务」，或 lsof -ti:7777 | xargs kill"
