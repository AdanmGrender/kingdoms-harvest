/**
 * SystemMapPanel — Escala Sistema (G1 idle): meta-mapa de planetas.
 * Mandás la Nave a un planeta → viaje idle → tributo pasivo. Desbloqueo
 * secuencial. Estilo informe de campaña (como TerritoryMapPanel).
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

const RES_ICON = {
  gold: '🪙', iron: '⛏️', stone: '🪨', water: '💧', wheat: '🌾', crystal: '💎',
};

function costLabel(cost) {
  const entries = Object.entries(cost || {});
  if (entries.length === 0) return '—';
  return entries.map(([r, n]) => `${n}${RES_ICON[r] || r}`).join(' ');
}

function tributeLabel(tribute) {
  const entries = Object.entries(tribute || {});
  if (entries.length === 0) return null;
  return entries.map(([r, n]) => `+${n}${RES_ICON[r] || r}/h`).join(' ');
}

function etaLabel(arrivesAt) {
  const ms = new Date(arrivesAt) - Date.now();
  if (ms <= 0) return 'llegando…';
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

const STATE_STYLE = {
  claimed:   { ring: '#4ade80', tag: 'Controlado', tagColor: '#4ade80' },
  available: { ring: '#d9a441', tag: 'Disponible', tagColor: '#d9a441' },
  traveling: { ring: '#4fd8c8', tag: 'En tránsito', tagColor: '#4fd8c8' },
  locked:    { ring: '#3b3b44', tag: 'Bloqueado', tagColor: '#6b7280' },
};

export default function SystemMapPanel({ onClose }) {
  const systemMap = useGameStore((s) => s.systemMap);
  const loadSystem = useGameStore((s) => s.loadSystem);
  const launchShip = useGameStore((s) => s.launchShip);
  const [selected, setSelected] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => {
    loadSystem();
    const poll = setInterval(loadSystem, 30000);
    const clock = setInterval(() => tick((n) => n + 1), 15000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, []);

  const sys = systemMap;
  const sel = sys?.planets.find((p) => p.id === selected);

  const doLaunch = async (planetId) => {
    const res = await launchShip(planetId);
    if (res) setSelected(null);
  };

  return (
    <div
      className="mx-2 mb-2 rounded-t-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(23, 21, 26, 0.97)',
        border: '1px solid rgba(79, 216, 200, 0.4)',
        maxHeight: '80vh',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-900/40 shrink-0 bg-black/30">
        <div>
          <h3 className="text-cyan-300 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
            🛰️ Cartografía del Sistema
          </h3>
          <p className="text-[10px] text-gray-500">Extendé tu dominio planeta a planeta</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1">
        {!sys && <p className="text-center text-gray-500 text-xs py-6">Cargando cartografía…</p>}

        {sys && !sys.unlocked && (
          <div className="rounded-lg bg-black/40 border border-cyan-800/40 p-3 text-center">
            <p className="text-2xl mb-1">🔒</p>
            <p className="text-xs text-gray-300">
              La escala Sistema se abre con <b className="text-cyan-300">Bastión de Mando nivel {sys.unlockLevel}</b>
            </p>
            <p className="text-[10px] text-gray-500 mt-1">Actual: nivel {sys.throneLevel}</p>
          </div>
        )}

        {/* Nave en tránsito */}
        {sys?.ship?.status === 'traveling' && (
          <div className="rounded-lg bg-cyan-900/20 border border-cyan-600/40 p-2.5 flex items-center gap-2 animate-fade-in">
            <span className="text-xl animate-pulse">🚀</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-cyan-300 font-bold truncate">
                Nave en ruta a {sys.planets.find((p) => p.id === sys.ship.target)?.name}
              </p>
              <p className="text-[10px] text-gray-400">Llega en {etaLabel(sys.ship.arrivesAt)}</p>
            </div>
          </div>
        )}

        {/* Planetas */}
        {sys && (
          <div className="grid grid-cols-2 gap-2">
            {sys.planets.map((p) => {
              const st = STATE_STYLE[p.state] || STATE_STYLE.locked;
              const trib = tributeLabel(p.tribute);
              return (
                <button
                  key={p.id}
                  onClick={() => p.state !== 'locked' && setSelected(p.id)}
                  disabled={p.state === 'locked'}
                  className={`relative rounded-lg p-2 text-left border bg-black/40 transition-all ${
                    selected === p.id ? 'ring-2 ring-cyan-400' : ''
                  } ${p.state === 'locked' ? 'opacity-50' : 'hover:bg-black/60'}`}
                  style={{ borderTop: `3px solid ${st.ring}` }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-2xl leading-none">{p.state === 'locked' ? '🔒' : p.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold leading-tight truncate">{p.name}</p>
                      <p className="text-[9px]" style={{ color: st.tagColor }}>{st.tag}</p>
                      {trib && p.state === 'claimed' && (
                        <p className="text-[9px] text-green-400 truncate">{trib}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Detalle del planeta seleccionado */}
        {sel && sel.state !== 'locked' && (
          <div className="game-card border-cyan-700/40 space-y-2 animate-fade-in">
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
                  <span>Costo de viaje: <b className="text-yellow-300">{costLabel(sel.cost)}</b></span>
                  <span>⏱️ {sel.travelMin} min</span>
                </div>
                <button
                  onClick={() => doLaunch(sel.id)}
                  disabled={sys.ship.status === 'traveling'}
                  className="w-full py-2 rounded-lg text-xs font-bold text-white
                             bg-gradient-to-b from-cyan-700 to-cyan-900 border border-cyan-500/40
                             hover:from-cyan-600 hover:to-cyan-800 active:scale-95 transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🚀 Enviar la Nave
                </button>
              </>
            )}
            {sel.state === 'claimed' && (
              <p className="text-[11px] text-green-400 text-center">✓ Bajo tu control — rinde tributo cada hora</p>
            )}
            {sel.state === 'traveling' && (
              <p className="text-[11px] text-cyan-300 text-center">🚀 La Nave está en camino…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
