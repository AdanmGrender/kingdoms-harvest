import React, { useState } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

const RARITY_CONFIG = {
  common:   { label: 'Común',     color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  uncommon: { label: 'Inusual',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  rare:     { label: 'Raro',      color: '#ffd700', bg: 'rgba(255,215,0,0.15)'   },
};

const RESOURCE_ICONS = {
  wheat: '🌾', carrot: '🥕', potato: '🥔', tomato: '🍅', corn: '🌽',
  pumpkin: '🎃', grape: '🍇', wood: '🪵', stone: '🪨', iron: '⛏️',
  gold: '🪙', bread: '🍞', ingots: '⚙️', flour: '🌾', egg: '🥚',
  milk: '🥛', wool: '🧶',
};

const RESOURCE_NAMES = {
  wheat: 'Trigo', carrot: 'Zanahoria', potato: 'Papa', tomato: 'Tomate',
  corn: 'Maíz', pumpkin: 'Calabaza', grape: 'Uva', wood: 'Madera',
  stone: 'Piedra', iron: 'Hierro', gold: 'Oro', bread: 'Pan',
  ingots: 'Lingotes', flour: 'Harina', egg: 'Huevo', milk: 'Leche', wool: 'Lana',
};

export default function WorldEventPanel({ data, onClose }) {
  const [claimed, setClaimed] = useState(data.is_claimed);
  const [claimResult, setClaimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { claimWorldEvent, addNotification, loadWorldEvents, refreshResources } = useGameStore();

  const rarity = RARITY_CONFIG[data.rarity] || RARITY_CONFIG.common;

  // Time remaining
  const secsLeft = Math.max(0, data.expires_at - Math.floor(Date.now() / 1000));
  const mins = Math.floor(secsLeft / 60);
  const timeStr = secsLeft <= 0 ? 'Expirado' : `${mins} min restante${mins !== 1 ? 's' : ''}`;

  const handleClaim = async () => {
    setLoading(true);
    try {
      const result = await claimWorldEvent(data.eventId);
      if (result) {
        setClaimed(true);
        setClaimResult(result.rewards);
        addNotification(result.message, 'success');
        // Tell Phaser to update the marker
        EventBridge.emit('world_event:claimed', { eventId: data.eventId });
        refreshResources();
        loadWorldEvents();
      }
    } catch {
      addNotification('Error al reclamar el evento', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-2 mb-2 rounded-t-xl overflow-hidden"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: `1px solid ${rarity.color}50` }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30"
        style={{ background: `linear-gradient(135deg, rgba(22,33,62,0.9), ${rarity.bg})` }}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{data.icon}</span>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif', color: rarity.color }}>
                {data.title}
              </h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                style={{ background: rarity.bg, color: rarity.color, border: `1px solid ${rarity.color}50` }}>
                {rarity.label}
              </span>
            </div>
            <p className="text-[10px] text-gray-400">{timeStr}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Description */}
        <p className="text-gray-300 text-xs leading-relaxed italic">"{data.description}"</p>

        {/* Rewards */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
            {claimResult ? '✓ Recursos obtenidos' : 'Recompensas disponibles'}
          </p>
          <div className="flex flex-wrap gap-2">
            {(claimResult || data.rewards || []).map((r, i) => (
              <div key={i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{ background: claimResult ? 'rgba(74,222,128,0.12)' : rarity.bg, border: `1px solid ${claimResult ? '#4ade8040' : rarity.color + '40'}` }}>
                <span className="text-base">{RESOURCE_ICONS[r.resource_id] || '📦'}</span>
                <div>
                  <p className="text-[10px] text-gray-400">{RESOURCE_NAMES[r.resource_id] || r.resource_id}</p>
                  <p className="text-sm font-bold" style={{ color: claimResult ? '#4ade80' : rarity.color }}>
                    +{r.amount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        {claimed ? (
          <div className="flex items-center justify-center gap-2 py-3 rounded-lg"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <span className="text-green-400 text-lg">✓</span>
            <p className="text-green-400 text-sm font-bold">Recompensa reclamada</p>
          </div>
        ) : secsLeft <= 0 ? (
          <div className="text-center py-2">
            <p className="text-gray-500 text-xs">Este evento ya expiró</p>
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all"
            style={{
              background: loading
                ? 'rgba(100,100,120,0.5)'
                : `linear-gradient(135deg, ${rarity.color}cc, ${rarity.color})`,
              color: data.rarity === 'common' ? '#1a1a2e' : 'white',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⏳ Reclamando...' : `${data.icon} Reclamar recompensa`}
          </button>
        )}
      </div>
    </div>
  );
}
