const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DB_PATH = path.resolve(__dirname, '../../data/kingdoms.db');

// Modo test: DB 100% en memoria — nunca lee ni escribe data/kingdoms.db
const IS_TEST = process.env.NODE_ENV === 'test';

let sqlDb = null;
let SQL = null;

// ============================================
// Mini query builder compatible con la API de knex
// ============================================

// Whitelist de caracteres seguros para nombres de columna/tabla
function sanitizeIdentifier(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Identificador SQL no válido: ${name}`);
  }
  return name;
}

// Whitelist de operadores SQL permitidos en where()
const ALLOWED_OPERATORS = new Set(['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT']);

function sanitizeOperator(op) {
  const upper = op.toUpperCase().trim();
  if (!ALLOWED_OPERATORS.has(upper)) {
    throw new Error(`Operador SQL no permitido: ${op}`);
  }
  return upper;
}

// Valida expresiones de agregación (COUNT/SUM) para prevenir inyección
function _validateAggregateExpr(expr) {
  if (typeof expr !== 'string') throw new Error('Expresión de agregación inválida');
  // Permite: "* as count", "column as alias", "*", "column_name"
  if (!/^[a-zA-Z_*]+(\s+as\s+[a-zA-Z_]+)?$/i.test(expr)) {
    throw new Error(`Expresión de agregación no válida: ${expr}`);
  }
}

class QueryBuilder {
  constructor(tableName) {
    this._table = sanitizeIdentifier(tableName);
    this._wheres = [];
    this._whereParams = [];
    this._selects = null;
    this._orderBys = [];
    this._limitVal = null;
    this._isFirst = false;
  }

  where(...args) {
    if (args.length === 1 && typeof args[0] === 'object') {
      // .where({ key: val, key2: val2 })
      for (const [key, val] of Object.entries(args[0])) {
        this._wheres.push(`"${sanitizeIdentifier(key)}" = ?`);
        this._whereParams.push(val);
      }
    } else if (args.length === 2) {
      // .where('key', val)
      this._wheres.push(`"${sanitizeIdentifier(args[0])}" = ?`);
      this._whereParams.push(args[1]);
    } else if (args.length === 3) {
      // .where('key', '<=', val)
      // La validación del operador se difiere a la ejecución (estilo Knex):
      // así `await expect(qb).rejects.toThrow()` funciona en vez de explotar sync.
      try {
        this._wheres.push(`"${sanitizeIdentifier(args[0])}" ${sanitizeOperator(args[1])} ?`);
        this._whereParams.push(args[2]);
      } catch (err) {
        this._deferredError = this._deferredError || err;
      }
    }
    return this;
  }

  orWhere(...args) {
    if (args.length === 1 && typeof args[0] === 'object') {
      for (const [key, val] of Object.entries(args[0])) {
        this._wheres.push(`OR "${sanitizeIdentifier(key)}" = ?`);
        this._whereParams.push(val);
      }
    } else if (args.length === 2) {
      this._wheres.push(`OR "${sanitizeIdentifier(args[0])}" = ?`);
      this._whereParams.push(args[1]);
    }
    return this;
  }

  whereIn(col, values) {
    const safeName = sanitizeIdentifier(col);
    if (values.length === 0) {
      this._wheres.push('0 = 1'); // always false
    } else {
      const placeholders = values.map(() => '?').join(', ');
      this._wheres.push(`"${safeName}" IN (${placeholders})`);
      this._whereParams.push(...values);
    }
    return this;
  }

  whereNotNull(col) {
    this._wheres.push(`"${sanitizeIdentifier(col)}" IS NOT NULL`);
    return this;
  }

  whereNull(col) {
    this._wheres.push(`"${sanitizeIdentifier(col)}" IS NULL`);
    return this;
  }

  whereNot(col, val) {
    // Equivalent to .where(col, '!=', val) — small ergonomic helper used by
    // routes that filter out the requesting player's own row.
    this._wheres.push(`"${sanitizeIdentifier(col)}" != ?`);
    this._whereParams.push(val);
    return this;
  }

  // No-op de compatibilidad Knex: SELECT ... FOR UPDATE no existe en SQLite
  // (la DB entera es single-writer in-process, el lock por fila no aplica).
  forUpdate() {
    return this;
  }

  orWhereIn(col, values) {
    const safeName = sanitizeIdentifier(col);
    if (values.length === 0) {
      this._wheres.push('OR 0 = 1');
    } else {
      const placeholders = values.map(() => '?').join(', ');
      this._wheres.push(`OR "${safeName}" IN (${placeholders})`);
      this._whereParams.push(...values);
    }
    return this;
  }

  groupBy(...cols) {
    this._groupBys = cols.map(c => `"${sanitizeIdentifier(c)}"`);
    return this;
  }

  select(...cols) {
    this._selects = cols;
    return this;
  }

  orderBy(col, dir = 'asc') {
    const safeDir = dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    this._orderBys.push(`"${sanitizeIdentifier(col)}" ${safeDir}`);
    return this;
  }

  limit(n) {
    this._limitVal = n;
    return this;
  }

  first() {
    this._isFirst = true;
    return this;
  }

  _buildWhereClause() {
    // Error diferido de where() (p. ej. operador SQL no permitido) — explota
    // recién al ejecutar la query, nunca silenciosamente.
    if (this._deferredError) throw this._deferredError;
    if (this._wheres.length === 0) return { sql: '', params: [] };

    let clause = ' WHERE ';
    const parts = [];
    for (const w of this._wheres) {
      if (w.startsWith('OR ')) {
        if (parts.length === 0) {
          parts.push(w.slice(3)); // remove OR prefix if first
        } else {
          parts.push(w);
        }
      } else {
        if (parts.length > 0 && !parts[parts.length - 1].startsWith('OR ')) {
          parts.push('AND ' + w);
        } else {
          parts.push(w);
        }
      }
    }
    clause += parts.join(' ');
    return { sql: clause, params: [...this._whereParams] };
  }

  // SELECT
  async then(resolve, reject) {
    try {
      const selectCols = this._selects ? this._selects.map(c => c.includes('(') ? c : `"${c}"`).join(', ') : '*';
      const { sql: whereSQL, params } = this._buildWhereClause();
      let sql = `SELECT ${selectCols} FROM "${this._table}"${whereSQL}`;

      if (this._groupBys && this._groupBys.length > 0) {
        sql += ' GROUP BY ' + this._groupBys.join(', ');
      }
      if (this._orderBys.length > 0) {
        sql += ' ORDER BY ' + this._orderBys.join(', ');
      }
      if (this._limitVal != null) {
        sql += ' LIMIT ?';
        params.push(this._limitVal);
      }
      if (this._isFirst) {
        sql += ' LIMIT 1';
      }

      const results = dbAll(sql, params);
      resolve(this._isFirst ? (results[0] || undefined) : results);
    } catch (err) {
      if (reject) reject(err);
      else throw err;
    }
  }

  // INSERT — by default resolves to [lastInsertRowId].
  // Chaining .returning(col) wraps the result as [{ [col]: lastInsertRowId }]
  // so Knex-style call sites (`const [{ id }] = await db.insert(...).returning('id')`)
  // keep working. Acepta objeto único o array de objetos (bulk insert multi-fila;
  // las columnas se toman de la primera fila, faltantes → NULL).
  insert(data) {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) throw new Error('insert() requiere al menos una fila');
    const cols = Object.keys(rows[0]).map(c => sanitizeIdentifier(c));
    const vals = [];
    for (const row of rows) {
      for (const c of cols) {
        vals.push(row[c] === undefined ? null : row[c]);
      }
    }
    const rowPlaceholders = `(${cols.map(() => '?').join(', ')})`;
    const placeholders = rows.map(() => rowPlaceholders).join(', ');
    const sql = `INSERT INTO "${this._table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders}`;
    let returningCol = null;
    const run = () => {
      const result = dbRun(sql, vals);
      return returningCol === null ? [result.lastId] : [{ [returningCol]: result.lastId }];
    };
    const thenable = {
      returning(col) { returningCol = sanitizeIdentifier(col); return thenable; },
      then(resolve, reject) {
        try { return Promise.resolve(run()).then(resolve, reject); }
        catch (e) { return reject ? reject(e) : Promise.reject(e); }
      },
      catch(reject) { return this.then(undefined, reject); },
    };
    return thenable;
  }

  // UPDATE - returns count of affected rows
  async update(data) {
    const setClauses = [];
    const setParams = [];
    for (const [key, value] of Object.entries(data)) {
      const col = sanitizeIdentifier(key);
      if (value instanceof Raw) {
        // Fragmento raw estilo Knex: SET "col" = col + ? (params posicionales)
        setClauses.push(`"${col}" = ${value.sql}`);
        setParams.push(...value.params);
      } else {
        setClauses.push(`"${col}" = ?`);
        setParams.push(value);
      }
    }
    const { sql: whereSQL, params: whereParams } = this._buildWhereClause();
    const sql = `UPDATE "${this._table}" SET ${setClauses.join(', ')}${whereSQL}`;
    return dbRun(sql, [...setParams, ...whereParams]).count;
  }

  // DELETE
  async delete() {
    const { sql: whereSQL, params } = this._buildWhereClause();
    const sql = `DELETE FROM "${this._table}"${whereSQL}`;
    return dbRun(sql, params).count;
  }

  // del() alias for delete()
  async del() {
    return this.delete();
  }

  // INCREMENT
  async increment(col, amount = 1) {
    const safeName = sanitizeIdentifier(col);
    const { sql: whereSQL, params } = this._buildWhereClause();
    const sql = `UPDATE "${this._table}" SET "${safeName}" = "${safeName}" + ?${whereSQL}`;
    return dbRun(sql, [amount, ...params]).count;
  }

  // DECREMENT
  async decrement(col, amount = 1) {
    const safeName = sanitizeIdentifier(col);
    const { sql: whereSQL, params } = this._buildWhereClause();
    const sql = `UPDATE "${this._table}" SET "${safeName}" = "${safeName}" - ?${whereSQL}`;
    return dbRun(sql, [amount, ...params]).count;
  }

  // ATOMIC DECREMENT - decrements only if value >= amount, returns affected rows
  // Prevents race conditions in check-then-deduct patterns
  async decrementIfEnough(col, amount = 1) {
    const safeName = sanitizeIdentifier(col);
    const { sql: whereSQL, params } = this._buildWhereClause();
    // Add condition that column must have enough
    const extraWhere = whereSQL ? ` AND "${safeName}" >= ?` : ` WHERE "${safeName}" >= ?`;
    const sql = `UPDATE "${this._table}" SET "${safeName}" = "${safeName}" - ?${whereSQL}${extraWhere}`;
    return dbRun(sql, [amount, ...params, amount]).count;
  }

  // COUNT - e.g. .count('* as count')
  async count(expr = '* as count') {
    _validateAggregateExpr(expr);
    const match = expr.match(/^(.+?)\s+as\s+(.+)$/i);
    const countExpr = match ? `COUNT(${match[1]})` : `COUNT(${expr})`;
    const alias = match ? sanitizeIdentifier(match ? match[2] : 'count') : 'count';
    const { sql: whereSQL, params } = this._buildWhereClause();
    const sql = `SELECT ${countExpr} as "${alias}" FROM "${this._table}"${whereSQL}`;
    return dbAll(sql, params);
  }

  // SUM - e.g. .sum('quantity as total')
  sum(expr) {
    _validateAggregateExpr(expr);
    const match = expr.match(/^(.+?)\s+as\s+(.+)$/i);
    const sumExpr = match ? `SUM(${match[1]})` : `SUM(${expr})`;
    const alias = match ? sanitizeIdentifier(match[2]) : 'sum';
    const { sql: whereSQL, params } = this._buildWhereClause();

    this._customSQL = `SELECT ${sumExpr} as "${alias}" FROM "${this._table}"${whereSQL}`;
    this._customParams = params;
    return this;
  }
}

