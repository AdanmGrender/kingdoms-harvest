import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const ROLE_META = {
  leader:  { badge: '👑', label: 'Líder',   color: 'text-yellow-400' },
  officer: { badge: '⭐', label: 'Oficial', color: 'text-blue-300'   },
  member:  { badge: '•',  label: 'Miembro', color: 'text-gray-400'   },
};

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        active
          ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/50'
          : 'text-gray-400 border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

function XpBar({ xp, xpForNext }) {
  if (!xpForNext || xpForNext <= 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-700">
          <div className="h-full w-full rounded-full bg-yellow-500" />
        </div>
        <span className="text-[10px] text-yellow-400 shrink-0">MAX</span>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((xp / xpForNext) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-700">
        <div
          className="h-full rounded-full bg-yellow-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-400 shrink-0">{xp}/{xpForNext} XP</span>
    </div>
  );
}

function CreateGuildForm({ onCreate }) {
  const [name, setName]        = useState('');
  const [tag, setTag]          = useState('');
  const [desc, setDesc]        = useState('');
  const [loading, setLoading]  = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !tag.trim()) return;
    setLoading(true);
    await onCreate({ name: name.trim(), tag: tag.trim().toUpperCase(), description: desc.trim() });
    setLoading(false);
  };

  return (
    <div className="space-y-4 mt-2">
      <div>
        <label className="text-[11px] text-gray-400 block mb-1">Nombre del gremio</label>
        <input
          type="text"
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Caballeros del Norte"
          className="w-full text-sm rounded-lg bg-gray-800/80 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:border-yellow-700"
        />
      </div>

      <div>
        <label className="text-[11px] text-gray-400 block mb-1">Tag (máx. 5 letras)</label>
        <input
          type="text"
          maxLength={5}
          value={tag}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
          placeholder="[KDN]"
          className="w-full text-sm rounded-lg bg-gray-800/80 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:border-yellow-700 font-mono uppercase"
        />
      </div>

      <div>
        <label className="text-[11px] text-gray-400 block mb-1">Descripción (opcional)</label>
        <textarea
          maxLength={200}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="¿De qué trata tu gremio?"
          rows={3}
          className="w-full text-sm rounded-lg bg-gray-800/80 border border-gray-700 text-white px-3 py-2 focus:outline-none focus:border-yellow-700 resize-none"
        />
        <p className="text-[10px] text-gray-600 text-right mt-0.5">{desc.length}/200</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !name.trim() || !tag.trim()}
        className="w-full py-3 rounded-lg text-sm font-bold text-white disabled:opacity-40 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #b45309, #d97706)' }}
      >
        {loading ? 'Fundando...' : 'Fundar Gremio (500 🪙 oro)'}
      </button>
    </div>
  );
}

