import React, { useEffect, useRef, useState } from 'react';
import useGameStore from '../../store/gameStore';

/**
 * AlliancesPanel — list every alliance with member counts. If the player
 * is in an alliance, show its details + members + leave/disband; if not,
 * show the create form + join button next to each.
 */
export default function AlliancesPanel() {
  const {
    alliancesList, myAlliance, allianceMembers, player, pendingInvitations,
    loadAlliances, loadMyAlliance, loadAllianceMembers, loadPendingInvitations,
    createAlliance, joinAlliance, leaveAlliance, disbandAlliance,
    respondInvitation, invitePlayer, setMemberRole, kickMember,
  } = useGameStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [motto, setMotto] = useState('');
  const [inviteId, setInviteId] = useState('');

  useEffect(() => {
    loadAlliances();
    loadMyAlliance();
    loadPendingInvitations();
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

  const handleInvite = async () => {
    if (!myAlliance) return;
    const id = parseInt(inviteId, 10);
    if (!Number.isInteger(id) || id < 1) return;
    const res = await invitePlayer(myAlliance.id, id);
    if (res?.success) setInviteId('');
  };

  const handleInviteFromSearch = async (targetId) => {
    if (!myAlliance) return;
    const res = await invitePlayer(myAlliance.id, targetId);
    if (res?.success) setInviteId('');
  };

  // Player IS in an alliance — show membership + chat + (officer+) controls
  if (myAlliance) {
    const members = allianceMembers[myAlliance.id] || [];
    const isLeader = myAlliance.my_role === 'leader';
    const isOfficer = myAlliance.my_role === 'officer' || isLeader;
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

        <AllianceChat myId={player?.telegram_id} />

        {/* Invite UI for leader/officer — name search w/ autocomplete fallback to ID */}
        {isOfficer && (
          <InviteSearchBox
            inviteId={inviteId}
            setInviteId={setInviteId}
            onInviteId={handleInvite}
            onInviteFromSearch={handleInviteFromSearch}
          />
        )}

        <div className="game-card border-yellow-700/30 bg-yellow-900/5 py-2">
          <p className="text-[10px] text-yellow-300">
            ⚔️ Bonus por miembro: +5% ATK · +5% DEF · +10% botín
          </p>
        </div>

        <p className="text-xs text-gray-400">Miembros:</p>
        {members.length === 0 && <p className="text-[10px] text-gray-500 text-center">Cargando...</p>}
        {members.map((m) => {
          const isMe = m.player_id === player?.telegram_id;
          const canPromote = isLeader && !isMe && m.role === 'member';
          const canDemote = isLeader && !isMe && m.role === 'officer';
          // Officers can kick members (not other officers, not leader). Leader can kick anyone except self.
          const canKick = !isMe && m.role !== 'leader' &&
            (isLeader || (myAlliance.my_role === 'officer' && m.role === 'member'));
          return (
            <div key={m.player_id} className="game-card py-2 text-xs flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">
                  {m.role === 'leader' && '👑 '}{m.role === 'officer' && '⭐ '}{m.display_name}
                  {isMe && <span className="text-yellow-400 ml-1">(vos)</span>}
                </p>
                <p className="text-[10px] text-gray-400">
                  Lv {m.level} · {new Date(m.joined_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {canPromote && (
                  <button
                    onClick={() => setMemberRole(myAlliance.id, m.player_id, 'officer')}
                    className="text-[9px] px-2 py-0.5 rounded bg-purple-800 hover:bg-purple-700 text-white"
                    title="Promover a oficial"
                  >Promover</button>
                )}
                {canDemote && (
                  <button
                    onClick={() => setMemberRole(myAlliance.id, m.player_id, 'member')}
                    className="text-[9px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-white"
                    title="Bajar a miembro"
                  >Bajar</button>
                )}
                {canKick && (
                  <button
                    onClick={() => kickMember(myAlliance.id, m.player_id)}
                    className="text-[9px] px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-white"
                    title="Expulsar"
                  >Kick</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Player NOT in alliance — show invitations inbox + create + join list
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 text-center">
        No pertenecés a ninguna alianza. Creá una propia o uníte a una existente.
      </p>

      {/* Invitations inbox */}
      {(pendingInvitations || []).length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-purple-300">📨 Invitaciones pendientes:</p>
          {pendingInvitations.map((inv) => (
            <div key={inv.id} className="game-card py-2 border-purple-700/60">
              <p className="text-sm font-bold">{inv.alliance_name}</p>
              {inv.alliance_motto && (
                <p className="text-[11px] text-gray-400 italic">"{inv.alliance_motto}"</p>
              )}
              <p className="text-[10px] text-gray-500">Invitado por {inv.invited_by_name}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => respondInvitation(inv.id, true)}
                  className="btn-primary text-[10px] px-3 py-1 flex-1"
                >Aceptar</button>
                <button
                  onClick={() => respondInvitation(inv.id, false)}
                  className="text-[10px] px-3 py-1 rounded bg-kingdom-blue/50 text-gray-300 flex-1"
                >Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}

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

/**
 * AllianceChat — last 50 messages + send box. Reads from store, writes via
 * the sendAllianceMessage action. Socket pushes append in real time;
 * sender's own message also appears via the post-send refresh.
 */
// Quick-pick stickers for alliance chat. Each is just a unicode emoji that
// gets appended to the message — no server changes needed since chat
// content is already arbitrary text.
const CHAT_STICKERS = ['👍', '⚔️', '🛡️', '🔥', '🏆', '😂', '🎉', '😱', '🤝', '🐺', '🐉', '💀'];

function AllianceChat({ myId }) {
  const { allianceMessagesList, loadAllianceMessages, sendAllianceMessage } = useGameStore();
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { loadAllianceMessages(); }, []);

  // Auto-scroll to newest message when list changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [allianceMessagesList.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const ok = await sendAllianceMessage(trimmed);
    if (ok) setText('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSticker = (s) => {
    setText((prev) => (prev + s).slice(0, 280));
    setShowStickers(false);
  };

  return (
    <div className="game-card border-purple-800/40">
      <p className="text-[10px] text-purple-300 mb-1">💬 Chat de alianza</p>
      <div
        ref={scrollRef}
        className="bg-kingdom-blue/20 rounded p-2 mb-2 max-h-40 overflow-y-auto space-y-1"
      >
        {allianceMessagesList.length === 0 ? (
          <p className="text-[10px] text-gray-500 text-center py-2">
            Sin mensajes todavía. Empezá la conversación.
          </p>
        ) : (
          allianceMessagesList.map((m) => {
            const mine = m.sender_id === myId;
            return (
              <div key={m.id} className="text-[11px]">
                <span className={`font-bold ${mine ? 'text-yellow-400' : 'text-purple-300'}`}>
                  {m.sender_name}:
                </span>{' '}
                <span className="text-gray-200">{m.content}</span>
              </div>
            );
          })
        )}
      </div>
      {showStickers && (
        <div className="grid grid-cols-6 gap-1 mb-2 p-1 bg-kingdom-blue/30 rounded">
          {CHAT_STICKERS.map((s) => (
            <button
              key={s}
              onClick={() => handleSticker(s)}
              className="text-2xl py-1 hover:bg-kingdom-blue/50 rounded"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => setShowStickers(!showStickers)}
          className="text-lg px-2 py-1 rounded bg-kingdom-blue/50 hover:bg-kingdom-blue/70"
          title="Stickers"
        >😊</button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribí un mensaje..."
          maxLength={280}
          className="flex-1 bg-kingdom-blue rounded px-2 py-1 text-xs text-white"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="btn-primary text-[10px] px-3 py-1 disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

/**
 * Search players by name (≥2 chars triggers a debounced search). Falls back
 * to plain telegram_id input if the user prefers to paste an ID. Each result
 * gets a one-tap "Invitar" button.
 */
function InviteSearchBox({ inviteId, setInviteId, onInviteId, onInviteFromSearch }) {
  const searchPlayers = useGameStore((s) => s.searchPlayers);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const r = await searchPlayers(query.trim());
      setResults(r);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="game-card border-purple-700/40 space-y-2">
      <p className="text-[11px] text-gray-400">📨 Invitar jugador</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre..."
        className="w-full bg-kingdom-blue rounded px-2 py-1 text-xs text-white"
      />
      {results.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {results.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-kingdom-blue/30">
              <span className="truncate">
                {p.display_name} <span className="text-gray-500">Lv{p.level}</span>
              </span>
              <button
                onClick={() => onInviteFromSearch(p.id)}
                className="btn-primary text-[9px] px-2 py-0.5"
              >Invitar</button>
            </div>
          ))}
        </div>
      )}
      <details className="text-[10px] text-gray-500">
        <summary className="cursor-pointer">¿Tenés el telegram_id?</summary>
        <div className="flex gap-2 mt-1">
          <input
            type="number"
            value={inviteId}
            onChange={(e) => setInviteId(e.target.value)}
            placeholder="123456789"
            className="flex-1 bg-kingdom-blue rounded px-2 py-1 text-xs text-white"
          />
          <button
            onClick={onInviteId}
            disabled={!inviteId.trim()}
            className="btn-primary text-[10px] px-3 py-1 disabled:opacity-40"
          >Invitar</button>
        </div>
      </details>
    </div>
  );
}
