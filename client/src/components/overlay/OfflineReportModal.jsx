/**
 * OfflineReportModal — libro de cuentas del Escribano (reporte offline, F1 idle).
 * Se muestra sobre el juego cuando /player/init trae offlineReport.
 * Pergamino del kit B (Panel parchment); `report.storage` trae el tope de granero por recurso.
 */
import { useMemo } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import { pickEscribanoLine } from '../../config/escribanoLines';

const RESOURCE_ICONS = {
  wheat: 'wheat', wood: 'wood', stone: 'stone', iron: 'iron', water: 'water', gold: 'gold',
  bread: 'bread', planks: 'wood', ingots: 'iron', flour: 'wheat', cheese: 'milk',
  egg: 'egg', milk: 'milk', wool: 'wool', crystal: 'gem', relic: 'relic', blueprint: 'scroll',
};

// Mismos nombres que CommerceView; el id queda como respaldo si falta alguno.
const RESOURCE_NAMES = {
  wheat: 'Trigo', carrot: 'Zanahoria', potato: 'Papa', tomato: 'Tomate',
  corn: 'Maíz', pumpkin: 'Calabaza', grape: 'Uva',
  wood: 'Madera', stone: 'Piedra', iron: 'Hierro', gold: 'Oro', water: 'Agua',
  bread: 'Pan', planks: 'Tablones', ingots: 'Lingotes',
  flour: 'Harina', cheese: 'Queso', egg: 'Huevo', milk: 'Leche', wool: 'Lana',
  crystal: 'Ascua de Faro', relic: 'Reliquia', blueprint: 'Tratado',
};

export function formatAway(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h ${mins % 60} min`;
  return `${Math.floor(hours / 24)} días`;
}

const isFull = (entry) => !!entry
  && Number.isFinite(entry.amount)
  && Number.isFinite(entry.capacity)
  && entry.amount >= entry.capacity;

const SECTION_TITLE = 'text-[11px] uppercase tracking-wider mb-1.5 opacity-70';

export default function OfflineReportModal() {
  const report = useGameStore((s) => s.offlineReport);
  const dismiss = useGameStore((s) => s.dismissOfflineReport);
  const line = useMemo(() => (report ? pickEscribanoLine(report) : ''), [report]);

  if (!report) return null;

  const resources = Object.entries(report.resources || {});
  const hadDowntime = Object.keys(report.catchUp || {}).length > 0;
  const storage = report.storage || {};
  const fullOutside = Object.entries(storage)
    .filter(([id, entry]) => isFull(entry) && !(id in (report.resources || {})));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 animate-fade-in">
      <Panel variant="parchment" title="Libro de cuentas del Escribano" className="w-full max-w-sm">
        <p className="text-sm">Mientras no estabas</p>
        <p className="text-xs opacity-70 mb-2">Ausente {formatAway(report.awayMs)}</p>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {resources.length > 0 && (
            <div>
              <p className={SECTION_TITLE}>
                Producción acumulada{hadDowntime ? ' (incluye recuperación)' : ''}
              </p>
              <ul className="space-y-1">
                {resources.map(([id, amount]) => {
                  const entry = storage[id];
                  return (
                    <li key={id} className="flex items-center gap-2 border-b border-kh-brass/40 py-1">
                      <SpriteIcon name={RESOURCE_ICONS[id] || 'reward_bag'} size={28} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{RESOURCE_NAMES[id] || id}</p>
                        {entry && (
                          <p className="text-xs opacity-80">
                            <span className="font-numeric">{entry.amount} / {entry.capacity}</span>
                            {isFull(entry) && (
                              <span className="ml-2 font-bold text-kh-seal">Granero lleno</span>
                            )}
                          </p>
                        )}
                      </div>
                      <span className="font-numeric font-bold text-sm">+{amount}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {fullOutside.length > 0 && (
            <div>
              <p className={SECTION_TITLE}>Almacenes al tope</p>
              <ul className="space-y-1">
                {fullOutside.map(([id, entry]) => (
                  <li key={id} className="flex items-center gap-2 border-b border-kh-brass/40 py-1">
                    <SpriteIcon name={RESOURCE_ICONS[id] || 'reward_bag'} size={28} />
                    <p className="flex-1 min-w-0 text-sm">
                      <span>{RESOURCE_NAMES[id] || id}</span>
                      <span className="mx-1">—</span>
                      <span className="font-bold text-kh-seal">Granero lleno</span>
                      <span className="ml-1 font-numeric text-xs">({entry.amount} / {entry.capacity})</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.khEarned > 0 && (
            <div className="flex items-center justify-center gap-2 border border-kh-brass rounded px-3 py-2">
              <SpriteIcon name="gem" size={28} />
              <span className="font-numeric font-bold text-sm">+{report.khEarned} KH</span>
            </div>
          )}

          {(report.events || []).length > 0 && (
            <div>
              <p className={SECTION_TITLE}>Sucesos</p>
              <div className="space-y-1">
                {report.events.map((e, i) => (
                  <p key={i} className="flex items-center gap-2 text-sm">
                    <SpriteIcon name="scroll" size={28} />
                    <span className="flex-1 min-w-0">{e.text}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-sm italic text-center">«{line}»</p>
        <p className="text-xs text-center opacity-70 mb-3">— El Escribano</p>

        <Button variant="primary" onClick={dismiss} className="w-full">
          Retomar el mando
        </Button>
      </Panel>
    </div>
  );
}
