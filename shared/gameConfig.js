// ========================================
// KINGDOMS HARVEST - Configuración del Juego
// Constantes y balanceo compartido entre cliente y servidor
// ========================================

const SEASONS = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
};

// Duración de cada estación en milisegundos (1 semana real = 1 estación)
const SEASON_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// ---- RECURSOS ----
const RESOURCES = {
  // Básicos
  WHEAT: { id: 'wheat', name: 'Trigo', icon: '🌾', category: 'basic' },
  WOOD: { id: 'wood', name: 'Madera', icon: '🪵', category: 'basic' },
  STONE: { id: 'stone', name: 'Piedra', icon: '🪨', category: 'basic' },
  IRON: { id: 'iron', name: 'Hierro', icon: '⛏️', category: 'basic' },
  WATER: { id: 'water', name: 'Agua', icon: '💧', category: 'basic' },
  GOLD: { id: 'gold', name: 'Oro', icon: '🪙', category: 'currency' },

  // Procesados
  BREAD: { id: 'bread', name: 'Pan', icon: '🍞', category: 'processed', recipe: { wheat: 3 } },
  PLANKS: { id: 'planks', name: 'Tablas', icon: '🪵', category: 'processed', recipe: { wood: 2 } },
  INGOTS: { id: 'ingots', name: 'Lingotes', icon: '🔩', category: 'processed', recipe: { iron: 2 } },
  FLOUR: { id: 'flour', name: 'Harina', icon: '🌫️', category: 'processed', recipe: { wheat: 2 } },
  CHEESE: { id: 'cheese', name: 'Queso', icon: '🧀', category: 'processed', recipe: { milk: 2 } },

  // Raros (solo por misiones/conquista)
  CRYSTAL: { id: 'crystal', name: 'Cristal', icon: '💎', category: 'rare' },
  RELIC: { id: 'relic', name: 'Reliquia', icon: '🏺', category: 'rare' },
  BLUEPRINT: { id: 'blueprint', name: 'Plano Especial', icon: '📜', category: 'rare' },
};

// ---- CULTIVOS ----
const CROPS = {
  wheat: {
    id: 'wheat',
    name: 'Trigo',
    icon: '🌾',
    growthTime: 30 * 60 * 1000, // 30 min
    yield: { min: 3, max: 6 },
    season: [SEASONS.SPRING, SEASONS.SUMMER, SEASONS.AUTUMN],
    seedCost: 5,
    sellPrice: 8,
    xp: 10,
  },
  carrot: {
    id: 'carrot',
    name: 'Zanahoria',
    icon: '🥕',
    growthTime: 20 * 60 * 1000, // 20 min
    yield: { min: 2, max: 5 },
    season: [SEASONS.SPRING, SEASONS.AUTUMN],
    seedCost: 8,
    sellPrice: 12,
    xp: 12,
  },
  potato: {
    id: 'potato',
    name: 'Papa',
    icon: '🥔',
    growthTime: 45 * 60 * 1000, // 45 min
    yield: { min: 4, max: 8 },
    season: [SEASONS.SPRING, SEASONS.SUMMER],
    seedCost: 10,
    sellPrice: 15,
    xp: 15,
  },
  tomato: {
    id: 'tomato',
    name: 'Tomate',
    icon: '🍅',
    growthTime: 60 * 60 * 1000, // 1 hora
    yield: { min: 3, max: 7 },
    season: [SEASONS.SUMMER],
    seedCost: 15,
    sellPrice: 22,
    xp: 20,
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Calabaza',
    icon: '🎃',
    growthTime: 120 * 60 * 1000, // 2 horas
    yield: { min: 2, max: 4 },
    season: [SEASONS.AUTUMN],
    seedCost: 25,
    sellPrice: 45,
    xp: 35,
  },
  corn: {
    id: 'corn',
    name: 'Maíz',
    icon: '🌽',
    growthTime: 90 * 60 * 1000, // 1.5 horas
    yield: { min: 3, max: 6 },
    season: [SEASONS.SUMMER, SEASONS.AUTUMN],
    seedCost: 18,
    sellPrice: 28,
    xp: 25,
  },
  grape: {
    id: 'grape',
    name: 'Uva',
    icon: '🍇',
    growthTime: 180 * 60 * 1000, // 3 horas
    yield: { min: 4, max: 8 },
    season: [SEASONS.AUTUMN],
    seedCost: 30,
    sellPrice: 50,
    xp: 40,
  },
};

