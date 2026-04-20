/**
 * BottomNavBar — Main tabs: Heroes (left) and World (right).
 * Center slot reserved for building/action context.
 */
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

export default function BottomNavBar() {
  const addNotification = useGameStore((s) => s.addNotification);

  const openHeroes = () => {
    addNotification('Sistema de héroes próximamente', 'info');
  };

  const openWorldMap = () => {
    addNotification('Mapa mundial próximamente', 'info');
  };

  const openCastle = () => {
    EventBridge.emit('camera:centerOnCastle');
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none px-3 pb-2">
      <div className="flex items-end justify-between gap-2">
        {/* Heroes button — left */}
        <button
          onClick={openHeroes}
          className="pointer-events-auto flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-transform active:scale-95"
          style={{
            background: 'linear-gradient(180deg, rgba(60,30,100,0.95) 0%, rgba(30,15,50,0.92) 100%)',
            border: '2px solid rgba(200,120,255,0.4)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <span className="text-2xl leading-none">🦸</span>
          <span className="text-purple-200 text-[9px] font-semibold mt-0.5"
            style={{ fontFamily: 'MedievalSharp, serif' }}>
            Héroes
          </span>
        </button>

        {/* Center — Castle button */}
        <button
          onClick={openCastle}
          className="pointer-events-auto flex flex-col items-center justify-center w-14 h-14 rounded-full transition-transform active:scale-95"
          style={{
            background: 'radial-gradient(circle, #ffd750 0%, #b8860b 100%)',
            border: '2px solid rgba(255,255,200,0.6)',
            boxShadow: '0 2px 12px rgba(255,215,80,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        >
          <span className="text-xl leading-none">🏰</span>
        </button>

        {/* World button — right */}
        <button
          onClick={openWorldMap}
          className="pointer-events-auto flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-transform active:scale-95"
          style={{
            background: 'linear-gradient(180deg, rgba(20,60,100,0.95) 0%, rgba(10,30,60,0.92) 100%)',
            border: '2px solid rgba(100,180,255,0.4)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <span className="text-2xl leading-none">🗺️</span>
          <span className="text-blue-200 text-[9px] font-semibold mt-0.5"
            style={{ fontFamily: 'MedievalSharp, serif' }}>
            Mundo
          </span>
        </button>
      </div>
    </div>
  );
}
