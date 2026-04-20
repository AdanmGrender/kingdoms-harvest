/**
 * ConstructionTimer — Sticky widget showing active construction/upgrade with countdown.
 * Reads from gameStore.activeConstruction (placeholder until backend wires up).
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

function formatTime(seconds) {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ConstructionTimer() {
  const construction = useGameStore((s) => s.activeConstruction);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!construction?.endsAt) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.floor((construction.endsAt - Date.now()) / 1000));
      setRemaining(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [construction?.endsAt]);

  if (!construction || remaining <= 0) return null;

  const total = construction.durationMs ? Math.floor(construction.durationMs / 1000) : 1;
  const pct = Math.max(0, Math.min(100, 100 - (remaining / total) * 100));

  return (
    <div className="absolute right-2 top-20 z-30 pointer-events-auto">
      <div
        className="px-3 py-2 rounded-xl"
        style={{
          background: 'linear-gradient(180deg, rgba(20,22,40,0.95) 0%, rgba(10,12,24,0.92) 100%)',
          border: '1px solid rgba(255,140,40,0.45)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
          minWidth: 140,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{construction.icon || '🔨'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-orange-300 text-[10px] font-semibold truncate">
              {construction.name || 'Construcción'}
            </p>
            <p className="text-white text-[9px] tabular-nums">{formatTime(remaining)}</p>
          </div>
        </div>
        <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #ff8c28, #ffd750)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
