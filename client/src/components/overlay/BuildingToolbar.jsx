/**
 * BuildingToolbar: Bottom toolbar for selecting buildings to place in RTS mode.
 * Shows available building types with icons, names, and costs.
 */
import { useState, useEffect, useCallback } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

function QuickNavButtons() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  const achievements = useGameStore((s) => s.achievements);
  const claimableCount = achievements.filter((a) => a.unlocked && !a.claimed).length;

  const btn = (label, type, style) => (
    <button
      key={type}
      onClick={() => setOverlay(type, {})}
      className="relative px-3 py-1 rounded-t-lg text-[11px] font-bold"
      style={style}
    >
      {label}
      {claimableCount > 0 && type === 'achievements' && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
          {claimableCount}
        </span>
      )}
    </button>
  );

  return (
    <>
      {btn('⚔️ Héroes',   'heroes',       { background: 'rgba(22,33,62,0.9)', border: '1px solid rgba(168,85,247,0.4)', borderBottom: 'none', color: '#d8b4fe' })}
      {btn('🏆 Logros',   'achievements', { background: 'rgba(22,33,62,0.9)', border: '1px solid rgba(234,179,8,0.4)',  borderBottom: 'none', color: '#fde047' })}
      {btn('🏷️ Mercado',  'marketplace',  { background: 'rgba(22,33,62,0.9)', border: '1px solid rgba(59,130,246,0.4)', borderBottom: 'none', color: '#93c5fd' })}
      {btn('🛡️ Gremio',   'guild',        { background: 'rgba(22,33,62,0.9)', border: '1px solid rgba(239,68,68,0.4)',  borderBottom: 'none', color: '#fca5a5' })}
      {btn('🌸 Temporada','seasonal',     { background: 'rgba(22,33,62,0.9)', border: '1px solid rgba(74,222,128,0.4)', borderBottom: 'none', color: '#86efac' })}
      {btn('⚔️ Guerra',   'combat',       { background: 'rgba(22,33,62,0.9)', border: '1px solid rgba(239,68,68,0.4)',  borderBottom: 'none', color: '#fca5a5' })}
      {btn('⭐ Prestige', 'prestige',     { background: 'rgba(22,33,62,0.9)', border: '1px solid rgba(250,204,21,0.4)', borderBottom: 'none', color: '#fbbf24' })}
      {btn('💸 Retiro',   'withdrawal',   { background: 'rgba(22,33,62,0.9)', border: '1px solid rgba(253,224,71,0.4)', borderBottom: 'none', color: '#fde047' })}
    </>
  );
}

// Building categories with their building IDs
const CATEGORIES = [
  {
    id: 'agricultural',
    name: 'Granja',
    icon: '🌾',
    buildings: ['farm_plot', 'barn', 'mill', 'sawmill', 'smithy', 'stable', 'house', 'mine'],
  },
  {
    id: 'defensive',
    name: 'Defensa',
    icon: '🛡️',
    buildings: ['wall', 'tower', 'barracks', 'trap'],
  },
  {
    id: 'social',
    name: 'Social',
    icon: '🏪',
    buildings: ['tavern', 'market', 'embassy'],
  },
  {
    id: 'noble',
    name: 'Noble',
    icon: '👑',
    buildings: ['throne_room', 'library'],
  },
];

// Building config imported from shared (mirrored here for UI)
// In production this would come from server/shared config
const BUILDING_INFO = {
  farm_plot: { name: 'Parcela', icon: '🌱', cost: { wood: 10, stone: 5 }, tileIndex: 14 },
  barn: { name: 'Granero', icon: '🏚️', cost: { wood: 30, stone: 15 }, tileIndex: 0 },
  mill: { name: 'Molino', icon: '🏭', cost: { wood: 50, stone: 30, iron: 10 }, tileIndex: 1 },
  sawmill: { name: 'Aserradero', icon: '🪚', cost: { wood: 40, stone: 20, iron: 15 }, tileIndex: 11 },
  smithy: { name: 'Herrería', icon: '⚒️', cost: { wood: 30, stone: 50, iron: 25 }, tileIndex: 10 },
  stable: { name: 'Establo', icon: '🐴', cost: { wood: 60, stone: 20 }, tileIndex: 9 },
  house: { name: 'Casa', icon: '🏠', cost: { wood: 20, stone: 10 }, tileIndex: 0 },
  mine: { name: 'Mina', icon: '⛏️', cost: { wood: 30, stone: 40 }, tileIndex: 0 },
  wall: { name: 'Muralla', icon: '🧱', cost: { stone: 50, wood: 20 }, tileIndex: 2 },
  tower: { name: 'Torre', icon: '🗼', cost: { stone: 80, iron: 20 }, tileIndex: 3 },
  barracks: { name: 'Cuartel', icon: '⚔️', cost: { wood: 60, stone: 40, iron: 20 }, tileIndex: 4 },
  trap: { name: 'Trampas', icon: '🪤', cost: { wood: 20, iron: 30 }, tileIndex: 12 },
  tavern: { name: 'Taberna', icon: '🍺', cost: { wood: 40, stone: 20 }, tileIndex: 5 },
  market: { name: 'Mercado', icon: '🏪', cost: { wood: 50, stone: 30 }, tileIndex: 6 },
  embassy: { name: 'Embajada', icon: '🏛️', cost: { stone: 100, iron: 30, gold: 200 }, tileIndex: 13 },
  throne_room: { name: 'Trono', icon: '👑', cost: { stone: 100, iron: 50, gold: 100 }, tileIndex: 7 },
  library: { name: 'Biblioteca', icon: '📚', cost: { wood: 40, stone: 60, gold: 50 }, tileIndex: 8 },
};

