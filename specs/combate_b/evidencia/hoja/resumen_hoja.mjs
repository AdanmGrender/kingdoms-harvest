// Tabla V1–V9 (y los puntos B1–B5, R31 y H2 de T10.7) a partir de hoja_medidas.json, que escribe
// generar_evidencia_hoja.mjs. Sin red ni navegador. Uso: node resumen_hoja.mjs   (código de salida 0 = todo OK)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M = JSON.parse(fs.readFileSync(path.join(HERE, 'hoja_medidas.json'), 'utf8'));
const ALFA = JSON.parse(fs.readFileSync(path.join(HERE, 'hoja_alfa.json'), 'utf8'));
const vistas = Object.entries(M).filter(([k]) => k !== 'errores');
const r2 = (x) => Math.round(x * 100) / 100;
const vivos = (v) => v.crudo.actores.filter((a) => !a.muerto);
const alto = (v, pred) => vivos(v).filter(pred).map((a) => a.dibujado.alto);
const de = (sufijo) => vistas.filter(([k]) => k.endsWith(sufijo)).map(([, v]) => v);

// V1: altos dibujados (los de los sprites de Phaser, sin la respiración)
const uno = M['412x860_1enemigo']; const jefe = M['412x860_jefe']; const tres = M['412x860_3enemigos']; const cuatro = M['412x860_4enemigos_veil'];
const hF = alto(uno, (a) => a.row === 'HF')[0];
const hB = alto(uno, (a) => a.row === 'HB')[0];
const comun = alto(uno, (a) => a.kind === 'enemy')[0];
const boss = alto(jefe, (a) => a.kind === 'enemy')[0];
const grupo = Math.min(...alto(tres, (a) => a.kind === 'enemy'), ...alto(cuatro, (a) => a.kind === 'enemy'));
const V1 = { heroeSobreComun: r2(hF / comun), jefeSobreHeroe: r2(boss / hF), grupoSobreHeroe: r2(grupo / hF), traseraSobreDelantera: r2(hB / hF) };
const V1ok = V1.heroeSobreComun >= 0.6 && V1.heroeSobreComun <= 0.7 && V1.jefeSobreHeroe >= 1.8 && V1.jefeSobreHeroe <= 2.2 && V1.grupoSobreHeroe >= 0.9 && V1.traseraSobreDelantera >= 0.8 && V1.traseraSobreDelantera <= 0.85;

// V2 (y H2): pie vs. su carril; carriles sobre el piso de su fondo y sobre el borde real de los botones de CADA pantalla
const pie = Math.max(...vistas.map(([, v]) => v.V2.piePeorDesvio));
const sobrePiso = vistas.every(([, v]) => v.V2.sobrePiso);
const sobreBotones = vistas.every(([, v]) => v.V2.sobreBotones);
const margenPiso = Math.min(...vistas.map(([, v]) => v.V2.carrilMinimo - v.V2.piso));
const margenBotones = Math.min(...vistas.map(([, v]) => v.V2.botonesTopMundo - v.V2.carrilMaximo));
const hfPorPantalla = Object.fromEntries(['412x860', '360x800', '1280x800', '360x740', '375x667'].map((vp) => [vp, M[`${vp}_1enemigo`].V2.carriles.HF]));

// V3: solape dentro de fila (de pie y tendidos, B3), HUD sobre siluetas, cabezas bajo barras, cara tapada
const solape = Math.max(...vistas.map(([, v]) => v.V3.solapeMaxDentroDeFila));
const solapeTendidos = Math.max(...vistas.map(([, v]) => v.V3.solapeMaxTendidos));
const cabezaSobreCabeza = vistas.some(([, v]) => v.V3.cabezaSobreCabeza);
const hud = vistas.reduce((s, [, v]) => s + v.V3.hudSobreSiluetas.length, 0);
const cabezas = vistas.every(([, v]) => v.V3.cabezaBajoBarras);
const cara = Math.max(...vistas.map(([, v]) => v.caraTapadaMax));

