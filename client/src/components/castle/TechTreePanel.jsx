import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import Button from '../ui/Button';

const BRANCH_ICONS = { agriculture: 'wheat', commerce: 'gold', military: 'sword' };

// Nombres de recurso en español (T4). Oro/Piedra como en CommerceView.jsx:9;
// Ascua de Faro como en shared/gameConfig.js:39 (RESOURCES.CRYSTAL).
const COST_LABEL = {
  wheat: 'Trigo', wood: 'Madera', stone: 'Piedra', iron: 'Hierro', gold: 'Oro',
  planks: 'Tablones', ingots: 'Lingotes', crystal: 'Ascua de Faro',
};

function formatTime(ms) {
  if (!ms) return '';
  const remaining = new Date(ms) - Date.now();
  if (remaining <= 0) return 'Listo';
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TechTreePanel() {
  const { techResearch, loadTechResearch, startResearch } = useGameStore();
  const [activeBranch, setActiveBranch] = useState('agriculture');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    loadTechResearch();
  }, []);

  // Tick every second to update countdown
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!techResearch) {
    return <p className="text-kh-bone-dim text-sm text-center py-4">Cargando árbol de investigación...</p>;
  }

  const branch = techResearch.branches?.find((b) => b.id === activeBranch);
  const inProgress = techResearch.inProgress;

  return (
    <div className="space-y-3">
      {/* Pestañas de rama (R39–R41, R44): hasta 2 líneas, mín. 44 px de alto */}
      <div className="flex gap-2" role="tablist">
        {(techResearch.branches || []).map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={activeBranch === b.id}
            onClick={() => setActiveBranch(b.id)}
            className={`kh-tab flex-1 min-w-0 rounded-lg font-bold flex flex-col items-center justify-center gap-0.5 break-words ${
              activeBranch === b.id ? 'kh-tab--active' : ''
            }`}
          >
            <SpriteIcon name={BRANCH_ICONS[b.id]} size={28} /><span>{b.name}</span>
          </button>
        ))}
      </div>

      {/* In-progress banner */}
      {inProgress && (
        <div className="game-card" style={{ borderColor: '#d9b77a' }} data-testid="tech-in-progress">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kh-bone-dim"><SpriteIcon name="tech" size={28} /> Investigando: <span className="font-bold text-kh-bone">{inProgress.tech_id}</span></p>
            <p className="text-xs text-kh-ember font-mono">{formatTime(inProgress.research_complete_at)}</p>
          </div>
        </div>
      )}

      {/* Tech list */}
      {branch && (
        <div className="space-y-2">
          {branch.techs.map((tech) => {
            const isCompleted = tech.completed;
            const isResearching = tech.inProgress;
            const canResearch = !isCompleted && !isResearching && !inProgress;

            return (
              <div
                key={tech.id}
                className={`game-card flex items-center justify-between gap-3 ${isCompleted ? 'opacity-80' : ''}`}
                data-completed={isCompleted ? 'true' : undefined}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold leading-tight break-words">{tech.name}</p>
                  </div>
                  <p className="text-xs text-kh-brass-light leading-tight break-words">{tech.effect}</p>
                  <p className="text-xs text-kh-bone-dim mt-0.5">
                    Costo: {Object.entries(tech.cost).map(([k, v]) => `${v} ${COST_LABEL[k] ?? k}`).join(', ')}
                  </p>
                </div>
                <div className="shrink-0">
                  {isCompleted ? (
                    <span aria-label="Completada"><SpriteIcon name="check" size={28} /></span>
                  ) : isResearching ? (
                    <span className="text-xs text-kh-ember font-mono">{formatTime(tech.completeAt)}</span>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => startResearch(activeBranch, tech.id)}
                      disabled={!canResearch}
                      className="px-3"
                      style={{ fontSize: 13 }}
                    >
                      Investigar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
