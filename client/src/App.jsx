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

// Deep-link patterns handled at startup
const COOP_DEEP_LINK_RE = /^event_(\d+)_s(\d+)$/;

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

    // Check if the start_param is a co-op session invite (event_5_s12)
    const coopMatch = startParam && COOP_DEEP_LINK_RE.exec(startParam);
    const referralCode = coopMatch ? null : (startParam || urlRef || null);

    initGame(referralCode);

    // After game loads, auto-join co-op session from deep link
    if (coopMatch) {
      const eventId  = parseInt(coopMatch[1], 10);
      const sessionId = parseInt(coopMatch[2], 10);
      const handleGameReady = async () => {
        const store = useGameStore.getState();
        const joinResult = await store.joinCoopSession(sessionId);
        if (joinResult) {
          // Load world events, then open the event panel
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
      // Defer until after initGame resolves (loading screen gone)
      const unsub = useGameStore.subscribe(
        (state) => state.isLoading,
        (isLoading) => {
          if (!isLoading) {
            unsub();
            handleGameReady();
          }
        },
      );
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

    EventBridge.on('building:placed', handleBuildingPlaced);
    return () => {
      EventBridge.off('building:placed', handleBuildingPlaced);
      EventBridge.off('game:notification', handleGameNotification);
      EventBridge.off('world_events:refresh', handleWorldEventsRefresh);
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
