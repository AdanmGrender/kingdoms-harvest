import React from 'react';
import SpriteIcon from './SpriteIcon';

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-kingdom-bg">
      <div className="mb-4 animate-pulse">
        <SpriteIcon name="castle_flag" size={72} />
      </div>
      <h1 className="font-medieval text-2xl text-kingdom-gold mb-2">Kingdoms Harvest</h1>
      <p className="text-gray-400 text-sm">Cargando tu reino...</p>
      <div className="mt-6 flex gap-1">
        <div className="w-2 h-2 bg-kingdom-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-kingdom-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-kingdom-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export default LoadingScreen;
