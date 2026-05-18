const db = require('../config/database');
const { getBot } = require('../bot/telegramBot');

// Columns and their human-readable labels (used by bot /notificaciones command)
const NOTIFICATION_TYPES = {
  crops:          { icon: '🌾', label: 'Cultivos listos' },
  buildings:      { icon: '🏗️', label: 'Construcciones' },
  troops:         { icon: '⚔️', label: 'Tropas listas' },
  animals:        { icon: '🐄', label: 'Animales listos' },
  withdrawals:    { icon: '💰', label: 'Retiros TON' },
  sieges:         { icon: '🛡️', label: 'Ataques recibidos' },
  events:         { icon: '🌍', label: 'Eventos del mundo' },
  daily_reminder: { icon: '📅', label: 'Recordatorio diario' },
};

// Default values when the player has no preferences record yet
const DEFAULTS = {
  crops: true, buildings: true, troops: true, animals: true,
  withdrawals: true, sieges: true, events: false, daily_reminder: false,
};

const notificationService = {
  TYPES: NOTIFICATION_TYPES,

  /**
   * Get preferences for a player, creating defaults if missing.
   */
  async getPrefs(playerId) {
    let prefs = await db('notification_preferences').where('player_id', playerId).first();
    if (!prefs) {
      await db('notification_preferences').insert({
        player_id: playerId,
        ...DEFAULTS,
        updated_at: new Date().toISOString(),
      }).onConflict('player_id').ignore();
      prefs = { player_id: playerId, ...DEFAULTS };
    }
    return prefs;
  },

  /**
   * Update one or more preference flags.
   */
  async updatePrefs(playerId, updates) {
    await this.getPrefs(playerId); // ensure row exists
    const allowed = Object.keys(NOTIFICATION_TYPES);
    const safe = {};
    for (const key of allowed) {
      if (key in updates) safe[key] = !!updates[key];
    }
    if (Object.keys(safe).length === 0) return;
    await db('notification_preferences')
      .where('player_id', playerId)
      .update({ ...safe, updated_at: new Date().toISOString() });
  },

  /**
   * Toggle a single preference type, returning the new value.
   */
  async togglePref(playerId, type) {
    if (!NOTIFICATION_TYPES[type]) throw new Error('Tipo de notificación inválido');
    const prefs = await this.getPrefs(playerId);
    const newValue = !prefs[type];
    await db('notification_preferences')
      .where('player_id', playerId)
      .update({ [type]: newValue, updated_at: new Date().toISOString() });
    return newValue;
  },

  /**
   * Send a push notification to a player if that type is enabled.
   * Silent no-op when bot is not configured or player opted out.
   */
  async notify(playerId, type, message) {
    try {
      const bot = getBot();
      if (!bot) return;
      const prefs = await this.getPrefs(playerId);
      if (!prefs[type]) return;
      await bot.sendMessage(playerId, message);
    } catch {
      // Never throw — notifications are best-effort
    }
  },

  /**
   * Batch notify multiple players with the same type check.
   * Loads all prefs in a single query for efficiency.
   */
  async notifyBatch(entries) {
    // entries: [{ playerId, type, message }, ...]
    const bot = getBot();
    if (!bot || entries.length === 0) return;

    const playerIds = [...new Set(entries.map((e) => e.playerId))];
    const prefsRows = await db('notification_preferences').whereIn('player_id', playerIds);
    const prefsMap = {};
    for (const p of prefsRows) prefsMap[p.player_id] = p;

    for (const { playerId, type, message } of entries) {
      try {
        const prefs = prefsMap[playerId];
        // Use defaults for players with no record
        const enabled = prefs ? prefs[type] : DEFAULTS[type];
        if (!enabled) continue;
        bot.sendMessage(playerId, message).catch(() => {});
      } catch {
        // ignore per-player errors
      }
    }
  },

  /**
   * Build the inline keyboard markup for the /notificaciones bot command.
   */
  buildPrefsKeyboard(prefs) {
    const rows = Object.entries(NOTIFICATION_TYPES).map(([key, { icon, label }]) => {
      const enabled = prefs[key] ?? DEFAULTS[key];
      return [{
        text: `${icon} ${label}: ${enabled ? '✅' : '❌'}`,
        callback_data: `notif_toggle_${key}`,
      }];
    });
    return { inline_keyboard: rows };
  },

  /**
   * Build the text message for the /notificaciones bot command.
   */
  buildPrefsText() {
    return '🔔 *Notificaciones de Kingdoms Harvest*\n\nConfigurá qué alertas recibir por el bot:';
  },
};

module.exports = notificationService;
