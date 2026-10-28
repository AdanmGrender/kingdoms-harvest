import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

const BRANCH_ICONS = { agriculture: 'wheat', commerce: 'gold', military: 'sword' };

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
    return <p className="text-gray-400 text-sm text-center py-4">Cargando árbol de investigación...</p>;
  }

  const branch = techResearch.branches?.find((b) => b.id === activeBranch);
  const inProgress = techResearch.inProgress;

  return (
    <div className="space-y-3">
      {/* Branch tabs */}
      <div className="flex gap-2">
        {(techResearch.branches || []).map((b) => (
          <button
            key={b.id}
            onClick={() => setActiveBranch(b.id)}
            className={`flex-1 min-w-0 px-1 py-2 rounded-lg text-[11px] leading-tight text-center font-bold transition-all flex flex-col items-center justify-center gap-0.5 break-words ${
              activeBranch === b.id
                ? 'bg-purple-700 text-white'
                : 'bg-kingdom-blue/50 text-gray-400 hover:text-white'
            }`}
          >
            <SpriteIcon name={BRANCH_ICONS[b.id]} size={28} /><span>{b.name}</span>
          </button>
        ))}
      </div>

      {/* In-progress banner */}
      {inProgress && (
        <div className="game-card border-purple-600 bg-purple-900/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-purple-300"><SpriteIcon name="tech" size={28} /> Investigando: <span className="font-bold text-white">{inProgress.tech_id}</span></p>
            <p className="text-xs text-yellow-400 font-mono">{formatTime(inProgress.research_complete_at)}</p>
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
              <div key={tech.id} className={`game-card flex items-center justify-between gap-3 ${
                isCompleted ? 'border-green-700 opacity-80' : ''
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold leading-tight break-words">{tech.name}</p>
                    {isCompleted && <span className="text-green-400 text-xs">✓</span>}
                  </div>
                  <p className="text-xs text-purple-300 leading-tight break-words">{tech.effect}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Costo: {Object.entries(tech.cost).map(([k, v]) => `${v} ${k}`).join(', ')}
                  </p>
                </div>
                <div className="shrink-0">
                  {isCompleted ? (
                    <span className="text-green-400 text-lg"><SpriteIcon name="check" size={28} /></span>
                  ) : isResearching ? (
                    <span className="text-xs text-yellow-400 font-mono">{formatTime(tech.completeAt)}</span>
                  ) : (
                    <button
                      onClick={() => startResearch(activeBranch, tech.id)}
                      disabled={!canResearch}
                      className="btn-primary text-xs px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Investigar
                    </button>
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
