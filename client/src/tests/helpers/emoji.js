/**
 * Criterio de emoji compartido (design §2.6). Lo usan `noEmoji.test.js` y el conteo de la etapa C.
 * Un emoji es un carácter `Extended_Pictographic` o `U+FE0F` / `U+20E3`.
 */
export const EMOJI_RE = /\p{Extended_Pictographic}|\uFE0F|\u20E3/gu;

/**
 * Quita comentarios antes de medir: bloques `/* *\/` (incluye `{/* *\/}` de JSX) y líneas
 * que empiezan por `//` o `*`.
 */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

/** Cuenta los emojis de un texto ya sin comentarios. */
export function countEmoji(src) {
  const m = stripComments(src).match(EMOJI_RE);
  return m ? m.length : 0;
}
