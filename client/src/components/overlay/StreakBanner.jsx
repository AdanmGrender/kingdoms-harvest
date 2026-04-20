import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

const MILESTONES = [7, 14, 21, 30];

export default function StreakBanner() {
  const { streakInfo, loadStreakInfo } = useGameStore();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadStreakInfo();
  }, []);

  useEffect(() => {
    // Show if streak ≥ 3 and we haven't dismissed this session
    if (streakInfo?.currentStreak >= 3 && !dismissed) {
      setVisible(true);
      // Auto-hide after 6 seconds (unless it's a milestone day)
      const isMilestone = MILESTONES.includes(streakInfo.currentStreak);
      if (!isMilestone) {
        const t = setTimeout(() => setVisible(false), 6000);
        return () => clearTimeout(t);
      }
    }
  }, [streakInfo?.currentStreak]);

  if (!visible || !streakInfo) return null;

  const streak = streakInfo.currentStreak;
  const multiplier = streakInfo.multiplier || 1;
  const isMilestone = MILESTONES.includes(streak);
  const nextMilestone = MILESTONES.find((m) => m > streak);

  return (
    <div
      className={`absolute bottom-24 left-0 right-0 z-40 flex justify-center pointer-events-auto animate-fade-in`}
      onClick={() => { setVisible(false); setDismissed(true); }}
    >
      <div className={`mx-4 px-4 py-3 rounded-xl border text-center shadow-lg cursor-pointer ${
        isMilestone
          ? 'bg-yellow-900/95 border-yellow-400'
          : 'bg-kingdom-card/95 border-purple-600'
      }`}>
        <p className={`text-sm font-bold ${isMilestone ? 'text-yellow-300' : 'text-white'}`}>
          {isMilestone ? '🎉' : '🔥'} Racha de {streak} días{isMilestone ? ' — ¡Hito!' : ''}
        </p>
        <p className="text-xs text-purple-300 mt-0.5">
          Multiplicador: <span className="text-yellow-400 font-bold">{multiplier}×</span> tokens
          {nextMilestone && (
            <span className="text-gray-400"> · Día {nextMilestone} = {
              nextMilestone === 7 ? '2×' : nextMilestone === 14 ? '2.5×' : nextMilestone === 21 ? '3×' : '5×'
            }</span>
          )}
        </p>
        <p className="text-[10px] text-gray-500 mt-1">Toca para cerrar</p>
      </div>
    </div>
  );
}
