import React, { useEffect } from 'react';
import useGameStore from '../../store/gameStore';

/**
 * AchievementsPanel — list every catalog achievement enriched with the
 * player's progress, unlock state, and reward-claim state. Locked entries
 * show a progress bar; unlocked-but-unclaimed entries get a "Reclamar"
 * button; claimed entries show a check.
 */
export default function AchievementsPanel() {
  const { achievements, loadAchievements, claimAchievement } = useGameStore();

  useEffect(() => { loadAchievements(); }, []);

  if (!achievements || achievements.length === 0) {
    return (
      <p className="text-gray-400 text-xs text-center py-4">
        Cargando logros...
      </p>
    );
  }

  // Sort: unclaimed-unlocked first (player should claim those!), then
  // unlocked-claimed, then locked (closest to completion first).
  const sorted = [...achievements].sort((a, b) => {
    const aUnclaimed = a.unlocked && !a.reward_claimed;
    const bUnclaimed = b.unlocked && !b.reward_claimed;
    if (aUnclaimed !== bUnclaimed) return aUnclaimed ? -1 : 1;
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    // Both locked: closer to goal first
    return (b.progress / b.goal) - (a.progress / a.goal);
  });

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 text-center">
        {achievements.filter((a) => a.unlocked).length} / {achievements.length} desbloqueados
      </p>

      {sorted.map((ach) => {
        const pct = Math.min(100, Math.round((ach.progress / ach.goal) * 100));
        const claimable = ach.unlocked && !ach.reward_claimed;

        return (
          <div
            key={ach.id}
            className={`game-card flex items-start gap-3 ${
              claimable ? 'border-yellow-500 bg-yellow-900/10 animate-pulse' :
              ach.unlocked ? 'border-green-700 opacity-90' : ''
            }`}
          >
            <span className="text-2xl shrink-0 leading-none">{ach.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${ach.unlocked ? 'text-green-300' : ''}`}>
                {ach.name}
              </p>
              <p className="text-[11px] text-gray-400 truncate">{ach.desc}</p>

              {!ach.unlocked && (
                <div className="mt-1.5">
                  <div className="h-1.5 bg-kingdom-blue/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {ach.progress} / {ach.goal}
                  </p>
                </div>
              )}

              <p className="text-[10px] text-yellow-400 mt-1">
                Recompensa: {ach.reward?.kh || 0} KH
              </p>
            </div>

            <div className="shrink-0">
              {claimable ? (
                <button
                  onClick={() => claimAchievement(ach.id)}
                  className="btn-primary text-[10px] px-2 py-1"
                >
                  Reclamar
                </button>
              ) : ach.reward_claimed ? (
                <span className="text-green-400 text-lg" title="Reclamado">✓</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
