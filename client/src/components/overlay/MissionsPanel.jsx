/**
 * MissionsPanel — bottom sheet listing the player's active missions plus a
 * one-tap "generar nuevas" button. Wired from QuickActionsSidebar.missions.
 */
import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import Panel from '../ui/Panel';
import Button from '../ui/Button';

const RESOURCE_ICONS = {
  gold: 'gold', wood: 'wood', stone: 'stone', iron: 'iron',
  wheat: 'wheat', water: 'water', flour: 'corn', bread: 'bread',
};

function formatCost(reqs) {
  if (!reqs) return '';
  if (typeof reqs === 'string') return reqs;
  return Object.entries(reqs)
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');
}

export default function MissionsPanel({ onClose }) {
  const { missions, loadMissions, generateMissions, acceptMission, completeMission } = useGameStore();

  useEffect(() => { loadMissions(); }, []);

  const list = Array.isArray(missions) ? missions : [];
  const active = list.filter((m) => m.status === 'active' || m.status === 'available');
  const completed = list.filter((m) => m.status === 'completed');

  return (
    <Panel
      title={<><SpriteIcon name="scroll" size={28} /> Misiones</>}
      onClose={onClose}
      className="mx-2 mb-2 overflow-hidden flex flex-col"
      style={{ maxHeight: 'calc(var(--kh-frame-h) * 0.75)' }}
    >
      <div className="px-1 py-1 overflow-y-auto flex-1 min-h-0 space-y-2">
        {list.length === 0 && (
          <p className="text-kh-bone-dim text-xs text-center py-6">
            Sin misiones cargadas.
          </p>
        )}

        {active.length > 0 && (
          <p className="text-xs text-kh-bone-dim uppercase">Activas</p>
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
          <p className="text-xs text-kh-bone-dim uppercase mt-2">Completadas (recientes)</p>
        )}
        {completed.slice(0, 5).map((m) => (
          <div key={m.id} className="game-card py-2 opacity-60">
            <p className="text-xs font-bold">{m.title || m.name || 'Misión'}</p>
            <p className="text-xs text-kh-brass-light"><SpriteIcon name="check" size={28} /> Completada</p>
          </div>
        ))}

        <Button variant="primary" onClick={generateMissions} className="w-full mt-3" style={{ fontSize: 14 }}>
          Generar nuevas misiones
        </Button>
      </div>
    </Panel>
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
      {desc && <p className="text-xs text-kh-bone-dim mt-0.5">{desc}</p>}
      {cost && (
        <p className="text-xs text-kh-bone-dim mt-1">Pide: {formatCost(cost)}</p>
      )}
      {reward && (
        <p className="text-xs text-kh-brass-light">Premia: {formatCost(reward)}</p>
      )}
      <div className="mt-2 flex gap-2">
        {isAvailable ? (
          <Button variant="primary" onClick={onAccept} className="flex-1" style={{ fontSize: 14 }}>Aceptar</Button>
        ) : (
          <Button variant="primary" onClick={onComplete} className="flex-1" style={{ fontSize: 14 }}>Completar</Button>
        )}
      </div>
    </div>
  );
}
