/**
 * reporte_escribano T4 — catálogo de frases del Escribano y su selección (R7–R13).
 */
import { describe, it, expect } from 'vitest';
import {
  ESCRIBANO_LINES,
  BREVE_MS,
  LARGA_MS,
  escribanoBucket,
  pickEscribanoLine,
} from '../config/escribanoLines';
import { EMOJI_RE } from './helpers/emoji';

const ALL = Object.entries(ESCRIBANO_LINES).flatMap(([bucket, lines]) => lines.map((l) => [bucket, l]));

const FULL = { wheat: { amount: 500, capacity: 500 } };
const NOT_FULL = { wheat: { amount: 480, capacity: 500 } };

// Términos del lore v1 (columna «v1» de docs/lore-glosario.md) que podrían colarse en un texto.
const V1_TERMS = [
  'disformidad', 'auroras', 'reflectores', 'galaxia', 'nave', 'crucero', 'convoy', 'convoyes',
  'sintético', 'chatarra', 'ferrocreto', 'créditos', 'raciones', 'vats', 'psíquico', 'psíquica',
  'tecnosagrado', 'fusilero', 'bioadepto', 'hidropónica', 'sistema', 'planetas',
];
// Nombres concretos de recursos (R12).
const RESOURCE_TERMS = [
  'trigo', 'madera', 'piedra', 'hierro', 'oro', 'agua', 'pan', 'harina', 'queso', 'huevo', 'leche',
  'lana', 'tablones', 'lingotes',
];
const wordRe = (w) => new RegExp(`(^|[^\\p{L}])${w}($|[^\\p{L}])`, 'iu');

describe('ESCRIBANO_LINES (R7)', () => {
  it('tiene los cuatro cubos con los conteos mínimos', () => {
    expect(Object.keys(ESCRIBANO_LINES).sort()).toEqual(['breve', 'defecto', 'larga', 'lleno']);
    expect(ESCRIBANO_LINES.defecto.length).toBeGreaterThanOrEqual(6);
    expect(ESCRIBANO_LINES.lleno.length).toBeGreaterThanOrEqual(4);
    expect(ESCRIBANO_LINES.breve.length).toBeGreaterThanOrEqual(4);
    expect(ESCRIBANO_LINES.larga.length).toBeGreaterThanOrEqual(4);
  });

  it('no repite frases', () => {
    const texts = ALL.map(([, l]) => l);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('pickEscribanoLine — determinismo (R8)', () => {
  it('el mismo reporte da siempre la misma frase', () => {
    const report = { awayMs: 7200000, storage: NOT_FULL };
    const first = pickEscribanoLine(report);
    for (let i = 0; i < 50; i += 1) expect(pickEscribanoLine(report)).toBe(first);
  });

  it('tolera un reporte sin awayMs ni storage', () => {
    expect(ESCRIBANO_LINES.breve).toContain(pickEscribanoLine({}));
    expect(ESCRIBANO_LINES.breve).toContain(pickEscribanoLine(null));
  });
});

describe('cubos (R9, R10)', () => {
  it('lleno gana con cualquier awayMs', () => {
    for (const awayMs of [0, 1000, BREVE_MS, 7200000, LARGA_MS, 10 * LARGA_MS]) {
      const report = { awayMs, storage: FULL };
      expect(escribanoBucket(report)).toBe('lleno');
      expect(ESCRIBANO_LINES.lleno).toContain(pickEscribanoLine(report));
    }
  });

  it('sin entradas llenas decide la duración, con los bordes exactos', () => {
    const bucket = (awayMs) => escribanoBucket({ awayMs, storage: NOT_FULL });
    expect(bucket(3599999)).toBe('breve');
    expect(bucket(3600000)).toBe('defecto');
    expect(bucket(86399999)).toBe('defecto');
    expect(bucket(86400000)).toBe('larga');
    expect(BREVE_MS).toBe(3600000);
    expect(LARGA_MS).toBe(86400000);
  });

  it('la frase pertenece al cubo elegido', () => {
    expect(ESCRIBANO_LINES.breve).toContain(pickEscribanoLine({ awayMs: 3599999 }));
    expect(ESCRIBANO_LINES.defecto).toContain(pickEscribanoLine({ awayMs: 3600000 }));
    expect(ESCRIBANO_LINES.defecto).toContain(pickEscribanoLine({ awayMs: 86399999 }));
    expect(ESCRIBANO_LINES.larga).toContain(pickEscribanoLine({ awayMs: 86400000 }));
  });

  it('sin storage o con la entrada incompleta no cuenta como lleno', () => {
    expect(escribanoBucket({ awayMs: 7200000 })).toBe('defecto');
    expect(escribanoBucket({ awayMs: 7200000, storage: { wheat: {} } })).toBe('defecto');
  });
});

describe('variedad por ausencia (R11)', () => {
  it('500 awayMs distintos en el cubo defecto cubren todas sus frases', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i += 1) {
      seen.add(pickEscribanoLine({ awayMs: BREVE_MS + 7919 * i, storage: NOT_FULL }));
    }
    expect(seen.size).toBe(ESCRIBANO_LINES.defecto.length);
  });
});

describe('texto del catálogo (R12, R13)', () => {
  it.each(ALL)('[%s] sin emojis, cifras, términos v1 ni recursos: %s', (_bucket, line) => {
    expect(line.match(EMOJI_RE)).toBeNull();
    expect(line).not.toMatch(/\d/);
    for (const t of V1_TERMS) expect(line).not.toMatch(wordRe(t));
    for (const t of RESOURCE_TERMS) expect(line).not.toMatch(wordRe(t));
  });

  it.each(ALL)('[%s] hasta 140 caracteres: %s', (_bucket, line) => {
    expect(line.length).toBeLessThanOrEqual(140);
  });

  it('las frases del cubo lleno nombran al granero', () => {
    for (const line of ESCRIBANO_LINES.lleno) expect(line).toMatch(/granero/i);
  });
});
