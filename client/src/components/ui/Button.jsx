import React from 'react';
import { KH, BTN_PIECES, borderImageStyle } from './kitPieces';

/**
 * Button — botón de acción del kit B (R21–R24).
 * primary → 9-slice btn_red.webp, secondary → btn_stone.webp; font-display 16 px; ≥44×44.
 * Hover/active: reglas `.kh-btn:hover|:active` de index.css (masa oscurecida + borde kh-brass-light).
 */
export default function Button({
  variant = 'secondary',
  disabled = false,
  onClick,
  className = '',
  style,
  type = 'button',
  children,
  ...rest
}) {
  const piece = BTN_PIECES[variant] || BTN_PIECES.secondary;
  const disabledStyle = disabled
    ? { filter: 'saturate(0.4)', borderColor: KH.iron, pointerEvents: 'none' }
    : null;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      data-variant={variant}
      className={`kh-btn kh-btn--${variant} font-display ${className}`.trim()}
      style={{
        ...borderImageStyle(piece),
        minHeight: 44,
        minWidth: 44,
        fontSize: 16,
        color: KH.bone,
        ...disabledStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
