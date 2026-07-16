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

  async _checkManage(playerId, node) {
    const c = node.manage;
    if (c && c.type === 'building_level') {
      const row = await db('player_buildings')
        .where('player_id', playerId).where('level', '>=', c.min).first();
      return !!row;
    }
    return true;
  },

  async _buildCombatState(playerId, node) {
    let squad = [];
    try { squad = await heroService().getSquad(playerId); } catch { squad = []; }
    let heroes = (Array.isArray(squad) ? squad : [])
      .filter((h) => !h.recovering)
      .map((h) => ({
        slot: h.slot, heroId: h.heroId, class: h.class, name: h.name,
        atk: h.stats.atk, hp: h.stats.hp, maxHp: h.stats.hp,
        energy: 0, energyMax: 100,
        skill: HERO_SKILLS[h.class] || HERO_SKILLS.warrior, alive: true,
      }));
    if (heroes.length === 0) {
      heroes = [{ slot: 1, heroId: null, class: 'warrior', name: 'Guarnición',
        atk: 30, hp: 200, maxHp: 200, energy: 0, energyMax: 100,
        skill: HERO_SKILLS.warrior, alive: true }];
    }
    return {
      round: 0, maxRounds: node.maxRounds, isBoss: !!node.isBoss, shield: 0,
      heroes, enemy: { hp: node.enemy.hp, maxHp: node.enemy.hp, dps: node.enemy.dps }, log: [],
    };
  },

  async enterNode(playerId, nodeId) {
    await this._ensureSeeded(playerId);
    const node = nodeById(nodeId);
    if (!node) throw new Error('Nodo inexistente');
    const prog = await db('player_campaign_progress')
      .where({ player_id: playerId, node_id: nodeId }).first();
    if (!prog || prog.status === 'locked') throw new Error('Nodo bloqueado');

    if (node.type === 'collect') {
      const r = await this._clearNode(playerId, node);
      return { kind: 'cleared', node: { id: node.id, name: node.name, type: node.type }, unlocked: r.unlocked };
    }
    if (node.type === 'manage') {
      const ok = await this._checkManage(playerId, node);
      if (!ok) return { kind: 'blocked', node: { id: node.id, name: node.name, type: node.type },
        hint: node.manage.hint, panel: node.manage.panel };
      const r = await this._clearNode(playerId, node);
      return { kind: 'cleared', node: { id: node.id, name: node.name, type: node.type }, unlocked: r.unlocked };
    }

    // combat / wave / boss
    const state = await this._buildCombatState(playerId, node);
    const [{ id: runId }] = await db('campaign_runs').insert({
      player_id: playerId, node_id: nodeId, status: 'active',
      state: JSON.stringify(state), created_at: new Date().toISOString(),
    }).returning('id');
    return { kind: 'combat', runId, node: { id: node.id, name: node.name, type: node.type }, state };
  },
};

module.exports = campaignService;
