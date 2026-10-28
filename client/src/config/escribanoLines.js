/**
 * Frases del Escribano para el libro de cuentas (reporte offline).
 * Texto de presentación, no balance: nunca llevan cifras ni nombres de recursos, porque los datos
 * reales los muestra el libro y la frase no puede contradecirlos. Canon: docs/lore.md (Escribano,
 * trato de «señor», diezmo, ratas, granero).
 */

export const ESCRIBANO_LINES = {
  defecto: [
    'Todo anotado, señor. El diezmo también, pero ese lo anoto en otro libro.',
    'Mientras no estabais, el Bastión trabajó. Yo conté. Alguien tenía que hacerlo.',
    'Las cuentas cuadran. Casi siempre a mi favor, pero cuadran.',
    'Vuestros labriegos no se quejaron. Tampoco se les preguntó.',
    'Producción íntegra, señor, salvo lo que el diezmo encontró por el camino.',
    'El Bastión sigue en pie y el libro al día. Solo una de las dos cosas me importa.',
  ],
  lleno: [
    'El granero no dio abasto, señor. Lo que no cupo se pudrió; lo demás, las ratas lo asentaron como propio.',
    'Granero lleno. Las ratas agradecen vuestra ausencia; yo, el diezmo sobre lo que se llevaron.',
    'Se perdió lo que el granero no pudo guardar. Lo asenté bajo «mermas», donde asiento lo que no sé explicar.',
    'El granero rebosó y la cosecha se echó a perder. Las ratas, en cambio, jamás comieron mejor.',
  ],
  breve: [
    'Apenas os fuisteis y ya volvéis, señor. No hubo tiempo ni de robar con método.',
    'Poco tiempo, poca cuenta. El diezmo de lo poco también cuenta.',
    'Volvéis pronto. El Bastión no tuvo ocasión de decepcionaros.',
    'Una ausencia breve: el libro apenas se ensució.',
  ],
  larga: [
    'Cuánto tiempo, señor. El libro creció; mi diezmo, con toda naturalidad.',
    'Tantas horas sin vos y el Bastión sigue en pie. Dudo que sea mérito vuestro.',
    'Días enteros fuera. Los labriegos preguntaron por vos. Yo no, pero lo anoté.',
    'Una ausencia larga rinde buen libro. Lo digo yo, que lo escribo.',
  ],
};

// Umbrales de presentación; no coinciden a propósito con OFFLINE_CAP_MS del servidor.
export const BREVE_MS = 3600000; // 1 h
export const LARGA_MS = 86400000; // 24 h

function isFull(entry) {
  return !!entry
    && Number.isFinite(entry.amount)
    && Number.isFinite(entry.capacity)
    && entry.amount >= entry.capacity;
}

/** Cubo de frases: 'lleno' > 'larga' > 'breve' > 'defecto'. */
export function escribanoBucket(report) {
  const storage = (report && report.storage) || {};
  if (Object.values(storage).some(isFull)) return 'lleno';
  const away = Number(report && report.awayMs) || 0;
  if (away >= LARGA_MS) return 'larga';
  if (away < BREVE_MS) return 'breve';
  return 'defecto';
}

// FNV-1a de 32 bits sobre el texto del número.
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Frase pura y determinista: el mismo reporte siempre da la misma, ausencias distintas varían. */
export function pickEscribanoLine(report) {
  const lines = ESCRIBANO_LINES[escribanoBucket(report)];
  const away = Math.floor(Number(report && report.awayMs) || 0);
  return lines[fnv1a(String(away)) % lines.length];
}
