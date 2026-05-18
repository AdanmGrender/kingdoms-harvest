const db = require('../config/database');

// ─── Rotation cycle ──────────────────────────────────────────────────────────
// Featured event type cycles every 15 minutes across all players (global schedule).
// Each slot index = Math.floor(Date.now() / (15 * 60 * 1000)) % ROTATION_CYCLE.length
const ROTATION_CYCLE = [
  'abandoned_caravan',
  'ancient_ruins',
  'travelers_camp',
  'iron_vein',
  'fallen_meteor',
  'wild_harvest',
  'royal_messenger',
  'cursed_chest',
  'wandering_merchant',
  'forest_gifts',
];

function getFeaturedEventType() {
  const slotMs = 15 * 60 * 1000;
  const idx = Math.floor(Date.now() / slotMs) % ROTATION_CYCLE.length;
  return ROTATION_CYCLE[idx];
}

const BOT_USERNAME = process.env.BOT_USERNAME || 'kingdomharvestbot';

// Co-op reward multiplier: 1× for solo, +0.3 per additional participant (max 4)
function coopMultiplier(participantCount) {
  return 1 + Math.max(0, participantCount - 1) * 0.3;
}

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
   * The first slot always uses the current rotation-cycle type (featured event).
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
    const featuredTypeId = getFeaturedEventType();
    const hasFeatured = active.some((e) => e.is_featured === 1);

    for (let i = 0; i < toCreate; i++) {
      const hotspot = available[i];
      // First new event becomes the featured rotation event (if none exists yet)
      const isFeatured = i === 0 && !hasFeatured ? 1 : 0;

      let typeId, config;
      if (isFeatured && EVENT_TYPES[featuredTypeId]) {
        typeId = featuredTypeId;
        config = EVENT_TYPES[featuredTypeId];
      } else {
        [typeId, config] = rollEventType();
      }

      const rewards = rollRewards(config.rewards);
      const expiresAt = now + config.duration * 60;

      await db('world_events').insert({
        event_type:  typeId,
        title:       config.title,
        description: config.description,
        icon:        config.icon,
        tile_x:      hotspot.x,
        tile_y:      hotspot.y,
        rewards:     JSON.stringify(rewards),
        rarity:      config.rarity,
        expires_at:  expiresAt,
        is_active:   1,
        is_featured:  isFeatured,
        created_at:  createdAt,
      });
    }

    console.log(`[WorldEvents] Generados ${toCreate} nuevos eventos (featured: ${featuredTypeId})`);
    return toCreate;
  },

  /**
   * Returns all active, non-expired events with per-player claim flag and session info.
   */
  async getActiveEvents(playerId) {
    const now = Math.floor(Date.now() / 1000);
    const events = await db('world_events')
      .where('is_active', 1)
      .where('expires_at', '>', now);

    if (events.length === 0) return [];

    const eventIds = events.map((e) => e.id);

    // Fetch this player's claims and active sessions in parallel
    const [claims, sessions] = await Promise.all([
      db('world_event_claims').where('player_id', playerId).whereIn('event_id', eventIds),
      db('event_sessions').whereIn('event_id', eventIds).where('expires_at', '>', now),
    ]);

    const claimedSet = new Set(claims.map((c) => c.event_id));

    // For each session, check if this player participates
    const sessionIds = sessions.map((s) => s.id);
    let playerSessionMap = {}; // eventId -> sessionId if player is in it
    if (sessionIds.length > 0) {
      const participation = await db('event_session_participants')
        .where('player_id', playerId)
        .whereIn('session_id', sessionIds);
      for (const p of participation) {
        const session = sessions.find((s) => s.id === p.session_id);
        if (session) playerSessionMap[session.event_id] = session.id;
      }
    }

    // Map sessions by event_id for participant counts
    const sessionByEvent = {};
    for (const s of sessions) {
      if (!sessionByEvent[s.event_id] || s.participant_count > sessionByEvent[s.event_id].participant_count) {
        sessionByEvent[s.event_id] = s;
      }
    }

    return events.map((e) => {
      let rewards;
      try { rewards = JSON.parse(e.rewards); } catch { rewards = []; }
      const session = sessionByEvent[e.id];
      return {
        id:               e.id,
        event_type:       e.event_type,
        title:            e.title,
        description:      e.description,
        icon:             e.icon,
        tile_x:           e.tile_x,
        tile_y:           e.tile_y,
        rewards,
        rarity:           e.rarity,
        expires_at:       e.expires_at,
        is_featured:      e.is_featured || 0,
        is_claimed:       claimedSet.has(e.id) ? 1 : 0,
        session_id:       session ? session.id : null,
        session_count:    session ? session.participant_count : 0,
        session_max:      session ? session.max_participants : 4,
        player_in_session: playerSessionMap[e.id] ? 1 : 0,
        featured_type:    getFeaturedEventType(),
      };
    });
  },

  /**
   * Claim a world event for a player.
   * If the player is in a co-op session, rewards are multiplied by the co-op bonus.
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

    // Check if player is part of a co-op session for this event
    let multiplier = 1;
    let participantCount = 1;
    const sessions = await db('event_sessions')
      .where({ event_id: eventId })
      .where('expires_at', '>', now);

    for (const session of sessions) {
      const participation = await db('event_session_participants')
        .where({ session_id: session.id, player_id: playerId })
        .first();
      if (participation) {
        participantCount = session.participant_count;
        multiplier = coopMultiplier(participantCount);
        break;
      }
    }

    // Apply multiplier to rewards
    const finalRewards = rewards.map((r) => ({
      resource_id: r.resource_id,
      amount:      Math.round(r.amount * multiplier),
    }));

    // Award resources
    for (const { resource_id, amount } of finalRewards) {
      await safeAddResource(playerId, resource_id, amount);
    }

    // Record claim
    await db('world_event_claims').insert({
      event_id:   eventId,
      player_id:  playerId,
      claimed_at: new Date().toISOString(),
    });

    const coopMsg = participantCount > 1
      ? ` (×${multiplier.toFixed(1)} bono cooperativo con ${participantCount} aliados)`
      : '';
    return {
      success: true,
      rewards: finalRewards,
      multiplier,
      participant_count: participantCount,
      message: `¡Reclamaste "${event.title}"!${coopMsg} Recursos añadidos a tu reino.`,
    };
  },

  /**
   * Create a co-op session for a world event. Returns session ID and invite link.
   */
  async startCoopSession(playerId, eventId) {
    const now = Math.floor(Date.now() / 1000);

    const event = await db('world_events')
      .where({ id: eventId, is_active: 1 })
      .where('expires_at', '>', now)
      .first();
    if (!event) throw new Error('El evento no existe o ya expiró');

    // Check if player already claimed this event
    const claimed = await db('world_event_claims')
      .where({ event_id: eventId, player_id: playerId })
      .first();
    if (claimed) throw new Error('Ya reclamaste este evento');

    // Check if player already has an open session for this event
    const existingSessions = await db('event_sessions')
      .where({ event_id: eventId, host_player_id: playerId })
      .where('expires_at', '>', now);
    if (existingSessions.length > 0) {
      const s = existingSessions[0];
      return {
        session_id:  s.id,
        invite_link: `https://t.me/${BOT_USERNAME}?start=event_${eventId}_s${s.id}`,
        participant_count: s.participant_count,
        max_participants:  s.max_participants,
        already_open: true,
      };
    }

    const [{ id: sessionId }] = await db('event_sessions').insert({
      event_id:          eventId,
      host_player_id:    playerId,
      participant_count: 1,
      max_participants:  4,
      expires_at:        event.expires_at,
      created_at:        new Date().toISOString(),
    }).returning('id');

    // Add host as first participant
    await db('event_session_participants').insert({
      session_id: sessionId,
      player_id:  playerId,
      joined_at:  new Date().toISOString(),
    });

    return {
      session_id:        sessionId,
      invite_link:       `https://t.me/${BOT_USERNAME}?start=event_${eventId}_s${sessionId}`,
      participant_count: 1,
      max_participants:  4,
      already_open:      false,
    };
  },

  /**
   * Join an existing co-op session.
   */
  async joinCoopSession(playerId, sessionId) {
    const now = Math.floor(Date.now() / 1000);

    const session = await db('event_sessions')
      .where({ id: sessionId })
      .where('expires_at', '>', now)
      .first();
    if (!session) throw new Error('La sesión no existe o ya expiró');

    if (session.participant_count >= session.max_participants) {
      throw new Error('La sesión ya está llena (máximo 4 aliados)');
    }

    // Check if already in session
    const alreadyIn = await db('event_session_participants')
      .where({ session_id: sessionId, player_id: playerId })
      .first();
    if (alreadyIn) {
      return { session_id: sessionId, participant_count: session.participant_count, already_joined: true };
    }

    await db('event_session_participants').insert({
      session_id: sessionId,
      player_id:  playerId,
      joined_at:  new Date().toISOString(),
    });

    await db('event_sessions')
      .where({ id: sessionId })
      .increment('participant_count', 1);

    const newCount = session.participant_count + 1;
    return {
      session_id:        sessionId,
      event_id:          session.event_id,
      participant_count: newCount,
      max_participants:  session.max_participants,
      multiplier:        coopMultiplier(newCount),
      already_joined:    false,
    };
  },

  /**
   * Get session info (for the join-via-deep-link flow).
   */
  async getSession(sessionId) {
    const now = Math.floor(Date.now() / 1000);

    const session = await db('event_sessions')
      .where({ id: sessionId })
      .first();
    if (!session) return null;

    const event = await db('world_events')
      .where({ id: session.event_id })
      .first();

    const participants = await db('event_session_participants')
      .where({ session_id: sessionId });

    let rewards;
    try { rewards = JSON.parse(event?.rewards || '[]'); } catch { rewards = []; }

    return {
      session_id:        session.id,
      event_id:          session.event_id,
      participant_count: session.participant_count,
      max_participants:  session.max_participants,
      expires_at:        session.expires_at,
      is_expired:        session.expires_at <= now,
      multiplier:        coopMultiplier(session.participant_count),
      event: event ? {
        id:          event.id,
        title:       event.title,
        description: event.description,
        icon:        event.icon,
        rarity:      event.rarity,
        rewards,
        expires_at:  event.expires_at,
        is_active:   event.is_active,
      } : null,
      participants: participants.map((p) => ({ player_id: p.player_id, joined_at: p.joined_at })),
    };
  },
};

module.exports = worldEventService;
