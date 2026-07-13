const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { escapeTelegramMarkdown } = require('../utils/sanitize');

let bot = null;

function initBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.log('BOT_TOKEN no configurado');
    return;
  }

  // Set BOT_POLLING=false in .env when another instance (e.g. VPS PM2) already
  // owns getUpdates — avoids the 409 Conflict that kills both pollers. The bot
  // can still send messages via the API; only inbound /commands stop firing.
  const polling = process.env.BOT_POLLING !== 'false';
  bot = new TelegramBot(token, { polling });
  if (!polling) console.log('Bot polling DESACTIVADO (BOT_POLLING=false)');
  const webAppUrl = process.env.WEBAPP_URL || 'https://tu-dominio.com';

  // ─── Pagos con Telegram Stars (INGRESO de dinero real) ───────────────────
  // Esta es la ÚNICA puerta por la que se acreditan gemas: los updates vienen
  // firmados por Telegram, no del cliente. Ver paymentService (idempotencia).
  //
  // ⚠️ Requiere polling (o webhook) activo. Con BOT_POLLING=false estos updates
  //    NO llegan a este proceso y las compras quedarían sin acreditar.
  bot.on('pre_checkout_query', async (query) => {
    // Telegram exige respuesta en < 10s o el cobro se cae.
    try {
      await require('../services/paymentService').handlePreCheckout(query);
    } catch (err) {
      console.error('[Bot] pre_checkout_query error:', err.message);
    }
  });

  bot.on('successful_payment', async (msg) => {
    try {
      const result = await require('../services/paymentService').handleSuccessfulPayment(msg);
      if (result.duplicate) return; // replay de Telegram: ya acreditado
      await bot.sendMessage(
        msg.chat.id,
        `💎 *¡Compra confirmada!*\n\n+${result.credited} Gemas acreditadas.\nSaldo: *${result.balance}* 💎\n\n¡Gracias por sostener el bastión!`,
        { parse_mode: 'Markdown' },
      );
    } catch (err) {
      // El pago YA ocurrió: no perder el evento. Se loguea fuerte para revisión.
      console.error('[Bot] ✗ successful_payment SIN ACREDITAR:', err.message, JSON.stringify(msg.successful_payment || {}));
      try {
        await bot.sendMessage(
          msg.chat.id,
          '⚠️ Recibimos tu pago pero hubo un problema al acreditarlo. Ya quedó registrado: escribinos y lo resolvemos.',
        );
      } catch {}
    }
  });

  // Comando /start (con soporte para referidos: /start ref_123456)
  bot.onText(/\/start\s*(.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const firstName = escapeTelegramMarkdown(msg.from.first_name || 'Aventurero');
    const param = (match[1] || '').trim();

    // Build webapp URL with referral param if present
    let appUrl = webAppUrl;
    if (param.startsWith('ref_')) {
      appUrl = `${webAppUrl}?ref=${param}`;
    }

    const referralMsg = param.startsWith('ref_')
      ? '\n🎁 *¡Fuiste invitado!* Recibirás tokens de bienvenida.\n'
      : '';

    bot.sendMessage(chatId,
      `💀 *¡Bienvenido a Kingdoms Harvest, ${firstName}!*\n\n` +
      `Levantá tu bastión en un mundo en ruinas, cultivá tus vats, comerciá ` +
      `con convoyes y conquistá territorios con tu facción.${referralMsg}\n` +
      `🎖️ Tocá el botón de abajo para tomar el mando:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '⚔️ Jugar Kingdoms Harvest', web_app: { url: appUrl } },
          ]],
        },
      }
    );
  });

  // Comando /help
  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `📖 *Guía de Kingdoms Harvest*\n\n` +
      `🌾 *Cultivo:* Plantá en tus vats y criá bestias para obtener recursos.\n` +
      `🏭 *Bastión:* Construí y mejorá edificios para desbloquear mecánicas.\n` +
      `📋 *Misiones:* Completá pedidos de NPCs para ganar créditos y XP.\n` +
      `🏪 *Comercio:* Comprá y vendé con convoyes a precios variables.\n` +
      `💥 *Guerra:* Entrená tropas, atacá enclaves NPC o a otros jugadores.\n` +
      `🛡️ *Facciones:* Uníte a una facción y conquistá territorios.\n\n` +
      `Usá /play para abrir el juego.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Comando /play
  bot.onText(/\/play/, (msg) => {
    bot.sendMessage(msg.chat.id, '🎮 ¡Abrí tu bastión!', {
      reply_markup: {
        inline_keyboard: [[
          { text: '💀 Abrir Kingdoms Harvest', web_app: { url: webAppUrl } },
        ]],
      },
    });
  });

  // Comando /notificaciones — muestra y gestiona preferencias con teclado inline
  bot.onText(/\/notificaciones/, async (msg) => {
    const chatId = msg.chat.id;
    const playerId = msg.from.id;
    try {
      const notificationService = require('../services/notificationService');
      const prefs = await notificationService.getPrefs(playerId);
      await bot.sendMessage(chatId, notificationService.buildPrefsText(), {
        parse_mode: 'Markdown',
        reply_markup: notificationService.buildPrefsKeyboard(prefs),
      });
    } catch (err) {
      bot.sendMessage(chatId, '❌ Error cargando preferencias. Intentá de nuevo.');
    }
  });

  // Callback para toggle de notificaciones vía botones inline
  bot.on('callback_query', async (query) => {
    if (!query.data?.startsWith('notif_toggle_')) return;
    const type = query.data.replace('notif_toggle_', '');
    const playerId = query.from.id;
    try {
      const notificationService = require('../services/notificationService');
      const newValue = await notificationService.togglePref(playerId, type);
      const typeInfo = notificationService.TYPES[type];
      const prefs = await notificationService.getPrefs(playerId);

      await bot.answerCallbackQuery(query.id, {
        text: `${typeInfo?.icon || ''} ${typeInfo?.label || type}: ${newValue ? '✅ Activado' : '❌ Desactivado'}`,
      });
      // Update the message in-place with new keyboard state
      await bot.editMessageReplyMarkup(
        notificationService.buildPrefsKeyboard(prefs),
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
    } catch {
      bot.answerCallbackQuery(query.id, { text: '❌ Error al actualizar' });
    }
  });

  // Comando /stats
  bot.onText(/\/stats/, async (msg) => {
    const db = require('../config/database');
    const player = await db('players').where('telegram_id', msg.from.id).first();

    if (!player) {
      return bot.sendMessage(msg.chat.id, '❌ No tenés cuenta. Usá /start para comenzar.');
    }

    const resources = await db('player_resources').where('player_id', msg.from.id);
    const troops = await db('player_troops').where('player_id', msg.from.id);
    const buildings = await db('player_buildings').where('player_id', msg.from.id);

    const resourceText = resources
      .filter((r) => r.amount > 0)
      .map((r) => `  ${r.resource_id}: ${r.amount}`)
      .join('\n') || '  (vacío)';

    const troopText = troops
      .filter((t) => t.quantity > 0)
      .map((t) => `  ${t.troop_id}: ${t.quantity}`)
      .join('\n') || '  (sin tropas)';

    bot.sendMessage(msg.chat.id,
      `📊 *Stats de ${escapeTelegramMarkdown(player.display_name)}*\n\n` +
      `👑 Nivel: ${player.level} (${player.xp} XP)\n` +
      `🏰 Edificios: ${buildings.length}\n` +
      `🛡️ Facción: ${player.faction_id || 'Ninguna'}\n\n` +
      `💰 *Recursos:*\n${resourceText}\n\n` +
      `⚔️ *Tropas:*\n${troopText}`,
      { parse_mode: 'Markdown' }
    );
  });

  // Comando /notif — toggle push notifications on/off
  bot.onText(/\/notif(?:\s+(on|off))?/, async (msg, match) => {
    const db = require('../config/database');
    const playerService = require('../services/playerService');
    const player = await db('players').where('telegram_id', msg.from.id).first();
    if (!player) {
      return bot.sendMessage(msg.chat.id, '❌ No tenés cuenta. Usá /start para comenzar.');
    }
    const arg = (match[1] || '').toLowerCase();
    const explicit = arg === 'on' ? true : arg === 'off' ? false : undefined;
    try {
      const { enabled } = await playerService.setNotifEnabled(msg.from.id, explicit);
      bot.sendMessage(msg.chat.id,
        enabled
          ? '🔔 *Notificaciones activadas.* Te avisaré cuando tus cultivos, animales, edificios o tropas estén listos.'
          : '🔕 *Notificaciones desactivadas.* No recibirás más DMs del juego. Volvé a usar /notif para activarlas.',
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      bot.sendMessage(msg.chat.id, '❌ Error: ' + (err.message || 'no se pudo cambiar la preferencia.'));
    }
  });

  console.log('Bot de Telegram configurado');
  return bot;
}

function getBot() {
  return bot;
}

module.exports = { initBot, getBot };
