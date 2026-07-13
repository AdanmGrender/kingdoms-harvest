const { initTestDb, seedTestData } = require('./setup');
const { GEM_PACKS, packGems, speedupCost } = require('../../shared/shopConfig');

const PID = 606060601;

let db;
let paymentService;
let gemService;
let shopService;

/** Simula el update `successful_payment` que manda Telegram al bot. */
function paymentMsg({ playerId = PID, productId = 'chest', chargeId, stars } = {}) {
  const pack = GEM_PACKS[productId];
  return {
    from: { id: playerId },
    chat: { id: playerId },
    successful_payment: {
      currency: 'XTR',
      total_amount: stars ?? pack.stars,
      invoice_payload: JSON.stringify({ p: playerId, prod: productId, n: 'abc123' }),
      telegram_payment_charge_id: chargeId ?? `charge_${Math.random().toString(36).slice(2)}`,
    },
  };
}

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  paymentService = require('../src/services/paymentService');
  gemService = require('../src/services/gemService');
  shopService = require('../src/services/shopService');
});

beforeEach(async () => {
  await db('star_payments').where('player_id', PID).delete();
  await db('player_gems').where('player_id', PID).delete();
});

// ─── INVARIANTE MADRE: nunca se vende KH (retirable a TON) ────────────────────

describe('INVARIANTE: con dinero real solo se compran GEMAS, nunca KH', () => {
  test('ningún pack del catálogo entrega KH tokens', () => {
    for (const pack of Object.values(GEM_PACKS)) {
      expect(pack.gems).toBeGreaterThan(0);
      // Un pack jamás debe declarar tokens/kh/ton.
      expect(pack.kh).toBeUndefined();
      expect(pack.tokens).toBeUndefined();
      expect(pack.ton).toBeUndefined();
    }
  });

  test('gemService NO expone ninguna función de conversión a KH/TON', () => {
    const forbidden = ['toKH', 'convertToTokens', 'toTokens', 'withdraw', 'exchange', 'toTon'];
    for (const fn of forbidden) expect(gemService[fn]).toBeUndefined();
  });

  test('comprar gemas NO toca el balance de KH del jugador', async () => {
    await db('player_tokens').where('player_id', PID).delete();
    await db('player_tokens').insert({
      player_id: PID, balance: 0, total_earned: 0, total_withdrawn: 0,
      daily_earned_today: 0, daily_reset_at: new Date(Date.now() + 86400000).toISOString(),
    });

    await paymentService.handleSuccessfulPayment(paymentMsg({ productId: 'vault' }));

    const kh = await db('player_tokens').where('player_id', PID).first();
    expect(kh.balance).toBe(0);         // KH intacto
    expect(kh.total_earned).toBe(0);
    const gems = await gemService.getBalance(PID);
    expect(gems.balance).toBe(packGems('vault')); // las gemas sí entraron
  });
});

// ─── Idempotencia del cobro ──────────────────────────────────────────────────

