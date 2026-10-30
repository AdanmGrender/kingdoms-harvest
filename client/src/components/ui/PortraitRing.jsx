import React from 'react';
import { KH, RING } from './kitPieces';

/**
 * PortraitRing — retrato circular (R28). La imagen se enmascara con `border-radius: 50%`
 * debajo y `portrait_ring.webp` va encima. El webp trae un disco opaco en el centro, así que
 * el aro se recorta con `clip-path` (anillo, evenodd) para dejar ver el retrato.
 * Sin `src` queda un disco kh-oak, nunca una imagen rota.
 */
export default function PortraitRing({ src, size = 64, alt = '', className = '', children }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2;
  const r = size * RING.innerRadius;
  const circle = (rad) => `M ${cx - rad} ${cy} a ${rad} ${rad} 0 1 0 ${2 * rad} 0 a ${rad} ${rad} 0 1 0 ${-2 * rad} 0 Z`;
  const donut = `path(evenodd, '${circle(R)} ${circle(r)}')`;
  const inset = Math.round(size * 0.08);

  return (
    <span
      className={`kh-ring relative inline-block flex-shrink-0 ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{ position: 'absolute', inset, width: size - inset * 2, height: size - inset * 2, objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        <span
          data-ring-fill
          style={{ position: 'absolute', inset, borderRadius: '50%', backgroundColor: KH.oak }}
        />
      )}
      {children && (
        <span
          data-ring-content
          style={{ position: 'absolute', inset, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {children}
        </span>
      )}
      <span
        data-ring
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${RING.src})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          clipPath: donut,
        }}
      />
    </span>
  );
}
