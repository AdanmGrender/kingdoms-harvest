import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

// Riel de marcadores: muestra el próximo nodo 'available' como objetivo tappable.
export default function QuestRail() {
  const nodes = useGameStore((s) => s.campaignNodes);
  const loadCampaignMap = useGameStore((s) => s.loadCampaignMap);
  const setOverlay = useGameStore((s) => s.setOverlay);

  useEffect(() => { loadCampaignMap(); }, [loadCampaignMap]);
  const next = nodes.find((n) => n.status === 'available');
  const label = next ? next.name : 'Acto completado ✓';

  return (
    // Franja entre las dos columnas de rieles (BastionHub la centra con mx-20): sin pl-16 de compensación.
    <div className="w-full h-11 px-3 flex items-center gap-2 overflow-hidden"
      style={{ background: 'rgba(26,23,18,0.92)', borderBottom: '1px solid rgba(217,164,65,0.28)' }}>
      <span className="shrink-0 text-yellow-400 text-xs font-bold whitespace-nowrap flex items-center gap-1">
        <SpriteIcon name="exclamation" size={28} /><span className="hidden min-[400px]:inline">Objetivo:</span>
      </span>
      <button
        onClick={() => setOverlay('operations', {})}
        title={label}
        className="min-w-0 flex-1 text-white text-xs text-left leading-tight px-3 h-11 rounded flex items-center"
        style={{ background: 'rgba(179,40,33,0.25)', border: '1px solid #b32821' }}
      >
        <span className="line-clamp-2 break-words">{label}</span>
      </button>
    </div>
  );
}
