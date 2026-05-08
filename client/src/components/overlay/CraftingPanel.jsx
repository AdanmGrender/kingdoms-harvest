/**
 * CraftingPanel: Craft processed goods from raw resources.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const INGREDIENT_ICONS = {
  wheat: '🌾', wood: '🪵', iron: '⛏️', milk: '🥛',
  gold: '💰', stone: '🪨', carrot: '🥕', potato: '🥔',
};

export default function CraftingPanel({ onClose }) {
  const craftableItems  = useGameStore((s) => s.craftableItems);
  const resources       = useGameStore((s) => s.resources);
  const loadCraftableItems = useGameStore((s) => s.loadCraftableItems);
  const craftItem       = useGameStore((s) => s.craftItem);

  const [quantities, setQuantities]   = useState({});
  const [loadingId, setLoadingId]     = useState(null);

  useEffect(() => { loadCraftableItems(); }, []);

  const canCraft = (item, qty) => {
    if (qty < 1) return false;
    return Object.entries(item.recipe).every(([ingredient, need]) => {
      const have = resources[ingredient]?.amount ?? 0;
      return have >= need * qty;
    });
  };

  const handleCraft = async (item) => {
    const qty = quantities[item.id] || 1;
    if (loadingId || !canCraft(item, qty)) return;
    setLoadingId(item.id);
    try {
      await craftItem(item.id, qty);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="mx-2 mb-2 p-4 pb-6 rounded-t-xl max-h-[65vh] overflow-y-auto"
      style={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          ⚒️ Taller de Fabricación
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      {craftableItems.length === 0 && (
        <p className="text-gray-500 text-xs text-center">Cargando recetas...</p>
      )}

      <div className="space-y-3">
        {craftableItems.map((item) => {
          const qty = quantities[item.id] || 1;
          const affordable = canCraft(item, qty);
          return (
            <div key={item.id} className="p-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
              {/* Item name + icon */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-white text-sm font-semibold">{item.name}</span>
                </div>
              </div>

              {/* Recipe */}
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(item.recipe).map(([ingredient, need]) => {
                  const have = resources[ingredient]?.amount ?? 0;
                  const needed = need * qty;
                  const ok = have >= needed;
                  return (
                    <span key={ingredient}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${ok ? 'text-green-300 bg-green-900/30' : 'text-red-400 bg-red-900/30'}`}>
                      {INGREDIENT_ICONS[ingredient] || '📦'} {needed} {ingredient}
                      <span className="text-gray-400 ml-1">({have})</span>
                    </span>
                  );
                })}
              </div>

              {/* Quantity + Craft */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={1} max={100}
                  value={qty}
                  onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) }))}
                  className="w-14 bg-gray-800 text-white text-xs text-center rounded border border-gray-600 py-1"
                />
                <button
                  onClick={() => handleCraft(item)}
                  disabled={!!loadingId || !affordable}
                  className="flex-1 py-1 rounded text-xs font-bold disabled:opacity-40"
                  style={{ background: affordable ? 'rgba(202,138,4,0.8)' : 'rgba(75,85,99,0.5)', color: 'white' }}>
                  {loadingId === item.id ? '...' : `Fabricar ×${qty}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
