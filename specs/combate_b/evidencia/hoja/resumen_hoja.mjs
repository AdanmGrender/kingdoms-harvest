// T10.6 — Tabla V1–V9 a partir de hoja_medidas.json (la escribe generar_evidencia_hoja.mjs). Sin red ni navegador.
// Uso: node resumen_hoja.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M = JSON.parse(fs.readFileSync(path.join(HERE, 'hoja_medidas.json'), 'utf8'));
const vistas = Object.entries(M).filter(([k]) => k !== 'errores');
const r2 = (x) => Math.round(x * 100) / 100;
const vivos = (v) => v.crudo.actores.filter((a) => !a.muerto);
const alto = (v, pred) => vivos(v).filter(pred).map((a) => a.dibujado.alto);

// V1: altos dibujados (los leídos de los sprites de Phaser)
const uno = M['412x860_1enemigo']; const jefe = M['412x860_jefe']; const tres = M['412x860_3enemigos']; const cuatro = M['412x860_4enemigos_veil'];
const hF = alto(uno, (a) => a.row === 'HF')[0];
const hB = alto(uno, (a) => a.row === 'HB')[0];
const comun = alto(uno, (a) => a.kind === 'enemy')[0];
const boss = alto(jefe, (a) => a.kind === 'enemy')[0];
const grupo = Math.min(...alto(tres, (a) => a.kind === 'enemy'), ...alto(cuatro, (a) => a.kind === 'enemy'));
const V1 = { heroeSobreComun: r2(hF / comun), jefeSobreHeroe: r2(boss / hF), grupoSobreHeroe: r2(grupo / hF), traseraSobreDelantera: r2(hB / hF) };
const V1ok = V1.heroeSobreComun >= 0.6 && V1.heroeSobreComun <= 0.7 && V1.jefeSobreHeroe >= 1.8 && V1.jefeSobreHeroe <= 2.2 && V1.grupoSobreHeroe >= 0.9 && V1.traseraSobreDelantera >= 0.8 && V1.traseraSobreDelantera <= 0.85;

// V2: pie vs. su carril, carriles sobre el piso de su fondo y sobre los botones
const pie = Math.max(...vistas.map(([, v]) => v.V2.piePeorDesvio));
const sobrePiso = vistas.every(([, v]) => v.V2.sobrePiso);
const sobreBotones = vistas.every(([, v]) => v.V2.sobreBotones);
const margenPiso = Math.min(...vistas.map(([, v]) => v.V2.carrilMinimo - v.V2.piso));
const margenBotones = Math.min(...vistas.map(([, v]) => v.V2.botonesTopMundo - v.V2.carrilMaximo));

// V3: solape dentro de fila, HUD sobre siluetas, cabezas bajo barras, cara tapada
const solape = Math.max(...vistas.map(([, v]) => v.V3.solapeMaxDentroDeFila));
const hud = vistas.reduce((s, [, v]) => s + v.V3.hudSobreSiluetas.length, 0);
const cabezas = vistas.every(([, v]) => v.V3.cabezaBajoBarras);
const cara = Math.max(...vistas.map(([, v]) => v.caraTapadaMax));

// V4 y V7 (vistas de 1 enemigo)
const dyn = vistas.filter(([k]) => k.endsWith('_1enemigo')).map(([, v]) => v);
const v4 = dyn[0].v4; const v7 = dyn[0].v7;
const V4ok = dyn.every((v) => v.v4.normalPx >= 36 && v.v4.normalPx <= 44 && v.v4.criticoPx >= 56 && v.v4.criticoPx <= 64 && v.v4.sobreLaCabeza
  && v.v4.escalaInicial === 1.4 && v.v4.escala140ms === 1 && v.v4.subida840ms === 60 && !v.v4.vivoA840ms && v.v4.apilado === 28);
const V7ok = dyn.every((v) => v.v7.flipDurante && v.v7.anguloDurante > 0 && v.v7.anguloDurante <= 15 && !v.v7.flipDespues && v.v7.anguloDespues === 0 && !v.v7.h1FlipDurante);

// V5: nombres
const nombres = vistas.flatMap(([, v]) => v.crudo.nombres);
const barras = vistas.flatMap(([, v]) => v.crudo.barrasEnemigo);
const V5ok = nombres.every((n) => !n.recortado && n.px >= 11 && !/…/.test(n.texto)) && barras.every((b) => !b.recortado && !/…/.test(b.nombre));

