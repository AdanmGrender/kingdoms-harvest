/**
 * ui_kit_b etapa B — TopResourceBar (R14, R32 estructura, R33, R34, R35).
 * El desborde real a 412 px se mide en Playwright (T17); aquí se fija la estructura.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import React from 'react';

const handlers = {};
vi.mock('../game/EventBridge', () => ({
  default: {
    on: vi.fn((ev, fn) => { handlers[ev] = fn; }),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../services/socketService', () => ({ connectSocket: vi.fn() }));
vi.mock('../components/ui/SpriteIcon', () => ({
  default: ({ name, size, fallback }) => (
    <span data-testid={`sprite-${name}`} data-size={size}>{fallback || name}</span>
  ),
  CharacterSprite: () => <span />,
}));

import useGameStore from '../store/gameStore';
import TopResourceBar from '../components/hud/TopResourceBar';

const PANTRY = ['wood', 'stone', 'wheat', 'iron', 'egg', 'milk', 'wool', 'carrot'];

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  useGameStore.setState({
    player: { telegram_id: 1, level: 7, xp: 250, xp_for_next: 500, display_name: 'TestHero' },
    resources: { gold: 1500, wood: 12345, stone: 0, wheat: 80 },
    tokenInfo: { balance: 750 },
    gems: { balance: 3 },
    troops: [],
    loadGems: vi.fn(),
    setOverlay: vi.fn(),
  });
});

describe('TopResourceBar — despensa (R33, R34)', () => {
  it('renderiza los 8 contadores con data-resource, incluso con valor 0', () => {
    const { container } = render(<TopResourceBar />);
    const cells = [...container.querySelectorAll('[data-resource]')];
    expect(cells.map((c) => c.getAttribute('data-resource'))).toEqual(PANTRY);
    const egg = container.querySelector('[data-resource="egg"]');
    expect(within(egg).getByText('0')).toBeInTheDocument();
    expect(within(container.querySelector('[data-resource="wood"]')).getByText('12.3K')).toBeInTheDocument();
  });

  it('ícono ≥ 28 px y número ≥ 12 px en cada contador', () => {
    const { container } = render(<TopResourceBar />);
    for (const key of PANTRY) {
      const cell = container.querySelector(`[data-resource="${key}"]`);
      const icon = within(cell).getByTestId(`sprite-${key}`);
      expect(Number(icon.getAttribute('data-size')), key).toBeGreaterThanOrEqual(28);
      const num = cell.querySelector('[data-resource-value]');
      expect(num.className, key).toMatch(/text-\[(1[2-9]|[2-9]\d)px\]|text-(sm|base|lg)/);
    }
  });

  it('los dos grupos de la barra no desbordan por construcción: sin overflow-x scroll', () => {
    const { container } = render(<TopResourceBar />);
    expect(container.innerHTML).not.toMatch(/overflow-x-(auto|scroll)/);
  });
});

describe('TopResourceBar — dígitos (R14, veredicto font-numeric)', () => {
  it('los números de los contadores llevan font-numeric', () => {
    const { container } = render(<TopResourceBar />);
    for (const key of PANTRY) {
      expect(container.querySelector(`[data-resource="${key}"] [data-resource-value]`).className).toMatch(/font-numeric/);
    }
  });

  it('oro, KH y gemas también', () => {
    render(<TopResourceBar />);
    for (const t of ['1.5K', '750', '3']) {
      expect(screen.getByText(t).className).toMatch(/font-numeric/);
    }
  });

  it('el nombre sigue en font-display, no en font-numeric', () => {
    render(<TopResourceBar />);
    const name = screen.getByText('TestHero');
    expect(name.className).toMatch(/font-display/);
    expect(name.className).not.toMatch(/font-numeric/);
  });
});

describe('TopResourceBar — hora, XP y chrome (R35)', () => {
  it('sun por defecto; moon cuando period = night; sun en el resto', () => {
    render(<TopResourceBar />);
    expect(screen.getByTestId('sprite-sun')).toBeInTheDocument();
    act(() => handlers['time:updated']({ period: 'night', icon: '🌙', dayCount: 3 }));
    expect(screen.getByTestId('sprite-moon')).toBeInTheDocument();
    expect(screen.queryByTestId('sprite-sun')).toBeNull();
    expect(screen.getByText('D3')).toBeInTheDocument();
    for (const p of ['dawn', 'morning', 'midday', 'evening']) {
      act(() => handlers['time:updated']({ period: p, icon: '🌙', dayCount: 3 }));
      expect(screen.getByTestId('sprite-sun'), p).toBeInTheDocument();
    }
  });

  it('XP con Bar (progressbar 50 %)', () => {
    render(<TopResourceBar />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('sin gradientes ni backdrop-filter', () => {
    const { container } = render(<TopResourceBar />);
    expect(container.innerHTML).not.toMatch(/gradient|backdrop/i);
  });

  it('conserva nivel, nombre, gemas → tienda y loadGems', () => {
    const setOverlay = vi.fn();
    const loadGems = vi.fn();
    useGameStore.setState({ setOverlay, loadGems });
    render(<TopResourceBar />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('TestHero')).toBeInTheDocument();
    expect(loadGems).toHaveBeenCalled();
    screen.getByText('3').closest('button').click();
    expect(setOverlay).toHaveBeenCalledWith('shop', {});
  });

  it('sin player no renderiza nada', () => {
    useGameStore.setState({ player: null });
    const { container } = render(<TopResourceBar />);
    expect(container.firstChild).toBeNull();
  });
});
