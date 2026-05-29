exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "guilds" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL UNIQUE,
    "tag" TEXT NOT NULL UNIQUE,
    "description" TEXT DEFAULT '',
    "leader_id" INTEGER NOT NULL,
    "level" INTEGER DEFAULT 1,
    "xp" INTEGER DEFAULT 0,
    "treasury_gold" INTEGER DEFAULT 0,
    "banner_color" TEXT DEFAULT '#e94560',
    "created_at" TEXT DEFAULT (datetime('now'))
  )`);

  await db.raw(`CREATE TABLE IF NOT EXISTS "guild_members" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "guild_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "role" TEXT DEFAULT 'member',
    "contribution_points" INTEGER DEFAULT 0,
    "joined_at" TEXT DEFAULT (datetime('now')),
    UNIQUE ("player_id")
  )`);

  await db.raw(`CREATE TABLE IF NOT EXISTS "guild_invites" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "guild_id" INTEGER NOT NULL,
    "invited_player_id" INTEGER NOT NULL,
    "invited_by" INTEGER NOT NULL,
    "created_at" TEXT DEFAULT (datetime('now')),
    "expires_at" TEXT NOT NULL,
    UNIQUE ("guild_id", "invited_player_id")
  )`);

  await db.raw('CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON "guild_members" ("guild_id")');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_guild_members_player ON "guild_members" ("player_id")');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_guild_invites_player ON "guild_invites" ("invited_player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP TABLE IF EXISTS "guild_invites"');
  await db.raw('DROP TABLE IF EXISTS "guild_members"');
  await db.raw('DROP TABLE IF EXISTS "guilds"');
};
