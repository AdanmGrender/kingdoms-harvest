/**
 * CalendarPanel — F2 Calendario de login 7 días (retención). Ciclo reclamable
 * UNA vez por día UTC; si se saltea un día no se rompe, el server simplemente
 * avanza el ciclo al reclamar. Día 7 = gemas promocionales. Coexiste con las
 * rachas (streaks) — no las toca.
 */
import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

const REWARD_META = {
  gold:    { sprite: 'gold',     fallback: '🪙' },
  wood:    { sprite: 'wood',     fallback: '🪵' },
  crystal: { sprite: 'crystal',  fallback: '💠' },
  relic:   { sprite: 'relic',    fallback: '🏺' },
  kh:      { sprite: 'kh_token', fallback: '💎' },
  gems:    { sprite: 'gem',      fallback: '💎' },
};

function rewardLabel(reward) {
  const [key, amount] = Object.entries(reward).find(([k]) => k !== 'day') || [];
  return { key, amount, meta: REWARD_META[key] || { sprite: null, fallback: '🎁' } };
}

export default function CalendarPanel({ onClose }) {
  const calendarState = useGameStore((s) => s.calendarState);
  const loadCalendar = useGameStore((s) => s.loadCalendar);
  const claimCalendar = useGameStore((s) => s.claimCalendar);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  if (!calendarState) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center" style={{ background: 'rgba(10,10,20,0.96)' }}>
        <p className="text-gray-400 text-sm">Cargando calendario...</p>
        <button onClick={onClose} className="text-gray-400 text-2xl px-2 absolute top-4 right-4">✕</button>
      </div>
    );
  }

  const { cycleDay, claimedToday, rewards } = calendarState;

  const handleClaim = async () => {
    await claimCalendar(); // la store dispara la notificación (éxito o error)
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col pb-28" style={{ background: 'rgba(10,10,20,0.96)' }}>
      <div className="flex justify-between items-center p-4">
        <h2 className="text-yellow-400 text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'MedievalSharp, serif' }}>
          <SpriteIcon name="scroll" size={26} fallback="📅" /> Calendario
        </h2>
        <button onClick={onClose} className="text-gray-400 text-2xl px-2">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <p className="text-gray-400 text-xs mb-4 text-center">
          Volvé cada día para reclamar tu recompensa. Si te lo perdés no se rompe el ciclo.
        </p>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {rewards.map((reward) => {
            const isCurrent = reward.day === cycleDay;
            const isPast = reward.day < cycleDay;
            const { meta, amount } = rewardLabel(reward);
            return (
              <div
                key={reward.day}
                className="flex flex-col items-center justify-center rounded-lg p-2 gap-1"
                style={{
                  background: isCurrent ? 'rgba(255,215,0,0.18)' : isPast ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isCurrent ? '#ffd700' : isPast ? '#4ade80' : '#333'}`,
                  opacity: isPast ? 0.55 : 1,
                }}
              >
                <span className="text-[9px] text-gray-400 uppercase">Día {reward.day}</span>
                <SpriteIcon name={meta.sprite} size={28} fallback={meta.fallback} />
                <span className="text-[10px] font-bold text-white">{amount}</span>
                {isPast && <SpriteIcon name="check" size={14} fallback="✓" />}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleClaim}
          disabled={claimedToday}
          className={`w-full py-3 rounded-lg font-bold text-white ${claimedToday ? 'opacity-40 cursor-not-allowed' : ''}`}
          style={{ background: claimedToday ? '#444' : 'linear-gradient(135deg, #b45309, #ffd700)' }}
        >
          {claimedToday ? 'Ya reclamaste hoy' : `🎁 Reclamar día ${cycleDay}`}
        </button>
      </div>
    </div>
  );
}