// V4 y V7/B5 (vistas de 1 enemigo, en las 5 pantallas) y R31
const dyn = de('_1enemigo');
const v4s = dyn.map((v) => v.v4);
// apilado: en la misma columna, 4 px CSS sobre el alto real del anterior; si arriba no cabe en el lienzo, columna al
// lado sin cruzarse (hueco horizontal ≥ 4); nunca se pisan, ni en la ráfaga ni en los golpes escalonados (cada cuadro)
const parOk = (p) => (p.columna === 'misma' ? Math.abs(p.huecoCss - 4) < 0.6 : p.huecoCss >= 3.4);
const V4ok = v4s.every((d) => d.normalCss >= 36 && d.normalCss <= 44 && d.criticoCss >= 56 && d.criticoCss <= 64 && d.sobreLaCabeza
  && d.escalaInicial === 1.4 && d.escala140ms === 1 && Math.abs(d.subidaCss840ms - 60) < 1 && !d.vivoA840ms
  && d.pares.every(parOk) && !d.pisanAlNacer && !d.pisanA140ms && d.escalonado.cuadrosConPisada === 0);
const VPN = ['412x860', '360x800', '1280x800', '360x740', '375x667'];
const paresTxt = v4s.map((d, i) => `${VPN[i]}: ${d.pares.map((p) => `${p.columna === 'misma' ? '↑' : '→'}${p.huecoCss}`).join(' ')}`).join(' · ');
const v7s = dyn.map((v) => v.v7);
// el tirador dibuja el cuadro de la textura que termina en la boca del arma (nunca un setCrop, que Phaser espeja al voltear)
const V7ok = v7s.every((d) => d.flipDurante && d.anguloDurante > 0 && d.anguloDurante <= 30 && d.cuadroDurante === 'sin_fogonazo'
  && !d.recorteDurante && d.estelaHastaObjetivo && d.bocaSobreCompañero.length === 0 && !d.flipDespues && d.anguloDespues === 0
  && d.cuadroDespues === '__BASE' && !d.recorteDespues && !d.h1FlipDurante
  && d.profundidad && d.profundidad.estela < d.profundidad.heroeMin && d.profundidad.proyectil < d.profundidad.heroeMin
  && d.profundidad.estela > d.profundidad.enemigoMax && d.profundidad.fogonazo > d.profundidad.tirador);
const fueraTirador = v7s.map((d) => Math.max(0, d.siluetaX.hi - 824, -d.siluetaX.lo));
const r31 = dyn.map((v) => v.r31);
const R31ok = r31.every((d) => d.cuadrosConMarcador === 0 && !d.texturasVistas.some((t) => t.startsWith('ph:')));

// V5: nombres
const nombres = vistas.flatMap(([, v]) => v.crudo.nombres);
const barras = vistas.flatMap(([, v]) => v.crudo.barrasEnemigo);
const V5ok = nombres.every((n) => !n.recortado && n.px >= 11 && !/…/.test(n.texto)) && barras.every((b) => !b.recortado && !/…/.test(b.nombre));

// V6: caídos (derrota: héroes; victoria: enemigos)
const caidos = vistas.filter(([k]) => /derrota|victoria/.test(k)).flatMap(([, v]) => v.crudo.actores.filter((a) => a.muerto));
const V6ok = caidos.length > 0 && caidos.every((a) => Math.abs(a.sp.angle) === 90 && a.sp.alpha >= 0.8 && a.sp.gris)
  && vistas.filter(([k]) => /derrota/.test(k)).every(([, v]) => v.crudo.barrasHeroe.every((b) => b.muerta && b.opacidad === '0.45'))
  && vistas.filter(([k]) => /victoria/.test(k)).every(([, v]) => v.crudo.barrasEnemigo.every((b) => b.muerta && b.opacidad === '0.45'));

// V8 y B1/B2: cartel
const carteles = vistas.map(([k, v]) => [k, v.crudo.cartel]).filter(([, c]) => c);
const victorias = carteles.filter(([k]) => /victoria/.test(k));
const derrotas = carteles.filter(([k]) => /derrota/.test(k));
const V8ok = carteles.length === 40 && carteles.every(([, c]) => c.compacto && c.alto <= 70 && c.fraccionAlto <= 0.4 && c.centro > 1 / 3 && c.centro < 2 / 3
  && !c.tapaFilaHeroes && !c.tapaBarras && c.volverVisible);
