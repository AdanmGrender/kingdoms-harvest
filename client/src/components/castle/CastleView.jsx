import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import TechTreePanel from './TechTreePanel';
import FactionPanel from '../world/FactionPanel';
import TerritoryMapPanel from '../world/TerritoryMapPanel';

const BUILDING_DATA = {
  // Agricola
  farm_plot: { sprite: 'green_house', name: 'Parcela', zone: 'Agricola' },
  barn: { sprite: 'barn', name: 'Granero', zone: 'Agricola' },
  mill: { sprite: 'water_gear', name: 'Molino', zone: 'Agricola' },
  sawmill: { sprite: 'water_gear', name: 'Aserradero', zone: 'Agricola' },
  smithy: { sprite: 'settings', name: 'Herreria', zone: 'Agricola' },
  stable: { sprite: 'barn', name: 'Establo', zone: 'Agricola' },
  // Defensivo
  wall: { sprite: 'castle_gate', name: 'Muralla', zone: 'Defensiva' },
  tower: { sprite: 'castle_tower', name: 'Torre', zone: 'Defensiva' },
  barracks: { sprite: 'castle_flag', name: 'Cuartel', zone: 'Defensiva' },
  trap: { sprite: 'exclamation', name: 'Trampas', zone: 'Defensiva' },
  // Social
  tavern: { sprite: 'market_stall', name: 'Taberna', zone: 'Social' },
  market: { sprite: 'backpack', name: 'Mercado', zone: 'Social' },
  embassy: { sprite: 'castle_small', name: 'Embajada', zone: 'Social' },
  // Noble
  throne_room: { sprite: 'medal', name: 'Salon del Trono', zone: 'Noble' },
  library: { sprite: 'scroll', name: 'Biblioteca', zone: 'Noble' },
};

const ZONE_SPRITES = {
  'Agricola': 'green_house',
  'Defensiva': 'castle_gate',
  'Social': 'market_stall',
  'Noble': 'medal',
};

const BUILDABLE = [
  'farm_plot', 'barn', 'mill', 'sawmill', 'smithy', 'stable',
  'wall', 'tower', 'barracks', 'trap',
  'tavern', 'market', 'embassy',
  'library',
];

