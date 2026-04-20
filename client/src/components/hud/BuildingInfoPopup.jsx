/**
 * BuildingInfoPopup — Shown when player taps a building.
 * Displays name, level, and Upgrade / Info actions.
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

const BUILDING_META = {
  throne_room: { name: 'Salón del Trono', icon: '🏰', maxLevel: 15 },
  farm_plot: { name: 'Parcela de Cultivo', icon: '🌾', maxLevel: 5 },
  barn: { name: 'Granero', icon: '🛖', maxLevel: 10 },
  mill: { name: 'Molino', icon: '🌀', maxLevel: 10 },
  sawmill: { name: 'Aserradero', icon: '🪵', maxLevel: 10 },
  blacksmith: { name: 'Herrería', icon: '⚒️', maxLevel: 10 },
  stable: { name: 'Establo', icon: '🐎', maxLevel: 10 },
  barracks: { name: 'Cuartel', icon: '⚔️', maxLevel: 10 },
  tower: { name: 'Torre', icon: '🗼', maxLevel: 10 },
  wall: { name: 'Muralla', icon: '🧱', maxLevel: 10 },
  tavern: { name: 'Taberna', icon: '🍺', maxLevel: 10 },
  market: { name: 'Mercado', icon: '🏪', maxLevel: 10 },
  library: { name: 'Biblioteca', icon: '📚', maxLevel: 10 },
  embassy: { name: 'Embajada', icon: '🏛️', maxLevel: 10 },
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

  const meta = BUILDING_META[selected.building_id] || {
    name: selected.building_id || 'Edificio',
    icon: '🏠',
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
      className="absolute left-1/2 bottom-24 -translate-x-1/2 z-30 pointer-events-auto"
      style={{ minWidth: 240 }}
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
            <span className="text-2xl">{meta.icon}</span>
          </div>
          <div>
            <p className="text-yellow-300 text-[10px] font-semibold uppercase tracking-wider">
              Nv. {level} / {meta.maxLevel}
            </p>
            <p className="text-white text-sm font-bold leading-tight"
              style={{ fontFamily: 'MedievalSharp, serif' }}>
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
            ℹ️ Info
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
            ⬆️ Mejorar
          </button>
        </div>
      </div>
    </div>
  );
}