// V6: derrota (héroes) y victoria (enemigo)
const caidos = vistas.filter(([k]) => /derrota|victoria/.test(k)).flatMap(([, v]) => v.crudo.actores.filter((a) => a.muerto));
const V6ok = caidos.length > 0 && caidos.every((a) => Math.abs(a.sp.angle) === 90 && a.sp.alpha >= 0.8 && a.sp.gris)
  && vistas.filter(([k]) => k.endsWith('derrota')).every(([, v]) => v.crudo.barrasHeroe.every((b) => b.muerta && b.opacidad === '0.45'))
  && vistas.filter(([k]) => k.endsWith('victoria')).every(([, v]) => v.crudo.barrasEnemigo.every((b) => b.muerta && b.opacidad === '0.45'));

// V8: cartel
const carteles = vistas.map(([, v]) => v.crudo.cartel).filter(Boolean);
const V8ok = carteles.length === 6 && carteles.every((c) => c.fraccionAlto <= 0.4 && c.centro > 1 / 3 && c.centro < 2 / 3 && !c.tapaFilaHeroes && c.volverVisible);

// V9: nombres de barras = lo que se dibuja
const veil = vistas.filter(([k]) => k.endsWith('4enemigos_veil')).flatMap(([, v]) => v.crudo.barrasEnemigo.map((b) => b.aria));
const V9ok = veil.length === 12 && veil.every((x) => x === 'Vida de Voz del Velo');

const filas = [
  ['V1', V1ok, `héroe/común ${V1.heroeSobreComun} · jefe/héroe ${V1.jefeSobreHeroe} · común en grupo/héroe ${V1.grupoSobreHeroe} · trasera/delantera ${V1.traseraSobreDelantera}`],
  ['V2', pie <= 12 && sobrePiso && sobreBotones, `pie vs. su carril, peor ${pie.toFixed(2)} px (18 vistas) · carriles ≥ piso del fondo + ${margenPiso} · carril delantero ${margenBotones.toFixed(1)} sobre el borde real de los botones (peor vista)`],
  ['V3', solape === 0 && hud === 0 && cabezas, `solape dentro de una fila ${solape} % · HUD/botones/barras sobre siluetas: ${hud} casos · cabezas bajo las barras · cara tapada por otras filas: máx. ${cara} %`],
  ['V4', V4ok, `${v4.normalPx}/${v4.criticoPx} px · base del número ${r2(v4.cabeza - v4.baseNumero)} px sobre la cabeza · pop ${v4.escalaInicial}→${v4.escala140ms} a 140 ms · sube ${v4.subida840ms} px y desaparece antes de 840 ms · apilado ${v4.apilado} px`],
  ['V5', V5ok, `${nombres.length} nombres de botón a ${Math.min(...nombres.map((n) => n.px))} px sin recorte ni «…» · ${barras.length} nombres de barra sin recorte`],
  ['V6', V6ok, `${caidos.length} caídos a ±90°, alfa ${Math.min(...caidos.map((a) => a.sp.alpha))}, desaturados · barras atenuadas a 0,45`],
  ['V7', V7ok, `tirador hacia la izquierda: flipX ${v7.flipDurante}, ${v7.anguloDurante}° · al terminar flipX ${v7.flipDespues}, ${v7.anguloDespues}°, ${v7.texturaDespues} · guerrero hacia la derecha sin voltear`],
  ['V8', V8ok, `alto ${Math.round(Math.max(...carteles.map((c) => c.fraccionAlto)) * 1000) / 10} % máx. · centro a ${r2(Math.min(...carteles.map((c) => c.centro)))}–${r2(Math.max(...carteles.map((c) => c.centro)))} del alto · no tapa la fila de héroes · «Volver» ≥ 44 px`],
  ['V9', V9ok, `veil_gate: ${veil.length} barras «${veil[0]}» (4 por vista × 3 vistas)`],
];
for (const [v, ok, txt] of filas) console.log(`| ${v} | ${ok ? 'OK' : 'NO'} | ${txt} |`);
console.log('errores de consola/página durante las capturas:', (M.errores || []).length);
process.exitCode = filas.every(([, ok]) => ok) ? 0 : 1;
