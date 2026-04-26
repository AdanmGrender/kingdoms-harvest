import React, { useEffect, useState, useMemo } from 'react';
import useGameStore from '../../store/gameStore';

const TYPE_ICON = {
  plains:   '🌾',
  forest:   '🌲',
  mountain: '⛰️',
  swamp:    '🌫️',
  coast:    '🌊',
  ruins:    '🏛️',
};

const FALLBACK_BORDER = '#3b3b5e';

/**
 * TerritoryMapPanel — 3×3 grid of world territories. Each tile shows owner
 * faction color, type icon, defense strength, and a small "Atacar" button
 * that uses ALL current troops as the army (simple flow for now).
 */
export default function TerritoryMapPanel() {
  const {
    territories, troops, player,
    loadTerritories, loadTroops, attackTerritory,
  } = useGameStore();
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadTerritories();
    loadTroops();
  }, []);

  const grid = useMemo(() => {
    // Bucket territories by (x,y) — assumes 3x3 grid from seed
    const lookup = new Map();
    for (const t of territories) lookup.set(`${t.grid_x},${t.grid_y}`, t);
    const cells = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        cells.push(lookup.get(`${x},${y}`) || null);
      }
    }
    return cells;
  }, [territories]);

  const handleAttack = async (territory) => {
    // Send EVERY available troop. A future iteration could let the player
    // pick a subset like in CombatView, but the world-map flow benefits
    // from being one-tap-to-attack.
    const army = {};
    for (const t of troops || []) {
      if (t.quantity > 0) army[t.troop_id] = t.quantity;
    }
    if (Object.keys(army).length === 0) {
      useGameStore.getState().addNotification(
        'No tenés tropas. Entrená en Cuartel primero.', 'error',
      );
      return;
    }
    const res = await attackTerritory(territory.id, army);
    if (res) setResult({ territory, ...res });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 text-center">
        Mapa del mundo — conquistá territorios para tu facción
      </p>

      {/* 3×3 grid */}
      <div className="grid grid-cols-3 gap-2">
        {grid.map((t, i) => {
          if (!t) return <div key={i} className="aspect-square bg-kingdom-blue/20 rounded-lg" />;
          const ownerColor = t.owner?.color || FALLBACK_BORDER;
          const ownedByMe = t.owner?.id === player?.faction_id;
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`relative aspect-square rounded-lg p-1 text-left transition-all
                bg-kingdom-blue/30 hover:bg-kingdom-blue/50 ${
                selected?.id === t.id ? 'ring-2 ring-yellow-400' : ''
              }`}
              style={{ borderTop: `3px solid ${ownerColor}` }}
            >
              <div className="text-lg leading-none">{TYPE_ICON[t.type] || '🗺️'}</div>
              <p className="text-[9px] font-bold leading-tight mt-1 truncate">{t.name}</p>
              <p className="text-[8px] text-gray-400">DEF {t.defense_strength}</p>
              {t.owner && (
                <p className="text-[8px] mt-0.5" style={{ color: ownerColor }}>
                  {t.owner.icon} {ownedByMe ? '(tuya)' : ''}
                </p>
              )}
              {!t.owner && (
                <p className="text-[8px] text-gray-500 mt-0.5">Libre</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected detail */}
      {selected && (
        <div className="game-card border-yellow-700/40 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm">{TYPE_ICON[selected.type]} {selected.name}</p>
            <span className="text-[10px] text-gray-400">DEF {selected.defense_strength}</span>
          </div>
          {Object.keys(selected.resources_bonus || {}).length > 0 && (
            <p className="text-[10px] text-yellow-300">
              Bonus pasivo: {Object.entries(selected.resources_bonus).map(([k, v]) => `+${v} ${k}`).join(', ')}
            </p>
          )}
          {selected.owner ? (
            <p className="text-[11px]" style={{ color: selected.owner.color }}>
              {selected.owner.icon} Controla: <span className="font-bold">{selected.owner.name}</span>
            </p>
          ) : (
            <p className="text-[11px] text-gray-400">Territorio libre — el primero en ganar lo conquista</p>
          )}
          <button
            onClick={() => handleAttack(selected)}
            disabled={selected.owner?.id === player?.faction_id}
            className="w-full py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ⚔️ Atacar con todas las tropas
          </button>
          {!player?.faction_id && (
            <p className="text-[10px] text-gray-500 text-center">
              Sin facción podés ganar XP/loot, pero el territorio no cambia de dueño.
            </p>
          )}
        </div>
      )}

      {/* Last battle result */}
      {result && (
        <div className={`game-card animate-fade-in ${
          result.winner === 'attacker' ? 'border-green-500' : 'border-red-500'
        }`}>
          <p className="text-center font-bold mb-1 text-sm">
            {result.winner === 'attacker' ? '🏆 Victoria' : '💀 Derrota'} en {result.territory.name}
          </p>
          <p className="text-xs text-gray-400 text-center mb-1">
            ATK {result.attackPower} vs DEF {result.defensePower}
          </p>
          {result.territoryFlipped && (
            <p className="text-xs text-yellow-400 text-center">
              🏴 ¡Territorio conquistado! +{result.pointsAwarded} puntos de facción
            </p>
          )}
          {result.tokensAwarded > 0 && (
            <p className="text-xs text-yellow-300 text-center">+{result.tokensAwarded} KH</p>
          )}
          {result.loot && Object.keys(result.loot).length > 0 && (
            <p className="text-xs text-kingdom-gold text-center">
              Botín: {Object.entries(result.loot).map(([k, v]) => `${v} ${k}`).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
