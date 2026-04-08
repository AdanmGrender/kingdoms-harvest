exports.up = function (db) {
  return db.schema
    // ---- KH TOKEN BALANCE ----
    .createTable('player_tokens', (t) => {
      t.bigInteger('player_id').primary();
      t.integer('balance').defaultTo(0);
      t.integer('total_earned').defaultTo(0);
      t.integer('total_withdrawn').defaultTo(0);
      t.integer('daily_earned_today').defaultTo(0);
      t.text('daily_reset_at');
      t.text('wallet_address');
      t.text('wallet_linked_at');
    })

    // ---- REFERRALS ----
    .createTable('referrals', (t) => {
      t.increments('id');
      t.bigInteger('inviter_id').notNullable();
      t.bigInteger('referee_id').notNullable().unique();
      t.integer('bonus_paid').defaultTo(0);
      t.integer('total_commission').defaultTo(0);
      t.text('created_at');
    })

    // ---- DAILY TASK PROGRESS ----
    .createTable('player_daily_tasks', (t) => {
      t.increments('id');
      t.bigInteger('player_id').notNullable();
      t.string('task_id').notNullable();
      t.integer('progress').defaultTo(0);
      t.integer('target').notNullable();
      t.integer('completed').defaultTo(0);
      t.integer('reward_claimed').defaultTo(0);
      t.text('reset_at').notNullable();
    })

    // ---- LOGIN STREAKS ----
    .createTable('player_streaks', (t) => {
      t.bigInteger('player_id').primary();
      t.integer('current_streak').defaultTo(0);
      t.text('last_login_date');
      t.integer('longest_streak').defaultTo(0);
      t.integer('streak_bonus_claimed_today').defaultTo(0);
    })

    // ---- SOCIAL TASK COMPLETIONS ----
    .createTable('social_task_completions', (t) => {
      t.increments('id');
      t.bigInteger('player_id').notNullable();
      t.string('task_id').notNullable();
      t.integer('completed').defaultTo(0);
      t.text('completed_at');
    })

    // ---- WITHDRAWAL REQUESTS ----
    .createTable('withdrawal_requests', (t) => {
      t.increments('id');
      t.bigInteger('player_id').notNullable();
      t.integer('amount').notNullable();
      t.text('ton_amount');
      t.text('wallet_address').notNullable();
      t.string('status').defaultTo('pending');
      t.text('tx_hash');
      t.text('created_at');
      t.text('processed_at');
      t.text('admin_note');
    });
};

exports.down = function (db) {
  return db.schema
    .dropTableIfExists('withdrawal_requests')
    .dropTableIfExists('social_task_completions')
    .dropTableIfExists('player_streaks')
    .dropTableIfExists('player_daily_tasks')
    .dropTableIfExists('referrals')
    .dropTableIfExists('player_tokens');
};
