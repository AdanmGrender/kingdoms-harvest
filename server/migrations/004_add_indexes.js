/**
 * Migration 004: Add indexes on frequently-queried player_id columns.
 * These improve query performance significantly at 1000+ players.
 * Uses IF NOT EXISTS so safe to run multiple times.
 */

exports.up = async function (db) {
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_resources_player ON player_resources (player_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_buildings_player ON player_buildings (player_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_farm_plots_player ON farm_plots (player_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_animals_player ON player_animals (player_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_troops_player ON player_troops (player_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_daily_tasks_player ON player_daily_tasks (player_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_battles_attacker ON battles (attacker_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_battles_defender ON battles (defender_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_missions_player_status ON missions (player_id, status)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_social_task_completions_player ON social_task_completions (player_id)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_tokens_balance ON player_tokens (total_earned DESC)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_player ON withdrawal_requests (player_id)');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_player_resources_player');
  await db.raw('DROP INDEX IF EXISTS idx_player_buildings_player');
  await db.raw('DROP INDEX IF EXISTS idx_farm_plots_player');
  await db.raw('DROP INDEX IF EXISTS idx_player_animals_player');
  await db.raw('DROP INDEX IF EXISTS idx_player_troops_player');
  await db.raw('DROP INDEX IF EXISTS idx_player_daily_tasks_player');
  await db.raw('DROP INDEX IF EXISTS idx_battles_attacker');
  await db.raw('DROP INDEX IF EXISTS idx_battles_defender');
  await db.raw('DROP INDEX IF EXISTS idx_missions_player_status');
  await db.raw('DROP INDEX IF EXISTS idx_social_task_completions_player');
  await db.raw('DROP INDEX IF EXISTS idx_player_tokens_balance');
  await db.raw('DROP INDEX IF EXISTS idx_withdrawal_requests_player');
};
