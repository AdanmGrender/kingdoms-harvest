import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

/**
 * FactionPanel — list factions with member/territory counts and a "join"
 * button if the player isn't yet in one. Clicking a faction opens its
 * internal leaderboard (top contributors by faction_points).
 */
export default function FactionPanel() {
  const {
    factionsList, factionMembers, player,
    loadFactions, loadFactionMembers, joinFaction,
  } = useGameStore();
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { loadFactions(); }, []);

  const myFactionId = player?.faction_id;

  const handleExpand = async (factionId) => {
    if (expanded === factionId) {
      setExpanded(null);
      return;
    }
    if (!factionMembers[factionId]) await loadFactionMembers(factionId);
    setExpanded(factionId);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 text-center">
        {myFactionId
          ? `Sos miembro de ${factionsList.find((f) => f.id === myFactionId)?.name || myFactionId}`
          : 'Construí una Embajada y unite a una facción para conquistar territorios.'}
      </p>

      {factionsList.length === 0 && (
        <p className="text-gray-500 text-xs text-center py-4">Cargando facciones…</p>
      )}

      {factionsList.map((f) => {
        const isMine = f.id === myFactionId;
        const members = factionMembers[f.id] || [];
        return (
          <div
            key={f.id}
            className={`game-card ${isMine ? 'border-yellow-500' : ''}`}
            style={{ borderLeftColor: f.color, borderLeftWidth: 4 }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm flex items-center gap-1">
                  <span>{f.icon}</span> {f.name}
                  {isMine && <span className="text-yellow-400 text-[10px] ml-1">(la tuya)</span>}
                </p>
                <p className="text-[11px] text-gray-400 truncate">{f.description}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  👥 {f.member_count} miembros · 🏴 {f.territory_count} territorios · ⭐ {f.total_points} pts
                </p>
              </div>
              <div className="shrink-0 flex flex-col gap-1">
                {!myFactionId && (
                  <button
                    onClick={() => joinFaction(f.id)}
                    className="btn-primary text-[10px] px-2 py-1"
                  >
                    Unirse
                  </button>
                )}
                <button
                  onClick={() => handleExpand(f.id)}
                  className="text-[10px] text-purple-300 hover:text-purple-100 px-2 py-1 rounded bg-kingdom-blue/30"
                >
                  {expanded === f.id ? 'Ocultar' : 'Top'}
                </button>
              </div>
            </div>

            {expanded === f.id && (
              <div className="mt-2 pt-2 border-t border-kingdom-blue/40 space-y-1">
                {members.length === 0 && (
                  <p className="text-[10px] text-gray-500 text-center py-1">Sin miembros aún</p>
                )}
                {members.map((m, i) => (
                  <div key={m.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-300 truncate">
                      {i + 1}. {m.display_name} <span className="text-gray-500">Lv{m.level}</span>
                    </span>
                    <span className="text-yellow-400">{m.faction_points} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
