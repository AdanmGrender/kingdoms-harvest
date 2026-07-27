import { useEffect, Fragment } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

// Ícono grim del sheet IA por tipo de nodo (fallback emoji si falta el arte)
const TYPE_ICON = {
  manage:  { sprite: 'gear',  emoji: '🔧' },
  collect: { sprite: 'wheat', emoji: '🌾' },
  combat:  { sprite: 'sword', emoji: '⚔️' },
  wave:    { sprite: 'tide',  emoji: '🌊' },
  boss:    { sprite: 'skull', emoji: '💀' },
};

// F1: sólo los nodos combat/wave/boss se pueden re-farmear con "Asalto rápido".
const SWEEPABLE_TYPES = ['combat', 'wave', 'boss'];

export default function OperationsMap({ onClose }) {
  const nodes = useGameStore((s) => s.campaignNodes);
  const sweepsLeft = useGameStore((s) => s.sweepsLeft);
  const loadCampaignMap = useGameStore((s) => s.loadCampaignMap);
  const enterNode = useGameStore((s) => s.enterNode);
  const sweepNode = useGameStore((s) => s.sweepNode);
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
      } else if (res.kind === 'cleared') {
        addNotification(`✅ ${node.name} completado`, 'success');
      }
    } catch (e) {
      addNotification(e.response?.data?.error || 'No se pudo entrar', 'error');
    }
  };

  const handleSweep = async (node) => {
    await sweepNode(node.id); // la store dispara la notificación (éxito o error)
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'rgba(10,10,20,0.96)' }}>
      <div className="flex justify-between items-center p-4">
        <h2 className="text-yellow-400 text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'MedievalSharp, serif' }}>
          <SpriteIcon name="map" size={26} fallback="🗺️" /> Operaciones
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-yellow-300 text-xs font-semibold">Asaltos: {sweepsLeft}/5</span>
          <button onClick={onClose} className="text-gray-400 text-2xl px-2">✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="flex flex-col items-center gap-2">
          {nodes.map((node, i) => {
            const locked = node.status === 'locked';
            const cleared = node.status === 'cleared';
            const sweepable = cleared && SWEEPABLE_TYPES.includes(node.type);
            // Separador de acto: antes del primer nodo, y cada vez que cambia el
            // acto respecto del nodo anterior (F5 — acto 2 encadenado al acto 1).
            const showActSep = i === 0 || node.act !== nodes[i - 1].act;
            return (
              <Fragment key={node.id}>
              {showActSep && (
                <div className="w-full max-w-xs my-2 flex items-center gap-2 text-yellow-600/70">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,215,0,0.25)' }} />
                  <span className="text-[10px] uppercase tracking-widest font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
                    Acto {node.act}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,215,0,0.25)' }} />
                </div>
              )}
              <div className="flex flex-col items-center w-full">
                <div className="w-full max-w-xs flex items-stretch gap-2">
                  <button
                    onClick={() => handleTap(node)}
                    disabled={locked}
                    className="flex-1 p-3 rounded-lg flex items-center gap-3"
                    style={{
                      background: cleared ? 'rgba(74,222,128,0.12)' : locked ? 'rgba(60,60,70,0.4)' : 'rgba(179,40,33,0.15)',
                      border: `1px solid ${cleared ? '#4ade80' : locked ? '#444' : '#b32821'}`,
                      opacity: locked ? 0.5 : 1,
                    }}
                  >
                    <SpriteIcon
                      name={node.isBoss ? 'skull' : TYPE_ICON[node.type]?.sprite}
                      size={34}
                      fallback={node.isBoss ? '💀' : TYPE_ICON[node.type]?.emoji}
                      style={locked ? { filter: 'grayscale(1) brightness(0.7)' } : undefined}
                    />
                    <div className="flex-1 text-left">
                      <p className="text-white text-sm font-semibold">{node.name}</p>
                      <p className="text-gray-400 text-[10px] uppercase">{node.type}</p>
                    </div>
                    {cleared
                      ? <SpriteIcon name="check" size={22} fallback="✓" />
                      : <span className="text-lg">{locked ? '🔒' : '▶'}</span>}
                  </button>
                  {sweepable && (
                    <button
                      onClick={() => handleSweep(node)}
                      disabled={sweepsLeft <= 0}
                      title="Asalto rápido: recompensa reducida (60%), sin desbloqueos"
                      className="px-2 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[9px] text-yellow-300 font-semibold"
                      style={{
                        background: 'rgba(255,215,0,0.12)',
                        border: '1px solid #ffd700',
                        opacity: sweepsLeft <= 0 ? 0.35 : 1,
                      }}
                    >
                      <SpriteIcon name="flame" size={18} fallback="⚡" />
                      Asalto
                    </button>
                  )}
                </div>
                {i < nodes.length - 1 && <div className="w-0.5 h-3" style={{ background: '#555' }} />}
              </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
