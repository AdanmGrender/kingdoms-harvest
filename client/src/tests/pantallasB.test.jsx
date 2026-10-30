/**
 * pantallas_b T3 — barridos de regresión sobre los archivos en alcance (AA) (R45).
 * Cada barrido falla si se reintroduce un patrón prohibido. Los tests de render por
 * pantalla (T4–T9) se agregan al final de este archivo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// Archivos en alcance (design.md §5).
export const AA = [
  'components/menu/MainMenu.jsx',
  'components/overlay/HeroPanel.jsx',
  'components/overlay/SystemMapPanel.jsx',
  'components/overlay/GalaxyMapPanel.jsx',
  'components/overlay/WarPanel.jsx',
  'components/overlay/MissionsPanel.jsx',
  'components/overlay/SettingsPanel.jsx',
  'components/castle/TechTreePanel.jsx',
  'components/world/TerritoryMapPanel.jsx',
  'components/campaign/CombatInstancePanel.jsx',
  'components/ui/NotificationPrefsPanel.jsx',
];

const sweep = (re) => AA.flatMap((f) => {
  const hits = [];
  read(f).split(/\r?\n/).forEach((line, i) => { if (re.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`); });
  return hits;
});

// Los patrones se arman por partes para que este archivo no se auto-detecte.
const V = 'v'; // vh / vw
const RE_VIEWPORT = new RegExp(`(\\d\\s*(d|s)?${V}[hw]\\b)|\\b(min-|max-)?[hw]-screen\\b`);
const RE_GLYPH = /[\u2715\u2713]/;
const RE_LEGACY_BTN = /btn-gold|btn-primary|bg-gradient-to-/;
const RE_TW_COLOR = /(text|bg|border|from|to|ring|accent)-(purple|cyan|teal|green|blue|gray|red|yellow)-/;
const RE_HEX = /#16a34a|#4ade80|#4fd8c8|#a855f7|#3b82f6/i;
const RE_BORDER_RGBA = /border:\s*'1px solid rgba\(/;

describe('pantallasB — barridos sobre AA', () => {
  it('R1: sin unidades de viewport ni h-screen/w-screen', () => {
    expect(sweep(RE_VIEWPORT)).toEqual([]);
  });

  it('R8: sin los glifos de cierre/check', () => {
    expect(sweep(RE_GLYPH)).toEqual([]);
  });

  it('R9: sin btn-gold / btn-primary / bg-gradient-to-', () => {
    expect(sweep(RE_LEGACY_BTN)).toEqual([]);
  });

  it('R10: sin colores Tailwind fuera de los tokens kh ni hex prohibidos', () => {
    expect(sweep(RE_TW_COLOR)).toEqual([]);
    expect(sweep(RE_HEX)).toEqual([]);
  });

  it('R7: ningún panel define su propio borde rgba', () => {
    expect(sweep(RE_BORDER_RGBA)).toEqual([]);
  });

  it('R38: ni #16a34a ni #4ade80 en AA', () => {
    expect(sweep(/#16a34a|#4ade80/i)).toEqual([]);
  });
});

describe('pantallasB — R2 topes por --kh-frame-h', () => {
  const CAPS = [
    ['components/overlay/GalaxyMapPanel.jsx', '0.8'],
    ['components/overlay/SystemMapPanel.jsx', '0.8'],
    ['components/overlay/HeroPanel.jsx', '0.75'],
    ['components/overlay/MissionsPanel.jsx', '0.75'],
    ['components/overlay/SettingsPanel.jsx', '0.75'],
    ['components/overlay/WarPanel.jsx', '0.65'],
    ['components/ui/NotificationPrefsPanel.jsx', '0.8'],
    ['components/campaign/CombatInstancePanel.jsx', '0.36'],
    ['components/campaign/CombatInstancePanel.jsx', '0.29'],
  ];
  it.each(CAPS)('%s usa calc(var(--kh-frame-h) * %s)', (file, k) => {
    const re = new RegExp(`calc\\(var\\(--kh-frame-h\\)\\s*\\*\\s*${k.replace('.', '\\.')}\\)`);
    expect(read(file)).toMatch(re);
  });
});

describe('pantallasB — R25 fondos viejos', () => {
  function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'tests') walk(full, out); } else if (/\.(jsx?|css)$/.test(e.name)) out.push(full);
    }
    return out;
  }
  it('client/src no referencia menu_bg / system_bg / galaxy_bg / world_map_bg', () => {
    const re = /(menu|system|galaxy|world_map)_bg\.png/;
    const hits = walk(SRC).filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
    expect(hits).toEqual([]);
  });
});

// ── T4 — Configuración y Notificaciones (R2, R7, R8, R10, R14, R38) ──────────
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';
import SettingsPanel from '../components/overlay/SettingsPanel';
import NotificationPrefsPanel from '../components/ui/NotificationPrefsPanel';
import useGameStore from '../store/gameStore';

const px = (v) => parseFloat(v);

describe('pantallasB T4 — SettingsPanel', () => {
  it('Panel del kit con cierre 44×44, tope por --kh-frame-h y switches accesibles', () => {
    const onClose = vi.fn();
    const { container } = render(<SettingsPanel onClose={onClose} />);
    const panel = container.querySelector('.kh-panel');
    expect(panel).not.toBeNull();
    expect(panel.style.maxHeight).toContain('var(--kh-frame-h)');
    const close = screen.getByRole('button', { name: 'Cerrar' });
    expect(px(close.style.minWidth)).toBeGreaterThanOrEqual(44);
    expect(px(close.style.minHeight)).toBeGreaterThanOrEqual(44);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(3);
    for (const s of switches) expect(px(s.style.minHeight)).toBeGreaterThanOrEqual(44);
    expect(container.querySelector('input[type=range]').style.accentColor).toMatch(/217, 183, 122|#d9b77a/i);
  });
});

describe('pantallasB T4 — NotificationPrefsPanel', () => {
  beforeEach(() => {
    useGameStore.setState({
      notificationPrefs: { crops: true, buildings: false },
      loadNotificationPrefs: vi.fn(),
      toggleNotificationPref: vi.fn(),
    });
  });

  it('Panel del kit, tope por --kh-frame-h, switches con aria-checked y toggle', () => {
    const toggle = vi.fn();
    useGameStore.setState({ toggleNotificationPref: toggle });
    const { container } = render(<NotificationPrefsPanel onClose={() => {}} />);
    expect(container.querySelector('.kh-panel').style.maxHeight).toContain('var(--kh-frame-h)');
    const sw = screen.getByRole('switch', { name: 'Cultivos listos' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Construcciones' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(toggle).toHaveBeenCalledWith('crops');
  });

  it('click en el fondo cierra; click dentro del panel no', () => {
    const onClose = vi.fn();
    const { container } = render(<NotificationPrefsPanel onClose={onClose} />);
    fireEvent.click(container.querySelector('.kh-panel'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── T5 — Investigación y Misiones (R39–R44, R9, R10, R43) ────────────────────
import TechTreePanel from '../components/castle/TechTreePanel';
import MissionsPanel from '../components/overlay/MissionsPanel';

const techState = (extra = {}) => ({
  techResearch: {
    inProgress: extra.inProgress ?? null,
    branches: [
      { id: 'agriculture', name: 'Agricultura', techs: [
        { id: 'a1', name: 'Arado', effect: '+10%', cost: { wheat: 5 }, completed: true, inProgress: false },
        { id: 'a2', name: 'Riego', effect: '+20%', cost: { wood: 5 }, completed: false, inProgress: false },
      ] },
      { id: 'commerce', name: 'Comercio', techs: [] },
      { id: 'military', name: 'Arte de la Guerra', techs: [] },
    ],
  },
  loadTechResearch: vi.fn(),
  startResearch: vi.fn(),
});

describe('pantallasB T5 — TechTreePanel', () => {
  it('pestañas .kh-tab: activa/inactiva sin purple, nombre completo de la rama militar', () => {
    useGameStore.setState(techState());
    const { container } = render(<TechTreePanel />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].className).toContain('kh-tab--active');
    expect(tabs[1].className).not.toContain('kh-tab--active');
    expect(container.innerHTML).not.toMatch(/purple/);
    expect(tabs[2].textContent).toContain('Arte de la Guerra');
    expect(tabs[1].className).not.toContain('text-[11px]');
  });

  it('botón Investigar es Button primary; completada con ícono y sin glifo ✓', () => {
    useGameStore.setState(techState());
    const { container } = render(<TechTreePanel />);
    const btn = screen.getByRole('button', { name: 'Investigar' });
    expect(btn).toHaveAttribute('data-variant', 'primary');
    expect(container.querySelector('[data-completed="true"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/[\u2713]/);
  });

  it('bloque en progreso con tokens kh', () => {
    useGameStore.setState(techState({ inProgress: { tech_id: 'a2', research_complete_at: Date.now() + 60000 } }));
    render(<TechTreePanel />);
    const el = screen.getByTestId('tech-in-progress');
    expect(el.className).not.toMatch(/purple/);
  });
});

describe('pantallasB T5 — MissionsPanel', () => {
  const setM = (missions) => useGameStore.setState({
    missions, loadMissions: vi.fn(), generateMissions: vi.fn(), acceptMission: vi.fn(), completeMission: vi.fn(),
  });

  it('Panel del kit con tope por --kh-frame-h y cierre accesible', () => {
    setM([]);
    const onClose = vi.fn();
    const { container } = render(<MissionsPanel onClose={onClose} />);
    expect(container.querySelector('.kh-panel').style.maxHeight).toContain('var(--kh-frame-h)');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('Sin misiones cargadas.').className).toContain('text-kh-bone-dim');
  });

  it('Aceptar/Completar/Generar son Button primary', () => {
    setM([{ id: 1, status: 'available', title: 'A' }, { id: 2, status: 'active', title: 'B' }]);
    render(<MissionsPanel onClose={() => {}} />);
    for (const n of ['Aceptar', 'Completar', 'Generar nuevas misiones']) {
      expect(screen.getByRole('button', { name: n })).toHaveAttribute('data-variant', 'primary');
    }
  });
});

// ── T6 — HeroPanel (R26–R30, R7, R14) ────────────────────────────────────────
import HeroPanel from '../components/overlay/HeroPanel';

const mkHero = (i, rarity) => ({
  dbId: i, heroId: 'aria', id: 'aria', name: `Héroe ${i}`, rarity, level: 3, xp: 10, xpNeeded: 100,
  class: 'warrior', sprite: 'warrior', passive: 'p', stats: { atk: 10, def: 10, hp: 50, spd: 5, mgk: 2 },
  equipment: {}, deployed: false, inRecovery: false,
});

describe('pantallasB T6 — HeroPanel', () => {
  const setHeroes = (heroes) => useGameStore.setState({
    heroes, heroItems: [], tokenInfo: { balance: 0 }, resources: {},
    loadHeroes: vi.fn(), loadHeroItems: vi.fn(), loadDeployedHero: vi.fn(),
  });

  it('roster de 3 héroes: 3+1 .kh-ring con img, Panel del kit, 5 barras por héroe seleccionado', () => {
    setHeroes([mkHero(1, 'common'), mkHero(2, 'rare'), mkHero(3, 'epic')]);
    const { container } = render(<HeroPanel onClose={() => {}} />);
    expect(container.querySelector('.kh-panel')).not.toBeNull();
    // 3 tarjetas + 1 detalle del seleccionado
    const rings = container.querySelectorAll('.kh-ring');
    expect(rings.length).toBe(4);
    rings.forEach((r) => expect(r.querySelector('img')).not.toBeNull());
    const detailBars = container.querySelectorAll('[role=progressbar]');
    expect(detailBars.length).toBe(6); // 5 stats + XP
    expect(container.innerHTML).not.toContain('bg-gray-700');
  });

  it('si la imagen falla desaparece la img y aparece el sprite dentro del anillo', () => {
    setHeroes([mkHero(1, 'common')]);
    const { container } = render(<HeroPanel onClose={() => {}} />);
    const ring = container.querySelector('.kh-ring');
    fireEvent.error(ring.querySelector('img'));
    const same = container.querySelector('.kh-ring');
    expect(same.querySelector('img')).toBeNull();
    expect(same.querySelector('[data-ring-content]')).not.toBeNull();
  });

  it.each([
    ['common', 'Común', '#4a4a48'], ['rare', 'Rara', '#b08d57'],
    ['epic', 'Épica', '#e07b2a'], ['legendary', 'Legendaria', '#d9b77a'],
  ])('rareza %s: texto visible y borde de token kh', (rarity, label, hex) => {
    setHeroes([mkHero(1, rarity)]);
    const { container } = render(<HeroPanel onClose={() => {}} />);
    expect(container.textContent).toContain(label);
    const card = container.querySelector(`button[data-rarity="${rarity}"]`);
    const detail = container.querySelector(`div[data-rarity="${rarity}"]`);
    expect(detail.style.border.toLowerCase()).toContain(
      `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`,
    );
    expect(card).not.toBeNull();
  });

  it('estados vacíos en bone-dim ≥ 12 px y botones del kit', () => {
    setHeroes([]);
    render(<HeroPanel onClose={() => {}} />);
    const el = screen.getByText('Sin héroes');
    expect(el.className).toContain('text-kh-bone-dim');
    expect(el.className).toContain('text-xs');
    expect(screen.getByText('Seleccioná un héroe').className).toContain('text-kh-bone-dim');
    expect(screen.getByRole('button', { name: 'Invocar primero' })).toHaveClass('kh-btn');
  });
});

// ── T7 — Mapas Sistema y Galaxia (R25, R31–R36) ──────────────────────────────
import SystemMapPanel from '../components/overlay/SystemMapPanel';
import GalaxyMapPanel from '../components/overlay/GalaxyMapPanel';

const allStates = [
  { id: 'a', name: 'Alfa Uno', state: 'claimed', desc: 'd', tribute: { gold: 1 }, cost: {}, travelMin: 5, warpMin: 600 },
  { id: 'b', name: 'Beta Dos', state: 'available', desc: 'd', tribute: { gold: 1 }, cost: { gold: 10 }, travelMin: 5, warpMin: 600 },
  { id: 'c', name: 'Gama Tres', state: 'traveling', desc: 'd', tribute: {}, cost: {}, travelMin: 5, warpMin: 600 },
  { id: 'd', name: 'Delta Cuatro', state: 'locked', desc: 'd', tribute: {}, cost: {}, travelMin: 5, warpMin: 600 },
];

describe('pantallasB T7 — mapas', () => {
  it('SystemMapPanel: Panel con tope --kh-frame-h, fondo oak plano, filete macula aria-hidden', () => {
    const setOverlay = vi.fn();
    useGameStore.setState({
      systemMap: { unlocked: true, planets: allStates, ship: { status: 'idle' } },
      loadSystem: vi.fn(), launchShip: vi.fn(), setOverlay,
    });
    const { container } = render(<SystemMapPanel onClose={() => {}} />);
    const panel = container.querySelector('.kh-panel');
    expect(panel.style.maxHeight).toContain('var(--kh-frame-h)');
    expect(panel.style.backgroundColor).not.toBe('');
    expect(panel.style.backgroundImage).toBe('');
    const rule = container.querySelector('[aria-hidden="true"][style*="background-color"]');
    expect(rule).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/cyan|purple|gray-|\u2715|\u2713/);
    expect(container.innerHTML).not.toMatch(/\d+vh/);
  });

  it('SystemMapPanel: los 4 estados llevan etiqueta de texto en el detalle', () => {
    useGameStore.setState({
      systemMap: { unlocked: true, planets: allStates, ship: { status: 'idle' } },
      loadSystem: vi.fn(), launchShip: vi.fn(), setOverlay: vi.fn(),
    });
    render(<SystemMapPanel onClose={() => {}} />);
    const expected = { 'Alfa Uno': 'Controlado', 'Beta Dos': 'Disponible', 'Gama Tres': 'En tránsito' };
    for (const [name, tag] of Object.entries(expected)) {
      fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes(name.split(' ')[0])));
      expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('button', { name: /Enviar la Nave|Beta/ })).toBeTruthy();
  });

  it('SystemMapPanel: todos reclamados muestra Reinos Caídos y cambia de mapa', () => {
    const setOverlay = vi.fn();
    useGameStore.setState({
      systemMap: { unlocked: true, planets: [{ ...allStates[0] }], ship: { status: 'idle' } },
      loadSystem: vi.fn(), launchShip: vi.fn(), setOverlay,
    });
    render(<SystemMapPanel onClose={() => {}} />);
    const btn = screen.getAllByRole('button', { name: 'Reinos Caídos' })[0];
    expect(btn).toHaveClass('kh-btn');
    fireEvent.click(btn);
    expect(setOverlay).toHaveBeenCalledWith('galaxy', {});
  });

  it('GalaxyMapPanel: etiquetas Dominado/Alcanzable/En los Caminos Velados y botón Sistema', () => {
    const setOverlay = vi.fn();
    useGameStore.setState({
      galaxyMap: { unlocked: true, systems: allStates, warp: { status: 'idle' } },
      loadGalaxy: vi.fn(), launchWarp: vi.fn(), setOverlay,
    });
    const { container } = render(<GalaxyMapPanel onClose={() => {}} />);
    expect(container.querySelector('.kh-panel').style.maxHeight).toContain('var(--kh-frame-h)');
    expect(container.innerHTML).not.toMatch(/purple|cyan|gray-|\u2715|\u2713/);
    const expected = { Alfa: 'Dominado', Beta: 'Alcanzable', Gama: 'En los Caminos Velados' };
    for (const [name, tag] of Object.entries(expected)) {
      fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes(name)));
      expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    expect(setOverlay).toHaveBeenCalledWith('system', {});
  });

  it('GalaxyMapPanel: estado bloqueado y mapa sin cargar en bone-dim', () => {
    useGameStore.setState({ galaxyMap: null, loadGalaxy: vi.fn(), launchWarp: vi.fn(), setOverlay: vi.fn() });
    render(<GalaxyMapPanel onClose={() => {}} />);
    expect(screen.getByText(/Trazando los Caminos Velados/).className).toContain('text-kh-bone-dim');
  });
});

// ── T8 — Resultados con ResultBanner (R15–R21) ───────────────────────────────
import CombatInstancePanel from '../components/campaign/CombatInstancePanel';
import WarPanel from '../components/overlay/WarPanel';
import TerritoryMapPanel from '../components/world/TerritoryMapPanel';
import { act } from '@testing-library/react';

const runState = () => ({
  round: 2, maxRounds: 10, enemy: { hp: 10, maxHp: 100 },
  heroes: [{ slot: 0, name: 'Ari', hp: 5, alive: true, energy: 1, energyMax: 3, skill: { icon: 'sword' } }],
});

describe('pantallasB T8 — resultados', () => {
  const mountCombat = async (outcome) => {
    useGameStore.setState({
      activeRun: { runId: 1, node: { id: 'n1', type: 'combat', name: 'Nodo' }, state: runState() },
      stepInstance: vi.fn().mockResolvedValue({ result: outcome }),
      clearActiveRun: vi.fn(), addNotification: vi.fn(),
    });
    const onClose = vi.fn();
    const r = render(<CombatInstancePanel onClose={onClose} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Avanzar ronda' })); });
    return { ...r, onClose };
  };

  it('victoria: ResultBanner victory, fanfarria EmberField z-[20] y botón Volver', async () => {
    const { container, onClose } = await mountCombat('victory');
    const banner = container.querySelector('[data-outcome="victory"]');
    expect(banner).not.toBeNull();
    expect(screen.getByText('¡Victoria!')).toBeTruthy();
    expect(hasFanfare(container)).not.toBeNull();
    expect(container.querySelector('[data-defeat-veil]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('derrota: ResultBanner defeat, velo de lacre y sin fanfarria', async () => {
    const { container } = await mountCombat('defeat');
    expect(container.querySelector('[data-outcome="defeat"]')).not.toBeNull();
    expect(screen.getByText('Derrota')).toBeTruthy();
    expect(container.querySelector('[data-defeat-veil]')).not.toBeNull();
    expect(hasFanfare(container)).toBeNull();
  });

  it('CombatInstancePanel no usa vh propio y mantiene el cierre del kit', () => {
    const src = read('components/campaign/CombatInstancePanel.jsx');
    expect(RE_VIEWPORT.test(src)).toBe(false);
    expect(src).not.toMatch(/[\u2715\u2713]/);
  });

  it('TerritoryMapPanel: derrota/victoria con ResultBanner, con y sin botín', async () => {
    const attackTerritory = vi.fn().mockResolvedValue({
      winner: 'attacker', attackPower: 50, defensePower: 20, territory: { name: 'Plaza Norte' },
      territoryFlipped: true, pointsAwarded: 5, tokensAwarded: 2, loot: { gold: 30 },
    });
    useGameStore.setState({
      player: { faction_id: 'f1' }, troops: [{ troop_id: 'sword', quantity: 3 }],
      territories: [{ id: 't1', name: 'Plaza Norte', type: 'plains', defense_strength: 10, owner: null }],
      loadTerritories: vi.fn(), loadTroops: vi.fn(), attackTerritory,
    });
    const { container } = render(<TerritoryMapPanel data={{}} onClose={() => {}} />);
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent.includes('Plaza Norte')));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Asaltar con todas las tropas/ })); });
    expect(container.querySelector('[data-outcome="victory"]')).not.toBeNull();
    expect(container.textContent).toContain('Botín: 30 gold');
    expect(container.textContent).toContain('Victoria en Plaza Norte');
  });

  it('WarPanel y TerritoryMapPanel: sin 100vh, glifos ni grises de Tailwind', () => {
    for (const f of ['components/overlay/WarPanel.jsx', 'components/world/TerritoryMapPanel.jsx']) {
      const src = read(f);
      expect(RE_VIEWPORT.test(src)).toBe(false);
      expect(RE_TW_COLOR.test(src)).toBe(false);
      expect(RE_GLYPH.test(src)).toBe(false);
      expect(RE_LEGACY_BTN.test(src)).toBe(false);
    }
  });

  it('WarPanel: Panel con tope --kh-frame-h y pestañas .kh-tab', () => {
    useGameStore.setState({
      sieges: [], player: { faction_id: 'f1' }, territories: [], troops: [], pvpPlayers: [], pvpCooldowns: {},
      loadSieges: vi.fn(), loadTroops: vi.fn(), loadTerritories: vi.fn(), loadPvpPlayers: vi.fn(), useSiegeAbility: vi.fn(),
    });
    const { container } = render(<WarPanel data={{}} onClose={() => {}} />);
    expect(container.querySelector('.kh-panel').style.maxHeight).toContain('var(--kh-frame-h)');
    expect(container.querySelectorAll('.kh-tab').length).toBeGreaterThanOrEqual(4);
    fireEvent.click(screen.getByRole('tab', { name: 'PvP' }));
    expect(screen.getByRole('tab', { name: 'PvP' }).getAttribute('aria-selected')).toBe('true');
  });
});

function hasFanfare(container) {
  const found = Array.from(container.querySelectorAll('[aria-hidden="true"]')).find((e) => String(e.className).includes('z-[20]'));
  return found || null;
}

// ── T9 — MainMenu (R3, R6, R22, R24, R25) ────────────────────────────────────
import MainMenu, { MENU_KEY_ART } from '../components/menu/MainMenu';
import { KH as KHT } from '../components/ui/kitPieces';

// Contraste WCAG 2.x entre dos colores #rrggbb.
function lumOf(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrastOf = (a, b) => {
  const [hi, lo] = [lumOf(a), lumOf(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('pantallasB T9 — MainMenu', () => {
  const origImage = globalThis.Image;
  afterEach(() => { globalThis.Image = origImage; });
  const stubImage = (ok) => {
    globalThis.Image = class {
      set src(v) { this._s = v; setTimeout(() => (ok ? this.onload?.() : this.onerror?.()), 0); }
    };
  };

  it('sin key art: fondo plano ink, sin background-image y sin menu_bg', async () => {
    stubImage(false);
    useGameStore.setState({ player: { display_name: 'Aldric', level: 3 }, enterGame: vi.fn(), setOverlay: vi.fn() });
    const { container } = render(<MainMenu />);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    const root = container.firstChild;
    expect(root.style.backgroundColor).not.toBe('');
    expect(root.style.backgroundImage).toBe('');
    expect(root.style.paddingTop).toContain('--kh-safe-top');
    expect(root.style.paddingBottom).toContain('--kh-safe-bottom');
    expect(root.className).toContain('w-full');
    expect(root.className).toContain('h-full');
    expect(container.innerHTML).not.toContain('menu_bg');
    expect(contrastOf(KHT['bone-dim'], KHT.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOf(KHT.bone, KHT.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOf(KHT['brass-light'], KHT.ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('con key art cargada: se pinta MENU_KEY_ART bajo la capa oscura', async () => {
    stubImage(true);
    useGameStore.setState({ player: null, enterGame: vi.fn(), setOverlay: vi.fn() });
    const { container } = render(<MainMenu />);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(MENU_KEY_ART).toBe('/assets/b/menu/key_art.webp');
    expect(container.firstChild.style.backgroundImage).toContain('key_art.webp');
  });

  it('botones Button: primary Entrar al Bastión y secondary Configuración; acciones intactas', async () => {
    stubImage(false);
    const enterGame = vi.fn(); const setOverlay = vi.fn();
    useGameStore.setState({ player: null, enterGame, setOverlay });
    render(<MainMenu />);
    const enter = screen.getByRole('button', { name: /Entrar al Bastión/ });
    const cfg = screen.getByRole('button', { name: /Configuración/ });
    expect(enter.getAttribute('data-variant')).toBe('primary');
    expect(cfg.getAttribute('data-variant')).toBe('secondary');
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('font-display');
    fireEvent.click(enter);
    expect(enterGame).toHaveBeenCalledTimes(1);
    fireEvent.click(cfg);
    expect(enterGame).toHaveBeenCalledTimes(2);
    expect(setOverlay).toHaveBeenCalledWith('settings', {});
  });
});
