const { initTestDb, seedTestData } = require('./setup');
const { TOKEN_CONFIG } = require('../../shared/tokenConfig');

const TOKEN_PLAYER_ID = 111222333;
const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
const futureReset   = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const TEST_WALLET   = 'EQAbcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ';

let db;
let tokenService;

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  tokenService = require('../src/services/tokenService');

  if (!(await db('players').where('telegram_id', TOKEN_PLAYER_ID).first())) {
    await db('players').insert({
      telegram_id: TOKEN_PLAYER_ID,
      username:     'tokenplayer',
      first_name:   'Token',
      display_name: 'TokenPlayer',
      level:        TOKEN_CONFIG.MIN_LEVEL_FOR_WITHDRAWAL,
      xp:           0,
      created_at:   eightDaysAgo,
    });
  }

  await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).delete();
  await db('player_tokens').insert({
    player_id:          TOKEN_PLAYER_ID,
    balance:            2000,
    total_earned:       2000,
    total_withdrawn:    0,
    daily_earned_today: 0,
    daily_reset_at:     futureReset,
    wallet_address:     TEST_WALLET,
  });
});

afterAll(async () => {
  await db('withdrawal_requests').where('player_id', TOKEN_PLAYER_ID).delete();
  await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).delete();
  await db('players').where('telegram_id', TOKEN_PLAYER_ID).delete();
});

// Reset balance + clear withdrawals before each test so they are independent
beforeEach(async () => {
  await db('withdrawal_requests').where('player_id', TOKEN_PLAYER_ID).delete();
  await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).update({
    balance:         2000,
    total_withdrawn: 0,
    wallet_address:  TEST_WALLET,
  });
  await db('players').where('telegram_id', TOKEN_PLAYER_ID).update({
    level:      TOKEN_CONFIG.MIN_LEVEL_FOR_WITHDRAWAL,
    created_at: eightDaysAgo,
  });
});

// ─── requestWithdrawal — validation gates ────────────────────────────────────

describe('tokenService.requestWithdrawal — validation', () => {
  test('throws when amount is below the minimum', async () => {
    const below = TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS - 1;
    await expect(tokenService.requestWithdrawal(TOKEN_PLAYER_ID, below))
      .rejects.toThrow(/minimo/i);
  });

  test('throws when wallet is not linked', async () => {
    await db('player_tokens')
      .where('player_id', TOKEN_PLAYER_ID)
      .update({ wallet_address: null });
    await expect(tokenService.requestWithdrawal(TOKEN_PLAYER_ID, TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS))
      .rejects.toThrow(/wallet/i);
  });

  test('throws when player level is too low', async () => {
    await db('players')
      .where('telegram_id', TOKEN_PLAYER_ID)
      .update({ level: TOKEN_CONFIG.MIN_LEVEL_FOR_WITHDRAWAL - 1 });
    await expect(tokenService.requestWithdrawal(TOKEN_PLAYER_ID, TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS))
      .rejects.toThrow(/nivel/i);
  });

  test('throws when account is too new', async () => {
    await db('players')
      .where('telegram_id', TOKEN_PLAYER_ID)
      .update({ created_at: new Date().toISOString() });
    await expect(tokenService.requestWithdrawal(TOKEN_PLAYER_ID, TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS))
      .rejects.toThrow(/dias/i);
  });

  test('throws when balance is insufficient', async () => {
    await db('player_tokens')
      .where('player_id', TOKEN_PLAYER_ID)
      .update({ balance: TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS - 1 });
    await expect(tokenService.requestWithdrawal(TOKEN_PLAYER_ID, TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS))
      .rejects.toThrow(/insuficiente/i);
  });

  test('throws when cooldown is still active', async () => {
    await tokenService.requestWithdrawal(TOKEN_PLAYER_ID, TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS);
    await expect(tokenService.requestWithdrawal(TOKEN_PLAYER_ID, TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS))
      .rejects.toThrow(/esperar/i);
  });
});

// ─── requestWithdrawal — success path ────────────────────────────────────────

