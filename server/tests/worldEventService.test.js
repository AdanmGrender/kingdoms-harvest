/**
 * Tests for worldEventService — event rotation, claim rewards, co-op sessions.
 *
 * Uses dedicated player IDs to stay isolated from other test suites.
 * All world_events/sessions/claims created here are cleaned up in afterAll.
 */
const { initTestDb, seedTestData } = require('./setup');

const WE_HOST   = 555444333;   // hosts co-op sessions
const WE_JOINER = 555444334;   // joins sessions
const WE_THIRD  = 555444335;   // third participant

const FUTURE = Math.floor(Date.now() / 1000) + 3600;   // +1 hour
const PAST   = Math.floor(Date.now() / 1000) - 3600;   // -1 hour

let db;
let svc;

// ─── Seed helper ─────────────────────────────────────────────────────────────

async function seedPlayer(id) {
  const existing = await db('players').where('telegram_id', id).first();
  if (existing) return;
  await db('players').insert({
    telegram_id:  id,
    username:     `we_player_${id}`,
    first_name:   'WE',
    display_name: `WEPlayer${id}`,
    level:        1,
    xp:           0,
  });
}

async function seedEvent({ isActive = 1, expiresAt = FUTURE, isFeatured = 0, rewards } = {}) {
  const defaultRewards = JSON.stringify([{ resource_id: 'gold', amount: 100 }]);
  const [{ id }] = await db('world_events').insert({
    event_type:  'travelers_camp',
    title:       'Test Event',
    description: 'desc',
    icon:        '🏕️',
    tile_x:      10,
    tile_y:      10,
    rewards:     rewards ?? defaultRewards,
    rarity:      'common',
    expires_at:  expiresAt,
    is_active:   isActive,
    is_featured:  isFeatured,
    created_at:  new Date().toISOString(),
  }).returning('id');
  return id;
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  db  = await initTestDb();
  await seedTestData();
  svc = require('../src/services/worldEventService');

  for (const id of [WE_HOST, WE_JOINER, WE_THIRD]) {
    await seedPlayer(id);
  }
});

afterAll(async () => {
  await db('event_session_participants').whereIn('player_id', [WE_HOST, WE_JOINER, WE_THIRD]).delete();
  await db('event_sessions').whereIn('host_player_id', [WE_HOST, WE_JOINER, WE_THIRD]).delete();
  await db('world_event_claims').whereIn('player_id', [WE_HOST, WE_JOINER, WE_THIRD]).delete();
  await db('world_events').where('tile_x', 10).where('tile_y', 10).delete();
  for (const id of [WE_HOST, WE_JOINER, WE_THIRD]) {
    await db('player_resources').where('player_id', id).delete();
    await db('players').where('telegram_id', id).delete();
  }
});

beforeEach(async () => {
  // Each test starts with a clean slate for this suite's events/sessions/claims
  await db('event_session_participants').whereIn('player_id', [WE_HOST, WE_JOINER, WE_THIRD]).delete();
  await db('event_sessions').whereIn('host_player_id', [WE_HOST, WE_JOINER, WE_THIRD]).delete();
  await db('world_event_claims').whereIn('player_id', [WE_HOST, WE_JOINER, WE_THIRD]).delete();
  await db('world_events').where('tile_x', 10).where('tile_y', 10).delete();
  await db('player_resources').where('player_id', WE_HOST).delete();
  await db('player_resources').where('player_id', WE_JOINER).delete();
});

// ─── cleanExpiredEvents ───────────────────────────────────────────────────────

