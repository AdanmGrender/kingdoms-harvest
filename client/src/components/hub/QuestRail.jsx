import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';

// Riel de marcadores: muestra el próximo nodo 'available' como objetivo tappable.
export default function QuestRail() {
  const nodes = useGameStore((s) => s.campaignNodes);
  const loadCampaignMap = useGameStore((s) => s.loadCampaignMap);
  const setOverlay = useGameStore((s) => s.setOverlay);

  useEffect(() => { loadCampaignMap(); }, [loadCampaignMap]);
  const next = nodes.find((n) => n.status === 'available');

  return (
    <div className="w-full px-3 py-2 flex items-center gap-2 overflow-x-auto"
      style={{ background: 'rgba(22,33,62,0.9)', borderBottom: '1px solid rgba(255,215,0,0.25)' }}>
      <span className="text-yellow-400 text-xs font-bold whitespace-nowrap">▸ Objetivo:</span>
      <button
        onClick={() => setOverlay('operations', {})}
        className="text-white text-xs px-3 py-1 rounded whitespace-nowrap"
        style={{ background: 'rgba(233,69,96,0.25)', border: '1px solid #e94560' }}
      >
        {next ? next.name : 'Acto completado ✓'}
      </button>
    </div>
  );
}