function MyGuildTab({ guild, onLeave, onDonate }) {
  const [donateAmount, setDonateAmount] = useState('');
  const [donating, setDonating]        = useState(false);
  const [showCreate, setShowCreate]    = useState(false);
  const createGuild = useGameStore((s) => s.createGuild);

  const handleDonate = async () => {
    const amount = Number(donateAmount);
    if (!amount || amount < 1) return;
    setDonating(true);
    await onDonate(amount);
    setDonateAmount('');
    setDonating(false);
  };

  const handleCreate = async (payload) => {
    await createGuild(payload);
    setShowCreate(false);
  };

  if (!guild) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-12">
        <span className="text-5xl">🏰</span>
        <p className="text-gray-400 text-sm text-center">No perteneces a ningún gremio</p>
        {showCreate ? (
          <div className="w-full px-2">
            <button
              onClick={() => setShowCreate(false)}
              className="text-[11px] text-gray-500 mb-2 flex items-center gap-1"
            >
              ← Cancelar
            </button>
            <CreateGuildForm onCreate={handleCreate} />
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="btn-gold px-6 py-2.5 rounded-lg text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #b45309, #d97706)', color: '#fff' }}
          >
            Crear Gremio
          </button>
        )}
      </div>
    );
  }

  const level     = guild.level ?? 1;
  const levelBonus = guild.levelBonus || `+${(level - 1) * 5}% XP del gremio`;
  const members   = guild.members || [];

  return (
    <div className="space-y-4">
      {/* Guild header */}
      <div
        className="rounded-xl p-4 border border-yellow-900/30"
        style={{ background: 'rgba(255,215,0,0.05)' }}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-yellow-400 text-lg font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
              [{guild.tag}] {guild.name}
            </p>
            <span
              className="inline-block text-[10px] px-2 py-0.5 rounded-full font-bold mt-1"
              style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)' }}
            >
              Nivel {level}
            </span>
          </div>
          <span className="text-3xl">⚔️</span>
        </div>

        {/* XP bar */}
        <XpBar xp={guild.xp ?? 0} xpForNext={guild.xpForNext} />

        {/* Level bonus */}
        {levelBonus && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-gray-500">Bono activo:</span>
            <span className="text-[10px] text-green-400 font-semibold">{levelBonus}</span>
          </div>
        )}
      </div>

      {/* Treasury */}
      <div
        className="rounded-xl p-3 border border-yellow-900/30"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <div>
              <p className="text-[11px] text-gray-400">Tesoro del gremio</p>
              <p className="text-yellow-400 font-bold text-sm">{guild.treasury ?? 0} oro</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={donateAmount}
            onChange={(e) => setDonateAmount(e.target.value)}
            placeholder="Cantidad"
            className="flex-1 text-xs rounded-lg bg-gray-800 border border-gray-700 text-white px-2 py-1.5 focus:outline-none focus:border-yellow-700"
          />
          <button
            onClick={handleDonate}
            disabled={donating || !donateAmount || Number(donateAmount) < 1}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #b45309, #d97706)' }}
          >
            {donating ? '...' : 'Donar'}
          </button>
        </div>
      </div>

      {/* Members */}
      <div>
        <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">
          Miembros · {members.length}/30
        </p>
        <div className="space-y-1.5">
          {members.map((m, i) => {
            const rm = ROLE_META[m.role] || ROLE_META.member;
            return (
              <div
                key={m.id ?? i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-base w-5 text-center">{rm.badge}</span>
                <span className={`text-xs font-semibold flex-1 ${rm.color}`}>{m.username || m.name}</span>
                <span className="text-[10px] text-gray-500">Nv.{m.level}</span>
                <span className="text-[10px] text-yellow-700">{m.contribution ?? 0} pts</span>
              </div>
            );
          })}
          {members.length === 0 && (
            <p className="text-center text-gray-600 text-xs py-4">Sin miembros registrados</p>
          )}
        </div>
      </div>

      {/* Leave */}
      <button
        onClick={onLeave}
        className="w-full py-2.5 rounded-lg text-xs font-bold border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors"
      >
        Abandonar gremio
      </button>
    </div>
  );
}

