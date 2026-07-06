/**
 * OverlayManager: Renders the correct overlay panel based on gameStore.overlayState.
 */
import { useCallback, useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon, { CharacterSprite } from '../ui/SpriteIcon';
import DialogPanel from './DialogPanel';
import CropSelectMenu from './CropSelectMenu';
import VillagerPanel from './VillagerPanel';
import WarPanel from './WarPanel';
import TroopManagementPanel from './TroopManagementPanel';
import MetaPanel from '../meta/MetaPanel';
import MissionsPanel from './MissionsPanel';
import SettingsPanel from './SettingsPanel';
import WaveDefensePanel from './WaveDefensePanel';
import SquadPanel from './SquadPanel';
import SystemMapPanel from './SystemMapPanel';
// Parallel panels from WiFOf merge
import CraftingPanel from './CraftingPanel';
import HeroPanel from './HeroPanel';
import CommerceView from '../commerce/CommerceView';
import WorldEventPanel from './WorldEventPanel';
import AchievementPanel from './AchievementPanel';
import MarketplacePanel from './MarketplacePanel';
import GuildPanel from './GuildPanel';
import SeasonalPanel from './SeasonalPanel';
import PrestigePanel from './PrestigePanel';
import WithdrawalPanel from './WithdrawalPanel';
import TechTreePanel from '../castle/TechTreePanel';
import FactionSelectPanel from './FactionSelectPanel';

export default function OverlayManager() {
  const overlayState = useGameStore((s) => s.overlayState);
  const clearOverlay = useGameStore((s) => s.clearOverlay);

  // Listen for EventBridge overlay events
  useEffect(() => {
    const handleOpen = ({ type, data }) => {
      useGameStore.getState().setOverlay(type, data);
    };
    const handleClose = () => {
      useGameStore.getState().clearOverlay();
    };

    EventBridge.on('overlay:open', handleOpen);
    EventBridge.on('overlay:close', handleClose);

    return () => {
      EventBridge.off('overlay:open', handleOpen);
      EventBridge.off('overlay:close', handleClose);
    };
  }, []);

  // Listen for entity selection (RTS tap-to-select)
  useEffect(() => {
    const handleSelection = ({ type, data }) => {
      switch (type) {
        case 'npc':
          useGameStore.getState().setOverlay('dialog', data);
          break;
        case 'farm_plot': {
          // Match visual plot index to DB plot record
          const plots = useGameStore.getState().plots;
          const dbPlot = plots[data.plotIndex] || plots.find(p => p.id === data.plotId);
          const plotData = { ...data, plotId: dbPlot?.id, state: dbPlot?.state || data.state };
          if (plotData.state === 'ready') {
            useGameStore.getState().setOverlay('harvest', plotData);
          } else if (plotData.state === 'empty') {
            useGameStore.getState().setOverlay('cropSelect', plotData);
          } else {
            useGameStore.getState().setOverlay('cropSelect', plotData);
          }
          break;
        }
        case 'building':
          useGameStore.getState().setOverlay('building', data);
          break;
        case 'animal': {
          // Match visual animal to DB record
          const animals = useGameStore.getState().animals;
          const dbAnimal = animals.find(a => a.animal_id === data.animalType) || animals[0];
          const animalData = { ...data, animalId: dbAnimal?.id, name: dbAnimal?.name };
          useGameStore.getState().setOverlay('animal', animalData);
          break;
        }
        case 'villager':
          useGameStore.getState().setOverlay('villager', data);
          break;
        case 'war_gate':
          useGameStore.getState().setOverlay('combat', data);
          break;
        default:
          break;
      }
    };

    const handleDeselection = () => {
      useGameStore.getState().clearOverlay();
    };

    EventBridge.on('entity:selected', handleSelection);
    EventBridge.on('entity:deselected', handleDeselection);
    return () => {
      EventBridge.off('entity:selected', handleSelection);
      EventBridge.off('entity:deselected', handleDeselection);
    };
  }, []);

  const handleClose = useCallback(() => {
    clearOverlay();
    EventBridge.emit('overlay:close');
  }, [clearOverlay]);

  if (!overlayState?.type) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
        {renderPanel(overlayState, handleClose)}
      </div>
    </div>
  );
}

