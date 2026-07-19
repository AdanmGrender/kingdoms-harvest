import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

export default function CombatInstancePanel({ onClose }) {
  const activeRun = useGameStore((s) => s.activeRun);
  const stepInstance = useGameStore((s) => s.stepInstance);
  const clearActiveRun = useGameStore((s) => s.clearActiveRun);
  const addNotification = useGameStore((s) => s.addNotification);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const doStep = async (action) => {
    if (busy || result) return;
    setBusy(true);
    try {
      const r = await stepInstance(action);
      if (r?.result) setResult(r.result);
    } catch (e) {
      addNotification(e.response?.data?.error || 'No se pudo resolver la ronda', 'error');
    } finally { setBusy(false); }
  };

  // Auto-avance (~2s): spec §4 — combate idle-friendly, no un puro clicker.
  // Sin tap, la ronda avanza sola; un tap (busy) o el cambio de ronda
  // reinicia el timer.
  useEffect(() => {
    if (!activeRun || result || busy) return;
    const t = setTimeout(() => { doStep({ type: 'advance' }); }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.state?.round, result, busy]);

  if (!activeRun) { onClose(); return null; }
  const { node, state } = activeRun;

  const close = () => { clearActiveRun(); onClose(); };
  const enemyPct = Math.max(0, Math.round((state.enemy.hp / state.enemy.maxHp) * 100));

  return (
    // pb-28: la BottomNavBar (absolute bottom-0, botón-castillo desbordando)
    // flota SOBRE este panel — sin el despeje tapaba "Avanzar ronda"/"Volver".
    <div className="fixed inset-0 z-50 flex flex-col p-4 pb-28" style={{ background: 'rgba(8,8,16,0.97)' }}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-red-400 font-bold flex items-center gap-2" style={{ fontFamily: 'MedievalSharp, serif' }}>
          <SpriteIcon
            name={node.type === 'boss' ? 'skull' : 'sword'}
            size={24}
            fallback={node.type === 'boss' ? '💀' : '⚔️'}
          />
          {node.name} · ronda {state.round}/{state.maxRounds}
        </h2>
        <button onClick={close} className="text-gray-400 text-xl px-2">✕</button>
      </div>

      {/* Enemigo */}
      <div className="mb-4">
        <div className="text-gray-300 text-xs mb-1">Enemigo</div>
        <div className="h-4 rounded" style={{ background: '#333' }}>
          <div className="h-4 rounded" style={{ width: `${enemyPct}%`, background: '#e94560', transition: 'width .3s' }} />
        </div>
      </div>

      {/* Héroes + tap-skill */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {state.heroes.map((h) => {
          const ready = h.alive && h.energy >= h.energyMax;
          return (
            <button
              key={h.slot}
              onClick={() => doStep({ type: 'skill', slot: h.slot })}
              disabled={!ready || busy || !!result}
              className="w-full p-2 rounded flex items-center gap-2"
              style={{
                background: ready ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${ready ? '#ffd700' : '#333'}`,
                opacity: h.alive ? 1 : 0.4,
              }}
            >
              <span className="text-lg">{h.skill.icon || '✦'}</span>
              <div className="flex-1 text-left">
                <p className="text-white text-xs">{h.name} {h.alive ? '' : '☠️'}</p>
                <div className="h-1.5 rounded mt-1" style={{ background: '#222' }}>
                  <div className="h-1.5 rounded" style={{ width: `${Math.min(100, h.energy)}%`, background: ready ? '#ffd700' : '#4ade80' }} />
                </div>
              </div>
              {ready && <span className="text-yellow-300 text-[10px] font-bold">¡TAP!</span>}
            </button>
          );
        })}
      </div>

      {/* Avanzar / resultado */}
      {result ? (
        <div className="mt-3 text-center">
          <p className={`text-lg font-bold ${result === 'victory' ? 'text-green-400' : 'text-red-400'}`}>
            {result === 'victory' ? '🏆 ¡Victoria!' : '💀 Derrota'}
          </p>
          <button onClick={close} className="btn-gold mt-2 px-6 py-2 rounded">Volver</button>
        </div>
      ) : (
        <button
          onClick={() => doStep({ type: 'advance' })}
          disabled={busy}
          className="btn-primary mt-3 py-3 rounded font-bold disabled:opacity-50"
        >
          {busy ? '...' : '⚔️ Avanzar ronda'}
        </button>
      )}
    </div>
  );
}
