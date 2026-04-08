import { useEffect } from 'react';
import useGameStore from './store/gameStore';
import TopBar from './components/ui/TopBar';
import BottomNav from './components/ui/BottomNav';
import NotificationToast from './components/ui/NotificationToast';
import FarmView from './components/farm/FarmView';
import CastleView from './components/castle/CastleView';
import CombatView from './components/combat/CombatView';
import CommerceView from './components/commerce/CommerceView';
import TokenView from './components/token/TokenView';
import LoadingScreen from './components/ui/LoadingScreen';
import SpriteIcon from './components/ui/SpriteIcon';
import PhaserGame from './game/PhaserGame';
import GameHUD from './components/overlay/GameHUD';
import OverlayManager from './components/overlay/OverlayManager';

function App() {
  const { initGame, isLoading, error, activeTab, viewMode, setViewMode } = useGameStore();

  useEffect(() => {
    // Configurar Telegram Web App
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#1a1a2e');
      tg.setBackgroundColor('#1a1a2e');
    }

    // Check for referral code from Telegram deep link or URL param
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    const urlRef = new URLSearchParams(window.location.search).get('ref');
    const referralCode = startParam || urlRef || null;

    initGame(referralCode);
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

  const renderTab = () => {
    switch (activeTab) {
      case 'farm': return <FarmView />;
      case 'castle': return <CastleView />;
      case 'combat': return <CombatView />;
      case 'commerce': return <CommerceView />;
      case 'token': return <TokenView />;
      default: return <FarmView />;
    }
  };

  // ─── World Mode (Phaser Game) ───
  if (viewMode === 'world') {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-kingdom-bg">
        {/* Phaser Canvas */}
        <PhaserGame />

        {/* React Overlay Layer */}
        <GameHUD />
        <OverlayManager />
        <NotificationToast />

        {/* Mode toggle button */}
        <button
          onClick={() => setViewMode('classic')}
          className="absolute top-14 right-2 z-50 px-2 py-1 rounded text-[10px] text-yellow-300 hover:text-white transition-colors"
          style={{ background: 'rgba(20, 20, 40, 0.8)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
        >
          Modo Clásico
        </button>
      </div>
    );
  }

  // ─── Classic Mode (Card UI) ───
  return (
    <div className="flex flex-col h-screen max-h-screen">
      <TopBar />
      <main className="flex-1 overflow-y-auto px-3 py-2 pb-20">
        {renderTab()}
      </main>
      <BottomNav />
      <NotificationToast />

      {/* Mode toggle button */}
      <button
        onClick={() => setViewMode('world')}
        className="fixed top-14 right-2 z-50 px-2 py-1 rounded text-[10px] text-yellow-300 hover:text-white transition-colors"
        style={{ background: 'rgba(20, 20, 40, 0.8)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
      >
        Modo Mundo
      </button>
    </div>
  );
}

export default App;
