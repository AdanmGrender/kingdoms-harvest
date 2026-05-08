/**
 * OverlayManager: Renders the correct overlay panel based on gameStore.overlayState.
 */
import { useCallback, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon, { CharacterSprite } from '../ui/SpriteIcon';
import DialogPanel from './DialogPanel';
import CropSelectMenu from './CropSelectMenu';
import VillagerPanel from './VillagerPanel';
import WarPanel from './WarPanel';
import TroopManagementPanel from './TroopManagementPanel';
import CraftingPanel from './CraftingPanel';

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
    case 'crafting':
      return <CraftingPanel onClose={onClose} />;
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

function BuildingInfoPanel({ data, onClose }) {
  const { buildings, upgradeBuilding } = useGameStore();
  const meta = BUILDING_META[data.buildingId] || { name: data.buildingId, sprite: 'castle', zone: '', desc: '' };

  // Find the actual DB record for this building (match by buildingId + position if available)
  const record = buildings.find(b =>
    b.building_id === data.buildingId &&
    (data.posX == null || b.position_x === data.posX)
  ) || buildings.find(b => b.building_id === data.buildingId);

  const level = record?.level ?? data.level ?? 1;
  const isBuilding = record?.is_building ?? data.isBuilding ?? false;

  const UPGRADE_COSTS = [
    { wood: 20, stone: 10 },
    { wood: 50, stone: 30, iron: 5 },
    { wood: 100, stone: 80, iron: 20 },
    { wood: 200, stone: 150, iron: 50 },
  ];
  const upgradeCost = UPGRADE_COSTS[Math.min(level - 1, UPGRADE_COSTS.length - 1)];

  return (
    <div className="mx-2 mb-2 rounded-t-xl overflow-hidden"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30">
        <div className="flex items-center gap-3">
          <SpriteIcon name={meta.sprite} size={36} />
          <div>
            <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
              {meta.name}
            </h3>
            <p className="text-gray-400 text-[10px]">{meta.zone} · Nivel {level}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-4 py-3 space-y-3">
        <p className="text-gray-300 text-xs">{meta.desc}</p>

        {isBuilding ? (
          <div className="flex items-center gap-2 text-yellow-300 text-xs animate-pulse">
            <span>🔨</span><span>En construcción...</span>
          </div>
        ) : record ? (
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
        ) : null}
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
