import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

let stageMode = 'ready';
const stageProps = [];
vi.mock('../components/campaign/CombatStage', async () => {
  const React = await import('react');
  return {
    default: (p) => {
      stageProps.push(p);
      React.useEffect(() => { p.onMode(stageMode); }, []);
      return <div data-testid="stage" data-combat-stage={stageMode} />;
    },
    canRenderCombat: () => stageMode !== 'unavailable',
  };
});

import CombatInstancePanel, { classIcon } from '../components/campaign/CombatInstancePanel';
import useGameStore from '../store/gameStore';
import EventBridge from '../game/EventBridge';
import { getSprite } from '../utils/spriteMap';

const hero = (slot, energy = 0, extra = {}) => ({
  slot, heroId: slot === 1 ? null : `h${slot}`, class: ['warrior', 'mage', 'ranger', 'paladin'][slot % 4], name: slot === 1 ? 'Guarnición' : `Hé${slot}`,
  hp: 50, maxHp: 100, alive: true, energy, energyMax: 100, skill: { icon: 'sword' }, ...extra,
});
const mkState = (enemyHp = 100, heroes = [hero(1)]) => ({ round: 1, maxRounds: 10, enemy: { hp: enemyHp, maxHp: 100 }, heroes });
const NODE = { id: 'a1n3', type: 'combat', name: 'Cripta' };

function setup(stepImpl, heroes = [hero(1)], enemyHp = 100) {
  const stepInstance = vi.fn(stepImpl);
  useGameStore.setState({
    activeRun: { runId: 1, node: NODE, state: mkState(enemyHp, heroes) },
    stepInstance, clearActiveRun: vi.fn(), addNotification: vi.fn(),
  });
  const onClose = vi.fn();
  const view = render(<CombatInstancePanel onClose={onClose} />);
  return { stepInstance, onClose, ...view };
}
const click = (name) => act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const roundDone = () => act(async () => { EventBridge.emit('combat:round-done', { lastT: 1 }); });

beforeEach(() => { vi.useFakeTimers(); stageProps.length = 0; stageMode = 'ready'; });
afterEach(() => { cleanup(); vi.useRealTimers(); EventBridge.removeAllListeners(); });

describe('R5: el resultado sale de data.result, no de los HP', () => {
  it('stepInstance → defeat con el enemigo en 0 HP: banner de derrota', async () => {
    stageMode = 'unavailable';
    const { container } = setup(async () => ({ result: 'defeat' }), [hero(1)], 0);
    await click('Avanzar ronda');
    expect(container.querySelector('[data-outcome="defeat"]')).not.toBeNull();
    expect(container.querySelector('[data-outcome="victory"]')).toBeNull();
    expect(screen.getByText('Derrota')).toBeTruthy();
  });
});

describe('R19: cuándo aparece el ResultBanner', () => {
  it('(a) con escena: no antes de combat:round-done, sí al emitirse', async () => {
    const { container } = setup(async () => ({ result: 'victory', state: mkState(0), roundLog: { round: 1 } }));
    await click('Avanzar ronda');
    expect(container.querySelector('[data-outcome]')).toBeNull();
    await roundDone();
    expect(container.querySelector('[data-outcome="victory"]')).not.toBeNull();
    expect(screen.getByText('¡Victoria!')).toBeTruthy();
  });

  it('(b) la escena no responde: banner a los 4000 ms, no antes', async () => {
    const { container } = setup(async () => ({ result: 'defeat', state: mkState(10) }));
    await click('Avanzar ronda');
    await advance(3999);
    expect(container.querySelector('[data-outcome]')).toBeNull();
    await advance(1);
    expect(container.querySelector('[data-outcome="defeat"]')).not.toBeNull();
  });

  it('con resultado pendiente no se vuelve a llamar a stepInstance mientras se espera la escena', async () => {
    const { stepInstance } = setup(async () => ({ result: 'victory', state: mkState(0) }));
    await click('Avanzar ronda');
    await advance(3900);
    expect(stepInstance).toHaveBeenCalledTimes(1);
  });

  it('(c) escena no disponible: banner en el mismo tick', async () => {
    stageMode = 'unavailable';
    const { container } = setup(async () => ({ result: 'victory' }));
    await click('Avanzar ronda');
    expect(container.querySelector('[data-outcome="victory"]')).not.toBeNull();
  });

  it('el velo de derrota y la fanfarria solo con su resultado (R41)', async () => {
    const { container } = setup(async () => ({ result: 'defeat', state: mkState(10) }));
    await click('Avanzar ronda');
    expect(container.querySelector('[data-defeat-veil]')).toBeNull();
    await roundDone();
    expect(container.querySelector('[data-defeat-veil]')).not.toBeNull();
  });
});

