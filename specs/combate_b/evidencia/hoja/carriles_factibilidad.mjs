// T10.6 — ¿Existe una formación con carriles por profundidad que cumpla R24 + V1 + V2 (enmendada) + V3 + R27?
// Búsqueda EXACTA (no heurística) sobre las restricciones de hoja_visual.md, con las cajas = bbox alfa>0 real de cada
// sprite (hoja_alfa.json, medido con medir_alfa.cjs) y la línea de piso de cada fondo (calibracion_suelo.json).
//
// Modelo (mundo 824×1720):
//  - Filas de profundidad, de arriba a abajo: EB (enemigos atrás), EF (enemigos adelante), HB (héroes 4–5), HF (héroes 1–3).
//    Cada fila tiene su carril L (y de los pies); todos sus personajes tienen la caja [L − h, L]. Orden: L_EB ≤ L_EF ≤ L_HB ≤ L_HF.
//  - Un enemigo solo o un jefe usa un único carril; con 2–4 enemigos se prueban TODOS los repartos atrás/adelante.
//  - Dos cajas de filas distintas no se intersectan si son disjuntas en X o en Y. Para cada par de filas (i arriba,
//    j abajo) o bien todas sus cajas son disjuntas en X, o bien L_j − h_j ≥ L_i (h_j = la caja más alta de la fila j;
//    exigirlo para todo el par es lo más favorable: basta que UNA caja de j se cruce en X con una de i).
//    Se prueban los 2^(pares) conjuntos S de pares «lado a lado»; para cada S la colocación en X se decide exacta
//    (órdenes por borde izquierdo con colocación voraz, óptima para un orden fijo, con memoria de estados).
//  - Carriles: L ≥ G (piso del fondo) y L_HF ≤ B (tope inferior); cabezas: L − h ≥ T (tope superior).
//  - Escalas V1 en su MÍNIMO (lo más favorable para caber): héroe delantero = 0,60 × 499 (enemigo común solo, R27),
//    trasero = 0,80 × delantero, comunes en grupo = 0,90 × héroe delantero, común solo = 499 y jefe = 619 (R27, igualdad).
//    OJO: V1 fija el piso de 0,9 × héroe solo para 3–4 enemigos; con m = 2 el modelo usa el mismo tamaño (no es una cota
//    inferior estricta para m = 2: los casos m = 2 que fallen se marcan aparte en tasks.md).
//  - Clases de héroe: «ranger» = todos ranger (la silueta más angosta, lo más favorable); «rogue» = todos rogue (la más
//    ancha); «mixto» = la escuadra de las capturas (slots 1–5: warrior, mage, ranger, paladin, rogue).
//  - --entre-filas: variante NO pedida (para cuantificar una opción del owner): R24 solo DENTRO de cada fila; filas
//    distintas pueden cruzarse (el orden de dibujo por carril pone delante la de abajo).
// Uso: node carriles_factibilidad.mjs [--B 1440] [--T 0 | --T <m=1>,<m≥2>] [--hf 299.4] [--entre-filas] [--json salida.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const B = Number(arg('--B', 1440));
const [T1, TG] = String(arg('--T', '0')).split(',').concat(String(arg('--T', '0'))).map(Number); // cabezas: m=1 , m≥2
const HF_ARG = arg('--hf', null);  // alto de textura del héroe delantero (por defecto el mínimo de V1: 0,60 × 499)
const OUT = arg('--json', null);
const ENTRE_FILAS = process.argv.includes('--entre-filas');

const ALPHA = JSON.parse(fs.readFileSync(path.join(HERE, 'hoja_alfa.json'), 'utf8'));
const GROUND = JSON.parse(fs.readFileSync(path.join(HERE, 'calibracion_suelo.json'), 'utf8'));
const WORLD_W = 824;
const SOLO = Math.round(0.29 * 1720);   // 499
const BOSS = Math.round(0.36 * 1720);   // 619
const HF = HF_ARG ? Number(HF_ARG) : 0.60 * SOLO;
const HB = 0.80 * HF;
const HG = 0.90 * HF;

