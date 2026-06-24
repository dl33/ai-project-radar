#!/usr/bin/env node
/*
 * ai-project-radar — 网页 server。解析逻辑在 lib/scan.js。
 * 纯本机、零依赖、不读聊天记录。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildState } = require('./lib/scan.js');

const ROOT = __dirname;
const PORT = process.env.PORT || 7777;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/state')) {
    try {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(buildState()));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
    return;
  }
  fs.readFile(path.join(ROOT, 'public', 'index.html'), (err, data) => {
    if (err) { res.writeHead(404); res.end('index.html not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`ai-project-radar → http://localhost:${PORT}  （Ctrl+C 退出）`));