describe('tokenService.requestWithdrawal — success', () => {
  test('deducts balance, increments total_withdrawn, creates pending request', async () => {
    const amount = TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS;
    const result = await tokenService.requestWithdrawal(TOKEN_PLAYER_ID, amount);

    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();
    expect(result.amount).toBe(amount);

    const tokens = await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first();
    expect(tokens.balance).toBe(2000 - amount);
    expect(tokens.total_withdrawn).toBe(amount);

    const req = await db('withdrawal_requests').where('id', result.requestId).first();
    expect(req.status).toBe('pending');
    expect(req.player_id).toBe(TOKEN_PLAYER_ID);
  });

  test('fee and ton_amount are computed correctly', async () => {
    const amount = 1000;
    const result = await tokenService.requestWithdrawal(TOKEN_PLAYER_ID, amount);

    const expectedFee = Math.floor(amount * TOKEN_CONFIG.WITHDRAWAL_FEE_RATE);
    const expectedNet = amount - expectedFee;
    const expectedTon = (expectedNet * TOKEN_CONFIG.TOKEN_TO_TON_RATE).toFixed(6);

    expect(result.fee).toBe(expectedFee);
    expect(result.tonAmount).toBe(expectedTon);
  });
});

// ─── Race condition: atomic deduction (Fix 3) ─────────────────────────────────

describe('tokenService.requestWithdrawal — race condition fix', () => {
  test('second request fails after first depletes balance (decrementIfEnough)', async () => {
    const amount = TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS;

    // Give exactly the minimum — only one withdrawal should succeed
    await db('player_tokens')
      .where('player_id', TOKEN_PLAYER_ID)
      .update({ balance: amount });

    // First request: succeeds, balance → 0
    const first = await tokenService.requestWithdrawal(TOKEN_PLAYER_ID, amount);
    expect(first.success).toBe(true);

    const tokens = await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first();
    expect(tokens.balance).toBe(0);

    // Simulate a concurrent request that bypassed the cooldown check
    // (cleared here to reproduce the "concurrent bypass" scenario)
    await db('withdrawal_requests').where('player_id', TOKEN_PLAYER_ID).delete();

    // Second request must fail atomically — decrementIfEnough returns 0 rows
    await expect(tokenService.requestWithdrawal(TOKEN_PLAYER_ID, amount))
      .rejects.toThrow(/insuficiente/i);

    // Balance remains 0 — no double-spend
    const tokensAfter = await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first();
    expect(tokensAfter.balance).toBe(0);
  });

  test('balance stays consistent across multiple valid withdrawals (cooldown respected)', async () => {
    const amount = TOKEN_CONFIG.WITHDRAWAL_MIN_TOKENS;
    await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).update({ balance: amount * 3 });

    // First withdrawal
    await tokenService.requestWithdrawal(TOKEN_PLAYER_ID, amount);

    // Cooldown is active; trying again immediately must fail
    await expect(tokenService.requestWithdrawal(TOKEN_PLAYER_ID, amount))
      .rejects.toThrow(/esperar/i);

    // Only one withdrawal was created
    const requests = await db('withdrawal_requests').where('player_id', TOKEN_PLAYER_ID);
    expect(requests.length).toBe(1);

    const tokens = await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first();
    expect(tokens.balance).toBe(amount * 3 - amount);
  });
});

// ─── processPendingWithdrawals ────────────────────────────────────────────────

describe('tokenService.processPendingWithdrawals', () => {
  test('does not process a request already in processing status (atomic claim fix)', async () => {
    // Insert a request stuck in 'processing' — simulates another process claiming it
    await db('withdrawal_requests').insert({
      player_id:      TOKEN_PLAYER_ID,
      amount:         500,
      ton_amount:     '0.047500',
      wallet_address: TEST_WALLET,
      status:         'processing',
      created_at:     new Date().toISOString(),
    });

    const balanceBefore = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;

    await tokenService.processPendingWithdrawals();

    const balanceAfter = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;
    // No refund, no double-process — balance unchanged
    expect(balanceAfter).toBe(balanceBefore);

    // Request still in 'processing' (not moved to 'completed' or 'failed' by accident)
    const req = await db('withdrawal_requests')
      .where({ player_id: TOKEN_PLAYER_ID, status: 'processing' })
      .first();
    expect(req).toBeDefined();
  });

  test('refunds balance atomically when TON send fails (no mnemonic in test env)', async () => {
    await db('withdrawal_requests').insert({
      player_id:      TOKEN_PLAYER_ID,
      amount:         500,
      ton_amount:     '0.047500',
      wallet_address: TEST_WALLET,
      status:         'pending',
      created_at:     new Date().toISOString(),
    });

    const balanceBefore = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;

    // sendTON will throw — TON_HOT_WALLET_MNEMONIC is undefined in test env
    await tokenService.processPendingWithdrawals();

    const req = await db('withdrawal_requests')
      .where({ player_id: TOKEN_PLAYER_ID })
      .first();
    expect(req.status).toBe('failed');

    const balanceAfter = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;
    // Refund: balance restored
    expect(balanceAfter).toBe(balanceBefore + 500);
  });
});

