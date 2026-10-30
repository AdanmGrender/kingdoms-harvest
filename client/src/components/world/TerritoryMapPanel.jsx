import React, { useEffect, useState, useMemo } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import { FACTION_ICONS } from '../../config/factionIcons';
import Button from '../ui/Button';
import ResultBanner from '../ui/ResultBanner';
import { KH } from '../ui/kitPieces';

// Tipos de terreno del páramo (re-theme grimdark — ver docs/art-style.md)
const TYPE_ICON = {
  plains:   'wheat',
  forest:   'wood',
  mountain: 'iron',
  swamp:    'water',
  coast:    'tide',
  ruins:    'relic',
  sand:     'sun',
  snow:     'moon',
};

const TYPE_LABEL = {
  plains: 'Páramo', forest: 'Selva', mountain: 'Montaña', swamp: 'Zona Tóxica',
  coast: 'Costa', ruins: 'Ruinas', sand: 'Dunas', snow: 'Tundra',
};

const FALLBACK_BORDER = KH.iron;

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

  // Territories now come from a sparse 150×150 world map (see migration 011),
  // not a dense 3×3 / 5×5 grid. Sort them once for a stable rendering order
  // (by type then defense) and let the layout below show them as a card list.
  const sorted = useMemo(() => {
    return [...territories].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return (a.defense_strength || 0) - (b.defense_strength || 0);
    });
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
    <div className="relative space-y-3">
      {/* Fondo plano oak (R25): sin imagen ambient legada */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -m-2 rounded-lg pointer-events-none"
        style={{ backgroundColor: KH.oak, opacity: 0.5 }}
      />
      {/* Cabecera estilo informe de campaña (ref: mapa de sistema, docs/art-style.md) */}
      <div className="relative rounded-md px-2 py-1.5" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.brass}` }}>
        <p className="font-display text-sm text-kh-brass-light tracking-wide text-center uppercase">
          Mapa de Campaña — Sector en Disputa
        </p>
        <p className="text-xs text-kh-bone-dim text-center">
          Conquistá territorios para tu facción · tributo pasivo por hora
        </p>
      </div>

      {/* Leyenda (ref: recuadro LEGEND del mapa de sistema) */}
      <div className="flex items-center justify-center gap-3 text-xs text-kh-bone-dim">
        <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: KH.iron }} />Libre</span>
        <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: KH['brass-light'] }} />Tu facción</span>
        <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: KH.seal }} />Rival</span>
        <span><SpriteIcon name="shield" size={28} /> Defensa</span>
      </div>

      {/* 2-col card grid — sparse coords make a dense N×N matrix unusable */}
      <div className="grid grid-cols-2 gap-2">
        {sorted.map((t, idx) => {
          const ownerColor = t.owner?.color || FALLBACK_BORDER;
          const ownedByMe = t.owner?.id === player?.faction_id;
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="relative rounded-md p-2 text-left transition-all"
              style={{
                minHeight: 44,
                backgroundColor: selected?.id === t.id ? KH['oak-light'] : KH.oak,
                border: `1px solid ${selected?.id === t.id ? KH['brass-light'] : KH.iron}`,
                borderTop: `3px solid ${ownerColor}`,
              }}
            >
              {/* POI numerado (ref: battle sites numerados del mapa) */}
              <span className="absolute top-1 right-1.5 text-xs font-bold text-kh-bone-dim">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none"><SpriteIcon name={TYPE_ICON[t.type] || 'map'} size={28} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold leading-tight truncate text-kh-bone">{t.name}</p>
                  <p className="text-xs text-kh-bone-dim">
                    {TYPE_LABEL[t.type] || t.type} · <SpriteIcon name="shield" size={28} />{t.defense_strength}
                  </p>
                  {t.owner ? (
                    <p className="text-xs mt-0.5 truncate text-kh-bone" style={{ borderLeft: `3px solid ${ownerColor}`, paddingLeft: 4 }}>
                      <SpriteIcon name={FACTION_ICONS[t.owner.id]} size={28} /> {ownedByMe ? '(tuya)' : t.owner.name}
                    </p>
                  ) : (
                    <p className="text-xs text-kh-bone-dim mt-0.5">Libre</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected detail */}
      {selected && (
        <div className="game-card space-y-2" style={{ borderColor: KH.brass }}>
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm"><SpriteIcon name={TYPE_ICON[selected.type]} size={28} /> {selected.name}</p>
            <span className="text-xs text-kh-bone-dim">DEF {selected.defense_strength}</span>
          </div>
          {Object.keys(selected.resources_bonus || {}).length > 0 && (
            <p className="text-xs text-kh-brass-light">
              Bonus pasivo: {Object.entries(selected.resources_bonus).map(([k, v]) => `+${v} ${k}`).join(', ')}
            </p>
          )}
          {selected.owner ? (
            <p className="text-xs text-kh-bone" style={{ borderLeft: `3px solid ${selected.owner.color || KH.iron}`, paddingLeft: 4 }}>
              <SpriteIcon name={FACTION_ICONS[selected.owner.id]} size={28} /> Controla: <span className="font-bold">{selected.owner.name}</span>
            </p>
          ) : (
            <p className="text-xs text-kh-bone-dim">Territorio libre — el primero en ganar lo conquista</p>
          )}
          <Button
            variant="primary"
            onClick={() => handleAttack(selected)}
            disabled={selected.owner?.id === player?.faction_id}
            className="w-full"
            style={{ fontSize: 13 }}
          >
            <SpriteIcon name="flame" size={28} /> Asaltar con todas las tropas
          </Button>
          {!player?.faction_id && (
            <p className="text-xs text-kh-bone-dim text-center">
              Sin facción podés ganar XP/loot, pero el territorio no cambia de dueño.
            </p>
          )}
        </div>
      )}

      {/* Last battle result */}
      {result && (
        <ResultBanner
          outcome={result.winner === 'attacker' ? 'victory' : 'defeat'}
          title={`${result.winner === 'attacker' ? 'Victoria' : 'Derrota'} en ${result.territory.name}`}
          onClose={() => setResult(null)}
        >
          <p className="text-xs">ATK {result.attackPower} vs DEF {result.defensePower}</p>
          {result.territoryFlipped && (
            <p className="text-xs">
              <SpriteIcon name="alliance" size={28} /> ¡Territorio conquistado! +{result.pointsAwarded} puntos de facción
            </p>
          )}
          {result.tokensAwarded > 0 && (
            <p className="text-xs">+{result.tokensAwarded} KH</p>
          )}
          {result.loot && Object.keys(result.loot).length > 0 && (
            <p className="text-xs">
              Botín: {Object.entries(result.loot).map(([k, v]) => `${v} ${k}`).join(', ')}
            </p>
          )}
        </ResultBanner>
      )}
    </div>
  );
}