const RESOURCE_ICONS = {
  wood: '🪵',
  stone: '🪨',
  iron: '⛏️',
  gold: '🪙',
};

export default function BuildingToolbar() {
  const [activeCategory, setActiveCategory] = useState('agricultural');
  const [isPlacing, setIsPlacing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const resources = useGameStore((s) => s.resources);

  useEffect(() => {
    const handlePlacementStarted = () => setIsPlacing(true);
    const handlePlacementEnded = () => setIsPlacing(false);

    EventBridge.on('placement:started', handlePlacementStarted);
    EventBridge.on('placement:ended', handlePlacementEnded);

    return () => {
      EventBridge.off('placement:started', handlePlacementStarted);
      EventBridge.off('placement:ended', handlePlacementEnded);
    };
  }, []);

  const canAfford = useCallback((cost) => {
    if (!resources) return false;
    for (const [resource, amount] of Object.entries(cost)) {
      // resources[key] is { amount, capacity }, not a bare number
      const playerAmount = resources[resource]?.amount ?? 0;
      if (playerAmount < amount) return false;
    }
    return true;
  }, [resources]);

  const handleSelectBuilding = (buildingId) => {
    const info = BUILDING_INFO[buildingId];
    if (!info || !canAfford(info.cost)) return;

    EventBridge.emit('building:startPlacement', {
      buildingId,
      tileIndex: info.tileIndex,
    });
  };

  const handleCancelPlacement = () => {
    EventBridge.emit('building:cancelPlacement');
  };

  const handleConfirmPlacement = () => {
    EventBridge.emit('building:confirmPlacement');
  };

  // During placement, show confirm/cancel buttons
  if (isPlacing) {
    return (
      <div className="absolute bottom-4 left-0 right-0 z-40 flex justify-center gap-3 px-4">
        <button
          onClick={handleCancelPlacement}
          className="px-6 py-3 rounded-lg text-white font-bold text-sm"
          style={{ background: 'rgba(220, 38, 38, 0.9)', border: '1px solid rgba(255,100,100,0.5)' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirmPlacement}
          className="px-6 py-3 rounded-lg text-white font-bold text-sm"
          style={{ background: 'rgba(22, 163, 74, 0.9)', border: '1px solid rgba(100,255,100,0.5)' }}
        >
          Confirmar
        </button>
      </div>
    );
  }

  const category = CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none">
      {/* Toggle button */}
      <div className="flex justify-center gap-2 pointer-events-auto mb-1">
        <QuickNavButtons />
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-1 rounded-t-lg text-xs text-yellow-300 font-bold"
          style={{ background: 'rgba(22, 33, 62, 0.9)', border: '1px solid rgba(255, 215, 0, 0.3)', borderBottom: 'none' }}
        >
          {isExpanded ? '▼ Cerrar' : '▲ Construir'}
        </button>
      </div>

      {isExpanded && (
        <div className="pointer-events-auto" style={{ background: 'rgba(22, 33, 62, 0.95)', borderTop: '1px solid rgba(255, 215, 0, 0.3)' }}>
          {/* Category tabs */}
          <div className="flex border-b border-yellow-900/30">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-1 py-2 text-xs font-bold transition-colors ${
                  activeCategory === cat.id
                    ? 'text-yellow-400 border-b-2 border-yellow-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* Building grid */}
          <div className="p-2 flex gap-2 overflow-x-auto">
            {category?.buildings.map(buildingId => {
              const info = BUILDING_INFO[buildingId];
              if (!info) return null;
              const affordable = canAfford(info.cost);

              return (
                <button
                  key={buildingId}
                  onClick={() => handleSelectBuilding(buildingId)}
                  disabled={!affordable}
                  className={`flex-shrink-0 w-[84px] p-2 rounded-lg text-center transition-all ${
                    affordable
                      ? 'hover:bg-yellow-900/30 active:scale-95'
                      : 'opacity-40'
                  }`}
                  style={{ border: '1px solid rgba(255, 215, 0, 0.15)' }}
                >
                  <div className="text-2xl mb-1">{info.icon}</div>
                  <div className="text-[10px] text-gray-200 font-bold leading-tight"
                    style={{ wordBreak: 'break-word', hyphens: 'auto' }}>
                    {info.name}
                  </div>
                  <div className="text-[9px] text-gray-400 mt-0.5">
                    {Object.entries(info.cost).map(([res, amt]) => (
                      <span key={res} className="mr-1">
                        {RESOURCE_ICONS[res] || res}{amt}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
