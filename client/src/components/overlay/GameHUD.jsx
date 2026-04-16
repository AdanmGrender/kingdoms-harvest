/**
 * GameHUD: Top overlay showing player resources, level, XP bar.
 * Shows a brief pulse animation on the KH token balance when tokens are earned.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

const RESOURCE_ICONS = {
  gold: '🪙',
  wheat: '🌾',
  wood: '🪵',
  stone: '🪨',
  iron: '⛏️',
  bread: '🍞',
};

export default function GameHUD() {
  const player = useGameStore((s) => s.player);
  const resources = useGameStore((s) => s.resources);
  const tokenInfo = useGameStore((s) => s.tokenInfo);

  const [timeInfo, setTimeInfo] = useState({ icon: '☀️', period: 'morning', dayCount: 1 });
  const [tokenPulse, setTokenPulse] = useState(false);
  const pulseTimer = useRef(null);

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
    return Object.entries(RESOURCE_ICONS)
      .map(([key, icon]) => {
        const res = resources[key] || resources[Object.keys(resources).find(k =>
          k === key || resources[k]?.resource_id === key
        )];
        return {
          key,
          icon,
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

        {/* Day/Night indicator */}
        <div className="flex items-center gap-1 text-[10px] text-gray-300 pointer-events-auto">
          <span>{timeInfo.icon}</span>
          <span className="text-yellow-300">Dia {timeInfo.dayCount}</span>
        </div>

        {/* Resources */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {mainResources.map(r => (
            <div key={r.key} className="flex items-center gap-0.5 text-[10px] text-white whitespace-nowrap">
              <span>{r.icon}</span>
              <span>{r.amount >= 1000 ? `${(r.amount/1000).toFixed(1)}k` : r.amount}</span>
            </div>
          ))}
          {tokenInfo && (
            <div
              className={`flex items-center gap-0.5 text-[10px] whitespace-nowrap transition-all duration-200 ${
                tokenPulse ? 'text-purple-300 scale-125' : 'text-yellow-300'
              }`}
            >
              <span>💎</span>
              <span>{tokenInfo.balance || 0} KH</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
