const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const cluster = require('cluster');
const { Server } = require('socket.io');
const { setupWorker } = require('@socket.io/cluster-adapter');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Falla ruidoso al arrancar si falta config crítica en producción (secretos,
// bypass de auth encendido por error). Mejor no arrancar que servir inseguro.
require('./config/env').validateEnv();

// Sentry must be initialized before any other requires so auto-instrumentation works
const { initSentry, captureException, setupExpressErrorHandler } = require('./config/sentry');
initSentry();

const { getRawClient } = require('./config/redis');

// In PM2 cluster mode, NODE_APP_INSTANCE is set to '0' for the first worker.
// Only that worker runs the game tick to prevent duplicate cron execution.
const IS_PRIMARY_WORKER = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';

const db = require('./config/database');
const { initBot } = require('./bot/telegramBot');
const { startGameTick } = require('./game/gameTick');
const { initDatabase } = db;

// Rutas
const playerRoutes = require('./routes/playerRoutes');
const farmRoutes = require('./routes/farmRoutes');
const buildingRoutes = require('./routes/buildingRoutes');
const missionRoutes = require('./routes/missionRoutes');
const combatRoutes = require('./routes/combatRoutes');
const commerceRoutes = require('./routes/commerceRoutes');
const tokenRoutes = require('./routes/tokenRoutes');
const taskRoutes = require('./routes/taskRoutes');
const referralRoutes = require('./routes/referralRoutes');
const villagerRoutes = require('./routes/villagerRoutes');
const siegeRoutes = require('./routes/siegeRoutes');
const techRoutes = require('./routes/techRoutes');
// Phase 2/3/4 routes (iso-rework)
const factionRoutes = require('./routes/factionRoutes');
const territoryRoutes = require('./routes/territoryRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const allianceRoutes = require('./routes/allianceRoutes');
const eventRoutes = require('./routes/eventRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');
const warRoutes = require('./routes/warRoutes');
// Parallel features merged from WiFOf branch
const craftingRoutes = require('./routes/craftingRoutes');
const heroRoutes = require('./routes/heroRoutes');
const worldEventRoutes = require('./routes/worldEventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const marketRoutes = require('./routes/marketRoutes');
const seasonalRoutes = require('./routes/seasonalRoutes');
const prestigeRoutes = require('./routes/prestigeRoutes');
const guildRoutes = require('./routes/guildRoutes');
const campaignRoutes = require('./routes/campaignRoutes');

const app = express();
app.set('trust proxy', 1); // Necesario detrás de Nginx para que rate-limit use IP real
const server = http.createServer(app);

// Determinar orígenes permitidos. localhost solo fuera de producción — en prod
// el único origen válido es la Mini App (WEBAPP_URL).
const allowedOrigins = [
  process.env.WEBAPP_URL,
  process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : null,
].filter(Boolean);

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  // cluster-adapter enables io.emit/io.to() to reach clients on all PM2 workers
  // via Node.js IPC — no Redis required.
  adapter: cluster.isWorker ? require('@socket.io/cluster-adapter').createAdapter() : undefined,
});

// Middleware de seguridad
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://telegram.org"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
    },
  } : false,
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
}));

// Rate limiting — only on /api routes so static assets don't count toward the
// quota. Uses Redis store when available so limits are shared across all PM2
// cluster workers; falls back to in-memory when Redis is absent.
function buildRateLimiter() {
  const opts = {
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones, intentá de nuevo en un momento' },
  };
  const redisClient = getRawClient();
  if (redisClient) {
    const { RedisStore } = require('rate-limit-redis');
    opts.store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rl:',
    });
  }
  return rateLimit(opts);
}
app.use('/api', buildRateLimiter());

// Body parser con límite de tamaño
app.use(express.json({ limit: '16kb' }));

// Servir frontend en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', game: 'Kingdoms Harvest', version: '1.0.0' });
});

