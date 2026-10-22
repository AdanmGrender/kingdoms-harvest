import React from 'react';
import { KH, PANEL_FRAME, borderImageStyle } from './kitPieces';

/**
 * Panel — contenedor del kit B (R17–R20).
 *  - oak (defecto): 9-slice de panel_frame.webp, masa kh-oak, sombra dura kh-ink, sin backdrop-filter.
 *  - parchment: fondo plano kh-parchment, borde kh-brass 2 px, texto kh-parchment-ink.
 * `onClose` pinta un botón «Cerrar» de 44×44 cuyo glifo ✕ se dibuja con CSS (.kh-close).
 */
export default function Panel({ variant = 'oak', title, onClose, className = '', style, children, ...rest }) {
  const base =
    variant === 'parchment'
      ? {
          backgroundColor: KH.parchment,
          color: KH['parchment-ink'],
          border: `2px solid ${KH.brass}`,
          boxShadow: `0 4px 0 ${KH.ink}`,
        }
      : {
          ...borderImageStyle(PANEL_FRAME),
          backgroundColor: KH.oak,
          backgroundClip: 'padding-box',
          color: KH.bone,
          boxShadow: `0 4px 0 ${KH.ink}`,
        };

  return (
    <div
      data-variant={variant}
      className={`kh-panel kh-panel--${variant} ${className}`.trim()}
      style={{ ...base, ...style }}
      {...rest}
    >
      {(title || onClose) && (
        <div className="flex justify-between items-center mb-2 gap-2">
          {title ? (
            <h3 className="font-display" style={{ fontSize: 20, lineHeight: 1.2 }}>
              {title}
            </h3>
          ) : (
            <span />
          )}
          {onClose && (
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="kh-close"
              style={{ minWidth: 44, minHeight: 44 }}
            />
          )}
        </div>
      )}
      {children}
    </div>
  );
}
