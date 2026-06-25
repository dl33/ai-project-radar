#!/bin/bash
# AI 工作塔台 — 停止 server
if lsof -ti tcp:7777 >/dev/null 2>&1; then
  lsof -ti tcp:7777 | xargs kill -9 2>/dev/null
  echo "✓ 已停止 AI 工作塔台"
else
  echo "服务本来就没在跑"
fi
