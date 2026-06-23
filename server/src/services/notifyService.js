/**
 * Telegram bot DM helper — single fire-and-forget entry point that respects
 * the `players.notif_enabled` opt-out flag (introduced in migration 005).
 *
 * gameTick.js has its own copy of this helper with a 5-min in-process cache
 * because it can fan out to dozens of DMs per minute. Other services (combat,
 * achievement, marketplace) call this helper directly — fewer events per
 * call, no caching needed.
 */
const db = require('../config/database');
const { getBot } = require('../bot/telegramBot');

const notifyService = {
  /**
   * Fire a Telegram DM to the player. Returns the promise but errors are
   * swallowed — callers don't need to await. Skips entirely when:
   *   - bot isn't initialized (BOT_TOKEN missing)
   *   - player has opted out via `notif_enabled = 0`
   *   - player record doesn't exist
   */
  async sendBotDM(playerId, message) {
    if (!playerId || !message) return;
    try {
      const player = await db('players')
        .where('telegram_id', playerId)
        .select('notif_enabled')
        .first();
      // Default to enabled if the column is NULL (pre-migration safety)
      const enabled = player && (player.notif_enabled === undefined ||
        player.notif_enabled === null || !!player.notif_enabled);
      if (!enabled) return;
      const bot = getBot();
      if (bot) bot.sendMessage(playerId, message).catch(() => {});
    } catch {
      // Swallow — DMs are best-effort, never block a transaction
    }
  },
};

module.exports = notifyService;
