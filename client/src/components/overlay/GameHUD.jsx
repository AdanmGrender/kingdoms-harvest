/**
 * GameHUD: Top overlay showing player resources, level, XP bar, and day/night.
 * Shows a brief pulse animation on the KH token balance when tokens are earned.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon from '../ui/SpriteIcon';
import NotificationPrefsPanel from '../ui/NotificationPrefsPanel';

const FACTION_ICONS = {
  knights_of_dawn: '☀️',
  shadow_merchants: '🌙',
  iron_legion: '🛡️',
  green_wardens: '🌳',
};

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

  // Sanitize display name — handle truncated/missing names
  const displayName = useMemo(() => {
    const raw = player?.display_name || player?.username || '';
    // If the name looks truncated (< 3 chars) or is gibberish, use a better fallback
    if (!raw || raw.length < 2) return 'Aventurero';
    return raw.length > 12 ? raw.slice(0, 12) + '…' : raw;
  }, [player?.display_name, player?.username]);

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
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 m-2 rounded-xl"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 20, 40, 0.92) 0%, rgba(15, 15, 35, 0.88) 100%)',
          border: '1px solid rgba(255, 215, 0, 0.25)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
        }}>

        {/* Player info — left section */}
        <div className="flex items-center gap-2 pointer-events-auto min-w-0">
          {/* Level badge */}
          <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}>
            <span className="text-[10px] font-bold text-gray-900">{player.level || 1}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-[11px] font-semibold truncate leading-tight"
              style={{ fontFamily: 'MedievalSharp, serif', maxWidth: '80px' }}>
              {displayName}
            </p>
            {/* XP Bar */}
            <div className="w-16 h-1.5 bg-gray-700/60 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${xpPercent}%`,
                  background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Day/Night — center + notification bell */}
        <div className="flex items-center gap-1 pointer-events-auto px-2">
          <span className="text-sm">{timeInfo.icon}</span>
          <span className="text-yellow-300 text-[10px] font-medium whitespace-nowrap">
            Día {timeInfo.dayCount}
          </span>
          {typeof setShowNotifPanel === 'function' && (
            <button
              onClick={() => setShowNotifPanel(true)}
              className="text-[13px] opacity-70 hover:opacity-100 transition-opacity ml-1"
              title="Notificaciones"
            >
              🔔
            </button>
          )}
        </div>

        {/* Resources — right section */}
        <div className="flex items-center gap-1.5 overflow-x-auto pointer-events-auto">
          {mainResources.map(r => (
            <div key={r.key} className="flex items-center gap-0.5 px-1 py-0.5 rounded whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <SpriteIcon name={r.sprite} size={14} fallback="?" />
              <span className="text-white text-[10px] font-medium tabular-nums">
                {r.amount >= 1000 ? `${(r.amount / 1000).toFixed(1)}k` : r.amount}
              </span>
            </div>
          ))}
          {tokenInfo && (
            <div
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium tabular-nums whitespace-nowrap transition-all duration-200 ${
                tokenPulse ? 'text-purple-300 scale-125' : 'text-yellow-300'
              }`}
              style={{ background: 'rgba(255, 215, 0, 0.1)' }}
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
