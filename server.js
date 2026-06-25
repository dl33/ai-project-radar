#!/usr/bin/env node
/*
 * ai-project-radar — 网页 server。解析在 lib/scan.js + lib/sessions.js。
 * 纯本机、零依赖：读项目 git 和本机 AI 会话文件，不联网、不上传。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildState } = require('./lib/scan.js');
const { buildSessions } = require('./lib/sessions.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 7777;

function sendJson(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url.startsWith('/api/state')) return sendJson(res, buildState());
    if (url.startsWith('/api/sessions')) return sendJson(res, buildSessions());
    if (url.startsWith('/api/refresh')) {
      const m = (req.url.split('?')[1] || '').match(/id=([^&]+)/);
      const today = new Date().toISOString().slice(0, 10);
      const { refreshProject } = require('./lib/refresh.js');
      return sendJson(res, refreshProject(decodeURIComponent(m ? m[1] : ''), today, true));
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    return;
  }
  // /live 旧链接重定向到看板（会话已并入项目卡）
  if (url === '/live' || url === '/sessions') { res.writeHead(302, { Location: '/' }); res.end(); return; }
  // 顶层和 /board 都是项目看板
  fs.readFile(path.join(ROOT, 'public', 'index.html'), (err, data) => {
    if (err) { res.writeHead(404); res.end('index.html not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`ai-project-radar → http://localhost:${PORT}  （Ctrl+C 退出）`));
