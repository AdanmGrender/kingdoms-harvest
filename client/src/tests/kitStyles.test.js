/**
 * ui_kit_b etapa B — sin gradientes en el kit (R29) y clases heredadas intactas (R30).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const KIT = ['Panel', 'Button', 'IconButton', 'Bar', 'PortraitRing'];
const LEGACY = ['.btn-primary', '.btn-gold', '.game-card', '.progress-bar', '.progress-fill'];
const css = read('styles/index.css');

function rule(selector) {
  // Todas las reglas cuyo selector empieza por `selector` (incluye :hover, :active, etc.).
  const re = new RegExp(`(^|\\n)${selector.replace('.', '\\.')}[^{]*\\{[^}]*\\}`, 'g');
  return css.match(re) || [];
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.jsx$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('kit sin gradientes (R29)', () => {
  it.each(KIT)('%s.jsx no usa gradient', (name) => {
    expect(read(`components/ui/${name}.jsx`)).not.toMatch(/gradient/i);
  });

  it('kitPieces.js no usa gradient', () => {
    expect(read('components/ui/kitPieces.js')).not.toMatch(/gradient/i);
  });

  it.each(LEGACY)('regla %s existe y no usa gradient ni @apply con gradient', (sel) => {
    const rules = rule(sel);
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r).not.toMatch(/gradient/i);
  });

  it('las reglas .kh-* tampoco usan gradient', () => {
    const rules = css.match(/(^|\n)\.kh-[^{]*\{[^}]*\}/g) || [];
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r).not.toMatch(/gradient/i);
  });
});

describe('clases heredadas con su nombre (R30)', () => {
  it('siguen usándose en components/ (consumidores intactos)', () => {
    const files = walk(path.join(SRC, 'components')).map((f) => fs.readFileSync(f, 'utf8'));
    for (const cls of ['btn-primary', 'game-card', 'progress-bar', 'progress-fill']) {
      expect(files.some((t) => t.includes(cls)), cls).toBe(true);
    }
  });

  it('usan 9-slice del kit y tokens kh-*', () => {
    expect(rule('.btn-primary').join('')).toMatch(/btn_red\.webp/);
    expect(rule('.btn-gold').join('')).toMatch(/btn_stone\.webp/);
    expect(rule('.progress-bar').join('')).toMatch(/bar_frame\.webp/);
    expect(rule('.game-card').join('')).toMatch(/kh-oak|#2a2119/);
  });
});
