import React, { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

const RARITY_CONFIG = {
  common:   { label: 'Común',   color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  uncommon: { label: 'Inusual', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  rare:     { label: 'Raro',    color: '#ffd700', bg: 'rgba(255,215,0,0.15)'   },
};

const RESOURCE_ICONS = {
  wheat: '🌾', carrot: '🥕', potato: '🥔', tomato: '🍅', corn: '🌽',
  pumpkin: '🎃', grape: '🍇', wood: '🪵', stone: '🪨', iron: '⛏️',
  gold: '🪙', bread: '🍞', ingots: '⚙️', flour: '🌾', egg: '🥚',
  milk: '🥛', wool: '🧶',
};

const RESOURCE_NAMES = {
  wheat: 'Trigo', carrot: 'Zanahoria', potato: 'Papa', tomato: 'Tomate',
  corn: 'Maíz', pumpkin: 'Calabaza', grape: 'Uva', wood: 'Madera',
  stone: 'Piedra', iron: 'Hierro', gold: 'Oro', bread: 'Pan',
  ingots: 'Lingotes', flour: 'Harina', egg: 'Huevo', milk: 'Leche', wool: 'Lana',
};

function CoopSection({ data, onSessionStarted }) {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(false);
  const { startCoopSession, addNotification } = useGameStore();

  // If the event already has a session, load it
  useEffect(() => {
    if (data.session_id) {
      setSession({
        session_id:        data.session_id,
        participant_count: data.session_count,
        max_participants:  data.session_max,
      });
    }
  }, [data.session_id]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const result = await startCoopSession(data.eventId);
      if (result) {
        setSession({ ...result, invite_link: result.invite_link });
        onSessionStarted && onSessionStarted(result);
        if (!result.already_open) {
          addNotification('¡Sesión cooperativa creada! Comparte el enlace con tus aliados.', 'success');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: open Telegram share
    }
  };

  const handleTelegramShare = (link) => {
    const text = encodeURIComponent(`¡Únete a mi evento en Kingdoms Harvest! ${link}`);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const multiplier = session
    ? (1 + Math.max(0, session.participant_count - 1) * 0.3).toFixed(1)
    : '1.0';

  // Use server-provided invite_link when available; fall back to constructing it
  const inviteLink = session
    ? (session.invite_link || `https://t.me/kingdomharvestbot?start=event_${data.eventId}_s${session.session_id}`)
    : null;

  return (
    <div className="rounded-lg p-3 space-y-2"
      style={{ background: 'rgba(15,52,96,0.4)', border: '1px solid rgba(59,130,246,0.25)' }}>
      <div className="flex items-center gap-2">
        <span className="text-blue-400 text-sm">⚔️</span>
        <p className="text-xs font-bold text-blue-300" style={{ fontFamily: 'MedievalSharp, serif' }}>
          Misión Cooperativa
        </p>
        {session && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: 'rgba(59,130,246,0.2)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.4)' }}>
            {session.participant_count}/{session.max_participants} aliados
          </span>
        )}
      </div>

      {session ? (
        <div className="space-y-2">
          {/* Bonus indicator */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Bono actual:</span>
            <span className="font-bold text-green-400">×{multiplier} recompensas</span>
          </div>

          {/* Invite link */}
          <div className="rounded p-2 space-y-1.5"
            style={{ background: 'rgba(22,33,62,0.8)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-[10px] text-gray-500">Enlace de invitación:</p>
            <p className="text-[10px] text-blue-300 break-all leading-relaxed">{inviteLink}</p>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleCopy(inviteLink)}
              className="flex-1 py-2 rounded text-[11px] font-bold transition-all"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd' }}>
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
            <button
              onClick={() => handleTelegramShare(inviteLink)}
              className="flex-1 py-2 rounded text-[11px] font-bold transition-all"
              style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.5)', color: '#60a5fa' }}>
              ✈️ Compartir
            </button>
          </div>

          <p className="text-[10px] text-gray-500 text-center">
            Cada aliado que reclame recibe ×{multiplier} de recompensas
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Invita amigos al evento. Cada aliado aumenta las recompensas un 30% (máx. ×1.9 con 4 aliados).
          </p>
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-2 rounded text-xs font-bold transition-all"
            style={{
              background: loading ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.2)',
              border: '1px solid rgba(59,130,246,0.4)',
              color: '#60a5fa',
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? '⏳ Creando...' : '⚔️ Crear sesión cooperativa'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function WorldEventPanel({ data, onClose }) {
  const [claimed, setClaimed] = useState(data.is_claimed);
  const [claimResult, setClaimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const { claimWorldEvent, addNotification, loadWorldEvents, refreshResources } = useGameStore();

  const rarity = RARITY_CONFIG[data.rarity] || RARITY_CONFIG.common;

  // Time remaining
  const secsLeft = Math.max(0, data.expires_at - Math.floor(Date.now() / 1000));
  const mins = Math.floor(secsLeft / 60);
  const timeStr = secsLeft <= 0 ? 'Expirado' : `${mins} min restante${mins !== 1 ? 's' : ''}`;

  // Current co-op bonus from session (updated after starting one)
  const participantCount = sessionData?.participant_count || data.session_count || 0;
  const multiplier = participantCount > 1
    ? (1 + (participantCount - 1) * 0.3).toFixed(1)
    : null;

  const handleClaim = async () => {
    setLoading(true);
    try {
      const result = await claimWorldEvent(data.eventId);
      if (result) {
        setClaimed(true);
        setClaimResult(result.rewards);
        addNotification(result.message, 'success');
        EventBridge.emit('world_event:claimed', { eventId: data.eventId });
        refreshResources();
        loadWorldEvents();
      }
    } catch {
      addNotification('Error al reclamar el evento', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-2 mb-2 rounded-t-xl overflow-hidden"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: `1px solid ${rarity.color}50` }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30"
        style={{ background: `linear-gradient(135deg, rgba(22,33,62,0.9), ${rarity.bg})` }}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{data.icon}</span>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif', color: rarity.color }}>
                {data.title}
              </h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                style={{ background: rarity.bg, color: rarity.color, border: `1px solid ${rarity.color}50` }}>
                {rarity.label}
              </span>
              {data.is_featured ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                  style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.4)' }}>
                  ★ Rotativo
                </span>
              ) : null}
            </div>
            <p className="text-[10px] text-gray-400">{timeStr}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-4 py-3 space-y-3 overflow-y-auto" style={{ maxHeight: '65vh' }}>
        {/* Description */}
        <p className="text-gray-300 text-xs leading-relaxed italic">"{data.description}"</p>

        {/* Rewards */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              {claimResult ? '✓ Recursos obtenidos' : 'Recompensas disponibles'}
            </p>
            {multiplier && !claimed && (
              <span className="text-[10px] font-bold text-green-400">×{multiplier} bono coop</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(claimResult || data.rewards || []).map((r, i) => (
              <div key={i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{
                  background: claimResult ? 'rgba(74,222,128,0.12)' : rarity.bg,
                  border: `1px solid ${claimResult ? '#4ade8040' : rarity.color + '40'}`,
                }}>
                <span className="text-base">{RESOURCE_ICONS[r.resource_id] || '📦'}</span>
                <div>
                  <p className="text-[10px] text-gray-400">{RESOURCE_NAMES[r.resource_id] || r.resource_id}</p>
                  <p className="text-sm font-bold" style={{ color: claimResult ? '#4ade80' : rarity.color }}>
                    +{r.amount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Co-op section — only when not yet claimed and event not expired */}
        {!claimed && secsLeft > 0 && (
          <CoopSection data={data} onSessionStarted={setSessionData} />
        )}

        {/* Action */}
        {claimed ? (
          <div className="flex items-center justify-center gap-2 py-3 rounded-lg"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <span className="text-green-400 text-lg">✓</span>
            <p className="text-green-400 text-sm font-bold">Recompensa reclamada</p>
          </div>
        ) : secsLeft <= 0 ? (
          <div className="text-center py-2">
            <p className="text-gray-500 text-xs">Este evento ya expiró</p>
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all"
            style={{
              background: loading
                ? 'rgba(100,100,120,0.5)'
                : `linear-gradient(135deg, ${rarity.color}cc, ${rarity.color})`,
              color: data.rarity === 'common' ? '#1a1a2e' : 'white',
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? '⏳ Reclamando...' : `${data.icon} Reclamar recompensa`}
          </button>
        )}
      </div>
    </div>
  );
}
