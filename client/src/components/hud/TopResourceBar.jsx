/**
 * TopResourceBar — HUD superior del kit B (ui_kit_b etapa B).
 * Fila 1: avatar + nivel, nombre, poder, XP (Bar), oro / KH / gemas, hora del día.
 * Fila 2 (despensa): 8 contadores `data-resource` con ícono de 28 px y número de 12 px.
 */
import { useMemo, useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon from '../ui/SpriteIcon';
import Panel from '../ui/Panel';
import Bar from '../ui/Bar';
import { KH } from '../ui/kitPieces';

// Orden fijo de la despensa; `data-resource` es el selector de counterTarget() (HubSceneB).
const PANTRY = [
  { key: 'wood' },
  { key: 'stone' },
  { key: 'wheat' },
  { key: 'iron' },
  { key: 'egg' },
  { key: 'milk' },
  { key: 'wool' },
  { key: 'carrot' },
];

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n | 0}`;
}

// Marco compacto: el 9-slice de Panel pasa de 14 a 8 px para no comerse el ancho a 412 px.
const COMPACT = { borderWidth: 8, borderImageWidth: '8px', padding: 4 };

// Veredicto de dígitos (evidencia/digitos.md): font-numeric en los números del chrome (R14).
const NUM = 'font-numeric text-[12px] font-bold leading-none tabular-nums';

export default function TopResourceBar() {
  const player = useGameStore((s) => s.player);
  const resources = useGameStore((s) => s.resources);
  const troops = useGameStore((s) => s.troops);
  const tokenInfo = useGameStore((s) => s.tokenInfo);
  const gems = useGameStore((s) => s.gems);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const loadGems = useGameStore((s) => s.loadGems);

  useEffect(() => { loadGems(); }, [loadGems]);

  const [timeInfo, setTimeInfo] = useState({ period: 'morning', dayCount: 1 });

  useEffect(() => {
    const handler = (data) => setTimeInfo(data);
    EventBridge.on('time:updated', handler);
    return () => EventBridge.off('time:updated', handler);
  }, []);

  const displayName = useMemo(() => {
    const raw = player?.display_name || player?.username || '';
    if (!raw || raw.length < 2) return 'Señor';
    return raw.length > 10 ? raw.slice(0, 10) + '…' : raw;
  }, [player?.display_name, player?.username]);

  const power = useMemo(() => {
    if (!troops || troops.length === 0) return (player?.level || 1) * 100;
    return troops.reduce((sum, t) => sum + (t.quantity || 0) * 10, 0) + (player?.level || 1) * 100;
  }, [troops, player?.level]);

  const getAmount = (key) => {
    const r = resources?.[key];
    return typeof r === 'object' ? r?.amount ?? 0 : r ?? 0;
  };

  const goldAmount = getAmount('gold');
  const xpPct = player?.xp_for_next ? Math.min(100, ((player.xp || 0) / player.xp_for_next) * 100) : 0;
  // El chrome ignora `icon` (emoji de DayNightSystem) y deriva el ícono de `period`.
  const isNight = timeInfo.period === 'night';

  if (!player) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none px-2" style={{ paddingTop: 'calc(0.5rem + var(--kh-safe-top))' }}>
      <Panel className="pointer-events-auto" style={COMPACT}>
        {/* Fila 1 */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-shrink-0">
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{ backgroundColor: KH.ink, border: `2px solid ${KH.brass}` }}
            >
              <SpriteIcon name="crown" size={28} />
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-numeric"
              style={{ backgroundColor: KH.brass, color: KH.ink, border: `1px solid ${KH.ink}` }}
            >
              {player.level || 1}
            </div>
          </div>

          <div className="flex flex-col min-w-0 flex-shrink">
            <p
              className="text-kh-bone text-[12px] truncate leading-tight font-display"
              style={{ maxWidth: '70px' }}
            >
              {displayName}
            </p>
            <div className="flex items-center gap-0.5 leading-none">
              <span className="font-display text-[11px] text-kh-brass-light">Poder</span>
              <span className="font-numeric text-kh-ember text-[12px] font-bold tabular-nums">
                {formatNumber(power)}
              </span>
            </div>
            <div style={{ width: 56 }}>
              <Bar value={xpPct} tone="ember" label="Experiencia" />
            </div>
          </div>

          {/* Oro / KH / gemas */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <SpriteIcon name="gold" size={28} />
              <span className={`${NUM} text-kh-brass-light`}>{formatNumber(goldAmount)}</span>
            </div>
            {tokenInfo && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <SpriteIcon name="kh_token" size={28} />
                <span className={`${NUM} text-kh-brass-light`}>{tokenInfo.balance || 0}</span>
              </div>
            )}
            {/* Gemas (premium, se compran con Stars) — toca para abrir la tienda.
                Es el CTA de INGRESO de dinero, por eso lleva el "+". */}
            <button
              type="button"
              onClick={() => setOverlay('shop', {})}
              className="flex items-center gap-0.5 flex-shrink-0 active:scale-95 transition-transform"
              style={{ minHeight: 44, minWidth: 44, backgroundColor: KH.oak, border: `2px solid ${KH.seal}`, padding: '0 4px' }}
            >
              <SpriteIcon name="gem" size={28} />
              <span className={`${NUM} text-kh-bone`}>{gems?.balance ?? 0}</span>
              <span className="font-numeric text-kh-brass-light text-[12px] font-bold leading-none">+</span>
            </button>
          </div>

          {/* Hora del día */}
          <div className="flex flex-col items-center flex-shrink-0">
            <SpriteIcon name={isNight ? 'moon' : 'sun'} size={28} />
            <span className="font-numeric text-kh-brass-light text-[12px] leading-none whitespace-nowrap">
              D{timeInfo.dayCount}
            </span>
          </div>
        </div>

        {/* Fila 2: despensa */}
        <div className="grid grid-cols-8 gap-0.5 mt-1">
          {PANTRY.map((r) => (
            <div
              key={r.key}
              data-resource={r.key}
              className="flex flex-col items-center gap-0.5 py-0.5 min-w-0"
              style={{ backgroundColor: KH.ink }}
            >
              <SpriteIcon name={r.key} size={28} />
              <span data-resource-value className={`${NUM} text-kh-bone`}>
                {formatNumber(getAmount(r.key))}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
