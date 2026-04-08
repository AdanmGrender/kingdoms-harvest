import React, { useState } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

const BURN_OPTIONS = [
  { id: 'gold', name: 'Oro', sprite: 'medal', amount: 500, tokens: 5 },
  { id: 'crystal', name: 'Cristal', sprite: 'potion', amount: 1, tokens: 10 },
  { id: 'relic', name: 'Reliquia', sprite: 'heart_gold', amount: 1, tokens: 15 },
  { id: 'blueprint', name: 'Plano', sprite: 'blueprint', amount: 1, tokens: 12 },
];

function BurnPanel({ tokenInfo }) {
  const { burnResources, resources } = useGameStore();
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const handleBurn = async () => {
    if (!selected) return;
    const opt = BURN_OPTIONS.find((o) => o.id === selected);
    await burnResources(selected, quantity * opt.amount);
    setQuantity(1);
  };

  const selectedOpt = BURN_OPTIONS.find((o) => o.id === selected);
  const totalBurn = selectedOpt ? quantity * selectedOpt.amount : 0;
  const totalTokens = selectedOpt ? quantity * selectedOpt.tokens : 0;
  const playerAmount = selected && resources?.[selected] ? resources[selected].amount : 0;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-gray-300 px-1">Quemar Recursos por Tokens</h3>
      <p className="text-xs text-gray-400 px-1">
        Convierte recursos in-game en KH Tokens. Limite diario de quema aplica.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {BURN_OPTIONS.map((opt) => {
          const available = resources?.[opt.id]?.amount || 0;
          return (
            <button
              key={opt.id}
              onClick={() => { setSelected(opt.id); setQuantity(1); }}
              className={`game-card text-center transition-all ${
                selected === opt.id ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              <SpriteIcon name={opt.sprite} size={36} className="mx-auto" />
              <p className="text-xs font-bold mt-1">{opt.name}</p>
              <p className="text-[10px] text-gray-400">{opt.amount} = {opt.tokens} KH</p>
              <p className="text-[10px] text-gray-500">Tenes: {available}</p>
            </button>
          );
        })}
      </div>

      {selected && selectedOpt && (
        <div className="game-card">
          <div className="flex items-center gap-3 mb-3">
            <SpriteIcon name={selectedOpt.sprite} size={32} />
            <div className="flex-1">
              <p className="text-sm font-bold">Quemar {selectedOpt.name}</p>
              <p className="text-xs text-gray-400">Tenes: {playerAmount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="bg-kingdom-blue px-3 py-1 rounded text-sm"
            >
              -
            </button>
            <span className="text-lg font-bold flex-1 text-center">x{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="bg-kingdom-blue px-3 py-1 rounded text-sm"
            >
              +
            </button>
          </div>

          <div className="text-center mb-3 flex items-center justify-center gap-1">
            <p className="text-xs text-gray-400">
              {totalBurn}x {selectedOpt.name} =
            </p>
            <SpriteIcon name="medal" size={14} />
            <span className="text-purple-400 font-bold text-xs">{totalTokens} KH Tokens</span>
          </div>

          <button
            onClick={handleBurn}
            disabled={playerAmount < totalBurn}
            className="btn-primary w-full text-sm disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <SpriteIcon name="reward_bag" size={16} /> Quemar por {totalTokens} KH
          </button>
        </div>
      )}
    </div>
  );
}

export default BurnPanel;
