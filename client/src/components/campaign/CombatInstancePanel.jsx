import { useState, useEffect, useRef } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import Bar from '../ui/Bar';
import Button from '../ui/Button';
import ResultBanner from '../ui/ResultBanner';
import { KH } from '../ui/kitPieces';
import EmberField from '../fx/EmberField';
import EventBridge from '../../game/EventBridge';
import CombatStage from './CombatStage';

// combate_b: la escena (Phaser, CombatStage) dibuja fondo, enemigos y héroes; este panel es solo el HUD.
// Retratos (Q6): ícono de clase del kit B, sin arte del set viejo (R42).
const CLASS_ICON = { warrior: 'sword', mage: 'star', ranger: 'bow', paladin: 'shield', rogue: 'sword' };
export const classIcon = (h) => CLASS_ICON[h?.class] || h?.skill?.icon || 'sword';

const ADVANCE_PAUSE_MS = 300;   // R17: pausa tras `combat:round-done`
const IDLE_ADVANCE_MS = 2000;   // auto-avance sin escena (o antes de la primera ronda)
const SCENE_FALLBACK_MS = 4000; // R19b: la escena no responde

// R54: filas de vida desde `state.enemies` (v2) o `[state.enemy]` (v1), en el orden recibido.
export function enemyBars(state) {
  const list = Array.isArray(state?.enemies) && state.enemies.length ? state.enemies : [state?.enemy].filter(Boolean);
  return list.map((e, i) => {
    const hp = Math.max(0, Number(e.hp) || 0);
    const max = Number(e.maxHp) > 0 ? Number(e.maxHp) : 0;
    const name = typeof e.name === 'string' && e.name.trim() ? e.name.trim() : `Enemigo ${i + 1}`;
    return { key: typeof e.id === 'string' ? e.id : `e${i}`, name, dead: hp <= 0, pct: max ? Math.min(100, Math.round((hp / max) * 100)) : 0 };
  });
}

