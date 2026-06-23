/**
 * MissionsPanel — bottom sheet listing the player's active missions plus a
 * one-tap "generar nuevas" button. Wired from QuickActionsSidebar.missions.
 */
import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const RESOURCE_ICONS = {
  gold: '🪙', wood: '🪵', stone: '🪨', iron: '⛏️',
  wheat: '🌾', water: '💧', flour: '🌽', bread: '🍞',
};

function formatCost(reqs) {
  if (!reqs) return '';
  if (typeof reqs === 'string') return reqs;
  return Object.entries(reqs)
    .map(([k, v]) => `${v} ${RESOURCE_ICONS[k] || k}`)
    .join(' · ');
}

export default function MissionsPanel({ onClose }) {
  const { missions, loadMissions, generateMissions, acceptMission, completeMission } = useGameStore();

  useEffect(() => { loadMissions(); }, []);

  const list = Array.isArray(missions) ? missions : [];
  const active = list.filter((m) => m.status === 'active' || m.status === 'available');
  const completed = list.filter((m) => m.status === 'completed');

  return (
    <div
      className="mx-2 mb-2 rounded-t-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(22, 33, 62, 0.97)',
        border: '1px solid rgba(255, 215, 0, 0.3)',
        maxHeight: '75vh',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30 shrink-0">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          📜 Misiones
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-3 py-3 overflow-y-auto flex-1 space-y-2">
        {list.length === 0 && (
          <p className="text-gray-400 text-xs text-center py-6">
            Sin misiones cargadas.
          </p>
        )}

        {active.length > 0 && (
          <p className="text-[11px] text-gray-400 uppercase">Activas</p>
        )}
        {active.map((m) => (
          <MissionCard
            key={m.id}
            m={m}
            onAccept={() => acceptMission(m.id)}
            onComplete={() => completeMission(m.id)}
          />
        ))}

        {completed.length > 0 && (
          <p className="text-[11px] text-gray-500 uppercase mt-2">Completadas (recientes)</p>
        )}
        {completed.slice(0, 5).map((m) => (
          <div key={m.id} className="game-card py-2 opacity-60">
            <p className="text-xs font-bold">{m.title || m.name || 'Misión'}</p>
            <p className="text-[10px] text-green-400">✓ Completada</p>
          </div>
        ))}

        <button
          onClick={generateMissions}
          className="w-full py-2 rounded-lg text-xs font-bold mt-3"
          style={{
            background: 'linear-gradient(135deg, #b45309, #d97706)',
            color: 'white',
          }}
        >
          🎲 Generar nuevas misiones
        </button>
      </div>
    </div>
  );
}

function MissionCard({ m, onAccept, onComplete }) {
  const title = m.title || m.name || `Misión #${m.id}`;
  const desc = m.description || m.desc || '';
  const isAvailable = m.status === 'available';
  const reward = m.reward || (m.gold_reward ? { gold: m.gold_reward } : null);
  const cost = m.requirements || m.cost;

  return (
    <div className="game-card py-2">
      <p className="text-sm font-bold">{title}</p>
      {desc && <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>}
      {cost && (
        <p className="text-[10px] text-gray-500 mt-1">Pide: {formatCost(cost)}</p>
      )}
      {reward && (
        <p className="text-[10px] text-yellow-400">Premia: {formatCost(reward)}</p>
      )}
      <div className="mt-2 flex gap-2">
        {isAvailable ? (
          <button
            onClick={onAccept}
            className="btn-primary text-[10px] px-3 py-1 flex-1"
          >Aceptar</button>
        ) : (
          <button
            onClick={onComplete}
            className="text-[10px] px-3 py-1 flex-1 rounded bg-green-700 hover:bg-green-600 text-white"
          >Completar</button>
        )}
      </div>
    </div>
  );
}
