/**
 * Demo solo-dev del piloto poses_b: reproduce un combate fijo (warrior + mage + ranger + 2.º warrior vs 2 brutos) con ataque,
 * habilidad, impacto, KO y victoria. Sin servidor ni login. Parámetros: ?reduced=1 fuerza reduced-motion; ?q=low|medium|high.
 * Expone `window.__demo` ({ done, fps, frames, ms }) para que el script de grabación sepa cuándo terminó.
 */
import { createCombatGame } from '../game/combat/createCombatGame';
import { QUALITY } from '../game/combat/combatQuality';

if (!import.meta.env.DEV) throw new Error('poses-demo es solo para desarrollo');

const params = new URLSearchParams(location.search);
const NODE = { id: 'a1n3', type: 'combat' };
const H = (slot, cls, hp, maxHp) => ({ slot, heroId: null, class: cls, hp, maxHp, alive: hp > 0 });
const E = (id, hp, maxHp) => ({ id, hp, maxHp });

const S0 = { heroes: [H(1, 'warrior', 100, 100), H(2, 'mage', 60, 60), H(3, 'ranger', 80, 80), H(4, 'warrior', 70, 70)], enemies: [E('e0', 120, 120), E('e1', 90, 90)] };
const S1 = { heroes: [H(1, 'warrior', 76, 100), H(2, 'mage', 60, 60), H(3, 'ranger', 80, 80), H(4, 'warrior', 70, 70)], enemies: [E('e0', 78, 120), E('e1', 66, 90)] };
const S2 = { heroes: [H(1, 'warrior', 76, 100), H(2, 'mage', 0, 60), H(3, 'ranger', 80, 80), H(4, 'warrior', 0, 70)], enemies: [E('e0', 0, 120), E('e1', 66, 90)] };
const S3 = { heroes: [H(1, 'warrior', 76, 100), H(2, 'mage', 0, 60), H(3, 'ranger', 80, 80), H(4, 'warrior', 0, 70)], enemies: [E('e0', 0, 120), E('e1', 0, 90)], result: 'victory' };

let t = 0;
const ev = (round, actor, target, kind, value, extra) => ({ t: (t += 1), round, actor, target, kind, value, ...extra });
const ROUNDS = [
  { state: S1, events: [
    ev(1, 'h1', 'e0', 'skill', 42, { skillType: 'damage' }),
    ev(1, 'e0', 'h1', 'hit', 24, { hp: 76 }),
    ev(1, 'h3', 'e1', 'hit', 24, { hp: 66 }),
  ] },
  { state: S2, events: [
    ev(2, 'e0', 'h4', 'hit', 70, { hp: 0 }),
    ev(2, 'e0', 'h4', 'death', 0),
    ev(2, 'h1', 'e0', 'hit', 78, { hp: 0 }),
    ev(2, 'h1', 'e0', 'death', 0),
    ev(2, 'e1', 'h2', 'hit', 60, { hp: 0 }),
    ev(2, 'e1', 'h2', 'death', 0),
  ] },
  { state: S3, events: [
    ev(3, 'h1', 'e1', 'skill', 66, { skillType: 'damage' }),
    ev(3, 'h3', 'e1', 'hit', 0),
    ev(3, 'h1', 'e1', 'death', 0, { actor: 'h1', target: 'e1' }),
    ev(3, null, null, 'end', 'victory'),
  ] },
];

const hud = document.getElementById('hud');
const demo = (window.__demo = { done: false, frames: 0, ms: 0, fps: 0 });
let rounds = 0;
let last = performance.now();
const startedAt = last;
function tick(now) {
  demo.frames += 1;
  demo.ms = now - startedAt;
  demo.fps = Math.round((demo.frames / Math.max(1, demo.ms)) * 1000);
  hud.textContent = `fps ${demo.fps}  r${rounds}${params.get('reduced') ? '  reduced' : ''}`;
  last = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

const quality = QUALITY[params.get('q')] || QUALITY.medium;
const game = createCombatGame(document.getElementById('stage'), {
  quality, state: S0, node: NODE, reducedMotion: params.get('reduced') === '1' ? true : undefined,
  onReady: (scene) => { demo.scene = scene; setTimeout(() => scene.playRound(ROUNDS[0].events, ROUNDS[0].state), 1800); },
  onRoundDone: () => {
    rounds += 1;
    if (rounds < ROUNDS.length) { const r = ROUNDS[rounds]; setTimeout(() => demo.scene.playRound(r.events, r.state), 900); }
    else setTimeout(() => { demo.done = true; }, 4500);
  },
});
window.__phaserGame = game;