// ─── sendTON validation ───────────────────────────────────────────────────────

describe('tokenService — withdrawal payout safety', () => {
  beforeEach(async () => {
    await db('withdrawal_requests').where('player_id', TOKEN_PLAYER_ID).delete();
    await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).update({ balance: 2000, total_withdrawn: 0 });
    delete process.env.WITHDRAWALS_ENABLED;
    delete process.env.TON_HOT_WALLET_MNEMONIC;
  });

  test('kill-switch: WITHDRAWALS_ENABLED=false deja el pending intacto', async () => {
    await db('withdrawal_requests').insert({
      player_id: TOKEN_PLAYER_ID, amount: 500, ton_amount: '0.047500',
      wallet_address: TEST_WALLET, status: 'pending', created_at: new Date().toISOString(),
    });
    process.env.WITHDRAWALS_ENABLED = 'false';
    await tokenService.processPendingWithdrawals();
    const req = await db('withdrawal_requests').where('player_id', TOKEN_PLAYER_ID).first();
    expect(req.status).toBe('pending');
  });

  test('tope diario: difiere el pending si excede MAX_DAILY_TON_PAYOUT', async () => {
    await db('withdrawal_requests').insert({
      player_id: TOKEN_PLAYER_ID, amount: 999999, ton_amount: String(TOKEN_CONFIG.MAX_DAILY_TON_PAYOUT),
      wallet_address: TEST_WALLET, status: 'completed',
      created_at: new Date().toISOString(), processed_at: new Date().toISOString(),
    });
    await db('withdrawal_requests').insert({
      player_id: TOKEN_PLAYER_ID, amount: 500, ton_amount: '0.047500',
      wallet_address: TEST_WALLET, status: 'pending', created_at: new Date().toISOString(),
    });
    const balBefore = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;
    await tokenService.processPendingWithdrawals();
    const req = await db('withdrawal_requests').where({ player_id: TOKEN_PLAYER_ID, status: 'pending' }).first();
    expect(req).toBeDefined(); // sigue pending (diferido, no fallado)
    const balAfter = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;
    expect(balAfter).toBe(balBefore);
  });

  test('needs_review cuenta para el tope diario (M3)', async () => {
    await db('withdrawal_requests').insert({
      player_id: TOKEN_PLAYER_ID, amount: 999999, ton_amount: String(TOKEN_CONFIG.MAX_DAILY_TON_PAYOUT),
      wallet_address: TEST_WALLET, status: 'needs_review',
      created_at: new Date().toISOString(), processed_at: new Date().toISOString(),
    });
    await db('withdrawal_requests').insert({
      player_id: TOKEN_PLAYER_ID, amount: 500, ton_amount: '0.047500',
      wallet_address: TEST_WALLET, status: 'pending', created_at: new Date().toISOString(),
    });
    await tokenService.processPendingWithdrawals();
    const req = await db('withdrawal_requests').where({ player_id: TOKEN_PLAYER_ID, status: 'pending' }).first();
    expect(req).toBeDefined(); // diferido: el needs_review ya consumió el tope
  });

  test('processing colgado → needs_review y SIN reintegro', async () => {
    const old = new Date(Date.now() - (TOKEN_CONFIG.WITHDRAWAL_PROCESSING_STALE_MIN + 5) * 60 * 1000).toISOString();
    await db('withdrawal_requests').insert({
      player_id: TOKEN_PLAYER_ID, amount: 500, ton_amount: '0.047500',
      wallet_address: TEST_WALLET, status: 'processing', seqno: 7,
      created_at: old, claimed_at: old,
    });
    const balBefore = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;
    await tokenService.processPendingWithdrawals();
    const req = await db('withdrawal_requests').where('player_id', TOKEN_PLAYER_ID).first();
    expect(req.status).toBe('needs_review');
    const balAfter = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;
    expect(balAfter).toBe(balBefore); // el TON pudo salir → nunca reintegrar
  });

  test('fallo pre-envío (sin mnemonic) reintegra y marca failed', async () => {
    await db('withdrawal_requests').insert({
      player_id: TOKEN_PLAYER_ID, amount: 500, ton_amount: '0.047500',
      wallet_address: TEST_WALLET, status: 'pending', created_at: new Date().toISOString(),
    });
    const balBefore = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;
    await tokenService.processPendingWithdrawals();
    const req = await db('withdrawal_requests').where('player_id', TOKEN_PLAYER_ID).first();
    expect(req.status).toBe('failed');
    const balAfter = (await db('player_tokens').where('player_id', TOKEN_PLAYER_ID).first()).balance;
    expect(balAfter).toBe(balBefore + 500);
  });
});