function ExploreTab({ guild }) {
  const guildList  = useGameStore((s) => s.guildList);
  const listGuilds = useGameStore((s) => s.listGuilds);
  const joinGuild  = useGameStore((s) => s.joinGuild);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(null);

  useEffect(() => {
    setLoading(true);
    listGuilds().finally(() => setLoading(false));
  }, []);

  const handleJoin = async (id) => {
    setJoining(id);
    await joinGuild(id);
    setJoining(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-gray-500 text-xs animate-pulse">Cargando gremios...</span>
      </div>
    );
  }

  if (guildList.length === 0) {
    return (
      <p className="text-center text-gray-600 text-xs py-12">No hay gremios disponibles</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {guildList.map((g) => (
        <div
          key={g.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-yellow-900/20"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold truncate">
              <span className="text-yellow-600">[{g.tag}]</span> {g.name}
            </p>
            <p className="text-gray-500 text-[10px]">
              Nivel {g.level ?? 1} · {g.memberCount ?? 0}/30 miembros
            </p>
          </div>
          <button
            onClick={() => handleJoin(g.id)}
            disabled={!!guild || joining === g.id}
            className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)' }}
          >
            {joining === g.id ? '...' : 'Unirse'}
          </button>
        </div>
      ))}
    </div>
  );
}

function InvitesTab() {
  const guildInvites      = useGameStore((s) => s.guildInvites);
  const respondGuildInvite = useGameStore((s) => s.respondGuildInvite);
  const [responding, setResponding] = useState(null);

  const handleRespond = async (guildId, accept) => {
    setResponding(guildId);
    await respondGuildInvite(guildId, accept);
    setResponding(null);
  };

  if (guildInvites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <span className="text-4xl">📭</span>
        <p className="text-gray-500 text-sm">Sin invitaciones pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {guildInvites.map((inv) => (
        <div
          key={inv.guildId ?? inv.id}
          className="flex items-center gap-3 px-3 py-3 rounded-xl border border-yellow-900/20"
          style={{ background: 'rgba(255,215,0,0.04)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold">
              <span className="text-yellow-600">[{inv.tag}]</span> {inv.name}
            </p>
            <p className="text-gray-500 text-[10px]">Nivel {inv.level ?? 1}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => handleRespond(inv.guildId ?? inv.id, true)}
              disabled={responding === (inv.guildId ?? inv.id)}
              className="px-3 py-1 rounded-lg text-[11px] font-bold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #15803d, #22c55e)' }}
            >
              Aceptar
            </button>
            <button
              onClick={() => handleRespond(inv.guildId ?? inv.id, false)}
              disabled={responding === (inv.guildId ?? inv.id)}
              className="px-3 py-1 rounded-lg text-[11px] font-bold border border-red-700/50 text-red-400 disabled:opacity-40"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GuildPanel({ onClose }) {
  const guild                    = useGameStore((s) => s.guild);
  const guildInvites             = useGameStore((s) => s.guildInvites);
  const loadGuild                = useGameStore((s) => s.loadGuild);
  const loadGuildInvites         = useGameStore((s) => s.loadGuildInvites);
  const leaveGuild               = useGameStore((s) => s.leaveGuild);
  const contributeToGuildTreasury = useGameStore((s) => s.contributeToGuildTreasury);

  const [activeTab, setActiveTab] = useState('my');

  useEffect(() => {
    loadGuild();
    loadGuildInvites();
  }, []);

  const handleLeave = async () => {
    const confirmed = window.confirm(
      '¿Seguro que deseas abandonar el gremio? Perderás tu progreso de contribución.'
    );
    if (!confirmed) return;
    await leaveGuild();
  };

  const inviteCount = guildInvites.length;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(22,33,62,0.97)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-yellow-900/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚔️</span>
          <h2
            className="text-yellow-400 font-bold text-lg"
            style={{ fontFamily: 'MedievalSharp, serif' }}
          >
            Gremio
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 text-2xl leading-none hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 shrink-0">
        <TabButton active={activeTab === 'my'} onClick={() => setActiveTab('my')}>
          Mi Gremio
        </TabButton>
        <TabButton active={activeTab === 'explore'} onClick={() => setActiveTab('explore')}>
          Explorar
        </TabButton>
        <TabButton active={activeTab === 'invites'} onClick={() => setActiveTab('invites')}>
          Invitaciones
          {inviteCount > 0 && (
            <span
              className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white"
              style={{ background: '#e94560' }}
            >
              {inviteCount}
            </span>
          )}
        </TabButton>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeTab === 'my' && (
          <MyGuildTab
            guild={guild}
            onLeave={handleLeave}
            onDonate={contributeToGuildTreasury}
          />
        )}
        {activeTab === 'explore' && <ExploreTab guild={guild} />}
        {activeTab === 'invites' && <InvitesTab />}
      </div>
    </div>
  );
}
