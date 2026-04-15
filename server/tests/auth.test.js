const crypto = require('crypto');

// Must set BOT_TOKEN before requiring auth middleware (it reads process.env at call time)
const BOT_TOKEN = 'TEST_BOT_TOKEN_123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
process.env.BOT_TOKEN = BOT_TOKEN;

const { telegramAuth } = require('../src/middleware/telegramAuth');

/**
 * Generates valid Telegram initData for testing.
 */
function generateInitData(overrides = {}) {
  const userData = overrides.user || { id: 12345, first_name: 'Test', username: 'testuser' };
  const authDate = overrides.auth_date || Math.floor(Date.now() / 1000);

  const params = new URLSearchParams();
  params.set('user', JSON.stringify(userData));
  params.set('auth_date', String(authDate));

  if (overrides.extraParams) {
    for (const [k, v] of Object.entries(overrides.extraParams)) {
      params.set(k, v);
    }
  }

  // Sort and build data check string
  const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = sortedEntries.map(([k, v]) => `${k}=${v}`).join('\n');

  // Calculate HMAC
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', hash);
  return params.toString();
}

function mockReqRes(initData) {
  const req = {
    headers: initData !== undefined ? { 'x-telegram-init-data': initData } : {},
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Telegram Auth Middleware', () => {
  test('valid initData passes authentication', () => {
    const initData = generateInitData();
    const { req, res, next } = mockReqRes(initData);

    telegramAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.playerId).toBe(12345);
    expect(req.playerData.username).toBe('testuser');
  });

  test('missing initData returns 401', () => {
    const { req, res, next } = mockReqRes(undefined);
    // Remove the header entirely
    req.headers = {};

    telegramAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('missing hash returns 401', () => {
    const params = new URLSearchParams();
    params.set('user', JSON.stringify({ id: 123 }));
    params.set('auth_date', String(Math.floor(Date.now() / 1000)));
    // No hash

    const { req, res, next } = mockReqRes(params.toString());
    telegramAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/hash/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('expired auth_date returns 401', () => {
    const expiredTime = Math.floor(Date.now() / 1000) - 600; // 10 min ago (limit is 5)
    const initData = generateInitData({ auth_date: expiredTime });
    const { req, res, next } = mockReqRes(initData);

    telegramAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/expirado/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('tampered hash returns 401', () => {
    const initData = generateInitData();
    // Tamper with the hash
    const tampered = initData.replace(/hash=[a-f0-9]+/, 'hash=0000000000000000000000000000000000000000000000000000000000000000');
    const { req, res, next } = mockReqRes(tampered);

    telegramAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('missing user data returns 401', () => {
    // Build initData without user field
    const authDate = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams();
    params.set('auth_date', String(authDate));
    params.set('query_id', 'test123');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    params.set('hash', hash);

    const { req, res, next } = mockReqRes(params.toString());
    telegramAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/usuario/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('invalid auth_date returns 401', () => {
    const params = new URLSearchParams();
    params.set('user', JSON.stringify({ id: 123 }));
    params.set('auth_date', 'not_a_number');
    params.set('hash', 'abc123');

    const { req, res, next } = mockReqRes(params.toString());
    telegramAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('auth_date at boundary (exactly 300s ago) still passes', () => {
    const boundaryTime = Math.floor(Date.now() / 1000) - 299; // Just under 5 min
    const initData = generateInitData({ auth_date: boundaryTime });
    const { req, res, next } = mockReqRes(initData);

    telegramAuth(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
