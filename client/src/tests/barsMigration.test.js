/**
 * ui_kit_b etapa B (T16) — las cinco barras de progreso migraron a <Bar> (R35, R37).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const C = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../components');
const FILES = [
  'overlay/GameHUD.jsx',
  'hud/ConstructionTimer.jsx',
  'overlay/AchievementPanel.jsx',
  'meta/AchievementsPanel.jsx',
  'campaign/CombatInstancePanel.jsx',
];

describe('barras migradas a Bar', () => {
  it.each(FILES)('%s importa y usa <Bar>, sin relleno de barra propio con width inline', (f) => {
    const src = fs.readFileSync(path.join(C, f), 'utf8');
    expect(src).toMatch(/import Bar from '..\/ui\/Bar'/);
    expect(src).toMatch(/<Bar /);
    expect(src).not.toMatch(/style=\{\{\s*width:\s*`\$\{/);
  });

  it('GenericPanel usa Panel (oak) con onClose', () => {
    const src = fs.readFileSync(path.join(C, 'overlay/OverlayManager.jsx'), 'utf8');
    expect(src).toMatch(/function GenericPanel[\s\S]*?<Panel title=\{title\} onClose=\{onClose\}/);
  });
});
