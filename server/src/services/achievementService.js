const db = require('../config/database');

let _tokenService = null;
let _playerService = null;
function getTokenService()  { if (!_tokenService)  _tokenService  = require('./tokenService');  return _tokenService; }
function getPlayerService() { if (!_playerService) _playerService = require('./playerService'); return _playerService; }

const ACHIEVEMENTS = [
  // Farmer
  { id: 'harvest_10',    category: 'farmer',   title: 'Agricultor',         icon: '🌱', desc: 'Cosecha 10 cultivos',            action: 'harvest',     target: 10,  rewardTokens: 5,  rewardResources: null },
  { id: 'harvest_50',    category: 'farmer',   title: 'Granjero',           icon: '🌾', desc: 'Cosecha 50 cultivos',            action: 'harvest',     target: 50,  rewardTokens: 15, rewardResources: { gold: 100 } },
  { id: 'harvest_200',   category: 'farmer',   title: 'Maestro Cosechador', icon: '🏆', desc: 'Cosecha 200 cultivos',           action: 'harvest',     target: 200, rewardTokens: 40, rewardResources: { gold: 500 } },
  // Warrior
  { id: 'battle_1',      category: 'warrior',  title: 'Soldado',            icon: '⚔️', desc: 'Gana tu primera batalla',        action: 'battle_win',  target: 1,   rewardTokens: 5,  rewardResources: null },
  { id: 'battle_10',     category: 'warrior',  title: 'Veterano',           icon: '🛡️', desc: 'Gana 10 batallas',               action: 'battle_win',  target: 10,  rewardTokens: 20, rewardResources: { gold: 200 } },
  { id: 'battle_50',     category: 'warrior',  title: 'Comandante',         icon: '👑', desc: 'Gana 50 batallas',               action: 'battle_win',  target: 50,  rewardTokens: 50, rewardResources: { gold: 1000 } },
  // Builder
  { id: 'build_5',       category: 'builder',  title: 'Constructor',        icon: '🏗️', desc: 'Construye 5 edificios',          action: 'build',       target: 5,   rewardTokens: 5,  rewardResources: null },
  { id: 'build_10',      category: 'builder',  title: 'Arquitecto',         icon: '🏛️', desc: 'Construye 10 edificios',         action: 'build',       target: 10,  rewardTokens: 15, rewardResources: { stone: 100 } },
  { id: 'build_20',      category: 'builder',  title: 'Gran Constructor',   icon: '🏰', desc: 'Construye 20 edificios',         action: 'build',       target: 20,  rewardTokens: 40, rewardResources: { gold: 300 } },
  // Merchant
  { id: 'sell_10',       category: 'merchant', title: 'Vendedor',           icon: '🏪', desc: 'Vende en caravana 10 veces',     action: 'sell',        target: 10,  rewardTokens: 5,  rewardResources: null },
  { id: 'sell_50',       category: 'merchant', title: 'Mercader',           icon: '💰', desc: 'Vende en caravana 50 veces',     action: 'sell',        target: 50,  rewardTokens: 20, rewardResources: { gold: 200 } },
  // Explorer
  { id: 'conquer_1',     category: 'explorer', title: 'Explorador',         icon: '🗺️', desc: 'Conquista tu primer territorio', action: 'conquer',     target: 1,   rewardTokens: 10, rewardResources: null },
  { id: 'conquer_5',     category: 'explorer', title: 'Conquistador',       icon: '🚩', desc: 'Conquista 5 territorios',        action: 'conquer',     target: 5,   rewardTokens: 25, rewardResources: { gold: 300 } },
  { id: 'conquer_10',    category: 'explorer', title: 'Señor de Tierras',   icon: '🏰', desc: 'Conquista 10 territorios',       action: 'conquer',     target: 10,  rewardTokens: 60, rewardResources: { gold: 1000, crystal: 1 } },
  // Hero
  { id: 'summon_1',      category: 'hero',     title: 'Invocador',          icon: '✨', desc: 'Invoca tu primer héroe',         action: 'summon',      target: 1,   rewardTokens: 5,  rewardResources: null },
  { id: 'summon_5',      category: 'hero',     title: 'Maestro Invocador',  icon: '🔮', desc: 'Invoca 5 héroes',                action: 'summon',      target: 5,   rewardTokens: 20, rewardResources: { gold: 200 } },
  // Market
  { id: 'market_buy_5',  category: 'market',   title: 'Comprador',          icon: '🛒', desc: 'Compra en el mercado P2P 5 veces', action: 'market_buy', target: 5,  rewardTokens: 5,  rewardResources: null },
  { id: 'market_sell_5', category: 'market',   title: 'Vendedor P2P',       icon: '🏷️', desc: 'Vende en el mercado P2P 5 veces',  action: 'market_sell',target: 5,  rewardTokens: 5,  rewardResources: null },
];

