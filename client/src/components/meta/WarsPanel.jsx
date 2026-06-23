import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

const FACTION_META = {
  knights_of_dawn:  { name: 'Caballeros del Alba',     icon: '☀️', color: '#FFD700' },
  shadow_merchants: { name: 'Mercaderes de la Sombra', icon: '🌙', color: '#4B0082' },
  iron_legion:      { name: 'Legión de Hierro',         icon: '🛡️', color: '#8B0000' },
  green_wardens:    { name: 'Guardianes Verdes',        icon: '🌳', color: '#228B22' },
};

function formatRemaining(endsAt, now) {
  const remaining = Math.max(0, Math.floor((new Date(endsAt) - now) / 1000));
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * WarsPanel — two sections: server-wide faction war (always present) and the
 * player's alliance war if any. Leader can declare a new alliance war by
 * picking a target from the alliance list.
 */
export default function WarsPanel() {
  const {
    factionWar, myAllianceWar, myAlliance, alliancesList, player,
    loadFactionWar, loadMyAllianceWar, loadAlliances, declareAllianceWar,
  } = useGameStore();
  const [now, setNow] = useState(Date.now());
  const [target, setTarget] = useState('');

  useEffect(() => {
    loadFactionWar();
    loadMyAllianceWar();
    loadAlliances();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isLeader = myAlliance?.my_role === 'leader';
  const otherAlliances = (alliancesList || []).filter((a) => a.id !== myAlliance?.id);

  const handleDeclare = async () => {
    const id = parseInt(target, 10);
    if (!Number.isInteger(id)) return;
    const res = await declareAllianceWar(id);
    if (res?.success) setTarget('');
  };

  return (
    <div className="space-y-3">
      {/* Server-wide faction war */}
      <div className="game-card border-orange-700/40">
        <p className="text-sm font-bold mb-1">⚔️ Guerra de Facciones</p>
        {factionWar?.active ? (
          <>
            <p className="text-[11px] text-gray-400">
              Termina en {formatRemaining(factionWar.active.ends_at, now)} · Ganadora gana 50 KH para todos sus miembros
            </p>
            <div className="mt-2 space-y-1">
              {(factionWar.standings || []).map((s, i) => {
                const meta = FACTION_META[s.faction_id] || { name: s.faction_id, icon: '🏴', color: '#888' };
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                const isMine = s.faction_id === player?.faction_id;
                return (
                  <div
                    key={s.faction_id}
                    className={`flex items-center justify-between text-[11px] py-0.5 ${isMine ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}
                    style={{ borderLeft: `3px solid ${meta.color}`, paddingLeft: 6 }}
                  >
                    <span>{medal} {meta.icon} {meta.name}</span>
                    <span className="text-purple-300">{s.total} pts</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              Ganás puntos conquistando territorios, defendiendo en PvP, y otras acciones de facción.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-gray-500">Sin guerra activa.</p>
        )}
      </div>

      {/* Alliance vs alliance war */}
      {myAlliance ? (
        <div className="game-card border-red-700/40">
          <p className="text-sm font-bold mb-1">🏴 Guerra de Alianzas</p>
          {myAllianceWar ? (
            <>
              <p className="text-[11px] text-gray-300">
                {myAllianceWar.alliance_a.name} vs {myAllianceWar.alliance_b.name}
              </p>
              <p className="text-[10px] text-gray-500 mb-2">
                Termina en {formatRemaining(myAllianceWar.ends_at, now)}
              </p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className={`game-card py-2 ${myAllianceWar.my_side === 'a' ? 'border-yellow-500' : ''}`}>
                  <p className="text-[10px] text-gray-400 truncate">{myAllianceWar.alliance_a.name}</p>
                  <p className="text-lg font-bold">{myAllianceWar.score_a}</p>
                </div>
                <div className={`game-card py-2 ${myAllianceWar.my_side === 'b' ? 'border-yellow-500' : ''}`}>
                  <p className="text-[10px] text-gray-400 truncate">{myAllianceWar.alliance_b.name}</p>
                  <p className="text-lg font-bold">{myAllianceWar.score_b}</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-2">
                Atacá miembros del rival en PvP para sumar puntos. Ganador recibe 30 KH por miembro.
              </p>
            </>
          ) : isLeader ? (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400">Sin guerra activa. Como líder podés declarar una:</p>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-kingdom-blue rounded px-2 py-1 text-xs text-white"
              >
                <option value="">— Elegir alianza —</option>
                {otherAlliances.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.member_count} miembros)</option>
                ))}
              </select>
              <button
                onClick={handleDeclare}
                disabled={!target}
                className="w-full py-2 rounded-lg text-xs font-bold bg-red-700 hover:bg-red-600 text-white disabled:opacity-40"
              >
                ⚔️ Declarar guerra (24h)
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">
              Sin guerra activa. Solo el líder puede declarar.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-gray-500 text-center py-2">
          Unite a una alianza para participar en guerras de alianzas.
        </p>
      )}
    </div>
  );
}
