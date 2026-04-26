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

  bot = new TelegramBot(token, { polling: true });
  const webAppUrl = process.env.WEBAPP_URL || 'https://tu-dominio.com';

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
      `👑 *¡Bienvenido a Kingdoms Harvest, ${firstName}!*\n\n` +
      `Construí tu castillo, cultivá tu granja, comerciá con caravanas y ` +
      `conquistá territorios con tu facción.${referralMsg}\n` +
      `🏰 Tocá el botón de abajo para comenzar tu aventura:`,
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
      `🌾 *Granja:* Plantá cultivos y criaá animales para obtener recursos.\n` +
      `🏰 *Castillo:* Construí y mejorá edificios para desbloquear mecánicas.\n` +
      `📋 *Misiones:* Completá pedidos de NPCs para ganar oro y XP.\n` +
      `🏪 *Comercio:* Comprá y vendé con caravanas a precios variables.\n` +
      `⚔️ *Guerra:* Entrená tropas, atacá aldeas NPC o a otros jugadores.\n` +
      `🛡️ *Facciones:* Uníte a una facción y conquistá territorios.\n\n` +
      `Usá /play para abrir el juego.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Comando /play
  bot.onText(/\/play/, (msg) => {
    bot.sendMessage(msg.chat.id, '🎮 ¡Abrí tu reino!', {
      reply_markup: {
        inline_keyboard: [[
          { text: '👑 Abrir Kingdoms Harvest', web_app: { url: webAppUrl } },
        ]],
      },
    });
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
