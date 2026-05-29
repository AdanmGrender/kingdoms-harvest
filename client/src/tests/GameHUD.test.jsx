import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../services/socketService', () => ({ connectSocket: vi.fn() }));
vi.mock('../components/ui/SpriteIcon', () => ({
  default: ({ name, fallback }) => <span data-testid={`sprite-${name}`}>{fallback || name}</span>,
  CharacterSprite: () => <span />,
}));
vi.mock('../components/ui/NotificationPrefsPanel', () => ({ default: () => null }));

import useGameStore from '../store/gameStore';
import GameHUD from '../components/overlay/GameHUD';

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    player: { telegram_id: 1, level: 5, xp: 200, display_name: 'TestHero', xp_for_next: 500 },
    resources: { gold: 1500, wheat: 80, wood: 200, stone: 50, iron: 30 },
    tokenInfo: { balance: 750 },
    buildings: [],
    isLoading: false,
  });
});

describe('GameHUD', () => {
  it('renders player level as Lv5', () => {
    render(<GameHUD />);
    expect(screen.getByText('Lv5')).toBeInTheDocument();
  });

  it('renders player display name', () => {
    render(<GameHUD />);
    expect(screen.getByText('TestHero')).toBeInTheDocument();
  });

  it('renders gold formatted as 1.5k when value is 1500', () => {
    render(<GameHUD />);
    expect(screen.getByText('1.5k')).toBeInTheDocument();
  });

  it('renders wheat as plain number when below 1000', () => {
    render(<GameHUD />);
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders token balance', () => {
    render(<GameHUD />);
    expect(screen.getByText('750')).toBeInTheDocument();
  });

  it('returns null when player is null', () => {
    useGameStore.setState({ player: null });
    const { container } = render(<GameHUD />);
    expect(container.firstChild).toBeNull();
  });
});
