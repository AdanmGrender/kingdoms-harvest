# Claude workflow scripts

Two small utilities that let Telegram drive a Claude CLI session:

| Script | Role |
|---|---|
| `claude-reset-notify.js` | **One-shot**: sends you a Telegram message with current repo state (git status + last user message). Run from cron/Task Scheduler at Claude usage-limit reset times. |
| `claude-reply-listener.js` | **Daemon**: listens on the same bot for your replies and spawns `claude -p "<prompt>"` so you can resume or start new work straight from Telegram. |

---

## 1. One-time setup

### a. Make a dedicated bot
Talk to [@BotFather](https://t.me/BotFather) → `/newbot` → save the token.
**Do not reuse the game's `BOT_TOKEN`** — Telegram allows only one long-poll per token (409 Conflict).

### b. Find your chat ID
DM your new bot anything, then:
```
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
```
Copy the numeric `chat.id` from the JSON.

### c. Fill env vars
Add to `server/.env`:
```
CLAUDE_BOT_TOKEN=123456:AA...
CLAUDE_CHAT_ID=123456789
```
Optional: `CLAUDE_BIN=C:\\path\\to\\claude.exe` if `claude` isn't on PATH.

---

## 2. Test the notifier

Dry-run first (no Telegram send):
```bash
node server/scripts/claude-reset-notify.js --dry-run
```
Then real send:
```bash
node server/scripts/claude-reset-notify.js
```

---

## 3. Schedule the notifier (Windows Task Scheduler)

Claude Pro/Max usage windows are 5 hours. Pick the clock-times you want to be pinged.

**Option A — GUI:**
1. Task Scheduler → *Create Task*
2. Triggers → *Daily*, repeat every `5 hours` for `1 day`
3. Actions → *Start a program*:
   - Program: `node` (or full path to node.exe)
   - Arguments: `server\scripts\claude-reset-notify.js`
   - Start in: `C:\Users\manes\Desktop\kingdoms-harvest`
4. Conditions → uncheck "Start only if on AC power" if on laptop.

**Option B — PowerShell (admin):**
```powershell
$action = New-ScheduledTaskAction `
  -Execute "node" `
  -Argument "server\scripts\claude-reset-notify.js" `
  -WorkingDirectory "C:\Users\manes\Desktop\kingdoms-harvest"

$trigger = New-ScheduledTaskTrigger -Once -At 8am `
  -RepetitionInterval (New-TimeSpan -Hours 5)

Register-ScheduledTask -TaskName "ClaudeResetNotify" `
  -Action $action -Trigger $trigger -Description "Notify on Claude limit reset"
```

**Linux/WSL cron equivalent:**
```
0 8,13,18,23 * * * cd /path/to/kingdoms-harvest && node server/scripts/claude-reset-notify.js
```

---

## 4. Run the reply listener

Foreground (for testing):
```bash
node server/scripts/claude-reply-listener.js
```

Background via PM2:
```bash
cd server
npx pm2 start scripts/claude-reply-listener.js --name claude-listener
npx pm2 save
npx pm2 startup    # follow printed command to auto-start on boot
```

### Commands (from your Telegram chat)
| Message | What happens |
|---|---|
| `/continue` or `/c` | Spawns `claude -p` with a "resume last unfinished task" prompt |
| `/plan <text>` | Appends to `.claude-queue.txt` in repo root for next session to read |
| `/status` | Shows if a claude process is running |
| `/help` | Lists commands |
| Any other text | Spawns `claude -p "<your text>"` as a new task |

Output from the spawned `claude` is streamed back as a Telegram reply (last 2000 chars).

---

## Security notes

- `.env` is git-ignored — **never commit `CLAUDE_BOT_TOKEN`**.
- The listener trusts `CLAUDE_CHAT_ID` only; any other chat is ignored. Verify you typed your ID correctly or a stranger messaging your bot could... still do nothing, but don't lower your guard.
- Spawned `claude` inherits your shell environment and can run shell commands with the same permissions as the listener process. Don't run the listener as root / Administrator.