const B1ok = victorias.length === 20 && victorias.every(([, c]) => Object.keys(c.sobreSiluetas).length === 0 && Math.abs(c.centro - 0.34) <= 0.02);
const B2ok = derrotas.length === 20 && derrotas.every(([, c]) => Object.keys(c.sobreSiluetas).every((id) => id.startsWith('e')) && Object.keys(c.sobreCaras).length === 0);
const centrosVictoria = victorias.map(([, c]) => c.centro * 100);
const centrosDerrota = derrotas.map(([, c]) => c.centro * 100);

// B4: pies de los enemigos en crypt (los de pie), contra el altar (x > 71 %) y el carro (x < 16,5 %) en el mundo
const piesEnemigo = (a) => {
  const g = ALFA[`enemies/${a.art}_idle`];
  const s = a.dibujado.alto / g.H;
  return { x0: a.cx + (g.pl - g.W / 2) * s, x1: a.cx + (g.pr + 1 - g.W / 2) * s };
};
const piesCrypt = vistas.filter(([k, v]) => v.crudo.bg === 'crypt' && !/victoria/.test(k)).flatMap(([, v]) => vivos(v).filter((a) => a.kind === 'enemy').map(piesEnemigo));
const ALTAR = 618.9; const CARRO = 77.5;   // bgImageColToWorldX(0.71).min y (0.165).max
const B4ok = piesCrypt.length > 0 && piesCrypt.every((p) => p.x1 <= ALTAR && p.x0 >= CARRO);

// V9: nombres de barras = lo que se dibuja
const veil = vistas.filter(([k]) => /4enemigos_veil/.test(k)).flatMap(([, v]) => v.crudo.barrasEnemigo.map((b) => b.aria));
const V9ok = veil.length > 0 && veil.every((x) => x === 'Vida de Voz del Velo');

const fmt = (xs) => `${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)} %`;

// H-c: factor de la formación (1 en las pantallas de la hoja; < 1 solo donde no entra, 375×611)
const deLaHoja = vistas.filter(([k]) => !k.startsWith('375x611_'));
const bajas611 = vistas.filter(([k]) => k.startsWith('375x611_'));
const HCok = deLaHoja.length === 60 && deLaHoja.every(([, v]) => v.crudo.factor === 1) && bajas611.length === 3
  && bajas611.every(([, v]) => v.crudo.factor > 0 && v.crudo.factor <= 1 && v.V2.sobreBotones && v.V2.sobrePiso && v.V3.hudSobreSiluetas.length === 0
    && v.V3.cabezaBajoBarras && v.V3.solapeMaxDentroDeFila === 0);
