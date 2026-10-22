import React from 'react';
import { BAR_FRAME, BAR_TONES } from './kitPieces';

/**
 * Bar — barra de progreso del kit B (R26, R27).
 * Marco 9-slice de bar_frame.webp y relleno de color plano según `tone`
 * (ember = progreso/tiempo, seal = vida, macula = corrupción). `value` se limita a 0–100.
 */
export default function Bar({ value, tone = 'ember', label, className = '', style }) {
  const n = Number(value);
  const pct = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 100) / 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`kh-bar ${className}`.trim()}
      style={{
        borderStyle: 'solid',
        borderWidth: BAR_FRAME.width,
        borderImageSource: `url(${BAR_FRAME.src})`,
        borderImageSlice: BAR_FRAME.slice,
        borderImageWidth: BAR_FRAME.width,
        borderImageRepeat: 'stretch',
        ...style,
      }}
    >
      <div
        data-bar-fill
        className="kh-bar__fill"
        style={{ width: `${pct}%`, backgroundColor: BAR_TONES[tone] || BAR_TONES.ember }}
      />
    </div>
  );
}