// ---- ANIMALES ----
const ANIMALS = {
  chicken: {
    id: 'chicken',
    name: 'Gallina',
    icon: '🐔',
    product: 'egg',
    productName: 'Huevo',
    productIcon: '🥚',
    productionTime: 30 * 60 * 1000, // 30 min
    yield: { min: 1, max: 3 },
    cost: 100,
    feedCost: { wheat: 1 },
    sellPrice: 6,
    xp: 8,
  },
  cow: {
    id: 'cow',
    name: 'Vaca',
    icon: '🐄',
    product: 'milk',
    productName: 'Leche',
    productIcon: '🥛',
    productionTime: 60 * 60 * 1000, // 1 hora
    yield: { min: 1, max: 2 },
    cost: 300,
    feedCost: { wheat: 3 },
    sellPrice: 15,
    xp: 15,
  },
  sheep: {
    id: 'sheep',
    name: 'Oveja',
    icon: '🐑',
    product: 'wool',
    productName: 'Lana',
    productIcon: '🧶',
    productionTime: 120 * 60 * 1000, // 2 horas
    yield: { min: 1, max: 2 },
    cost: 250,
    feedCost: { wheat: 2 },
    sellPrice: 20,
    xp: 18,
  },
};

// ---- EDIFICIOS ----
const BUILDINGS = {
  // Zona Agrícola
  farm_plot: {
    id: 'farm_plot',
    name: 'Parcela de Cultivo',
    icon: '🌱',
    zone: 'agricultural',
    maxLevel: 10,
    baseCost: { wood: 10, stone: 5 },
    costMultiplier: 1.5,
    buildTime: 5 * 60 * 1000, // 5 min
    buildTimeMultiplier: 1.3,
    effect: 'Permite plantar cultivos',
    tileWidth: 2,
    tileHeight: 2,
    produces: { wheat: 5 }, // per hour when worked by villager
  },
  barn: {
    id: 'barn',
    name: 'Granero',
    icon: '🏚️',
    zone: 'agricultural',
    maxLevel: 10,
    baseCost: { wood: 30, stone: 15 },
    costMultiplier: 1.6,
    buildTime: 15 * 60 * 1000,
    buildTimeMultiplier: 1.4,
    effect: 'Almacena recursos (+500 capacidad por nivel)',
    storagePerLevel: 500,
    tileWidth: 2,
    tileHeight: 2,
  },
  mill: {
    id: 'mill',
    name: 'Molino',
    icon: '🏭',
    zone: 'agricultural',
    maxLevel: 5,
    baseCost: { wood: 50, stone: 30, iron: 10 },
    costMultiplier: 1.8,
    buildTime: 30 * 60 * 1000,
    buildTimeMultiplier: 1.5,
    effect: 'Convierte trigo en harina y pan',
    tileWidth: 2,
    tileHeight: 2,
    produces: { bread: 3 },
  },
  sawmill: {
    id: 'sawmill',
    name: 'Aserradero',
    icon: '🪚',
    zone: 'agricultural',
    maxLevel: 5,
    baseCost: { wood: 40, stone: 20, iron: 15 },
    costMultiplier: 1.8,
    buildTime: 30 * 60 * 1000,
    buildTimeMultiplier: 1.5,
    effect: 'Produce madera',
    tileWidth: 2,
    tileHeight: 2,
    produces: { wood: 10 },
  },
  smithy: {
    id: 'smithy',
    name: 'Herrería',
    icon: '⚒️',
    zone: 'agricultural',
    maxLevel: 5,
    baseCost: { wood: 30, stone: 50, iron: 25 },
    costMultiplier: 2.0,
    buildTime: 45 * 60 * 1000,
    buildTimeMultiplier: 1.5,
    effect: 'Produce lingotes de hierro',
    tileWidth: 2,
    tileHeight: 2,
    produces: { iron: 6 },
  },
  stable: {
    id: 'stable',
    name: 'Establo',
    icon: '🐴',
    zone: 'agricultural',
    maxLevel: 5,
    baseCost: { wood: 60, stone: 20 },
    costMultiplier: 1.7,
    buildTime: 20 * 60 * 1000,
    buildTimeMultiplier: 1.4,
    effect: 'Aloja animales (+2 espacios por nivel)',
    slotsPerLevel: 2,
    tileWidth: 2,
    tileHeight: 2,
  },
  house: {
    id: 'house',
    name: 'Casa',
    icon: '🏠',
    zone: 'agricultural',
    maxLevel: 5,
    baseCost: { wood: 20, stone: 10 },
    costMultiplier: 1.4,
    buildTime: 10 * 60 * 1000,
    buildTimeMultiplier: 1.3,
    effect: 'Aloja aldeanos (+2 por nivel)',
    villagersPerLevel: 2,
    tileWidth: 2,
    tileHeight: 2,
  },
  mine: {
    id: 'mine',
    name: 'Mina',
    icon: '⛏️',
    zone: 'agricultural',
    maxLevel: 5,
    baseCost: { wood: 30, stone: 40 },
    costMultiplier: 1.7,
    buildTime: 25 * 60 * 1000,
    buildTimeMultiplier: 1.4,
    effect: 'Produce piedra y hierro',
    tileWidth: 2,
    tileHeight: 2,
    produces: { stone: 8, iron: 4 },
  },

  // Zona Defensiva
  wall: {
    id: 'wall',
    name: 'Muralla',
    icon: '🧱',
    zone: 'defensive',
    maxLevel: 15,
    baseCost: { stone: 50, wood: 20 },
    costMultiplier: 1.6,
    buildTime: 30 * 60 * 1000,
    buildTimeMultiplier: 1.4,
    effect: 'Aumenta defensa del castillo (+100 HP por nivel)',
    hpPerLevel: 100,
    tileWidth: 2,
    tileHeight: 2,
  },
  tower: {
    id: 'tower',
    name: 'Torre de Vigilancia',
    icon: '🗼',
    zone: 'defensive',
    maxLevel: 10,
    baseCost: { stone: 80, iron: 20 },
    costMultiplier: 1.8,
    buildTime: 60 * 60 * 1000,
    buildTimeMultiplier: 1.5,
    effect: 'Daño a atacantes (+15 ATK por nivel)',
    atkPerLevel: 15,
    tileWidth: 2,
    tileHeight: 2,
  },
  barracks: {
    id: 'barracks',
    name: 'Cuartel',
    icon: '⚔️',
    zone: 'defensive',
    maxLevel: 10,
    baseCost: { wood: 60, stone: 40, iron: 20 },
    costMultiplier: 1.7,
    buildTime: 45 * 60 * 1000,
    buildTimeMultiplier: 1.4,
    effect: 'Entrena tropas (+5 capacidad por nivel)',
    troopCapPerLevel: 5,
    tileWidth: 3,
    tileHeight: 3,
  },
  trap: {
    id: 'trap',
    name: 'Trampas',
    icon: '🪤',
    zone: 'defensive',
    maxLevel: 8,
    baseCost: { wood: 20, iron: 30 },
    costMultiplier: 1.5,
    buildTime: 20 * 60 * 1000,
    buildTimeMultiplier: 1.3,
    effect: 'Daño al inicio del combate defensivo',
    trapDamage: 25,
    tileWidth: 1,
    tileHeight: 1,
  },

  // Zona Social
  tavern: {
    id: 'tavern',
    name: 'Taberna',
    icon: '🍺',
    zone: 'social',
    maxLevel: 5,
    baseCost: { wood: 40, stone: 20 },
    costMultiplier: 1.8,
    buildTime: 20 * 60 * 1000,
    buildTimeMultiplier: 1.5,
    effect: 'Desbloquea misiones de venta (+1 misión por nivel)',
    missionsPerLevel: 1,
    tileWidth: 2,
    tileHeight: 2,
    produces: { gold: 5 },
  },
  market: {
    id: 'market',
    name: 'Mercado',
    icon: '🏪',
    zone: 'social',
    maxLevel: 5,
    baseCost: { wood: 50, stone: 30 },
    costMultiplier: 1.8,
    buildTime: 25 * 60 * 1000,
    buildTimeMultiplier: 1.5,
    effect: 'Desbloquea comercio con caravanas y rutas',
    tileWidth: 3,
    tileHeight: 2,
    produces: { gold: 10 },
  },
  embassy: {
    id: 'embassy',
    name: 'Embajada',
    icon: '🏛️',
    zone: 'social',
    maxLevel: 3,
    baseCost: { stone: 100, iron: 30, gold: 200 },
    costMultiplier: 2.0,
    buildTime: 120 * 60 * 1000,
    buildTimeMultiplier: 2.0,
    effect: 'Permite unirse a facciones y alianzas',
    tileWidth: 3,
    tileHeight: 3,
  },

  // Zona Noble
  throne_room: {
    id: 'throne_room',
    name: 'Salón del Trono',
    icon: '👑',
    zone: 'noble',
    maxLevel: 10,
    baseCost: { stone: 100, iron: 50, gold: 100 },
    costMultiplier: 2.0,
    buildTime: 60 * 60 * 1000,
    buildTimeMultiplier: 1.8,
    effect: 'Nivel del castillo, desbloquea todo lo demás',
    tileWidth: 4,
    tileHeight: 4,
  },
  library: {
    id: 'library',
    name: 'Biblioteca',
    icon: '📚',
    zone: 'noble',
    maxLevel: 8,
    baseCost: { wood: 40, stone: 60, gold: 50 },
    costMultiplier: 1.9,
    buildTime: 45 * 60 * 1000,
    buildTimeMultiplier: 1.6,
    effect: 'Investigación y tech tree',
    tileWidth: 2,
    tileHeight: 2,
  },
};