describe('R17: no se avanza mientras la escena reproduce', () => {
  it('mientras playing el auto-avance no llama a stepInstance', async () => {
    const { stepInstance } = setup(async () => ({ state: mkState(80), roundLog: { round: 1 } }));
    await click('Avanzar ronda');
    expect(stepInstance).toHaveBeenCalledTimes(1);
    await advance(3500);                       // < 4000 ms de plazo: sigue reproduciendo
    expect(stepInstance).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Avanzar ronda' }).disabled).toBe(true);
  });

  it('tras round-done hay 300 ms de pausa y recién entonces se avanza', async () => {
    const { stepInstance } = setup(async () => ({ state: mkState(80), roundLog: { round: 1 } }));
    await click('Avanzar ronda');
    await roundDone();
    await advance(299);
    expect(stepInstance).toHaveBeenCalledTimes(1);
    await advance(2);
    expect(stepInstance).toHaveBeenCalledTimes(2);
    expect(stepInstance.mock.calls[1][0]).toEqual({ type: 'advance' });
  });

  it('una habilidad pedida durante la reproducción sale exactamente una vez tras round-done', async () => {
    const { stepInstance } = setup(async () => ({ state: mkState(80), roundLog: { round: 1 } }), [hero(1, 100)]);
    await click('Avanzar ronda');
    const tap = screen.getAllByRole('button').find((b) => b.textContent.includes('Guarnición'));
    await act(async () => { fireEvent.click(tap); fireEvent.click(tap); });
    expect(stepInstance).toHaveBeenCalledTimes(1);   // en cola, no enviada
    await roundDone();
    await advance(400);
    const skills = stepInstance.mock.calls.filter(([a]) => a.type === 'skill');
    expect(skills).toHaveLength(1);
    expect(skills[0][0]).toEqual({ type: 'skill', slot: 1 });
    expect(stepInstance.mock.calls[1][0].type).toBe('skill'); // antes que el advance automático
  });

  it('la ronda llega al stage con state, roundLog y acción', async () => {
    setup(async () => ({ state: mkState(80), roundLog: { round: 1, marker: 'x' } }));
    await click('Avanzar ronda');
    const last = stageProps[stageProps.length - 1];
    expect(last.step).toMatchObject({ id: 1, roundLog: { marker: 'x' }, action: { type: 'advance' } });
    expect(last.step.state.enemy.hp).toBe(80);
    expect(last.state.round).toBe(1);   // estado inicial, no cambia entre rondas
  });

  it('sin escena el auto-avance sigue a los 2000 ms', async () => {
    stageMode = 'unavailable';
    const { stepInstance } = setup(async () => ({ state: mkState(80) }));
    await advance(1999);
    expect(stepInstance).not.toHaveBeenCalled();
    await advance(2);
    expect(stepInstance).toHaveBeenCalledTimes(1);
  });
});

describe('R40/R42: fila de héroes', () => {
  it('3 héroes + Guarnición: sin /assets/game/ en src ni backgroundImage, ícono de clase del kit', () => {
    stageMode = 'unavailable';
    const hs = [hero(1), hero(2), hero(3), hero(4)];
    const { container } = setup(async () => ({}), hs);
    expect(container.innerHTML).not.toMatch(/assets\/game/);
    for (const el of container.querySelectorAll('[style]')) expect(el.getAttribute('style')).not.toMatch(/assets\/game/);
    expect(container.querySelectorAll('img').length).toBe(0);
    expect(screen.getByText('Guarnición')).toBeTruthy();
    for (const h of hs) expect(getSprite(classIcon(h)), h.class).toBeTruthy();
    expect(container.querySelector('[data-missing-icon]')).toBeNull();
  });

  it('el botón de habilidad solo está activo con energía llena y héroe vivo', () => {
    stageMode = 'unavailable';
    setup(async () => ({}), [hero(1, 100), hero(2, 40), hero(3, 100, { alive: false, hp: 0 })]);
    const btn = (n) => screen.getByText(n).closest('button');
    expect(btn('Guarnición').disabled).toBe(false);
    expect(btn('Hé2').disabled).toBe(true);
    expect(btn('Hé3').disabled).toBe(true);
  });

  it('conserva título con ronda, barra del enemigo, cierre del kit y área táctil ≥ 44', () => {
    stageMode = 'unavailable';
    const { container, onClose } = setup(async () => ({}));
    expect(screen.getByText(/Cripta · ronda 1\/10/)).toBeTruthy();
    expect(screen.getByLabelText('Vida del enemigo')).toBeTruthy();
    const close = container.querySelector('.kh-close');
    expect(close.style.minWidth).toBe('44px');
    expect(close.style.minHeight).toBe('44px');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('cierre con ronda en curso', () => {
  it('desmontar con la ronda en curso no lanza ni deja listeners de round-done', async () => {
    const { unmount } = setup(async () => ({ state: mkState(80) }));
    await click('Avanzar ronda');
    unmount();
    expect(EventBridge.listenerCount('combat:round-done')).toBe(0);
    await expect(advance(5000)).resolves.not.toThrow();
  });
});
