// Chrome grimdark compartido (T4 reskin visual): base de PIEDRA oscura + borde
// metal tenue con acento por ítem. Reemplaza los gradientes navy/púrpura/azul
// "candy" que chocaban con los dioramas de fondo. Ver docs/…coordinacion-visual.

// Barra/panel de chrome (barra superior, contenedores).
export const grimBar = {
  background: 'linear-gradient(180deg, rgba(42,38,32,0.96) 0%, rgba(18,15,12,0.95) 100%)',
  border: '1px solid rgba(217,164,65,0.28)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(217,164,65,0.08)',
};

// Botón de riel/nav: piedra oscura + borde del acento (tenue). El acento tiñe
// SOLO el borde/glow, no la masa — así todo lee grimdark y coherente.
export function grimBtn(accent = '#d9a441') {
  return {
    background: 'linear-gradient(180deg, rgba(46,42,34,0.96) 0%, rgba(20,17,13,0.95) 100%)',
    border: `1.5px solid ${accent}55`,
    boxShadow: `0 2px 8px rgba(0,0,0,0.6), 0 0 8px ${accent}1f, inset 0 1px 0 rgba(255,255,255,0.05)`,
  };
}
