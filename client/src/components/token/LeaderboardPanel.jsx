import React, { useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

const FACTION_ICONS = {
  knights_of_dawn: '☀️',
  shadow_merchants: '🌙',
  iron_legion: '🛡️',
  green_wardens: '🌳',
};

export default function LeaderboardPanel() {
  const { leaderboard, loadLeaderboard, player } = useGameStore();

  useEffect(() => {
    loadLeaderboard();
  }, []);

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="game-card text-center text-gray-400 py-6">
        <SpriteIcon name="castle_flag" size={40} />
        <p className="mt-2 text-sm">Cargando clasificación...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-gray-300 px-1 flex items-center gap-2">
        <span>🏆</span> Top 50 — Tokens Ganados
      </h3>

      {leaderboard.map((entry, idx) => {
        const isMe = entry.displayName === player?.display_name;
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

        return (
          <div
            key={idx}
            className={`game-card flex items-center gap-3 py-2 ${
              isMe ? 'border-purple-500 bg-purple-900/20' : ''
            }`}
          >
            <span className="text-sm font-bold w-8 text-center shrink-0">{medal}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${isMe ? 'text-purple-300' : ''}`}>
                {FACTION_ICONS[entry.factionId] || '⚔️'} {entry.displayName}
                {isMe && <span className="text-purple-400 text-xs ml-1">(vos)</span>}
              </p>
              <p className="text-[10px] text-gray-400">Nivel {entry.level}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-purple-400">{entry.totalEarned.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">KH ganados</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
