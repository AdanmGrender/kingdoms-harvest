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
    // Fail closed: sin condición reconocida (o sin `manage` en absoluto) el
    // nodo no se limpia — evita otorgar recompensas KH ante un tipo de
    // condición desconocido o mal configurado.
    return false;
  },

  async _buildCombatState(playerId, node) {
    let squad = [];
    try { squad = await heroService().getSquad(playerId); }
    catch (err) { console.error('[Campaign] getSquad falló; usando guarnición:', err.message); squad = []; }
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
    // Abandonar cualquier run 'active' previo del mismo jugador+nodo antes de
    // crear uno nuevo — evita runs huérfanos activos en paralelo (p.ej. tras
    // recargar la app a mitad de combate y volver a entrar al nodo).
    await db('campaign_runs')
      .where({ player_id: playerId, node_id: nodeId, status: 'active' })
      .update({ status: 'abandoned' });

    const state = await this._buildCombatState(playerId, node);
    const [{ id: runId }] = await db('campaign_runs').insert({
      player_id: playerId, node_id: nodeId, status: 'active',
      state: JSON.stringify(state), created_at: new Date().toISOString(),
    }).returning('id');
    return { kind: 'combat', runId, node: { id: node.id, name: node.name, type: node.type }, state };
  },

  async resolveStep(playerId, runId, action) {
    const run = await db('campaign_runs').where({ id: runId, player_id: playerId }).first();
    if (!run) throw new Error('Run inexistente');
    if (run.status !== 'active') throw new Error('Este combate ya terminó');

    const state = JSON.parse(run.state);
    const node = nodeById(run.node_id);
    const out = simulateRound(state, action); // puede lanzar (energía insuficiente)

    await db('campaign_runs').where('id', runId).update({ state: JSON.stringify(out.state) });

    let unlocked = [];
    if (out.result) {
      // claim del run + _clearNode en UNA transacción (db.transaction es
      // reentrante: la transacción interna de _clearNode participa en ésta).
      // Si el award/unlock falla tras el claim, el rollback también revierte
      // el claim del run (vuelve a 'active') — un retry recomputa la ronda
      // terminal y reintenta, sin combate perdido.
      await db.transaction(async () => {
        // claim atómico: sólo el primero que cierra el run otorga
        const claimed = await db('campaign_runs')
          .where({ id: runId, status: 'active' }).update({ status: out.result });
        if (claimed && out.result === 'victory') {
          const r = await this._clearNode(playerId, node);
          unlocked = r.unlocked;
        }
      });
    }
    const roundLog = out.state.log[out.state.log.length - 1] || null;
    return { state: out.state, roundLog, result: out.result, unlocked };
  },
};

module.exports = campaignService;
