import React from 'react';
import { KH } from './kitPieces';

/**
 * Toggle — interruptor del kit B (pantallas_b R37).
 * `<button role="switch" aria-checked>`: pista 44×24 dentro de un área táctil 44×44.
 * Encendida kh-brass-light, apagada kh-iron, perilla kh-bone (4.65:1 entre pistas).
 */
export default function Toggle({ on = false, disabled = false, onChange, label, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`kh-toggle shrink-0 ${className}`.trim()}
      style={{
        minWidth: 44,
        minHeight: 44,
        width: 44,
        height: 44,
        padding: 0,
        background: 'transparent',
        border: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span
        data-toggle-track
        aria-hidden="true"
        style={{
          position: 'relative',
          display: 'block',
          width: 44,
          height: 24,
          borderRadius: 12,
          backgroundColor: on ? KH['brass-light'] : KH.iron,
          border: `1px solid ${KH.ink}`,
          boxSizing: 'border-box',
          transition: 'background-color 0.15s ease',
        }}
      >
        <span
          data-toggle-knob
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 22 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: KH.bone,
            border: `1px solid ${KH.ink}`,
            boxSizing: 'border-box',
            transition: 'left 0.15s ease',
          }}
        />
      </span>
    </button>
  );
}
