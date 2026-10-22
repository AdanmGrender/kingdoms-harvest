/**
 * BuildingInfoPopup — Shown when player taps a building.
 * Displays name, level, and Upgrade / Info actions.
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon from '../ui/SpriteIcon';

// Espejo de name/maxLevel de shared/gameConfig.js BUILDINGS (lore v2) — mantener en sync
// (lo verifica BuildingInfoPopup.test.jsx).
const BUILDING_META = {
  throne_room: { name: 'Torre del Señor', icon: 'castle', maxLevel: 10 },
  farm_plot: { name: 'Huerto Votivo', icon: 'farm_plot', maxLevel: 10 },
  barn: { name: 'Granero', icon: 'barn', maxLevel: 10 },
  mill: { name: 'Molino', icon: 'mill', maxLevel: 5 },
  sawmill: { name: 'Aserradero', icon: 'sawmill', maxLevel: 5 },
  smithy: { name: 'Herrería', icon: 'smithy', maxLevel: 5 },
  stable: { name: 'Establo', icon: 'stable', maxLevel: 5 },
  house: { name: 'Casa de Vecinos', icon: 'farmhouse', maxLevel: 5 },
  mine: { name: 'Mina de la Colina', icon: 'mine', maxLevel: 5 },
  barracks: { name: 'Cuartel', icon: 'barracks', maxLevel: 10 },
  tower: { name: 'Torre de Cañones', icon: 'tower', maxLevel: 10 },
  wall: { name: 'Muralla', icon: 'wall', maxLevel: 15 },
  trap: { name: 'Foso de Estacas', icon: 'trap', maxLevel: 8 },
  tavern: { name: 'Taberna', icon: 'tavern', maxLevel: 5 },
  market: { name: 'Mercado Negro', icon: 'market', maxLevel: 5 },
  library: { name: 'Scriptorium', icon: 'library', maxLevel: 8 },
  embassy: { name: 'Casa del Emisario', icon: 'embassy', maxLevel: 3 },
};

export default function BuildingInfoPopup() {
  const [selected, setSelected] = useState(null);
  const addNotification = useGameStore((s) => s.addNotification);

  useEffect(() => {
    const onSelected = (entry) => {
      if (entry?.type === 'building') setSelected(entry.data);
    };
    const onDeselected = () => setSelected(null);
    EventBridge.on('entity:selected', onSelected);
    EventBridge.on('entity:deselected', onDeselected);
    return () => {
      EventBridge.off('entity:selected', onSelected);
      EventBridge.off('entity:deselected', onDeselected);
    };
  }, []);

  if (!selected) return null;

  // entity:selected del hub trae buildingId (buildSelectionPayload); building_id = emisores legados.
  const buildingId = selected.buildingId ?? selected.building_id;
  const meta = BUILDING_META[buildingId] || {
    name: buildingId || 'Edificio',
    icon: 'farmhouse',
    maxLevel: 10,
  };
  const level = selected.level || 1;
  const canUpgrade = level < meta.maxLevel;

  const handleUpgrade = () => {
    if (!canUpgrade) {
      addNotification('Nivel máximo alcanzado', 'warning');
      return;
    }
    addNotification('Sistema de mejora próximamente', 'info');
  };

  const handleInfo = () => {
    addNotification(`${meta.name} Nv.${level}`, 'info');
  };

  const close = () => {
    EventBridge.emit('entity:deselected');
    setSelected(null);
  };

  return (
    <div
      className="absolute left-1/2 bottom-32 -translate-x-1/2 z-50 pointer-events-auto"
      style={{ minWidth: 240, maxWidth: 'calc(100vw - 24px)' }}
    >
      <div
        className="px-4 py-3 rounded-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(20,22,40,0.98) 0%, rgba(10,12,24,0.95) 100%)',
          border: '2px solid rgba(255,215,80,0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-1 right-2 text-gray-400 hover:text-white text-lg leading-none"
          aria-label="Cerrar"
        >
          ×
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'radial-gradient(circle, #2a2438 0%, #14101c 100%)',
              border: '1px solid rgba(255,215,80,0.3)',
            }}
          >
            <SpriteIcon name={meta.icon} size={40} />
          </div>
          <div>
            <p className="text-yellow-300 text-[10px] font-semibold uppercase tracking-wider">
              Nv. {level} / {meta.maxLevel}
            </p>
            <p className="text-white text-sm font-bold leading-tight font-display">
              {meta.name}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleInfo}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold text-blue-200 transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(180deg, rgba(40,80,140,0.9) 0%, rgba(20,40,80,0.9) 100%)',
              border: '1px solid rgba(100,180,255,0.4)',
            }}
          >
            Info
          </button>
          <button
            onClick={handleUpgrade}
            disabled={!canUpgrade}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-transform active:scale-95"
            style={{
              background: canUpgrade
                ? 'linear-gradient(180deg, rgba(180,140,40,0.95) 0%, rgba(120,80,20,0.95) 100%)'
                : 'rgba(80,80,80,0.5)',
              border: `1px solid ${canUpgrade ? 'rgba(255,215,80,0.6)' : 'rgba(100,100,100,0.4)'}`,
              color: canUpgrade ? '#ffe070' : '#888',
            }}
          >
            Mejorar
          </button>
        </div>
      </div>
    </div>
  );
}
