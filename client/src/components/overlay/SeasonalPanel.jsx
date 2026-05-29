import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const SEASON_ICONS = {
  spring: '🌸',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
  primavera: '🌸',
  verano:    '☀️',
  otoño:     '🍂',
  invierno:  '❄️',
};

function LoadingSpinner() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div
        className="w-8 h-8 rounded-full border-2 border-yellow-900/40 border-t-yellow-400 animate-spin"
      />
      <p className="text-gray-500 text-xs">Cargando estación...</p>
    </div>
  );
}

function RewardPreview({ reward }) {
  if (!reward) return null;
  const parts = [];
  if (reward.tokens > 0)   parts.push(`+${reward.tokens} KH`);
  if (reward.resources) {
    const RES_ICONS = {
      wheat: '🌾', wood: '🪵', stone: '🪨', iron: '⛏️',
      gold: '🪙', bread: '🍞', carrot: '🥕', corn: '🌽',
    };
    Object.entries(reward.resources).forEach(([res, amt]) => {
      parts.push(`${RES_ICONS[res] || '📦'}${amt} ${res}`);
    });
  }
  return <span className="text-[10px] text-gray-300">{parts.join(' ')}</span>;
}

function ChallengeCard({ challenge, accentColor, onClaim }) {
  const [claiming, setClaiming] = useState(false);

  const progress  = challenge.progress ?? 0;
  const target    = challenge.target ?? 1;
  const pct       = Math.min(100, Math.round((progress / target) * 100));
  const completed = progress >= target;
  const claimed   = challenge.claimed ?? false;

  const handleClaim = async () => {
    setClaiming(true);
    await onClaim(challenge.id);
    setClaiming(false);
  };

  let statusBadge = null;
  if (claimed) {
    statusBadge = (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-400 font-semibold">
        ✓ Reclamado
      </span>
    );
  } else if (completed) {
    statusBadge = (
      <span
        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
        style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)' }}
      >
        ¡Listo!
      </span>
    );
  } else {
    statusBadge = (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800/60 text-gray-500">
        En progreso
      </span>
    );
  }

  return (
    <div
      className="rounded-xl p-3.5 border transition-all"
      style={{
        background: claimed
          ? 'rgba(255,255,255,0.02)'
          : completed
          ? `rgba(${accentColor ? accentColor.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)).join(',') : '255,215,0'},0.07)`
          : 'rgba(255,255,255,0.03)',
        border: claimed
          ? '1px solid rgba(255,255,255,0.06)'
          : completed
          ? `1px solid ${accentColor ?? '#ffd700'}50`
          : '1px solid rgba(255,255,255,0.08)',
        opacity: claimed ? 0.65 : 1,
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className={`text-xs font-bold ${claimed ? 'text-gray-500' : 'text-white'}`}>
              {challenge.label || challenge.name}
            </p>
            {statusBadge}
          </div>
          {challenge.desc && (
            <p className="text-[10px] text-gray-500 leading-relaxed">{challenge.desc}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>{progress} / {target}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-700/60">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: claimed
                ? '#4b5563'
                : `linear-gradient(90deg, ${accentColor ?? '#4ade80'}99, ${accentColor ?? '#4ade80'})`,
            }}
          />
        </div>
      </div>

      {/* Claim row */}
      {completed && !claimed && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
          <RewardPreview reward={challenge.reward} />
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 transition-opacity"
            style={{ background: `linear-gradient(135deg, ${accentColor ?? '#b45309'}, ${accentColor ?? '#d97706'})` }}
          >
            {claiming ? '...' : 'Reclamar'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SeasonalPanel({ onClose }) {
  const seasonalData       = useGameStore((s) => s.seasonalData);
  const loadSeasonalData   = useGameStore((s) => s.loadSeasonalData);
  const claimSeasonalReward = useGameStore((s) => s.claimSeasonalReward);

  useEffect(() => {
    loadSeasonalData();
  }, []);

  const handleClaim = async (challengeId) => {
    await claimSeasonalReward(challengeId);
    await loadSeasonalData();
  };

  const seasonNameLower = (seasonalData?.season ?? '').toLowerCase();
  const seasonIcon      = SEASON_ICONS[seasonNameLower] ?? '🌿';
  const accentColor     = seasonalData?.color ?? '#4ade80';
  const bonuses         = seasonalData?.bonuses ?? [];
  const challenges      = seasonalData?.challenges ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(22,33,62,0.97)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-yellow-900/30 shrink-0"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{seasonIcon}</span>
          <h2
            className="text-yellow-400 font-bold text-lg"
            style={{ fontFamily: 'MedievalSharp, serif' }}
          >
            Estación
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 text-2xl leading-none hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Body */}
      {!seasonalData ? (
        <LoadingSpinner />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Season header card */}
          <div
            className="rounded-xl p-4 border-l-4"
            style={{
              background: `rgba(${(() => {
                try {
                  const hex = accentColor.replace('#', '');
                  const r = parseInt(hex.substring(0,2), 16);
                  const g = parseInt(hex.substring(2,4), 16);
                  const b = parseInt(hex.substring(4,6), 16);
                  return `${r},${g},${b}`;
                } catch { return '74,222,128'; }
              })()},0.08)`,
              border: `1px solid ${accentColor}30`,
              borderLeftColor: accentColor,
            }}
          >
            {/* Season name + icon */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">{seasonIcon}</span>
              <div>
                <p
                  className="text-base font-bold"
                  style={{ fontFamily: 'MedievalSharp, serif', color: accentColor }}
                >
                  {seasonIcon} {seasonalData.season ?? 'Temporada'}
                </p>
                <p className="text-[11px] text-gray-400">
                  Día {seasonalData.currentDay ?? 1} de la estación
                  {seasonalData.daysLeft != null && (
                    <span> · {seasonalData.daysLeft} días restantes</span>
                  )}
                </p>
              </div>
            </div>

            {/* Active bonuses */}
            {bonuses.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {bonuses.map((bonus, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-green-300"
                    style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)' }}
                  >
                    {bonus}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Challenges section */}
          <div>
            <p
              className="text-[11px] text-gray-500 uppercase tracking-wide mb-2"
            >
              Desafíos Estacionales
            </p>
            {challenges.length === 0 ? (
              <p className="text-center text-gray-600 text-xs py-8">
                No hay desafíos activos esta estación
              </p>
            ) : (
              <div className="space-y-2.5">
                {challenges.map((ch) => (
                  <ChallengeCard
                    key={ch.id}
                    challenge={ch}
                    accentColor={accentColor}
                    onClaim={handleClaim}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
