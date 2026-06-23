/**
 * Alliance vs alliance war — leader-declared 24h windows where members
 * earn points by attacking the rival alliance's members in PvP. Winner
 * gets KH bonus distributed to all surviving members.
 *
 * Scoring: a successful PvP attack against a member of the rival alliance
 * counts +1 for the attacker's side. Losses don't subtract — keeps the
 * scoreboard climbing-only so it reads well during the war.
 *
 * Settle: at end, faction with higher score wins (tie → no winner). All
 * members of the winning alliance receive a KH bonus + DM.
 */
const db = require('../config/database');

const ALLIANCE_WAR_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const WAR_WINNER_BONUS_KH = 30;

let _tokenService = null;
function getTokenService() {
  if (!_tokenService) _tokenService = require('./tokenService');
  return _tokenService;
}
let _notifyService = null;
function getNotifyService() {
  if (!_notifyService) _notifyService = require('./notifyService');
  return _notifyService;
}

const allianceWarService = {
  /**
   * Leader-only declaration. Both alliances need to exist and not be
   * already at war (with each other or anyone else). Re-using a still-
   * settling row is bad — start fresh each time.
   */
  async declareWar(leaderId, targetAllianceId) {
    const leaderMember = await db('alliance_members').where('player_id', leaderId).first();
    if (!leaderMember || leaderMember.role !== 'leader') {
      throw new Error('Solo el líder puede declarar guerra');
    }
    if (leaderMember.alliance_id === targetAllianceId) {
      throw new Error('No podés declarar guerra a tu propia alianza');
    }
    const target = await db('alliances').where('id', targetAllianceId).first();
    if (!target) throw new Error('Alianza objetivo no existe');

    // Either alliance already in active war?
    const existing = await db('alliance_wars')
      .where('status', 'active')
      .where(function() {
        this.where('alliance_a_id', leaderMember.alliance_id)
            .orWhere('alliance_b_id', leaderMember.alliance_id)
            .orWhere('alliance_a_id', targetAllianceId)
            .orWhere('alliance_b_id', targetAllianceId);
      })
      .first();
    if (existing) throw new Error('Una de las alianzas ya está en guerra');

    const now = new Date();
    const ends = new Date(now.getTime() + ALLIANCE_WAR_DURATION_MS);
    const [warId] = await db('alliance_wars').insert({
      alliance_a_id: leaderMember.alliance_id,
      alliance_b_id: targetAllianceId,
      started_at: now.toISOString(),
      ends_at: ends.toISOString(),
      status: 'active',
    });

    // DM all members of both alliances about the declaration
    const aMembers = await db('alliance_members').where('alliance_id', leaderMember.alliance_id);
    const bMembers = await db('alliance_members').where('alliance_id', targetAllianceId);
    const aAll = await db('alliances').where('id', leaderMember.alliance_id).first();
    const notify = getNotifyService();
    for (const m of aMembers) {
      notify.sendBotDM(m.player_id, `⚔️ ${aAll.name} declaró guerra a ${target.name}. ¡A las armas!`);
    }
    for (const m of bMembers) {
      notify.sendBotDM(m.player_id, `🛡️ ${aAll.name} les declaró guerra. Defiendan ${target.name}.`);
    }

    return { success: true, warId, message: `Guerra declarada contra ${target.name} (24h)` };
  },

  /**
   * combatService hook — called after a successful PvP attack. Increments
   * the attacker's side score if attacker and defender are in opposing
   * alliances during an active war.
   */
  async logPvpHit(attackerId, defenderId) {
    const attackerMember = await db('alliance_members').where('player_id', attackerId).first();
    const defenderMember = await db('alliance_members').where('player_id', defenderId).first();
    if (!attackerMember || !defenderMember) return;
    if (attackerMember.alliance_id === defenderMember.alliance_id) return;

    const war = await db('alliance_wars')
      .where('status', 'active')
      .where(function() {
        this.where(function() {
          this.where('alliance_a_id', attackerMember.alliance_id)
              .andWhere('alliance_b_id', defenderMember.alliance_id);
        }).orWhere(function() {
          this.where('alliance_a_id', defenderMember.alliance_id)
              .andWhere('alliance_b_id', attackerMember.alliance_id);
        });
      })
      .first();
    if (!war) return;

    const isAttackerSideA = war.alliance_a_id === attackerMember.alliance_id;
    if (isAttackerSideA) {
      await db('alliance_wars').where('id', war.id).increment('score_a', 1);
    } else {
      await db('alliance_wars').where('id', war.id).increment('score_b', 1);
    }
  },

  /** Active wars involving the player's alliance (typically 0 or 1). */
  async getMyActiveWar(playerId) {
    const member = await db('alliance_members').where('player_id', playerId).first();
    if (!member) return null;
    const war = await db('alliance_wars')
      .where('status', 'active')
      .where(function() {
        this.where('alliance_a_id', member.alliance_id)
            .orWhere('alliance_b_id', member.alliance_id);
      })
      .first();
    if (!war) return null;
    const a = await db('alliances').where('id', war.alliance_a_id).first();
    const b = await db('alliances').where('id', war.alliance_b_id).first();
    return {
      ...war,
      alliance_a: { id: a?.id, name: a?.name },
      alliance_b: { id: b?.id, name: b?.name },
      my_side: war.alliance_a_id === member.alliance_id ? 'a' : 'b',
    };
  },

  async _settle(warRow) {
    let winnerId = null;
    if (warRow.score_a > warRow.score_b) winnerId = warRow.alliance_a_id;
    else if (warRow.score_b > warRow.score_a) winnerId = warRow.alliance_b_id;

    await db('alliance_wars').where('id', warRow.id).update({
      status: 'finished',
      winner_alliance_id: winnerId,
    });

    if (!winnerId) return; // tie

    const winner = await db('alliances').where('id', winnerId).first();
    const members = await db('alliance_members').where('alliance_id', winnerId);
    for (const m of members) {
      try {
        await getTokenService().awardTokens(m.player_id, WAR_WINNER_BONUS_KH, 'alliance_war');
        getNotifyService().sendBotDM(
          m.player_id,
          `🏆 ¡${winner?.name || 'Tu alianza'} ganó la guerra! +${WAR_WINNER_BONUS_KH} KH.`,
        );
      } catch (err) {
        console.error('[AllianceWar] Award failed:', err.message);
      }
    }
  },

  /** gameTick hook — settle expired wars. */
  async tick() {
    const expired = await db('alliance_wars')
      .where('status', 'active')
      .where('ends_at', '<=', new Date().toISOString());
    for (const w of expired) {
      try { await this._settle(w); } catch (err) {
        console.error('[AllianceWar] Settle failed:', err.message);
      }
    }
  },
};

module.exports = allianceWarService;
