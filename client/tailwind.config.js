/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        kingdom: {
          bg: '#1a1a2e',
          card: '#16213e',
          accent: '#e94560',
          gold: '#ffd700',
          green: '#4ade80',
          blue: '#0f3460',
        },
      },
      fontFamily: {
        medieval: ['"MedievalSharp"', 'cursive', 'serif'],
      },
    },
  },
  plugins: [],
};