// ---- TROPAS ----
const TROOPS = {
  militia: {
    id: 'militia',
    name: 'Milicia',
    icon: '🗡️',
    atk: 10,
    def: 8,
    hp: 50,
    speed: 10,
    carryCapacity: 20,
    trainTime: 10 * 60 * 1000, // 10 min
    cost: { gold: 20, bread: 1 },
    strongVs: [],
    weakVs: ['cavalry'],
  },
  archer: {
    id: 'archer',
    name: 'Arquero',
    icon: '🏹',
    atk: 15,
    def: 5,
    hp: 35,
    speed: 8,
    carryCapacity: 10,
    trainTime: 15 * 60 * 1000,
    cost: { gold: 35, bread: 1, wood: 5 },
    strongVs: ['militia'],
    weakVs: ['cavalry'],
  },
  cavalry: {
    id: 'cavalry',
    name: 'Caballería',
    icon: '🐎',
    atk: 20,
    def: 12,
    hp: 80,
    speed: 15,
    carryCapacity: 30,
    trainTime: 30 * 60 * 1000,
    cost: { gold: 80, bread: 3, ingots: 2 },
    strongVs: ['archer', 'militia'],
    weakVs: ['spearman'],
  },
  spearman: {
    id: 'spearman',
    name: 'Lancero',
    icon: '🔱',
    atk: 12,
    def: 15,
    hp: 60,
    speed: 7,
    carryCapacity: 15,
    trainTime: 12 * 60 * 1000,
    cost: { gold: 30, bread: 1, ingots: 1 },
    strongVs: ['cavalry'],
    weakVs: ['archer'],
  },
  siege_ram: {
    id: 'siege_ram',
    name: 'Ariete de Asedio',
    icon: '🪵',
    atk: 50,
    def: 5,
    hp: 150,
    speed: 3,
    carryCapacity: 0,
    trainTime: 60 * 60 * 1000,
    cost: { gold: 150, planks: 10, ingots: 5 },
    strongVs: ['wall'],
    weakVs: ['archer', 'cavalry'],
    siegeBonus: 3.0, // multiplicador vs edificios
  },
};

