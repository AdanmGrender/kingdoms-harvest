// ========================================
// KINGDOMS HARVEST - Configuración del Juego
// Constantes y balanceo compartido entre cliente y servidor
//
// TEMA: grimdark gótico-industrial (rework 2026-07-03, docs/art-style.md).
// ⚠️ Los IDs internos conservan sus nombres medievales originales (wheat,
// throne_room, cavalry...) A PROPÓSITO: están persistidos en la DB de
// jugadores. Solo se re-tematizan name/icon/description/effect.
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
  WHEAT: { id: 'wheat', name: 'Grano Sintético', icon: '🌾', category: 'basic' },
  WOOD: { id: 'wood', name: 'Chatarra', icon: '⚙️', category: 'basic' },
  STONE: { id: 'stone', name: 'Ferrocreto', icon: '🪨', category: 'basic' },
  IRON: { id: 'iron', name: 'Acero', icon: '⛏️', category: 'basic' },
  WATER: { id: 'water', name: 'Agua Filtrada', icon: '💧', category: 'basic' },
  GOLD: { id: 'gold', name: 'Créditos', icon: '🪙', category: 'currency' },

  // Procesados
  BREAD: { id: 'bread', name: 'Raciones', icon: '🥫', category: 'processed', recipe: { wheat: 3 } },
  PLANKS: { id: 'planks', name: 'Placas de Blindaje', icon: '🔳', category: 'processed', recipe: { wood: 2 } },
  INGOTS: { id: 'ingots', name: 'Aleación', icon: '🔩', category: 'processed', recipe: { iron: 2 } },
  FLOUR: { id: 'flour', name: 'Polvo Nutriente', icon: '🌫️', category: 'processed', recipe: { wheat: 2 } },
  CHEESE: { id: 'cheese', name: 'Proteína Cultivada', icon: '🧫', category: 'processed', recipe: { milk: 2 } },

  // Raros (solo por misiones/conquista)
  CRYSTAL: { id: 'crystal', name: 'Cristal de Energía', icon: '💎', category: 'rare' },
  RELIC: { id: 'relic', name: 'Reliquia Sagrada', icon: '⚱️', category: 'rare' },
  BLUEPRINT: { id: 'blueprint', name: 'Plano Arcanotécnico', icon: '📜', category: 'rare' },
};

