import React from 'react';
import SpriteIcon from './SpriteIcon';
import { KH } from './kitPieces';

/**
 * IconButton — botón de riel (R22, R25): escudete kh-oak con borde kh-iron, ícono del set
 * (32 px) y etiqueta font-display de 12 px debajo. El acento solo tiñe el borde y el
 * `drop-shadow`; el color es siempre plano y no hay arte horneado.
 */
export default function IconButton({
  icon,
  label,
  onClick,
  active = false,
  accent,
  fallback,
  disabled = false,
  className = '',
  style,
  children,
  ...rest
}) {
  const tint = accent || KH.brass;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`kh-iconbtn pointer-events-auto ${className}`.trim()}
      style={{
        minWidth: 44,
        minHeight: 44,
        backgroundColor: active ? KH['oak-light'] : KH.oak,
        borderColor: tint,
        filter: disabled ? 'saturate(0.4)' : `drop-shadow(0 0 3px ${tint}66)`,
        ...style,
      }}
      {...rest}
    >
      <SpriteIcon name={icon} size={32} fallback={fallback} />
      {label && (
        <span className="font-display kh-iconbtn__label" style={{ fontSize: 12, lineHeight: 1.1, color: KH['brass-light'] }}>
          {label}
        </span>
      )}
      {children}
    </button>
  );
}