export default function CombatInstancePanel({ onClose }) {
  const activeRun = useGameStore((s) => s.activeRun);
  const stepInstance = useGameStore((s) => s.stepInstance);
  const clearActiveRun = useGameStore((s) => s.clearActiveRun);
  const addNotification = useGameStore((s) => s.addNotification);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [playing, setPlaying] = useState(false);       // la escena está reproduciendo una ronda
  const [step, setStep] = useState(null);              // última ronda resuelta → CombatStage
  const [stageMode, setStageMode] = useState('loading');
  const modeRef = useRef('loading');
  const mounted = useRef(true);
  const stepSeq = useRef(0);
  const pendingResult = useRef(null);                  // resultado recibido, a la espera de round-done
  const pendingSkill = useRef(null);                   // habilidad pedida durante la reproducción (R17)
  const fallbackTimer = useRef(null);
  const initialState = useRef(activeRun?.state);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(fallbackTimer.current); };
  }, []);

  const onMode = (m) => { modeRef.current = m; setStageMode(m); };

  // La escena terminó de reproducir la ronda (o venció el plazo): libera el bloqueo / muestra el resultado.
  const release = () => {
    clearTimeout(fallbackTimer.current);
    if (!mounted.current) return;
    if (pendingResult.current) {
      const r = pendingResult.current;
      pendingResult.current = null;
      setResult(r);
    }
    setPlaying(false);
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  useEffect(() => {
    const h = (info) => releaseRef.current(info);
    EventBridge.on('combat:round-done', h);
    return () => EventBridge.off('combat:round-done', h);
  }, []);

  const doStep = async (action) => {
    if (result) return;
    if (playing && action.type === 'skill') { pendingSkill.current = action; return; }
    if (busy || playing) return;
    setBusy(true);
    try {
      const r = await stepInstance(action);
      if (!mounted.current) return;
      const unavailable = modeRef.current === 'unavailable';
      if (!unavailable) {
        const st = r?.state ?? useGameStore.getState().activeRun?.state;
        if (st) {
          stepSeq.current += 1;
          setStep({ id: stepSeq.current, state: st, roundLog: r?.roundLog, action, result: r?.result ?? null });
        }
      }
      if (r?.result) {
        if (unavailable) setResult(r.result);          // R19c: sin escena, banner en el mismo tick
        else {
          pendingResult.current = r.result;            // R5: el resultado sale de data.result
          setPlaying(true);                            // no se avanza más: solo falta mostrar el desenlace
          clearTimeout(fallbackTimer.current);
          fallbackTimer.current = setTimeout(() => releaseRef.current(), SCENE_FALLBACK_MS);
        }
      } else if (!unavailable) {
        setPlaying(true);
        clearTimeout(fallbackTimer.current);
        fallbackTimer.current = setTimeout(() => releaseRef.current(), SCENE_FALLBACK_MS);
      }
    } catch (e) {
      addNotification(e.response?.data?.error || 'No se pudo resolver la ronda', 'error');
    } finally { if (mounted.current) setBusy(false); }
  };

  // Auto-avance: ~2 s sin escena; con escena, 300 ms después de que termina la ronda (R17).
  // Una habilidad en cola sale aquí, una sola vez.
  useEffect(() => {
    if (!activeRun || result || busy || playing) return undefined;
    const delay = step && stageMode === 'ready' ? ADVANCE_PAUSE_MS : IDLE_ADVANCE_MS;
    const t = setTimeout(() => {
      const queued = pendingSkill.current;
      pendingSkill.current = null;
      doStep(queued || { type: 'advance' });
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.state?.round, result, busy, playing, stageMode]);

  if (!activeRun) { onClose(); return null; }
  const { node, state } = activeRun;

  const close = () => { clearActiveRun(); onClose(); };
  const enemyRows = enemyBars(state);

  return (
    <div className="fixed inset-0 z-50 flex flex-col p-4 pb-28 overflow-hidden" style={{ background: KH.ink }}>
      <CombatStage state={initialState.current} node={node} step={step} onMode={onMode} />

      {/* ── HUD (por encima de la escena; solo lo interactivo captura toques, el resto deja pasar el salto) ── */}
      <div className="relative flex flex-col flex-1 min-h-0 pointer-events-none" style={{ zIndex: 10 }}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-kh-bone font-bold flex items-center gap-2 font-display">
            <SpriteIcon name={node.type === 'boss' ? 'skull' : 'sword'} size={28} />
            {node.name} · ronda {state.round}/{state.maxRounds}
          </h2>
          <button type="button" aria-label="Cerrar" onClick={close} className="kh-close pointer-events-auto" style={{ minWidth: 44, minHeight: 44 }} />
        </div>

        {/* Enemigos — una barra de vida por enemigo (R54); con 3+ se reparten en dos columnas para no crecer. */}
        <div data-enemy-bars className="mb-2 grid gap-x-3 gap-y-1"
          style={{ gridTemplateColumns: enemyRows.length > 2 ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}>
          {enemyRows.map((e) => (
            <div key={e.key} data-enemy-bar data-dead={e.dead ? 'true' : 'false'} style={{ opacity: e.dead ? 0.45 : 1 }}>
              <div className="text-kh-bone-dim text-xs mb-0.5 truncate leading-tight">{e.name}</div>
              <Bar value={e.pct} tone="seal" label={`Vida de ${e.name}`} />
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {/* Fila de héroes: ícono de clase, energía y toque = habilidad. */}
        <div className="flex justify-center items-end gap-2 flex-wrap mb-2">
          {state.heroes.map((h) => {
            const ready = h.alive && h.energy >= h.energyMax;
            return (
              <button key={h.slot} onClick={() => doStep({ type: 'skill', slot: h.slot })}
                disabled={!ready || busy || !!result}
                className="relative flex flex-col items-center pointer-events-auto" style={{ width: 60, minHeight: 44 }}>
                {ready && (
                  <span className="absolute -top-2 z-10 text-xs font-bold text-kh-brass-light px-1 rounded"
                    style={{ left: '50%', transform: 'translateX(-50%)', backgroundColor: KH.ink }}>¡TAP!</span>
                )}
                <div className={`relative rounded-lg overflow-hidden ${ready ? 'fx-ring-ready' : ''}`}
                  style={{
                    width: 52, height: 52,
                    border: `2px solid ${ready ? KH['brass-light'] : KH.iron}`,
                    backgroundColor: KH.oak,
                    opacity: h.alive ? 1 : 0.55,
                  }}>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <SpriteIcon name={h.alive ? classIcon(h) : 'skull'} size={28} />
                  </span>
                </div>
                <div className="mt-1 w-full">
                  <Bar value={h.energy} tone={ready ? 'ember' : 'macula'} label={`Energía de ${h.name}`} />
                </div>
                <span className="text-xs text-kh-bone-dim truncate w-full text-center leading-tight">{h.name}</span>
              </button>
            );
          })}
        </div>

        {/* Avanzar / resultado */}
        <div className="pointer-events-auto">
          {result ? (
            <ResultBanner
              outcome={result === 'victory' ? 'victory' : 'defeat'}
              title={result === 'victory' ? '¡Victoria!' : 'Derrota'}
              onClose={close}
              closeLabel="Volver"
            />
          ) : (
            <Button variant="primary" onClick={() => doStep({ type: 'advance' })} disabled={busy || playing} className="w-full">
              {busy ? '...' : 'Avanzar ronda'}
            </Button>
          )}
        </div>
      </div>

      {/* Fanfarria de resultado. */}
      {result === 'victory' && <EmberField count={44} color="#ffd35a" maxOpacity={0.95} className="z-[20]" />}
      {result === 'defeat' && (
        <div data-defeat-veil className="absolute inset-0 pointer-events-none animate-fade-in"
          style={{ zIndex: 20, background: 'radial-gradient(circle at 50% 45%, rgba(179,40,33,0.35), transparent 70%)' }} />
      )}
    </div>
  );
}
