'use strict';
/*
 * 实时会话监控：扫 claude + codex 的会话记录文件，
 * 解析出「哪个 AI · 挂哪个项目 · 最后在干啥 · 还活着吗」。
 * 纯读本机文件，不调 AI、不烧 token。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude', 'projects');
const CODEX_DIR = path.join(HOME, '.codex', 'sessions');

const ACTIVE_SEC = 90;                  // 90 秒内动过 = 正在跑
const RECENT_SEC = 10 * 60;             // 10 分钟内 = 刚停 / 在想
const SHOW_WITHIN_SEC = 12 * 60 * 60;   // 只显示最近 12 小时活动过的会话

// 读文件尾部 maxBytes（大会话文件不全读）
function readTail(fp, maxBytes) {
  try {
    const fd = fs.openSync(fp, 'r');
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch (e) { return ''; }
}

function readHead(fp, maxBytes) {
  try {
    const fd = fs.openSync(fp, 'r');
    const len = Math.min(maxBytes, fs.fstatSync(fd).size);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch (e) { return ''; }
}

function jsonLines(text) {
  const out = [];
  for (const l of text.split('\n')) {
    const t = l.trim();
    if (!t || t[0] !== '{') continue;
    try { out.push(JSON.parse(t)); } catch (e) { /* 尾部截断行跳过 */ }
  }
  return out;
}

function projName(cwd) {
  if (!cwd) return '?';
  return cwd.split('/').filter(Boolean).pop() || '?';
}

function trunc(s, n) { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }

function statusOf(ageSec) {
  if (ageSec <= ACTIVE_SEC) return 'active';
  if (ageSec <= RECENT_SEC) return 'recent';
  return 'idle';
}

// —— Claude：最后一条 assistant 在干啥 ——
function claudeAction(content) {
  if (!Array.isArray(content)) return '';
  for (let i = content.length - 1; i >= 0; i--) {
    const c = content[i];
    if (c.type === 'tool_use') {
      const inp = c.input || {};
      const tgt = inp.file_path || inp.path || inp.command || inp.pattern || inp.description || '';
      return '🔧 ' + c.name + (tgt ? ' · ' + trunc(String(tgt), 40) : '');
    }
    if (c.type === 'text' && c.text && c.text.trim()) return '💬 ' + trunc(c.text, 50);
  }
  return '';
}

function scanClaude() {
  const sessions = [];
  const now = Date.now();
  let projDirs = [];
  try { projDirs = fs.readdirSync(CLAUDE_DIR); } catch (e) { return sessions; }
  for (const pd of projDirs) {
    if (/mem-observer|claude-mem/.test(pd)) continue; // 过滤记忆插件后台会话
    const dir = path.join(CLAUDE_DIR, pd);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')); } catch (e) { continue; }
    for (const f of files) {
      const fp = path.join(dir, f);
      let st; try { st = fs.statSync(fp); } catch (e) { continue; }
      const ageSec = (now - st.mtimeMs) / 1000;
      if (ageSec > SHOW_WITHIN_SEC) continue;
      const objs = jsonLines(readTail(fp, 64 * 1024));
      let cwd = '', action = '';
      const paths = []; // 最近操作过的文件绝对路径（最近在前），用来把会话归到项目
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        if (!cwd && o.cwd) cwd = o.cwd;
        if (o.type === 'assistant' && o.message && Array.isArray(o.message.content)) {
          for (const c of o.message.content) {
            if (c.type === 'tool_use' && c.input) {
              const fp2 = c.input.file_path || c.input.path || c.input.notebook_path;
              if (typeof fp2 === 'string' && fp2[0] === '/') paths.push(fp2);
            }
          }
          if (!action) action = claudeAction(o.message.content);
        }
      }
      sessions.push({
        ai: 'claude', id: f.replace('.jsonl', '').slice(0, 8),
        project: projName(cwd), cwd, paths,
        action: action || '(无最近动作)',
        ageSec: Math.round(ageSec), status: statusOf(ageSec), mtime: st.mtimeMs,
      });
    }
  }
  return sessions;
}

// —— Codex：最后一条 agent_message / function_call ——
function codexAction(objs) {
  for (let i = objs.length - 1; i >= 0; i--) {
    const p = objs[i].payload || {};
    if (p.type === 'task_complete') return '✅ 这轮完成，待命';
    if (p.type === 'agent_message' && p.message) return '💬 ' + trunc(p.message, 50);
    if (p.type === 'function_call' && p.name) {
      let arg = '';
      try { const a = JSON.parse(p.arguments || '{}'); arg = Array.isArray(a.command) ? a.command.join(' ') : (a.command || a.cmd || ''); } catch (e) {}
      return '🔧 ' + p.name + (arg ? ' · ' + trunc(String(arg), 40) : '');
    }
  }
  return '';
}

// codex 操作过的文件路径（从 function_call 参数里抓绝对路径）
function codexPaths(objs) {
  const paths = [];
  for (let i = objs.length - 1; i >= 0 && paths.length < 12; i--) {
    const p = objs[i].payload || {};
    if (p.type === 'function_call' && p.arguments) {
      const m = String(p.arguments).match(/\/[A-Za-z0-9_一-龥][A-Za-z0-9_.\/\-一-龥]{6,}/g);
      if (m) for (const x of m) paths.push(x);
    }
  }
  return paths;
}

function scanCodex() {
  const sessions = [];
  const now = Date.now();
  function walk(dir, depth) {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth < 3) walk(fp, depth + 1); continue; }
      if (!e.name.startsWith('rollout-') || !e.name.endsWith('.jsonl')) continue;
      let st; try { st = fs.statSync(fp); } catch (err) { continue; }
      const ageSec = (now - st.mtimeMs) / 1000;
      if (ageSec > SHOW_WITHIN_SEC) continue;
      let cwd = '';
      for (const o of jsonLines(readHead(fp, 64 * 1024))) {
        if (o.type === 'session_meta' && o.payload && o.payload.cwd) { cwd = o.payload.cwd; break; }
      }
      const tailObjs = jsonLines(readTail(fp, 64 * 1024));
      const m = e.name.match(/([0-9a-f]{8})-[0-9a-f]{4}/);
      sessions.push({
        ai: 'codex', id: m ? m[1] : e.name.slice(8, 16),
        project: projName(cwd), cwd, paths: codexPaths(tailObjs),
        action: codexAction(tailObjs) || '(无最近动作)',
        ageSec: Math.round(ageSec), status: statusOf(ageSec), mtime: st.mtimeMs,
      });
    }
  }
  walk(CODEX_DIR, 0);
  return sessions;
}

function buildSessions() {
  const all = [...scanClaude(), ...scanCodex()];
  all.sort((a, b) => b.mtime - a.mtime); // 最近活动在最上
  const counts = {
    active: all.filter((s) => s.status === 'active').length,
    recent: all.filter((s) => s.status === 'recent').length,
    total: all.length,
  };
  return { generatedAt: new Date().toISOString(), counts, sessions: all };
}

module.exports = { buildSessions };