// caja alfa de un sprite dibujado con alto de textura `ht`
const abox = (key, ht) => {
  const a = ALPHA[key];
  const s = ht / a.H;
  return { w: (a.r - a.l + 1) * s, h: (a.b - a.t + 1) * s };
};

// Nodos reales de combate (bgArt/enemyArt de artMap.js) + el caso genérico de los tests (sin nodo → crypt + bruto).
const NODES = [
  ['(sin nodo)', 'crypt', 'bruto', false],
  ['a1n3', 'crypt', 'bruto', false], ['a1n7', 'crypt', 'carroneros', false],
  ['a1n4', 'moor', 'aullador', false], ['a1n8', 'moor', 'aullador', false],
  ['a1n5', 'cathedral', 'boss_heraldo', true], ['a1n9', 'cathedral', 'boss_devorador', true],
  ['a2n2', 'ashfield', 'bruto', false], ['a2n7', 'ashfield', 'sin_rostro', false], ['a2n9', 'ashfield', 'bruto', false],
  ['a2n4', 'veil_marsh', 'bruto', false], ['a2n8', 'veil_marsh', 'bruto', false],
  ['a2n5', 'veil_gate', 'coloso', true], ['a2n10', 'veil_gate', 'voz_del_velo', true],
];

function rowsFor(n, m, art, boss, heroClass, split) {
  const rows = [];
  const eH = m === 1 ? (boss ? BOSS : SOLO) : HG;
  const e = abox(`enemies/${art}_idle`, eH);
  const back = m === 1 ? 0 : split;            // enemigos en EB
  if (back > 0) rows.push({ id: 'EB', h: e.h, ws: Array(back).fill(e.w) });
  if (m - back > 0) rows.push({ id: 'EF', h: e.h, ws: Array(m - back).fill(e.w) });
  const cls = (slot) => (Array.isArray(heroClass) ? heroClass[slot - 1] : heroClass);
  const hb = (slot) => abox(`heroes/${cls(slot)}_idle`, HB);
  const hf = (slot) => abox(`heroes/${cls(slot)}_idle`, HF);
  const row = (id, slots, f) => ({ id, h: Math.max(...slots.map((s) => f(s).h)), ws: slots.map((s) => f(s).w) });
  if (n > 3) rows.push(row('HB', Array.from({ length: n - 3 }, (_, i) => 4 + i), hb));
  rows.push(row('HF', Array.from({ length: Math.min(n, 3) }, (_, i) => 1 + i), hf));
  return rows;
}

