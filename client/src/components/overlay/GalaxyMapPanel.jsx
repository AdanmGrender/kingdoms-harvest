/**
 * GalaxyMapPanel — Escala Galaxia (G2 idle): surcar la Disformidad.
 * Espejo de SystemMapPanel una escala más arriba. Viajes de horas; si hay
 * tormenta al zarpar, la travesía es turbulenta (más tiempo).
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import StarMap from './StarMap';

const RES_ICON = {
  gold: '🪙', iron: '⛏️', stone: '🪨', water: '💧', wheat: '🌾', crystal: '💎', relic: '⚱️',
};

function costLabel(cost) {
  const e = Object.entries(cost || {});
  return e.length ? e.map(([r, n]) => `${n}${RES_ICON[r] || r}`).join(' ') : '—';
}
function tributeLabel(tribute) {
  const e = Object.entries(tribute || {});
  return e.length ? e.map(([r, n]) => `+${n}${RES_ICON[r] || r}/h`).join(' ') : null;
}
function etaLabel(arrivesAt) {
  const ms = new Date(arrivesAt) - Date.now();
  if (ms <= 0) return 'emergiendo…';
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

const STATE_STYLE = {
  claimed:   { ring: '#4ade80', tag: 'Dominado', tagColor: '#4ade80' },
  available: { ring: '#a855f7', tag: 'Alcanzable', tagColor: '#a855f7' },
  traveling: { ring: '#4fd8c8', tag: 'En la Disformidad', tagColor: '#4fd8c8' },
  locked:    { ring: '#3b3b44', tag: 'Fuera de alcance', tagColor: '#6b7280' },
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

  const g = galaxy;
  const sel = g?.systems.find((s) => s.id === selected);

  const doWarp = async (systemId) => {
    const res = await launchWarp(systemId);
    if (res) setSelected(null);
  };

  return (
    <div
      className="mx-2 mb-2 rounded-t-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(20, 16, 26, 0.98)',
        border: '1px solid rgba(168, 85, 247, 0.45)',
        maxHeight: '80vh',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-900/40 shrink-0 bg-black/40">
        <div>
          <h3 className="text-purple-300 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
            🌌 Cartografía de la Galaxia
          </h3>
          <p className="text-[10px] text-gray-500">Surcá la Disformidad entre sistemas</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOverlay('system', {})}
            className="text-[10px] px-2 py-1 rounded bg-black/40 border border-cyan-700/40 text-cyan-300"
          >
            🛰️ Sistema
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1">
        {!g && <p className="text-center text-gray-500 text-xs py-6">Trazando rutas disformes…</p>}

        {g && !g.unlocked && (
          <div className="rounded-lg bg-black/40 border border-purple-800/40 p-3 text-center">
            <p className="text-2xl mb-1">🔒</p>
            <p className="text-xs text-gray-300">
              La Galaxia se abre al <b className="text-purple-300">dominar todos los planetas de tu sistema</b>
            </p>
            <button
              onClick={() => setOverlay('system', {})}
              className="mt-2 text-[11px] px-3 py-1 rounded bg-cyan-900/40 border border-cyan-600/40 text-cyan-300"
            >
              Ir a la Cartografía del Sistema →
            </button>
          </div>
        )}

        {/* Crucero en la Disformidad */}
        {g?.warp?.status === 'traveling' && (
          <div className="rounded-lg bg-purple-900/20 border border-purple-600/40 p-2.5 flex items-center gap-2 animate-fade-in">
            <span className="text-xl animate-pulse">🌀</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-purple-300 font-bold truncate">
                Crucero rumbo a {g.systems.find((s) => s.id === g.warp.target)?.name}
                {g.warp.turbulent && <span className="text-red-400"> · turbulento</span>}
              </p>
              <p className="text-[10px] text-gray-400">Emerge en {etaLabel(g.warp.arrivesAt)}</p>
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
            shipIcon="🌀"
            theme="#a855f7"
          />
        )}

        {/* Detalle */}
        {sel && sel.state !== 'locked' && (
          <div className="game-card border-purple-700/40 space-y-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{sel.icon}</span>
              <div>
                <p className="font-bold text-sm">{sel.name}</p>
                <p className="text-[10px] text-gray-400">{sel.desc}</p>
              </div>
            </div>
            {tributeLabel(sel.tribute) && (
              <p className="text-[11px] text-green-300">Tributo pasivo: {tributeLabel(sel.tribute)}</p>
            )}
            {sel.state === 'available' && (
              <>
                <div className="flex justify-between text-[11px] text-gray-300">
                  <span>Costo: <b className="text-yellow-300">{costLabel(sel.cost)}</b></span>
                  <span>🌀 {Math.round(sel.warpMin / 60)}h de travesía</span>
                </div>
                <button
                  onClick={() => doWarp(sel.id)}
                  disabled={g.warp.status === 'traveling'}
                  className="w-full py-2 rounded-lg text-xs font-bold text-white
                             bg-gradient-to-b from-purple-700 to-purple-900 border border-purple-500/40
                             hover:from-purple-600 hover:to-purple-800 active:scale-95 transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🌀 Surcar la Disformidad
                </button>
              </>
            )}
            {sel.state === 'claimed' && (
              <p className="text-[11px] text-green-400 text-center">✓ Sistema bajo tu dominio</p>
            )}
            {sel.state === 'traveling' && (
              <p className="text-[11px] text-purple-300 text-center">🌀 El Crucero está en la Disformidad…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