// ---- TECH TREE ----
const TECH_BRANCHES = {
  agriculture: {
    id: 'agriculture',
    name: 'Agricultura',
    icon: '🌿',
    techs: {
      fertile_soil: { name: 'Tierra Fértil', effect: '+20% rendimiento cultivos', cost: { gold: 100 }, level: 1 },
      irrigation: { name: 'Irrigación', effect: '-15% tiempo de cultivo', cost: { gold: 200, stone: 50 }, level: 2 },
      selective_breeding: { name: 'Cría Selectiva', effect: '+1 producto animal', cost: { gold: 300 }, level: 3 },
      greenhouse: { name: 'Invernadero', effect: 'Cultivos de cualquier estación', cost: { gold: 500, crystal: 1 }, level: 5 },
    },
  },
  commerce: {
    id: 'commerce',
    name: 'Comercio',
    icon: '💰',
    techs: {
      haggling: { name: 'Regateo', effect: '+10% precio de venta', cost: { gold: 100 }, level: 1 },
      trade_routes: { name: 'Rutas Comerciales', effect: 'Desbloquea rutas lejanas', cost: { gold: 250 }, level: 2 },
      caravan_master: { name: 'Maestro Caravanero', effect: 'Caravanas más frecuentes', cost: { gold: 400 }, level: 3 },
      merchant_guild: { name: 'Gremio Mercantil', effect: '+2 misiones simultáneas', cost: { gold: 600, relic: 1 }, level: 5 },
    },
  },
  military: {
    id: 'military',
    name: 'Militar',
    icon: '⚔️',
    techs: {
      sharp_blades: { name: 'Filos Afilados', effect: '+10% ATK tropas', cost: { gold: 150, ingots: 5 }, level: 1 },
      reinforced_armor: { name: 'Armadura Reforzada', effect: '+10% DEF tropas', cost: { gold: 200, ingots: 8 }, level: 2 },
      tactics: { name: 'Tácticas', effect: '+15% en combate defensivo', cost: { gold: 350 }, level: 3 },
      elite_training: { name: 'Entrenamiento Élite', effect: 'Desbloquea tropas élite', cost: { gold: 700, blueprint: 1 }, level: 5 },
    },
  },
};

