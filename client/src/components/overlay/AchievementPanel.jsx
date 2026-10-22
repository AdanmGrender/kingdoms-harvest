import { useState, useEffect, useMemo } from 'react';
import useGameStore from '../../store/gameStore';
import Bar from '../ui/Bar';
import SpriteIcon from '../ui/SpriteIcon';

const CATEGORY_LABELS = {
  farmer:   { icon: 'wheat', label: 'Granjero'   },
  warrior:  { icon: 'sword', label: 'Guerrero'   },
  builder:  { icon: 'hammer', label: 'Constructor' },
  merchant: { icon: 'gold', label: 'Mercader'    },
  explorer: { icon: 'map', label: 'Explorador'  },
  hero:     { icon: '', label: 'Héroe'        },
  market:   { icon: 'market', label: 'Mercado P2P' },
};

function AchievementCard({ ach, onClaim, loading }) {
  const pct = Math.min(100, Math.round((ach.progress / ach.target) * 100));
  const canClaim = ach.unlocked && !ach.claimed;

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        ach.claimed   ? 'border-gray-700/30 bg-gray-900/20 opacity-60' :
        canClaim      ? 'border-yellow-500/60 bg-yellow-900/20' :
        ach.unlocked  ? 'border-green-600/40 bg-green-900/10' :
                        'border-gray-700/30 bg-gray-900/10'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-2xl shrink-0"><SpriteIcon name="medal" size={32} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <p className={`text-xs font-bold ${ach.claimed ? 'text-gray-500' : canClaim ? 'text-yellow-300' : 'text-white'}`}>
              {ach.title}
            </p>
            {ach.claimed   && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">✓ Reclamado</span>}
            {canClaim      && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-700 text-yellow-200 font-bold">¡Listo!</span>}
          </div>
          <p className="text-gray-500 text-[10px]">{ach.desc}</p>

          {/* Progress bar */}
          <div className="mt-1.5">
            <Bar value={pct} tone={ach.unlocked ? 'macula' : 'ember'} label={ach.name} />
            <p className="text-[9px] text-gray-500 mt-0.5">{ach.progress} / {ach.target}</p>
          </div>

          {/* Reward preview */}
          <div className="flex items-center gap-2 mt-1.5 text-[9px] text-gray-400">
            {ach.rewardTokens > 0 && <span><SpriteIcon name="gem" size={28} /> +{ach.rewardTokens} tokens</span>}
            {ach.rewardResources && Object.entries(ach.rewardResources).map(([res, amt]) => (
              <span key={res}>+{amt} {res}</span>
            ))}
          </div>
        </div>

        {canClaim && (
          <button
            onClick={() => onClaim(ach.id)}
            disabled={loading}
            className="shrink-0 text-[10px] px-2 py-1.5 rounded font-bold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #b45309, #d97706)' }}
          >
            Reclamar
          </button>
        )}
      </div>
    </div>
  );
}

export default function AchievementPanel({ onClose }) {
  const achievements   = useGameStore((s) => s.achievements);
  const loadAchievements  = useGameStore((s) => s.loadAchievements);
  const claimAchievement  = useGameStore((s) => s.claimAchievement);

  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadAchievements(); }, []);

  const filtered = useMemo(() => {
    const list = activeCategory === 'all'
      ? achievements
      : achievements.filter((a) => a.category === activeCategory);
    // Sort: claimable first → unlocked → in-progress → not started
    return [...list].sort((a, b) => {
      const score = (x) => (x.unlocked && !x.claimed ? 3 : x.unlocked ? 2 : x.progress > 0 ? 1 : 0);
      return score(b) - score(a);
    });
  }, [achievements, activeCategory]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const claimableCount = achievements.filter((a) => a.unlocked && !a.claimed).length;

  const doClaimAchievement = async (id) => {
    setLoading(true);
    await claimAchievement(id);
    setLoading(false);
  };

  return (
    <div
      className="mx-2 mb-2 p-4 pb-6 rounded-t-xl max-h-[75vh] overflow-y-auto"
      style={{ background: 'rgba(51, 47, 43, 0.97)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-yellow-400 text-sm font-bold font-display">
            <SpriteIcon name="medal" size={28} /> Logros
          </h3>
          <p className="text-gray-400 text-[10px]">
            {unlockedCount}/{achievements.length} desbloqueados
            {claimableCount > 0 && <span className="text-yellow-400 ml-2">· {claimableCount} para reclamar</span>}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory('all')}
          className={`shrink-0 text-[9px] px-2 py-1 rounded ${activeCategory === 'all' ? 'bg-yellow-700 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          Todos
        </button>
        {Object.entries(CATEGORY_LABELS).map(([cat, { icon, label }]) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 text-[9px] px-2 py-1 rounded whitespace-nowrap ${activeCategory === cat ? 'bg-yellow-700 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            <SpriteIcon name={icon} size={28} /> {label}
          </button>
        ))}
      </div>

      {/* Achievement list */}
      {achievements.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-xs">Cargando logros...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ach) => (
            <AchievementCard
              key={ach.id}
              ach={ach}
              onClaim={doClaimAchievement}
              loading={loading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
