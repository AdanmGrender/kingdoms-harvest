const crypto = require('crypto');
const db = require('../config/database');
const { getBot } = require('../bot/telegramBot');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 3;

function generateOTP() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(OTP_LENGTH, '0');
}

function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

async function createWithdrawalOTP(playerId, amount) {
  const otp = generateOTP();
  const hash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

  // Clean up any existing unused/unexpired OTPs for this player
  await db('withdrawal_otps')
    .where('player_id', playerId)
    .where('used', false)
    .where('expires_at', '>', new Date().toISOString())
    .delete();

  // Insert new OTP row
  const [row] = await db('withdrawal_otps')
    .insert({
      player_id: playerId,
      otp_hash: hash,
      amount,
      expires_at: expiresAt,
    })
    .returning('id');

  const otpId = typeof row === 'object' ? row.id : row;

  // Send OTP via Telegram bot
  const bot = getBot();
  if (!bot) {
    throw new Error('Bot de Telegram no disponible para enviar el código 2FA');
  }

  const message =
    `🔐 *Código de verificación de retiro*\n\n` +
    `Código: \`${otp}\`\n\n` +
    `Has solicitado retirar *${amount} KH Tokens*.\n` +
    `Este código expira en 5 minutos.\n\n` +
    `⚠️ Si no solicitaste esto, ignorá este mensaje.`;

  await bot.sendMessage(playerId, message, { parse_mode: 'Markdown' });

  return {
    otpId,
    expiresAt,
    message: 'Código enviado por Telegram. Ingresá el código para confirmar el retiro.',
  };
}

async function verifyWithdrawalOTP(playerId, otpId, otp, amount) {
  const row = await db('withdrawal_otps')
    .where('id', otpId)
    .where('player_id', playerId)
    .first();

  if (!row) throw new Error('Código de verificación inválido');
  if (row.used) throw new Error('Este código ya fue usado');
  if (row.expires_at < new Date().toISOString()) throw new Error('El código ha expirado. Solicitá uno nuevo.');
  if (row.amount !== amount) throw new Error('El monto no coincide con el código de verificación');
  if (row.attempts >= MAX_ATTEMPTS) throw new Error('Demasiados intentos fallidos. Solicitá un nuevo código.');

  // Increment attempts before checking — prevents timing-based enumeration
  await db('withdrawal_otps').where('id', otpId).increment('attempts', 1);

  const hash = hashOTP(otp);
  if (hash !== row.otp_hash) {
    const remaining = MAX_ATTEMPTS - (row.attempts + 1);
    throw new Error(`Código incorrecto. ${remaining} intento(s) restante(s).`);
  }

  await db('withdrawal_otps').where('id', otpId).update({ used: true });

  return true;
}

module.exports = { createWithdrawalOTP, verifyWithdrawalOTP };