// ---- FACCIONES ----
const FACTIONS = {
  knights_of_dawn: {
    id: 'knights_of_dawn',
    name: 'Caballeros del Alba',
    icon: '☀️',
    color: '#FFD700',
    bonus: { def: 0.1 }, // +10% defensa
    description: 'Orden noble que protege a los débiles. Bonus: +10% defensa.',
  },
  shadow_merchants: {
    id: 'shadow_merchants',
    name: 'Mercaderes de la Sombra',
    icon: '🌙',
    color: '#4B0082',
    bonus: { commerce: 0.15 }, // +15% comercio
    description: 'Red de comerciantes astutos. Bonus: +15% ganancias comerciales.',
  },
  iron_legion: {
    id: 'iron_legion',
    name: 'Legión de Hierro',
    icon: '🛡️',
    color: '#8B0000',
    bonus: { atk: 0.1 }, // +10% ataque
    description: 'Guerreros implacables forjados en batalla. Bonus: +10% ataque.',
  },
  green_wardens: {
    id: 'green_wardens',
    name: 'Guardianes Verdes',
    icon: '🌳',
    color: '#228B22',
    bonus: { farming: 0.15 }, // +15% producción agrícola
    description: 'Protectores de la naturaleza. Bonus: +15% producción agrícola.',
  },
};

// ---- NIVELES Y XP ----
const LEVEL_XP_TABLE = Array.from({ length: 50 }, (_, i) => ({
  level: i + 1,
  xpRequired: Math.floor(100 * Math.pow(1.5, i)),
}));