// ¿Caben en [0, 824] las cajas con estos conflictos (misma fila, o filas en S)? Exacto: se recorren los órdenes por borde
// izquierdo colocando cada caja lo más a la izquierda posible (óptimo para un orden fijo); la memoria por (cajas puestas,
// borde derecho máximo de cada fila) evita repetir estados equivalentes.
function xFeasible(rows, S) {
  const units = rows.flatMap((r, ri) => r.ws.map((w) => ({ ri, w })));
  const conflictRow = (a, b) => a === b || (!ENTRE_FILAS && S.has(`${Math.min(a, b)}-${Math.max(a, b)}`));
  const full = (1 << units.length) - 1;
  const memo = new Set();
  const dfs = (mask, rights) => {
    if (mask === full) return true;
    const key = `${mask}|${rights.map((x) => x.toFixed(3)).join(',')}`;
    if (memo.has(key)) return false;
    memo.add(key);
    const seen = new Set();
    for (let i = 0; i < units.length; i++) {
      if (mask & (1 << i)) continue;
      const u = units[i];
      const sig = `${u.ri}:${u.w.toFixed(3)}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      let left = 0;
      for (let r = 0; r < rows.length; r++) if (conflictRow(r, u.ri)) left = Math.max(left, rights[r]);
      const right = left + u.w;
      if (right > WORLD_W + 1e-9) continue;
      const next = rights.slice();
      next[u.ri] = Math.max(next[u.ri], right);
      if (dfs(mask | (1 << i), next)) return true;
    }
    return false;
  };
  return dfs(0, rows.map(() => 0));
}

// carril mínimo de la última fila (héroes delanteros) para un conjunto S; Infinity si S no cabe en X.
function minLast(rows, S, G, T) {
  if (!xFeasible(rows, S)) return { last: Infinity };
  const L = [];
  for (let j = 0; j < rows.length; j++) {
    let l = Math.max(G, T + rows[j].h, j ? L[j - 1] : -Infinity);
    if (!ENTRE_FILAS) for (let i = 0; i < j; i++) if (!S.has(`${i}-${j}`)) l = Math.max(l, L[i] + rows[j].h);
    L.push(l);
  }
  return { last: L[L.length - 1], L };
}

function solve(n, m, bg, art, boss, heroClass) {
  const G = GROUND[bg].groundY;
  let best = { last: Infinity };
  const splits = m === 1 ? [0] : Array.from({ length: m + 1 }, (_, k) => k);
  for (const split of splits) {
    const rows = rowsFor(n, m, art, boss, heroClass, split);
    const pairs = [];
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) pairs.push(`${i}-${j}`);
    for (let mask = 0; mask < (ENTRE_FILAS ? 1 : 1 << pairs.length); mask++) {
      const S = new Set(pairs.filter((_, k) => mask & (1 << k)));
      const r = minLast(rows, S, G, m === 1 ? T1 : TG);
      if (r.last < best.last) best = { ...r, split, rows: rows.map((x) => x.id), S: [...S].map((k) => k.split('-').map((i) => rows[i].id).join('|')) };
    }
  }
  return best;
}

const results = [];
const COMPOS = { ranger: 'ranger', rogue: 'rogue', mixto: ['warrior', 'mage', 'ranger', 'paladin', 'rogue'] };
for (const [compo, heroClass] of Object.entries(COMPOS)) {
  for (const [node, bg, art, boss] of NODES) {
    for (let n = 1; n <= 5; n++) {
      for (let m = 1; m <= 4; m++) {
        const r = solve(n, m, bg, art, boss, heroClass);
        results.push({ heroClass: compo, node, bg, art, boss: boss && m === 1, n, m, G: GROUND[bg].groundY, minLaneHF: Math.round(r.last), B, ok: r.last <= B, split: r.split, rows: r.rows, S: r.S, L: r.L && r.L.map(Math.round) });
      }
    }
  }
}

console.log(`Modelo${ENTRE_FILAS ? ' (--entre-filas: R24 solo dentro de cada fila)' : ''}: B (tope inferior de carriles) = ${B}, T (tope de cabezas) = ${T1} con 1 enemigo / ${TG} con 2+; héroe ${HF.toFixed(1)} / trasero ${HB.toFixed(1)} / grupo ${HG.toFixed(1)} / solo ${SOLO} / jefe ${BOSS} (alto de textura).`);
for (const heroClass of Object.keys(COMPOS)) {
  const sub = results.filter((r) => r.heroClass === heroClass);
  const bad = sub.filter((r) => !r.ok);
  console.log(`\nEscuadra ${heroClass}: ${sub.length - bad.length}/${sub.length} combinaciones factibles; ${bad.length} SIN solución:`);
  for (const r of bad) {
    const best = r.rows ? `mejor: filas ${r.rows.join('/')} carriles ${r.L.join('/')}${r.S.length ? ` lado a lado ${r.S.join(' ')}` : ''}` : '';
    console.log(`  ${r.node.padEnd(10)} ${r.bg.padEnd(10)} ${r.art.padEnd(14)} ${r.boss ? 'jefe' : '    '} n=${r.n} m=${r.m}  G=${r.G}  carril HF mínimo=${r.minLaneHF} > B=${B}  (${best})`);
  }
}
if (OUT) fs.writeFileSync(path.resolve(OUT), JSON.stringify({ B, T: [T1, TG], HF, HB, HG, SOLO, BOSS, results }, null, 1));
process.exitCode = 0;
