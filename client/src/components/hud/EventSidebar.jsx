/**
 * EventSidebar — Right rail upper: event buttons with timers and badges.
 * Inspired by Whiteout Survival event stack.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const EVENTS = [
  { id: 'newplayer', icon: '🎁', label: 'Bienvenida', color: '#ff88cc', pulse: true },
  { id: 'recharge', icon: '💰', label: '1ª Recarga', color: '#ffd750' },
  { id: 'value', icon: '⭐', label: 'Valor', color: '#ffac30', badge: 1 },
  { id: 'siege', icon: '🏰', label: 'Asedio', color: '#ff6060' },
];

function formatCountdown(seconds) {
  if (seconds <= 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function EventSidebar() {
  const addNotification = useGameStore((s) => s.addNotification);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fake end times for countdown demo (24h from load)
  const endTime = useState(() => Date.now() + 24 * 3600 * 1000)[0];
  const remaining = Math.max(0, Math.floor((endTime - now) / 1000));

  const handleClick = (id) => {
    addNotification(`Evento ${id} próximamente`, 'info');
  };

  return (
    <div className="absolute right-2 top-20 z-20 pointer-events-none flex flex-col gap-2">
      {EVENTS.map((e) => (
        <button
          key={e.id}
          onClick={() => handleClick(e.id)}
          className={`pointer-events-auto relative w-12 h-14 rounded-xl flex flex-col items-center justify-center transition-transform active:scale-90 hover:scale-105 ${e.pulse ? 'animate-pulse' : ''}`}
          style={{
            background: `linear-gradient(180deg, ${e.color}22 0%, rgba(12,14,28,0.92) 100%)`,
            border: `1.5px solid ${e.color}66`,
            boxShadow: `0 2px 8px rgba(0,0,0,0.5), 0 0 12px ${e.color}33, inset 0 1px 0 rgba(255,255,255,0.1)`,
          }}
          title={e.label}
        >
          <span className="text-xl leading-none">{e.icon}</span>
          <span className="text-[8px] font-semibold leading-tight mt-0.5 tabular-nums" style={{ color: e.color }}>
            {formatCountdown(remaining)}
          </span>
          {e.badge > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                boxShadow: '0 0 6px rgba(255,68,68,0.7)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              {e.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