describe('paymentService.handleSuccessfulPayment — idempotencia', () => {
  test('acredita las gemas del catálogo (no las del mensaje)', async () => {
    const res = await paymentService.handleSuccessfulPayment(paymentMsg({ productId: 'chest' }));
    expect(res.credited).toBe(packGems('chest')); // 550 * 1.10 = 605
    expect(res.balance).toBe(packGems('chest'));
  });

  test('el MISMO charge_id no acredita dos veces (replay de Telegram)', async () => {
    const msg = paymentMsg({ productId: 'pouch', chargeId: 'charge_REPLAY_1' });

    const first = await paymentService.handleSuccessfulPayment(msg);
    expect(first.credited).toBe(packGems('pouch'));

    // Telegram reintenta el mismo update
    const second = await paymentService.handleSuccessfulPayment(msg);
    expect(second.duplicate).toBe(true);

    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(packGems('pouch')); // acreditado UNA sola vez

    const rows = await db('star_payments').where('telegram_payment_charge_id', 'charge_REPLAY_1');
    expect(rows.length).toBe(1);
  });

  test('replays CONCURRENTES del mismo charge: solo uno acredita', async () => {
    const msg = paymentMsg({ productId: 'pouch', chargeId: 'charge_RACE_1' });

    const results = await Promise.allSettled([
      paymentService.handleSuccessfulPayment(msg),
      paymentService.handleSuccessfulPayment(msg),
      paymentService.handleSuccessfulPayment(msg),
    ]);
    const credited = results.filter(
      (r) => r.status === 'fulfilled' && r.value.credited > 0,
    ).length;
    expect(credited).toBe(1);

    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(packGems('pouch'));
  });

  test('rechaza moneda distinta de XTR', async () => {
    const msg = paymentMsg();
    msg.successful_payment.currency = 'USD';
    await expect(paymentService.handleSuccessfulPayment(msg)).rejects.toThrow(/moneda/i);
  });

  test('rechaza un producto desconocido', async () => {
    const msg = paymentMsg();
    msg.successful_payment.invoice_payload = JSON.stringify({ prod: 'pack_pirata' });
    await expect(paymentService.handleSuccessfulPayment(msg)).rejects.toThrow(/desconocido/i);
  });

  test('acredita al PAGADOR real (msg.from.id), no al id del payload', async () => {
    const msg = paymentMsg({ productId: 'pouch' });
    // Un atacante intenta que se le acredite a OTRO jugador vía el payload.
    msg.successful_payment.invoice_payload = JSON.stringify({ p: 999999999, prod: 'pouch' });

    await paymentService.handleSuccessfulPayment(msg);

    const payer = await gemService.getBalance(PID);          // msg.from.id
    const victim = await gemService.getBalance(999999999);
    expect(payer.balance).toBe(packGems('pouch'));
    expect(victim.balance).toBe(0);
  });
});

// ─── Gasto de gemas ──────────────────────────────────────────────────────────

describe('gemService.spend — gasto atómico', () => {
  test('no se puede gastar más de lo que hay', async () => {
    await gemService.credit(PID, 50);
    await expect(gemService.spend(PID, 100, 'test')).rejects.toThrow(/suficientes/i);
    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(50); // intacto
  });

  test('gastos concurrentes no permiten saldo negativo', async () => {
    await gemService.credit(PID, 100);
    const results = await Promise.allSettled([
      gemService.spend(PID, 60, 'a'),
      gemService.spend(PID, 60, 'b'),
      gemService.spend(PID, 60, 'c'),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1); // solo uno entra en 100 gemas

    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(40);
    expect(balance).toBeGreaterThanOrEqual(0);
  });
});

// ─── Sumidero: acelerar construcción ─────────────────────────────────────────

describe('shopService.speedupBuilding', () => {
  test('el costo lo calcula el SERVER según el tiempo restante', () => {
    expect(speedupCost(0)).toBe(5);                 // piso
    expect(speedupCost(10 * 60 * 1000)).toBe(10);   // 10 min → 10 gemas
    expect(speedupCost(999 * 60 * 60 * 1000)).toBe(300); // techo
  });

  test('acelera cobrando gemas y termina la construcción', async () => {
    await gemService.credit(PID, 500);
    const [{ id }] = await db('player_buildings').insert({
      player_id: PID, building_id: 'mill', level: 1, position_x: 5, position_y: 5,
      is_building: true,
      build_complete_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }).returning('id');

    const res = await shopService.speedupBuilding(PID, id);
    expect(res.success).toBe(true);
    expect(res.gemsSpent).toBeGreaterThan(0);

    const b = await db('player_buildings').where('id', id).first();
    expect(b.is_building).toBeFalsy(); // ya no está en construcción

    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(500 - res.gemsSpent);
  });

  test('sin gemas suficientes NO se acelera la construcción', async () => {
    await gemService.credit(PID, 1); // muy poco
    const [{ id }] = await db('player_buildings').insert({
      player_id: PID, building_id: 'mill', level: 1, position_x: 6, position_y: 6,
      is_building: true,
      build_complete_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).returning('id');

    await expect(shopService.speedupBuilding(PID, id)).rejects.toThrow(/suficientes/i);

    const b = await db('player_buildings').where('id', id).first();
    expect(b.is_building).toBeTruthy(); // sigue en construcción (sin efecto)
  });
});
