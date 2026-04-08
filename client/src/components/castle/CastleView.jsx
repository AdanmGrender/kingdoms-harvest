import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

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

function CastleView() {
  const { buildings, loadBuildings, buildNew } = useGameStore();
  const [showBuildMenu, setShowBuildMenu] = useState(false);

  useEffect(() => {
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
        <button
          onClick={() => setShowBuildMenu(!showBuildMenu)}
          className="btn-primary text-xs"
        >
          + Construir
        </button>
      </div>

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
    </div>
  );
}

export default CastleView;