function renderPanel(overlayState, onClose) {
  switch (overlayState.type) {
    case 'dialog':
      return <DialogPanel data={overlayState.data} onClose={onClose} />;
    case 'cropSelect':
      return <CropSelectMenu data={overlayState.data} onClose={onClose} />;
    case 'building':
      return <BuildingInfoPanel data={overlayState.data} onClose={onClose} />;
    case 'villager':
      return <VillagerPanel data={overlayState.data} onClose={onClose} />;
    case 'animal':
      return <AnimalPanel data={overlayState.data} onClose={onClose} />;
    case 'combat':
      return <WarPanel data={overlayState.data} onClose={onClose} />;
    case 'troops':
      return <TroopManagementPanel data={overlayState.data} onClose={onClose} />;
    case 'harvest':
      return <HarvestPanel data={overlayState.data} onClose={onClose} />;
    case 'meta':
      return <MetaPanel data={overlayState.data} onClose={onClose} />;
    case 'missions':
      return <MissionsPanel onClose={onClose} />;
    case 'settings':
      return <SettingsPanel onClose={onClose} />;
    case 'waves':
      return <WaveDefensePanel onClose={onClose} />;
    case 'squad':
      return <SquadPanel onClose={onClose} />;
    case 'system':
      return <SystemMapPanel onClose={onClose} />;
    case 'crafting':
      return <CraftingPanel onClose={onClose} />;
    case 'heroes':
      return <HeroPanel onClose={onClose} />;
    case 'world_event':
      return <WorldEventPanel data={overlayState.data} onClose={onClose} />;
    case 'achievements':
      return <AchievementPanel onClose={onClose} />;
    case 'marketplace':
      return <MarketplacePanel onClose={onClose} />;
    case 'guild':
      return <GuildPanel onClose={onClose} />;
    case 'seasonal':
      return <SeasonalPanel onClose={onClose} />;
    case 'prestige':
      return <PrestigePanel onClose={onClose} />;
    case 'withdrawal':
      return <WithdrawalPanel onClose={onClose} />;
    case 'tech':
      return (
        <GenericPanel title="Árbol de Investigación" onClose={onClose}>
          <TechTreePanel />
        </GenericPanel>
      );
    case 'faction_select':
      return <FactionSelectPanel onClose={onClose} />;
    default:
      return (
        <GenericPanel title={overlayState.type} onClose={onClose}>
          <p className="text-gray-300 text-sm">Panel: {overlayState.type}</p>
        </GenericPanel>
      );
  }
}

// ─── Simple inline panels (will be expanded later) ───

