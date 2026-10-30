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
import { vi, beforeEach } from 'vitest';
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
