import { describe, it, expect, beforeEach, vi } from 'vitest';

const handlers = {};
const fakeSocket = { connected: false, emit: vi.fn(), on: vi.fn((ev, fn) => { handlers[ev] = fn; }) };
vi.mock('socket.io-client', () => ({ io: vi.fn(() => fakeSocket) }));
vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import EventBridge from '../game/EventBridge';
import useGameStore from '../store/gameStore';
import { connectSocket } from '../services/socketService';

describe('socketService — building_complete refresca el hub (R37, R39)', () => {
  let loadBuildings;
  beforeEach(() => {
    vi.clearAllMocks();
    loadBuildings = vi.fn();
    useGameStore.setState({ loadBuildings });
    connectSocket('init');
  });

  it('recarga los edificios y conserva el aviso', () => {
    handlers.building_complete({ buildingType: 'barn' });
    expect(loadBuildings).toHaveBeenCalledTimes(1);
    expect(EventBridge.emit).toHaveBeenCalledWith(
      'game:notification',
      expect.objectContaining({ type: 'success', text: expect.stringContaining('barn') }),
    );
  });

  it('no emite eventos nuevos en EventBridge (R39)', () => {
    handlers.building_complete({ buildingType: 'barn' });
    const events = EventBridge.emit.mock.calls.map((c) => c[0]);
    expect(events).toEqual(['game:notification']);
  });
});
