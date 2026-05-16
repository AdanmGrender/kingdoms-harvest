const db = require('../config/database');

// ─── Event catalog ───────────────────────────────────────────────────────────

const EVENT_TYPES = {
  travelers_camp: {
    title: 'Campamento de Viajeros',
    description: 'Un grupo de mercaderes pasó por aquí y dejó provisiones al partir.',
    icon: '🏕️',
    rarity: 'common',
    rewards: [
      { resource_id: 'gold', min: 50, max: 150 },
      { resource_id: 'wood', min: 20, max: 50 },
    ],
    duration: 30,
  },
  wild_harvest: {
    title: 'Cosecha Silvestre',
    description: 'La tierra dio frutos en abundancia sin que nadie los sembrara.',
    icon: '🌾',
    rarity: 'common',
    rewards: [
      { resource_id: 'wheat', min: 30, max: 80 },
      { resource_id: 'carrot', min: 15, max: 40 },
    ],
    duration: 25,
  },
  wandering_merchant: {
    title: 'Mercader Errante',
    description: 'Un comerciante solitario dejó mercancía al costado del camino.',
    icon: '🧳',
    rarity: 'common',
    rewards: [
      { resource_id: 'gold', min: 40, max: 100 },
      { resource_id: 'stone', min: 10, max: 30 },
    ],
    duration: 20,
  },
  forest_gifts: {
    title: 'Dones del Bosque',
    description: 'Los espíritus del bosque dejaron madera cortada para tu reino.',
    icon: '🌲',
    rarity: 'common',
    rewards: [
      { resource_id: 'wood', min: 50, max: 120 },
    ],
    duration: 30,
  },
  ancient_ruins: {
    title: 'Ruinas Antiguas',
    description: 'Explorando las ruinas encontraste objetos de valor enterrados.',
    icon: '🏛️',
    rarity: 'uncommon',
    rewards: [
      { resource_id: 'stone', min: 40, max: 100 },
      { resource_id: 'gold', min: 30, max: 80 },
    ],
    duration: 45,
  },
  abandoned_caravan: {
    title: 'Caravana Abandonada',
    description: 'Una caravana fue dejada atrás. Su carga te espera.',
    icon: '🐪',
    rarity: 'uncommon',
    rewards: [
      { resource_id: 'gold', min: 100, max: 250 },
    ],
    duration: 20,
  },
  iron_vein: {
    title: 'Veta de Hierro',
    description: 'Una veta de hierro quedó expuesta tras un derrumbe reciente.',
    icon: '⛏️',
    rarity: 'uncommon',
    rewards: [
      { resource_id: 'iron', min: 15, max: 40 },
      { resource_id: 'stone', min: 20, max: 50 },
    ],
    duration: 35,
  },
  cursed_chest: {
    title: 'Cofre Maldito',
    description: 'Un cofre oxidado yace abierto. Alguien ya tomó la maldición… y dejó el oro.',
    icon: '📦',
    rarity: 'uncommon',
    rewards: [
      { resource_id: 'gold', min: 80, max: 180 },
      { resource_id: 'iron', min: 10, max: 25 },
    ],
    duration: 25,
  },
  royal_messenger: {
    title: 'Mensajero Real',
    description: 'El mensajero trae un tributo del reino vecino como señal de paz.',
    icon: '📜',
    rarity: 'rare',
    rewards: [
      { resource_id: 'gold', min: 200, max: 400 },
      { resource_id: 'stone', min: 50, max: 100 },
    ],
    duration: 15,
  },
  fallen_meteor: {
    title: 'Meteorito Caído',
    description: 'Un meteorito impactó cerca. Sus restos contienen minerales raros.',
    icon: '☄️',
    rarity: 'rare',
    rewards: [
      { resource_id: 'iron', min: 30, max: 70 },
      { resource_id: 'gold', min: 80, max: 200 },
    ],
    duration: 20,
  },
};

// Rarity draw weights
const RARITY_WEIGHTS = { common: 60, uncommon: 30, rare: 10 };

