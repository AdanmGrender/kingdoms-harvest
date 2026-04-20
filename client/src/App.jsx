import { useEffect } from 'react';
import useGameStore from './store/gameStore';
import EventBridge from './game/EventBridge';
import NotificationToast from './components/ui/NotificationToast';
import LoadingScreen from './components/ui/LoadingScreen';
import SpriteIcon from './components/ui/SpriteIcon';
import PhaserGame from './game/PhaserGame';
import TopResourceBar from './components/hud/TopResourceBar';
import BottomNavBar from './components/hud/BottomNavBar';
import BuildingInfoPopup from './components/hud/BuildingInfoPopup';
import ConstructionTimer from './components/hud/ConstructionTimer';
import QuickActionsSidebar from './components/hud/QuickActionsSidebar';
import EventSidebar from './components/hud/EventSidebar';
import SocialSidebar from './components/hud/SocialSidebar';
import OverlayManager from './components/overlay/OverlayManager';
import BuildingToolbar from './components/overlay/BuildingToolbar';
import TutorialOverlay from './components/overlay/TutorialOverlay';
import StreakBanner from './components/overlay/StreakBanner';

function App() {
  const { initGame, isLoading, error } = useGameStore();

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#1a1a2e');
      tg.setBackgroundColor('#1a1a2e');
      // Disable vertical swipes that would minimize the mini app while panning
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      }
    }

    // Block multi-touch browser gestures (page zoom) — single-finger drag still works
    const blockMultiTouch = (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };
    const blockGesture = (e) => e.preventDefault();
    document.addEventListener('touchmove', blockMultiTouch, { passive: false });
    document.addEventListener('gesturestart', blockGesture);

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
      document.removeEventListener('touchmove', blockMultiTouch);
      document.removeEventListener('gesturestart', blockGesture);
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
      <TopResourceBar />
      <QuickActionsSidebar />
      <EventSidebar />
      <SocialSidebar />
      <ConstructionTimer />
      <BuildingInfoPopup />
      <OverlayManager />
      <BuildingToolbar />
      <BottomNavBar />
      <StreakBanner />
      <NotificationToast />
      <TutorialOverlay />
    </div>
  );
}

export default App;