// API Routes
app.use('/api/player', playerRoutes);
app.use('/api/farm', farmRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/combat', combatRoutes);
app.use('/api/commerce', commerceRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/villagers', villagerRoutes);
app.use('/api/sieges', siegeRoutes);
app.use('/api/tech', techRoutes);
// Phase 2/3/4 mounts
app.use('/api/factions', factionRoutes);
app.use('/api/territories', territoryRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/alliances', allianceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/wars', warRoutes);
// Parallel features from WiFOf
app.use('/api/crafting', craftingRoutes);
app.use('/api/heroes', heroRoutes);
app.use('/api/world-events', worldEventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/seasonal', seasonalRoutes);
app.use('/api/prestige', prestigeRoutes);
app.use('/api/guilds', guildRoutes);
app.use('/api/campaign', campaignRoutes);
// Idle F2: Tormentas Disformes
app.use('/api/storms', require('./routes/stormRoutes'));
// Idle F3: Marea Disforme (defensa por oleadas)
app.use('/api/waves', require('./routes/waveRoutes'));
// Tienda: INGRESO de dinero real (Telegram Stars → Gemas). El crédito de gemas
// NO pasa por acá — ocurre en el handler successful_payment del bot.
app.use('/api/shop', require('./routes/shopRoutes'));
// Idle G1: Escala Sistema (meta-mapa de planetas)
app.use('/api/system', require('./routes/systemRoutes'));
// Idle G2: Escala Galaxia (surcar la Disformidad entre sistemas)
app.use('/api/galaxy', require('./routes/galaxyRoutes'));
// Ganchos de retención F2: Calendario de login 7 días + gemas promocionales
app.use('/api/calendar', require('./routes/calendarRoutes'));
// Ganchos de retención F4: Pase de temporada (20 tiers, premium con gemas)
app.use('/api/pass', require('./routes/passRoutes'));

// Sentry error handler — must come after all routes so it can capture Express errors
setupExpressErrorHandler(app);

// SPA fallback: serve index.html for non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// Función para validar initData de Telegram en WebSocket
function validateTelegramInitData(initData) {
  try {
    const parsed = new URLSearchParams(initData);
    const hash = parsed.get('hash');
    if (!hash) return null;
    parsed.delete('hash');

    const authDate = parseInt(parsed.get('auth_date'), 10);
    if (!authDate || isNaN(authDate)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 300) return null;

    const dataCheckString = Array.from(parsed.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const hashBuffer = Buffer.from(hash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    if (hashBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(hashBuffer, expectedBuffer)) {
      return null;
    }

    const userData = JSON.parse(parsed.get('user'));
    return userData;
  } catch {
    return null;
  }
}

// WebSocket con autenticación y rate limiting
const wsRateLimits = new Map(); // socketId -> { count, resetAt }
const WS_MAX_EVENTS = 30; // max events per window
const WS_WINDOW_MS = 60000; // 1 minute

function wsRateLimit(socket) {
  const now = Date.now();
  let entry = wsRateLimits.get(socket.id);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WS_WINDOW_MS };
    wsRateLimits.set(socket.id, entry);
  }
  entry.count++;
  return entry.count > WS_MAX_EVENTS;
}

io.on('connection', (socket) => {
  socket.on('join_game', (data) => {
    if (wsRateLimit(socket)) {
      socket.emit('auth_error', { error: 'Demasiados intentos' });
      socket.disconnect(true);
      return;
    }

    const initData = typeof data === 'object' ? data.initData : data;

    // Validar tipo y tamaño antes de procesar
    if (typeof initData !== 'string' || initData.length > 4096) {
      socket.emit('auth_error', { error: 'Datos inválidos' });
      socket.disconnect(true);
      return;
    }

    const userData = validateTelegramInitData(initData);
    if (!userData) {
      socket.emit('auth_error', { error: 'Autenticación inválida' });
      socket.disconnect(true);
      return;
    }

    socket.playerId = userData.id;
    socket.join(`player_${userData.id}`);
  });

  socket.on('disconnect', () => {
    wsRateLimits.delete(socket.id);
  });
});

// Limpieza periódica de wsRateLimits para prevenir memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of wsRateLimits) {
    if (now > entry.resetAt + WS_WINDOW_MS) wsRateLimits.delete(id);
  }
}, 5 * 60 * 1000);