// ---- CULTIVOS ----
const CROPS = {
  wheat: {
    id: 'wheat',
    name: 'Grano Sintético',
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
    name: 'Raíz Nutritiva',
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
    name: 'Tubérculo Vat',
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
    name: 'Fruto Hidropónico',
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
    name: 'Bulbo Fungoide',
    icon: '🍄',
    growthTime: 120 * 60 * 1000, // 2 horas
    yield: { min: 2, max: 4 },
    season: [SEASONS.AUTUMN],
    seedCost: 25,
    sellPrice: 45,
    xp: 35,
  },
  corn: {
    id: 'corn',
    name: 'Maíz Mutante',
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
    name: 'Baya Fermentable',
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
    name: 'Ave Clonada',
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
    name: 'Bestia de Carga',
    icon: '🐄',
    product: 'milk',
    productName: 'Nutrileche',
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
    name: 'Lanuda Mutante',
    icon: '🐑',
    product: 'wool',
    productName: 'Fibra',
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
    name: 'Cúpula Hidropónica',
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
    name: 'Depósito de Suministros',
    icon: '📦',
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
    name: 'Procesadora de Raciones',
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
    name: 'Planta de Salvamento',
    icon: '♻️',
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
    name: 'Fundición',
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
    name: 'Corral de Bestias',
    icon: '🐾',
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
    name: 'Bloque Habitacional',
    icon: '🏢',
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
    name: 'Excavación Profunda',
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
    name: 'Muro Bastión',
    icon: '🧱',
    zone: 'defensive',
    maxLevel: 15,
    baseCost: { stone: 50, wood: 20 },
    costMultiplier: 1.6,
    buildTime: 30 * 60 * 1000,
    buildTimeMultiplier: 1.4,
    effect: 'Aumenta defensa del bastión (+100 HP por nivel)',
    hpPerLevel: 100,
    tileWidth: 2,
    tileHeight: 2,
  },
  tower: {
    id: 'tower',
    name: 'Torreta Centinela',
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
    icon: '🪖',
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
    name: 'Campo de Minas',
    icon: '💣',
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
    name: 'Cantina',
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
    name: 'Mercado Negro',
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
    name: 'Nexo de Comunicaciones',
    icon: '📡',
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
    name: 'Bastión de Mando',
    icon: '🎖️',
    zone: 'noble',
    maxLevel: 10,
    baseCost: { stone: 100, iron: 50, gold: 100 },
    costMultiplier: 2.0,
    buildTime: 60 * 60 * 1000,
    buildTimeMultiplier: 1.8,
    effect: 'Nivel del bastión, desbloquea todo lo demás',
    tileWidth: 4,
    tileHeight: 4,
  },
  library: {
    id: 'library',
    name: 'Archivo Tecnosagrado',
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
    name: 'Recluta',
    icon: '🔫',
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
    name: 'Fusilero',
    icon: '🎯',
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
    name: 'Asalto Mecanizado',
    icon: '🏍️',
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
    name: 'Granadero',
    icon: '💥',
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
    name: 'Vehículo de Brecha',
    icon: '🚛',
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
    name: 'Biocultivo',
    icon: '🧬',
    techs: {
      fertile_soil: { name: 'Sustrato Enriquecido', effect: '+20% rendimiento cultivos', cost: { gold: 100 }, level: 1 },
      irrigation: { name: 'Riego Automatizado', effect: '-15% tiempo de cultivo', cost: { gold: 200, stone: 50 }, level: 2 },
      selective_breeding: { name: 'Clonación Selectiva', effect: '+1 producto animal', cost: { gold: 300 }, level: 3 },
      greenhouse: { name: 'Bio-Cúpula Sellada', effect: 'Cultivos de cualquier estación', cost: { gold: 500, crystal: 1 }, level: 5 },
    },
  },
  commerce: {
    id: 'commerce',
    name: 'Intercambio',
    icon: '💰',
    techs: {
      haggling: { name: 'Negociación Dura', effect: '+10% precio de venta', cost: { gold: 100 }, level: 1 },
      trade_routes: { name: 'Rutas de Convoy', effect: 'Desbloquea rutas lejanas', cost: { gold: 250 }, level: 2 },
      caravan_master: { name: 'Maestro de Convoyes', effect: 'Convoyes más frecuentes', cost: { gold: 400 }, level: 3 },
      merchant_guild: { name: 'Sindicato Mercante', effect: '+2 misiones simultáneas', cost: { gold: 600, relic: 1 }, level: 5 },
    },
  },
  military: {
    id: 'military',
    name: 'Doctrina de Guerra',
    icon: '🪖',
    techs: {
      sharp_blades: { name: 'Munición Perforante', effect: '+10% ATK tropas', cost: { gold: 150, ingots: 5 }, level: 1 },
      reinforced_armor: { name: 'Blindaje Compuesto', effect: '+10% DEF tropas', cost: { gold: 200, ingots: 8 }, level: 2 },
      tactics: { name: 'Doctrina Táctica', effect: '+15% en combate defensivo', cost: { gold: 350 }, level: 3 },
      elite_training: { name: 'Adiestramiento Veterano', effect: 'Desbloquea tropas élite', cost: { gold: 700, blueprint: 1 }, level: 5 },
    },
  },
};

