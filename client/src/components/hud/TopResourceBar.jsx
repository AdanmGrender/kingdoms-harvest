/**
 * TopResourceBar — Professional top HUD inspired by Whiteout Survival / Last War.
 * Shows: player avatar + level + VIP, main resources, power, gems.
 */
import { useMemo, useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

const MAIN_RESOURCES = [
  { key: 'wood', icon: '🪵', color: '#c89770' },
  { key: 'stone', icon: '🪨', color: '#b8b8b8' },
  { key: 'wheat', icon: '🌾', color: '#f5d742' },
  { key: 'iron', icon: '⛏️', color: '#8fa4b8' },
];

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n | 0}`;
}

export default function TopResourceBar() {
  const player = useGameStore((s) => s.player);
  const resources = useGameStore((s) => s.resources);
  const troops = useGameStore((s) => s.troops);
  const tokenInfo = useGameStore((s) => s.tokenInfo);

  const [timeInfo, setTimeInfo] = useState({ icon: '☀️', dayCount: 1 });

  useEffect(() => {
    const handler = (data) => setTimeInfo(data);
    EventBridge.on('time:updated', handler);
    return () => EventBridge.off('time:updated', handler);
  }, []);

  const displayName = useMemo(() => {
    const raw = player?.display_name || player?.username || '';
    if (!raw || raw.length < 2) return 'Señor';
    return raw.length > 10 ? raw.slice(0, 10) + '…' : raw;
  }, [player?.display_name, player?.username]);

  const power = useMemo(() => {
    if (!troops || troops.length === 0) return (player?.level || 1) * 100;
    return troops.reduce((sum, t) => sum + (t.quantity || 0) * 10, 0) + (player?.level || 1) * 100;
  }, [troops, player?.level]);

  const getAmount = (key) => {
    const r = resources?.[key];
    return typeof r === 'object' ? r?.amount ?? 0 : r ?? 0;
  };

  const goldAmount = getAmount('gold');
  const xpPct = player?.xp_for_next ? Math.min(100, ((player.xp || 0) / player.xp_for_next) * 100) : 0;

  if (!player) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none px-2 pt-2">
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl pointer-events-auto"
        style={{
          background: 'linear-gradient(180deg, rgba(15,18,35,0.95) 0%, rgba(10,12,24,0.92) 100%)',
          border: '1px solid rgba(255,215,80,0.3)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {/* Avatar + Level */}
        <div className="relative flex-shrink-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle, #3b2f1a 0%, #1a1408 100%)',
              border: '2px solid #ffd750',
              boxShadow: '0 0 6px rgba(255,215,80,0.4)',
            }}
          >
            <span className="text-lg">👑</span>
          </div>
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-gray-900"
            style={{
              background: 'linear-gradient(135deg, #ffe070 0%, #b8860b 100%)',
              border: '1px solid #1a1408',
            }}
          >
            {player.level || 1}
          </div>
        </div>

        {/* Name + Power + XP */}
        <div className="flex flex-col min-w-0 flex-shrink">
          <p
            className="text-white text-[11px] font-semibold truncate leading-tight"
            style={{ fontFamily: 'MedievalSharp, serif', maxWidth: '70px' }}
          >
            {displayName}
          </p>
          <div className="flex items-center gap-0.5 leading-none">
            <span className="text-[8px]">⚔️</span>
            <span className="text-orange-300 text-[9px] font-medium tabular-nums">
              {formatNumber(power)}
            </span>
          </div>
          <div className="w-14 h-1 bg-black/40 rounded-full overflow-hidden mt-0.5">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${xpPct}%`,
                background: 'linear-gradient(90deg, #3b82f6, #22d3ee)',
              }}
            />
          </div>
        </div>

        {/* Resources */}
        <div className="flex items-center gap-1 flex-1 justify-end overflow-hidden">
          {MAIN_RESOURCES.map((r) => (
            <div
              key={r.key}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-md"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-[11px]">{r.icon}</span>
              <span className="text-white text-[10px] font-semibold tabular-nums">
                {formatNumber(getAmount(r.key))}
              </span>
            </div>
          ))}
        </div>

        {/* Gold + Gems — premium chips */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md"
            style={{
              background: 'linear-gradient(180deg, rgba(255,215,80,0.22) 0%, rgba(180,140,30,0.18) 100%)',
              border: '1px solid rgba(255,215,80,0.5)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 6px rgba(255,215,80,0.25)',
            }}>
            <span className="text-[11px]">🪙</span>
            <span className="text-yellow-200 text-[10px] font-bold tabular-nums">
              {formatNumber(goldAmount)}
            </span>
          </div>
          {tokenInfo && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md"
              style={{
                background: 'linear-gradient(180deg, rgba(100,200,255,0.22) 0%, rgba(60,140,200,0.18) 100%)',
                border: '1px solid rgba(100,200,255,0.5)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 6px rgba(100,200,255,0.25)',
              }}>
              <span className="text-[11px]">💎</span>
              <span className="text-cyan-200 text-[10px] font-bold tabular-nums">
                {tokenInfo.balance || 0}
              </span>
            </div>
          )}
        </div>

        {/* Day indicator */}
        <div className="flex flex-col items-center flex-shrink-0 px-1">
          <span className="text-sm leading-none">{timeInfo.icon}</span>
          <span className="text-yellow-300 text-[8px] font-medium whitespace-nowrap">
            D{timeInfo.dayCount}
          </span>
        </div>
      </div>
    </div>
  );
}
