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

// ---- SEASONAL EVENTS ----
// Server-wide rotating buffs. gameTick activates one at a time and rotates
// when its window expires. Each event lasts `durationMs`. Multipliers are
// added to existing faction + tech stacks in the relevant service paths.
const SEASONAL_EVENT_DURATION_MS = 24 * 60 * 60 * 1000; // 24h per event
const SEASONAL_EVENTS = {
  spring_bloom: {
    id: 'spring_bloom',
    name: 'Brote de Primavera',
    icon: '🌱',
    color: '#7ee87e',
    description: '+25% rendimiento de cultivos durante 24h',
    durationMs: SEASONAL_EVENT_DURATION_MS,
    multipliers: { farming: 0.25 },
  },
  harvest_festival: {
    id: 'harvest_festival',
    name: 'Festival de Cosecha',
    icon: '🍂',
    color: '#ffac30',
    description: '+20% precio de venta a caravanas y mercado',
    durationMs: SEASONAL_EVENT_DURATION_MS,
    multipliers: { commerce: 0.20 },
  },
  battle_frenzy: {
    id: 'battle_frenzy',
    name: 'Frenesí de Batalla',
    icon: '⚔️',
    color: '#ff6060',
    description: '+15% botín en PvP y PvE',
    durationMs: SEASONAL_EVENT_DURATION_MS,
    multipliers: { battle_loot: 0.15 },
  },
  golden_caravan: {
    id: 'golden_caravan',
    name: 'Caravana Dorada',
    icon: '🪙',
    color: '#ffd750',
    description: '+10% recompensa KH en cosecha + venta',
    durationMs: SEASONAL_EVENT_DURATION_MS,
    multipliers: { kh_bonus: 0.10 },
  },
};
// Order in which events rotate. Change to taste; dropping one unschedules.
const SEASONAL_EVENT_ROTATION = ['spring_bloom', 'harvest_festival', 'battle_frenzy', 'golden_caravan'];

// ---- TOURNAMENTS ----
// Timed competitions layered over the existing leaderboards. tournamentService
// rotates through TOURNAMENT_ROTATION on a fixed cadence (one active per type
// at a time). Each entry declares:
//   metric  — column on `players` (or derived) used for the score
//   prizes  — KH tokens awarded to top 3
const TOURNAMENT_DURATION_MS = 24 * 60 * 60 * 1000; // 24h per tournament
const TOURNAMENTS = {
  kh_rush: {
    id: 'kh_rush',
    name: 'Carrera KH',
    icon: '💎',
    description: 'Quien gane más KH tokens en 24h',
    durationMs: TOURNAMENT_DURATION_MS,
    metric: 'kh',          // computed from player_tokens.total_earned
    prizes: { 1: 100, 2: 60, 3: 30 },
  },
  xp_grind: {
    id: 'xp_grind',
    name: 'Sed de XP',
    icon: '⭐',
    description: 'Quien gane más XP en 24h',
    durationMs: TOURNAMENT_DURATION_MS,
    metric: 'xp',          // computed from players.xp + level synthesis
    prizes: { 1: 80, 2: 50, 3: 25 },
  },
  faction_glory: {
    id: 'faction_glory',
    name: 'Gloria de Facción',
    icon: '🛡️',
    description: 'Quien sume más puntos de facción en 24h',
    durationMs: TOURNAMENT_DURATION_MS,
    metric: 'faction_points', // players.faction_points
    prizes: { 1: 90, 2: 55, 3: 28 },
  },
};
const TOURNAMENT_ROTATION = ['kh_rush', 'xp_grind', 'faction_glory'];

// ---- ACHIEVEMENTS ----
// `event` matches the verb passed to achievementService.checkAndUnlock(player, event, payload).
// `goal` is the running counter target (e.g. 10 harvests). For one-shot
// achievements (e.g. "first conquest") goal=1 and the trigger always passes 1.
// `reward.kh` is paid out via tokenService when the player claims.
const ACHIEVEMENTS = {
  first_harvest:      { id: 'first_harvest',      name: 'Primera Cosecha',     icon: '🌾', desc: 'Cosechá tu primer cultivo',                event: 'harvest',     goal: 1,   reward: { kh: 5  } },
  green_thumb:        { id: 'green_thumb',        name: 'Pulgar Verde',        icon: '🌱', desc: 'Cosechá 25 cultivos',                       event: 'harvest',     goal: 25,  reward: { kh: 30 } },
  farm_master:        { id: 'farm_master',        name: 'Maestro Granjero',    icon: '🚜', desc: 'Cosechá 100 cultivos',                      event: 'harvest',     goal: 100, reward: { kh: 100 } },
  builder_novice:     { id: 'builder_novice',     name: 'Aprendiz Constructor', icon: '🔨', desc: 'Construí 5 edificios',                     event: 'build',       goal: 5,   reward: { kh: 15 } },
  city_planner:       { id: 'city_planner',       name: 'Urbanista',           icon: '🏘️', desc: 'Construí 15 edificios',                     event: 'build',       goal: 15,  reward: { kh: 60 } },
  first_battle:       { id: 'first_battle',       name: 'Primer Combate',      icon: '⚔️', desc: 'Ganá tu primera batalla PvE',               event: 'battle_win',  goal: 1,   reward: { kh: 10 } },
  warlord:            { id: 'warlord',            name: 'Señor de la Guerra',  icon: '🛡️', desc: 'Ganá 10 batallas (PvE o PvP)',              event: 'battle_win',  goal: 10,  reward: { kh: 50 } },
  conqueror:          { id: 'conqueror',          name: 'Conquistador',        icon: '🏴', desc: 'Conquistá tu primer territorio',            event: 'conquest',    goal: 1,   reward: { kh: 25 } },
  empire:             { id: 'empire',             name: 'Imperio',             icon: '👑', desc: 'Conquistá 5 territorios',                    event: 'conquest',    goal: 5,   reward: { kh: 150 } },
  scholar:            { id: 'scholar',            name: 'Erudito',             icon: '🔬', desc: 'Completá 3 investigaciones',                event: 'research',    goal: 3,   reward: { kh: 40 } },
  rich_merchant:      { id: 'rich_merchant',      name: 'Mercader Rico',       icon: '💰', desc: 'Hacé 20 ventas a caravanas',                event: 'sell',        goal: 20,  reward: { kh: 35 } },
  level_5:            { id: 'level_5',            name: 'Veterano',            icon: '⭐', desc: 'Alcanzá nivel 5',                           event: 'level_up',    goal: 5,   reward: { kh: 25 } },
  level_10:           { id: 'level_10',           name: 'Leyenda',             icon: '🌟', desc: 'Alcanzá nivel 10',                          event: 'level_up',    goal: 10,  reward: { kh: 100 } },
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
  ACHIEVEMENTS,
  SEASONAL_EVENTS,
  SEASONAL_EVENT_ROTATION,
  SEASONAL_EVENT_DURATION_MS,
  TOURNAMENTS,
  TOURNAMENT_ROTATION,
  TOURNAMENT_DURATION_MS,
};
