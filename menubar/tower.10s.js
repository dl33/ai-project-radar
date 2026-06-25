#!/opt/homebrew/bin/node
// ↑ 这行是 node 的绝对路径。clone 本仓库后，改成你自己的（终端跑 `which node` 查），否则 SwiftBar 找不到 node。
// <bitbar.title>项目雷达</bitbar.title>
// <bitbar.version>1.0</bitbar.version>
// <bitbar.author>you</bitbar.author>
// <bitbar.desc>本机 AI 项目雷达·菜单栏摘要</bitbar.desc>
// <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>
'use strict';

const path = require('path');
const out = (l) => process.stdout.write(l + '\n');

let s;
try {
  s = require(path.join(__dirname, '..', 'lib', 'scan.js')).buildState();
} catch (e) {
  out('塔 ⚠');
  out('---');
  out('读取失败：' + (e && e.message));
  process.exit(0);
}

const projects = s.projects || [];
const dueN = projects.filter((p) => p.decisions && p.decisions.length).reduce((n, p) => n + p.decisions.length, 0);
const activeN = projects.filter((p) => (p.live_sessions || []).some((x) => x.status === 'active') || (p.git && p.git.dirty > 0)).length;

// 菜单栏常驻标题
let title = '塔 ' + projects.length;
if (activeN) title += ' ·' + activeN + '活跃';
if (dueN) title += ' ·' + dueN + '待拍';
out(title + ' | size=13');

out('---');
out(projects.length + ' 个项目 · ' + dueN + ' 待拍板 | size=12 color=gray');
out('---');
out('▸ 🛰 项目看板　看谁在跑 / 改了啥 | href=http://localhost:7777/ size=14 color=#3fb950');
out('---');

const colorOf = (p) => (p.decisions && p.decisions.length) ? 'red'
  : (p.live === 'stalled') ? 'orange'
  : (p.live === 'done') ? 'gray' : 'green';

projects.forEach((p) => {
  let sub;
  if (p.decisions && p.decisions.length) sub = p.decisions.length + ' 件待拍板';
  else if (p.live === 'stalled') sub = (p.git && p.git.gitAge != null ? p.git.gitAge + ' 天没动' : '停滞');
  else if (p.next && p.next.length) sub = p.next[0];
  else sub = (p.live === 'active' ? '进行中' : p.live);

  out('● ' + p.name + '　' + (p.phase || '') + ' | color=' + colorOf(p) + ' href=http://localhost:7777/board size=13');
  (p.live_sessions || []).filter((ls) => ls.status !== 'idle').forEach((ls) => out('-- 🟢 ' + ls.ai + (ls.status === 'active' ? ' 正在跑' : ' 刚停') + ' · ' + (ls.action || '').slice(0, 18) + ' | color=#3fb950 size=12'));
  if (p.git && p.git.dirty > 0) out('-- 🔥 ' + p.git.dirty + ' 处改动未提交' + (p.git.dirty > 50 ? ' · 大改中' : '') + ' | color=#e3b341 size=12');
  out('-- ' + sub.slice(0, 26) + ' | size=12');
  (p.next || []).slice(0, 4).forEach((n) => out('-- ☐ ' + n.slice(0, 24) + ' | size=12'));
  (p.decisions || []).slice(0, 3).forEach((d) => out('-- ⚠ ' + d.slice(0, 24) + ' | color=red size=12'));
  // 最近 git 提交（自动，不靠回写）
  const recent = (p.git && p.git.recent) || [];
  if (recent.length) {
    out('-- 最近提交 | size=11 color=gray');
    recent.slice(0, 3).forEach((c) => out('-- ' + (c.date ? c.date + '  ' : '') + c.msg.slice(0, 22) + ' | size=11 color=gray'));
  }
});

out('---');
out('打开完整看板（项目详情） | href=http://localhost:7777/board');
out('启动 / 重启服务 | bash="' + path.join(__dirname, '..', 'start.command') + '" terminal=false');
out('停止服务 | bash="' + path.join(__dirname, '..', 'stop.command') + '" terminal=false');
out('刷新 | refresh=true');