// ============================================
// Raw SQL helpers
// ============================================

// Knex-style lazy raw. Ejecuta al hacer await, o se inserta como fragmento SQL
// cuando se pasa como valor a .update({ col: db.raw('col + ?', [n]) }).
// El resultado se memoiza: await repetido NO re-ejecuta la query.
class Raw {
  constructor(sql, params = []) {
    this.sql = sql;
    this.params = params;
    this._ran = false;
    this._result = undefined;
  }

  _exec() {
    if (!this._ran) {
      this._result = dbRun(this.sql, this.params);
      this._ran = true;
    }
    return this._result;
  }

  then(onFulfilled, onRejected) {
    let result;
    try {
      result = this._exec();
    } catch (err) {
      return Promise.reject(err).then(onFulfilled, onRejected);
    }
    return Promise.resolve(result).then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }
}

function dbRun(sql, params = []) {
  sqlDb.run(sql, params);
  // Capture changes() and last_insert_rowid() BEFORE saveToDisk,
  // because export() resets these counters
  const stmt = sqlDb.prepare('SELECT changes() as count, last_insert_rowid() as lastId');
  stmt.step();
  const result = stmt.getAsObject();
  stmt.free();
  saveToDisk();
  return result;
}

function dbAll(sql, params = []) {
  const stmt = sqlDb.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Debounced save — batches writes to avoid blocking on every DB mutation
let _saveTimer = null;
let _saving = false;
const SAVE_DEBOUNCE_MS = 2000; // flush at most every 2 seconds

function saveToDisk() {
  if (!sqlDb || IS_TEST) return;

  // If a debounced save is already scheduled, let it handle this write too
  if (_saveTimer) return;

  _saveTimer = setTimeout(async () => {
    _saveTimer = null;
    if (_saving || !sqlDb) return;
    _saving = true;
    try {
      const data = sqlDb.export();
      const buffer = Buffer.from(data);
      await fs.promises.writeFile(DB_PATH, buffer);
    } catch (err) {
      console.error('Error saving database to disk:', err);
    } finally {
      _saving = false;
    }
  }, SAVE_DEBOUNCE_MS);
}

// Flush synchronously on shutdown so no data is lost
function saveToDiskSync() {
  if (IS_TEST) return;
  if (sqlDb) {
    const data = sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Ensure data is flushed before process exits
process.on('exit', saveToDiskSync);
process.on('SIGINT', () => { saveToDiskSync(); process.exit(0); });
process.on('SIGTERM', () => { saveToDiskSync(); process.exit(0); });

// ============================================
// The main db function (knex-like interface)
// ============================================

function db(tableName) {
  return new QueryBuilder(tableName);
}

// Attach special properties
db.fn = {
  now() {
    return new Date().toISOString();
  },
};

// Raw SQL perezoso (estilo Knex): `await db.raw(sql, params)` → { count, lastId }.
// Como valor en .update({ col: db.raw('col + ?', [n]) }) se inserta como fragmento.
// ⚠️ Sin await en posición de statement NO se ejecuta.
db.raw = function (sql, params = []) {
  return new Raw(sql, params);
};

// Transacción estilo Knex sobre sql.js (single-connection, in-process).
// trx === db: todo query dentro del callback participa del BEGIN/COMMIT.
// Reentrante: si ya hay transacción activa, el callback corre dentro de ella
// (SQLite no soporta BEGIN anidado). ⚠️ No intercalar awaits de I/O externo
// dentro del callback — otros requests compartirían la transacción abierta.
let _inTransaction = false;
db.transaction = async function (fn) {
  if (_inTransaction) return fn(db);

  dbRun('BEGIN');
  _inTransaction = true;
  try {
    const result = await fn(db);
    dbRun('COMMIT');
    return result;
  } catch (err) {
    try { dbRun('ROLLBACK'); } catch { /* ya revertida */ }
    throw err;
  } finally {
    _inTransaction = false;
  }
};

// Migration support
const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

function ensureMigrationsTable() {
  dbRun(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    migrated_at TEXT DEFAULT (datetime('now'))
  )`);
}

db.migrate = {
  async latest({ directory } = {}) {
    const dir = directory || DEFAULT_MIGRATIONS_DIR;
    const migrationFiles = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .sort();

    ensureMigrationsTable();

    const completed = dbAll('SELECT name FROM _migrations');
    const completedNames = new Set(completed.map(r => r.name));

    for (const file of migrationFiles) {
      if (completedNames.has(file)) continue;

      const migration = require(path.join(dir, file));
      await migration.up(db);

      dbRun('INSERT INTO _migrations (name) VALUES (?)', [file]);
      if (!IS_TEST) console.log(`[Migration] ${file} applied`);
    }
  },

  // Deshace migraciones aplicadas en orden inverso vía down().
  // { all: true } → todas; default → solo la última.
  async rollback({ directory, all = false } = {}) {
    const dir = directory || DEFAULT_MIGRATIONS_DIR;
    ensureMigrationsTable();

    const applied = dbAll('SELECT name FROM _migrations ORDER BY name DESC');
    const toRevert = all ? applied : applied.slice(0, 1);

    for (const { name } of toRevert) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) {
        const migration = require(file);
        if (typeof migration.down === 'function') {
          await migration.down(db);
        }
      }
      dbRun('DELETE FROM _migrations WHERE name = ?', [name]);
      if (!IS_TEST) console.log(`[Migration] ${name} rolled back`);
    }
  },
};

// Schema builder for migrations
db.schema = {
  _chain: [],

  createTable(tableName, callback) {
    const table = new TableBuilder(tableName);
    callback(table);
    const sql = table.toSQL();
    dbRun(sql);
    return db.schema;
  },

  dropTableIfExists(tableName) {
    sanitizeIdentifier(tableName);
    dbRun(`DROP TABLE IF EXISTS "${tableName}"`);
    return db.schema;
  },
};

// ============================================
// Table builder for migrations (schema)
// ============================================

class TableBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this.columns = [];
    this.constraints = [];
  }

  _col(name, type) {
    const col = new ColumnBuilder(name, type, this);
    this.columns.push(col);
    return col;
  }

  increments(name) { return this._col(name, 'INTEGER PRIMARY KEY AUTOINCREMENT'); }
  bigInteger(name) { return this._col(name, 'INTEGER'); }
  integer(name) { return this._col(name, 'INTEGER'); }
  string(name) { return this._col(name, 'TEXT'); }
  text(name) { return this._col(name, 'TEXT'); }
  boolean(name) { return this._col(name, 'INTEGER'); }
  json(name) { return this._col(name, 'TEXT'); }
  timestamp(name) { return this._col(name, 'TEXT'); }

  unique(cols) {
    if (Array.isArray(cols)) {
      this.constraints.push(`UNIQUE (${cols.map(c => `"${c}"`).join(', ')})`);
    }
    return this;
  }

  toSQL() {
    const colDefs = this.columns.map(c => c.toSQL());
    const allDefs = [...colDefs, ...this.constraints];
    return `CREATE TABLE IF NOT EXISTS "${this.tableName}" (${allDefs.join(', ')})`;
  }
}

class ColumnBuilder {
  constructor(name, type, table) {
    this.name = name;
    this.type = type;
    this.table = table;
    this._nullable = true;
    this._default = undefined;
    this._primaryKey = type.includes('PRIMARY KEY');
    this._notNull = false;
    this._unique = false;
    this._references = null;
  }

  primary() {
    this._primaryKey = true;
    return this;
  }

  notNullable() {
    this._notNull = true;
    return this;
  }

  nullable() {
    this._nullable = true;
    return this;
  }

  defaultTo(val) {
    this._default = val;
    return this;
  }

  unique() {
    this._unique = true;
    return this;
  }

  references(col) {
    this._references = { column: col };
    return this;
  }

  inTable(table) {
    if (this._references) {
      this._references.table = table;
    }
    return this;
  }

  onDelete(action) {
    if (this._references) {
      this._references.onDelete = action;
    }
    return this;
  }

  toSQL() {
    let sql = `"${this.name}" ${this.type}`;

    // Don't add extra constraints if it's already PRIMARY KEY
    if (this._primaryKey && !this.type.includes('PRIMARY KEY')) {
      sql += ' PRIMARY KEY';
    }

    if (this._notNull && !this.type.includes('PRIMARY KEY')) {
      sql += ' NOT NULL';
    }

    if (this._unique) {
      sql += ' UNIQUE';
    }

    if (this._default !== undefined) {
      if (this._default === null) {
        // skip, SQLite defaults to null
      } else if (typeof this._default === 'string') {
        sql += ` DEFAULT '${this._default}'`;
      } else if (typeof this._default === 'boolean') {
        sql += ` DEFAULT ${this._default ? 1 : 0}`;
      } else if (typeof this._default === 'object' && this._default !== null) {
        // knex.fn.now() returns an ISO string
        sql += ` DEFAULT (datetime('now'))`;
      } else {
        sql += ` DEFAULT ${this._default}`;
      }
    }

    if (this._references) {
      sql += ` REFERENCES "${this._references.table}"("${this._references.column}")`;
      if (this._references.onDelete) {
        sql += ` ON DELETE ${this._references.onDelete}`;
      }
    }

    return sql;
  }
}

// ============================================
// Initialization
// ============================================

async function initDatabase() {
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs();

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!IS_TEST && fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    // Fresca en memoria (siempre en modo test)
    sqlDb = new SQL.Database();
  }

  // Enable foreign keys
  sqlDb.run('PRAGMA foreign_keys = ON');

  if (!IS_TEST) console.log('Base de datos SQLite (sql.js) inicializada');
  return db;
}

// Override QueryBuilder.then for sum() with first()
const origThen = QueryBuilder.prototype.then;
QueryBuilder.prototype.then = function (resolve, reject) {
  if (this._customSQL) {
    try {
      const results = dbAll(this._customSQL, this._customParams || []);
      resolve(this._isFirst ? (results[0] || undefined) : results);
    } catch (err) {
      if (reject) reject(err);
    }
    return;
  }
  return origThen.call(this, resolve, reject);
};

db.initDatabase = initDatabase;

module.exports = db;