const achievementService = {
  ACHIEVEMENTS,

  async getAchievements(playerId) {
    const rows = await db('player_achievements').where('player_id', playerId);
    const rowMap = {};
    rows.forEach((r) => { rowMap[r.achievement_id] = r; });

    return ACHIEVEMENTS.map((a) => {
      const row = rowMap[a.id];
      return {
        ...a,
        progress:   row?.progress    || 0,
        unlocked:   !!(row?.unlocked_at),
        claimed:    !!(row?.claimed_at),
        unlockedAt: row?.unlocked_at || null,
        claimedAt:  row?.claimed_at  || null,
      };
    });
  },

  /**
   * Increment progress for all achievements matching the action.
   * Marks unlocked_at if progress reaches target.
   * Returns list of newly unlocked achievement objects.
   */
  async checkAndUnlock(playerId, action, count = 1) {
    const matching = ACHIEVEMENTS.filter((a) => a.action === action);
    const newlyUnlocked = [];

    for (const achievement of matching) {
      const row = await db('player_achievements')
        .where({ player_id: playerId, achievement_id: achievement.id })
        .first();

      if (row?.unlocked_at) continue; // Already unlocked — skip

      const currentProgress = row?.progress || 0;
      const newProgress = Math.min(currentProgress + count, achievement.target);
      const justUnlocked = newProgress >= achievement.target;
      const unlockedAt = justUnlocked ? new Date().toISOString() : null;

      if (!row) {
        await db('player_achievements').insert({
          player_id:      playerId,
          achievement_id: achievement.id,
          progress:       newProgress,
          unlocked_at:    unlockedAt,
          claimed_at:     null,
        });
      } else {
        await db('player_achievements')
          .where('id', row.id)
          .update({ progress: newProgress, unlocked_at: unlockedAt });
      }

      if (justUnlocked) newlyUnlocked.push(achievement);
    }

    return newlyUnlocked;
  },

  async claimReward(playerId, achievementId) {
    const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!achievement) throw new Error('Logro no encontrado');

    const row = await db('player_achievements')
      .where({ player_id: playerId, achievement_id: achievementId })
      .first();

    if (!row?.unlocked_at) throw new Error('Este logro aún no está desbloqueado');
    if (row.claimed_at)    throw new Error('La recompensa ya fue reclamada');

    if (achievement.rewardTokens > 0) {
      await getTokenService().awardTokens(playerId, achievement.rewardTokens, 'daily_task');
    }
    if (achievement.rewardResources) {
      for (const [resource, amount] of Object.entries(achievement.rewardResources)) {
        await getPlayerService().modifyResource(playerId, resource, amount);
      }
    }

    await db('player_achievements')
      .where({ player_id: playerId, achievement_id: achievementId })
      .update({ claimed_at: new Date().toISOString() });

    return {
      success:   true,
      tokens:    achievement.rewardTokens,
      resources: achievement.rewardResources,
      message:   `¡Recompensa de "${achievement.title}" reclamada! +${achievement.rewardTokens} tokens`,
    };
  },
};

module.exports = achievementService;
