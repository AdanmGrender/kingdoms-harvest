/**
 * WarPanel: Siege management — active sieges with countdown, history, ability buttons.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const SIEGE_ABILITIES = {
  arrow_rain:    { name: 'Lluvia de Flechas', icon: '🏹', description: 'Reduce defensa enemiga un 20%' },
  battering_ram: { name: 'Ariete',            icon: '🪵', description: 'Dano masivo a murallas' },
  rally:         { name: 'Reagrupar',         icon: '📯', description: 'Aumenta ataque un 15%' },
  shield_wall:   { name: 'Muro de Escudos',   icon: '🛡️', description: 'Aumenta defensa un 25%' },
};

const TROOP_ICONS = {
  militia: '🗡️', archer: '🏹', cavalry: '🐎', spearman: '🔱', siege_ram: '🪵',
};

export default function WarPanel({ data, onClose }) {
  const sieges = useGameStore((s) => s.sieges);
  const player = useGameStore((s) => s.player);
  const loadSieges = useGameStore((s) => s.loadSieges);
  const loadTroops = useGameStore((s) => s.loadTroops);
  const useSiegeAbility = useGameStore((s) => s.useSiegeAbility);

  const [activeTab, setActiveTab] = useState('active');
  const [now, setNow] = useState(Date.now());

  // Load data on mount
  useEffect(() => {
    loadSieges();
    loadTroops();
  }, []);

  // Countdown timer — tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll sieges every 15s
  useEffect(() => {
    const poll = setInterval(() => loadSieges(), 15000);
    return () => clearInterval(poll);
  }, []);

  const activeSieges = sieges.filter((s) => s.status === 'marching' || s.status === 'fighting');
  const historySieges = sieges.filter((s) => s.status === 'resolved');

  const formatCountdown = (arrivesAt) => {
    const remaining = Math.max(0, new Date(arrivesAt).getTime() - now);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseJSON = (str) => {
    try { return JSON.parse(str); } catch { return {}; }
  };

  const isAttacker = (siege) => {
    return siege.attacker_id === player?.id || siege.attacker_id === player?.telegram_id;
  };

  const openTroopPanel = (mode) => {
    useGameStore.getState().setOverlay('troops', { mode });
  };

  return (
    <div
      className="mx-2 mb-2 p-4 rounded-t-xl max-h-[65vh] overflow-y-auto"
      style={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          Zona de Guerra
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        <button
          className={`flex-1 text-xs py-1.5 rounded ${
            activeTab === 'active' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('active')}
        >
          Asedios Activos ({activeSieges.length})
        </button>
        <button
          className={`flex-1 text-xs py-1.5 rounded ${
            activeTab === 'history' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('history')}
        >
          Historial
        </button>
      </div>

      {/* Active Sieges */}
      {activeTab === 'active' && (
        <div className="space-y-2 mb-3">
          {activeSieges.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-4">No tienes asedios activos.</p>
          ) : (
            activeSieges.map((siege) => {
              const army = parseJSON(siege.attacker_army);
              const isMine = isAttacker(siege);
              return (
                <div
                  key={siege.id}
                  className="p-2 rounded"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}
                >
                  {/* Status + countdown */}
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      siege.status === 'marching' ? 'bg-blue-800 text-blue-300' : 'bg-red-800 text-red-300'
                    }`}>
                      {siege.status === 'marching' ? 'En marcha' : 'En combate'}
                    </span>
                    {siege.status === 'marching' && (
                      <span className="text-yellow-300 text-xs font-mono">
                        {formatCountdown(siege.arrives_at)}
                      </span>
                    )}
                  </div>

                  {/* Role */}
                  <div className="text-gray-400 text-[10px] mb-1">
                    {isMine ? 'Atacando' : 'Defendiendo'}
                  </div>

                  {/* Army composition */}
                  <div className="flex gap-2 mb-1">
                    {Object.entries(army).map(([troopId, qty]) => (
                      <span key={troopId} className="text-white text-xs">
                        {TROOP_ICONS[troopId] || troopId} x{qty}
                      </span>
                    ))}
                  </div>

                  {/* Abilities (only during fighting, only for attacker) */}
                  {siege.status === 'fighting' && isMine && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(SIEGE_ABILITIES).map(([id, ab]) => (
                        <button
                          key={id}
                          className="bg-purple-800 hover:bg-purple-700 text-white text-[10px] px-2 py-1 rounded"
                          onClick={() => useSiegeAbility(siege.id, id)}
                          title={ab.description}
                        >
                          {ab.icon} {ab.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div className="space-y-2 mb-3">
          {historySieges.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-4">No hay resultados recientes.</p>
          ) : (
            historySieges.map((siege) => {
              const result = parseJSON(siege.result);
              const loot = parseJSON(siege.loot);
              const isMine = isAttacker(siege);
              const won = (result.winner === 'attacker' && isMine) || (result.winner === 'defender' && !isMine);

              return (
                <div
                  key={siege.id}
                  className="p-2 rounded"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}
                >
                  {/* Result badge */}
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      won ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'
                    }`}>
                      {won ? 'Victoria' : 'Derrota'}
                    </span>
                    <span className="text-gray-500 text-[10px]">
                      {isMine ? 'Ataque' : 'Defensa'}
                    </span>
                  </div>

                  {/* Loot */}
                  {won && Object.keys(loot).length > 0 && (
                    <div className="text-green-400 text-[10px] mt-1">
                      Botin: {Object.entries(loot).map(([res, amt]) => `${amt} ${res}`).join(', ')}
                    </div>
                  )}

                  {/* Losses */}
                  {result.attackerLosses && (
                    <div className="text-red-400 text-[10px] mt-1">
                      Perdidas: {Object.entries(isMine ? result.attackerLosses : (result.defenderLosses || {}))
                        .filter(([, v]) => v > 0)
                        .map(([id, v]) => `${TROOP_ICONS[id] || id} -${v}`)
                        .join(', ') || 'ninguna'}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs py-2 rounded"
          onClick={() => openTroopPanel('troops')}
        >
          Gestionar Tropas
        </button>
        <button
          className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs py-2 rounded"
          onClick={() => openTroopPanel('army')}
        >
          Declarar Guerra
        </button>
      </div>
    </div>
  );
}
