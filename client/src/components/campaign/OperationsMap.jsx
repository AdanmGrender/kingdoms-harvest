import { useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const TYPE_ICON = { manage: '🔧', collect: '🌾', combat: '⚔️', wave: '🌊', boss: '💀' };

export default function OperationsMap({ onClose }) {
  const nodes = useGameStore((s) => s.campaignNodes);
  const loadCampaignMap = useGameStore((s) => s.loadCampaignMap);
  const enterNode = useGameStore((s) => s.enterNode);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const addNotification = useGameStore((s) => s.addNotification);

  useEffect(() => { loadCampaignMap(); }, [loadCampaignMap]);

  const handleTap = async (node) => {
    if (node.status === 'locked') return;
    try {
      const res = await enterNode(node.id);
      if (res.kind === 'combat') {
        setOverlay('combat_instance', {});
      } else if (res.kind === 'blocked') {
        addNotification(res.hint, 'info');
        setOverlay(res.panel, {});
      } else if (res.kind === 'cleared') {
        addNotification(`✅ ${node.name} completado`, 'success');
      }
    } catch (e) {
      addNotification(e.response?.data?.error || 'No se pudo entrar', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'rgba(10,10,20,0.96)' }}>
      <div className="flex justify-between items-center p-4">
        <h2 className="text-yellow-400 text-lg font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          🗺️ Operaciones
        </h2>
        <button onClick={onClose} className="text-gray-400 text-2xl px-2">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="flex flex-col items-center gap-2">
          {nodes.map((node, i) => {
            const locked = node.status === 'locked';
            const cleared = node.status === 'cleared';
            return (
              <div key={node.id} className="flex flex-col items-center w-full">
                <button
                  onClick={() => handleTap(node)}
                  disabled={locked}
                  className="w-full max-w-xs p-3 rounded-lg flex items-center gap-3"
                  style={{
                    background: cleared ? 'rgba(74,222,128,0.12)' : locked ? 'rgba(60,60,70,0.4)' : 'rgba(233,69,96,0.15)',
                    border: `1px solid ${cleared ? '#4ade80' : locked ? '#444' : '#e94560'}`,
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  <span className="text-2xl">{node.isBoss ? '💀' : TYPE_ICON[node.type]}</span>
                  <div className="flex-1 text-left">
                    <p className="text-white text-sm font-semibold">{node.name}</p>
                    <p className="text-gray-400 text-[10px] uppercase">{node.type}</p>
                  </div>
                  <span className="text-lg">{cleared ? '✓' : locked ? '🔒' : '▶'}</span>
                </button>
                {i < nodes.length - 1 && <div className="w-0.5 h-3" style={{ background: '#555' }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
