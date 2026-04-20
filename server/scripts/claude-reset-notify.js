#!/usr/bin/env node
/**
 * Claude reset notifier — sends a Telegram message with current repo state
 * so you (or a downstream listener) can decide whether to resume or start fresh.
 *
 * Reads:  git status, last 5 commits, last user message from newest Claude session.
 * Sends:  to CLAUDE_CHAT_ID via CLAUDE_BOT_TOKEN (falls back to BOT_TOKEN).
 *
 * Run:    node server/scripts/claude-reset-notify.js
 *         node server/scripts/claude-reset-notify.js --dry-run   (print, don't send)
 *
 * Schedule with Windows Task Scheduler or cron at your Claude limit-reset times.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const BOT_TOKEN = process.env.CLAUDE_BOT_TOKEN || process.env.BOT_TOKEN;
const CHAT_ID = process.env.CLAUDE_CHAT_ID;
const REPO_ROOT = path.resolve(__dirname, '../..');
const HOME = process.env.HOME || process.env.USERPROFILE;
const SESSIONS_DIR = path.join(HOME, '.claude', 'projects');
const MAX_MSG_LEN = 3800;

if (!DRY_RUN) {
  if (!BOT_TOKEN) { console.error('✗ CLAUDE_BOT_TOKEN or BOT_TOKEN required'); process.exit(1); }
  if (!CHAT_ID)   { console.error('✗ CLAUDE_CHAT_ID required'); process.exit(1); }
}

function sh(cmd) {
  try { return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8' }).trim(); }
  catch (e) { return ''; }
}

function gitSnapshot() {
  return {
    branch: sh('git rev-parse --abbrev-ref HEAD') || '?',
    status: sh('git status --porcelain'),
    log: sh('git log --oneline -5'),
  };
}

function findLatestSession() {
  if (!fs.existsSync(SESSIONS_DIR)) return null;
  const slug = path.basename(REPO_ROOT).toLowerCase();
  const candidates = [];
  for (const dir of fs.readdirSync(SESSIONS_DIR)) {
    if (!dir.toLowerCase().includes(slug)) continue;
    if (dir.toLowerCase().endsWith('-server')) continue; // prefer client/root sessions
    const full = path.join(SESSIONS_DIR, dir);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (!stat.isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith('.jsonl')) continue;
      const fp = path.join(full, f);
      try { candidates.push({ path: fp, mtime: fs.statSync(fp).mtimeMs }); } catch {}
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0];
}

function lastUserMessage(jsonlPath) {
  let raw;
  try { raw = fs.readFileSync(jsonlPath, 'utf-8'); } catch { return null; }
  const lines = raw.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    let ev;
    try { ev = JSON.parse(lines[i]); } catch { continue; }
    if (ev.type !== 'user') continue;
    const content = ev.message?.content;
    let text = null;
    if (typeof content === 'string') text = content;
    else if (Array.isArray(content)) {
      const t = content.find(c => c.type === 'text');
      if (t) text = t.text;
    }
    if (!text) continue;
    // Skip system reminder wrappers + tool_result blobs
    if (text.startsWith('<') || text.startsWith('Caveat:')) continue;
    return text.trim();
  }
  return null;
}

function truncate(s, n) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function buildMessage() {
  const { branch, status, log } = gitSnapshot();
  const dirtyCount = status ? status.split('\n').length : 0;
  const session = findLatestSession();
  const lastMsg = session ? lastUserMessage(session.path) : null;
  const sessionAge = session
    ? `${Math.round((Date.now() - session.mtime) / 60000)} min ago`
    : null;

  const lines = [
    '🔔 *Claude hunt-window open!*',
    '',
    `🌿 Branch: \`${branch}\``,
    `📝 Dirty files: ${dirtyCount}`,
  ];

  if (sessionAge) lines.push(`🕓 Last session: ${sessionAge}`);

  lines.push('', '*Recent commits:*', '```', truncate(log || '(none)', 400), '```');

  if (status) {
    lines.push('', '*Uncommitted:*', '```', truncate(status, 400), '```');
  }

  if (lastMsg) {
    const quoted = truncate(lastMsg, 350).split('\n').map(l => '> ' + l).join('\n');
    lines.push('', '*Last instruction:*', quoted);
  }

  lines.push(
    '',
    '_Reply `/continue` to resume, or send a new plan._'
  );

  return truncate(lines.join('\n'), MAX_MSG_LEN);
}

async function main() {
  const msg = buildMessage();

  if (DRY_RUN) {
    console.log('--- DRY RUN ---');
    console.log(msg);
    console.log('--- END ---');
    return;
  }

  const bot = new TelegramBot(BOT_TOKEN, { polling: false });
  try {
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
    console.log(`✓ Sent (${msg.length} chars) to chat ${CHAT_ID}`);
  } catch (e) {
    // Markdown errors can happen with stray special chars — retry as plain text.
    console.error('Markdown send failed, retrying plain:', e.message);
    await bot.sendMessage(CHAT_ID, msg.replace(/[*_`]/g, ''));
    console.log('✓ Sent plain fallback');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