// ---- CALIDAD DE ITEMS ----
const QUALITY = {
  NORMAL: { id: 'normal', name: 'Normal', multiplier: 1.0, color: '#FFFFFF', chance: 0.6 },
  GOOD: { id: 'good', name: 'Bueno', multiplier: 1.25, color: '#4CAF50', chance: 0.3 },
  EXCELLENT: { id: 'excellent', name: 'Excelente', multiplier: 1.75, color: '#9C27B0', chance: 0.1 },
};

// Recursos iniciales para nuevos jugadores
const STARTER_RESOURCES = {
  gold: 200,
  wood: 100,
  stone: 50,
  iron: 20,
  wheat: 30,
  water: 50,
};

// ---- ALDEANOS (Villager AI) ----
const VILLAGER_ROLES = {
  farmer: { id: 'farmer', name: 'Granjero', icon: '🧑‍🌾', workBuildings: ['farm_plot', 'stable'] },
  woodcutter: { id: 'woodcutter', name: 'Leñador', icon: '🪓', workBuildings: ['sawmill'] },
  miner: { id: 'miner', name: 'Minero', icon: '⛏️', workBuildings: ['mine', 'smithy'] },
  soldier: { id: 'soldier', name: 'Soldado', icon: '⚔️', workBuildings: ['barracks', 'tower', 'wall'] },
  merchant: { id: 'merchant', name: 'Comerciante', icon: '💰', workBuildings: ['market', 'tavern'] },
  builder: { id: 'builder', name: 'Constructor', icon: '🔨', workBuildings: [] }, // builds any building
};

const VILLAGER_NAMES = [
  'Aldric', 'Brynn', 'Cedric', 'Dara', 'Elwin', 'Fiona',
  'Gareth', 'Helena', 'Igor', 'Josefa', 'Karl', 'Lucia',
  'Magnus', 'Nora', 'Otto', 'Petra', 'Rolf', 'Sonia',
  'Tomas', 'Ursula', 'Viktor', 'Wanda', 'Xander', 'Yara',
];

// Day cycle: 10 real minutes = 1 game day
const DAY_CYCLE = {
  dayDurationMs: 10 * 60 * 1000,
  periods: {
    dawn:    { start: 0.00, end: 0.15 },
    morning: { start: 0.15, end: 0.35 },
    midday:  { start: 0.35, end: 0.55 },
    evening: { start: 0.55, end: 0.70 },
    night:   { start: 0.70, end: 1.00 },
  },
};

// ---- SIEGE ABILITIES ----
const SIEGE_ABILITIES = {
  arrow_rain: {
    id: 'arrow_rain',
    name: 'Lluvia de Flechas',
    icon: '🏹',
    description: 'Reduce defensa enemiga un 20% por 1 turno',
    cooldown: 120000, // 2 min
    effect: { type: 'debuff_defense', value: 0.20 },
    requires: { archer: 5 },
  },
  battering_ram: {
    id: 'battering_ram',
    name: 'Ariete',
    icon: '🪵',
    description: 'Inflige daño masivo a murallas',
    cooldown: 180000,
    effect: { type: 'wall_damage', value: 100 },
    requires: { siege_ram: 1 },
  },
  rally: {
    id: 'rally',
    name: 'Reagrupar',
    icon: '📯',
    description: 'Aumenta ataque de tropas un 15% por 1 turno',
    cooldown: 150000,
    effect: { type: 'buff_attack', value: 0.15 },
    requires: {},
  },
  shield_wall: {
    id: 'shield_wall',
    name: 'Muro de Escudos',
    icon: '🛡️',
    description: 'Aumenta defensa un 25% por 1 turno',
    cooldown: 150000,
    effect: { type: 'buff_defense', value: 0.25 },
    requires: { spearman: 3 },
  },
};

// ---- SIEGE CONFIG ----
const SIEGE_CONFIG = {
  marchSpeedPerTile: 2000, // 2 sec per tile distance
  baseMarchTime: 60000, // minimum 1 min march
  maxMarchTime: 300000, // max 5 min march
  lootRate: 0.15, // steal 15% of defender's resources
  resourceShield: 50, // can't steal below this per resource
};

// ─── Hero System ─────────────────────────────────────────────────────────────

