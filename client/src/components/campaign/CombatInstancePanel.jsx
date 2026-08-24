import { useState, useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import EmberField from '../fx/EmberField';

// T1 coordinación visual: diorama iso grimdark de fondo según el tipo de nodo.
const BG_BY_TYPE = { combat: 'battle_ruins', wave: 'battle_tide', boss: 'boss_arena' };
// T3: sprite del enemigo (anclado, transparente) — bosses por id, resto por tipo.
const ENEMY_BY_NODE = { a1n5: 'heraldo', a1n9: 'devorador', a2n5: 'coloso', a2n10: 'heraldo' };
const ENEMY_BY_TYPE = { combat: 'bruto', wave: 'coloso', boss: 'devorador' };

export default function CombatInstancePanel({ onClose }) {
  const activeRun = useGameStore((s) => s.activeRun);
  const stepInstance = useGameStore((s) => s.stepInstance);
  const clearActiveRun = useGameStore((s) => s.clearActiveRun);
  const addNotification = useGameStore((s) => s.addNotification);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // ── Juice (pase de movimiento): floaters de daño, flash del enemigo, shake,
  //    fx por héroe. Todo se dispara de deltas REALES del estado por ronda. ──
  const [floaters, setFloaters] = useState([]);   // números de daño al enemigo
  const [flashKey, setFlashKey] = useState(0);     // remonta el sprite → replay hitFlash
  const [shaking, setShaking] = useState(false);   // screen-shake al recibir daño
  const [heroFx, setHeroFx] = useState({});        // { slot: { type:'hit'|'cast', key, dmg } }
  const prevEnemyHp = useRef(null);
  const prevHeroHp = useRef({});
  const floatId = useRef(0);
  const shakeTimer = useRef(null);

  const spawnFloater = (text, color) => {
    const id = ++floatId.current;
    const left = 42 + Math.random() * 16; // jitter horizontal sobre el enemigo
    setFloaters((f) => [...f, { id, text, color, left }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1000);
  };

  const doStep = async (action) => {
    if (busy || result) return;
    // Chispa de conjuro inmediata al tap (feedback antes de que responda el server).
    if (action.type === 'skill') {
      setHeroFx((p) => ({ ...p, [action.slot]: { type: 'cast', key: Date.now() } }));
    }
    setBusy(true);
    try {
      const r = await stepInstance(action);
      if (r?.result) setResult(r.result);
    } catch (e) {
      addNotification(e.response?.data?.error || 'No se pudo resolver la ronda', 'error');
    } finally { setBusy(false); }
  };

  // Auto-avance (~2s): spec §4 — combate idle-friendly, no un puro clicker.
  useEffect(() => {
    if (!activeRun || result || busy) return;
    const t = setTimeout(() => { doStep({ type: 'advance' }); }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.state?.round, result, busy]);

  // Deltas por ronda → dispara los efectos. Se ejecuta cada vez que el server
  // devuelve un state nuevo (objeto reemplazado en cada stepInstance).
  const stateObj = activeRun?.state;
  useEffect(() => {
    if (!stateObj) return;
    // Daño al enemigo → floater rojo + flash + (si fuerte) shake.
    if (prevEnemyHp.current != null) {
      const d = prevEnemyHp.current - stateObj.enemy.hp;
      if (d > 0) {
        spawnFloater(`-${d}`, '#ff5a4d');
        setFlashKey((k) => k + 1);
      }
    }
    prevEnemyHp.current = stateObj.enemy.hp;
    // Daño a héroes → flash de fila roja + screen-shake defensivo.
    let hurt = false;
    const nextFx = {};
    stateObj.heroes.forEach((h) => {
      const prev = prevHeroHp.current[h.slot];
      if (prev != null && prev - h.hp > 0) {
        hurt = true;
        nextFx[h.slot] = { type: 'hit', key: Date.now() + h.slot, dmg: prev - h.hp };
      }
      prevHeroHp.current[h.slot] = h.hp;
    });
    if (Object.keys(nextFx).length) setHeroFx((p) => ({ ...p, ...nextFx }));
    if (hurt) {
      setShaking(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShaking(false), 480);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateObj]);

  useEffect(() => () => clearTimeout(shakeTimer.current), []);

  if (!activeRun) { onClose(); return null; }
  const { node, state } = activeRun;

  const close = () => { clearActiveRun(); onClose(); };
  const enemyPct = Math.max(0, Math.round((state.enemy.hp / state.enemy.maxHp) * 100));
  const dead = enemyPct <= 0;
  const bgFile = BG_BY_TYPE[node.type] || 'battle_ruins';
  const enemyFile = ENEMY_BY_NODE[node.id] || ENEMY_BY_TYPE[node.type] || 'bruto';

  const enemyAnim = dead
    ? 'dissolve 0.6s ease-out forwards'
    : `breathe 3.2s ease-in-out infinite${flashKey ? ', hitFlash 0.32s ease-out' : ''}`;

  return (
    // pb-28: despeje de la BottomNavBar (flota sobre este panel).
    <div className={`fixed inset-0 z-50 flex flex-col p-4 pb-28 overflow-hidden ${shaking ? 'animate-shake' : ''}`}
      style={{ background: '#0c090c' }}>
      {/* Diorama de fondo con ken-burns lento. */}
      <div className="absolute inset-0 fx-driftzoom" style={{
        zIndex: 0,
        backgroundImage: `url(/assets/game/dioramas/${bgFile}.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      {/* Velo oscuro para legibilidad. */}
      <div className="absolute inset-0" style={{
        zIndex: 1,
        background: 'linear-gradient(rgba(12,9,12,0.62), rgba(12,9,12,0.88))',
      }} />
      {/* Brasas subiendo + viñeta cálida parpadeante (torchlight). */}
      <EmberField count={18} color="#e8933a" maxOpacity={0.7} className="z-[2]" />
      <div className="fx-torch-vignette fx-flicker" style={{ zIndex: 2 }} />

      {/* Enemigo anclado: respira, destella al golpe, se disuelve al morir. */}
      <img
        key={dead ? 'dead' : flashKey}
        src={`/assets/game/enemies/${enemyFile}.png`}
        alt=""
        className="absolute left-1/2 pointer-events-none select-none"
        style={{
          top: '14%',
          height: node.type === 'boss' ? '36%' : '29%',
          zIndex: 3,
          filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.7))',
          animation: enemyAnim,
        }}
      />

      {/* Capa de números de daño flotantes sobre el enemigo. */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
        {floaters.map((f) => (
          <span
            key={f.id}
            className="fx-floatup absolute font-bold"
            style={{
              left: `${f.left}%`, top: '26%',
              color: f.color, fontSize: '22px',
              textShadow: '0 2px 4px rgba(0,0,0,0.9)',
              fontFamily: 'MedievalSharp, serif',
            }}
          >
            {f.text}
          </span>
        ))}
      </div>

      {/* ── Contenido (por encima de todo lo anterior) ── */}
      <div className="relative flex flex-col flex-1 min-h-0" style={{ zIndex: 10 }}>
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

        {/* Enemigo — barra de vida */}
        <div className="mb-4">
          <div className="text-gray-300 text-xs mb-1">Enemigo</div>
          <div className="h-4 rounded" style={{ background: '#333' }}>
            <div className="h-4 rounded" style={{ width: `${enemyPct}%`, background: '#b32821', transition: 'width .3s' }} />
          </div>
        </div>

        {/* Héroes + tap-skill */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {state.heroes.map((h) => {
            const ready = h.alive && h.energy >= h.energyMax;
            const fx = heroFx[h.slot];
            return (
              <button
                key={h.slot}
                onClick={() => doStep({ type: 'skill', slot: h.slot })}
                disabled={!ready || busy || !!result}
                className={`w-full p-2 rounded flex items-center gap-2 relative overflow-hidden ${ready ? 'fx-pulseready' : ''}`}
                style={{
                  background: ready ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${ready ? '#ffd700' : '#333'}`,
                  opacity: h.alive ? 1 : 0.4,
                }}
              >
                {/* Flash rojo al recibir daño */}
                {fx?.type === 'hit' && (
                  <span key={fx.key} className="fx-rowhit absolute inset-0 pointer-events-none"
                    style={{ background: '#b32821' }} />
                )}
                <span className="text-lg relative">
                  {h.skill.icon || '✦'}
                  {/* Chispa de conjuro */}
                  {fx?.type === 'cast' && (
                    <span key={fx.key} className="fx-castspark absolute pointer-events-none"
                      style={{
                        left: '50%', top: '50%', width: 26, height: 26, marginLeft: -13, marginTop: -13,
                        borderRadius: '9999px',
                        background: 'radial-gradient(circle, #ffe9a8 0%, #ffb020 55%, transparent 72%)',
                      }} />
                  )}
                </span>
                <div className="flex-1 text-left">
                  <p className="text-white text-xs">{h.name} {h.alive ? '' : '☠️'}</p>
                  <div className="h-1.5 rounded mt-1" style={{ background: '#222' }}>
                    <div className="h-1.5 rounded" style={{ width: `${Math.min(100, h.energy)}%`, background: ready ? '#ffd700' : '#4ade80', transition: 'width .3s' }} />
                  </div>
                </div>
                {ready && <span className="text-yellow-300 text-[10px] font-bold">¡TAP!</span>}
              </button>
            );
          })}
        </div>

        {/* Avanzar / resultado */}
        {result ? (
          <div className="mt-3 text-center animate-grow">
            <p className={`text-2xl font-bold ${result === 'victory' ? 'text-green-400' : 'text-red-400'}`}
              style={{ fontFamily: 'MedievalSharp, serif' }}>
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

      {/* Fanfarria de resultado: brasas doradas en victoria / velo rojo en derrota. */}
      {result === 'victory' && <EmberField count={44} color="#ffd35a" maxOpacity={0.95} className="z-[20]" />}
      {result === 'defeat' && (
        <div className="absolute inset-0 pointer-events-none animate-fade-in"
          style={{ zIndex: 20, background: 'radial-gradient(circle at 50% 45%, rgba(179,40,33,0.35), transparent 70%)' }} />
      )}
    </div>
  );
}
