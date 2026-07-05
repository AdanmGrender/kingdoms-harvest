/**
 * StormBanner — aviso superior de Tormenta Disforme activa (F2 idle).
 * Poll de respaldo cada 60s + push por socket (storm_started/storm_ended).
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

function remainingLabel(endsAt) {
  const ms = new Date(endsAt) - Date.now();
  if (ms <= 0) return 'terminando…';
  const mins = Math.ceil(ms / 60000);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export default function StormBanner() {
  const storm = useGameStore((s) => s.activeStorm);
  const loadActiveStorm = useGameStore((s) => s.loadActiveStorm);
  const [, forceTick] = useState(0);

  useEffect(() => {
    loadActiveStorm();
    const poll = setInterval(loadActiveStorm, 60000);
    const clock = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, []);

  if (!storm) return null;

  return (
    <div
      className="fixed top-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2
                 px-3 py-1.5 rounded-full pointer-events-none animate-fade-in"
      style={{
        background: 'rgba(23, 21, 26, 0.92)',
        border: `1px solid ${storm.color || '#7a5a8a'}`,
        boxShadow: `0 0 16px ${storm.color || '#7a5a8a'}55`,
      }}
    >
      <span className="text-base leading-none animate-pulse">{storm.icon}</span>
      <span className="text-[11px] font-bold" style={{ color: storm.color || '#c4b5fd' }}>
        {storm.name}
        {storm.intensity > 1 ? ` · i${storm.intensity}` : ''}
      </span>
      <span className="text-[10px] text-gray-400">{remainingLabel(storm.ends_at)}</span>
    </div>
  );
}
