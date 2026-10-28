import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: {} })), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../services/socketService', () => ({ connectSocket: vi.fn() }));

import useGameStore from '../store/gameStore';
import StormBanner from '../components/hud/StormBanner';
import QuestRail from '../components/hub/QuestRail';
import TechTreePanel from '../components/castle/TechTreePanel';
import AchievementPanel from '../components/overlay/AchievementPanel';
import SettingsPanel from '../components/overlay/SettingsPanel';

const cls = (el) => el.className;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fix_superposiciones_ui', () => {
  it('S1 · StormBanner va debajo del TopResourceBar y con tope de ancho', () => {
    useGameStore.setState({
      activeStorm: { name: 'Calma Falsa', intensity: 12, icon: '*', color: '#a78bfa', ends_at: new Date(Date.now() + 60000).toISOString() },
      loadActiveStorm: vi.fn(),
    });
    render(<StormBanner />);
    const el = screen.getByTestId('storm-banner');
    expect(cls(el)).toContain('top-[176px]');
    expect(cls(el)).not.toMatch(/(^|\s)top-10(\s|$)/);
    expect(cls(el)).toContain('max-w-[calc(100%-10rem)]');
  });

  it('S2 · QuestRail muestra «Objetivo:» a todos los anchos y no fija la altura', () => {
    useGameStore.setState({ campaignNodes: [{ id: 'n1', name: 'Despertar del Bastión', status: 'available' }], loadCampaignMap: vi.fn() });
    render(<QuestRail />);
    const label = screen.getByTestId('quest-rail-label');
    expect(label.textContent).toBe('Objetivo:');
    expect(cls(label)).not.toContain('hidden');
    const rail = screen.getByTestId('quest-rail');
    expect(cls(rail)).toContain('min-h-11');
    expect(cls(rail)).not.toMatch(/(^|\s)h-11(\s|$)/);
  });

  it('S3 · pestañas del árbol de investigación: sin corte y nombres de tech con wrap', () => {
    useGameStore.setState({
      techResearch: {
        inProgress: null,
        branches: [
          { id: 'agriculture', name: 'Labranza', techs: [{ id: 't1', name: 'Invernadero de Vidrio', effect: '+20% rendimiento cultivos', cost: { gold: 1 }, completed: false }] },
          { id: 'military', name: 'Arte de la Guerra', techs: [] },
        ],
      },
      loadTechResearch: vi.fn(),
    });
    render(<TechTreePanel />);
    const tab = screen.getByText('Arte de la Guerra').closest('button');
    expect(cls(tab)).toContain('flex-col');
    expect(cls(tab)).toContain('min-w-0');
    const name = screen.getByText('Invernadero de Vidrio');
    expect(cls(name)).toContain('break-words');
    expect(cls(name)).not.toContain('truncate');
    expect(cls(screen.getByText('+20% rendimiento cultivos'))).not.toContain('truncate');
  });

  it('S4 · filtros de Logros hacen wrap en vez de scroll horizontal', () => {
    useGameStore.setState({ achievements: [], loadAchievements: vi.fn(), claimAchievement: vi.fn() });
    render(<AchievementPanel onClose={() => {}} />);
    const f = screen.getByTestId('achievement-filters');
    expect(cls(f)).toContain('flex-wrap');
    expect(cls(f)).not.toContain('overflow-x-auto');
  });

  it('S5 · Configuración: íconos distintos por fila (sin «!» ni llave repetida)', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    const labels = [...container.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'));
    expect(labels).not.toContain('exclamation');
    expect(labels).toEqual(expect.arrayContaining(['moon', 'sun', 'tide']));
    expect(container.textContent).toContain('Silenciar audio');
    expect(container.textContent).toContain('Volumen');
  });
});
