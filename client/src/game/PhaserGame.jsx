/**
 * PhaserGame: React component that hosts the Phaser 3 canvas.
 * Fixed: Telegram WebApp integration for mobile touch support.
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

    // ─── Telegram WebApp setup ───
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand(); // Full screen mode
      tg.ready();  // Signal the app is ready

      // Disable vertical swipes that close the Mini App
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      }

      // Disable closing confirmation to prevent accidental exits
      if (typeof tg.enableClosingConfirmation === 'function') {
        tg.enableClosingConfirmation();
      }

      console.log('[PhaserGame] Telegram WebApp initialized, platform:', tg.platform);
    }

    // ─── Prevent default touch behaviors on the game container ───
    const container = document.getElementById('phaser-container');
    if (container) {
      // Prevent pull-to-refresh and overscroll
      container.style.touchAction = 'none';
      container.style.overscrollBehavior = 'none';
      container.style.userSelect = 'none';
      container.style.webkitUserSelect = 'none';
      container.style.webkitTouchCallout = 'none';
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

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

    // DEV-only handle for tooling/screenshots (Vite lo elimina en build prod,
    // igual que window.__gameStore). Permite forzar escenas/entidades en tests.
    if (import.meta.env.DEV) window.__phaserGame = game;

    // Handle window resize
    const handleResize = () => {
      game.scale.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Also handle orientation change for mobile
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 200);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
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
        touchAction: 'none',
        overscrollBehavior: 'none',
      }}
    />
  );
}
