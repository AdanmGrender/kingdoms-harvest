// Resume reporte_<motor>.json (capturar_combate.mjs). Uso: node resumen.mjs <reporte.json>
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const f = (m) => [`barras=${m.barrasEnemigo}`, `tapaAvanzar=${m.barrasTapanAvanzar}`, `tapaBotonesHud=${m.barrasTapanBotonesHud}`, `tapaHeroes=${m.barrasTapanHeroesSprites}`,
  `solapaZonaEnemigos=${m.barrasSolapanZonaEnemigos}`, `botones<44=${m.botonesBajo44.length}`, `barras.bottom=${m.cajaBarras && m.cajaBarras.b}`, `heroes.top=${m.zonaHeroes && m.zonaHeroes.top}`, `avanzar.y=${m.cajaAvanzar && m.cajaAvanzar.y}`].join(' ');
console.log('motor', r.motor, 'resultado', r.resultado, 'rondas', r.rondas.length, 'duracionS', r.duracionS);
console.log('inicio  ', f(r.medidasInicio));
console.log('fin     ', f(r.medidasFin));
for (const [k, v] of Object.entries(r.botones || {})) console.log('vp', k, JSON.stringify(v.entrada), f(v));
for (const [k, v] of Object.entries(r.veil || {})) console.log('veil', k, f(v));
console.log('errores combate', JSON.stringify(r.erroresCombate));
console.log('errores veil sintético', JSON.stringify(r.erroresVeilSintetico));
