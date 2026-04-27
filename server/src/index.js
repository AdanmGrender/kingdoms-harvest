const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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
const factionRoutes = require('./routes/factionRoutes');
const territoryRoutes = require('./routes/territoryRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const allianceRoutes = require('./routes/allianceRoutes');
const eventRoutes = require('./routes/eventRoutes');

const app = express();
app.set('trust proxy', 1); // Necesario detrás de Nginx para que rate-limit use IP real
const server = http.createServer(app);

// Determinar orígenes permitidos
const allowedOrigins = [process.env.WEBAPP_URL, 'http://localhost:5173'].filter(Boolean);

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
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

// Rate limiting — solo rutas API (los assets estáticos no cuentan para el quota)
const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intentá de nuevo en un momento' },
});
app.use('/api', apiRateLimit);

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
app.use('/api/factions', factionRoutes);
app.use('/api/territories', territoryRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/market', marketplaceRoutes);
app.use('/api/alliances', allianceRoutes);
app.use('/api/events', eventRoutes);

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

    // Iniciar bot de Telegram
    if (process.env.BOT_TOKEN) {
      initBot();
      console.log('Bot de Telegram iniciado');
    } else {
      console.log('BOT_TOKEN no configurado, bot desactivado');
    }

    // Iniciar game tick (procesa timers, producciones, etc)
    startGameTick(io);
    console.log('Game tick iniciado');

    server.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════╗
║       KINGDOMS HARVEST SERVER        ║
║     Puerto: ${PORT}                     ║
║     Entorno: ${process.env.NODE_ENV || 'development'}            ║
╚══════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

start();
