const crypto = require('crypto');
const { initTestDb, seedTestData } = require('./setup');

let db;
let otpService;
const PID = 90909090;

function insertOtp(code, amount = 500, over = {}) {
  return db('withdrawal_otps').insert({
    player_id: PID,
    otp_hash: crypto.createHash('sha256').update(code).digest('hex'),
    amount,
    used: 0,
    attempts: 0,
    expires_at: new Date(Date.now() + 300000).toISOString(),
    created_at: new Date().toISOString(),
    ...over,
  });
}

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  otpService = require('../src/services/otpService');
});

beforeEach(async () => {
  await db('withdrawal_otps').where('player_id', PID).delete();
});

describe('otpService.verifyWithdrawalOTP — single-use atómico', () => {
  test('acepta el código correcto una vez y rechaza el reuso', async () => {
    await insertOtp('123456');
    const row = await db('withdrawal_otps').where('player_id', PID).first();

    await expect(otpService.verifyWithdrawalOTP(PID, row.id, '123456', 500)).resolves.toBe(true);
    // Segundo uso del MISMO código → rechazado por el claim atómico (used=0→1).
    await expect(otpService.verifyWithdrawalOTP(PID, row.id, '123456', 500)).rejects.toThrow(/ya fue usado/i);
  });

  test('uso concurrente de la misma OTP: solo UNO gana (no se salta el single-use)', async () => {
    await insertOtp('654321');
    const row = await db('withdrawal_otps').where('player_id', PID).first();

    const results = await Promise.allSettled([
      otpService.verifyWithdrawalOTP(PID, row.id, '654321', 500),
      otpService.verifyWithdrawalOTP(PID, row.id, '654321', 500),
      otpService.verifyWithdrawalOTP(PID, row.id, '654321', 500),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    expect(ok).toBe(1); // exactamente una verificación consume la OTP
  });

  test('código incorrecto no consume el single-use', async () => {
    await insertOtp('111111');
    const row = await db('withdrawal_otps').where('player_id', PID).first();

    await expect(otpService.verifyWithdrawalOTP(PID, row.id, '000000', 500)).rejects.toThrow(/incorrecto/i);
    // Sigue usable con el código correcto (no se quemó por un intento fallido).
    await expect(otpService.verifyWithdrawalOTP(PID, row.id, '111111', 500)).resolves.toBe(true);
  });
});
