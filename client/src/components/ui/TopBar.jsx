import React from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from './SpriteIcon';

function TopBar() {
  const { player, resources, tokenInfo } = useGameStore();

  if (!player) return null;

  const mainResources = [
    { id: 'gold', sprite: 'gold', color: 'text-yellow-400' },
    { id: 'kh_token', sprite: 'kh_token', color: 'text-purple-400', isToken: true },
    { id: 'wood', sprite: 'wood', color: 'text-amber-600' },
    { id: 'stone', sprite: 'stone', color: 'text-gray-400' },
    { id: 'iron', sprite: 'iron', color: 'text-blue-300' },
    { id: 'wheat', sprite: 'wheat', color: 'text-yellow-300' },
  ];

  return (
    <div className="bg-kingdom-card border-b border-kingdom-blue/50 px-3 py-2 sticky top-0 z-50">
      {/* Nombre y nivel */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <SpriteIcon name="crown" size={22} />
          <span className="font-bold text-sm">{player.display_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-kingdom-gold font-bold">Nv.{player.level}</span>
          <div className="w-20 progress-bar">
            <div
              className="progress-fill bg-kingdom-gold"
              style={{ width: `${Math.min((player.xp / (100 * Math.pow(1.5, player.level - 1))) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recursos principales */}
      <div className="flex gap-3 overflow-x-auto">
        {mainResources.map((res) => (
          <div key={res.id} className="flex items-center gap-1 text-xs whitespace-nowrap">
            <SpriteIcon name={res.sprite} size={16} />
            <span className={res.color}>
              {res.isToken ? (tokenInfo?.balance || 0) : (resources[res.id]?.amount || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopBar;
