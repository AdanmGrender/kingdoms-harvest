import { useState, useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import Bar from '../ui/Bar';
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

  // ── Fase B: escenario de combate — unidades que se mueven (embate/retroceso/
  //    muerte), disparado de deltas REALES del estado por ronda. ──
  const [floaters, setFloaters] = useState([]);   // números de daño al enemigo
  const [flashKey, setFlashKey] = useState(0);     // remonta el sprite → replay hitFlash
  const [shaking, setShaking] = useState(false);   // screen-shake defensivo
  const [heroFx, setHeroFx] = useState({});        // { slot: { type, key } }
  const [motion, setMotion] = useState({ type: null, key: 0 }); // enemigo: attack|recoil
  const prevEnemyHp = useRef(null);
  const prevHeroHp = useRef({});
  const floatId = useRef(0);
  const shakeTimer = useRef(null);

  const spawnFloater = (text, color) => {
    const id = ++floatId.current;
    const left = 42 + Math.random() * 16;
    setFloaters((f) => [...f, { id, text, color, left }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1000);
  };

  const doStep = async (action) => {
    if (busy || result) return;
    if (action.type === 'skill') {
      // Conjuro: el héroe se abalanza (lunge grande) + chispa.
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

  // Auto-avance (~2s): combate idle-friendly.
  useEffect(() => {
    if (!activeRun || result || busy) return;
    const t = setTimeout(() => { doStep({ type: 'advance' }); }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.state?.round, result, busy]);

  // Coreografía por ronda: deltas del server → animaciones de unidades.
  const stateObj = activeRun?.state;
  useEffect(() => {
    if (!stateObj) return;
    // Daño al enemigo → retrocede + número flotante; los héroes vivos embisten.
    if (prevEnemyHp.current != null) {
      const d = prevEnemyHp.current - stateObj.enemy.hp;
      if (d > 0) {
        spawnFloater(`-${d}`, '#ff5a4d');
        setFlashKey((k) => k + 1);
        setMotion({ type: 'recoil', key: Date.now() });
        const k = Date.now();
        setHeroFx((prev) => {
          const next = { ...prev };
          stateObj.heroes.forEach((h) => { if (h.alive) next[h.slot] = { type: 'lunge', key: k + h.slot }; });
          return next;
        });
      }
    }
    prevEnemyHp.current = stateObj.enemy.hp;
    // Daño a héroes → flash rojo + shake + el enemigo embiste.
    let hurt = false;
    const fxu = {};
    stateObj.heroes.forEach((h) => {
      const prev = prevHeroHp.current[h.slot];
      if (prev != null && prev - h.hp > 0) { hurt = true; fxu[h.slot] = { type: 'hit', key: Date.now() + h.slot }; }
      prevHeroHp.current[h.slot] = h.hp;
    });
    if (Object.keys(fxu).length) setHeroFx((prev) => ({ ...prev, ...fxu }));
    if (hurt) {
      setShaking(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShaking(false), 480);
      setMotion({ type: 'attack', key: Date.now() + 1 });
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

  const motionClass = motion.type === 'attack' ? 'fx-enemy-lunge'
    : motion.type === 'recoil' ? 'fx-enemy-recoil' : '';

  return (
    <div className={`fixed inset-0 z-50 flex flex-col p-4 pb-28 overflow-hidden ${shaking ? 'animate-shake' : ''}`}
      style={{ background: '#0c090c' }}>
      {/* Diorama de fondo con ken-burns lento. */}
      <div className="absolute inset-0 fx-driftzoom" style={{
        zIndex: 0,
        backgroundImage: `url(/assets/game/dioramas/${bgFile}.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      <div className="absolute inset-0" style={{
        zIndex: 1,
        background: 'linear-gradient(rgba(12,9,12,0.62), rgba(12,9,12,0.88))',
      }} />
      <EmberField count={18} color="#e8933a" maxOpacity={0.7} className="z-[2]" />
      <div className="fx-torch-vignette fx-flicker" style={{ zIndex: 2 }} />

      {/* Enemigo: unidad centrada por flex — respira, embiste, retrocede, se
          vuelca al morir. Anidamos motion(wrapper) × idle(img) para componer
          transforms sin pisarse. */}
      <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: '15%', zIndex: 3 }}>
        <div key={motion.key} className={motionClass}>
          <img
            key={flashKey}
            src={`/assets/game/enemies/${enemyFile}.png`}
            alt=""
            className={dead ? 'fx-enemy-topple' : ''}
            style={{
              height: node.type === 'boss' ? '36vh' : '29vh',
              filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.7))',
              animation: dead ? undefined : `breathe 3.2s ease-in-out infinite${flashKey ? ', hitFlash 0.32s ease-out' : ''}`,
            }}
          />
        </div>
      </div>

      {/* Números de daño flotantes sobre el enemigo. */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
        {floaters.map((f) => (
          <span key={f.id} className="fx-floatup absolute font-bold font-display" style={{
            left: `${f.left}%`, top: '26%', color: f.color, fontSize: '22px',
            textShadow: '0 2px 4px rgba(0,0,0,0.9)',
          }}>{f.text}</span>
        ))}
      </div>

      {/* ── Contenido (por encima de la escena) ── */}
      <div className="relative flex flex-col flex-1 min-h-0" style={{ zIndex: 10 }}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-red-400 font-bold flex items-center gap-2 font-display">
            <SpriteIcon name={node.type === 'boss' ? 'skull' : 'sword'} size={24}
              fallback={node.type === 'boss' ? '💀' : '⚔️'} />
            {node.name} · ronda {state.round}/{state.maxRounds}
          </h2>
          <button onClick={close} className="text-gray-400 text-xl px-2">✕</button>
        </div>

        {/* Enemigo — barra de vida */}
        <div className="mb-2">
          <div className="text-gray-300 text-xs mb-1">Enemigo</div>
          <Bar value={enemyPct} tone="seal" label="Vida del enemigo" />
        </div>

        <div className="flex-1" />

        {/* Fila de UNIDADES de héroe (retratos painterly): embisten al golpear,
            destellan al recibir, caen al morir. Tap = disparar habilidad. */}
        <div className="flex justify-center items-end gap-2 flex-wrap mb-2">
          {state.heroes.map((h) => {
            const ready = h.alive && h.energy >= h.energyMax;
            const fx = heroFx[h.slot];
            const portrait = h.heroId ? `/assets/game/heroes/${h.heroId}.png` : null;
            const lunging = h.alive && (fx?.type === 'cast' || fx?.type === 'lunge');
            const animClass = !h.alive ? 'fx-hero-down' : (lunging ? 'fx-hero-lunge' : '');
            return (
              <button key={h.slot} onClick={() => doStep({ type: 'skill', slot: h.slot })}
                disabled={!ready || busy || !!result}
                className="relative flex flex-col items-center" style={{ width: 60 }}>
                {ready && (
                  <span className="absolute -top-1.5 z-10 text-[8px] font-bold text-yellow-200 bg-black/70 px-1 rounded"
                    style={{ left: '50%', transform: 'translateX(-50%)' }}>¡TAP!</span>
                )}
                <div key={!h.alive ? 'dead' : (fx?.key || 'idle')} className={animClass}>
                  <div className={`relative rounded-lg overflow-hidden ${ready ? 'fx-ring-ready' : ''}`}
                    style={{
                      width: 52, height: 52,
                      border: `2px solid ${ready ? '#ffd700' : '#5a5148'}`,
                      backgroundImage: portrait ? `url(${portrait})` : 'none',
                      backgroundColor: portrait ? '#1a1712' : '#2a2620',
                      backgroundSize: 'cover', backgroundPosition: 'center top',
                    }}>
                    {!portrait && (
                      <span className="absolute inset-0 flex items-center justify-center text-xl">{h.skill.icon || '⚔️'}</span>
                    )}
                    {fx?.type === 'hit' && (
                      <span key={fx.key} className="fx-rowhit absolute inset-0" style={{ background: '#b32821' }} />
                    )}
                    {fx?.type === 'cast' && (
                      <span key={fx.key} className="fx-castspark absolute" style={{
                        left: '50%', top: '50%', width: 34, height: 34, marginLeft: -17, marginTop: -17,
                        borderRadius: '9999px', background: 'radial-gradient(circle, #ffe9a8 0%, #ffb020 55%, transparent 72%)',
                      }} />
                    )}
                    {!h.alive && (
                      <span className="absolute inset-0 flex items-center justify-center text-lg">☠️</span>
                    )}
                  </div>
                </div>
                {/* Energía */}
                <div className="mt-1 w-full">
                  <Bar value={h.energy} tone={ready ? 'ember' : 'macula'} label={`Energía de ${h.name}`} />
                </div>
                <span className="text-[9px] text-gray-300 truncate w-full text-center leading-tight">{h.name}</span>
              </button>
            );
          })}
        </div>

        {/* Avanzar / resultado */}
        {result ? (
          <div className="text-center animate-grow">
            <p className={`text-2xl font-bold font-display ${result === 'victory' ? 'text-green-400' : 'text-red-400'}`}>
              {result === 'victory' ? '🏆 ¡Victoria!' : '💀 Derrota'}
            </p>
            <button onClick={close} className="btn-gold mt-2 px-6 py-2 rounded">Volver</button>
          </div>
        ) : (
          <button onClick={() => doStep({ type: 'advance' })} disabled={busy}
            className="btn-primary py-3 rounded font-bold disabled:opacity-50">
            {busy ? '...' : '⚔️ Avanzar ronda'}
          </button>
        )}
      </div>

      {/* Fanfarria de resultado. */}
      {result === 'victory' && <EmberField count={44} color="#ffd35a" maxOpacity={0.95} className="z-[20]" />}
      {result === 'defeat' && (
        <div className="absolute inset-0 pointer-events-none animate-fade-in"
          style={{ zIndex: 20, background: 'radial-gradient(circle at 50% 45%, rgba(179,40,33,0.35), transparent 70%)' }} />
      )}
    </div>
  );
}