describe('tokenService.sendTON — input validation', () => {
  test('throws on invalid TON address (bad checksum)', async () => {
    await expect(
      tokenService.sendTON('EQAbcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ', '0.05')
    ).rejects.toThrow(/inválid|Invalid|checksum/i);
  });

  test('throws on dust amount below 0.01 TON', async () => {
    // Valid address but amount too small — guard before any network call
    await expect(
      tokenService.sendTON('EQCVMAPI3VhY8ZRh9wYKWWpE_jCGcQFYCXTRBetyrmfPZ5cV', '0.001')
    ).rejects.toThrow(/mínimo|minimum|pequeño/i);
  });

  test('throws when hot wallet mnemonic is not configured', async () => {
    const prev = process.env.TON_HOT_WALLET_MNEMONIC;
    delete process.env.TON_HOT_WALLET_MNEMONIC;
    await expect(
      tokenService.sendTON('EQCVMAPI3VhY8ZRh9wYKWWpE_jCGcQFYCXTRBetyrmfPZ5cV', '0.05')
    ).rejects.toThrow(/wallet.*config|mnemonic/i);
    if (prev !== undefined) process.env.TON_HOT_WALLET_MNEMONIC = prev;
  });
});

// ─── linkWallet validation ────────────────────────────────────────────────────

describe('tokenService.linkWallet — address validation', () => {
  test('accepts a valid basechain TON address (checksum OK, workchain 0)', async () => {
    const result = await tokenService.linkWallet(
      TOKEN_PLAYER_ID,
      'EQCVMAPI3VhY8ZRh9wYKWWpE_jCGcQFYCXTRBetyrmfPZ5cV'
    );
    expect(result.success).toBe(true);
  });

  test('rejects a bad-checksum address (L4: real validation, not just format)', async () => {
    await expect(
      tokenService.linkWallet(TOKEN_PLAYER_ID, 'EQAbcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ')
    ).rejects.toThrow(/inválid/i);
  });

  test('rejects an address with wrong prefix', async () => {
    await expect(
      tokenService.linkWallet(TOKEN_PLAYER_ID, '0:abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ01')
    ).rejects.toThrow(/inválid/i);
  });

  test('rejects an address that is too short', async () => {
    await expect(
      tokenService.linkWallet(TOKEN_PLAYER_ID, 'EQshort')
    ).rejects.toThrow(/inválid/i);
  });
});

// ─── payReferralCommission — cap enforcement ──────────────────────────────────

const REFERRAL_INVITER_ID = 777888001;
const REFERRAL_REFEREE_ID = 777888002;

async function seedReferralPair(db, { totalCommission = 0, commissionToday = 0 } = {}) {
  for (const [id, name] of [[REFERRAL_INVITER_ID, 'inviter'], [REFERRAL_REFEREE_ID, 'referee']]) {
    if (!(await db('players').where('telegram_id', id).first())) {
      await db('players').insert({
        telegram_id:  id,
        username:     name,
        first_name:   name,
        display_name: name,
        level:        TOKEN_CONFIG.REFERRAL_MIN_LEVEL_FOR_COMMISSION,
        xp:           0,
        created_at:   new Date().toISOString(),
      });
    }
  }

  await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).delete();
  const nextReset = new Date();
  nextReset.setUTCHours(24, 0, 0, 0);
  await db('player_tokens').insert({
    player_id:          REFERRAL_INVITER_ID,
    balance:            0,
    total_earned:       0,
    total_withdrawn:    0,
    daily_earned_today: 0,
    daily_reset_at:     nextReset.toISOString(),
    commission_today:   commissionToday,
    commission_reset_at: nextReset.toISOString(),
  });

  await db('referrals').where({ referee_id: REFERRAL_REFEREE_ID }).delete();
  await db('referrals').insert({
    referee_id:       REFERRAL_REFEREE_ID,
    inviter_id:       REFERRAL_INVITER_ID,
    total_commission: totalCommission,
    created_at:       new Date().toISOString(),
  });
}

