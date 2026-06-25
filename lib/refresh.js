'use strict';
/*
 * 自动更新 PLAN：读项目 git 进展（含英文 commit）+ 当前 PLAN，
 * 调 AI 提炼真实进度、改写 PLAN。读全 git log，不挑词。
 * 「更新进度」按钮 / 定时都调这里。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function loadRegistry() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'registry/projects.json'), 'utf8'));
}
function planPath(proj) {
  if (proj.mode === 'in_repo') return path.join(proj.path, proj.plan_source || 'PLAN.md');
  return path.join(ROOT, proj.plan_source);
}
function gitContext(proj) {
  if (proj.track_git === false) return null;
  const run = (args) => { try { return execFileSync('git', ['-C', proj.path, ...args], { encoding: 'utf8' }).trim(); } catch (e) { return ''; } };
  return {
    log: run(['log', '-15', '--format=%cd %s', '--date=format:%m-%d']),
    stat: run(['diff', '--stat', 'HEAD']),
    files: run(['log', '-8', '--name-only', '--format=']),
    dirty: run(['status', '--porcelain']).split('\n').filter(Boolean).length,
  };
}
function buildPrompt(proj, plan, git, today) {
  return [
    `你在维护项目「${proj.name}」的进度台账（中文）。根据 git 实际进展，更新下面的 PLAN。`,
    '', '【当前 PLAN】', plan,
    '', '【最近 git 提交（commit message 可能是英文，要读懂它实际做了什么）】', git.log || '(无)',
    '', '【未提交改动统计】', (git.stat || '(无)').slice(0, 1200),
    '', '【最近改动的文件】', (git.files || '(无)').slice(0, 1200),
    '', '要求：',
    '- git 显示已完成的，从「接下来做」移到「已完成」',
    '- 概要 / 谁在做 / 接下来做 要反映现状；英文 commit 翻成人话（例：Add user auth = 加了用户登录）',
    '- 没有 git 证据支持的，不要凭空写"完成"',
    `- 更新日期改成 ${today}`,
    '- 严格保持原格式：第一行 `# PLAN · 名字`，然后 `更新日期:` / `状态:`，再 `## 概要` / `## 谁在做` / `## 接下来做` / `## 已完成`',
    '- 只输出更新后的 PLAN 全文，不要任何解释、不要用代码块包裹',
  ].join('\n');
}
// 更新单个项目；write=true 才落盘。返回 {id,name,ok,plan|error}
function refreshProject(projId, today, write) {
  const proj = loadRegistry().find((p) => p.id === projId);
  if (!proj) return { id: projId, ok: false, error: '没找到项目' };
  const git = gitContext(proj);
  if (!git) return { id: projId, name: proj.name, ok: false, error: '非 git 项目，没法自动读进展' };
  const pp = planPath(proj);
  let plan = '';
  try { plan = fs.readFileSync(pp, 'utf8'); } catch (e) { plan = '（暂无 PLAN）'; }
  let out;
  try {
    out = execFileSync('claude', ['-p', buildPrompt(proj, plan, git, today)], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 180000 }).trim();
  } catch (e) { return { id: projId, name: proj.name, ok: false, error: 'AI 调用失败：' + (e.message || e) }; }
  out = out.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  if (write && out.startsWith('#')) fs.writeFileSync(pp, out + '\n');
  return { id: projId, name: proj.name, ok: true, plan: out };
}
// 刷新所有"今天动过"的 git 项目（有提交或有未提交改动）
// 刷新所有有 git 痕迹（有提交或未提交改动）的项目
function refreshAll(today, write) {
  const out = [];
  for (const p of loadRegistry()) {
    if (p.track_git === false) continue;
    const git = gitContext(p);
    if (!git || (!git.dirty && !git.log)) continue; // 没 git 痕迹的跳过
    out.push(refreshProject(p.id, today, write));
  }
  return out;
}
module.exports = { refreshProject, refreshAll, loadRegistry, gitContext };
