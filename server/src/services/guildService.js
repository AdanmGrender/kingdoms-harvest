const db = require('../config/database');

const GUILD_CREATION_COST = 500;
const MAX_MEMBERS = 30;
const INVITE_EXPIRY_HOURS = 48;

const GUILD_LEVEL_XP = [0, 100, 300, 700, 1500, 3000];

const GUILD_LEVEL_BONUSES = {
  1: { desc: 'Gremio nivel 1', bonus: {} },
  2: { desc: '+5% producción de recursos', bonus: { resource_production: 0.05 } },
  3: { desc: '+10% tokens ganados', bonus: { token_earn: 0.10 } },
  4: { desc: '+15% producción de recursos', bonus: { resource_production: 0.15 } },
  5: { desc: '+20% tokens + 25% recursos', bonus: { token_earn: 0.20, resource_production: 0.25 } },
};

const guildService = {
  getLevelFromXP(xp) {
    let level = 1;
    for (let i = 1; i < GUILD_LEVEL_XP.length; i++) {
      if (xp >= GUILD_LEVEL_XP[i]) level = i + 1;
      else break;
    }
    return Math.min(level, 5);
  },

  async createGuild(playerId, { name, tag, description = '' }) {
    const existingMembership = await db('guild_members').where('player_id', playerId).first();
    if (existingMembership) throw new Error('Ya perteneces a un gremio');

    const normalizedTag = tag.toUpperCase();

    const nameConflict = await db('guilds').where('name', name).first();
    if (nameConflict) throw new Error('Ya existe un gremio con ese nombre');

    const tagConflict = await db('guilds').where('tag', normalizedTag).first();
    if (tagConflict) throw new Error('Ya existe un gremio con ese tag');

    const affected = await db('player_resources')
      .where({ player_id: playerId, resource_id: 'gold' })
      .decrementIfEnough('amount', GUILD_CREATION_COST);
    if (!affected) throw new Error(`Necesitás ${GUILD_CREATION_COST} de oro para crear un gremio`);

    const [{ id: guildId }] = await db('guilds').insert({
      name,
      tag: normalizedTag,
      description,
      leader_id: playerId,
      level: 1,
      xp: 0,
      treasury_gold: 0,
      banner_color: '#e94560',
      created_at: new Date().toISOString(),
    }).returning('id');

    await db('guild_members').insert({
      guild_id: guildId,
      player_id: playerId,
      role: 'leader',
      contribution_points: 0,
      joined_at: new Date().toISOString(),
    });

    return { guildId, name, tag: normalizedTag };
  },

  async getGuild(guildId) {
    const guild = await db('guilds').where('id', guildId).first();
    if (!guild) throw new Error('Gremio no encontrado');

    const memberRows = await db('guild_members')
      .where('guild_id', guildId)
      .orderBy('contribution_points', 'desc');

    const members = await Promise.all(memberRows.map(async (m) => {
      const player = await db('players').where('telegram_id', m.player_id).first();
      return {
        playerId: m.player_id,
        username: player ? (player.display_name || player.username) : 'Desconocido',
        playerLevel: player ? player.level : 1,
        role: m.role,
        contributionPoints: m.contribution_points,
        joinedAt: m.joined_at,
      };
    }));

    const level = this.getLevelFromXP(guild.xp);
    const bonus = GUILD_LEVEL_BONUSES[level].bonus;
    const xpForNext = level < 5 ? GUILD_LEVEL_XP[level] : null;

    return {
      ...guild,
      level,
      bonus,
      xpForNext,
      members,
    };
  },

  async getMyGuild(playerId) {
    const membership = await db('guild_members').where('player_id', playerId).first();
    if (!membership) return null;
    return this.getGuild(membership.guild_id);
  },

  async listGuilds(limit = 20) {
    const guilds = await db('guilds').orderBy('xp', 'desc').limit(limit);

    return Promise.all(guilds.map(async (guild) => {
      const countRow = await db('guild_members')
        .where('guild_id', guild.id)
        .count('id as count')
        .first();
      const memberCount = Number(countRow ? countRow.count : 0);
      const level = this.getLevelFromXP(guild.xp);
      return { ...guild, memberCount, level };
    }));
  },

  async inviteMember(playerId, targetPlayerId) {
    const membership = await db('guild_members').where('player_id', playerId).first();
    if (!membership) throw new Error('No perteneces a ningún gremio');
    if (membership.role !== 'leader' && membership.role !== 'officer') {
      throw new Error('Solo el líder y oficiales pueden invitar miembros');
    }

    const targetMembership = await db('guild_members').where('player_id', targetPlayerId).first();
    if (targetMembership) throw new Error('El jugador ya pertenece a un gremio');

    const countRow = await db('guild_members')
      .where('guild_id', membership.guild_id)
      .count('id as count')
      .first();
    if (Number(countRow ? countRow.count : 0) >= MAX_MEMBERS) {
      throw new Error('El gremio está lleno');
    }

    const targetPlayer = await db('players').where('telegram_id', targetPlayerId).first();
    if (!targetPlayer) throw new Error('Jugador no encontrado');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_HOURS * 3600 * 1000).toISOString();

    const existingInvite = await db('guild_invites')
      .where({ guild_id: membership.guild_id, invited_player_id: targetPlayerId })
      .first();

    if (existingInvite) {
      await db('guild_invites')
        .where({ guild_id: membership.guild_id, invited_player_id: targetPlayerId })
        .update({ expires_at: expiresAt, invited_by: playerId, created_at: now.toISOString() });
    } else {
      await db('guild_invites').insert({
        guild_id: membership.guild_id,
        invited_player_id: targetPlayerId,
        invited_by: playerId,
        created_at: now.toISOString(),
        expires_at: expiresAt,
      });
    }

    return { success: true };
  },

  async getInvites(playerId) {
    const now = new Date().toISOString();
    const invites = await db('guild_invites')
      .where('invited_player_id', playerId)
      .where('expires_at', '>', now);

    return Promise.all(invites.map(async (invite) => {
      const guild = await db('guilds').where('id', invite.guild_id).first();
      const level = guild ? this.getLevelFromXP(guild.xp) : 1;
      return {
        ...invite,
        guildName: guild ? guild.name : 'Desconocido',
        guildTag: guild ? guild.tag : '???',
        guildLevel: level,
      };
    }));
  },

  async respondInvite(playerId, guildId, accept) {
    const now = new Date().toISOString();
    const invite = await db('guild_invites')
      .where({ guild_id: guildId, invited_player_id: playerId })
      .where('expires_at', '>', now)
      .first();
    if (!invite) throw new Error('Invitación no encontrada o expirada');

    await db('guild_invites')
      .where({ guild_id: guildId, invited_player_id: playerId })
      .delete();

    if (!accept) return { success: true, joined: false };

    const alreadyMember = await db('guild_members').where('player_id', playerId).first();
    if (alreadyMember) throw new Error('Ya perteneces a un gremio');

    const countRow = await db('guild_members')
      .where('guild_id', guildId)
      .count('id as count')
      .first();
    if (Number(countRow ? countRow.count : 0) >= MAX_MEMBERS) {
      throw new Error('El gremio está lleno');
    }

    await db('guild_members').insert({
      guild_id: guildId,
      player_id: playerId,
      role: 'member',
      contribution_points: 0,
      joined_at: new Date().toISOString(),
    });

    return { success: true, joined: true };
  },

  async leaveGuild(playerId) {
    const membership = await db('guild_members').where('player_id', playerId).first();
    if (!membership) throw new Error('No perteneces a ningún gremio');

    if (membership.role === 'leader') {
      const otherMembers = await db('guild_members')
        .where('guild_id', membership.guild_id)
        .whereNot('player_id', playerId)
        .orderBy('contribution_points', 'desc');

      if (otherMembers.length === 0) {
        await db('guild_members').where('guild_id', membership.guild_id).delete();
        await db('guilds').where('id', membership.guild_id).delete();
        return { success: true, disbanded: true };
      }

      const officerNext = otherMembers.find((m) => m.role === 'officer');
      const nextLeader = officerNext || otherMembers[0];

      await db('guild_members').where('id', nextLeader.id).update({ role: 'leader' });
      await db('guilds').where('id', membership.guild_id).update({ leader_id: nextLeader.player_id });
    }

    await db('guild_members').where('player_id', playerId).delete();
    return { success: true };
  },

  async contributeToTreasury(playerId, goldAmount) {
    const membership = await db('guild_members').where('player_id', playerId).first();
    if (!membership) throw new Error('No perteneces a ningún gremio');

    const affected = await db('player_resources')
      .where({ player_id: playerId, resource_id: 'gold' })
      .decrementIfEnough('amount', goldAmount);
    if (!affected) throw new Error('No tenés suficiente oro');

    const guildBefore = await db('guilds').where('id', membership.guild_id).first();
    const levelBefore = this.getLevelFromXP(guildBefore.xp);

    const xpGained = Math.floor(goldAmount / 10);

    await db('guilds').where('id', membership.guild_id).increment('treasury_gold', goldAmount);
    await db('guilds').where('id', membership.guild_id).increment('xp', xpGained);
    await db('guild_members').where('id', membership.id).increment('contribution_points', goldAmount);

    const guildAfter = await db('guilds').where('id', membership.guild_id).first();
    const levelAfter = this.getLevelFromXP(guildAfter.xp);

    if (levelAfter !== levelBefore) {
      await db('guilds').where('id', membership.guild_id).update({ level: levelAfter });
    }

    return { success: true };
  },

  async joinGuild(playerId, guildId) {
    const existing = await db('guild_members').where('player_id', playerId).first();
    if (existing) throw new Error('Ya perteneces a un gremio');

    const guild = await db('guilds').where('id', guildId).first();
    if (!guild) throw new Error('Gremio no encontrado');

    const countRow = await db('guild_members').where('guild_id', guildId).count('id as count').first();
    if (Number(countRow?.count || 0) >= MAX_MEMBERS) throw new Error('El gremio está lleno');

    await db('guild_members').insert({
      guild_id: guildId,
      player_id: playerId,
      role: 'member',
      contribution_points: 0,
      joined_at: new Date().toISOString(),
    });

    return { success: true, guildName: guild.name };
  },

  async getGuildBonuses(playerId) {
    const membership = await db('guild_members').where('player_id', playerId).first();
    if (!membership) return {};

    const guild = await db('guilds').where('id', membership.guild_id).first();
    if (!guild) return {};

    const level = this.getLevelFromXP(guild.xp);
    return GUILD_LEVEL_BONUSES[level].bonus;
  },

  async awardGuildXP(playerId, amount) {
    const membership = await db('guild_members').where('player_id', playerId).first();
    if (!membership) return;
    await db('guilds').where('id', membership.guild_id).increment('xp', amount);
  },

  async promoteOfficer(leaderId, targetPlayerId) {
    const actorMembership = await db('guild_members').where('player_id', leaderId).first();
    if (!actorMembership || actorMembership.role !== 'leader') {
      throw new Error('Solo el líder puede promover oficiales');
    }

    const targetMembership = await db('guild_members')
      .where({ player_id: targetPlayerId, guild_id: actorMembership.guild_id })
      .first();
    if (!targetMembership) throw new Error('El jugador no está en tu gremio');

    await db('guild_members').where('id', targetMembership.id).update({ role: 'officer' });
    return { success: true };
  },

  async kickMember(actorId, targetPlayerId) {
    const actorMembership = await db('guild_members').where('player_id', actorId).first();
    if (!actorMembership) throw new Error('No perteneces a ningún gremio');
    if (actorMembership.role !== 'leader' && actorMembership.role !== 'officer') {
      throw new Error('Solo el líder y oficiales pueden expulsar miembros');
    }

    const targetMembership = await db('guild_members')
      .where({ player_id: targetPlayerId, guild_id: actorMembership.guild_id })
      .first();
    if (!targetMembership) throw new Error('El jugador no está en tu gremio');
    if (targetMembership.role === 'leader') throw new Error('No podés expulsar al líder');
    if (actorMembership.role === 'officer' && targetMembership.role === 'officer') {
      throw new Error('Los oficiales no pueden expulsar a otros oficiales');
    }

    await db('guild_members').where('id', targetMembership.id).delete();
    return { success: true };
  },
};

module.exports = guildService;
