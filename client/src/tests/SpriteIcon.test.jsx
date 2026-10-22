/**
 * ui_kit_b etapa C1 (T18) — SpriteIcon: `image-rendering: auto` y nombre inexistente →
 * recuadro vacío con `data-missing-icon`, sin texto ni emoji (R47).
 * Rojo hasta T23 (SpriteIcon todavía usa `pixelated` y `fallback`).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

import SpriteIcon from '../components/ui/SpriteIcon';

describe('SpriteIcon (R47)', () => {
  it('renderiza con image-rendering: auto (no pixelated)', () => {
    const { container } = render(<SpriteIcon name="gold" size={32} />);
    const el = container.firstChild;
    expect(el.style.imageRendering).toBe('auto');
    expect(el.style.backgroundImage).toContain('/assets/b/ui/icons.webp');
  });

  it('nombre inexistente → recuadro vacío con data-missing-icon, sin texto ni emoji', () => {
    const { container } = render(<SpriteIcon name="no_existe_xyz" size={24} fallback="💎" />);
    const el = container.firstChild;
    expect(el.hasAttribute('data-missing-icon')).toBe(true);
    expect(el.textContent).toBe('');
    expect(el.style.width).toBe('24px');
    expect(el.style.height).toBe('24px');
  });

  it('un nombre existente no lleva data-missing-icon', () => {
    const { container } = render(<SpriteIcon name="gold" size={24} />);
    expect(container.firstChild.hasAttribute('data-missing-icon')).toBe(false);
  });
});
