/**
 * CombatStage: monta el Phaser.Game propio del combate (combate_b T6; R36–R39, design §6).
 * - Contenedor de alto `var(--kh-frame-h)`; el lienzo 824×1720 escala FIT dentro (R36).
 * - Sin WebGL/canvas o si `new Phaser.Game` lanza → modo `unavailable` (el panel muestra el resultado ya, R19c).
 * - `combat:open` al crear el juego y `combat:close` al destruirlo; el hub duerme/despierta (R39).
 * - Al desmontar: `game.destroy(true)` una vez; no queda ningún listener de EventBridge del stage (R38).
 * Props: `state` (estado inicial), `node`, `step` ({ id, state, roundLog, action, result } por cada ronda resuelta),
 *        `onMode(mode)` con 'loading' | 'ready' | 'unavailable'.
 */
import { useEffect, useRef, useState } from 'react';
import EventBridge from '../../game/EventBridge';
import { eventsForStep } from '../../game/combat/eventSource';

export function canRenderCombat() {
  try {
    return typeof window !== 'undefined' && !!(window.WebGLRenderingContext || window.CanvasRenderingContext2D);
  } catch {
    return false;
  }
}

export default function CombatStage({ state, node, step, onMode, className = '' }) {
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const prevRef = useRef(state);
  const pendingRef = useRef([]);
  const lastStepRef = useRef(null);
  const [mode, setMode] = useState(() => (canRenderCombat() ? 'loading' : 'unavailable'));
  const onModeRef = useRef(onMode);
  onModeRef.current = onMode;

  const change = (m) => { setMode(m); if (onModeRef.current) onModeRef.current(m); };

  useEffect(() => {
    if (mode === 'unavailable') { if (onModeRef.current) onModeRef.current('unavailable'); return undefined; }
    let cancelled = false;
    let opened = false;
    let game = null;
    (async () => {
      try {
        const { createCombatGame } = await import('../../game/combat/createCombatGame');
        if (cancelled || !hostRef.current) return;
        // a lo sumo un <canvas> de combate en el DOM (R38)
        hostRef.current.querySelectorAll('canvas').forEach((c) => c.remove());
        game = createCombatGame(hostRef.current, {
          state,
          node,
          onReady: (scene) => {
            sceneRef.current = scene;
            for (const job of pendingRef.current.splice(0)) scene.playRound(job.events, job.state);
          },
          onRoundDone: (info) => EventBridge.emit('combat:round-done', info),
        });
        gameRef.current = game;
        EventBridge.emit('combat:open', {});
        opened = true;
        change('ready');
      } catch (e) {
        console.warn('[combat] la escena no pudo iniciar:', e && e.message);
        if (!cancelled) change('unavailable');
      }
    })();
    return () => {
      cancelled = true;
      sceneRef.current = null;
      if (game) {
        try { game.destroy(true); } catch (e) { console.warn('[combat] destroy falló:', e && e.message); }
        gameRef.current = null;
      }
      if (opened) EventBridge.emit('combat:close', {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada ronda resuelta: eventos del servidor (v2) o derivados (v1) → a la escena.
  useEffect(() => {
    if (!step || !step.state || lastStepRef.current === step.id) return;
    lastStepRef.current = step.id;
    const { events } = eventsForStep({
      prev: prevRef.current, state: step.state, roundLog: step.roundLog, action: step.action, result: step.result,
    });
    prevRef.current = step.state;
    if (mode === 'unavailable') return;
    const job = { events, state: step.state };
    if (sceneRef.current) sceneRef.current.playRound(job.events, job.state);
    else pendingRef.current.push(job);
  }, [step, mode]);

  return (
    <div
      ref={hostRef}
      data-combat-stage={mode}
      className={className}
      style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 'var(--kh-frame-h)', zIndex: 0,
        overflow: 'hidden', background: '#000', touchAction: 'none',
      }}
    />
  );
}
