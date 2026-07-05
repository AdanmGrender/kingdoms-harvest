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
import MainMenu from './components/menu/MainMenu';
import OfflineReportModal from './components/overlay/OfflineReportModal';
import StormBanner from './components/hud/StormBanner';

// Browser preview modes (skip Telegram auth):
//   ?iso=1         → IsoScene
//   ?preview=world → WorldScene (the authenticated game, auth-bypassed)
const URL_PARAMS = new URLSearchParams(window.location.search);
const ISO_PREVIEW =
  URL_PARAMS.get('iso') === '1' || URL_PARAMS.get('preview') === 'world';

// Deep-link patterns handled at startup
const COOP_DEEP_LINK_RE = /^event_(\d+)_s(\d+)$/;

function App() {
  const { initGame, isLoading, error } = useGameStore();
  const overlayActive = useGameStore((s) => !!s.overlayState?.type);
  const menuDismissed = useGameStore((s) => s.menuDismissed);

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

    // Check if the start_param is a co-op session invite (event_5_s12)
    const coopMatch = startParam && COOP_DEEP_LINK_RE.exec(startParam);
    const referralCode = coopMatch ? null : (startParam || urlRef || null);

    if (!ISO_PREVIEW) initGame(referralCode);

    // After game loads, auto-join co-op session from deep link
    if (coopMatch) {
      const eventId   = parseInt(coopMatch[1], 10);
      const sessionId = parseInt(coopMatch[2], 10);
      const handleGameReady = async () => {
        const store = useGameStore.getState();
        const joinResult = await store.joinCoopSession(sessionId);
        if (joinResult) {
          await store.loadWorldEvents();
          const events = useGameStore.getState().worldEvents;
          const ev = events.find((e) => e.id === eventId);
          if (ev) {
            store.setOverlay('world_event', {
              eventId:    ev.id,
              ...ev,
              player_in_session: 1,
              session_id:        sessionId,
              session_count:     joinResult.participant_count,
              session_max:       joinResult.max_participants,
            });
          }
          store.addNotification(
            `¡Te uniste a la sesión cooperativa! ×${joinResult.multiplier?.toFixed(1) || '1.3'} de recompensas`,
            'success',
          );
        }
      };
      // subscribe(listener) form works without subscribeWithSelector middleware;
      // watch for the transition loading=true → loading=false
      const unsub = useGameStore.subscribe((state, prev) => {
        if (prev.isLoading && !state.isLoading) {
          unsub();
          handleGameReady();
        }
      });
    }

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

    // Reload world events when server broadcasts new ones via socket
    const handleWorldEventsRefresh = () => {
      useGameStore.getState().loadWorldEvents();
    };
    EventBridge.on('world_events:refresh', handleWorldEventsRefresh);

    // Reload buildings after construction completes (clears scaffold in Phaser)
    const handleBuildingsRefresh = () => {
      useGameStore.getState().loadBuildings();
    };
    EventBridge.on('buildings:refresh', handleBuildingsRefresh);

    // Sync resources when server pushes production updates via socket
    const handleResourcesRefresh = () => {
      useGameStore.getState().refreshResources();
    };
    EventBridge.on('resources:refresh', handleResourcesRefresh);

    EventBridge.on('building:placed', handleBuildingPlaced);
    return () => {
      EventBridge.off('building:placed', handleBuildingPlaced);
      EventBridge.off('game:notification', handleGameNotification);
      EventBridge.off('world_events:refresh', handleWorldEventsRefresh);
      EventBridge.off('buildings:refresh', handleBuildingsRefresh);
      EventBridge.off('resources:refresh', handleResourcesRefresh);
      document.removeEventListener('touchmove', blockMultiTouch);
      document.removeEventListener('gesturestart', blockGesture);
    };
  }, []);

  if (ISO_PREVIEW) {
    // ?menu=1 → previsualizar el MainMenu sin auth (screenshots del driver)
    if (URL_PARAMS.get('menu') === '1') return <MainMenu />;
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-kingdom-bg">
        <PhaserGame />
        <div className="absolute top-2 left-2 z-50 px-2 py-1 rounded bg-black/70 text-yellow-300 text-xs font-mono pointer-events-none">
          ISO PREVIEW · no auth · drag to pan · wheel to zoom
        </div>
      </div>
    );
  }

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

  // Menú de inicio (F1 idle) — una vez por sesión, antes de entrar al juego
  if (!menuDismissed) return <MainMenu />;

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
      {!overlayActive && <BuildingToolbar />}
      <BottomNavBar />
      <StreakBanner />
      <StormBanner />
      <NotificationToast />
      <TutorialOverlay />
      <OfflineReportModal />
    </div>
  );
}

export default App;
