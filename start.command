#!/bin/bash
# ai-project-radar — 双击启动（mac）
cd "$(dirname "$0")"
# 若已在运行，先停掉旧的
lsof -ti tcp:7777 | xargs kill -9 2>/dev/null
echo "正在启动 ai-project-radar…"
node server.js &
sleep 1
open "http://localhost:7777"
echo ""
echo "已打开 → http://localhost:7777"
echo "关掉这个终端窗口即停止服务。"
wait
