import fs from 'node:fs';
const o = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [k, v] of Object.entries(o)) console.log(k, JSON.stringify([v.pctHeroeTapadoPorBotones, v.pctEnemigoTapadoPorBarras, 'btnTop', v.botonesTopMin, 'heroBot', v.heroesBottomMax]));
