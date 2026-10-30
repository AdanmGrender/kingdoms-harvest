const { HEROES, HERO_PASSIVE_FX, COMBAT_FX, COMBAT } = require('../../shared/gameConfig');

// F14 (combate_pasivas_estados) — datos de pasivas. Los literales son el texto
// aprobado de `passive` (design.md §4.2): el texto NO cambia (R2).
const PASSIVE_TEXT = {
  aria: 'Fuego Certero: +15% ATK al atacar con ventaja numérica',
  thorin: 'Bastión: +30% DEF cuando HP < 50%',
  lyra: 'Don Brujo: sus hechizos ignoran 10% de DEF enemiga',
  zara: 'Maldición del Vacío: −20% ATK al enemigo objetivo durante 2 turnos',
  finn: 'Tiro Preciso: +20% ATK contra enemigos a distancia',
  elena: 'Evasión: 15% de esquivar ataques cuerpo a cuerpo',
  viktor: 'Aura Protectora: aliados adyacentes +10% DEF',
  seraph: 'Letanía de Hierro: restaura 8% HP al inicio de cada ronda',
  shadow: 'Golpe Silencioso: primer ataque hace +40% daño',
  vex: 'Ráfaga Doble: 25% de golpear dos veces por turno',
  varok: 'Asalto Imparable: +25% ATK durante la primera ronda de cada combate',
  morghal: 'Carne Putrefacta: regenera 5% HP por ronda; quien lo golpea queda envenenado (−5% ATK)',
  azyra: 'Presciencia del Vacío: prevé los golpes — 20% de esquivar y +10% de probabilidad de crítico',
  fenn: 'Frenesí Feral: +8% ATK acumulativo por ronda de combate (máx +40%)',
  kryx: 'Fragua al Rojo: cada 3 rondas su siguiente descarga hace +60% daño',
  serafina: 'Fe Inquebrantable: escudo de fe grupal que absorbe 15% del daño recibido cada ronda',
  gorr: 'Golpe Aplastante: 20% de aturdir al objetivo, que pierde su siguiente ataque',
  nyx: 'Sentencia Silenciosa: ejecuta enemigos bajo 15% HP y hace +50% daño a objetivos heridos',
};

const TRIGGERS = ['stat', 'attack', 'defend', 'roundStart'];
const EFFECTS = ['atkMod', 'atkModPerRound', 'defMod', 'ignoreDef', 'dmgMult', 'crit', 'dodge', 'extraHit',
  'heal', 'applyStatus', 'execute', 'charge'];
const CONDS = ['numAdvantage', 'selfHpBelow', 'isSkill', 'targetRanged', 'attackerMelee', 'allyAdjacent',
  'roundEq', 'roundMultiple', 'firstAttack', 'charged', 'targetWounded', 'targetHpBelow'];
const SCOPES = ['self', 'allies', 'adjacent', 'target', 'attacker'];

describe('texto de las pasivas (R2) — uno por héroe', () => {
  test.each(Object.keys(PASSIVE_TEXT))('%s: el texto passive no cambia', (id) => {
    expect(HEROES[id].passive).toBe(PASSIVE_TEXT[id]);
  });
});

