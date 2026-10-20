/**
 * PhaserGame: React component that hosts the Phaser 3 canvas.
 * `entry` = qué entrada monta el juego: 'hub' (HubSceneB a resolución de dispositivo) o 'preview' (mundo legacy).
 */
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { buildGameConfig, ISO_MODE } from './config';
import { buildDisplaySettings, computeBackingSize, computeRenderScale } from './display';
import EventBridge from './EventBridge';
import useGameStore from '../store/gameStore';

function measure(container) {
  const w = container?.clientWidth || window.innerWidth;
  const h = container?.clientHeight || window.innerHeight;
  return { w, h };
}

export default function PhaserGame({ entry = 'preview' }) {
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

    const css = measure(container);
    const settings = buildDisplaySettings({
      entry, cssWidth: css.w, cssHeight: css.h, dpr: window.devicePixelRatio,
    });
    const hub = settings.entry === 'hub';

    const game = new Phaser.Game({
      ...buildGameConfig(settings),
      parent: 'phaser-container',
    });

    // Pass store reference to Phaser via registry
    game.registry.set('store', useGameStore);
    game.registry.set('eventBridge', EventBridge);
    game.registry.set('isoMode', ISO_MODE);
    game.registry.set('entry', settings.entry);
    game.registry.set('renderScale', settings.renderScale);

    gameRef.current = game;

    // DEV-only handle for tooling/screenshots (Vite lo elimina en build prod,
    // igual que window.__gameStore). Permite forzar escenas/entidades en tests.
    if (import.meta.env.DEV) window.__phaserGame = game;

    let currentScale = settings.renderScale;
    const handleResize = () => {
      if (!hub) {
        game.scale.resize(window.innerWidth, window.innerHeight);
        return;
      }
      // Entrada hub: búfer a px de dispositivo (css × s) y canvas a px CSS vía zoom 1/s (design.md §2.2).
      const { w, h } = measure(document.getElementById('phaser-container'));
      const s = computeRenderScale(window.devicePixelRatio);
      const { width, height, zoom } = computeBackingSize(w, h, s);
      if (s !== currentScale) {
        currentScale = s;
        game.registry.set('renderScale', s);
        game.scale.setZoom(zoom);
      }
      game.scale.resize(width, height);
    };
    let orientationTimer = null;
    const handleOrientation = () => {
      clearTimeout(orientationTimer);
      orientationTimer = setTimeout(handleResize, 200);
    };
    window.addEventListener('resize', handleResize);
    // Also handle orientation change for mobile
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
      clearTimeout(orientationTimer);
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
