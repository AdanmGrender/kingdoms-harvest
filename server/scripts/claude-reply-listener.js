#!/usr/bin/env node
/**
 * Claude reply listener — long-running daemon.
 *
 * Listens on CLAUDE_BOT_TOKEN for messages from CLAUDE_CHAT_ID and acts on:
 *   /continue     → spawn `claude -p "<resume prompt>"` in the repo root
 *   /plan <text>  → append <text> to .claude-queue.txt (picked up next session)
 *   (plain text)  → spawn `claude -p "<text>"` as a new task
 *
 * Run:  node server/scripts/claude-reply-listener.js
 *
 * WARNING: Use a SEPARATE bot token from the game's BOT_TOKEN — Telegram rejects
 * two pollers on one token with HTTP 409.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BOT_TOKEN = process.env.CLAUDE_BOT_TOKEN;
const CHAT_ID = process.env.CLAUDE_CHAT_ID ? String(process.env.CLAUDE_CHAT_ID) : null;
const REPO_ROOT = path.resolve(__dirname, '../..');
const QUEUE_FILE = path.join(REPO_ROOT, '.claude-queue.txt');
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

if (!BOT_TOKEN) { console.error('✗ CLAUDE_BOT_TOKEN required'); process.exit(1); }
if (!CHAT_ID)   { console.error('✗ CLAUDE_CHAT_ID required'); process.exit(1); }

const RESUME_PROMPT =
  'Read git log and git status. Find the most recent unfinished task in this ' +
  'project (uncommitted changes, TODO comments added in recent commits, or the ' +
  'last plan I gave you). Continue exactly where we left off. If nothing looks ' +
  'unfinished, list what you would propose as next steps and wait for my pick.';

let busy = false;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function send(text) {
  return bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' }).catch(() =>
    bot.sendMessage(CHAT_ID, text.replace(/[*_`]/g, ''))
  );
}

function runClaude(prompt, label) {
  if (busy) { send('⏳ Already running a task — wait for it to finish.'); return; }
  busy = true;
  send(`🚀 *${label}*\nSpawning claude...`);

  const proc = spawn(CLAUDE_BIN, ['-p', prompt], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let out = '', err = '';
  proc.stdout.on('data', d => { out += d.toString(); });
  proc.stderr.on('data', d => { err += d.toString(); });

  proc.on('error', e => {
    busy = false;
    send(`❌ spawn failed: ${e.message}`);
  });

  proc.on('exit', code => {
    busy = false;
    const tail = (out || err).slice(-2000) || '(no output)';
    send(`✅ Done (exit ${code})\n\`\`\`\n${tail}\n\`\`\``);
  });
}

bot.on('polling_error', (err) => {
  // 409 = another poller on same token. Log once, keep trying.
  console.error('[poll]', err.code || err.message);
});

bot.on('message', (msg) => {
  if (String(msg.chat.id) !== CHAT_ID) return;
  const text = (msg.text || '').trim();
  if (!text) return;

  if (text === '/continue' || text === '/c') {
    runClaude(RESUME_PROMPT, 'Resuming last task');
    return;
  }

  if (text.startsWith('/plan ')) {
    const plan = text.slice(6).trim();
    if (!plan) return send('Usage: `/plan <your plan text>`');
    fs.appendFileSync(QUEUE_FILE, `\n---\n[${new Date().toISOString()}]\n${plan}\n`);
    send(`📝 Appended to \`${path.basename(QUEUE_FILE)}\` (${plan.length} chars).`);
    return;
  }

  if (text === '/status') {
    send(busy ? '⏳ Claude is running.' : '💤 Idle. Send text or `/continue`.');
    return;
  }

  if (text === '/help') {
    send(
      '*Commands:*\n' +
      '`/continue` — resume last unfinished task\n' +
      '`/plan <text>` — queue plan for next session\n' +
      '`/status` — show daemon state\n' +
      '(plain text) — start a new claude task with that prompt'
    );
    return;
  }

  if (text.startsWith('/')) {
    send('Unknown command. `/help` for list.');
    return;
  }

  runClaude(text, `New task: "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"`);
});

console.log(`[listener] chat=${CHAT_ID} cwd=${REPO_ROOT}`);
send('🤖 Claude listener online. `/help` for commands.');

process.on('SIGINT', () => { bot.stopPolling().then(() => process.exit(0)); });
process.on('SIGTERM', () => { bot.stopPolling().then(() => process.exit(0)); });