describe('forma de los datos', () => {
  test('HEROES conserva las claves por héroe (R3) y son 18', () => {
    expect(Object.keys(HEROES)).toHaveLength(18);
    for (const h of Object.values(HEROES)) {
      expect(Object.keys(h).sort()).toEqual(['baseStats', 'class', 'id', 'name', 'passive', 'rarity', 'sprite']);
    }
  });

  test('HERO_PASSIVE_FX y HEROES tienen las mismas 18 claves (R1)', () => {
    expect(Object.keys(HERO_PASSIVE_FX).sort()).toEqual(Object.keys(HEROES).sort());
    expect(Object.keys(PASSIVE_TEXT).sort()).toEqual(Object.keys(HEROES).sort());
    for (const arr of Object.values(HERO_PASSIVE_FX)) {
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBeGreaterThan(0);
    }
  });

  test('esquema: enums de trigger/effect/cond.k/scope y campos requeridos', () => {
    const num = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
    for (const [id, arr] of Object.entries(HERO_PASSIVE_FX)) {
      expect(HEROES[id]).toBeDefined();
      for (const e of arr) {
        expect(TRIGGERS).toContain(e.trigger);
        expect(EFFECTS).toContain(e.effect);
        const conds = e.cond === undefined ? [] : Array.isArray(e.cond) ? e.cond : [e.cond];
        for (const c of conds) expect(CONDS).toContain(c.k);
        if (e.scope !== undefined) expect(SCOPES).toContain(e.scope);
        if (e.chance !== undefined) { expect(e.chance).toBeGreaterThan(0); expect(e.chance).toBeLessThanOrEqual(1); }
        switch (e.effect) {
          case 'atkMod': case 'atkModPerRound': case 'defMod': case 'ignoreDef': case 'heal':
          case 'dmgMult':
            expect(num(e.value)).toBe(true); break;
          case 'applyStatus':
            expect(num(e.value)).toBe(true);
            expect(Number.isInteger(e.dur) && e.dur >= 1).toBe(true);
            expect(COMBAT_FX.statusTypes).toContain(e.type);
            if (e.type === 'shield') expect(['pct', 'pool']).toContain(e.mode);
            break;
          case 'dodge': case 'crit': case 'extraHit':
            expect(num(e.chance)).toBe(true); break;
          default: break;
        }
        if (e.effect === 'atkModPerRound') expect(num(e.cap)).toBe(true);
        if (e.effect === 'dodge' || e.effect === 'crit') expect(['defend', 'attack']).toContain(e.trigger);
      }
      expect(id).toBeTruthy();
    }
  });

  test('COMBAT_FX: forma y COMBAT intacto (engineVersion 1)', () => {
    expect(COMBAT_FX.statusTypes).toEqual(['stun', 'burn', 'poison', 'defDown', 'atkDown', 'shield', 'immune']);
    expect(COMBAT_FX.controlTypes).toEqual(['stun']);
    expect(COMBAT_FX.critMult).toBe(1.5);
    expect(COMBAT_FX.dotMinDamage).toBe(1);
    expect(COMBAT_FX.rangedValue).toBe('ranged');
    expect(Object.keys(COMBAT).sort()).toEqual(['defK', 'engineVersion', 'threat']);
    expect(COMBAT.engineVersion).toBe(1);
  });

  test('valores de balance de las 18 pasivas = texto (design §4.2)', () => {
    const f = HERO_PASSIVE_FX;
    expect(f.aria[0]).toMatchObject({ effect: 'atkMod', value: 0.15 });
    expect(f.thorin[0]).toMatchObject({ effect: 'defMod', value: 0.30, cond: { k: 'selfHpBelow', v: 0.5 } });
    expect(f.lyra[0]).toMatchObject({ effect: 'ignoreDef', value: 0.10 });
    expect(f.zara[0]).toMatchObject({ type: 'atkDown', value: 0.20, dur: 2, scope: 'target' });
    expect(f.finn[0]).toMatchObject({ effect: 'atkMod', value: 0.20 });
    expect(f.elena[0]).toMatchObject({ effect: 'dodge', chance: 0.15 });
    expect(f.viktor[0]).toMatchObject({ effect: 'defMod', value: 0.10, scope: 'adjacent' });
    expect(f.seraph[0]).toMatchObject({ effect: 'heal', value: 0.08 });
    expect(f.shadow[0]).toMatchObject({ effect: 'dmgMult', value: 1.40 });
    expect(f.vex[0]).toMatchObject({ effect: 'extraHit', chance: 0.25 });
    expect(f.varok[0]).toMatchObject({ effect: 'atkMod', value: 0.25, cond: { k: 'roundEq', v: 1 } });
    expect(f.morghal).toHaveLength(2);
    expect(f.morghal[0]).toMatchObject({ effect: 'heal', value: 0.05 });
    expect(f.morghal[1]).toMatchObject({ type: 'atkDown', value: 0.05, dur: 2, scope: 'attacker' });
    expect(f.azyra).toHaveLength(2);
    expect(f.azyra[0]).toMatchObject({ effect: 'dodge', chance: 0.20 });
    expect(f.azyra[1]).toMatchObject({ effect: 'crit', chance: 0.10 });
    expect(f.fenn[0]).toMatchObject({ effect: 'atkModPerRound', value: 0.08, cap: 0.40 });
    expect(f.kryx).toHaveLength(2);
    expect(f.kryx[0]).toMatchObject({ effect: 'charge', cond: { k: 'roundMultiple', v: 3 } });
    expect(f.kryx[1]).toMatchObject({ effect: 'dmgMult', value: 1.60 });
    expect(f.serafina[0]).toMatchObject({ type: 'shield', mode: 'pct', value: 0.15, dur: 1, scope: 'allies' });
    expect(f.gorr[0]).toMatchObject({ type: 'stun', dur: 1, chance: 0.20, scope: 'target' });
    expect(f.nyx).toHaveLength(2);
    expect(f.nyx[0]).toMatchObject({ effect: 'execute', cond: { k: 'targetHpBelow', v: 0.15 } });
    expect(f.nyx[1]).toMatchObject({ effect: 'dmgMult', value: 1.50 });
  });
});