// ---- FACCIONES ----
const FACTIONS = {
  knights_of_dawn: {
    id: 'knights_of_dawn',
    name: 'Cruzada del Alba',
    icon: '☀️',
    color: '#FFD700',
    bonus: { def: 0.1 }, // +10% defensa
    description: 'Orden fanática que jura defender los últimos bastiones. Bonus: +10% defensa.',
  },
  shadow_merchants: {
    id: 'shadow_merchants',
    name: 'Sindicato de la Sombra',
    icon: '🌙',
    color: '#4B0082',
    bonus: { commerce: 0.15 }, // +15% comercio
    description: 'Red de traficantes que prospera en la ruina. Bonus: +15% ganancias comerciales.',
  },
  iron_legion: {
    id: 'iron_legion',
    name: 'Legión de Hierro',
    icon: '🛡️',
    color: '#8B0000',
    bonus: { atk: 0.1 }, // +10% ataque
    description: 'Veteranos implacables forjados en guerra eterna. Bonus: +10% ataque.',
  },
  green_wardens: {
    id: 'green_wardens',
    name: 'Custodios del Páramo',
    icon: '☣️',
    color: '#228B22',
    bonus: { farming: 0.15 }, // +15% producción agrícola
    description: 'Bioadeptos que arrancan vida al suelo muerto. Bonus: +15% producción agrícola.',
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
  farmer: { id: 'farmer', name: 'Cultivador', icon: '🧑‍🌾', workBuildings: ['farm_plot', 'stable'] },
  woodcutter: { id: 'woodcutter', name: 'Chatarrero', icon: '🪓', workBuildings: ['sawmill'] },
  miner: { id: 'miner', name: 'Excavador', icon: '⛏️', workBuildings: ['mine', 'smithy'] },
  soldier: { id: 'soldier', name: 'Guardia', icon: '🪖', workBuildings: ['barracks', 'tower', 'wall'] },
  merchant: { id: 'merchant', name: 'Traficante', icon: '💰', workBuildings: ['market', 'tavern'] },
  builder: { id: 'builder', name: 'Ingeniero', icon: '🔨', workBuildings: [] }, // builds any building
};

const VILLAGER_NAMES = [
  'Kastor', 'Moria', 'Dagan', 'Sela', 'Brakk', 'Ilya',
  'Rukh', 'Thessa', 'Orlan', 'Vada', 'Crux', 'Nyra',
  'Solon', 'Edda', 'Varek', 'Lysa', 'Torvin', 'Ashka',
  'Remus', 'Zora', 'Halix', 'Mira', 'Oskan', 'Yeva',
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
    name: 'Fuego de Supresión',
    icon: '🎯',
    description: 'Reduce defensa enemiga un 20% por 1 turno',
    cooldown: 120000, // 2 min
    effect: { type: 'debuff_defense', value: 0.20 },
    requires: { archer: 5 },
  },
  battering_ram: {
    id: 'battering_ram',
    name: 'Carga de Demolición',
    icon: '💣',
    description: 'Inflige daño masivo a muros',
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
    name: 'Línea de Blindaje',
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
    name: 'Brote de los Vats',
    icon: '🧪',
    color: '#7ee87e',
    description: '+25% rendimiento de cultivos durante 24h',
    durationMs: SEASONAL_EVENT_DURATION_MS,
    multipliers: { farming: 0.25 },
  },
  harvest_festival: {
    id: 'harvest_festival',
    name: 'Convoy de Abundancia',
    icon: '📦',
    color: '#ffac30',
    description: '+20% precio de venta a convoyes y mercado',
    durationMs: SEASONAL_EVENT_DURATION_MS,
    multipliers: { commerce: 0.20 },
  },
  battle_frenzy: {
    id: 'battle_frenzy',
    name: 'Frenesí de Guerra',
    icon: '💥',
    color: '#ff6060',
    description: '+15% botín en PvP y PvE',
    durationMs: SEASONAL_EVENT_DURATION_MS,
    multipliers: { battle_loot: 0.15 },
  },
  golden_caravan: {
    id: 'golden_caravan',
    name: 'Convoy Dorado',
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
  green_thumb:        { id: 'green_thumb',        name: 'Mano Bioadepta',      icon: '🧪', desc: 'Cosechá 25 cultivos',                       event: 'harvest',     goal: 25,  reward: { kh: 30 } },
  farm_master:        { id: 'farm_master',        name: 'Maestro de Vats',     icon: '🧬', desc: 'Cosechá 100 cultivos',                      event: 'harvest',     goal: 100, reward: { kh: 100 } },
  builder_novice:     { id: 'builder_novice',     name: 'Aprendiz Ingeniero',  icon: '🔨', desc: 'Construí 5 edificios',                      event: 'build',       goal: 5,   reward: { kh: 15 } },
  city_planner:       { id: 'city_planner',       name: 'Arquitecto del Bastión', icon: '🏗️', desc: 'Construí 15 edificios',                  event: 'build',       goal: 15,  reward: { kh: 60 } },
  first_battle:       { id: 'first_battle',       name: 'Primer Combate',      icon: '💥', desc: 'Ganá tu primera batalla PvE',               event: 'battle_win',  goal: 1,   reward: { kh: 10 } },
  warlord:            { id: 'warlord',            name: 'Señor de la Guerra',  icon: '🛡️', desc: 'Ganá 10 batallas (PvE o PvP)',              event: 'battle_win',  goal: 10,  reward: { kh: 50 } },
  conqueror:          { id: 'conqueror',          name: 'Conquistador',        icon: '🏴', desc: 'Conquistá tu primer territorio',            event: 'conquest',    goal: 1,   reward: { kh: 25 } },
  empire:             { id: 'empire',             name: 'Imperio',             icon: '🎖️', desc: 'Conquistá 5 territorios',                    event: 'conquest',    goal: 5,   reward: { kh: 150 } },
  scholar:            { id: 'scholar',            name: 'Tecnoerudito',        icon: '🔬', desc: 'Completá 3 investigaciones',                event: 'research',    goal: 3,   reward: { kh: 40 } },
  rich_merchant:      { id: 'rich_merchant',      name: 'Traficante Rico',     icon: '💰', desc: 'Hacé 20 ventas a convoyes',                 event: 'sell',        goal: 20,  reward: { kh: 35 } },
  level_5:            { id: 'level_5',            name: 'Veterano',            icon: '⭐', desc: 'Alcanzá nivel 5',                           event: 'level_up',    goal: 5,   reward: { kh: 25 } },
  level_10:           { id: 'level_10',           name: 'Leyenda',             icon: '🌟', desc: 'Alcanzá nivel 10',                          event: 'level_up',    goal: 10,  reward: { kh: 100 } },
};

// ---- TORMENTAS DISFORMES (F2 idle) ----
// Sucesos aleatorios globales. stormService las programa con jitter (sin
// rotación fija): al no haber tormenta activa, cada tick tira un dado; la
// media de aparición es ~1 cada STORM_MEAN_GAP_MS. `modifiers` son deltas
// aditivos consumidos junto a eventService.getMultiplier en los mismos hot
// paths. `sealsConvoys` bloquea el comercio de convoyes mientras dura.
const STORM_MEAN_GAP_MS = 4 * 60 * 60 * 1000;   // media: una tormenta cada ~4h
const WARP_STORMS = {
  velo_estatico: {
    id: 'velo_estatico',
    name: 'Velo Estático',
    icon: '🌫️',
    color: '#7a5a8a',
    description: 'Interferencia disforme: −25% producción y convoyes sellados.',
    weight: 30,
    durationMs: [45, 90],          // minutos [min, max]
    modifiers: { farming: -0.25 },
    sealsConvoys: true,
  },
  marea_carmesi: {
    id: 'marea_carmesi',
    name: 'Marea Carmesí',
    icon: '🩸',
    color: '#b32821',
    description: 'La disformidad hierve: +30% ATK para todos… y algo se acerca.',
    weight: 20,
    durationMs: [30, 60],
    modifiers: { atk: 0.30 },
    spawnsWave: true,              // F3: dispara una defensa de oleada gratis
  },
  lluvia_de_energia: {
    id: 'lluvia_de_energia',
    name: 'Lluvia de Energía',
    icon: '⚡',
    color: '#4fd8c8',
    description: 'Fragmentos de energía pura: +50% KH en cosecha y venta.',
    weight: 20,
    durationMs: [30, 60],
    modifiers: { kh_bonus: 0.50 },
  },
  susurros_del_vacio: {
    id: 'susurros_del_vacio',
    name: 'Susurros del Vacío',
    icon: '👁️',
    color: '#4a4550',
    description: 'Voces en la estática: los aldeanos sufren, la investigación se acelera +50%.',
    weight: 20,
    durationMs: [60, 120],
    modifiers: { research_speed: 0.50, happiness: -10 },
  },
  calma_falsa: {
    id: 'calma_falsa',
    name: 'Calma Falsa',
    icon: '🕯️',
    color: '#d9a441',
    description: 'Nada ocurre. Eso es exactamente lo que preocupa a los augures…',
    weight: 10,
    durationMs: [20, 40],
    modifiers: {},
    hastensNext: true,             // la siguiente tormenta llega antes (½ gap)
  },
};

// ---- MAREA DISFORME (F3 idle — defensa por oleadas, 100% automática) ----
// El jugador PREPARA (muros, torres, trampas, guarnición, escuadra) y el
// server resuelve el run por rondas. Boss cada BOSS_EVERY oleadas = puerta
// de progresión con recompensas mayores.
const WAVE_CONFIG = {
  wavesPerRun: 3,            // oleadas por desafío
  bossEvery: 5,              // oleada jefe cada N
  roundCap: 30,              // rondas máximas por oleada (corta empates)
  basePower: 60,             // presupuesto de poder de la oleada 1
  powerGrowth: 1.18,         // crecimiento exponencial suave por oleada
  bossMultiplier: 2.2,       // poder extra del jefe
  garrisonLossOnDefeat: 0.06,// fracción de guarnición perdida al caer
  heroEnergyPerRound: 25,    // energía que gana cada héroe por ronda (skill a 100)
  rewards: {
    goldPerPower: 0.8,       // créditos por punto de poder derrotado
    khBase: 2,               // KH por oleada superada (vía awardTokens)
    khBossBonus: 6,          // KH extra por jefe derribado
    heroXpPerWave: 12,
    itemDropChance: 0.08,    // drop de HERO_ITEMS al superar un jefe
  },
};

// Horrores de la Marea — composición por peso; el presupuesto de poder de la
// oleada se gasta comprando unidades (power = coste). Nombres 100% originales.
const WAVE_ENEMIES = {
  carroneros: { id: 'carroneros', name: 'Carroñeros del Velo', icon: '🐀', power: 4,  hp: 12,  atk: 3,  weight: 50 },
  brutos:     { id: 'brutos',     name: 'Brutos Retorcidos',   icon: '🧟', power: 12, hp: 45,  atk: 8,  weight: 30 },
  aullador:   { id: 'aullador',   name: 'Aullador del Vacío',  icon: '👁️', power: 25, hp: 70,  atk: 18, weight: 15 },
  coloso:     { id: 'coloso',     name: 'Coloso de Ceniza',    icon: '🗿', power: 60, hp: 220, atk: 30, weight: 5 },
  // Jefes (solo en oleadas boss, elegido por rotación de oleada)
  boss_devorador: { id: 'boss_devorador', name: 'Devorador de Auroras', icon: '💀', power: 0, hp: 500, atk: 45, boss: true },
  boss_heraldo:   { id: 'boss_heraldo',   name: 'Heraldo de la Estática', icon: '🌩️', power: 0, hp: 380, atk: 60, boss: true },
};

// ---- HÉROES ----
// Restaurado tras el merge iso-rework (venía de la rama WiFOf; el merge lo perdió).
// heroService indexa por id: HEROES[hero_id]. `sprite` mapea a CharacterSprite.
const HERO_RARITIES = {
  common:    { name: 'Común',      color: '#9ca3af', border: '#6b7280', statMultiplier: 1.0, summonCost: 200,  weight: 55 },
  rare:      { name: 'Raro',       color: '#3b82f6', border: '#2563eb', statMultiplier: 1.3, summonCost: 500,  weight: 30 },
  epic:      { name: 'Épico',      color: '#a855f7', border: '#7c3aed', statMultiplier: 1.7, summonCost: 1000, weight: 12 },
  legendary: { name: 'Legendario', color: '#f59e0b', border: '#d97706', statMultiplier: 2.5, summonCost: 2000, weight: 3  },
};

const HEROES = {
  aria:   { id: 'aria',   name: 'Aria, Sargento Veterana',  class: 'warrior', rarity: 'common',    sprite: 'warrior',    baseStats: { atk: 14, def: 12, hp: 90,  spd: 8,  mgk: 2  }, passive: 'Fuego Certero: +15% ATK al atacar con ventaja numérica' },
  thorin: { id: 'thorin', name: 'Torgan Escudo de Acero',   class: 'warrior', rarity: 'epic',      sprite: 'knight',     baseStats: { atk: 18, def: 20, hp: 120, spd: 5,  mgk: 1  }, passive: 'Bastión: +30% DEF cuando HP < 50%' },
  lyra:   { id: 'lyra',   name: 'Lyra, Psíquica Menor',     class: 'mage',    rarity: 'common',    sprite: 'mage',       baseStats: { atk: 8,  def: 5,  hp: 55,  spd: 7,  mgk: 18 }, passive: 'Don Psíquico: sus poderes ignoran 10% de DEF enemiga' },
  zara:   { id: 'zara',   name: 'Zara, Bruja del Vacío',    class: 'mage',    rarity: 'legendary', sprite: 'wizard',     baseStats: { atk: 10, def: 6,  hp: 65,  spd: 9,  mgk: 30 }, passive: 'Maldición del Vacío: −20% ATK al enemigo objetivo durante 2 turnos' },
  finn:   { id: 'finn',   name: 'Finn el Explorador',       class: 'ranger',  rarity: 'common',    sprite: 'ranger',     baseStats: { atk: 12, def: 7,  hp: 65,  spd: 14, mgk: 3  }, passive: 'Tiro Preciso: +20% ATK contra enemigos a distancia' },
  elena:  { id: 'elena',  name: 'Elena, Francotiradora',    class: 'ranger',  rarity: 'rare',      sprite: 'explorer',   baseStats: { atk: 15, def: 8,  hp: 70,  spd: 18, mgk: 4  }, passive: 'Evasión: 15% de esquivar ataques cuerpo a cuerpo' },
  viktor: { id: 'viktor', name: 'Viktor el Custodio',       class: 'paladin', rarity: 'common',    sprite: 'guard',      baseStats: { atk: 10, def: 16, hp: 100, spd: 6,  mgk: 8  }, passive: 'Aura Protectora: aliados adyacentes +10% DEF' },
  seraph: { id: 'seraph', name: 'Serafín, Capellán de Guerra', class: 'paladin', rarity: 'epic',   sprite: 'adventurer', baseStats: { atk: 12, def: 20, hp: 130, spd: 7,  mgk: 14 }, passive: 'Letanía de Hierro: restaura 8% HP al inicio de cada ronda' },
  shadow: { id: 'shadow', name: 'Sombra, Infiltradora',     class: 'rogue',   rarity: 'common',    sprite: 'traveler',   baseStats: { atk: 16, def: 5,  hp: 55,  spd: 16, mgk: 5  }, passive: 'Golpe Silencioso: primer ataque hace +40% daño' },
  vex:    { id: 'vex',    name: 'Vex el Veloz',             class: 'rogue',   rarity: 'rare',      sprite: 'farmer',     baseStats: { atk: 20, def: 6,  hp: 60,  spd: 20, mgk: 6  }, passive: 'Ráfaga Doble: 25% de golpear dos veces por turno' },
};

const HERO_ITEMS = {
  iron_sword:    { id: 'iron_sword',    name: 'Cuchilla de Combate',   slot: 'weapon',    icon: '⚔️', bonuses: { atk: 6 },                    rarity: 'common', description: 'Hoja sierra estándar, forjada en la fundición del bastión' },
  magic_staff:   { id: 'magic_staff',   name: 'Báculo Psíquico',       slot: 'weapon',    icon: '🪄', bonuses: { mgk: 10, atk: 2 },           rarity: 'rare',   description: 'Canaliza el poder mental del portador en un flujo devastador' },
  hunters_bow:   { id: 'hunters_bow',   name: 'Rifle del Cazador',     slot: 'weapon',    icon: '🔫', bonuses: { atk: 5, spd: 3 },            rarity: 'common', description: 'Culata gastada por generaciones, silencioso y mortal' },
  shadow_dagger: { id: 'shadow_dagger', name: 'Daga Sombría',          slot: 'weapon',    icon: '🗡️', bonuses: { atk: 8, spd: 4 },            rarity: 'rare',   description: 'Acero negro que absorbe la luz del portador' },
  leather_armor: { id: 'leather_armor', name: 'Peto de Fibra',         slot: 'armor',     icon: '🧥', bonuses: { def: 6, hp: 15 },            rarity: 'common', description: 'Ligero y flexible, no entorpece el movimiento' },
  chainmail:     { id: 'chainmail',     name: 'Blindaje Compuesto',    slot: 'armor',     icon: '🛡️', bonuses: { def: 14, hp: 30 },           rarity: 'rare',   description: 'Capas de aleación forman una barrera impenetrable' },
  mage_robe:     { id: 'mage_robe',     name: 'Manto Psíquico',        slot: 'armor',     icon: '👘', bonuses: { def: 4, mgk: 8, hp: 20 },    rarity: 'rare',   description: 'Tejido con hilos que amplifican la energía mental' },
  speed_boots:   { id: 'speed_boots',   name: 'Botas Servoasistidas',  slot: 'accessory', icon: '👢', bonuses: { spd: 6 },                    rarity: 'common', description: 'Pistones de asistencia que permiten moverse como el viento' },
  power_ring:    { id: 'power_ring',    name: 'Anillo de Poder',       slot: 'accessory', icon: '💍', bonuses: { atk: 4, mgk: 4 },            rarity: 'rare',   description: 'Forjado en las fraguas de los señores de antaño' },
  lucky_charm:   { id: 'lucky_charm',   name: 'Amuleto de Fortuna',    slot: 'accessory', icon: '🍀', bonuses: { atk: 2, def: 2, hp: 10, spd: 2, mgk: 2 }, rarity: 'common', description: 'Talismán de hueso bendecido por un capellán errante' },
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
  HERO_RARITIES,
  HEROES,
  HERO_ITEMS,
  WARP_STORMS,
  STORM_MEAN_GAP_MS,
  WAVE_CONFIG,
  WAVE_ENEMIES,
};
