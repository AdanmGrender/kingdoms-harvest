import React from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from './SpriteIcon';

const tabs = [
  { id: 'farm', sprite: 'nav_farm', label: 'Granja' },
  { id: 'castle', sprite: 'nav_castle', label: 'Castillo' },
  { id: 'token', sprite: 'nav_token', label: 'KH Token' },
  { id: 'commerce', sprite: 'nav_commerce', label: 'Comercio' },
  { id: 'combat', sprite: 'nav_combat', label: 'Guerra' },
];

function BottomNav() {
  const { activeTab, setActiveTab } = useGameStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-kingdom-card border-t border-kingdom-blue/50 z-50">
      <div className="flex justify-around items-center py-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center py-1 px-3 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'text-kingdom-gold scale-110'
                : 'text-gray-400 opacity-70'
            }`}
          >
            <SpriteIcon name={tab.sprite} size={24} />
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default BottomNav;
