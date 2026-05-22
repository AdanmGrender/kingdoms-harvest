/**
 * PhaserGame: React component that hosts the Phaser 3 canvas.
 * Bridges the Phaser game instance with the React/Zustand world.
 */
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import gameConfig, { ISO_MODE } from './config';
import EventBridge from './EventBridge';
import useGameStore from '../store/gameStore';

export default function PhaserGame() {
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;

    // Create Phaser game instance
    const game = new Phaser.Game({
      ...gameConfig,
      parent: 'phaser-container',
    });

    // Pass store reference to Phaser via registry
    game.registry.set('store', useGameStore);
    game.registry.set('eventBridge', EventBridge);
    game.registry.set('isoMode', ISO_MODE);

    gameRef.current = game;

    // Handle window resize
    const handleResize = () => {
      game.scale.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      id="phaser-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    />
  );
}
