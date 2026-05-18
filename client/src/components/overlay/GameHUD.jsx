/**
 * GameHUD: Top overlay showing player resources, level, XP bar.
 * Shows a brief pulse animation on the KH token balance when tokens are earned.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon from '../ui/SpriteIcon';
import NotificationPrefsPanel from '../ui/NotificationPrefsPanel';

const RESOURCE_SPRITES = {
  gold:  'gold',
  wheat: 'wheat',
  wood:  'wood',
  stone: 'stone',
  iron:  'iron',
  bread: 'bread',
};

function useConstructionTimers(buildings) {
  const [now, setNow] = useState(Date.now());
  const underConstruction = useMemo(
    () => (buildings || []).filter((b) => b.is_building && b.build_complete_at),
    [buildings]
  );
  useEffect(() => {
    if (underConstruction.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [underConstruction.length]);
  return underConstruction.map((b) => {
    const msLeft = Math.max(0, new Date(b.build_complete_at).getTime() - now);
    const mins = Math.floor(msLeft / 60000);
    const secs = Math.floor((msLeft % 60000) / 1000);
    return { ...b, timeLeft: msLeft > 0 ? `${mins}m ${secs}s` : 'Listo!' };
  });
}

export default function GameHUD() {
  const player = useGameStore((s) => s.player);
  const resources = useGameStore((s) => s.resources);
  const tokenInfo = useGameStore((s) => s.tokenInfo);
  const buildings = useGameStore((s) => s.buildings);

  const [timeInfo, setTimeInfo] = useState({ icon: '☀️', period: 'morning', dayCount: 1 });
  const [tokenPulse, setTokenPulse] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const pulseTimer = useRef(null);
  const constructionTimers = useConstructionTimers(buildings);

  useEffect(() => {
    const handler = (data) => setTimeInfo(data);
    EventBridge.on('time:updated', handler);
    return () => EventBridge.off('time:updated', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setTokenPulse(true);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setTokenPulse(false), 1000);
    };
    EventBridge.on('token:earned', handler);
    return () => {
      EventBridge.off('token:earned', handler);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, []);

  const xpPercent = useMemo(() => {
    if (!player?.xp_for_next) return 0;
    return Math.min(100, ((player.xp || 0) / player.xp_for_next) * 100);
  }, [player?.xp, player?.xp_for_next]);

  const mainResources = useMemo(() => {
    if (!resources) return [];
    return Object.entries(RESOURCE_SPRITES)
      .map(([key, sprite]) => {
        const res = resources[key] || resources[Object.keys(resources).find(k =>
          k === key || resources[k]?.resource_id === key
        )];
        return {
          key,
          sprite,
          amount: typeof res === 'object' ? res?.amount ?? 0 : res ?? 0,
        };
      })
      .filter(r => r.amount > 0 || r.key === 'gold');
  }, [resources]);

  if (!player) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="flex items-center justify-between px-2 py-1 m-2 rounded-lg"
        style={{ background: 'rgba(20, 20, 40, 0.85)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>

        {/* Player info */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="text-xs">
            <span className="text-yellow-400 font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
              Lv{player.level || 1}
            </span>
            <span className="text-gray-300 ml-1 text-[10px]">
              {player.display_name || 'Aventurero'}
            </span>
          </div>
          {/* XP Bar */}
          <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* Day/Night indicator + notification bell */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1 text-[10px] text-gray-300">
            <span>{timeInfo.icon}</span>
            <span className="text-yellow-300">Dia {timeInfo.dayCount}</span>
          </div>
          <button
            onClick={() => setShowNotifPanel(true)}
            className="text-[13px] opacity-70 hover:opacity-100 transition-opacity"
            title="Notificaciones"
          >
            🔔
          </button>
        </div>

        {/* Resources */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {mainResources.map(r => (
            <div key={r.key} className="flex items-center gap-0.5 text-[10px] text-white whitespace-nowrap">
              <SpriteIcon name={r.sprite} size={14} fallback="?" />
              <span>{r.amount >= 1000 ? `${(r.amount/1000).toFixed(1)}k` : r.amount}</span>
            </div>
          ))}
          {tokenInfo && (
            <div
              className={`flex items-center gap-0.5 text-[10px] whitespace-nowrap transition-all duration-200 ${
                tokenPulse ? 'text-purple-300 scale-125' : 'text-yellow-300'
              }`}
            >
              <SpriteIcon name="kh_token" size={14} fallback="💎" />
              <span>{tokenInfo.balance || 0}</span>
            </div>
          )}
        </div>
      </div>

      {showNotifPanel && <NotificationPrefsPanel onClose={() => setShowNotifPanel(false)} />}

      {/* Construction timers */}
      {constructionTimers.length > 0 && (
        <div className="flex gap-1 px-2 py-0.5 pointer-events-none">
          {constructionTimers.map((b) => (
            <div key={b.id}
              className="flex items-center gap-1 text-[9px] text-amber-300 rounded px-1 py-0.5"
              style={{ background: 'rgba(20,20,40,0.8)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <span>🏗️</span>
              <span>{b.building_id.replace(/_/g, ' ')}</span>
              <span className="text-white font-bold">{b.timeLeft}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
