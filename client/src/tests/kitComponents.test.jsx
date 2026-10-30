/**
 * ui_kit_b etapa B — componentes del kit (R17–R29). Los estilos 9-slice van inline
 * (jsdom no evalúa index.css), las reglas de hover/active se citan desde index.css.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Bar from '../components/ui/Bar';
import PortraitRing from '../components/ui/PortraitRing';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');
const css = fs.readFileSync(path.join(SRC, 'styles/index.css'), 'utf8');
const px = (v) => parseInt(v, 10);

describe('Panel (R17–R20)', () => {
  it('oak por defecto, 9-slice de panel_frame, sin backdrop-filter (R17, R18)', () => {
    const { container } = render(<Panel title="Mercado">x</Panel>);
    const el = container.firstChild;
    expect(el).toHaveAttribute('data-variant', 'oak');
    expect(el.style.borderImageSource).toContain('/assets/b/ui/panel_frame.webp');
    expect(el.style.backdropFilter || '').toBe('');
    expect(el.getAttribute('style')).not.toMatch(/backdrop/);
    expect(screen.getByText('Mercado').className).toMatch(/font-display/);
  });

  it('parchment: fondo kh-parchment y texto kh-parchment-ink (R19)', () => {
    const { container } = render(<Panel variant="parchment">x</Panel>);
    const el = container.firstChild;
    expect(el).toHaveAttribute('data-variant', 'parchment');
    expect(el.style.backgroundColor).toBe('rgb(216, 200, 160)'); // #d8c8a0
    expect(el.style.color).toBe('rgb(43, 31, 20)'); // #2b1f14
    expect(el.style.borderImageSource || '').toBe('');
  });

  it('onClose: botón «Cerrar» ≥44×44 sin texto y llama al handler (R20)', () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose}>x</Panel>);
    const btn = screen.getByLabelText('Cerrar');
    expect(px(btn.style.minWidth)).toBeGreaterThanOrEqual(44);
    expect(px(btn.style.minHeight)).toBeGreaterThanOrEqual(44);
    expect(btn.textContent).toBe('');
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sin onClose no hay botón de cierre', () => {
    render(<Panel>x</Panel>);
    expect(screen.queryByLabelText('Cerrar')).toBeNull();
  });
});

describe('Button (R21–R24)', () => {
  it('primary → btn_red, secondary → btn_stone, font-display 16 px (R21)', () => {
    const { rerender } = render(<Button variant="primary">Ok</Button>);
    let el = screen.getByRole('button');
    expect(el.style.borderImageSource).toContain('btn_red.webp');
    expect(el.className).toMatch(/font-display/);
    expect(el.style.fontSize).toBe('16px');
    rerender(<Button>Ok</Button>);
    el = screen.getByRole('button');
    expect(el.style.borderImageSource).toContain('btn_stone.webp');
  });

  it('mínimo 44×44 (R22)', () => {
    render(<Button>Ok</Button>);
    const el = screen.getByRole('button');
    expect(px(el.style.minHeight)).toBeGreaterThanOrEqual(44);
    expect(px(el.style.minWidth)).toBeGreaterThanOrEqual(44);
  });

  it('deshabilitado: saturate(.4), borde kh-iron, pointer-events none (R23)', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Ok</Button>);
    const el = screen.getByRole('button');
    expect(el).toBeDisabled();
    expect(el.style.filter).toBe('saturate(0.4)');
    expect(el.style.borderColor).toBe('rgb(74, 74, 72)'); // #4a4a48
    expect(el.style.pointerEvents).toBe('none');
    fireEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('hover y :active oscurecen la masa y pintan el borde kh-brass-light (R24)', () => {
    expect(css).toMatch(/\.kh-btn:hover[^{]*\{[^}]*brightness\(\.85\)[^}]*#d9b77a/s);
    expect(css).toMatch(/\.kh-btn:active[^{]*\{[^}]*brightness\(\.85\)[^}]*#d9b77a/s);
  });

  it('dispara onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ok</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('IconButton (R22, R25)', () => {
  it('ícono ≥28 px, etiqueta font-display y ≥44×44', () => {
    const { container } = render(<IconButton icon="gold" label="Oro" onClick={() => {}} />);
    const el = screen.getByRole('button');
    expect(px(el.style.minHeight)).toBeGreaterThanOrEqual(44);
    expect(px(el.style.minWidth)).toBeGreaterThanOrEqual(44);
    const icon = container.querySelector('.sprite-icon, [role="img"], [data-missing-icon], span[style*="width"]');
    expect(icon).toBeTruthy();
    expect(px(icon.style.width)).toBeGreaterThanOrEqual(28);
    const label = screen.getByText('Oro');
    expect(label.className).toMatch(/font-display/);
  });

  it('el acento tiñe el borde y active marca aria-pressed', () => {
    render(<IconButton icon="gold" label="Oro" accent="#7a1f1a" active onClick={() => {}} />);
    const el = screen.getByRole('button');
    expect(el.style.borderColor).toBe('rgb(122, 31, 26)');
    expect(el).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Bar (R26, R27)', () => {
  it.each([
    [-5, 0],
    [40, 40],
    [130, 100],
  ])('valor %s → %s %%', (value, expected) => {
    render(<Bar value={value} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', String(expected));
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar.querySelector('[data-bar-fill]').style.width).toBe(`${expected}%`);
  });

  it('marco bar_frame 9-slice y relleno por tono', () => {
    const { rerender } = render(<Bar value={50} tone="ember" />);
    let bar = screen.getByRole('progressbar');
    expect(bar.style.borderImageSource).toContain('bar_frame.webp');
    expect(bar.querySelector('[data-bar-fill]').style.backgroundColor).toBe('rgb(224, 123, 42)');
    rerender(<Bar value={50} tone="seal" />);
    expect(screen.getByRole('progressbar').querySelector('[data-bar-fill]').style.backgroundColor).toBe('rgb(122, 31, 26)');
    rerender(<Bar value={50} tone="macula" />);
    expect(screen.getByRole('progressbar').querySelector('[data-bar-fill]').style.backgroundColor).toBe('rgb(143, 174, 58)');
  });

  it('NaN/undefined → 0', () => {
    render(<Bar value={undefined} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('PortraitRing (R28)', () => {
  it('con src: imagen debajo y aro encima', () => {
    const { container } = render(<PortraitRing src="/h.webp" size={64} alt="Héroe" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/h.webp');
    expect(img).toHaveAttribute('alt', 'Héroe');
    expect(img.style.borderRadius).toBe('50%');
    const ring = container.querySelector('[data-ring]');
    expect(ring.style.backgroundImage).toContain('portrait_ring.webp');
  });

  it('sin src: disco kh-oak sin <img> rota', () => {
    const { container } = render(<PortraitRing size={64} />);
    expect(container.querySelector('img')).toBeNull();
    const disc = container.querySelector('[data-ring-fill]');
    expect(disc.style.backgroundColor).toBe('rgb(42, 33, 25)'); // #2a2119
    expect(container.querySelector('[data-ring]').style.backgroundImage).toContain('portrait_ring.webp');
  });
});

// ── pantallas_b T2: Toggle (R37) y ResultBanner (R15, R16) ───────────────────
import Toggle from '../components/ui/Toggle';
import ResultBanner from '../components/ui/ResultBanner';
import { KH } from '../components/ui/kitPieces';
import { contrast } from './helpers/contrast';

describe('Toggle (pantallas_b R37)', () => {
  it('role=switch con aria-checked y colores por estado', () => {
    const { container, rerender } = render(<Toggle on label="Audio" onChange={() => {}} />);
    const sw = screen.getByRole('switch', { name: 'Audio' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(container.querySelector('[data-toggle-track]').style.backgroundColor).toBe('rgb(217, 183, 122)'); // brass-light
    expect(container.querySelector('[data-toggle-knob]').style.backgroundColor).toBe('rgb(230, 220, 195)'); // bone
    rerender(<Toggle on={false} label="Audio" onChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(container.querySelector('[data-toggle-track]').style.backgroundColor).toBe('rgb(74, 74, 72)'); // iron
  });

  it('área táctil 44×44, onChange y disabled', () => {
    const fn = vi.fn();
    const { rerender } = render(<Toggle on onChange={fn} />);
    const sw = screen.getByRole('switch');
    expect(px(sw.style.minWidth)).toBeGreaterThanOrEqual(44);
    expect(px(sw.style.minHeight)).toBeGreaterThanOrEqual(44);
    fireEvent.click(sw);
    expect(fn).toHaveBeenCalledTimes(1);
    rerender(<Toggle on disabled onChange={fn} />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('contraste pista encendida/apagada ≥ 3:1 (4.65)', () => {
    const c = contrast(KH['brass-light'], KH.iron);
    expect(c).toBeGreaterThanOrEqual(3);
    expect(c).toBeCloseTo(4.65, 1);
  });
});

describe('ResultBanner (pantallas_b R15, R16)', () => {
  it.each([['victory', '¡Victoria!'], ['defeat', 'Derrota']])('outcome %s', (outcome, title) => {
    const onClose = vi.fn();
    const { container } = render(
      <ResultBanner outcome={outcome} title={title} onClose={onClose}><p>Botín: 3 hierro</p></ResultBanner>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('data-outcome', outcome);
    expect(status).toHaveAttribute('data-variant', 'parchment');
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText('Botín: 3 hierro')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-banner-band]')).not.toBeNull();
  });

  it('derrota: franja seal con texto bone; victoria: filete brass-light', () => {
    const { container, rerender } = render(<ResultBanner outcome="defeat" title="Derrota" onClose={() => {}} />);
    const band = () => container.querySelector('[data-banner-band]');
    expect(band().style.backgroundColor).toBe('rgb(122, 31, 26)');
    expect(band().style.color).toBe('rgb(230, 220, 195)');
    rerender(<ResultBanner outcome="victory" title="¡Victoria!" onClose={() => {}} />);
    expect(band().style.borderTop).toContain('rgb(217, 183, 122)');
  });

  it('outcome desconocido se trata como derrota', () => {
    render(<ResultBanner outcome="x" title="?" onClose={() => {}} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-outcome', 'defeat');
  });
});