// Hacer io accesible en rutas
app.set('io', io);

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    // Validar variables de entorno requeridas
    const requiredEnv = ['BOT_TOKEN'];
    for (const key of requiredEnv) {
      if (!process.env[key]) {
        console.error(`FATAL: Variable de entorno requerida no encontrada: ${key}`);
        process.exit(1);
      }
    }

    // Inicializar base de datos (sql.js WASM)
    await initDatabase();
    console.log('Base de datos inicializada');

    // Correr migraciones automáticamente
    await db.migrate.latest({
      directory: path.join(__dirname, '../migrations'),
    });
    console.log('Base de datos migrada correctamente');

    // Seed de facciones + territorios (idempotent — solo inserta si faltan)
    const { seedFactions, seedTerritories } = require('./game/seedData');
    await seedFactions(db);
    await seedTerritories(db);

    // Generar eventos iniciales del mundo
    const worldEventService = require('./services/worldEventService');
    await worldEventService.cleanExpiredEvents();
    await worldEventService.generateEvents();

    // Iniciar bot de Telegram — SOLO en el worker primario. Con sql.js cada
    // proceso tiene su propia DB; si dos workers acreditaran pagos (o corrieran
    // el poller), uno pisaría al otro al persistir. Con instances:1 esto es
    // redundante, pero es defensa en profundidad si alguien reactiva cluster.
    if (process.env.BOT_TOKEN && IS_PRIMARY_WORKER) {
      // Guard de ingresos: si el polling está apagado, este proceso NO recibe
      // los updates de pago (pre_checkout / successful_payment) → la tienda
      // emitiría facturas que nunca se acreditan. Se avisa fuerte (no se lanza:
      // el modo dual VPS+local con polling en la otra instancia es legítimo).
      if (process.env.BOT_POLLING === 'false') {
        console.warn('\n[Shop] ⚠️  BOT_POLLING=false: este proceso NO procesará pagos de Stars.\n'
          + '        Los pagos deben procesarlos la instancia que tenga el polling.\n');
      }
      initBot();
      console.log('Bot de Telegram iniciado');
    } else if (!process.env.BOT_TOKEN) {
      console.log('BOT_TOKEN no configurado, bot desactivado');
    }

    // Iniciar game tick solo en el worker primario para evitar ejecución duplicada
    if (IS_PRIMARY_WORKER) {
      startGameTick(io);
      console.log('Game tick iniciado (worker primario)');
    } else {
      console.log(`Worker ${process.env.NODE_APP_INSTANCE} en modo HTTP — game tick en worker 0`);
    }

    server.listen(PORT, () => {
      // Wire cluster-adapter IPC after the server is listening
      if (cluster.isWorker) setupWorker(io);

      const workerLabel = process.env.NODE_APP_INSTANCE !== undefined
        ? ` [worker ${process.env.NODE_APP_INSTANCE}]`
        : '';
      console.log(`
╔══════════════════════════════════════╗
║       KINGDOMS HARVEST SERVER        ║
║     Puerto: ${PORT}                     ║
║     Entorno: ${process.env.NODE_ENV || 'development'}${workerLabel.padEnd(12)}║
╚══════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Capture unhandled promise rejections and uncaught exceptions before they crash the process
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', reason);
  captureException(reason instanceof Error ? reason : new Error(String(reason)), {
    subsystem: 'process.unhandledRejection',
  });
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught exception:', error);
  captureException(error, { subsystem: 'process.uncaughtException' });
  // Allow Sentry to flush before exiting (process is in undefined state after uncaughtException)
  setTimeout(() => process.exit(1), 2000);
});

start();
