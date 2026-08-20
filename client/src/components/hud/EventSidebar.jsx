/**
 * EventSidebar — Right rail upper. Shows the currently active server-wide
 * seasonal event (if any) with a real countdown to its end, plus a few
 * static shortcuts (achievements, tech, world map) to the MetaPanel.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon from '../ui/SpriteIcon';
import { grimBtn } from './grimChrome';

const SHORTCUTS = [
  { id: 'newplayer', sprite: 'reward_bag', icon: '🎁', label: 'Logros', color: '#d9a441', metaTab: 'achievements', pulse: true },
  { id: 'tech',      sprite: 'blueprint',  icon: '🔬', label: 'Tech',   color: '#e8933a', metaTab: 'tech' },
  { id: 'siege',     sprite: 'castle',     icon: '🏰', label: 'Mundo',  color: '#b32821', metaTab: 'world' },
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
  const { activeEvent, loadActiveEvent, addNotification } = useGameStore();
  const setOverlay = useGameStore((s) => s.setOverlay);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadActiveEvent();
    // Refresh active event every 60s — server tick rotates on its own and the
    // 60s cache there + 60s here keeps the total drift bounded.
    const apiPoll = setInterval(loadActiveEvent, 60_000);
    return () => clearInterval(apiPoll);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeRemaining = activeEvent?.ends_at
    ? Math.max(0, Math.floor((new Date(activeEvent.ends_at) - now) / 1000))
    : 0;

  const handleShortcut = (item) => {
    setOverlay('meta', { tab: item.metaTab });
    EventBridge.emit('overlay:open', { type: 'meta', data: { tab: item.metaTab } });
  };

  const handleEvent = () => {
    if (activeEvent) {
      addNotification(`${activeEvent.icon} ${activeEvent.name}: ${activeEvent.description}`, 'info');
    } else {
      addNotification('No hay evento activo en este momento', 'info');
    }
  };

  return (
    <div className="absolute right-2 top-20 z-20 pointer-events-none flex flex-col gap-2">
      {/* Live event button (always shown; placeholder if none active) */}
      <button
        onClick={handleEvent}
        className={`pointer-events-auto relative w-12 h-14 rounded-xl flex flex-col items-center justify-center transition-transform active:scale-90 hover:scale-105 ${activeEvent ? 'animate-pulse' : ''}`}
        style={grimBtn(activeEvent?.color || '#8a8378')}
        title={activeEvent ? activeEvent.description : 'Sin evento activo'}
      >
        <span className="text-xl leading-none">{activeEvent?.icon || '⏳'}</span>
        <span
          className="text-[8px] font-semibold leading-tight mt-0.5 tabular-nums"
          style={{ color: activeEvent?.color || '#888' }}
        >
          {activeEvent ? formatCountdown(activeRemaining) : '—'}
        </span>
      </button>

      {SHORTCUTS.map((item) => (
        <button
          key={item.id}
          onClick={() => handleShortcut(item)}
          className={`pointer-events-auto relative w-12 h-14 rounded-xl flex flex-col items-center justify-center transition-transform active:scale-90 hover:scale-105 ${item.pulse ? 'animate-pulse' : ''}`}
          style={grimBtn(item.color)}
          title={item.label}
        >
          <SpriteIcon name={item.sprite} size={22} fallback={item.icon} />
          <span className="text-[8px] font-semibold leading-tight mt-0.5" style={{ color: item.color }}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}
