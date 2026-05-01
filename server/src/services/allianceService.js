/**
 * Alliances — player-created social groups, distinct from the 4 fixed
 * factions. A player can belong to at most one alliance at a time.
 *
 * MVP scope:
 *   - create / join / leave / disband
 *   - list with member counts
 *   - inspect members
 *
 * Out of scope for now: alliance chat, shared territory bonuses, alliance
 * vs alliance wars. Tracked in [[Sistemas/Alliances]] for next iteration.
 */
const db = require('../config/database');
const { sanitizeDisplayText } = require('../utils/sanitize');
const notifyService = require('./notifyService');

const NAME_MIN = 3;
const NAME_MAX = 24;
const MOTTO_MAX = 80;
const DEFAULT_MEMBER_LIMIT = 10;
const MESSAGE_MAX = 280;
const MESSAGE_HISTORY_LIMIT = 50;
// Anti-spam for member DMs: re-notify the same alliance at most once every
// 10 minutes. Players inside the app see the socket event regardless.
const ALLIANCE_DM_COOLDOWN_MS = 10 * 60 * 1000;
const _lastDmAt = new Map(); // alliance_id → ms timestamp

const allianceService = {
  /** List every alliance with live member counts. */
  async listAlliances() {
    const alliances = await db('alliances').orderBy('id', 'asc');
    if (alliances.length === 0) return [];
    const allMembers = await db('alliance_members').select('alliance_id', 'player_id');
    const countByAlliance = new Map();
    for (const m of allMembers) {
      countByAlliance.set(m.alliance_id, (countByAlliance.get(m.alliance_id) || 0) + 1);
    }
    return alliances.map((a) => ({
      id: a.id,
      name: a.name,
      motto: a.motto || '',
      leader_id: a.leader_id,
      member_limit: a.member_limit || DEFAULT_MEMBER_LIMIT,
      member_count: countByAlliance.get(a.id) || 0,
      created_at: a.created_at,
    }));
  },

  /** Members of one alliance with their player display names. */
  async getMembers(allianceId) {
    const members = await db('alliance_members').where('alliance_id', allianceId);
    if (members.length === 0) return [];
    const playerIds = members.map((m) => m.player_id);
    const players = await db('players')
      .select('telegram_id', 'display_name', 'level', 'faction_id')
      .whereIn('telegram_id', playerIds);
    const playerMap = new Map(players.map((p) => [p.telegram_id, p]));
    return members.map((m) => ({
      player_id: m.player_id,
      role: m.role,
      joined_at: m.joined_at,
      display_name: playerMap.get(m.player_id)?.display_name || 'Anónimo',
      level: playerMap.get(m.player_id)?.level || 1,
      faction_id: playerMap.get(m.player_id)?.faction_id || null,
    }));
  },

  /** Look up the alliance the player currently belongs to (or null). */
  async getMyAlliance(playerId) {
    const member = await db('alliance_members').where('player_id', playerId).first();
    if (!member) return null;
    const alliance = await db('alliances').where('id', member.alliance_id).first();
    if (!alliance) return null;
    const memberCount = await db('alliance_members')
      .where('alliance_id', alliance.id).count('* as count');
    const count = Array.isArray(memberCount) ? (memberCount[0]?.count || 0) : 0;
    return {
      id: alliance.id,
      name: alliance.name,
      motto: alliance.motto || '',
      leader_id: alliance.leader_id,
      member_limit: alliance.member_limit || DEFAULT_MEMBER_LIMIT,
      member_count: count,
      my_role: member.role,
    };
  },

  async createAlliance(playerId, name, motto = '') {
    const cleanName = sanitizeDisplayText(name, NAME_MAX);
    if (!cleanName || cleanName.length < NAME_MIN) {
      throw new Error(`Nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres`);
    }
    const cleanMotto = sanitizeDisplayText(motto || '', MOTTO_MAX);

    // Player can be in at most one alliance
    const existing = await db('alliance_members').where('player_id', playerId).first();
    if (existing) throw new Error('Ya pertenecés a una alianza');

    // Unique alliance name
    const dup = await db('alliances').where('name', cleanName).first();
    if (dup) throw new Error('Ese nombre ya está tomado');

    const now = new Date().toISOString();
    const [allianceId] = await db('alliances').insert({
      name: cleanName,
      leader_id: playerId,
      motto: cleanMotto,
      member_limit: DEFAULT_MEMBER_LIMIT,
      created_at: now,
    });

    await db('alliance_members').insert({
      alliance_id: allianceId,
      player_id: playerId,
      role: 'leader',
      joined_at: now,
    });

    return { success: true, allianceId, name: cleanName, message: `Fundaste ${cleanName}` };
  },

  async joinAlliance(playerId, allianceId) {
    const existing = await db('alliance_members').where('player_id', playerId).first();
    if (existing) throw new Error('Ya pertenecés a una alianza');

    const alliance = await db('alliances').where('id', allianceId).first();
    if (!alliance) throw new Error('Alianza no encontrada');

    const limit = alliance.member_limit || DEFAULT_MEMBER_LIMIT;
    const countResult = await db('alliance_members').where('alliance_id', allianceId).count('* as count');
    const count = Array.isArray(countResult) ? (countResult[0]?.count || 0) : 0;
    if (count >= limit) throw new Error(`La alianza está llena (${limit} miembros)`);

    await db('alliance_members').insert({
      alliance_id: allianceId,
      player_id: playerId,
      role: 'member',
      joined_at: new Date().toISOString(),
    });

    return { success: true, message: `Te uniste a ${alliance.name}` };
  },

  async leaveAlliance(playerId) {
    const member = await db('alliance_members').where('player_id', playerId).first();
    if (!member) throw new Error('No estás en ninguna alianza');
    if (member.role === 'leader') {
      throw new Error('Sos líder — disolvé la alianza desde el panel de líder en su lugar');
    }
    await db('alliance_members').where('player_id', playerId).delete();
    return { success: true, message: 'Saliste de la alianza' };
  },

  async disbandAlliance(playerId, allianceId) {
    const alliance = await db('alliances').where('id', allianceId).first();
    if (!alliance) throw new Error('Alianza no encontrada');
    if (alliance.leader_id !== playerId) throw new Error('Solo el líder puede disolver la alianza');

    await db('alliance_members').where('alliance_id', allianceId).delete();
    await db('alliances').where('id', allianceId).delete();
    await db('alliance_messages').where('alliance_id', allianceId).delete();
    return { success: true, message: `Disolviste ${alliance.name}` };
  },

  /**
   * Send a chat message to the player's alliance. Emits a socket event to
   * every connected member and DMs offline members (rate-limited per
   * alliance to avoid Telegram spam).
   */
  async sendMessage(playerId, content, io) {
    const text = sanitizeDisplayText(content || '', MESSAGE_MAX);
    if (!text) throw new Error('Mensaje vacío');

    const member = await db('alliance_members').where('player_id', playerId).first();
    if (!member) throw new Error('No estás en ninguna alianza');

    const sender = await db('players').where('telegram_id', playerId).first();
    const senderName = sender?.display_name || 'Anónimo';

    const now = new Date().toISOString();
    const [messageId] = await db('alliance_messages').insert({
      alliance_id: member.alliance_id,
      player_id: playerId,
      content: text,
      created_at: now,
    });

    // Socket fan-out: every member's join_game subscribed them to player_<id>.
    // Loop members and emit to each so reading is identical to existing flow.
    const members = await db('alliance_members')
      .where('alliance_id', member.alliance_id)
      .select('player_id');
    if (io) {
      for (const m of members) {
        io.to(`player_${m.player_id}`).emit('alliance_message', {
          id: messageId, alliance_id: member.alliance_id,
          sender_id: playerId, sender_name: senderName,
          content: text, created_at: now,
        });
      }
    }

    // Rate-limited DM to keep offline members aware. One DM per alliance
    // per ALLIANCE_DM_COOLDOWN_MS regardless of message volume.
    const lastDm = _lastDmAt.get(member.alliance_id) || 0;
    if (Date.now() - lastDm > ALLIANCE_DM_COOLDOWN_MS) {
      _lastDmAt.set(member.alliance_id, Date.now());
      for (const m of members) {
        if (m.player_id === playerId) continue; // don't DM the sender
        notifyService.sendBotDM(
          m.player_id,
          `💬 [Alianza] ${senderName}: ${text}`,
        );
      }
    }

    return { success: true, messageId, content: text };
  },

  /**
   * Combat bonuses granted just for being in an alliance. Designed to be
   * additive with existing faction + tech stacks. Modest values so alliance
   * membership matters but doesn't dwarf faction choice.
   */
  async getCombatBonuses(playerId) {
    if (!playerId) return { atk: 0, def: 0, loot: 0 };
    const member = await db('alliance_members').where('player_id', playerId).first();
    if (!member) return { atk: 0, def: 0, loot: 0 };
    return { atk: 0.05, def: 0.05, loot: 0.10 };
  },

  /**
   * Send a pending invitation. Only leader/officer can invite. Target must
   * not already be in any alliance and must not have a pending invite from
   * this same alliance.
   */
  async invitePlayer(inviterId, allianceId, targetPlayerId) {
    if (inviterId === targetPlayerId) throw new Error('No podés invitarte a vos mismo');

    const inviter = await db('alliance_members').where('player_id', inviterId).first();
    if (!inviter || inviter.alliance_id !== allianceId) {
      throw new Error('No sos miembro de esta alianza');
    }
    if (inviter.role !== 'leader' && inviter.role !== 'officer') {
      throw new Error('Solo líder u oficial pueden invitar');
    }

    const alliance = await db('alliances').where('id', allianceId).first();
    if (!alliance) throw new Error('Alianza no encontrada');

    const target = await db('players').where('telegram_id', targetPlayerId).first();
    if (!target) throw new Error('Jugador no encontrado');

    const targetMember = await db('alliance_members').where('player_id', targetPlayerId).first();
    if (targetMember) throw new Error('Ese jugador ya pertenece a una alianza');

    const dup = await db('alliance_invitations')
      .where({ alliance_id: allianceId, invited_player_id: targetPlayerId, status: 'pending' })
      .first();
    if (dup) throw new Error('Ya hay una invitación pendiente para ese jugador');

    const [id] = await db('alliance_invitations').insert({
      alliance_id: allianceId,
      invited_by_player_id: inviterId,
      invited_player_id: targetPlayerId,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    notifyService.sendBotDM(
      targetPlayerId,
      `📨 Te invitaron a "${alliance.name}". Abrí Alianza > Invitaciones para responder.`,
    );

    return { success: true, invitationId: id, message: `Invitación enviada a ${target.display_name}` };
  },

  /** Pending invitations FOR a specific player (their inbox). */
  async getPendingInvitations(playerId) {
    const rows = await db('alliance_invitations')
      .where({ invited_player_id: playerId, status: 'pending' })
      .orderBy('id', 'desc');
    if (rows.length === 0) return [];
    const allianceIds = [...new Set(rows.map((r) => r.alliance_id))];
    const inviterIds = [...new Set(rows.map((r) => r.invited_by_player_id))];
    const alliances = await db('alliances').whereIn('id', allianceIds);
    const inviters = await db('players').whereIn('telegram_id', inviterIds)
      .select('telegram_id', 'display_name');
    const aMap = new Map(alliances.map((a) => [a.id, a]));
    const iMap = new Map(inviters.map((i) => [i.telegram_id, i.display_name]));
    return rows.map((r) => ({
      id: r.id,
      alliance_id: r.alliance_id,
      alliance_name: aMap.get(r.alliance_id)?.name || '???',
      alliance_motto: aMap.get(r.alliance_id)?.motto || '',
      invited_by_name: iMap.get(r.invited_by_player_id) || 'Anónimo',
      created_at: r.created_at,
    }));
  },

  /**
   * Accept or reject an invitation. Capacity is re-checked at accept time
   * because the alliance may have filled up between invite and response.
   */
  async respondToInvitation(playerId, invitationId, accept) {
    const inv = await db('alliance_invitations').where('id', invitationId).first();
    if (!inv) throw new Error('Invitación no encontrada');
    if (inv.invited_player_id !== playerId) throw new Error('Esta invitación no es tuya');
    if (inv.status !== 'pending') throw new Error('Esta invitación ya fue respondida');

    const now = new Date().toISOString();
    if (!accept) {
      await db('alliance_invitations').where('id', invitationId).update({
        status: 'rejected', responded_at: now,
      });
      return { success: true, message: 'Invitación rechazada' };
    }

    // Re-check member-not-in-alliance + capacity at accept time
    const existing = await db('alliance_members').where('player_id', playerId).first();
    if (existing) {
      await db('alliance_invitations').where('id', invitationId).update({
        status: 'cancelled', responded_at: now,
      });
      throw new Error('Ya estás en una alianza');
    }

    const alliance = await db('alliances').where('id', inv.alliance_id).first();
    if (!alliance) throw new Error('La alianza ya no existe');
    const limit = alliance.member_limit || DEFAULT_MEMBER_LIMIT;
    const countResult = await db('alliance_members').where('alliance_id', inv.alliance_id).count('* as count');
    const count = Array.isArray(countResult) ? (countResult[0]?.count || 0) : 0;
    if (count >= limit) {
      await db('alliance_invitations').where('id', invitationId).update({
        status: 'cancelled', responded_at: now,
      });
      throw new Error(`La alianza está llena (${limit} miembros)`);
    }

    await db('alliance_members').insert({
      alliance_id: inv.alliance_id,
      player_id: playerId,
      role: 'member',
      joined_at: now,
    });
    await db('alliance_invitations').where('id', invitationId).update({
      status: 'accepted', responded_at: now,
    });

    return { success: true, message: `Te uniste a ${alliance.name}` };
  },

  /** Leader-only: promote a member to officer (or demote officer→member). */
  async setMemberRole(actorId, allianceId, targetPlayerId, newRole) {
    if (newRole !== 'member' && newRole !== 'officer') {
      throw new Error('Rol inválido');
    }
    const alliance = await db('alliances').where('id', allianceId).first();
    if (!alliance) throw new Error('Alianza no encontrada');
    if (alliance.leader_id !== actorId) {
      throw new Error('Solo el líder puede cambiar roles');
    }
    if (targetPlayerId === actorId) {
      throw new Error('No podés cambiar tu propio rol');
    }
    const target = await db('alliance_members')
      .where({ alliance_id: allianceId, player_id: targetPlayerId })
      .first();
    if (!target) throw new Error('Ese jugador no es miembro de esta alianza');
    await db('alliance_members').where('id', target.id).update({ role: newRole });
    return { success: true, message: `Rol cambiado a ${newRole}` };
  },

  /**
   * Leader/officer kicks a member. Officers cannot kick officers or the
   * leader. Leader can kick anyone except themselves (must disband instead).
   */
  async kickMember(actorId, allianceId, targetPlayerId) {
    if (actorId === targetPlayerId) throw new Error('Usá leave/disolver en su lugar');
    const actor = await db('alliance_members')
      .where({ alliance_id: allianceId, player_id: actorId })
      .first();
    if (!actor) throw new Error('No sos miembro de esta alianza');
    if (actor.role !== 'leader' && actor.role !== 'officer') {
      throw new Error('Solo líder u oficial pueden expulsar');
    }
    const target = await db('alliance_members')
      .where({ alliance_id: allianceId, player_id: targetPlayerId })
      .first();
    if (!target) throw new Error('Ese jugador no es miembro');
    if (target.role === 'leader') throw new Error('No podés expulsar al líder');
    if (actor.role === 'officer' && target.role === 'officer') {
      throw new Error('Un oficial no puede expulsar a otro oficial');
    }

    await db('alliance_members').where('id', target.id).delete();

    const alliance = await db('alliances').where('id', allianceId).first();
    if (alliance) {
      notifyService.sendBotDM(
        targetPlayerId,
        `🚪 Fuiste expulsado de "${alliance.name}".`,
      );
    }
    return { success: true, message: 'Miembro expulsado' };
  },

  /** Last MESSAGE_HISTORY_LIMIT messages of the player's alliance. */
  async getMessages(playerId) {
    const member = await db('alliance_members').where('player_id', playerId).first();
    if (!member) throw new Error('No estás en ninguna alianza');

    const rows = await db('alliance_messages')
      .where('alliance_id', member.alliance_id)
      .orderBy('id', 'desc')
      .limit(MESSAGE_HISTORY_LIMIT);

    if (rows.length === 0) return [];

    const senderIds = [...new Set(rows.map((r) => r.player_id))];
    const senders = await db('players')
      .whereIn('telegram_id', senderIds)
      .select('telegram_id', 'display_name');
    const senderMap = new Map(senders.map((s) => [s.telegram_id, s.display_name]));

    return rows.reverse().map((r) => ({
      id: r.id,
      sender_id: r.player_id,
      sender_name: senderMap.get(r.player_id) || 'Anónimo',
      content: r.content,
      created_at: r.created_at,
    }));
  },
};

module.exports = allianceService;
