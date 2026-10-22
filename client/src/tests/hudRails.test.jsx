/**
 * ui_kit_b etapa B (T15) — rieles del HUD sobre IconButton, sin grimChrome ni gradientes (R36, R37).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import useGameStore from '../store/gameStore';
import EventBridge from '../game/EventBridge';
import BottomNavBar from '../components/hud/BottomNavBar';
import QuickActionsSidebar from '../components/hud/QuickActionsSidebar';
import SocialSidebar from '../components/hud/SocialSidebar';
import EventSidebar from '../components/hud/EventSidebar';

const HUD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../components/hud');

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    setOverlay: vi.fn(),
    addNotification: vi.fn(),
    missions: [{ status: 'active' }, { status: 'done' }],
    activeEvent: null,
    loadActiveEvent: vi.fn(),
  });
});

describe('HUD sin grimChrome (R36)', () => {
  it('grimChrome.js ya no existe y nadie lo importa', () => {
    expect(fs.existsSync(path.join(HUD, 'grimChrome.js'))).toBe(false);
    for (const f of fs.readdirSync(HUD)) {
      expect(fs.readFileSync(path.join(HUD, f), 'utf8'), f).not.toMatch(/grimChrome|grimBtn|grimBar/);
    }
  });

  it.each(['BottomNavBar', 'QuickActionsSidebar', 'EventSidebar', 'SocialSidebar'])('%s.jsx sin gradient', (n) => {
    expect(fs.readFileSync(path.join(HUD, `${n}.jsx`), 'utf8')).not.toMatch(/gradient/i);
  });
});

describe('rieles sobre IconButton (R37)', () => {
  it('BottomNavBar: Héroes → heroes, Mundo → meta/world, castillo → cámara', () => {
    const setOverlay = vi.fn();
    useGameStore.setState({ setOverlay });
    render(<BottomNavBar />);
    fireEvent.click(screen.getByText('Héroes').closest('button'));
    expect(setOverlay).toHaveBeenCalledWith('heroes', {});
    fireEvent.click(screen.getByText('Mundo').closest('button'));
    expect(setOverlay).toHaveBeenCalledWith('meta', { tab: 'world' });
    fireEvent.click(screen.getByLabelText('Castillo'));
    expect(EventBridge.emit).toHaveBeenCalledWith('camera:centerOnCastle');
  });

  it('QuickActionsSidebar: 6 botones ≥44×44 y badge de misiones en kh-seal', () => {
    const { container } = render(<QuickActionsSidebar />);
    const btns = container.querySelectorAll('button');
    expect(btns).toHaveLength(6);
    btns.forEach((b) => expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(44));
    expect(screen.getByText('1').style.backgroundColor).toBe('rgb(122, 31, 26)');
    fireEvent.click(screen.getByText('Misiones').closest('button'));
    expect(useGameStore.getState().setOverlay).toHaveBeenCalledWith('missions', {});
  });

  it('SocialSidebar: Alianza abre meta/alliances', () => {
    render(<SocialSidebar />);
    fireEvent.click(screen.getByText('Alianza').closest('button'));
    expect(useGameStore.getState().setOverlay).toHaveBeenCalledWith('meta', { tab: 'alliances' });
  });

  it('EventSidebar: sin evento muestra «—» y atajos a meta', () => {
    render(<EventSidebar />);
    expect(screen.getByText('—')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tech').closest('button'));
    expect(useGameStore.getState().setOverlay).toHaveBeenCalledWith('meta', { tab: 'tech' });
  });
});
