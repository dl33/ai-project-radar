'use strict';
/*
 * 共享解析模块：读 registry + 各项目 PLAN → buildState
 * 网页 server.js 和菜单栏 menubar/ 脚本都 require 这里，逻辑只写一份。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildSessions } = require('./sessions.js');

const ROOT = path.join(__dirname, '..'); // scan.js 在 lib/，项目根是上一级

function loadRegistry() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'registry/projects.json'), 'utf8')); }
  catch (e) { return []; }
}

function planPath(proj) {
  if (proj.mode === 'in_repo') return path.join(proj.path, proj.plan_source || 'PLAN.md');
  return path.join(ROOT, proj.plan_source);
}

function section(md, title) {
  const re = new RegExp('^##\\s*' + title + '\\s*$', 'm');
  const m = re.exec(md);
  if (!m) return '';
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^##\s/m);
  return (next >= 0 ? rest.slice(0, next) : rest).trim();
}

function listItems(text) {
  return text.split('\n')
    .map((l) => l.replace(/^\s*[-*]\s*(\[[ xX]\]\s*)?/, '').trim())
    .filter((l) => l && l !== '（暂无）' && l !== '(暂无)' && !/^附注/.test(l));
}

function parsePlan(proj) {
  const fp = planPath(proj);
  let md = '';
  try { md = fs.readFileSync(fp, 'utf8'); } catch (e) { return { noPlan: true, summary: proj.note || '', who: [], next: [], decisions: [], missing: ['计划待补'], source: proj.mode === 'in_repo' ? '项目自己的' : '塔台代管账' }; }

  const dateM = /更新日期[:：]\s*(\d{4}-\d{2}-\d{2})/.exec(md);
  const statusM = /状态[:：]\s*(active|paused|blocked)/i.exec(md);
  const summary = section(md, '概要');

  const who = [];
  section(md, '谁在做').split('\n').forEach((l) => {
    const mm = /^\s*[-*]\s*(codex|claude)\s*[:：]\s*(.+)$/i.exec(l);
    if (mm) who.push({ ai: mm[1].toLowerCase(), role: mm[2].trim() });
  });

  const next = listItems(section(md, '接下来做') || section(md, '下一步'));
  const decisions = listItems(section(md, '等你拍板') || section(md, '待拍板'));
  let updated = null;
  if (dateM) { const _d = new Date(dateM[1] + 'T00:00:00'); if (!isNaN(_d.getTime())) updated = dateM[1]; }
  const staleDays = proj.stale_days || 7;
  let ageDays = null, stale = false;
  if (updated) {
    ageDays = Math.floor((Date.now() - Date.parse(updated + 'T00:00:00')) / 86400000);
    stale = ageDays > staleDays;
  }
  const missing = [];
  if (!summary) missing.push('概要');
  if (!next.length) missing.push('接下来做');
  if (!updated) missing.push('更新日期');

  return {
    summary, who, next, decisions,
    status: statusM ? statusM[1].toLowerCase() : 'active',
    updated, ageDays, stale, missing,
    source: proj.mode === 'in_repo' ? '项目自己的' : '塔台代管账',
  };
}

function gitInfo(proj) {
  if (proj.track_git === false) return { gitAge: null, dirty: 0, hasGit: false, recent: [] };
  const run = (args) => {
    try { return execFileSync('git', ['-C', proj.path, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch (e) { return ''; }
  };
  const ct = run(['log', '-1', '--format=%ct']);
  const dirtyRaw = run(['status', '--porcelain']);
  const gitAge = ct ? Math.floor((Date.now() - parseInt(ct, 10) * 1000) / 86400000) : null;
  // 最近 5 条提交：日期 + commit message —— 当“最近动了啥”，不依赖任何会话回写 PLAN
  const recentRaw = run(['log', '-5', '--format=%cd\t%s', '--date=format:%m-%d']);
  const recent = recentRaw ? recentRaw.split('\n').filter(Boolean).map((l) => {
    const i = l.indexOf('\t');
    return i < 0 ? { date: '', msg: l } : { date: l.slice(0, i), msg: l.slice(i + 1) };
  }) : [];
  return { gitAge, dirty: dirtyRaw ? dirtyRaw.split('\n').filter(Boolean).length : 0, hasGit: !!ct, recent };
}

function liveStatus(plan, git, staleDays) {
  if (plan.status === 'done') return 'done';
  if (plan.status === 'blocked') return 'blocked';
  if (plan.status === 'paused') return 'paused';
  if (git.gitAge === 0 || git.dirty > 0) return 'active';
  if (git.gitAge !== null && git.gitAge > staleDays) return 'stalled';
  return plan.status || 'active';
}

// 把一个会话归到某个项目：先看它最近操作的文件落在哪个项目目录下，再退回看 cwd
function locateProjectId(s, projects) {
  for (const f of (s.paths || [])) {
    const hit = projects.find((p) => f === p.projPath || f.startsWith(p.projPath + '/'));
    if (hit) return hit.id;
  }
  if (s.cwd) {
    const hit = projects.find((p) => s.cwd === p.projPath || s.cwd.startsWith(p.projPath + '/'));
    if (hit) return hit.id;
  }
  return null;
}

function buildState() {
  const projects = loadRegistry().map((p) => {
    const plan = parsePlan(p);
    const git = gitInfo(p);
    const live = liveStatus(plan, git, p.stale_days || 7);
    return { id: p.id, name: p.name, mode: p.mode, note: p.note, phase: p.phase, projPath: p.path, planSource: p.plan_source, ...plan, git, live };
  });
  // 合并会话：所有会话（含历史 idle）按"最近改的文件 / cwd"归到项目；归不到的进综合区
  let allSess = [];
  try { allSess = buildSessions().sessions; } catch (e) {}
  for (const p of projects) p.live_sessions = [];
  const orphanSessions = [];
  for (const s of allSess) {
    const item = { ai: s.ai, status: s.status, action: s.action, ageSec: s.ageSec, project: s.project };
    const pid = locateProjectId(s, projects);
    if (pid) { const proj = projects.find((p) => p.id === pid); if (proj) proj.live_sessions.push(item); }
    else orphanSessions.push(item);
  }
  // 每个项目的会话：最近在前，最多留 6 个；有正在跑的 → 项目标 active
  for (const p of projects) {
    p.live_sessions.sort((a, b) => a.ageSec - b.ageSec);
    p.live_sessions = p.live_sessions.slice(0, 6);
    if (p.live_sessions.some((x) => x.status === 'active')) p.live = 'active';
  }
  orphanSessions.sort((a, b) => a.ageSec - b.ageSec);
  const rank = (p) => {
    if (p.live === 'blocked') return 0;
    if (p.decisions && p.decisions.length) return 1;
    if (p.live === 'stalled') return 2;
    if (p.live === 'active') return 3;
    if (p.live === 'paused') return 4;
    if (p.live === 'done') return 6;
    return 5;
  };
  projects.sort((a, b) => rank(a) - rank(b));
  return { generatedAt: new Date().toISOString(), refreshSeconds: 10, projects, orphanSessions: orphanSessions.slice(0, 12) };
}

module.exports = { buildState };
