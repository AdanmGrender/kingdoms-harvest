/**
 * ui_kit_b etapa C1 (T18) — hoja de íconos B: constantes ↔ imagen, contrato de 65 nombres,
 * celdas no vacías, kh_token único y enemigos legacy (R38, R39, R40, R45, R46).
 *
 * Es el test ROJO de la etapa: valida lo que hay integrado en `client/` y se pone verde con T23
 * (tras la aprobación de p-kh, R43). El candidato vive en art-b/uikit/candidate hasta entonces.
 * Lee el webp con `sharp` (raíz del repo): correr con NODE_PATH al node_modules que lo tenga.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  GRIM_SHEET, GRIM_SHEET_W, GRIM_SHEET_H, GRIM_CELL, GRIM_ICONS,
} from '../config/grimIconSheet.generated';
import { getSprite, GRIM_ALIASES, GAME_SPRITE_ALIASES } from '../utils/spriteMap';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, '../../public');
const sharp = createRequire(import.meta.url)('sharp');

const COLS = 8;
// 65 nombres contrato congelados (git show ab85126:client/src/config/grimIconSheet.generated.js), en orden de celda.
const CONTRACT = [
  'gold', 'wood', 'stone', 'iron', 'wheat', 'water', 'bread', 'kh_token',
  'crystal', 'relic', 'blueprint', 'carrot', 'potato', 'tomato', 'corn', 'pumpkin',
  'grape', 'egg', 'milk', 'wool', 'chicken', 'sheep', 'cow', 'castle',
  'farmhouse', 'market', 'tower', 'barracks', 'tavern', 'mill', 'wall', 'trap',
  'stable', 'sawmill', 'barn', 'sword', 'bow', 'spear', 'ram', 'horse',
  'crown', 'scroll', 'medal', 'backpack', 'reward_bag', 'exclamation', 'gear', 'caravan',
  'flame', 'wallet', 'map', 'heart', 'star', 'check', 'gem', 'star_currency',
  'speedup', 'enemy_carroneros', 'enemy_brutos', 'enemy_aullador', 'enemy_coloso', 'enemy_boss_devorador',
  'enemy_boss_heraldo', 'tide', 'skull',
];
const NEW_NAMES = ['shield', 'hammer', 'sun', 'moon', 'alliance', 'rankings', 'quests', 'tech', 'world',
  'mine', 'smithy', 'library', 'embassy', 'farm_plot'];

let meta;
let raw;
async function loadSheet() {
  if (!raw) {
    const file = path.join(PUBLIC, GRIM_SHEET.replace(/^\//, ''));
    const img = sharp(file).ensureAlpha();
    meta = await sharp(file).metadata();
    raw = await img.raw().toBuffer();
  }
  return { meta, raw };
}

describe('iconSheet — constantes ↔ imagen (R38)', () => {
  it('apunta a b/ui/icons.webp con celda 192 y 8 columnas', () => {
    expect(GRIM_SHEET).toBe('/assets/b/ui/icons.webp');
    expect(GRIM_CELL).toBe(192);
    expect(GRIM_SHEET_W).toBe(COLS * GRIM_CELL);
  });

  it('GRIM_SHEET_W/H coinciden con las dimensiones reales del webp', async () => {
    const { meta: m } = await loadSheet();
    expect(m.width).toBe(GRIM_SHEET_W);
    expect(m.height).toBe(GRIM_SHEET_H);
    expect(GRIM_SHEET_H % GRIM_CELL).toBe(0);
  });
});

describe('iconSheet — contrato de nombres (R39)', () => {
  it('conserva los 65 nombres contrato con su misma { col, row }', () => {
    expect(CONTRACT).toHaveLength(65);
    CONTRACT.forEach((name, i) => {
      expect(GRIM_ICONS[name], name).toEqual({ col: i % COLS, row: Math.floor(i / COLS) });
    });
  });

  it('los nombres nuevos van solo al final (índice de celda posterior al contrato)', () => {
    NEW_NAMES.forEach((name) => {
      const c = GRIM_ICONS[name];
      expect(c, name).toBeDefined();
      expect(c.row * COLS + c.col, name).toBeGreaterThanOrEqual(CONTRACT.length);
    });
    expect(Object.keys(GRIM_ICONS)).toEqual([...CONTRACT, ...NEW_NAMES]);
  });

  it('ninguna celda se repite', () => {
    const cells = Object.values(GRIM_ICONS).map((c) => `${c.col},${c.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

describe('iconSheet — celdas dentro de límites y no vacías (R40)', () => {
  it('cada celda cae dentro de la hoja y tiene píxeles no transparentes', async () => {
    const { meta: m, raw: buf } = await loadSheet();
    const rows = m.height / GRIM_CELL;
    const vacias = [];
    for (const [name, { col, row }] of Object.entries(GRIM_ICONS)) {
      expect(col, name).toBeLessThan(COLS);
      expect(row, name).toBeLessThan(rows);
      let opacos = 0;
      for (let y = 0; y < GRIM_CELL; y++) {
        for (let x = 0; x < GRIM_CELL; x++) {
          const p = ((row * GRIM_CELL + y) * m.width + col * GRIM_CELL + x) * 4 + 3;
          if (buf[p] > 16) opacos++;
        }
      }
      if (opacos < GRIM_CELL * GRIM_CELL * 0.02) vacias.push(name);
    }
    expect(vacias).toEqual([]);
  });
});

describe('iconSheet — kh_token único (R45)', () => {
  it('nav_token ya no es alias y ningún alias apunta a kh_token', () => {
    expect(GRIM_ALIASES.nav_token).toBeUndefined();
    expect(Object.values(GRIM_ALIASES)).not.toContain('kh_token');
  });

  it('ningún otro nombre resuelve a la celda de kh_token', () => {
    const kh = getSprite('kh_token');
    expect(kh).toBeTruthy();
    const nombres = new Set([
      ...Object.keys(GRIM_ICONS), ...Object.keys(GRIM_ALIASES), ...Object.keys(GAME_SPRITE_ALIASES),
    ]);
    const comparten = [...nombres].filter((n) => {
      if (n === 'kh_token') return false;
      const s = getSprite(n);
      return s && s.sheet === kh.sheet && s.x === kh.x && s.y === kh.y;
    });
    expect(comparten).toEqual([]);
  });
});

describe('iconSheet — enemigos legacy (R46)', () => {
  it.each(['enemy_carroneros', 'enemy_brutos', 'enemy_aullador', 'enemy_coloso', 'enemy_boss_devorador', 'enemy_boss_heraldo'])(
    '%s resuelve desde la tira enemy_icons_legacy.png', (name) => {
      const s = getSprite(name);
      expect(s).toBeTruthy();
      expect(s.sheet).toContain('enemy_icons_legacy.png');
    },
  );

  it('la tira legacy existe', () => {
    expect(fs.existsSync(path.join(PUBLIC, 'assets/sprites/enemy_icons_legacy.png'))).toBe(true);
  });
});
