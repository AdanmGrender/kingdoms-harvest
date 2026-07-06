/**
 * StarMap — visor espacial compartido por las escalas Sistema y Galaxia (G3).
 * Coloca los nodos (planetas/sistemas) en una ruta zigzag por índice (la
 * progresión es secuencial), los conecta con líneas SVG (sólida hasta la
 * frontera alcanzada, punteada más allá) y dibuja la nave/crucero en la
 * frontera actual o en tránsito hacia el destino.
 *
 * props:
 *   nodes        [{ id, icon, name, state }]  (orden = progresión)
 *   selectedId   id seleccionado | null
 *   onSelect(id)
 *   ship         { status, target } | null   (nave/crucero)
 *   shipIcon     emoji del vehículo ('🚀' | '🌀')
 *   theme        color de acento (hex)
 */
const STATE_COLOR = {
  claimed:   '#4ade80',
  available: '#d9a441',
  traveling: '#4fd8c8',
  locked:    '#4b5563',
};

// Layout zigzag determinista por índice (coords en 0-100)
function layout(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 50 : 8 + (i * 84) / (n - 1);
    const y = i === 0 ? 50 : 48 + (i % 2 === 0 ? 20 : -20);
    pts.push({ x, y });
  }
  return pts;
}

export default function StarMap({ nodes, selectedId, onSelect, ship, shipIcon = '🚀', theme = '#4fd8c8' }) {
  const pts = layout(nodes.length);

  // Frontera: último nodo reclamado (para posar la nave si está idle)
  let frontier = 0;
  nodes.forEach((nd, i) => { if (nd.state === 'claimed') frontier = i; });
  const targetIdx = ship?.status === 'traveling'
    ? nodes.findIndex((nd) => nd.id === ship.target)
    : -1;

  // Posición de la nave
  let shipPos = null;
  if (targetIdx >= 0) {
    const a = pts[frontier], b = pts[targetIdx];
    shipPos = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  } else if (frontier >= 0) {
    shipPos = { x: pts[frontier].x, y: pts[frontier].y - 9 };
  }

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border"
      style={{
        aspectRatio: '16 / 10',
        borderColor: `${theme}44`,
        background: 'radial-gradient(ellipse at 50% 40%, #241f2e 0%, #14111a 70%, #0c0a10 100%)',
      }}
    >
      {/* Estrellas de fondo */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 62" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.o} />
        ))}
        {/* Líneas de ruta entre nodos consecutivos */}
        {pts.slice(1).map((p, i) => {
          const prev = pts[i];
          const cur = nodes[i + 1];
          const reachable = cur.state !== 'locked';
          return (
            <line
              key={i}
              x1={prev.x} y1={prev.y * 0.62} x2={p.x} y2={p.y * 0.62}
              stroke={reachable ? theme : '#3b3b44'}
              strokeWidth="0.6"
              strokeDasharray={reachable ? '0' : '2 2'}
              opacity={reachable ? 0.7 : 0.4}
            />
          );
        })}
      </svg>

      {/* Nodos */}
      {nodes.map((nd, i) => {
        const p = pts[i];
        const color = STATE_COLOR[nd.state] || STATE_COLOR.locked;
        const isSel = selectedId === nd.id;
        return (
          <button
            key={nd.id}
            onClick={() => nd.state !== 'locked' && onSelect(nd.id)}
            disabled={nd.state === 'locked'}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-transform active:scale-90"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            title={nd.name}
          >
            <span
              className="flex items-center justify-center rounded-full text-lg"
              style={{
                width: 34, height: 34,
                background: 'rgba(10,8,14,0.85)',
                border: `2px solid ${color}`,
                boxShadow: isSel ? `0 0 12px ${color}` : `0 0 6px ${color}66`,
                opacity: nd.state === 'locked' ? 0.5 : 1,
              }}
            >
              {nd.state === 'locked' ? '🔒' : nd.icon}
            </span>
            <span
              className="mt-0.5 text-[8px] font-bold px-1 rounded whitespace-nowrap"
              style={{ color, background: 'rgba(10,8,14,0.6)' }}
            >
              {nd.name.split(' ')[0]}
            </span>
          </button>
        );
      })}

      {/* Nave / Crucero */}
      {shipPos && (
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2 text-base animate-pulse pointer-events-none"
          style={{ left: `${shipPos.x}%`, top: `${shipPos.y}%`, filter: `drop-shadow(0 0 4px ${theme})` }}
        >
          {shipIcon}
        </span>
      )}
    </div>
  );
}

// Estrellas fijas (seeded a mano para que no titilen entre renders)
const STARS = [
  { x: 10, y: 8, r: 0.4, o: 0.8 }, { x: 25, y: 20, r: 0.3, o: 0.5 },
  { x: 40, y: 6, r: 0.5, o: 0.7 }, { x: 62, y: 14, r: 0.3, o: 0.6 },
  { x: 78, y: 9, r: 0.4, o: 0.7 }, { x: 90, y: 22, r: 0.3, o: 0.5 },
  { x: 15, y: 40, r: 0.3, o: 0.5 }, { x: 52, y: 48, r: 0.4, o: 0.6 },
  { x: 84, y: 44, r: 0.3, o: 0.6 }, { x: 33, y: 54, r: 0.3, o: 0.5 },
  { x: 70, y: 56, r: 0.4, o: 0.7 }, { x: 5, y: 30, r: 0.3, o: 0.5 },
  { x: 95, y: 34, r: 0.3, o: 0.5 }, { x: 46, y: 30, r: 0.2, o: 0.4 },
];