describe('worldEventService.cleanExpiredEvents', () => {
  test('marks expired active events as inactive', async () => {
    const expiredId = await seedEvent({ isActive: 1, expiresAt: PAST });
    await svc.cleanExpiredEvents();
    const row = await db('world_events').where('id', expiredId).first();
    expect(row.is_active).toBe(0);
  });

  test('leaves non-expired active events untouched', async () => {
    const activeId = await seedEvent({ isActive: 1, expiresAt: FUTURE });
    await svc.cleanExpiredEvents();
    const row = await db('world_events').where('id', activeId).first();
    expect(row.is_active).toBe(1);
  });

  test('does not re-activate already-inactive events', async () => {
    const inactiveId = await seedEvent({ isActive: 0, expiresAt: PAST });
    await svc.cleanExpiredEvents();
    const row = await db('world_events').where('id', inactiveId).first();
    expect(row.is_active).toBe(0);
  });
});

// ─── generateEvents ───────────────────────────────────────────────────────────

describe('worldEventService.generateEvents', () => {
  beforeEach(async () => {
    // Remove ALL active events so generateEvents starts from zero
    await db('world_events').where('is_active', 1).update({ is_active: 0 });
  });

  test('creates events up to TARGET_COUNT (5) when none exist', async () => {
    const created = await svc.generateEvents();
    expect(created).toBe(5);
    const active = await db('world_events')
      .where('is_active', 1)
      .where('expires_at', '>', Math.floor(Date.now() / 1000));
    expect(active.length).toBe(5);
  });

  test('marks the first created event as featured', async () => {
    await svc.generateEvents();
    const featured = await db('world_events')
      .where('is_active', 1)
      .where('is_featured', 1);
    expect(featured.length).toBeGreaterThanOrEqual(1);
  });

  test('returns 0 when already at or above TARGET_COUNT', async () => {
    await svc.generateEvents();                 // fills to 5
    const second = await svc.generateEvents();  // nothing to do
    expect(second).toBe(0);
  });

  test('generated events have future expires_at and valid rewards JSON', async () => {
    await svc.generateEvents();
    const now = Math.floor(Date.now() / 1000);
    const events = await db('world_events').where('is_active', 1);
    for (const e of events) {
      expect(e.expires_at).toBeGreaterThan(now);
      const rewards = JSON.parse(e.rewards);
      expect(Array.isArray(rewards)).toBe(true);
      expect(rewards.length).toBeGreaterThan(0);
      expect(rewards[0]).toHaveProperty('resource_id');
      expect(rewards[0]).toHaveProperty('amount');
    }
  });

  test('does not place two events on the same hotspot', async () => {
    await svc.generateEvents();
    const events = await db('world_events').where('is_active', 1);
    const keys = events.map((e) => `${e.tile_x},${e.tile_y}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  test('creates only the remaining needed events when some already exist', async () => {
    // Pre-create 3 active events at unique tile positions
    const now = Math.floor(Date.now() / 1000);
    await db('world_events').insert([
      { event_type: 'wild_harvest', title: 'A', description: '', icon: '🌾', tile_x: 52, tile_y: 18, rewards: '[]', rarity: 'common', expires_at: now + 3600, is_active: 1, is_featured: 0, created_at: new Date().toISOString() },
      { event_type: 'wild_harvest', title: 'B', description: '', icon: '🌾', tile_x: 72, tile_y: 14, rewards: '[]', rarity: 'common', expires_at: now + 3600, is_active: 1, is_featured: 0, created_at: new Date().toISOString() },
      { event_type: 'wild_harvest', title: 'C', description: '', icon: '🌾', tile_x: 90, tile_y: 22, rewards: '[]', rarity: 'common', expires_at: now + 3600, is_active: 1, is_featured: 0, created_at: new Date().toISOString() },
    ]);
    const created = await svc.generateEvents();
    expect(created).toBe(2);  // needed 5, had 3 → creates 2
  });
});

// ─── getActiveEvents ──────────────────────────────────────────────────────────

describe('worldEventService.getActiveEvents', () => {
  test('returns empty array when no active events exist', async () => {
    await db('world_events').where('is_active', 1).update({ is_active: 0 });
    const events = await svc.getActiveEvents(WE_HOST);
    expect(events).toEqual([]);
  });

  test('returns active events with required fields', async () => {
    const eventId = await seedEvent();
    const events = await svc.getActiveEvents(WE_HOST);
    const found = events.find((e) => e.id === eventId);
    expect(found).toBeDefined();
    expect(found).toHaveProperty('id');
    expect(found).toHaveProperty('event_type');
    expect(found).toHaveProperty('title');
    expect(found).toHaveProperty('rewards');
    expect(found).toHaveProperty('rarity');
    expect(found).toHaveProperty('expires_at');
    expect(found).toHaveProperty('is_claimed');
    expect(found).toHaveProperty('session_id');
    expect(found).toHaveProperty('session_count');
    expect(found).toHaveProperty('player_in_session');
  });

  test('is_claimed is 0 before claiming', async () => {
    const eventId = await seedEvent();
    const events = await svc.getActiveEvents(WE_HOST);
    const found = events.find((e) => e.id === eventId);
    expect(found.is_claimed).toBe(0);
  });

  test('is_claimed is 1 after claiming', async () => {
    const eventId = await seedEvent();
    await db('world_event_claims').insert({
      event_id:   eventId,
      player_id:  WE_HOST,
      claimed_at: new Date().toISOString(),
    });
    const events = await svc.getActiveEvents(WE_HOST);
    const found = events.find((e) => e.id === eventId);
    expect(found.is_claimed).toBe(1);
  });

  test('does not return expired events', async () => {
    const expiredId = await seedEvent({ isActive: 1, expiresAt: PAST });
    const events = await svc.getActiveEvents(WE_HOST);
    const found = events.find((e) => e.id === expiredId);
    expect(found).toBeUndefined();
  });

  test('reflects session info when a co-op session exists', async () => {
    const eventId = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    const events = await svc.getActiveEvents(WE_HOST);
    const found = events.find((e) => e.id === eventId);
    expect(found.session_id).toBe(session_id);
    expect(found.session_count).toBe(1);
    expect(found.player_in_session).toBe(1);
  });

  test('player_in_session is 0 for player not in any session', async () => {
    const eventId = await seedEvent();
    await svc.startCoopSession(WE_HOST, eventId);   // host creates session
    const events = await svc.getActiveEvents(WE_JOINER);  // joiner is NOT in it
    const found = events.find((e) => e.id === eventId);
    expect(found.player_in_session).toBe(0);
  });
});

// ─── claimEvent ───────────────────────────────────────────────────────────────

describe('worldEventService.claimEvent', () => {
  test('awards resources to the player on success', async () => {
    const rewards = JSON.stringify([{ resource_id: 'gold', amount: 200 }]);
    const eventId = await seedEvent({ rewards });

    const result = await svc.claimEvent(WE_HOST, eventId);

    expect(result.success).toBe(true);
    expect(result.rewards[0].resource_id).toBe('gold');
    expect(result.rewards[0].amount).toBe(200);

    const row = await db('player_resources')
      .where({ player_id: WE_HOST, resource_id: 'gold' })
      .first();
    expect(row.amount).toBe(200);
  });

  test('records a claim so the event cannot be claimed twice', async () => {
    const eventId = await seedEvent();
    await svc.claimEvent(WE_HOST, eventId);
    await expect(svc.claimEvent(WE_HOST, eventId)).rejects.toThrow(/ya reclamaste/i);
  });

  test('throws when event does not exist', async () => {
    await expect(svc.claimEvent(WE_HOST, 999999)).rejects.toThrow(/no existe|expiró/i);
  });

  test('throws when event is expired', async () => {
    const eventId = await seedEvent({ expiresAt: PAST });
    await expect(svc.claimEvent(WE_HOST, eventId)).rejects.toThrow(/no existe|expiró/i);
  });

  test('throws when event is inactive', async () => {
    const eventId = await seedEvent({ isActive: 0 });
    await expect(svc.claimEvent(WE_HOST, eventId)).rejects.toThrow(/no existe|expiró/i);
  });

  test('solo claim has multiplier 1 and participant_count 1', async () => {
    const eventId = await seedEvent();
    const result = await svc.claimEvent(WE_HOST, eventId);
    expect(result.multiplier).toBe(1);
    expect(result.participant_count).toBe(1);
  });

  test('co-op claim applies multiplier to rewards (2 participants → ×1.3)', async () => {
    const rewards = JSON.stringify([{ resource_id: 'wood', amount: 100 }]);
    const eventId = await seedEvent({ rewards });

    // Create session with 2 participants
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    await svc.joinCoopSession(WE_JOINER, session_id);

    const result = await svc.claimEvent(WE_HOST, eventId);

    expect(result.multiplier).toBeCloseTo(1.3);
    expect(result.participant_count).toBe(2);
    // 100 × 1.3 = 130
    expect(result.rewards[0].amount).toBe(130);
  });

  test('co-op claim with 4 participants applies maximum multiplier (×1.9)', async () => {
    const rewards = JSON.stringify([{ resource_id: 'stone', amount: 100 }]);
    const eventId = await seedEvent({ rewards });

    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    await svc.joinCoopSession(WE_JOINER, session_id);
    await svc.joinCoopSession(WE_THIRD, session_id);

    // Manually add a 4th participant without going through joinCoopSession
    await db('event_session_participants').insert({
      session_id,
      player_id: 555444336,
      joined_at: new Date().toISOString(),
    });
    await db('event_sessions').where('id', session_id).update({ participant_count: 4 });

    const result = await svc.claimEvent(WE_HOST, eventId);
    expect(result.multiplier).toBeCloseTo(1.9);
    expect(result.rewards[0].amount).toBe(190);

    // Cleanup 4th participant
    await db('event_session_participants').where('player_id', 555444336).delete();
  });

  test('success message includes event title', async () => {
    const eventId = await seedEvent();
    const result = await svc.claimEvent(WE_HOST, eventId);
    expect(result.message).toMatch(/test event/i);
  });

  test('co-op success message includes co-op bonus info', async () => {
    const eventId = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    await svc.joinCoopSession(WE_JOINER, session_id);
    const result = await svc.claimEvent(WE_HOST, eventId);
    expect(result.message).toMatch(/cooperativo|aliados/i);
  });
});

// ─── startCoopSession ─────────────────────────────────────────────────────────

describe('worldEventService.startCoopSession', () => {
  test('creates a session and adds host as first participant', async () => {
    const eventId = await seedEvent();
    const result = await svc.startCoopSession(WE_HOST, eventId);

    expect(result.session_id).toBeDefined();
    expect(result.participant_count).toBe(1);
    expect(result.max_participants).toBe(4);
    expect(result.already_open).toBe(false);

    const participant = await db('event_session_participants')
      .where({ session_id: result.session_id, player_id: WE_HOST })
      .first();
    expect(participant).toBeDefined();
  });

  test('returns an invite link containing the event and session IDs', async () => {
    const eventId = await seedEvent();
    const result = await svc.startCoopSession(WE_HOST, eventId);
    expect(result.invite_link).toMatch(new RegExp(`event_${eventId}`));
    expect(result.invite_link).toMatch(new RegExp(`s${result.session_id}`));
  });

  test('returns already_open=true and same session_id if called twice', async () => {
    const eventId = await seedEvent();
    const first  = await svc.startCoopSession(WE_HOST, eventId);
    const second = await svc.startCoopSession(WE_HOST, eventId);
    expect(second.already_open).toBe(true);
    expect(second.session_id).toBe(first.session_id);
  });

  test('throws when event does not exist', async () => {
    await expect(svc.startCoopSession(WE_HOST, 999999)).rejects.toThrow(/no existe|expiró/i);
  });

  test('throws when event has already been claimed by the host', async () => {
    const eventId = await seedEvent();
    await svc.claimEvent(WE_HOST, eventId);
    await expect(svc.startCoopSession(WE_HOST, eventId)).rejects.toThrow(/ya reclamaste/i);
  });

  test('throws when event is expired', async () => {
    const eventId = await seedEvent({ expiresAt: PAST });
    await expect(svc.startCoopSession(WE_HOST, eventId)).rejects.toThrow(/no existe|expiró/i);
  });
});

// ─── joinCoopSession ──────────────────────────────────────────────────────────

describe('worldEventService.joinCoopSession', () => {
  test('adds participant and increments participant_count', async () => {
    const eventId = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    const result = await svc.joinCoopSession(WE_JOINER, session_id);

    expect(result.participant_count).toBe(2);
    expect(result.already_joined).toBe(false);

    const row = await db('event_sessions').where('id', session_id).first();
    expect(row.participant_count).toBe(2);
  });

  test('returns correct multiplier for the new participant count', async () => {
    const eventId  = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    const result = await svc.joinCoopSession(WE_JOINER, session_id);
    // 2 participants → 1 + (2-1) * 0.3 = 1.3
    expect(result.multiplier).toBeCloseTo(1.3);
  });

  test('returns already_joined=true when called twice by same player', async () => {
    const eventId = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    await svc.joinCoopSession(WE_JOINER, session_id);
    const second = await svc.joinCoopSession(WE_JOINER, session_id);
    expect(second.already_joined).toBe(true);
    // participant_count must NOT be double-incremented
    const row = await db('event_sessions').where('id', session_id).first();
    expect(row.participant_count).toBe(2);
  });

  test('throws when session does not exist', async () => {
    await expect(svc.joinCoopSession(WE_JOINER, 999999)).rejects.toThrow(/no existe|expiró/i);
  });

  test('throws when session is full (4 participants)', async () => {
    const eventId = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);

    // Force participant_count to max
    await db('event_sessions').where('id', session_id).update({ participant_count: 4 });
    await expect(svc.joinCoopSession(WE_JOINER, session_id)).rejects.toThrow(/llena|máximo/i);
  });

  test('returns event_id in result', async () => {
    const eventId = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    const result = await svc.joinCoopSession(WE_JOINER, session_id);
    expect(result.event_id).toBe(eventId);
  });
});

// ─── getSession ───────────────────────────────────────────────────────────────

describe('worldEventService.getSession', () => {
  test('returns null for a non-existent session ID', async () => {
    const result = await svc.getSession(999999);
    expect(result).toBeNull();
  });

  test('returns session info with event and participants', async () => {
    const eventId = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    await svc.joinCoopSession(WE_JOINER, session_id);

    const session = await svc.getSession(session_id);

    expect(session.session_id).toBe(session_id);
    expect(session.event_id).toBe(eventId);
    expect(session.participant_count).toBe(2);
    expect(session.max_participants).toBe(4);
    expect(session.participants).toHaveLength(2);
    expect(session.participants.map((p) => p.player_id)).toContain(WE_HOST);
    expect(session.participants.map((p) => p.player_id)).toContain(WE_JOINER);
  });

  test('multiplier matches participant count', async () => {
    const eventId = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    await svc.joinCoopSession(WE_JOINER, session_id);
    await svc.joinCoopSession(WE_THIRD, session_id);

    const session = await svc.getSession(session_id);
    // 3 participants → 1 + 2 * 0.3 = 1.6
    expect(session.multiplier).toBeCloseTo(1.6);
  });

  test('is_expired is false for an active session', async () => {
    const eventId = await seedEvent();
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    const session = await svc.getSession(session_id);
    expect(session.is_expired).toBe(false);
  });

  test('event field contains title, rarity and parsed rewards', async () => {
    const rewards = JSON.stringify([{ resource_id: 'gold', amount: 50 }]);
    const eventId = await seedEvent({ rewards });
    const { session_id } = await svc.startCoopSession(WE_HOST, eventId);
    const session = await svc.getSession(session_id);

    expect(session.event).not.toBeNull();
    expect(session.event.title).toBeDefined();
    expect(session.event.rarity).toBeDefined();
    expect(Array.isArray(session.event.rewards)).toBe(true);
    expect(session.event.rewards[0]).toEqual({ resource_id: 'gold', amount: 50 });
  });
});
