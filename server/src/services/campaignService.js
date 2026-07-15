const db = require('../config/database');
const { CAMPAIGN, HERO_SKILLS } = require('../../../shared/gameConfig');
const { simulateRound } = require('./campaignSim');

// Lazy requires (evitan ciclos con token/hero/daily services)
let _token, _hero, _daily, _player;
const tokenService = () => (_token ||= require('./tokenService'));
const heroService  = () => (_hero  ||= require('./heroService'));
const dailyService = () => (_daily ||= require('./dailyTaskService'));
const playerService = () => (_player ||= require('./playerService'));

const nodeById = (id) => CAMPAIGN.find((n) => n.id === id);
const isCombat = (n) => ['combat', 'wave', 'boss'].includes(n.type);

const campaignService = {
  async _ensureSeeded(playerId) {
    const any = await db('player_campaign_progress').where('player_id', playerId).first();
    if (any) return;
    await db('player_campaign_progress').insert({
      player_id: playerId, node_id: CAMPAIGN[0].id, status: 'available',
    });
  },

  async getMap(playerId) {
    await this._ensureSeeded(playerId);
    const rows = await db('player_campaign_progress').where('player_id', playerId);
    const statusById = new Map((Array.isArray(rows) ? rows : []).map((r) => [r.node_id, r.status]));
    return CAMPAIGN.map((n) => ({
      id: n.id, type: n.type, name: n.name, act: n.act, isBoss: !!n.isBoss,
      status: statusById.get(n.id) || 'locked', rewards: n.rewards,
    }));
  },

  // Claim atómico + recompensa (una vez) + desbloqueo de siguientes.
  // Todo el cuerpo corre en UNA transacción: si un award/unlock falla tras el
  // claim, el rollback revierte el nodo a 'available' (retry recuperable) en
  // vez de dejarlo 'cleared' con la recompensa perdida.
  async _clearNode(playerId, node) {
    return db.transaction(async () => {
      const claimed = await db('player_campaign_progress')
        .where({ player_id: playerId, node_id: node.id, status: 'available' })
        .update({ status: 'cleared', cleared_at: new Date().toISOString() });
      if (!claimed) return { alreadyCleared: true, unlocked: [] };

      if (node.rewards?.kh) {
        await tokenService().awardTokens(playerId, node.rewards.kh, 'wave_defense');
      }
      if (node.rewards?.resources) {
        for (const [rid, amt] of Object.entries(node.rewards.resources)) {
          await playerService().modifyResource(playerId, rid, amt);
        }
      }
      if (isCombat(node)) {
        try { await dailyService().trackProgress(playerId, 'battle_win', 1); } catch { /* no crítico */ }
      }

      const unlocked = [];
      for (const nextId of (node.unlocks || [])) {
        const exists = await db('player_campaign_progress').where({ player_id: playerId, node_id: nextId }).first();
        if (!exists) {
          await db('player_campaign_progress').insert({ player_id: playerId, node_id: nextId, status: 'available' });
          unlocked.push(nextId);
        }
      }
      return { alreadyCleared: false, unlocked };
    });
  },
};

module.exports = campaignService;
