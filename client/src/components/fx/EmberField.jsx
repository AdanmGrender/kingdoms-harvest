import { useMemo } from 'react';

/**
 * EmberField — capa de brasas/ceniza que suben y se apagan sobre un diorama.
 * Puro CSS (keyframe emberRise, ver index.css): sólo transform/opacity, GPU.
 * pointer-events: none, así nunca roba toques. Se apaga con prefers-reduced-motion
 * porque las partículas usan la animación .fx (emberRise) que el media query no
 * cubre — por eso también respetamos el flag acá y no renderizamos nada.
 *
 * Props:
 *   count  — nº de partículas (default 20)
 *   color  — color de la brasa (default naranja-vela)
 *   maxOpacity — pico de opacidad por partícula (default 0.8)
 *   className — clases extra para el contenedor absoluto
 */
const REDUCED = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

export default function EmberField({ count = 20, color = '#e8933a', maxOpacity = 0.8, className = '' }) {
  // Semillas estables por montaje (no re-randomiza en cada render).
  const seeds = useMemo(
    () => Array.from({ length: count }, () => ({
      left: Math.random() * 100,            // %
      size: 1.5 + Math.random() * 2.5,      // px
      delay: Math.random() * 8,             // s
      dur: 6 + Math.random() * 7,           // s
      drift: (Math.random() - 0.5) * 24,    // px de deriva horizontal
      op: 0.4 + Math.random() * 0.5,        // opacidad relativa
    })),
    [count],
  );

  if (REDUCED) return null;

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      {seeds.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            bottom: '-8px',
            width: `${s.size}px`,
            height: `${s.size}px`,
            borderRadius: '9999px',
            background: color,
            boxShadow: `0 0 ${s.size * 2}px ${color}`,
            // @ts-ignore — var CSS consumida por el keyframe
            '--ember-max': maxOpacity * s.op,
            animation: `emberRise ${s.dur}s linear ${s.delay}s infinite`,
            // deriva horizontal sutil sobre el movimiento vertical del keyframe
            marginLeft: `${s.drift}px`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
}
