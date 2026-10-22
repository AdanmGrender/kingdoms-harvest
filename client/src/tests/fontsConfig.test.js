/**
 * ui_kit_b etapa A — fuentes empaquetadas y tokens (R1–R4, R6–R8, R10, R15).
 * Lee archivos del cliente; no renderiza nada.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindConfig from '../../tailwind.config.js';
import { UI_FONT } from '../game/fonts.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(HERE, '../..');
const SRC = path.join(CLIENT, 'src');
const FONTS_DIR = path.join(CLIENT, 'public/fonts');

const read = (p) => fs.readFileSync(p, 'utf8');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|css|html)$/.test(e.name)) out.push(full);
  }
  return out;
}

// Este archivo contiene las cadenas prohibidas como datos: se excluye del barrido.
const SELF = path.join(SRC, 'tests', 'fontsConfig.test.js');
const sweepFiles = [
  path.join(CLIENT, 'index.html'),
  path.join(CLIENT, 'tailwind.config.js'),
  path.join(FONTS_DIR, 'fonts.css'),
  ...walk(SRC),
].filter((f) => path.resolve(f) !== path.resolve(SELF));

const KH = {
  ink: '#14110d',
  oak: '#2a2119',
  'oak-light': '#3d3024',
  iron: '#4a4a48',
  brass: '#b08d57',
  'brass-light': '#d9b77a',
  bone: '#e6dcc3',
  'bone-dim': '#a89c84',
  parchment: '#d8c8a0',
  'parchment-ink': '#2b1f14',
  seal: '#7a1f1a',
  ember: '#e07b2a',
  macula: '#8fae3a',
};

describe('R1 — sin Google Fonts', () => {
  it('ningún archivo del cliente referencia hosts de fuentes de Google', () => {
    const bad = sweepFiles.filter((f) => /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(read(f)));
    expect(bad).toEqual([]);
  });
});

describe('R2 — index.html', () => {
  it('carga /fonts/fonts.css con un <link rel="stylesheet"> de mismo origen', () => {
    const html = read(path.join(CLIENT, 'index.html'));
    expect(html).toMatch(/<link[^>]+rel="stylesheet"[^>]+href="\/fonts\/fonts\.css"|<link[^>]+href="\/fonts\/fonts\.css"[^>]+rel="stylesheet"/);
  });
});

describe('R3 — fonts.css', () => {
  const css = read(path.join(FONTS_DIR, 'fonts.css'));
  const faces = css.match(/@font-face\s*{[^}]*}/g) || [];

  it('declara exactamente 4 @font-face', () => {
    expect(faces).toHaveLength(4);
  });

  it('declara las 3 familias esperadas con estilo y peso correctos', () => {
    const find = (fam, style, weight) => faces.some((f) =>
      f.includes(`font-family:'${fam}'`) && f.includes(`font-style:${style}`) && f.includes(`font-weight:${weight}`));
    expect(find('IM Fell English', 'normal', 400)).toBe(true);
    expect(find('IM Fell English', 'italic', 400)).toBe(true);
    expect(find('IM Fell English SC', 'normal', 400)).toBe(true);
    expect(find('Alegreya Sans SC', 'normal', 700)).toBe(true);
  });

  it('cada url() existe en disco como woff2 y usa font-display: swap', () => {
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/['"]/g, ''));
    expect(urls).toHaveLength(4);
    for (const u of urls) {
      expect(u.endsWith('.woff2')).toBe(true);
      expect(fs.existsSync(path.join(CLIENT, 'public', u))).toBe(true);
    }
    expect(css.match(/font-display:swap/g)).toHaveLength(4);
  });

  it('R5 — solo quedan los 4 woff2 + fonts.css + README.md', () => {
    expect(fs.readdirSync(FONTS_DIR).sort()).toEqual([
      'AlegreyaSansSC-700.woff2',
      'IMFellEnglish-400.woff2',
      'IMFellEnglish-400i.woff2',
      'IMFellEnglishSC-400.woff2',
      'README.md',
      'fonts.css',
    ]);
  });
});

describe('R4 — sin familias retiradas', () => {
  it('no queda MedievalSharp, Cinzel ni Alegreya Sans (salvo Alegreya Sans SC)', () => {
    const re = /MedievalSharp|Cinzel|Alegreya Sans(?! SC)/;
    const bad = sweepFiles.filter((f) => re.test(read(f))).map((f) => path.relative(CLIENT, f));
    expect(bad).toEqual([]);
  });
});

describe('R6 — tokens kh-*', () => {
  const kh = tailwindConfig.theme.extend.colors.kh;
  it('expone los 13 tokens con su hex exacto', () => {
    expect(Object.keys(kh).sort()).toEqual(Object.keys(KH).sort());
    for (const [name, hex] of Object.entries(KH)) expect(kh[name].toLowerCase()).toBe(hex);
  });
});

describe('R7 — fontFamily', () => {
  const ff = tailwindConfig.theme.extend.fontFamily;
  it('display, body y numeric con serif de respaldo', () => {
    expect(ff.display).toEqual(['"IM Fell English SC"', 'serif']);
    expect(ff.body).toEqual(['"IM Fell English"', 'serif']);
    expect(ff.numeric).toEqual(['"Alegreya Sans SC"', 'serif']);
  });
  it('medieval es alias de display', () => {
    expect(ff.medieval).toEqual(ff.display);
  });
});

describe('R8 — body', () => {
  const css = read(path.join(SRC, 'styles/index.css'));
  const body = (css.match(/\nbody\s*{[^}]*}/) || [''])[0];
  it('usa la familia body, kh-bone, kh-ink y 15px sin Segoe UI', () => {
    expect(body).toMatch(/font-family:\s*'IM Fell English'/);
    expect(body).toMatch(/color:\s*#e6dcc3/i);
    expect(body).toMatch(/background:\s*#14110d/i);
    expect(body).toMatch(/font-size:\s*15px/);
    expect(css).not.toMatch(/Segoe UI/);
  });
});

describe('R10 — UI_FONT', () => {
  it('es la constante única de texto Phaser', () => {
    expect(UI_FONT).toBe("'IM Fell English SC', serif");
  });
  it('las escenas/entidades Phaser que dibujan texto la usan', () => {
    const files = [
      'game/scenes/BootScene.js',
      'game/entities/NPC.js',
      'game/entities/Building.js',
      'game/systems/ParticleSystem.js',
      'game/scenes/IsoWorldScene.js',
    ];
    for (const f of files) expect(read(path.join(SRC, f)), f).toContain('UI_FONT');
  });
});

describe('R15 — kingdom.* reapuntado a kh-*', () => {
  const k = tailwindConfig.theme.extend.colors.kingdom;
  it('mapa design §2.3', () => {
    expect(k.bg.toLowerCase()).toBe(KH.ink);
    expect(k.card.toLowerCase()).toBe(KH.oak);
    expect(k.accent.toLowerCase()).toBe(KH.seal);
    expect(k.gold.toLowerCase()).toBe(KH.brass);
    expect(k.green.toLowerCase()).toBe(KH['brass-light']);
    expect(k.blue.toLowerCase()).toBe(KH.iron);
  });
  it('no se renombra ninguna clave kingdom-*', () => {
    expect(Object.keys(k).sort()).toEqual(['accent', 'bg', 'blue', 'card', 'gold', 'green']);
  });
});
