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

  // El control REAL de la invariante no es un banner en un comentario: es que
  // BURN_RATES sea un allowlist y 'gems' no esté en él. Eso es lo que se testea.
  test('las gemas NO se pueden quemar por KH (no están en el allowlist BURN_RATES)', async () => {
    const { TOKEN_CONFIG } = require('../../shared/tokenConfig');
    expect(TOKEN_CONFIG.BURN_RATES.gems).toBeUndefined();

    const tokenService = require('../src/services/tokenService');
    await expect(tokenService.burnResourcesForTokens(PID, 'gems', 1000))
      .rejects.toThrow(/no se puede quemar/i);
  });

  test('comprar gemas NO crea una fila "gems" en player_resources (ruta de quema)', async () => {
    await paymentService.handleSuccessfulPayment(paymentMsg({ productId: 'relic' }));

    const asResource = await db('player_resources')
      .where({ player_id: PID, resource_id: 'gems' }).first();
    expect(asResource).toBeUndefined(); // las gemas viven SOLO en player_gems
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

  // A1: un pago que no se puede acreditar NO se pierde en silencio — queda
  // registrado como needs_review para poder reembolsar/reconciliar.
  test('producto desconocido → needs_review REGISTRADO, sin acreditar (A1)', async () => {
    const msg = paymentMsg({ chargeId: 'charge_UNKNOWN_1' });
    msg.successful_payment.invoice_payload = JSON.stringify({ prod: 'pack_pirata' });

    const res = await paymentService.handleSuccessfulPayment(msg);
    expect(res.needsReview).toBe(true);

    // El pago QUEDÓ registrado (si no, el jugador pagó y no hay contra qué reclamar)
    const row = await db('star_payments')
      .where('telegram_payment_charge_id', 'charge_UNKNOWN_1').first();
    expect(row).toBeDefined();
    expect(row.status).toBe('needs_review');
    expect(row.gems_credited).toBe(0);

    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(0); // no se acreditó nada
  });

  // M2: el monto que no coincide con el catálogo NO se acredita (última línea
  // de defensa detrás de pre_checkout).
  test('monto distinto al catálogo → needs_review, NO acredita (M2)', async () => {
    const msg = paymentMsg({ productId: 'relic', chargeId: 'charge_MISMATCH_1', stars: 1 });

    const res = await paymentService.handleSuccessfulPayment(msg);
    expect(res.needsReview).toBe(true);

    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(0); // pagó 1⭐, NO se lleva 3380 gemas

    const row = await db('star_payments')
      .where('telegram_payment_charge_id', 'charge_MISMATCH_1').first();
    expect(row.status).toBe('needs_review');
  });

  test('moneda distinta de XTR → needs_review, NO acredita', async () => {
    const msg = paymentMsg({ chargeId: 'charge_CURRENCY_1' });
    msg.successful_payment.currency = 'USD';

    const res = await paymentService.handleSuccessfulPayment(msg);
    expect(res.needsReview).toBe(true);
    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(0);
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

// ─── Reembolsos (A3) ─────────────────────────────────────────────────────────

/** Simula el `message` con refunded_payment que manda Telegram al reembolsar. */
function refundMsg(chargeId, playerId = PID) {
  return {
    from: { id: playerId },
    chat: { id: playerId },
    refunded_payment: { currency: 'XTR', telegram_payment_charge_id: chargeId },
  };
}

describe('paymentService.handleRefund — abuso comprar/gastar/reembolsar', () => {
  test('el reembolso DEBITA las gemas otorgadas', async () => {
    await paymentService.handleSuccessfulPayment(
      paymentMsg({ productId: 'pouch', chargeId: 'charge_REF_1' }),
    );
    expect((await gemService.getBalance(PID)).balance).toBe(packGems('pouch'));

    const r = await paymentService.handleRefund(refundMsg('charge_REF_1'));
    expect(r.refunded).toBe(true);
    expect(r.clawedBack).toBe(packGems('pouch'));

    expect((await gemService.getBalance(PID)).balance).toBe(0);
    const row = await db('star_payments')
      .where('telegram_payment_charge_id', 'charge_REF_1').first();
    expect(row.status).toBe('refunded');
  });

  test('comprar → GASTAR todo → reembolsar deja al jugador EN DEUDA (no puede robar)', async () => {
    await paymentService.handleSuccessfulPayment(
      paymentMsg({ productId: 'pouch', chargeId: 'charge_ABUSE_1' }),
    );
    const gems = packGems('pouch');

    // El atacante gasta TODO antes de pedir el reembolso.
    await gemService.spend(PID, gems, 'abuso');
    expect((await gemService.getBalance(PID)).balance).toBe(0);

    // Telegram le devuelve las Stars...
    await paymentService.handleRefund(refundMsg('charge_ABUSE_1'));

    // ...pero queda con saldo NEGATIVO = deuda. No puede volver a gastar.
    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(-gems);
    await expect(gemService.spend(PID, 1, 'post-refund')).rejects.toThrow(/suficientes/i);
  });

  test('reembolsos CONCURRENTES del mismo charge: solo UNO debita (Finding 1)', async () => {
    await paymentService.handleSuccessfulPayment(
      paymentMsg({ productId: 'chest', chargeId: 'charge_REF_RACE' }),
    );
    const gems = packGems('chest');
    expect((await gemService.getBalance(PID)).balance).toBe(gems);

    const results = await Promise.allSettled([
      paymentService.handleRefund(refundMsg('charge_REF_RACE')),
      paymentService.handleRefund(refundMsg('charge_REF_RACE')),
      paymentService.handleRefund(refundMsg('charge_REF_RACE')),
    ]);
    const debited = results.filter((r) => r.status === 'fulfilled' && r.value.refunded).length;
    expect(debited).toBe(1); // el flip atómico deja pasar solo a uno

    // Debitado UNA sola vez (gems − gems = 0), NO −2·gems por doble clawback.
    expect((await gemService.getBalance(PID)).balance).toBe(0);
  });

  test('el reembolso es idempotente (no debita dos veces)', async () => {
    await paymentService.handleSuccessfulPayment(
      paymentMsg({ productId: 'pouch', chargeId: 'charge_REF_IDEM' }),
    );
    await paymentService.handleRefund(refundMsg('charge_REF_IDEM'));
    const after1 = (await gemService.getBalance(PID)).balance;

    const second = await paymentService.handleRefund(refundMsg('charge_REF_IDEM'));
    expect(second.duplicate).toBe(true);

    expect((await gemService.getBalance(PID)).balance).toBe(after1); // sin doble débito
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

// ─── Sumidero: invocación de héroe con gemas ─────────────────────────────────

describe('heroService.summonHero con gemas', () => {
  test('cobra el precio plano en gemas y entrega el héroe', async () => {
    const { GEM_SINKS } = require('../../shared/shopConfig');
    const heroService = require('../src/services/heroService');
    await gemService.credit(PID, 1000);

    const res = await heroService.summonHero(PID, false, true); // payWithGems
    expect(res.success).toBe(true);
    expect(res.hero).toBeDefined();

    const { balance } = await gemService.getBalance(PID);
    expect(balance).toBe(1000 - GEM_SINKS.hero_summon.gems);
  });

  test('sin gemas suficientes NO invoca (y no regala héroe)', async () => {
    const heroService = require('../src/services/heroService');
    await gemService.credit(PID, 10); // menos que el precio

    const before = (await db('player_heroes').where('player_id', PID)) || [];
    await expect(heroService.summonHero(PID, false, true)).rejects.toThrow(/suficientes/i);
    const after = (await db('player_heroes').where('player_id', PID)) || [];
    expect(after.length).toBe(before.length); // ningún héroe nuevo
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
