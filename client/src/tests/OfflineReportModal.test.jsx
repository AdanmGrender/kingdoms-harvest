/**
 * reporte_escribano T6 — OfflineReportModal: libro de cuentas del Escribano (R15–R29).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';

vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../services/socketService', () => ({ connectSocket: vi.fn() }));

import useGameStore from '../store/gameStore';
import OfflineReportModal, { formatAway } from '../components/overlay/OfflineReportModal';
import { ESCRIBANO_LINES } from '../config/escribanoLines';
import { EMOJI_RE } from './helpers/emoji';

const MIN = 60000;
const HOUR = 60 * MIN;

function baseReport(over = {}) {
  return {
    awayMs: 2 * HOUR,
    resources: { wheat: 40, wood: 25 },
    khEarned: 0,
    catchUp: {},
    downtimeMs: 0,
    events: [],
    ...over,
  };
}

function show(report) {
  useGameStore.setState({ offlineReport: report });
  return render(<OfflineReportModal />);
}

const allLines = Object.values(ESCRIBANO_LINES).flat();
const shownLines = () => allLines.filter((l) => screen.queryByText(`«${l}»`));

beforeEach(() => {
  useGameStore.setState({ offlineReport: null });
});

describe('contenedor y títulos (R15, R16, R17)', () => {
  it('sin reporte no renderiza nada', () => {
    const { container } = show(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('usa Panel parchment sobre el fondo oscurecido a pantalla completa', () => {
    const { container } = show(baseReport());
    const outer = container.firstChild;
    expect(outer.className).toMatch(/fixed/);
    expect(outer.className).toMatch(/inset-0/);
    expect(outer.className).toMatch(/z-\[60\]/);
    const panel = outer.querySelector('[data-variant="parchment"]');
    expect(panel).not.toBeNull();
    expect(panel.style.backgroundColor).toBe('rgb(216, 200, 160)');
  });

  it('muestra título y subtítulo', () => {
    show(baseReport());
    expect(screen.getByText('Libro de cuentas del Escribano')).toBeInTheDocument();
    expect(screen.getByText('Mientras no estabas')).toBeInTheDocument();
  });
});

describe('formatAway (R18)', () => {
  it.each([
    [5 * MIN, '5 min'],
    [59 * MIN, '59 min'],
    [60 * MIN, '1 h 0 min'],
    [125 * MIN, '2 h 5 min'],
    [47 * HOUR + 59 * MIN, '47 h 59 min'],
    [48 * HOUR, '2 días'],
    [72 * HOUR, '3 días'],
  ])('%i ms -> %s', (ms, text) => {
    expect(formatAway(ms)).toBe(text);
  });

  it('el modal muestra «Ausente …»', () => {
    show(baseReport({ awayMs: 125 * MIN }));
    expect(screen.getByText('Ausente 2 h 5 min')).toBeInTheDocument();
  });
});

describe('recursos y recuperación (R19, R20)', () => {
  it('una fila por recurso con nombre en español y monto', () => {
    show(baseReport());
    expect(screen.getByText('Trigo')).toBeInTheDocument();
    expect(screen.getByText('+40')).toBeInTheDocument();
    expect(screen.getByText('Madera')).toBeInTheDocument();
    expect(screen.getByText('+25')).toBeInTheDocument();
  });

  it('un id sin nombre muestra el id', () => {
    show(baseReport({ resources: { zzz_raro: 7 } }));
    expect(screen.getByText('zzz_raro')).toBeInTheDocument();
    expect(screen.getByText('+7')).toBeInTheDocument();
  });

  it('con catchUp muestra «(incluye recuperación)»; sin catchUp no', () => {
    const { unmount } = show(baseReport({ catchUp: { wheat: 20 } }));
    expect(screen.getByText(/\(incluye recuperación\)/)).toBeInTheDocument();
    unmount();
    show(baseReport());
    expect(screen.queryByText(/incluye recuperación/)).toBeNull();
  });
});

describe('KH y sucesos (R21, R22)', () => {
  it('khEarned > 0 muestra +X KH; 0 oculta el bloque', () => {
    const { unmount } = show(baseReport({ khEarned: 1.5 }));
    expect(screen.getByText('+1.5 KH')).toBeInTheDocument();
    unmount();
    show(baseReport({ khEarned: 0 }));
    expect(screen.queryByText(/KH/)).toBeNull();
  });

  it('muestra el texto de cada suceso y no el emoji del servidor', () => {
    const { container } = show(baseReport({
      events: [
        { icon: '🌾', text: '3 cultivo(s) esperando cosecha' },
        { icon: '🛡️', text: 'Tu bastión fue atacado 2 vez/veces' },
      ],
    }));
    expect(screen.getByText('Sucesos')).toBeInTheDocument();
    expect(screen.getByText('3 cultivo(s) esperando cosecha')).toBeInTheDocument();
    expect(screen.getByText('Tu bastión fue atacado 2 vez/veces')).toBeInTheDocument();
    expect(container.textContent.match(EMOJI_RE)).toBeNull();
  });
});

describe('tope de granero (R23, R24, R25)', () => {
  it('muestra «amount / capacity» en la fila del recurso', () => {
    show(baseReport({ storage: { wheat: { amount: 480, capacity: 500 } } }));
    const row = screen.getByText('Trigo').closest('li');
    expect(within(row).getByText('480 / 500')).toBeInTheDocument();
    expect(within(row).queryByText('Granero lleno')).toBeNull();
    // la fila de madera no tiene entrada: sin tope
    const wood = screen.getByText('Madera').closest('li');
    expect(wood.textContent).not.toMatch(/\//);
  });

  it('recurso lleno dentro de resources: «Granero lleno» en su fila', () => {
    show(baseReport({ storage: { wheat: { amount: 500, capacity: 500 } } }));
    const row = screen.getByText('Trigo').closest('li');
    expect(within(row).getByText('Granero lleno')).toBeInTheDocument();
    expect(within(row).getByText('500 / 500')).toBeInTheDocument();
  });

  it('recurso lleno fuera de resources: fila propia con «Granero lleno»', () => {
    show(baseReport({
      resources: { wheat: 40 },
      storage: { stone: { amount: 1000, capacity: 1000 } },
    }));
    expect(screen.getByText('Granero lleno')).toBeInTheDocument();
    const row = screen.getByText('Piedra').closest('li');
    expect(within(row).getByText('Granero lleno')).toBeInTheDocument();
    expect(row.textContent).toContain('1000 / 1000');
  });

  it('un reporte con solo un recurso lleno fuera de resources se renderiza sin error', () => {
    show(baseReport({ resources: {}, storage: { stone: { amount: 9, capacity: 9 } } }));
    expect(screen.getByText('Granero lleno')).toBeInTheDocument();
  });

  it('sin storage: mismas filas, sin tope ni «Granero lleno» y sin excepción', () => {
    const report = baseReport();
    delete report.storage;
    const { container } = show(report);
    expect(screen.getByText('Trigo')).toBeInTheDocument();
    expect(screen.getByText('Madera')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ \/ /);
    expect(screen.queryByText('Granero lleno')).toBeNull();
  });
});

describe('frase del Escribano (R26)', () => {
  it('muestra una sola frase del catálogo y la mantiene entre re-renders', () => {
    const { rerender } = show(baseReport());
    const first = shownLines();
    expect(first).toHaveLength(1);
    expect(screen.getByText('— El Escribano')).toBeInTheDocument();
    rerender(<OfflineReportModal />);
    expect(shownLines()).toEqual(first);
  });

  it('con granero lleno la frase es del cubo lleno', () => {
    show(baseReport({ storage: { wheat: { amount: 500, capacity: 500 } } }));
    const shown = shownLines();
    expect(shown).toHaveLength(1);
    expect(ESCRIBANO_LINES.lleno).toContain(shown[0]);
  });
});

describe('botón (R27, R29)', () => {
  it('«Retomar el mando» es un Button del kit de 44 px o más y descarta el reporte', () => {
    const { container } = show(baseReport());
    const btn = screen.getByRole('button', { name: 'Retomar el mando' });
    expect(btn).toHaveAttribute('data-variant', 'primary');
    expect(parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    fireEvent.click(btn);
    expect(useGameStore.getState().offlineReport).toBeNull();
    // el modal lee del store: tras descartar debe desaparecer
    expect(container.querySelector('[data-variant="parchment"]')).toBeNull();
  });
});

describe('paleta (R28)', () => {
  it('el HTML no usa verde ni kh-macula ni rgba en línea', () => {
    const { container } = show(baseReport({
      khEarned: 2,
      events: [{ icon: 'x', text: 'algo' }],
      storage: { wheat: { amount: 500, capacity: 500 } },
    }));
    expect(container.innerHTML).not.toMatch(/green/i);
    expect(container.innerHTML).not.toMatch(/macula/i);
    expect(container.innerHTML).not.toMatch(/rgba\(/);
  });
});
