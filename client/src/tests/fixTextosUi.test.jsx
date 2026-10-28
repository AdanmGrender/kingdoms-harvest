// fix_textos_ui (#25): textos duplicados o en inglés en menú, operaciones e investigación.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/socketService', () => ({ connectSocket: vi.fn() }));

import useGameStore from '../store/gameStore';
import MainMenu from '../components/menu/MainMenu';
import OperationsMap from '../components/campaign/OperationsMap';
import TechTreePanel from '../components/castle/TechTreePanel';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('MainMenu — T1: nombre del comandante sin repetir "Comandante"', () => {
  it('no muestra "Comandante Comandante" cuando el display_name es el default', () => {
    useGameStore.setState({ player: { display_name: 'Comandante', level: 1 } });
    const { container } = render(<MainMenu />);
    const text = container.textContent;
    expect(text).not.toContain('Comandante Comandante');
    expect(text).toContain('Comandante · Nv. 1');
  });

  it('antepone "Comandante" a un nombre propio', () => {
    useGameStore.setState({ player: { display_name: 'Aldric', level: 3 } });
    const { container } = render(<MainMenu />);
    expect(container.textContent).toContain('Comandante Aldric · Nv. 3');
  });
});

describe('MainMenu — T2: versión "vdev" oculta fuera de desarrollo', () => {
  it('no muestra "vdev" cuando no hay versión real y no es desarrollo', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_APP_VERSION', '');
    useGameStore.setState({ player: { display_name: 'Aldric', level: 3 } });
    const { container } = render(<MainMenu />);
    expect(container.textContent).not.toContain('vdev');
  });

  it('muestra la versión real cuando está definida', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_APP_VERSION', '1.2.0');
    useGameStore.setState({ player: { display_name: 'Aldric', level: 3 } });
    const { container } = render(<MainMenu />);
    expect(container.textContent).toContain('v1.2.0');
  });
});

describe('OperationsMap — T3: tipo de nodo en español', () => {
  const nodes = [
    { id: 'n1', name: 'Puesto', type: 'manage', status: 'cleared', act: 1 },
    { id: 'n2', name: 'Granja', type: 'collect', status: 'available', act: 1 },
    { id: 'n3', name: 'Asalto', type: 'combat', status: 'available', act: 1 },
    { id: 'n4', name: 'Oleada', type: 'wave', status: 'available', act: 1 },
    { id: 'n5', name: 'Señor', type: 'boss', status: 'available', act: 1, isBoss: true },
  ];

  it('muestra etiquetas en español y ningún tipo en inglés', () => {
    useGameStore.setState({
      campaignNodes: nodes,
      sweepsLeft: 0,
      loadCampaignMap: vi.fn(),
    });
    const { container } = render(<OperationsMap onClose={() => {}} />);
    const text = container.textContent;
    for (const label of ['Gestión', 'Recolección', 'Combate', 'Oleada', 'Jefe']) {
      expect(text).toContain(label);
    }
    for (const eng of ['manage', 'collect', 'combat', 'wave', 'boss']) {
      expect(text).not.toContain(eng);
    }
  });
});

describe('TechTreePanel — T4: costos con nombres de recurso en español', () => {
  it('muestra "Oro", "Piedra" y "Ascua de Faro" en lugar de gold/stone/crystal', async () => {
    useGameStore.setState({
      techResearch: {
        inProgress: null,
        branches: [
          {
            id: 'commerce',
            name: 'Comercio',
            techs: [
              {
                id: 't1',
                name: 'Ruta',
                effect: 'Más oro',
                cost: { gold: 100, stone: 50, crystal: 1 },
                completed: false,
                inProgress: false,
              },
            ],
          },
        ],
      },
      loadTechResearch: vi.fn(),
      startResearch: vi.fn(),
    });
    // commerce no es la rama por defecto: la activamos con el botón
    const { container } = render(<TechTreePanel />);
    await userEvent.click(screen.getByText('Comercio', { exact: false }));
    const text = container.textContent;
    expect(text).toContain('Costo: 100 Oro, 50 Piedra, 1 Ascua de Faro');
    expect(text).not.toMatch(/\b(gold|stone|crystal)\b/);
  });
});
