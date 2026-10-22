/**
 * EventSidebar — Right rail upper. Shows the currently active server-wide
 * seasonal event (if any) with a real countdown to its end, plus a few
 * static shortcuts (achievements, tech, world map) to the MetaPanel.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import IconButton from '../ui/IconButton';
import SpriteIcon from '../ui/SpriteIcon';
import { KH } from '../ui/kitPieces';

const SHORTCUTS = [
  { id: 'newplayer', sprite: 'reward_bag', label: 'Logros', color: KH.brass, metaTab: 'achievements', pulse: true },
  { id: 'tech',      sprite: 'blueprint',  label: 'Tech',   color: KH.ember, metaTab: 'tech' },
  { id: 'siege',     sprite: 'world',      label: 'Mundo',  color: KH.seal, metaTab: 'world' },
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
      addNotification(`${activeEvent.name}: ${activeEvent.description}`, 'info');
    } else {
      addNotification('No hay evento activo en este momento', 'info');
    }
  };

  return (
    <div className="absolute right-2 top-32 z-20 pointer-events-none flex flex-col gap-2">
      {/* Live event button (always shown; placeholder if none active) */}
      <IconButton
        onClick={handleEvent}
        accent={activeEvent?.color || KH.iron}
        className={activeEvent ? 'animate-pulse' : ''}
        title={activeEvent ? activeEvent.description : 'Sin evento activo'}
        style={{ width: 52 }}
      >
        <SpriteIcon name="flame" size={28} />
        <span className="font-numeric text-[12px] leading-tight tabular-nums" style={{ color: KH['brass-light'] }}>
          {activeEvent ? formatCountdown(activeRemaining) : '—'}
        </span>
      </IconButton>

      {SHORTCUTS.map((item) => (
        <IconButton
          key={item.id}
          icon={item.sprite}
          label={item.label}
          accent={item.color}
          className={item.pulse ? 'animate-pulse' : ''}
          title={item.label}
          onClick={() => handleShortcut(item)}
        />
      ))}
    </div>
  );
}
