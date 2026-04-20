/**
 * Migration 004: Add indexes on frequently-queried player_id columns.
 * These improve query performance significantly at 1000+ players.
 * Uses IF NOT EXISTS so safe to run multiple times.
 */

exports.up = function (db) {
  db.raw('CREATE INDEX IF NOT EXISTS idx_player_resources_player ON player_resources (player_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_player_buildings_player ON player_buildings (player_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_farm_plots_player ON farm_plots (player_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_player_animals_player ON player_animals (player_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_player_troops_player ON player_troops (player_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_player_daily_tasks_player ON player_daily_tasks (player_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_battles_attacker ON battles (attacker_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_battles_defender ON battles (defender_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_missions_player_status ON missions (player_id, status)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_social_task_completions_player ON social_task_completions (player_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_player_tokens_balance ON player_tokens (total_earned DESC)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_player ON withdrawal_requests (player_id)');
};

exports.down = function (db) {
  db.raw('DROP INDEX IF EXISTS idx_player_resources_player');
  db.raw('DROP INDEX IF EXISTS idx_player_buildings_player');
  db.raw('DROP INDEX IF EXISTS idx_farm_plots_player');
  db.raw('DROP INDEX IF EXISTS idx_player_animals_player');
  db.raw('DROP INDEX IF EXISTS idx_player_troops_player');
  db.raw('DROP INDEX IF EXISTS idx_player_daily_tasks_player');
  db.raw('DROP INDEX IF EXISTS idx_battles_attacker');
  db.raw('DROP INDEX IF EXISTS idx_battles_defender');
  db.raw('DROP INDEX IF EXISTS idx_missions_player_status');
  db.raw('DROP INDEX IF EXISTS idx_social_task_completions_player');
  db.raw('DROP INDEX IF EXISTS idx_player_tokens_balance');
  db.raw('DROP INDEX IF EXISTS idx_withdrawal_requests_player');
};
