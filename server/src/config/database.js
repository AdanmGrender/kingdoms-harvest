/**
 * Database — Knex client configured for PostgreSQL.
 *
 * Selects database by NODE_ENV:
 *   test        → DB_NAME_TEST  (default: kingdoms_test)
 *   production  → DATABASE_URL or individual DB_* vars (default: kingdoms_dev)
 *   development → same as production
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const knexLib = require('knex');
const pg = require('pg');
// pg returns bigint (OID 20) and int8 COUNT results as strings by default.
// Telegram IDs fit safely within Number.MAX_SAFE_INTEGER, so parse as number.
pg.types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

const isTest = process.env.NODE_ENV === 'test';

const connection = process.env.DATABASE_URL && !isTest
  ? { connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     +(process.env.DB_PORT   || 5432),
      user:     process.env.DB_USER     || 'kingdoms',
      password: process.env.DB_PASSWORD || 'kingdoms_dev',
      database: isTest
        ? (process.env.DB_NAME_TEST || 'kingdoms_test')
        : (process.env.DB_NAME     || 'kingdoms_dev'),
    };

const db = knexLib({
  client: 'pg',
  connection,
  pool: { min: 2, max: 10 },
  migrations: {
    directory: path.join(__dirname, '../../migrations'),
    extension: 'js',
  },
  log: {
    warn  (m) { if (!isTest) console.warn('[DB]', m); },
    error (m) { console.error('[DB]', m); },
    debug () {},
  },
});

// ── Custom query builder extension ───────────────────────────────────────────
// Atomic conditional decrement: only updates if column >= amount.
// Returns the row count affected (0 = insufficient balance, 1 = success).
const { QueryBuilder } = require('knex');
QueryBuilder.extend('decrementIfEnough', function (column, amount) {
  this.where(column, '>=', amount);
  return this.decrement(column, amount);
});

// ── Lifecycle helpers (used by server boot & test setup) ──────────────────
db.initDatabase = async function () {
  await db.raw('SELECT 1');
  console.log('Base de datos PostgreSQL (Knex) conectada');
};

module.exports = db;
