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
