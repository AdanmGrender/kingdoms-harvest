/**
 * SystemMapPanel — Escala Sistema (G1 idle): meta-mapa de planetas.
 * Mandás la Nave a un planeta → viaje idle → tributo pasivo. Desbloqueo
 * secuencial. Estilo informe de campaña (como TerritoryMapPanel).
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import StarMap from './StarMap';
import SpriteIcon from '../ui/SpriteIcon';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import { KH } from '../ui/kitPieces';
import useMapBackground, { MARCA_BG } from './useMapBackground';

const RES_ICON = {
  gold: 'gold', iron: 'iron', stone: 'stone', water: 'water', wheat: 'wheat', crystal: 'gem',
};

function costLabel(cost) {
  const entries = Object.entries(cost || {});
  if (entries.length === 0) return '—';
  return entries.map(([r, n]) => `${n} ${r}`).join(' ');
}

function tributeLabel(tribute) {
  const entries = Object.entries(tribute || {});
  if (entries.length === 0) return null;
  return entries.map(([r, n]) => `+${n} ${r}/h`).join(' ');
}

function etaLabel(arrivesAt) {
  const ms = new Date(arrivesAt) - Date.now();
  if (ms <= 0) return 'llegando…';
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

// Estado por tokens kh (R31); el estado se lee por la etiqueta, no solo por el color.
const STATE_STYLE = {
  claimed:   { ring: KH['brass-light'], tag: 'Controlado',  tagColor: KH['brass-light'] },
  available: { ring: KH.brass,          tag: 'Disponible',  tagColor: KH.brass },
  traveling: { ring: KH.ember,          tag: 'En tránsito', tagColor: KH.ember },
  locked:    { ring: KH.iron,           tag: 'Bloqueado',   tagColor: KH['bone-dim'] },
};

export default function SystemMapPanel({ onClose }) {
  const systemMap = useGameStore((s) => s.systemMap);
  const loadSystem = useGameStore((s) => s.loadSystem);
  const launchShip = useGameStore((s) => s.launchShip);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const [selected, setSelected] = useState(null);
  const [, tick] = useState(0);

  // La escala Galaxia se abre al dominar todos los planetas del sistema
  const allClaimed = systemMap?.planets?.every((p) => p.state === 'claimed');

  useEffect(() => {
    loadSystem();
    const poll = setInterval(loadSystem, 30000);
    const clock = setInterval(() => tick((n) => n + 1), 15000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, []);

  const bg = useMapBackground(MARCA_BG);
  const sys = systemMap;
  const sel = sys?.planets.find((p) => p.id === selected);

  const doLaunch = async (planetId) => {
    const res = await launchShip(planetId);
    if (res) setSelected(null);
  };

  return (
    <Panel
      title={<><SpriteIcon name="map" size={28} /> Mapa de la Marca</>}
      onClose={onClose}
      className="mx-2 mb-2 overflow-hidden flex flex-col"
      style={{ ...bg, maxHeight: 'calc(var(--kh-frame-h) * 0.8)' }}
    >
      <span aria-hidden="true" className="block mb-2" style={{ height: 2, backgroundColor: KH.macula }} />
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs text-kh-bone-dim">Extendé tu dominio plaza a plaza</p>
        {allClaimed && (
          <Button onClick={() => setOverlay('galaxy', {})} style={{ fontSize: 13 }}>
            Reinos Caídos
          </Button>
        )}
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
        {!sys && <p className="text-center text-kh-bone-dim text-xs py-6">Cargando cartografía…</p>}
        {allClaimed && (
          <div className="rounded-lg p-2 text-center" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.brass}` }}>
            <p className="text-xs text-kh-bone">
              <SpriteIcon name="world" size={28} /> ¡Marca dominada! El <b>Velo</b> se puede cruzar —
              <button onClick={() => setOverlay('galaxy', {})} className="underline ml-1 text-kh-brass-light" style={{ minHeight: 44 }}>
                partí a los Reinos Caídos
              </button>
            </p>
          </div>
        )}

        {sys && !sys.unlocked && (
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.iron}` }}>
            <p className="text-2xl mb-1"><SpriteIcon name="shield" size={32} /></p>
            <p className="text-xs text-kh-bone">
              La escala Sistema se abre con <b className="text-kh-brass-light">Torre del Señor nivel {sys.unlockLevel}</b>
            </p>
            <p className="text-xs text-kh-bone-dim mt-1">Actual: nivel {sys.throneLevel}</p>
          </div>
        )}

        {/* Nave en tránsito */}
        {sys?.ship?.status === 'traveling' && (
          <div className="rounded-lg p-2.5 flex items-center gap-2 animate-fade-in" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.ember}` }}>
            <span className="text-xl animate-pulse"><SpriteIcon name="speedup" size={28} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-kh-bone font-bold break-words">
                Caravana en ruta a {sys.planets.find((p) => p.id === sys.ship.target)?.name}
              </p>
              <p className="text-xs text-kh-bone-dim">Llega en {etaLabel(sys.ship.arrivesAt)}</p>
            </div>
          </div>
        )}

        {/* Mapa espacial del sistema */}
        {sys && (
          <StarMap
            nodes={sys.planets}
            selectedId={selected}
            onSelect={setSelected}
            ship={sys.ship}
            shipIcon="speedup"
            theme={KH.brass}
            stateStyle={STATE_STYLE}
          />
        )}

        {/* Detalle del planeta seleccionado */}
        {sel && sel.state !== 'locked' && (
          <div className="game-card space-y-2 animate-fade-in" style={{ borderColor: STATE_STYLE[sel.state]?.ring }}>
            <div className="flex items-center gap-2">
              <span className="text-2xl"><SpriteIcon name="map" size={32} /></span>
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
                  <span>Costo de viaje: <b className="text-kh-brass-light">{costLabel(sel.cost)}</b></span>
                  <span><SpriteIcon name="speedup" size={28} /> {sel.travelMin} min</span>
                </div>
                <Button
                  variant="primary"
                  onClick={() => doLaunch(sel.id)}
                  disabled={sys.ship.status === 'traveling'}
                  className="w-full"
                  style={{ fontSize: 14 }}
                >
                  <SpriteIcon name="speedup" size={28} /> Enviar la Nave
                </Button>
              </>
            )}
            {sel.state === 'claimed' && (
              <p className="text-xs text-kh-brass-light text-center"><SpriteIcon name="check" size={28} /> Bajo tu control — rinde tributo cada hora</p>
            )}
            {sel.state === 'traveling' && (
              <p className="text-xs text-kh-bone text-center"><SpriteIcon name="speedup" size={28} /> La caravana está en camino…</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
