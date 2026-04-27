import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

/**
 * AlliancesPanel — list every alliance with member counts. If the player
 * is in an alliance, show its details + members + leave/disband; if not,
 * show the create form + join button next to each.
 */
export default function AlliancesPanel() {
  const {
    alliancesList, myAlliance, allianceMembers, player,
    loadAlliances, loadMyAlliance, loadAllianceMembers,
    createAlliance, joinAlliance, leaveAlliance, disbandAlliance,
  } = useGameStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [motto, setMotto] = useState('');

  useEffect(() => {
    loadAlliances();
    loadMyAlliance();
  }, []);

  useEffect(() => {
    if (myAlliance?.id && !allianceMembers[myAlliance.id]) {
      loadAllianceMembers(myAlliance.id);
    }
  }, [myAlliance?.id]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const res = await createAlliance(name.trim(), motto.trim());
    if (res?.success) {
      setName(''); setMotto(''); setCreating(false);
    }
  };

  // Player IS in an alliance — show the membership panel
  if (myAlliance) {
    const members = allianceMembers[myAlliance.id] || [];
    const isLeader = myAlliance.my_role === 'leader';
    return (
      <div className="space-y-3">
        <div className="game-card border-yellow-700 bg-yellow-900/10">
          <p className="text-sm font-bold text-yellow-300">{myAlliance.name}</p>
          {myAlliance.motto && (
            <p className="text-[11px] text-gray-300 italic mt-0.5">"{myAlliance.motto}"</p>
          )}
          <p className="text-[10px] text-gray-400 mt-1">
            👥 {myAlliance.member_count}/{myAlliance.member_limit} ·
            {isLeader ? ' 👑 Sos líder' : ' Miembro'}
          </p>
          <div className="mt-2 flex gap-2">
            {isLeader ? (
              <button
                onClick={() => disbandAlliance(myAlliance.id)}
                className="text-[10px] px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white"
              >
                Disolver alianza
              </button>
            ) : (
              <button
                onClick={() => leaveAlliance()}
                className="text-[10px] px-3 py-1 rounded bg-red-800 hover:bg-red-700 text-white"
              >
                Salir
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400">Miembros:</p>
        {members.length === 0 && <p className="text-[10px] text-gray-500 text-center">Cargando...</p>}
        {members.map((m) => (
          <div key={m.player_id} className="game-card py-2 text-xs flex items-center justify-between">
            <div>
              <p className="font-bold">
                {m.role === 'leader' && '👑 '}{m.display_name}
                {m.player_id === player?.telegram_id && <span className="text-yellow-400 ml-1">(vos)</span>}
              </p>
              <p className="text-[10px] text-gray-400">
                Lv {m.level} · {new Date(m.joined_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Player NOT in alliance — show create + join list
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 text-center">
        No pertenecés a ninguna alianza. Creá una propia o uníte a una existente.
      </p>

      {creating ? (
        <div className="game-card space-y-2">
          <input
            type="text"
            placeholder="Nombre (3-24 caracteres)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            className="w-full bg-kingdom-blue rounded px-2 py-1 text-xs text-white"
          />
          <input
            type="text"
            placeholder="Lema (opcional)"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            maxLength={80}
            className="w-full bg-kingdom-blue rounded px-2 py-1 text-xs text-white"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary text-xs flex-1" disabled={!name.trim()}>
              Crear
            </button>
            <button onClick={() => setCreating(false)} className="text-xs px-3 py-1 rounded bg-kingdom-blue/50 text-gray-400">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="btn-primary w-full text-xs">
          + Crear alianza
        </button>
      )}

      {alliancesList.length === 0 && (
        <p className="text-gray-500 text-xs text-center py-4">Aún no hay alianzas. Sé el primero.</p>
      )}
      {alliancesList.map((a) => {
        const isFull = a.member_count >= a.member_limit;
        return (
          <div key={a.id} className="game-card py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{a.name}</p>
                {a.motto && <p className="text-[11px] text-gray-400 italic truncate">"{a.motto}"</p>}
                <p className="text-[10px] text-gray-500">👥 {a.member_count}/{a.member_limit}</p>
              </div>
              <button
                onClick={() => joinAlliance(a.id)}
                disabled={isFull}
                className="btn-primary text-[10px] px-2 py-1 disabled:opacity-40"
              >
                {isFull ? 'Llena' : 'Unirme'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