const HERO_CLASSES = {
  warrior: { name: 'Guerrero',  color: '#ef4444', icon: '⚔️',  description: 'Fuerza y resistencia en combate cuerpo a cuerpo' },
  mage:    { name: 'Mago',      color: '#8b5cf6', icon: '🔮',  description: 'Poder mágico devastador a distancia' },
  ranger:  { name: 'Cazador',   color: '#10b981', icon: '🏹',  description: 'Ágil y preciso, experto en terreno abierto' },
  paladin: { name: 'Paladín',   color: '#f59e0b', icon: '🛡️',  description: 'Defensor sagrado con habilidades de curación' },
  rogue:   { name: 'Pícaro',    color: '#6366f1', icon: '🗡️',  description: 'Veloz y letal, ataca desde las sombras' },
};

const HERO_RARITIES = {
  common:    { name: 'Común',      color: '#9ca3af', border: '#6b7280', statMultiplier: 1.0, summonCost: 200,  weight: 55 },
  rare:      { name: 'Raro',       color: '#3b82f6', border: '#2563eb', statMultiplier: 1.3, summonCost: 500,  weight: 30 },
  epic:      { name: 'Épico',      color: '#a855f7', border: '#7c3aed', statMultiplier: 1.7, summonCost: 1000, weight: 12 },
  legendary: { name: 'Legendario', color: '#f59e0b', border: '#d97706', statMultiplier: 2.5, summonCost: 2000, weight: 3  },
};

const HEROES = {
  aria:   { id: 'aria',   name: 'Aria la Valiente',    class: 'warrior', rarity: 'common',    sprite: 'warrior',    baseStats: { atk: 14, def: 12, hp: 90,  spd: 8,  mgk: 2  }, passive: 'Golpe Certero: +15% ATK al atacar con ventaja numérica' },
  thorin: { id: 'thorin', name: 'Thorin Escudobronce', class: 'warrior', rarity: 'epic',      sprite: 'knight',     baseStats: { atk: 18, def: 20, hp: 120, spd: 5,  mgk: 1  }, passive: 'Bastión: +30% DEF cuando HP < 50%' },
  lyra:   { id: 'lyra',   name: 'Lyra Brillante',      class: 'mage',    rarity: 'common',    sprite: 'mage',       baseStats: { atk: 8,  def: 5,  hp: 55,  spd: 7,  mgk: 18 }, passive: 'Arcano: los hechizos ignoran 10% de DEF enemiga' },
  zara:   { id: 'zara',   name: 'Zara la Oscura',      class: 'mage',    rarity: 'legendary', sprite: 'wizard',     baseStats: { atk: 10, def: 6,  hp: 65,  spd: 9,  mgk: 30 }, passive: 'Maldición: −20% ATK al enemigo objetivo durante 2 turnos' },
  finn:   { id: 'finn',   name: 'Finn el Rastreador',  class: 'ranger',  rarity: 'common',    sprite: 'ranger',     baseStats: { atk: 12, def: 7,  hp: 65,  spd: 14, mgk: 3  }, passive: 'Tiro Preciso: +20% ATK contra enemigos a distancia' },
  elena:  { id: 'elena',  name: 'Elena Plumaveloz',    class: 'ranger',  rarity: 'rare',      sprite: 'explorer',   baseStats: { atk: 15, def: 8,  hp: 70,  spd: 18, mgk: 4  }, passive: 'Evasión: 15% de esquivar ataques cuerpo a cuerpo' },
  viktor: { id: 'viktor', name: 'Viktor el Sagrado',   class: 'paladin', rarity: 'common',    sprite: 'guard',      baseStats: { atk: 10, def: 16, hp: 100, spd: 6,  mgk: 8  }, passive: 'Aura Protectora: aliados adyacentes +10% DEF' },
  seraph: { id: 'seraph', name: 'Serafín Celeste',     class: 'paladin', rarity: 'epic',      sprite: 'adventurer', baseStats: { atk: 12, def: 20, hp: 130, spd: 7,  mgk: 14 }, passive: 'Sanación Divina: restaura 8% HP al inicio de cada ronda' },
  shadow: { id: 'shadow', name: 'Sombra',              class: 'rogue',   rarity: 'common',    sprite: 'traveler',   baseStats: { atk: 16, def: 5,  hp: 55,  spd: 16, mgk: 5  }, passive: 'Sorpresa: primer ataque hace +40% daño' },
  vex:    { id: 'vex',    name: 'Vex el Veloz',        class: 'rogue',   rarity: 'rare',      sprite: 'farmer',     baseStats: { atk: 20, def: 6,  hp: 60,  spd: 20, mgk: 6  }, passive: 'Ataque Dual: 25% de golpear dos veces por turno' },
};