const filas = [
  ['V1', V1ok, `héroe/común ${V1.heroeSobreComun} · jefe/héroe ${V1.jefeSobreHeroe} · común en grupo/héroe ${V1.grupoSobreHeroe} · trasera/delantera ${V1.traseraSobreDelantera}`],
  ['V2', pie <= 12 && sobrePiso && sobreBotones, `pie vs. su carril, peor ${pie.toFixed(2)} px (${vistas.length} vistas) · carriles ≥ piso del fondo + ${margenPiso} · el carril más bajo queda ${margenBotones.toFixed(1)} sobre el borde real de los botones de su pantalla (peor vista) · HF por pantalla ${JSON.stringify(hfPorPantalla)}`],
  ['V3', solape === 0 && hud === 0 && cabezas && solapeTendidos <= 10 && !cabezaSobreCabeza, `solape dentro de una fila ${solape} % (de pie) y ${solapeTendidos} % (tendidos, B3), sin cabeza sobre cabeza · HUD/botones/barras sobre siluetas: ${hud} casos · cabezas bajo las barras · cara tapada por otras filas: máx. ${cara} %`],
  ['V4', V4ok, `${v4s.map((d) => `${d.normalCss.toFixed(1)}/${d.criticoCss.toFixed(1)}`).join(', ')} px CSS (normal/crítico, 5 pantallas) · base del número sobre la cabeza · pop 1,4→1 a 140 ms · sube ${v4s[0].subidaCss840ms} px CSS y desaparece antes de 840 ms · ráfaga 37 / 96! / 52, hueco en px CSS (↑ apilado sobre el alto real del anterior, → columna al lado): ${paresTxt} · sin pisarse al nacer ni a 140 ms · golpes escalonados (+0, +250 ×2, +500 ms): ${v4s.reduce((n, d) => n + d.escalonado.cuadros, 0)} cuadros, ${v4s.reduce((n, d) => n + d.escalonado.cuadrosConPisada, 0)} con números pisados · nacen fuera del lienzo: ${v4s.map((d) => d.asomanArribaAlNacer).join('/')}, bajo las barras de vida: ${v4s.map((d) => d.bajoLasBarrasAlNacer).join('/')}`],
  ['V5', V5ok, `${nombres.length} nombres de botón a ${Math.min(...nombres.map((n) => n.px))} px sin recorte ni «…» · ${barras.length} nombres de barra sin recorte`],
  ['V6', V6ok, `${caidos.length} caídos a ±90°, alfa ${Math.min(...caidos.map((a) => a.sp.alpha))}, desaturados · barras atenuadas a 0,45`],
  ['V7', V7ok, `tirador hacia la izquierda: flipX, ${v7s.map((d) => d.anguloDurante).join('/')}° (tope 30), cuadro «${v7s[0].cuadroDurante}» de ${v7s[0].anchoCuadroDurante} px (sin el fogonazo pintado, cuerpo a la vista), estela de la boca al objetivo, boca fuera de toda silueta de su bando · estela y proyectil por detrás de toda la fila de héroes (profundidad ${v7s[0].profundidad.estela} < ${v7s[0].profundidad.heroeMin}) y por delante de los enemigos (> ${v7s[0].profundidad.enemigoMax}), fogonazo delante del tirador · silueta inclinada fuera del lienzo: ${fueraTirador.map((x) => x.toFixed(0)).join('/')} px de mundo (corrida ${v7s.map((d) => Math.round(-d.corrimiento)).join('/')} px hacia adentro, hasta pegar la boca a Sombra) · al terminar vuelve a idle, 0°, cuadro entero · guerrero hacia la derecha sin voltear`],
  ['V8', V8ok, `40 carteles compactos de ${Math.min(...carteles.map(([, c]) => c.alto)).toFixed(0)}–${Math.max(...carteles.map(([, c]) => c.alto)).toFixed(0)} px CSS (≤ 70) · centro de victoria ${fmt(centrosVictoria)}, de derrota ${fmt(centrosDerrota)} (tercio medio) · no tapa la fila de botones ni las barras · «Volver» ≥ 44 px`],
  ['V9', V9ok, `veil_gate: ${veil.length} barras «${veil[0]}»`],
  ['B1', B1ok, `victoria (4 formaciones × 5 pantallas): el cartel no toca ninguna silueta, ni héroes ni enemigos caídos · centro ${fmt(centrosVictoria)} del marco del panel`],
  ['B2', B2ok, `derrota (4 formaciones × 5 pantallas): el cartel no toca a los héroes tendidos, ni los botones, y no corta ninguna cara (tapa enemigos vivos en ${derrotas.filter(([, c]) => Object.keys(c.sobreSiluetas).length).length} de 20, permitido) · centro ${fmt(centrosDerrota)}`],
  ['B4', B4ok, `crypt: ${piesCrypt.length} pies de enemigos entre el carro (${CARRO}) y el altar (${ALTAR}); el más a la derecha llega a ${Math.max(...piesCrypt.map((p) => p.x1)).toFixed(1)}`],
  ['H-c', HCok, `factor 1 en las ${deLaHoja.length} vistas de las 5 pantallas · marco de 611 (375×611): ${bajas611.map(([k, v]) => `${k.replace('375x611_', '')} ${v.crudo.factor} (HF ${v.crudo.lanes.HF}, ${Object.entries(v.crudo.lanes).filter(([x]) => x !== 'HF').map(([x, y]) => `${x} ${y}`).join(', ')})`).join(' · ')}, sin pies bajo los botones, sobre el piso, cabezas bajo las barras y sin solape en la fila`],
  ['R31', R31ok, `${r31.reduce((s, d) => s + d.cuadros, 0)} cuadros con los 5 héroes golpeados (5 pantallas): ${r31.reduce((s, d) => s + d.cuadrosConMarcador, 0)} con marcador`],
];
for (const [v, ok, txt] of filas) console.log(`| ${v} | ${ok ? 'OK' : 'NO'} | ${txt} |`);
console.log('errores de consola/página durante las capturas:', (M.errores || []).length);
process.exitCode = filas.every(([, ok]) => ok) ? 0 : 1;
