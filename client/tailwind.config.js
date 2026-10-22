/** @type {import('tailwindcss').Config} */
// Tokens de ui_kit_b: `colors.kh` = docs/art-direction/ui-kit-b.md §3 (hex exactos).
// `kingdom.*` se conserva (las ~40 pantallas usan clases kingdom-*) pero apunta a los tokens kh equivalentes.
const kh = {
  ink: '#14110d',            // fondo base, sombras
  oak: '#2a2119',            // masa de paneles y botones
  'oak-light': '#3d3024',    // hover/pressed, separadores
  iron: '#4a4a48',           // remaches, bordes secundarios, deshabilitado
  brass: '#b08d57',          // bordes principales, filetes, íconos de acción
  'brass-light': '#d9b77a',  // foco, selección, número destacado
  bone: '#e6dcc3',           // texto sobre oscuro
  'bone-dim': '#a89c84',     // texto secundario
  parchment: '#d8c8a0',      // interior de paneles de lectura
  'parchment-ink': '#2b1f14', // texto sobre pergamino
  seal: '#7a1f1a',           // acción principal (lacre), error, peligro
  ember: '#e07b2a',          // progreso, tiempo
  macula: '#8fae3a',         // solo magia/corrupción; nunca "éxito"
};

const display = ['"IM Fell English SC"', 'serif'];

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        kh,
        kingdom: {
          bg: kh.ink,
          card: kh.oak,
          accent: kh.seal,
          gold: kh.brass,
          green: kh['brass-light'], // el éxito no usa verde (brief de arte §3)
          blue: kh.iron,
        },
      },
      fontFamily: {
        display,
        body: ['"IM Fell English"', 'serif'],
        numeric: ['"Alegreya Sans SC"', 'serif'],
        medieval: display, // alias hasta migrar las clases font-medieval restantes
      },
    },
  },
  plugins: [],
};
