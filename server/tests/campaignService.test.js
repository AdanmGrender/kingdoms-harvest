const { CAMPAIGN } = require('../../shared/gameConfig');

describe('CAMPAIGN config', () => {
  test('ids únicos y unlocks referencian nodos válidos', () => {
    const ids = CAMPAIGN.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    const idSet = new Set(ids);
    for (const n of CAMPAIGN) {
      for (const u of n.unlocks) expect(idSet.has(u)).toBe(true);
    }
  });
  test('el primer nodo no requiere nada y hay al menos un boss', () => {
    expect(CAMPAIGN[0].requires).toEqual([]);
    expect(CAMPAIGN.some((n) => n.type === 'boss')).toBe(true);
  });
  test('todo nodo de combate tiene enemy + maxRounds', () => {
    for (const n of CAMPAIGN.filter((x) => ['combat', 'wave', 'boss'].includes(x.type))) {
      expect(n.enemy.hp).toBeGreaterThan(0);
      expect(n.enemy.dps).toBeGreaterThan(0);
      expect(n.maxRounds).toBeGreaterThan(0);
    }
  });
});
