import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

/**
 * TournamentsPanel — list every active tournament with countdown, prizes,
 * and the player's standings inside it. Click "Ver tabla" to load the live
 * leaderboard (lazy, refreshed each open).
 */

function formatRemaining(endsAt, now) {
  const remaining = Math.max(0, Math.floor((new Date(endsAt) - now) / 1000));
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TournamentsPanel() {
  const {
    tournaments, tournamentLeaderboards, player,
    loadTournaments, loadTournamentLeaderboard,
  } = useGameStore();
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { loadTournaments(); }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleExpand = async (tournamentId) => {
    if (expanded === tournamentId) {
      setExpanded(null);
      return;
    }
    if (!tournamentLeaderboards[tournamentId]) {
      await loadTournamentLeaderboard(tournamentId);
    }
    setExpanded(tournamentId);
  };

  if (!tournaments || tournaments.length === 0) {
    return <p className="text-gray-500 text-xs text-center py-6">Sin torneos activos. Volvé en un rato.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 text-center">
        Torneos rotando cada 24h. Top 3 reciben KH al cierre.
      </p>
      {tournaments.map((t) => {
        const rows = tournamentLeaderboards[t.id] || [];
        const myRow = rows.find((r) => r.player_id === player?.telegram_id);
        return (
          <div key={t.id} className="game-card">
            <div className="flex items-start gap-2">
              <span className="text-2xl shrink-0">{t.icon || '🏆'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{t.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{t.description}</p>
                <p className="text-[10px] text-yellow-400 mt-0.5">
                  ⏱️ {formatRemaining(t.ends_at, now)} ·
                  Premios: 🥇{t.prizes?.[1] || 0} 🥈{t.prizes?.[2] || 0} 🥉{t.prizes?.[3] || 0} KH
                </p>
                {myRow && (
                  <p className="text-[10px] text-purple-300 mt-0.5">
                    Tu posición: #{myRow.rank} · Δ {myRow.delta.toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleExpand(t.id)}
                className="text-[10px] text-purple-300 hover:text-purple-200 px-2 py-1 rounded bg-kingdom-blue/30 shrink-0"
              >
                {expanded === t.id ? 'Ocultar' : 'Ver tabla'}
              </button>
            </div>

            {expanded === t.id && (
              <div className="mt-2 pt-2 border-t border-kingdom-blue/40 space-y-1">
                {rows.length === 0 && (
                  <p className="text-[10px] text-gray-500 text-center">Sin participantes todavía.</p>
                )}
                {rows.map((r) => {
                  const isMe = r.player_id === player?.telegram_id;
                  const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;
                  return (
                    <div
                      key={r.player_id}
                      className={`flex items-center justify-between text-[11px] py-0.5 ${isMe ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}
                    >
                      <span className="truncate">
                        {medal} {r.display_name} <span className="text-gray-500">Lv{r.level}</span>
                      </span>
                      <span className="text-purple-300">Δ {r.delta.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
