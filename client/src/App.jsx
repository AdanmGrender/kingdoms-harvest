import { useEffect, useCallback } from 'react';
import useGameStore from './store/gameStore';
import EventBridge from './game/EventBridge';
import NotificationToast from './components/ui/NotificationToast';
import LoadingScreen from './components/ui/LoadingScreen';
import SpriteIcon from './components/ui/SpriteIcon';
import PhaserGame from './game/PhaserGame';
import GameHUD from './components/overlay/GameHUD';
import OverlayManager from './components/overlay/OverlayManager';
import BuildingToolbar from './components/overlay/BuildingToolbar';
import TutorialOverlay from './components/overlay/TutorialOverlay';
import StreakBanner from './components/overlay/StreakBanner';

function App() {
  const { initGame, isLoading, error } = useGameStore();
  const overlayActive = useGameStore((s) => !!s.overlayState?.type);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#1a1a2e');
      tg.setBackgroundColor('#1a1a2e');
    }

    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    const urlRef = new URLSearchParams(window.location.search).get('ref');
    const referralCode = startParam || urlRef || null;

    initGame(referralCode);

    // Listen for building placement from Phaser scene
    const handleBuildingPlaced = async ({ buildingId, posX, posY }) => {
      const result = await useGameStore.getState().buildNew(buildingId, posX, posY);
      if (result?.success) {
        // Tell Phaser scene to add the building visually
        EventBridge.emit('building:addToScene', {
          buildingId,
          posX,
          posY,
          tileIndex: result.tileIndex ?? 0,
          is_building: true,
        });
      }
    };

    // Bridge socket/Phaser game:notification events into the toast system
    const handleGameNotification = ({ text, type = 'info' }) => {
      useGameStore.getState().addNotification(text, type);
    };
    EventBridge.on('game:notification', handleGameNotification);

    EventBridge.on('building:placed', handleBuildingPlaced);
    return () => {
      EventBridge.off('building:placed', handleBuildingPlaced);
      EventBridge.off('game:notification', handleGameNotification);
    };
  }, []);

  if (isLoading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-6">
          <SpriteIcon name="exclamation" size={48} className="mx-auto mb-4" />
          <p className="text-kingdom-accent text-lg">{error}</p>
          <button onClick={initGame} className="btn-primary mt-4">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // RTS Mode — always Phaser game with React overlays
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-kingdom-bg">
      <PhaserGame />
      <GameHUD />
      <OverlayManager />
      {!overlayActive && <BuildingToolbar />}
      <StreakBanner />
      <NotificationToast />
      <TutorialOverlay />
    </div>
  );
}

export default App;
