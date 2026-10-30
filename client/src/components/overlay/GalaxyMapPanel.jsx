/**
 * GalaxyMapPanel — Escala Galaxia (G2 idle): surcar la Disformidad.
 * Espejo de SystemMapPanel una escala más arriba. Viajes de horas; si hay
 * tormenta al zarpar, la travesía es turbulenta (más tiempo).
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import StarMap from './StarMap';
import SpriteIcon from '../ui/SpriteIcon';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import { KH } from '../ui/kitPieces';
import useMapBackground, { REINOS_BG } from './useMapBackground';

const RES_ICON = {
  gold: 'gold', iron: 'iron', stone: 'stone', water: 'water', wheat: 'wheat', crystal: 'gem', relic: 'relic',
};

function costLabel(cost) {
  const e = Object.entries(cost || {});
  return e.length ? e.map(([r, n]) => `${n} ${r}`).join(' ') : '—';
}
function tributeLabel(tribute) {
  const e = Object.entries(tribute || {});
  return e.length ? e.map(([r, n]) => `+${n} ${r}/h`).join(' ') : null;
}
function etaLabel(arrivesAt) {
  const ms = new Date(arrivesAt) - Date.now();
  if (ms <= 0) return 'emergiendo…';
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

// Estado por tokens kh (R31). El acento `macula` del Velo queda solo en filetes decorativos (Q6).
const STATE_STYLE = {
  claimed:   { ring: KH['brass-light'], tag: 'Dominado',               tagColor: KH['brass-light'] },
  available: { ring: KH.brass,          tag: 'Alcanzable',             tagColor: KH.brass },
  traveling: { ring: KH.ember,          tag: 'En los Caminos Velados', tagColor: KH.ember },
  locked:    { ring: KH.iron,           tag: 'Fuera de alcance',       tagColor: KH['bone-dim'] },
};

export default function GalaxyMapPanel({ onClose }) {
  const galaxy = useGameStore((s) => s.galaxyMap);
  const loadGalaxy = useGameStore((s) => s.loadGalaxy);
  const launchWarp = useGameStore((s) => s.launchWarp);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const [selected, setSelected] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => {
    loadGalaxy();
    const poll = setInterval(loadGalaxy, 30000);
    const clock = setInterval(() => tick((n) => n + 1), 15000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, []);

  const bg = useMapBackground(REINOS_BG);
  const g = galaxy;
  const sel = g?.systems.find((s) => s.id === selected);

  const doWarp = async (systemId) => {
    const res = await launchWarp(systemId);
    if (res) setSelected(null);
  };

  return (
    <Panel
      title="Mapa de los Reinos Caídos"
      onClose={onClose}
      className="mx-2 mb-2 overflow-hidden flex flex-col"
      style={{ ...bg, maxHeight: 'calc(var(--kh-frame-h) * 0.8)' }}
    >
      <span aria-hidden="true" className="block mb-2" style={{ height: 2, backgroundColor: KH.macula }} />
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs text-kh-bone-dim">Cruzá el Velo por los Caminos Velados</p>
        <Button onClick={() => setOverlay('system', {})} style={{ fontSize: 13 }}>
          Sistema
        </Button>
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
        {!g && <p className="text-center text-kh-bone-dim text-xs py-6">Trazando los Caminos Velados…</p>}

        {g && !g.unlocked && (
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.iron}` }}>
            <p className="text-2xl mb-1"><SpriteIcon name="shield" size={32} /></p>
            <p className="text-xs text-kh-bone">
              Los Reinos Caídos se abren al <b className="text-kh-brass-light">dominar todas las plazas de tu Marca</b>
            </p>
            <Button onClick={() => setOverlay('system', {})} className="mt-2" style={{ fontSize: 13 }}>
              Ir a la Cartografía del Sistema →
            </Button>
          </div>
        )}

        {/* Crucero en la Disformidad */}
        {g?.warp?.status === 'traveling' && (
          <div className="rounded-lg p-2.5 flex items-center gap-2 animate-fade-in" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.ember}` }}>
            <span className="text-xl animate-pulse"><SpriteIcon name="world" size={28} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-kh-bone font-bold break-words">
                Expedición rumbo a {g.systems.find((s) => s.id === g.warp.target)?.name}
                {g.warp.turbulent && <span className="text-kh-ember"> · turbulento</span>}
              </p>
              <p className="text-xs text-kh-bone-dim">Emerge en {etaLabel(g.warp.arrivesAt)}</p>
            </div>
          </div>
        )}

        {/* Mapa espacial de la galaxia */}
        {g && (
          <StarMap
            nodes={g.systems}
            selectedId={selected}
            onSelect={setSelected}
            ship={g.warp}
            shipIcon="world"
            theme={KH.brass}
            stateStyle={STATE_STYLE}
          />
        )}

        {/* Detalle */}
        {sel && sel.state !== 'locked' && (
          <div className="game-card space-y-2 animate-fade-in" style={{ borderColor: STATE_STYLE[sel.state]?.ring }}>
            <div className="flex items-center gap-2">
              <span className="text-2xl"><SpriteIcon name="world" size={32} /></span>
              <div className="min-w-0">
                <p className="font-bold text-sm break-words">{sel.name}</p>
                <p className="text-xs text-kh-bone-dim">{sel.desc}</p>
                <p className="text-xs font-bold" style={{ color: STATE_STYLE[sel.state]?.tagColor }}>{STATE_STYLE[sel.state]?.tag}</p>
              </div>
            </div>
            {tributeLabel(sel.tribute) && (
              <p className="text-xs text-kh-brass-light">Tributo pasivo: {tributeLabel(sel.tribute)}</p>
            )}
            {sel.state === 'available' && (
              <>
                <div className="flex justify-between gap-2 text-xs text-kh-bone">
                  <span>Costo: <b className="text-kh-brass-light">{costLabel(sel.cost)}</b></span>
                  <span><SpriteIcon name="world" size={28} /> {Math.round(sel.warpMin / 60)}h de travesía</span>
                </div>
                <Button
                  variant="primary"
                  onClick={() => doWarp(sel.id)}
                  disabled={g.warp.status === 'traveling'}
                  className="w-full"
                  style={{ fontSize: 14 }}
                >
                  <SpriteIcon name="world" size={28} /> Cruzar el Velo
                </Button>
              </>
            )}
            {sel.state === 'claimed' && (
              <p className="text-xs text-kh-brass-light text-center"><SpriteIcon name="check" size={28} /> Reino bajo tu dominio</p>
            )}
            {sel.state === 'traveling' && (
              <p className="text-xs text-kh-bone text-center"><SpriteIcon name="world" size={28} /> Tu expedición está cruzando el Velo…</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
