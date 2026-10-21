import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

const handlers = {};
const fakeSocket = { connected: false, emit: vi.fn(), on: vi.fn((ev, fn) => { handlers[ev] = fn; }) };
vi.mock('socket.io-client', () => ({ io: vi.fn(() => fakeSocket) }));
vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../components/ui/SpriteIcon', () => ({
  default: ({ name, fallback }) => <span>{fallback || name}</span>,
  CharacterSprite: () => <span />,
}));
vi.mock('../components/ui/NotificationPrefsPanel', () => ({ default: () => null }));

import EventBridge from '../game/EventBridge';
import useGameStore from '../store/gameStore';
import { connectSocket } from '../services/socketService';
import TopResourceBar from '../components/hud/TopResourceBar';

describe('socketService — recarga para recolección (R7, R8)', () => {
  let loadPlots;
  let loadAnimals;
  beforeEach(() => {
    vi.clearAllMocks();
    loadPlots = vi.fn();
    loadAnimals = vi.fn();
    useGameStore.setState({ loadPlots, loadAnimals });
    connectSocket('init');
  });

  it('crop_ready recarga parcelas y conserva el aviso', () => {
    handlers.crop_ready({ count: 2 });
    expect(loadPlots).toHaveBeenCalledTimes(1);
    expect(loadAnimals).not.toHaveBeenCalled();
    expect(EventBridge.emit).toHaveBeenCalledWith('game:notification', expect.objectContaining({ type: 'success' }));
  });

  it('animal_ready recarga animales y conserva el aviso', () => {
    handlers.animal_ready({ animalType: 'vaca' });
    expect(loadAnimals).toHaveBeenCalledTimes(1);
    expect(loadPlots).not.toHaveBeenCalled();
    expect(EventBridge.emit).toHaveBeenCalledWith('game:notification', expect.objectContaining({ type: 'info' }));
  });
});

describe('TopResourceBar — data-resource (R31)', () => {
  it('cada contador principal expone su clave', () => {
    useGameStore.setState({
      player: { telegram_id: 1, level: 1, xp: 0, display_name: 'T', xp_for_next: 100 },
      resources: { gold: 1, wood: 2, stone: 3, wheat: 4, iron: 5 },
      tokenInfo: { balance: 0 },
      troops: [],
      gems: 0,
      loadGems: vi.fn(),
    });
    const { container } = render(<TopResourceBar />);
    const keys = [...container.querySelectorAll('[data-resource]')].map((el) => el.getAttribute('data-resource'));
    expect(keys).toEqual(['wood', 'stone', 'wheat', 'iron']);
  });
});
