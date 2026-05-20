import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../components/overlay/WarPanel', () => ({ default: () => <div data-testid="war-panel" /> }));
vi.mock('../components/overlay/HeroPanel', () => ({ default: () => <div data-testid="hero-panel" /> }));
vi.mock('../components/overlay/GuildPanel', () => ({ default: () => <div data-testid="guild-panel" /> }));
vi.mock('../components/overlay/WithdrawalPanel', () => ({ default: () => <div data-testid="withdrawal-panel" /> }));
vi.mock('../components/overlay/VillagerPanel', () => ({ default: () => <div data-testid="villager-panel" /> }));
vi.mock('../components/overlay/CraftingPanel', () => ({ default: () => <div data-testid="crafting-panel" /> }));
vi.mock('../components/overlay/TroopManagementPanel', () => ({ default: () => <div data-testid="troop-panel" /> }));
vi.mock('../components/overlay/WorldEventPanel', () => ({ default: () => <div data-testid="world-event-panel" /> }));
vi.mock('../components/overlay/AchievementPanel', () => ({ default: () => <div data-testid="achievement-panel" /> }));
vi.mock('../components/overlay/MarketplacePanel', () => ({ default: () => <div data-testid="marketplace-panel" /> }));
vi.mock('../components/overlay/SeasonalPanel', () => ({ default: () => <div data-testid="seasonal-panel" /> }));
vi.mock('../components/overlay/PrestigePanel', () => ({ default: () => <div data-testid="prestige-panel" /> }));
vi.mock('../components/overlay/DialogPanel', () => ({ default: () => <div data-testid="dialog-panel" /> }));
vi.mock('../components/overlay/CropSelectMenu', () => ({ default: () => <div data-testid="crop-select-panel" /> }));
vi.mock('../components/ui/SpriteIcon', () => ({ default: () => null, CharacterSprite: () => null }));
vi.mock('../components/commerce/CommerceView', () => ({ default: () => <div data-testid="commerce-panel" /> }));
vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../services/socketService', () => ({ connectSocket: vi.fn() }));

import useGameStore from '../store/gameStore';
import OverlayManager from '../components/overlay/OverlayManager';

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    overlayState: null,
    player: { telegram_id: 1, level: 1, display_name: 'T', xp: 0 },
    buildings: [],
    animals: [],
    plots: [],
  });
});

describe('OverlayManager', () => {
  it('renders nothing when overlayState is null', () => {
    const { container } = render(<OverlayManager />);
    expect(container.firstChild).toBeNull();
  });

  it('renders war-panel when overlayState type is "combat"', () => {
    useGameStore.setState({ overlayState: { type: 'combat', data: {} } });
    render(<OverlayManager />);
    expect(screen.getByTestId('war-panel')).toBeInTheDocument();
  });

  it('renders hero-panel when overlayState type is "heroes"', () => {
    useGameStore.setState({ overlayState: { type: 'heroes', data: {} } });
    render(<OverlayManager />);
    expect(screen.getByTestId('hero-panel')).toBeInTheDocument();
  });

  it('renders guild-panel when overlayState type is "guild"', () => {
    useGameStore.setState({ overlayState: { type: 'guild', data: {} } });
    render(<OverlayManager />);
    expect(screen.getByTestId('guild-panel')).toBeInTheDocument();
  });

  it('renders withdrawal-panel when overlayState type is "withdrawal"', () => {
    useGameStore.setState({ overlayState: { type: 'withdrawal', data: {} } });
    render(<OverlayManager />);
    expect(screen.getByTestId('withdrawal-panel')).toBeInTheDocument();
  });
});
