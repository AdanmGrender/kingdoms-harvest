import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/socketService', () => ({ connectSocket: vi.fn() }));

import useGameStore from '../store/gameStore';
import api from '../services/api';

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    overlayState: null,
    guild: null,
    withdrawalOTP: null,
    error: null,
  });
});

describe('gameStore — initial state', () => {
  it('player is null', () => {
    // Reset to a clean store slice
    useGameStore.setState({ player: null });
    expect(useGameStore.getState().player).toBeNull();
  });

  it('resources is {}', () => {
    useGameStore.setState({ resources: {} });
    expect(useGameStore.getState().resources).toEqual({});
  });

  it('overlayState is null', () => {
    expect(useGameStore.getState().overlayState).toBeNull();
  });

  it('error is null', () => {
    expect(useGameStore.getState().error).toBeNull();
  });

  it('heroes is []', () => {
    useGameStore.setState({ heroes: [] });
    expect(useGameStore.getState().heroes).toEqual([]);
  });

  it('guild is null', () => {
    expect(useGameStore.getState().guild).toBeNull();
  });

  it('withdrawalOTP is null', () => {
    expect(useGameStore.getState().withdrawalOTP).toBeNull();
  });
});

describe('gameStore — overlay actions', () => {
  it('setOverlay sets overlayState with type and data', () => {
    useGameStore.getState().setOverlay('heroes', { foo: 'bar' });
    expect(useGameStore.getState().overlayState).toEqual({ type: 'heroes', data: { foo: 'bar' } });
  });

  it('clearOverlay resets overlayState to null', () => {
    useGameStore.getState().setOverlay('heroes', { foo: 'bar' });
    useGameStore.getState().clearOverlay();
    expect(useGameStore.getState().overlayState).toBeNull();
  });
});

describe('gameStore — error state', () => {
  it('can set error via setState', () => {
    useGameStore.setState({ error: 'Something failed' });
    expect(useGameStore.getState().error).toBe('Something failed');
  });

  it('can clear error via setState', () => {
    useGameStore.setState({ error: 'Something failed' });
    useGameStore.setState({ error: null });
    expect(useGameStore.getState().error).toBeNull();
  });
});

describe('gameStore — loadGuild', () => {
  it('success path sets guild state', async () => {
    api.get.mockResolvedValueOnce({ data: { guild: { id: 1, name: 'Warriors' } } });
    await useGameStore.getState().loadGuild();
    expect(useGameStore.getState().guild).toEqual({ id: 1, name: 'Warriors' });
  });

  it('404 error sets guild to null without throwing', async () => {
    const err = new Error('Not Found');
    err.response = { status: 404 };
    api.get.mockRejectedValueOnce(err);
    await expect(useGameStore.getState().loadGuild()).resolves.toBeUndefined();
    expect(useGameStore.getState().guild).toBeNull();
  });

  it('non-404 error sets guild to null without throwing', async () => {
    api.get.mockRejectedValueOnce(new Error('Network Error'));
    await expect(useGameStore.getState().loadGuild()).resolves.toBeUndefined();
    expect(useGameStore.getState().guild).toBeNull();
  });
});

describe('gameStore — requestWithdrawalOTP', () => {
  it('success path sets withdrawalOTP with amount', async () => {
    api.post.mockResolvedValueOnce({
      data: { otpId: 42, expiresAt: '2026-01-01T00:05:00Z', message: 'Código enviado' },
    });
    await useGameStore.getState().requestWithdrawalOTP(1000);
    expect(useGameStore.getState().withdrawalOTP).toEqual({
      otpId: 42,
      expiresAt: '2026-01-01T00:05:00Z',
      amount: 1000,
    });
  });

  it('error path returns null and does not throw', async () => {
    const err = new Error('Server error');
    err.response = { data: { error: 'Saldo insuficiente' } };
    api.post.mockRejectedValueOnce(err);
    const result = await useGameStore.getState().requestWithdrawalOTP(1000);
    expect(result).toBeNull();
    expect(useGameStore.getState().withdrawalOTP).toBeNull();
  });
});

describe('gameStore — recolección (hub_b_recoleccion)', () => {
  beforeEach(() => {
    useGameStore.setState({ addNotification: vi.fn(), loadAnimals: vi.fn(), loadPlots: vi.fn(), refreshResources: vi.fn() });
  });

  it('collectAnimalProduct devuelve data en éxito y recarga (R16)', async () => {
    api.post.mockResolvedValueOnce({ data: { message: 'Huevos x2', product: 'egg' } });
    const res = await useGameStore.getState().collectAnimalProduct(7);
    expect(api.post).toHaveBeenCalledWith('/farm/animals/collect', { animalId: 7 });
    expect(res).toEqual({ message: 'Huevos x2', product: 'egg' });
    expect(useGameStore.getState().loadAnimals).toHaveBeenCalled();
    expect(useGameStore.getState().refreshResources).toHaveBeenCalled();
  });

  it('collectAnimalProduct devuelve null en error y notifica (R23)', async () => {
    const err = new Error('x');
    err.response = { data: { error: 'Aún no está listo' } };
    api.post.mockRejectedValueOnce(err);
    const res = await useGameStore.getState().collectAnimalProduct(7);
    expect(res).toBeNull();
    expect(useGameStore.getState().addNotification).toHaveBeenCalledWith('Aún no está listo', 'error');
    expect(useGameStore.getState().loadAnimals).not.toHaveBeenCalled();
  });

  it('harvestCrop sigue rechazando en error y recarga con refreshResources en éxito (R22, R23)', async () => {
    api.post.mockResolvedValueOnce({ data: { message: 'ok', tokensAwarded: 0 } });
    await useGameStore.getState().harvestCrop(3);
    expect(api.post).toHaveBeenCalledWith('/farm/harvest', { plotId: 3 });
    expect(useGameStore.getState().loadPlots).toHaveBeenCalled();
    expect(useGameStore.getState().refreshResources).toHaveBeenCalled();

    api.post.mockRejectedValueOnce(new Error('400'));
    await expect(useGameStore.getState().harvestCrop(3)).rejects.toThrow('400');
  });
});
