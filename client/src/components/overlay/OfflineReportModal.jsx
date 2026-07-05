/**
 * OfflineReportModal — informe "Mientras no estabas" (F1 idle).
 * Se muestra sobre el juego cuando /player/init trae offlineReport.
 * Estilo informe militar (como la cabecera de TerritoryMapPanel).
 */
import useGameStore from '../../store/gameStore';

const RESOURCE_ICONS = {
  wheat: '🌾', wood: '⚙️', stone: '🪨', iron: '⛏️', water: '💧', gold: '🪙',
  bread: '🥫', planks: '🔳', ingots: '🔩', flour: '🌫️', cheese: '🧫',
  egg: '🥚', milk: '🥛', wool: '🧶', crystal: '💎', relic: '⚱️', blueprint: '📜',
};

function formatAway(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h ${mins % 60} min`;
  return `${Math.floor(hours / 24)} días`;
}

export default function OfflineReportModal() {
  const report = useGameStore((s) => s.offlineReport);
  const dismiss = useGameStore((s) => s.dismissOfflineReport);

  if (!report) return null;

  const resources = Object.entries(report.resources || {});
  const hadDowntime = Object.keys(report.catchUp || {}).length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 animate-fade-in">
      <div
        className="w-full max-w-sm rounded-xl overflow-hidden"
        style={{
          background: 'rgba(23, 21, 26, 0.98)',
          border: '1px solid rgba(217, 164, 65, 0.35)',
          boxShadow: '0 0 40px rgba(0,0,0,0.8)',
        }}
      >
        {/* Cabecera estilo informe militar */}
        <div className="px-4 py-3 border-b border-yellow-900/40 bg-black/40 text-center">
          <p className="text-[10px] tracking-[0.3em] text-gray-500 uppercase">Informe del Bastión</p>
          <h3 className="text-kingdom-gold text-base font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
            💀 Mientras no estabas
          </h3>
          <p className="text-[11px] text-gray-400">Ausente {formatAway(report.awayMs)}</p>
        </div>

        <div className="px-4 py-3 space-y-3 max-h-[50vh] overflow-y-auto">
          {resources.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                Producción acumulada{hadDowntime ? ' (incluye recuperación)' : ''}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {resources.map(([id, amount]) => (
                  <div key={id} className="flex items-center gap-2 bg-black/40 rounded px-2 py-1.5 border border-gray-700/40">
                    <span className="text-lg leading-none">{RESOURCE_ICONS[id] || '📦'}</span>
                    <span className="text-sm text-green-400 font-bold">+{amount}</span>
                    <span className="text-[10px] text-gray-500 truncate">{id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.khEarned > 0 && (
            <div className="flex items-center justify-center gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded px-3 py-2">
              <span className="text-lg">💎</span>
              <span className="text-kingdom-gold font-bold text-sm">+{report.khEarned} KH</span>
            </div>
          )}

          {(report.events || []).length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Sucesos</p>
              <div className="space-y-1">
                {report.events.map((e, i) => (
                  <p key={i} className="text-[11px] text-gray-300">
                    {e.icon} {e.text}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-1">
          <button
            onClick={dismiss}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white
                       bg-gradient-to-b from-red-700 to-red-900 border border-red-500/40
                       hover:from-red-600 hover:to-red-800 active:scale-95 transition-all"
          >
            Retomar el mando
          </button>
        </div>
      </div>
    </div>
  );
}