function GenericPanel({ title, onClose, children }) {
  return (
    <div className="mx-2 mb-2 p-4 rounded-t-xl"
      style={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          {title}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>
      {children}
    </div>
  );
}

const BUILDING_META = {
  farm_plot:   { name: 'Parcela',        sprite: 'green_house',  zone: 'Agrícola',  desc: 'Cultiva trigo, zanahoria, papa y más.' },
  barn:        { name: 'Granero',        sprite: 'barn',         zone: 'Agrícola',  desc: 'Almacena recursos del campo.' },
  mill:        { name: 'Molino',         sprite: 'water_gear',   zone: 'Agrícola',  desc: 'Procesa trigo en harina y pan.' },
  sawmill:     { name: 'Aserradero',     sprite: 'water_gear',   zone: 'Agrícola',  desc: 'Convierte madera en tablones.' },
  smithy:      { name: 'Herrería',       sprite: 'settings',     zone: 'Agrícola',  desc: 'Forja hierro en lingotes y herramientas.' },
  stable:      { name: 'Establo',        sprite: 'barn',         zone: 'Agrícola',  desc: 'Cría animales para obtener productos.' },
  wall:        { name: 'Muralla',        sprite: 'castle_gate',  zone: 'Defensiva', desc: 'Protege el reino de ataques.' },
  tower:       { name: 'Torre',          sprite: 'castle_tower', zone: 'Defensiva', desc: 'Aumenta la defensa del castillo.' },
  barracks:    { name: 'Cuartel',        sprite: 'castle_flag',  zone: 'Defensiva', desc: 'Entrena tropas para la batalla.' },
  trap:        { name: 'Trampas',        sprite: 'exclamation',  zone: 'Defensiva', desc: 'Ralentiza a los atacantes.' },
  tavern:      { name: 'Taberna',        sprite: 'market_stall', zone: 'Social',    desc: 'Aumenta la felicidad de los aldeanos.' },
  market:      { name: 'Mercado',        sprite: 'backpack',     zone: 'Social',    desc: 'Comercia recursos con caravanas.' },
  embassy:     { name: 'Embajada',       sprite: 'castle_small', zone: 'Social',    desc: 'Gestiona relaciones diplomáticas.' },
  throne_room: { name: 'Sala del Trono', sprite: 'medal',        zone: 'Noble',     desc: 'Centro de poder del reino. Aumenta el nivel.' },
  library:     { name: 'Biblioteca',     sprite: 'scroll',       zone: 'Noble',     desc: 'Investiga tecnologías para el reino.' },
};

// Approximate construction durations (seconds) per building — used for progress bar estimate
const CONSTRUCTION_DURATION = {
  barn: 30, mill: 60, wall: 20, tower: 90, barracks: 90,
  tavern: 60, market: 60, embassy: 120, throne_room: 180,
  library: 120, stable: 60, smithy: 90, sawmill: 60, trap: 30,
};

// Scaffold accent colour per building type — mirrors Building.js CONSTRUCTION_TINTS
const CONSTRUCTION_ACCENT = {
  barn: '#d4a84b', mill: '#9ca3af', wall: '#9ca3af', tower: '#8a8fa3',
  barracks: '#ef4444', tavern: '#d97706', market: '#fbbf24',
  throne_room: '#ffd700', library: '#3b82f6', stable: '#c97706',
  smithy: '#6b7280', sawmill: '#a16207', embassy: '#e2e8f0',
  trap: '#f97316', default: '#d4a84b',
};

function ConstructionView({ record, meta, onClose }) {
  const [msLeft, setMsLeft] = useState(0);
  const [workers, setWorkers] = useState(0);

  // Live countdown
  useEffect(() => {
    if (!record?.build_complete_at) return;
    const tick = () => setMsLeft(Math.max(0, new Date(record.build_complete_at).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [record?.build_complete_at]);

  // Worker count from Phaser via EventBridge
  useEffect(() => {
    const handler = ({ buildingId, posX, posY, occupantCount }) => {
      if (buildingId === record?.building_id &&
          (posX == null || posX === record?.position_x)) {
        setWorkers(occupantCount);
      }
    };
    EventBridge.on('building:occupancyChanged', handler);
    return () => EventBridge.off('building:occupancyChanged', handler);
  }, [record?.building_id, record?.position_x]);

  const totalSecs = CONSTRUCTION_DURATION[record?.building_id] ?? 60;
  const secsLeft  = Math.ceil(msLeft / 1000);
  const mins      = Math.floor(secsLeft / 60);
  const secs      = secsLeft % 60;
  const timeStr   = msLeft <= 0 ? '¡Listo!' : `${mins}m ${secs.toString().padStart(2, '0')}s`;
  const progress  = Math.min(100, Math.max(0, Math.round(((totalSecs - secsLeft) / totalSecs) * 100)));
  const accent    = CONSTRUCTION_ACCENT[record?.building_id] || CONSTRUCTION_ACCENT.default;

  return (
    <div className="mx-2 mb-2 rounded-t-xl overflow-hidden"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: `1px solid ${accent}50` }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30"
        style={{ background: `linear-gradient(135deg, rgba(22,33,62,0.9), ${accent}22)` }}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔨</span>
          <div>
            <h3 className="text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif', color: accent }}>
              Construyendo: {meta.name}
            </h3>
            <p className="text-gray-400 text-[10px]">{meta.zone}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Countdown */}
        <div className="text-center">
          <p className="text-gray-500 text-[10px] mb-1 uppercase tracking-wide">Tiempo restante</p>
          <p className="text-2xl font-bold" style={{
            fontFamily: 'MedievalSharp, serif',
            color: msLeft <= 0 ? '#4ade80' : accent,
          }}>
            {timeStr}
          </p>
        </div>

        {/* Progress bar */}
        <div>
          <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accent}88, ${accent})` }}
            />
          </div>
          <p className="text-gray-600 text-[9px] text-right mt-0.5">{progress}% completado</p>
        </div>

        {/* Workers */}
        <div className="flex items-center justify-between rounded-lg px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-gray-400 text-xs">Constructores presentes</span>
          <span className="font-bold text-xs" style={{ color: workers > 0 ? '#4ade80' : '#6b7280' }}>
            {workers > 0 ? `${workers} 👷` : '—'}
          </span>
        </div>

        <p className="text-gray-600 text-[10px] text-center italic">
          Los constructores aceleran la obra automáticamente
        </p>
      </div>
    </div>
  );
}

const COMMERCE_BUILDINGS = new Set(['market', 'tavern', 'embassy']);

const UPGRADE_COSTS = [
  { wood: 20, stone: 10 },
  { wood: 50, stone: 30, iron: 5 },
  { wood: 100, stone: 80, iron: 20 },
  { wood: 200, stone: 150, iron: 50 },
];

function BuildingInfoPanel({ data, onClose }) {
  const { buildings, upgradeBuilding } = useGameStore();
  const meta = BUILDING_META[data.buildingId] || { name: data.buildingId, sprite: 'castle', zone: '', desc: '' };

  const record = buildings.find(b =>
    b.building_id === data.buildingId &&
    (data.posX == null || b.position_x === data.posX)
  ) || buildings.find(b => b.building_id === data.buildingId);

  const level = record?.level ?? data.level ?? 1;
  const isBuilding = record?.is_building ?? data.isBuilding ?? false;

  if (isBuilding) {
    return <ConstructionView record={record} meta={meta} onClose={onClose} />;
  }

  const isCommerce = COMMERCE_BUILDINGS.has(data.buildingId);
  const upgradeCost = UPGRADE_COSTS[Math.min(level - 1, UPGRADE_COSTS.length - 1)];

  return (
    <div className="mx-2 mb-2 rounded-t-xl overflow-hidden"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30">
        <div className="flex items-center gap-3">
          <SpriteIcon name={meta.sprite} size={32} />
          <div>
            <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
              {meta.name}
            </h3>
            <p className="text-gray-400 text-[10px]">{meta.zone} · Nivel {level}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-4 py-3">
        {isCommerce ? (
          /* Commerce buildings: show full trade interface */
          <CommerceView buildingId={data.buildingId} />
        ) : (
          /* Generic buildings: description + upgrade */
          <div className="space-y-3">
            <p className="text-gray-300 text-xs">{meta.desc}</p>
            {data.buildingId === 'library' && (
              <button
                onClick={() => { useGameStore.getState().setOverlay('tech'); onClose(); }}
                className="w-full py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)' }}
              >
                🔬 Árbol de Investigación
              </button>
            )}
            {record && (
              <button
                onClick={() => { upgradeBuilding(record.id); onClose(); }}
                className="w-full py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #b45309, #d97706)' }}
              >
                ⬆ Mejorar a Nivel {level + 1}
                <span className="ml-2 opacity-75 text-[10px]">
                  🪵{upgradeCost.wood} 🪨{upgradeCost.stone}{upgradeCost.iron ? ` ⛏️${upgradeCost.iron}` : ''}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Upgrade button for commerce buildings too, collapsed */}
        {isCommerce && record && (
          <details className="mt-3">
            <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-300">
              Mejorar edificio ▸
            </summary>
            <button
              onClick={() => { upgradeBuilding(record.id); onClose(); }}
              className="w-full mt-2 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #b45309, #d97706)' }}
            >
              ⬆ Mejorar a Nivel {level + 1}
              <span className="ml-2 opacity-75 text-[10px]">
                🪵{upgradeCost.wood} 🪨{upgradeCost.stone}{upgradeCost.iron ? ` ⛏️${upgradeCost.iron}` : ''}
              </span>
            </button>
          </details>
        )}
      </div>
    </div>
  );
}

const ANIMAL_META = {
  chicken: { icon: '🐔', name: 'Gallina',  product: '🥚 Huevo',  productName: 'Huevos' },
  cow:     { icon: '🐄', name: 'Vaca',     product: '🥛 Leche',  productName: 'Leche'  },
  sheep:   { icon: '🐑', name: 'Oveja',    product: '🧶 Lana',   productName: 'Lana'   },
};

function AnimalPanel({ data, onClose }) {
  const animalType = data.animalType || data.animalId || 'animal';
  const meta = ANIMAL_META[animalType] || { icon: '🐾', name: animalType, product: '📦 Producto', productName: 'Producto' };
  const displayName = data.name || meta.name;

  const now = new Date();
  const isReady = data.productionReady || (data.nextProductionAt && new Date(data.nextProductionAt) <= now);
  const isFed = data.isFed ?? data.is_fed ?? false;

  const handleFeed = async () => {
    await useGameStore.getState().feedAnimal(data.animalId || data.id);
    onClose();
  };
  const handleCollect = async () => {
    await useGameStore.getState().collectAnimalProduct(data.animalId || data.id);
    onClose();
  };

  return (
    <div className="mx-2 mb-2 rounded-t-xl overflow-hidden"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
              {displayName}
            </h3>
            <p className="text-gray-400 text-[10px]">{meta.product}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>
      <div className="px-4 py-3">
        {isReady && (
          <p className="text-green-400 text-xs mb-3">¡{meta.productName} lista para recolectar!</p>
        )}
        {isFed && !isReady && (
          <p className="text-yellow-300 text-xs mb-3 animate-pulse">Produciendo {meta.productName}...</p>
        )}
        {!isFed && (
          <p className="text-gray-400 text-xs mb-3">Necesita comida para producir.</p>
        )}
        <div className="flex gap-2">
          {isReady ? (
            <button onClick={handleCollect}
              className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #15803d, #16a34a)' }}>
              {meta.product} Recolectar
            </button>
          ) : (
            <button onClick={handleFeed} disabled={isFed}
              className={`flex-1 py-2 rounded-lg text-xs font-bold text-white ${isFed ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ background: 'linear-gradient(135deg, #a16207, #ca8a04)' }}>
              🌽 {isFed ? 'Ya alimentada' : 'Alimentar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const CROP_META = {
  wheat:   { icon: '🌾', name: 'Trigo',    tokens: 2 },
  carrot:  { icon: '🥕', name: 'Zanahoria', tokens: 2 },
  potato:  { icon: '🥔', name: 'Papa',     tokens: 2 },
  tomato:  { icon: '🍅', name: 'Tomate',   tokens: 3 },
  corn:    { icon: '🌽', name: 'Maíz',     tokens: 3 },
  pumpkin: { icon: '🎃', name: 'Calabaza', tokens: 4 },
  grape:   { icon: '🍇', name: 'Uva',      tokens: 4 },
};

const QUALITY_COLORS = {
  normal: 'text-gray-300',
  good:   'text-green-400',
  great:  'text-blue-400',
  perfect:'text-yellow-300',
};

function HarvestPanel({ data, onClose }) {
  const handleHarvest = async () => {
    const plotId = data.plotId || data.plotIndex;
    await useGameStore.getState().harvestCrop(plotId);
    onClose();
  };

  const crop = CROP_META[data.cropId] || { icon: '🌱', name: data.cropId || 'Cultivo', tokens: 2 };
  const quality = data.quality || 'normal';
  const qualityLabel = { normal: 'Normal', good: 'Buena', great: 'Excelente', perfect: '¡Perfecta!' };

  return (
    <div className="mx-2 mb-2 rounded-t-xl overflow-hidden"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{crop.icon}</span>
          <div>
            <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
              ¡Cosecha lista!
            </h3>
            <p className="text-gray-400 text-[10px]">Parcela #{(data.plotIndex ?? 0) + 1} · {crop.name}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Calidad:</span>
          <span className={`text-xs font-bold ${QUALITY_COLORS[quality] || 'text-gray-300'}`}>
            {qualityLabel[quality] || quality}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Tokens:</span>
          <span className="text-purple-400 text-xs font-bold">+{crop.tokens} KH 💎</span>
        </div>
        <button
          className="w-full py-2.5 rounded-lg text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #15803d, #16a34a)' }}
          onClick={handleHarvest}
        >
          {crop.icon} Cosechar {crop.name}
        </button>
      </div>
    </div>
  );
}