const HERO_ITEMS = {
  iron_sword:    { id: 'iron_sword',    name: 'Espada de Hierro',  slot: 'weapon',    icon: '⚔️', bonuses: { atk: 6 },                    rarity: 'common', description: 'Hoja forjada en el yunque del herrero del pueblo' },
  magic_staff:   { id: 'magic_staff',   name: 'Báculo Arcano',     slot: 'weapon',    icon: '🪄', bonuses: { mgk: 10, atk: 2 },           rarity: 'rare',   description: 'Concentra el maná del portador en un flujo devastador' },
  hunters_bow:   { id: 'hunters_bow',   name: 'Arco del Cazador',  slot: 'weapon',    icon: '🏹', bonuses: { atk: 5, spd: 3 },            rarity: 'common', description: 'Tallado de tejo centenario, silencioso y mortal' },
  shadow_dagger: { id: 'shadow_dagger', name: 'Daga Sombría',      slot: 'weapon',    icon: '🗡️', bonuses: { atk: 8, spd: 4 },            rarity: 'rare',   description: 'Acero negro que absorbe la luz del portador' },
  leather_armor: { id: 'leather_armor', name: 'Armadura de Cuero', slot: 'armor',     icon: '🧥', bonuses: { def: 6, hp: 15 },            rarity: 'common', description: 'Ligera y flexible, no entorpece el movimiento' },
  chainmail:     { id: 'chainmail',     name: 'Cota de Malla',     slot: 'armor',     icon: '🛡️', bonuses: { def: 14, hp: 30 },           rarity: 'rare',   description: 'Miles de anillos de acero forman una barrera impenetrable' },
  mage_robe:     { id: 'mage_robe',     name: 'Túnica del Mago',   slot: 'armor',     icon: '👘', bonuses: { def: 4, mgk: 8, hp: 20 },    rarity: 'rare',   description: 'Tejida con hilos imbuidos de energía arcana' },
  speed_boots:   { id: 'speed_boots',   name: 'Botas de Velocidad',slot: 'accessory', icon: '👢', bonuses: { spd: 6 },                    rarity: 'common', description: 'Suela encantada que permite moverse como el viento' },
  power_ring:    { id: 'power_ring',    name: 'Anillo de Poder',   slot: 'accessory', icon: '💍', bonuses: { atk: 4, mgk: 4 },            rarity: 'rare',   description: 'Forjado en las fraguas de los antiguos reyes' },
  lucky_charm:   { id: 'lucky_charm',   name: 'Amuleto de Fortuna',slot: 'accessory', icon: '🍀', bonuses: { atk: 2, def: 2, hp: 10, spd: 2, mgk: 2 }, rarity: 'common', description: 'Trébol de cuatro hojas preservado por magia del bosque' },
};

module.exports = {
  SEASONS,
  SEASON_DURATION_MS,
  RESOURCES,
  CROPS,
  ANIMALS,
  BUILDINGS,
  TROOPS,
  TECH_BRANCHES,
  FACTIONS,
  LEVEL_XP_TABLE,
  QUALITY,
  STARTER_RESOURCES,
  VILLAGER_ROLES,
  VILLAGER_NAMES,
  DAY_CYCLE,
  SIEGE_ABILITIES,
  SIEGE_CONFIG,
  HERO_CLASSES,
  HERO_RARITIES,
  HEROES,
  HERO_ITEMS,
};
