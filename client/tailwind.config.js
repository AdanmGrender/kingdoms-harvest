/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta grimdark oficial (Fase 0 del rework visual, docs/…vision-visual…):
        // se retira el rosa #e94560 y el navy cute; base piedra + acento sangre
        // + oro sucio. Propaga a las ~40 pantallas vía las clases kingdom-*.
        kingdom: {
          bg: '#1a1712',      // piedra-tierra muy oscura (fondo)
          card: '#332f2b',    // piedra oscura (cards) — lee sobre el bg
          accent: '#b32821',  // sangre (era rosa #e94560)
          gold: '#d9a441',    // oro sucio (era #ffd700 brillante)
          green: '#4ade80',   // éxito / cultivos (se mantiene por legibilidad)
          blue: '#4a4550',    // storm-stone (era navy brillante #0f3460)
        },
      },
      fontFamily: {
        medieval: ['"MedievalSharp"', 'cursive', 'serif'],
      },
    },
  },
  plugins: [],
};