// Hotspot positions (tile coordinates) spread across the 160×120 map.
// Placed in open areas away from the central building cluster.
const HOTSPOTS = [
  // Northern farmlands
  { x: 52, y: 18 }, { x: 72, y: 14 }, { x: 90, y: 22 },
  // Eastern frontier
  { x: 118, y: 28 }, { x: 138, y: 44 }, { x: 148, y: 62 },
  // Western forest
  { x: 30, y: 28 }, { x: 20, y: 44 },
  // Combat corridor (south-west)
  { x: 16, y: 62 }, { x: 26, y: 80 },
  // Southern lowlands
  { x: 58, y: 92 }, { x: 85, y: 98 }, { x: 112, y: 88 },
  // Central open areas
  { x: 62, y: 68 }, { x: 98, y: 56 }, { x: 108, y: 40 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rollRarity() {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.floor(Math.random() * total);
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    roll -= weight;
    if (roll < 0) return rarity;
  }
  return 'common';
}

function rollEventType() {
  const rarity = rollRarity();
  const pool = Object.entries(EVENT_TYPES).filter(([, c]) => c.rarity === rarity);
  if (pool.length === 0) return Object.entries(EVENT_TYPES)[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

function rollRewards(rewardDefs) {
  return rewardDefs.map((r) => ({
    resource_id: r.resource_id,
    amount: Math.floor(Math.random() * (r.max - r.min + 1)) + r.min,
  }));
}

// Insert a resource row if it doesn't exist, then increment.
async function safeAddResource(playerId, resourceId, amount) {
  const affected = await db('player_resources')
    .where({ player_id: playerId, resource_id: resourceId })
    .increment('amount', amount);
  if (!affected) {
    try {
      await db('player_resources').insert({
        player_id: playerId,
        resource_id: resourceId,
        amount,
        capacity: 1000,
      });
    } catch {
      // Race condition: row appeared between check and insert
      await db('player_resources')
        .where({ player_id: playerId, resource_id: resourceId })
        .increment('amount', amount);
    }
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

const worldEventService = {
  /**
   * Mark expired events as inactive.
   */
  async cleanExpiredEvents() {
    const now = Math.floor(Date.now() / 1000);
    await db('world_events')
      .where('is_active', 1)
      .where('expires_at', '<', now)
      .update({ is_active: 0 });
  },

  /**
   * Generate new events until there are at least TARGET_COUNT active ones.
   * Returns the number of events created.
   */
  async generateEvents() {
    const TARGET_COUNT = 5;
    const now = Math.floor(Date.now() / 1000);

    // Count currently active non-expired events
    const active = await db('world_events')
      .where('is_active', 1)
      .where('expires_at', '>', now);
    const existing = active.length;

    if (existing >= TARGET_COUNT) return 0;

    // Collect occupied hotspot positions
    const occupiedKeys = new Set(
      active.map((e) => `${e.tile_x},${e.tile_y}`)
    );

    const available = HOTSPOTS.filter(
      (h) => !occupiedKeys.has(`${h.x},${h.y}`)
    );

    const toCreate = Math.min(TARGET_COUNT - existing, available.length);
    if (toCreate <= 0) return 0;

    // Shuffle available hotspots
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const createdAt = new Date().toISOString();
    for (let i = 0; i < toCreate; i++) {
      const hotspot = available[i];
      const [typeId, config] = rollEventType();
      const rewards = rollRewards(config.rewards);
      const expiresAt = now + config.duration * 60;

      await db('world_events').insert({
        event_type: typeId,
        title:       config.title,
        description: config.description,
        icon:        config.icon,
        tile_x:      hotspot.x,
        tile_y:      hotspot.y,
        rewards:     JSON.stringify(rewards),
        rarity:      config.rarity,
        expires_at:  expiresAt,
        is_active:   1,
        created_at:  createdAt,
      });
    }

    console.log(`[WorldEvents] Generados ${toCreate} nuevos eventos`);
    return toCreate;
  },

  /**
   * Returns all active, non-expired events with a per-player claim flag.
   */
  async getActiveEvents(playerId) {
    const now = Math.floor(Date.now() / 1000);
    const events = await db('world_events')
      .where('is_active', 1)
      .where('expires_at', '>', now);

    if (events.length === 0) return [];

    const eventIds = events.map((e) => e.id);
    const claims = await db('world_event_claims')
      .where('player_id', playerId)
      .whereIn('event_id', eventIds);
    const claimedSet = new Set(claims.map((c) => c.event_id));

    return events.map((e) => {
      let rewards;
      try { rewards = JSON.parse(e.rewards); } catch { rewards = []; }
      return {
        id:          e.id,
        event_type:  e.event_type,
        title:       e.title,
        description: e.description,
        icon:        e.icon,
        tile_x:      e.tile_x,
        tile_y:      e.tile_y,
        rewards,
        rarity:      e.rarity,
        expires_at:  e.expires_at,
        is_claimed:  claimedSet.has(e.id) ? 1 : 0,
      };
    });
  },

  /**
   * Claim a world event for a player: validate, award resources, record claim.
   */
  async claimEvent(playerId, eventId) {
    const now = Math.floor(Date.now() / 1000);

    const event = await db('world_events')
      .where({ id: eventId, is_active: 1 })
      .where('expires_at', '>', now)
      .first();
    if (!event) throw new Error('El evento no existe o ya expiró');

    const existing = await db('world_event_claims')
      .where({ event_id: eventId, player_id: playerId })
      .first();
    if (existing) throw new Error('Ya reclamaste este evento');

    let rewards;
    try { rewards = JSON.parse(event.rewards); } catch { rewards = []; }

    // Award resources
    for (const { resource_id, amount } of rewards) {
      await safeAddResource(playerId, resource_id, amount);
    }

    // Record claim
    await db('world_event_claims').insert({
      event_id:   eventId,
      player_id:  playerId,
      claimed_at: new Date().toISOString(),
    });

    return {
      success: true,
      rewards,
      message: `¡Reclamaste "${event.title}"! Recursos añadidos a tu reino.`,
    };
  },
};

module.exports = worldEventService;
