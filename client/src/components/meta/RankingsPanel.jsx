import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

const FACTION_ICONS = {
  knights_of_dawn: '☀️',
  shadow_merchants: '🌙',
  iron_legion: '🛡️',
  green_wardens: '🌳',
};

/**
 * RankingsPanel — wraps the three existing leaderboards (KH tokens, level,
 * faction points) in a single tabbed view. Each tab is a thin renderer over
 * data already fetched by the store.
 */
export default function RankingsPanel() {
  const {
    leaderboard, leaderboardLevel, factionsList, player,
    loadLeaderboard, loadLeaderboardLevel, loadFactions,
  } = useGameStore();
  const [tab, setTab] = useState('tokens');

  useEffect(() => {
    if (tab === 'tokens')   loadLeaderboard();
    if (tab === 'level')    loadLeaderboardLevel();
    if (tab === 'factions') loadFactions();
  }, [tab]);

  const tabs = [
    { id: 'tokens',   label: '💎 KH Tokens' },
    { id: 'level',    label: '⭐ Nivel' },
    { id: 'factions', label: '🛡️ Facciones' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold transition-all ${
              tab === t.id ? 'bg-kingdom-accent text-white' : 'bg-kingdom-blue/50 text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tokens' && (
        <TokenLeaderboard rows={leaderboard} myName={player?.display_name} />
      )}
      {tab === 'level' && (
        <LevelLeaderboard rows={leaderboardLevel} myName={player?.display_name} />
      )}
      {tab === 'factions' && (
        <FactionLeaderboard rows={factionsList} myFactionId={player?.faction_id} />
      )}
    </div>
  );
}

function medal(idx) {
  return idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
}

function TokenLeaderboard({ rows, myName }) {
  if (!rows || rows.length === 0) return <Empty />;
  return (
    <div className="space-y-1">
      {rows.map((entry, idx) => {
        const isMe = entry.displayName === myName;
        return (
          <div key={idx} className={`game-card flex items-center gap-3 py-2 ${isMe ? 'border-purple-500 bg-purple-900/20' : ''}`}>
            <span className="text-sm font-bold w-8 text-center shrink-0">{medal(idx)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">
                {FACTION_ICONS[entry.factionId] || '⚔️'} {entry.displayName}
                {isMe && <span className="text-purple-400 text-xs ml-1">(vos)</span>}
              </p>
              <p className="text-[10px] text-gray-400">Nivel {entry.level}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-purple-400">{entry.totalEarned?.toLocaleString() || 0}</p>
              <p className="text-[10px] text-gray-500">KH ganados</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LevelLeaderboard({ rows, myName }) {
  if (!rows || rows.length === 0) return <Empty />;
  return (
    <div className="space-y-1">
      {rows.map((entry, idx) => {
        const isMe = entry.display_name === myName;
        return (
          <div key={idx} className={`game-card flex items-center gap-3 py-2 ${isMe ? 'border-yellow-500 bg-yellow-900/20' : ''}`}>
            <span className="text-sm font-bold w-8 text-center shrink-0">{medal(idx)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">
                {FACTION_ICONS[entry.faction_id] || '⚔️'} {entry.display_name}
                {isMe && <span className="text-yellow-400 text-xs ml-1">(vos)</span>}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-yellow-400">Lv {entry.level}</p>
              <p className="text-[10px] text-gray-500">{entry.xp} XP</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FactionLeaderboard({ rows, myFactionId }) {
  if (!rows || rows.length === 0) return <Empty />;
  return (
    <div className="space-y-1">
      {rows.map((f, idx) => {
        const isMine = f.id === myFactionId;
        return (
          <div
            key={f.id}
            className={`game-card py-2 ${isMine ? 'border-yellow-500 bg-yellow-900/10' : ''}`}
            style={{ borderLeftColor: f.color, borderLeftWidth: 4 }}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold w-8 text-center">{medal(idx)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{f.icon} {f.name}{isMine && <span className="text-yellow-400 text-xs ml-1">(la tuya)</span>}</p>
                <p className="text-[10px] text-gray-400">
                  👥 {f.member_count} · 🏴 {f.territory_count}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-yellow-400">{f.total_points}</p>
                <p className="text-[10px] text-gray-500">pts</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty() {
  return <p className="text-gray-500 text-xs text-center py-6">Sin datos todavía.</p>;
}