describe('tokenService.payReferralCommission — per-referee lifetime cap', () => {
  afterEach(async () => {
    await db('referrals').where({ referee_id: REFERRAL_REFEREE_ID }).delete();
    await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).delete();
    await db('players').whereIn('telegram_id', [REFERRAL_INVITER_ID, REFERRAL_REFEREE_ID]).delete();
  });

  test('pays commission normally when lifetime total is zero', async () => {
    await seedReferralPair(db);
    await tokenService.payReferralCommission(REFERRAL_REFEREE_ID, 100);
    const tokens = await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).first();
    expect(tokens.balance).toBe(5); // 5% of 100
  });

  test('pays only remaining when lifetime total is near cap', async () => {
    await seedReferralPair(db, { totalCommission: TOKEN_CONFIG.REFERRAL_COMMISSION_CAP_PER_REFEREE - 3 });
    // Commission would be 5% of 200 = 10, but only 3 remain under cap
    await tokenService.payReferralCommission(REFERRAL_REFEREE_ID, 200);
    const tokens = await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).first();
    expect(tokens.balance).toBe(3);
  });

  test('pays nothing when lifetime cap is fully exhausted', async () => {
    await seedReferralPair(db, { totalCommission: TOKEN_CONFIG.REFERRAL_COMMISSION_CAP_PER_REFEREE });
    await tokenService.payReferralCommission(REFERRAL_REFEREE_ID, 100);
    const tokens = await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).first();
    expect(tokens.balance).toBe(0);
  });

  test('increments referral total_commission on each valid payment', async () => {
    await seedReferralPair(db);
    await tokenService.payReferralCommission(REFERRAL_REFEREE_ID, 100);
    const referral = await db('referrals').where({ referee_id: REFERRAL_REFEREE_ID }).first();
    expect(referral.total_commission).toBe(5);
  });

  test('does not pay commission when referee is below required level', async () => {
    await seedReferralPair(db);
    await db('players')
      .where('telegram_id', REFERRAL_REFEREE_ID)
      .update({ level: TOKEN_CONFIG.REFERRAL_MIN_LEVEL_FOR_COMMISSION - 1 });
    await tokenService.payReferralCommission(REFERRAL_REFEREE_ID, 100);
    const tokens = await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).first();
    expect(tokens.balance).toBe(0);
  });
});

describe('tokenService.payReferralCommission — daily commission cap', () => {
  afterEach(async () => {
    await db('referrals').where({ referee_id: REFERRAL_REFEREE_ID }).delete();
    await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).delete();
    await db('players').whereIn('telegram_id', [REFERRAL_INVITER_ID, REFERRAL_REFEREE_ID]).delete();
  });

  test('pays commission when daily total is zero', async () => {
    await seedReferralPair(db, { commissionToday: 0 });
    await tokenService.payReferralCommission(REFERRAL_REFEREE_ID, 100);
    const tokens = await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).first();
    expect(tokens.balance).toBe(5);
    expect(tokens.commission_today).toBe(5);
  });

  test('pays only remaining when daily total is near cap', async () => {
    const nearCap = TOKEN_CONFIG.REFERRAL_DAILY_COMMISSION_CAP - 2;
    await seedReferralPair(db, { commissionToday: nearCap });
    // Commission would be 5% of 200 = 10, but only 2 remain under daily cap
    await tokenService.payReferralCommission(REFERRAL_REFEREE_ID, 200);
    const tokens = await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).first();
    expect(tokens.balance).toBe(2);
    expect(tokens.commission_today).toBe(TOKEN_CONFIG.REFERRAL_DAILY_COMMISSION_CAP);
  });

  test('pays nothing when daily cap is fully exhausted', async () => {
    await seedReferralPair(db, { commissionToday: TOKEN_CONFIG.REFERRAL_DAILY_COMMISSION_CAP });
    await tokenService.payReferralCommission(REFERRAL_REFEREE_ID, 100);
    const tokens = await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).first();
    expect(tokens.balance).toBe(0);
  });

  test('resets daily commission after UTC midnight passes', async () => {
    await seedReferralPair(db);
    // Force commission_reset_at to be in the past to simulate midnight rollover
    await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).update({
      commission_today:    TOKEN_CONFIG.REFERRAL_DAILY_COMMISSION_CAP,
      commission_reset_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
    });
    await tokenService.payReferralCommission(REFERRAL_REFEREE_ID, 100);
    const tokens = await db('player_tokens').where('player_id', REFERRAL_INVITER_ID).first();
    // After reset, commission_today was 0 → now 5
    expect(tokens.balance).toBe(5);
    expect(tokens.commission_today).toBe(5);
  });
});
