/**
 * ui_kit_b etapa C3 (T25) — guardia de «cero emojis como íconos» (R49, R50, R54, R55).
 * Barre `components/`, `store/` y `services/` (design §2.6); `game/**`, `config/` y `tests/` quedan fuera.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMOJI_RE, stripComments } from './helpers/emoji';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['components', 'store', 'services'];
const SIZE_MIN = 28;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const FILES = DIRS.flatMap((d) => walk(path.join(SRC, d)));
const rel = (f) => path.relative(SRC, f).replace(/\\/g, '/');

// Lista blanca (R50): los stickers de chat son texto libre que el jugador manda a la alianza,
// no íconos de la UI. Es la única excepción.
const CHAT_STICKERS_RE = /const CHAT_STICKERS = \[[^\]]*\];/;

function readClean(file) {
  let src = fs.readFileSync(file, 'utf8');
  if (rel(file) === 'components/meta/AlliancesPanel.jsx') src = src.replace(CHAT_STICKERS_RE, '');
  return stripComments(src);
}

function spriteIconTags(src) {
  return src.match(/<SpriteIcon\b[\s\S]*?\/>/g) || [];
}

describe('noEmoji (R49, R50)', () => {
  it('barre archivos reales', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('ningún archivo de components/, store/ o services/ tiene emojis fuera de la lista blanca', () => {
    const found = [];
    for (const f of FILES) {
      const m = readClean(f).match(EMOJI_RE);
      if (m) found.push(`${rel(f)}: ${m.length} (${[...new Set(m)].join(' ')})`);
    }
    expect(found).toEqual([]);
  });

  it('la lista blanca es solo CHAT_STICKERS de AlliancesPanel', () => {
    const src = fs.readFileSync(path.join(SRC, 'components/meta/AlliancesPanel.jsx'), 'utf8');
    expect(CHAT_STICKERS_RE.test(src)).toBe(true);
  });
});

describe('SpriteIcon en components/ (R54, R55)', () => {
  it('no se pasa la prop fallback', () => {
    const found = [];
    for (const f of FILES) {
      for (const tag of spriteIconTags(readClean(f))) {
        if (/\bfallback\s*=/.test(tag)) found.push(rel(f));
      }
    }
    expect(found).toEqual([]);
  });

  it(`ningún size literal es menor de ${SIZE_MIN}`, () => {
    const found = [];
    for (const f of FILES) {
      for (const tag of spriteIconTags(readClean(f))) {
        const m = tag.match(/\bsize=\{?\s*(\d+)\s*\}?/);
        if (m && Number(m[1]) < SIZE_MIN) found.push(`${rel(f)}: size=${m[1]}`);
      }
    }
    expect(found).toEqual([]);
  });
});