function BuildingCard({ building }) {
  const { upgradeBuilding } = useGameStore();
  const data = BUILDING_DATA[building.building_id];
  const isBuilding = building.is_building;

  return (
    <div className={`game-card ${isBuilding ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <SpriteIcon name={data?.sprite || 'castle'} size={40} />
        <div className="flex-1">
          <p className="font-bold text-sm">{data?.name || building.building_id}</p>
          <p className="text-xs text-gray-400">Nivel {building.level}</p>
          {isBuilding && (
            <p className="text-xs text-yellow-300 animate-pulse">En construccion...</p>
          )}
        </div>
        {!isBuilding && (
          <button
            onClick={() => upgradeBuilding(building.id)}
            className="btn-primary text-xs"
          >
            Mejorar
          </button>
        )}
      </div>
    </div>
  );
}

const ANIMAL_ICONS = { chicken: '🐔', cow: '🐄', sheep: '🐑' };
const ANIMAL_PRODUCTS = { chicken: '🥚 Huevo', cow: '🥛 Leche', sheep: '🧶 Lana' };

function AnimalCard({ animal }) {
  const { feedAnimal, collectAnimalProduct } = useGameStore();
  const now = new Date();
  const isReady = animal.is_fed && animal.next_production_at && new Date(animal.next_production_at) <= now;
  const isFeeding = animal.is_fed && !isReady;

  return (
    <div className="game-card flex items-center gap-3">
      <span className="text-3xl">{ANIMAL_ICONS[animal.animal_id] || '🐾'}</span>
      <div className="flex-1">
        <p className="font-bold text-sm">{animal.name}</p>
        <p className="text-xs text-gray-400">{ANIMAL_PRODUCTS[animal.animal_id] || 'Producto'}</p>
        {isFeeding && (
          <p className="text-[10px] text-yellow-300 animate-pulse">Produciendo...</p>
        )}
        {isReady && (
          <p className="text-[10px] text-green-400">¡Listo para recolectar!</p>
        )}
      </div>
      <div className="shrink-0">
        {isReady ? (
          <button onClick={() => collectAnimalProduct(animal.id)} className="btn-primary text-xs">
            Recolectar
          </button>
        ) : !animal.is_fed ? (
          <button onClick={() => feedAnimal(animal.id)} className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-lg transition-all">
            Alimentar
          </button>
        ) : (
          <span className="text-yellow-400 text-xs">⏳</span>
        )}
      </div>
    </div>
  );
}

function CastleView() {
  const { buildings, animals, loadBuildings, loadAnimals, buildNew } = useGameStore();
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('buildings');

  useEffect(() => {
    loadAnimals();
    loadBuildings();
  }, []);

  // Agrupar edificios por zona
  const zones = {};
  buildings.forEach((b) => {
    const data = BUILDING_DATA[b.building_id];
    const zone = data?.zone || 'Otro';
    if (!zones[zone]) zones[zone] = [];
    zones[zone].push(b);
  });

  const handleBuild = async (buildingId) => {
    setShowBuildMenu(false);
    await buildNew(buildingId);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medieval text-lg text-kingdom-gold flex items-center gap-2">
          <SpriteIcon name="castle_flag" size={24} /> Tu Castillo
        </h2>
        {activeTab === 'buildings' && (
          <button onClick={() => setShowBuildMenu(!showBuildMenu)} className="btn-primary text-xs">
            + Construir
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {[
          { id: 'buildings', label: '🏰 Edif.' },
          { id: 'animals',   label: '🐄 Animales' },
          { id: 'tech',      label: '🔬 Tech' },
          { id: 'factions',  label: '🛡️ Facción' },
          { id: 'world',     label: '🗺️ Mundo' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-kingdom-accent text-white'
                : 'bg-kingdom-blue/50 text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Animals tab */}
      {activeTab === 'animals' && (
        <div className="space-y-2">
          {animals.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">
              No tenés animales. Construí un Establo y comprá animales.
            </p>
          ) : (
            animals.map((a) => <AnimalCard key={a.id} animal={a} />)
          )}
        </div>
      )}

      {/* Tech tab */}
      {activeTab === 'tech' && <TechTreePanel />}

      {/* Factions tab */}
      {activeTab === 'factions' && <FactionPanel />}

      {/* World map (territories) */}
      {activeTab === 'world' && <TerritoryMapPanel />}

      {/* Buildings tab */}
      {activeTab === 'buildings' && <>

      {/* Menu de construccion */}
      {showBuildMenu && (
        <div className="game-card mb-4 animate-fade-in">
          <p className="text-sm font-bold mb-2">Construir nuevo edificio:</p>
          <div className="grid grid-cols-2 gap-2">
            {BUILDABLE.map((id) => {
              const data = BUILDING_DATA[id];
              return (
                <button
                  key={id}
                  onClick={() => handleBuild(id)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-kingdom-blue/50 text-left"
                >
                  <SpriteIcon name={data.sprite} size={28} />
                  <div>
                    <p className="text-xs font-bold">{data.name}</p>
                    <p className="text-[10px] text-gray-400">{data.zone}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Edificios por zona */}
      {Object.entries(zones).map(([zone, zoneBuildings]) => (
        <div key={zone} className="mb-4">
          <h3 className="text-sm text-gray-300 mb-2 font-bold flex items-center gap-1">
            <SpriteIcon name={ZONE_SPRITES[zone] || 'castle_flag'} size={18} />
            Zona {zone}
          </h3>
          <div className="flex flex-col gap-2">
            {zoneBuildings.map((b) => (
              <BuildingCard key={b.id} building={b} />
            ))}
          </div>
        </div>
      ))}

      {buildings.length === 0 && (
        <p className="text-gray-400 text-center py-8">Cargando edificios...</p>
      )}

      </> /* end buildings tab */}
    </div>
  );
}

export default CastleView;
