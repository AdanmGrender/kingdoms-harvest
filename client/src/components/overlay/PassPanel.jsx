/**
 * PassPanel — F4 Pase de temporada (retención). Riel de 20 tiers × 50 pts,
 * riel FREE siempre accesible + riel PREMIUM (desbloqueable con 1440 gemas).
 * Sin autoridad client-side: el server valida tier alcanzado / premium / el
 * UNIQUE de pass_claims hace el resto idempotente.
 */
import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

const REWARD_META = {
  gold:      { sprite: 'gold',      fallback: '🪙' },
  wood:      { sprite: 'wood',      fallback: '🪵' },
  crystal:   { sprite: 'crystal',   fallback: '💠' },
  relic:     { sprite: 'relic',     fallback: '🏺' },
  blueprint: { sprite: 'blueprint', fallback: '📜' },
  kh:        { sprite: 'kh_token',  fallback: '💰' },
  gems:      { sprite: 'gem',       fallback: '💎' },
};

function rewardEntry(reward) {
  const [key, amount] = Object.entries(reward || {})[0] || [];
  return { key, amount, meta: REWARD_META[key] || { sprite: null, fallback: '🎁' } };
}

function TierCell({ tier, reward, track, reached, claimed, canClaim, onClaim }) {
  const { meta, amount } = rewardEntry(reward);
  const locked = !reached;
  return (
    <div
      className="flex flex-col items-center justify-between rounded-lg p-2 gap-1 min-w-[64px]"
      style={{
        background: track === 'premium' ? 'rgba(255,215,0,0.10)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${claimed ? '#4ade80' : locked ? '#333' : track === 'premium' ? '#ffd700' : '#666'}`,
        opacity: locked ? 0.45 : 1,
      }}
    >
      <span className="text-[9px] text-gray-400 uppercase">Tier {tier}</span>
      <SpriteIcon name={meta.sprite} size={26} fallback={meta.fallback} />
      <span className="text-[10px] font-bold text-white">{amount}</span>
      {claimed ? (
        <SpriteIcon name="check" size={14} fallback="✓" />
      ) : canClaim ? (
        <button
          onClick={onClaim}
          className="text-[9px] px-2 py-0.5 rounded font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #b45309, #ffd700)' }}
        >
          Reclamar
        </button>
      ) : (
        <span className="text-[14px]">{locked ? '🔒' : ''}</span>
      )}
    </div>
  );
}

export default function PassPanel({ onClose }) {
  const passState = useGameStore((s) => s.passState);
  const gems = useGameStore((s) => s.gems);
  const loadPass = useGameStore((s) => s.loadPass);
  const loadGems = useGameStore((s) => s.loadGems);
  const unlockPassPremium = useGameStore((s) => s.unlockPassPremium);
  const claimPassTier = useGameStore((s) => s.claimPassTier);

  useEffect(() => { loadPass(); loadGems(); }, [loadPass, loadGems]);

  if (!passState) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center" style={{ background: 'rgba(10,10,20,0.96)' }}>
        <p className="text-gray-400 text-sm">Cargando pase de temporada...</p>
        <button onClick={onClose} className="text-gray-400 text-2xl px-2 absolute top-4 right-4">✕</button>
      </div>
    );
  }

  const { points, tier, premium, claims, rewards } = passState;
  const claimedSet = new Set(claims.map((c) => `${c.tier}:${c.track}`));
  const ptsPerTier = 50; // catálogo fijo del server (SEASON_PASS.ptsPerTier)
  const pointsInTier = points % 50;
  const gemsBalance = gems?.balance ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col pb-28" style={{ background: 'rgba(10,10,20,0.96)' }}>
      <div className="flex justify-between items-center p-4">
        <h2 className="text-yellow-400 text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'MedievalSharp, serif' }}>
          <SpriteIcon name="scroll" size={26} fallback="🎫" /> Pase de Temporada
        </h2>
        <button onClick={onClose} className="text-gray-400 text-2xl px-2">✕</button>
      </div>

      <div className="px-4 mb-3">
        <div className="flex justify-between text-xs text-gray-300 mb-1">
          <span>Tier {tier} / {rewards.length}</span>
          <span>{points} pts ({pointsInTier}/{ptsPerTier} al próximo)</span>
        </div>
        <div className="progress-bar h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="progress-fill h-full"
            style={{ width: `${(pointsInTier / ptsPerTier) * 100}%`, background: 'linear-gradient(90deg, #b45309, #ffd700)' }}
          />
        </div>
      </div>

      {!premium && (
        <div className="px-4 mb-3">
          <button
            onClick={unlockPassPremium}
            disabled={gemsBalance < 1440}
            className={`w-full py-3 rounded-lg font-bold text-white ${gemsBalance < 1440 ? 'opacity-40 cursor-not-allowed' : ''}`}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #ffd700)' }}
          >
            🔓 Desbloquear Premium (1440 💎)
          </button>
        </div>
      )}
      {premium && (
        <p className="px-4 text-[11px] text-yellow-300 mb-2">✨ Pase Premium activo esta temporada</p>
      )}

      <div className="flex-1 overflow-x-auto px-4">
        <div className="mb-3">
          <p className="text-[10px] text-gray-400 uppercase mb-1">Free</p>
          <div className="flex gap-2 w-max">
            {rewards.map((r, i) => {
              const t = i + 1;
              const reached = tier >= t;
              const claimed = claimedSet.has(`${t}:free`);
              return (
                <TierCell
                  key={`free-${t}`} tier={t} reward={r.free} track="free"
                  reached={reached} claimed={claimed} canClaim={reached && !claimed}
                  onClaim={() => claimPassTier(t, 'free')}
                />
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-yellow-400 uppercase mb-1">Premium</p>
          <div className="flex gap-2 w-max">
            {rewards.map((r, i) => {
              const t = i + 1;
              const reached = tier >= t && premium;
              const claimed = claimedSet.has(`${t}:premium`);
              return (
                <TierCell
                  key={`premium-${t}`} tier={t} reward={r.premium} track="premium"
                  reached={reached} claimed={claimed} canClaim={reached && !claimed}
                  onClaim={() => claimPassTier(t, 'premium')}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
