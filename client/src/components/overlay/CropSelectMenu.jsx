/**
 * CropSelectMenu: Bottom sheet to select a crop for planting.
 * Crop data mirrors shared/gameConfig.js CROPS — keep in sync.
 */
import useGameStore from '../../store/gameStore';

const CROPS = [
  { id: 'wheat', name: 'Trigo', icon: '🌾', seedCost: 5, growthTime: 30 * 60 * 1000 },
  { id: 'carrot', name: 'Zanahoria', icon: '🥕', seedCost: 8, growthTime: 20 * 60 * 1000 },
  { id: 'potato', name: 'Papa', icon: '🥔', seedCost: 10, growthTime: 45 * 60 * 1000 },
  { id: 'tomato', name: 'Tomate', icon: '🍅', seedCost: 15, growthTime: 60 * 60 * 1000 },
  { id: 'corn', name: 'Maíz', icon: '🌽', seedCost: 18, growthTime: 90 * 60 * 1000 },
  { id: 'pumpkin', name: 'Calabaza', icon: '🎃', seedCost: 25, growthTime: 120 * 60 * 1000 },
  { id: 'grape', name: 'Uva', icon: '🍇', seedCost: 30, growthTime: 180 * 60 * 1000 },
];

function formatTime(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${minutes}min`;
}

export default function CropSelectMenu({ data, onClose }) {
  const resources = useGameStore((s) => s.resources);
  const plantCrop = useGameStore((s) => s.plantCrop);

  // Get gold amount
  const gold = (() => {
    if (!resources) return 0;
    if (typeof resources.gold === 'number') return resources.gold;
    if (resources.gold?.amount) return resources.gold.amount;
    const goldRes = Object.values(resources).find(r => r?.resource_id === 'gold');
    return goldRes?.amount ?? 0;
  })();

  const handlePlant = async (cropId) => {
    const plotId = data.plotId || data.plotIndex;
    await plantCrop(plotId, cropId);
    onClose();
  };

  return (
    <div className="mx-2 mb-2 p-4 rounded-t-xl"
      style={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>

      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          🌱 Selecciona un cultivo
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <p className="text-gray-400 text-xs mb-3">Parcela #{(data.plotIndex ?? 0) + 1} • Oro: {gold} 🪙</p>

      <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
        {CROPS.map(crop => {
          const canAfford = gold >= crop.seedCost;
          return (
            <button
              key={crop.id}
              onClick={() => canAfford && handlePlant(crop.id)}
              disabled={!canAfford}
              className={`p-2 rounded-lg text-left transition-all ${
                canAfford
                  ? 'hover:bg-white/10 active:bg-white/20'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.1)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{crop.icon}</span>
                <div>
                  <p className="text-white text-xs font-semibold">{crop.name}</p>
                  <p className="text-gray-400 text-[10px]">{crop.seedCost} 🪙 • {formatTime(crop.growthTime)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
