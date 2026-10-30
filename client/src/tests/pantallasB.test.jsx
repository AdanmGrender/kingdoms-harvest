/**
 * pantallas_b T3 — barridos de regresión sobre los archivos en alcance (AA) (R45).
 * Cada barrido falla si se reintroduce un patrón prohibido. Los tests de render por
 * pantalla (T4–T9) se agregan al final de este archivo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// Archivos en alcance (design.md §5).
export const AA = [
  'components/menu/MainMenu.jsx',
  'components/overlay/HeroPanel.jsx',
  'components/overlay/SystemMapPanel.jsx',
  'components/overlay/GalaxyMapPanel.jsx',
  'components/overlay/WarPanel.jsx',
  'components/overlay/MissionsPanel.jsx',
  'components/overlay/SettingsPanel.jsx',
  'components/castle/TechTreePanel.jsx',
  'components/world/TerritoryMapPanel.jsx',
  'components/campaign/CombatInstancePanel.jsx',
  'components/ui/NotificationPrefsPanel.jsx',
];

const sweep = (re) => AA.flatMap((f) => {
  const hits = [];
  read(f).split(/\r?\n/).forEach((line, i) => { if (re.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`); });
  return hits;
});

// Los patrones se arman por partes para que este archivo no se auto-detecte.
const V = 'v'; // vh / vw
const RE_VIEWPORT = new RegExp(`(\\d\\s*(d|s)?${V}[hw]\\b)|\\b(min-|max-)?[hw]-screen\\b`);
const RE_GLYPH = /[\u2715\u2713]/;
const RE_LEGACY_BTN = /btn-gold|btn-primary|bg-gradient-to-/;
const RE_TW_COLOR = /(text|bg|border|from|to|ring|accent)-(purple|cyan|teal|green|blue|gray|red|yellow)-/;
const RE_HEX = /#16a34a|#4ade80|#4fd8c8|#a855f7|#3b82f6/i;
const RE_BORDER_RGBA = /border:\s*'1px solid rgba\(/;

describe('pantallasB — barridos sobre AA', () => {
  it('R1: sin unidades de viewport ni h-screen/w-screen', () => {
    expect(sweep(RE_VIEWPORT)).toEqual([]);
  });

  it('R8: sin los glifos de cierre/check', () => {
    expect(sweep(RE_GLYPH)).toEqual([]);
  });

  it('R9: sin btn-gold / btn-primary / bg-gradient-to-', () => {
    expect(sweep(RE_LEGACY_BTN)).toEqual([]);
  });

  it('R10: sin colores Tailwind fuera de los tokens kh ni hex prohibidos', () => {
    expect(sweep(RE_TW_COLOR)).toEqual([]);
    expect(sweep(RE_HEX)).toEqual([]);
  });

  it('R7: ningún panel define su propio borde rgba', () => {
    expect(sweep(RE_BORDER_RGBA)).toEqual([]);
  });

  it('R38: ni #16a34a ni #4ade80 en AA', () => {
    expect(sweep(/#16a34a|#4ade80/i)).toEqual([]);
  });
});

describe('pantallasB — R2 topes por --kh-frame-h', () => {
  const CAPS = [
    ['components/overlay/GalaxyMapPanel.jsx', '0.8'],
    ['components/overlay/SystemMapPanel.jsx', '0.8'],
    ['components/overlay/HeroPanel.jsx', '0.75'],
    ['components/overlay/MissionsPanel.jsx', '0.75'],
    ['components/overlay/SettingsPanel.jsx', '0.75'],
    ['components/overlay/WarPanel.jsx', '0.65'],
    ['components/ui/NotificationPrefsPanel.jsx', '0.8'],
    ['components/campaign/CombatInstancePanel.jsx', '0.36'],
    ['components/campaign/CombatInstancePanel.jsx', '0.29'],
  ];
  it.each(CAPS)('%s usa calc(var(--kh-frame-h) * %s)', (file, k) => {
    const re = new RegExp(`calc\\(var\\(--kh-frame-h\\)\\s*\\*\\s*${k.replace('.', '\\.')}\\)`);
    expect(read(file)).toMatch(re);
  });
});

describe('pantallasB — R25 fondos viejos', () => {
  function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'tests') walk(full, out); } else if (/\.(jsx?|css)$/.test(e.name)) out.push(full);
    }
    return out;
  }
  it('client/src no referencia menu_bg / system_bg / galaxy_bg / world_map_bg', () => {
    const re = /(menu|system|galaxy|world_map)_bg\.png/;
    const hits = walk(SRC).filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
    expect(hits).toEqual([]);
  });
});
