/**
 * BottomNavBar — Main tabs: Heroes (left) and World (right).
 * Center slot reserved for building/action context.
 */
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import SpriteIcon from '../ui/SpriteIcon';
import { grimBtn } from './grimChrome';

export default function BottomNavBar() {
  const setOverlay = useGameStore((s) => s.setOverlay);

  const openHeroes = () => {
    // El sistema de héroes ya existe (HeroPanel: roster + gacha + escuadra con
    // retratos grimdark). Antes abría 'troops' como stand-in del juego viejo.
    setOverlay('heroes', {});
  };

  const openWorldMap = () => {
    setOverlay('meta', { tab: 'world' });
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
          style={grimBtn('#b32821')}
        >
          <SpriteIcon name="sword" size={26} fallback="🦸" />
          <span className="text-[9px] font-semibold mt-0.5"
            style={{ fontFamily: 'MedievalSharp, serif', color: '#d9a441' }}>
            Héroes
          </span>
        </button>

        {/* Center — Castle button */}
        <button
          onClick={openCastle}
          className="pointer-events-auto flex flex-col items-center justify-center w-14 h-14 rounded-full transition-transform active:scale-95"
          style={grimBtn('#d9a441')}
        >
          <SpriteIcon name="castle" size={24} fallback="🏰" />
        </button>

        {/* World button — right */}
        <button
          onClick={openWorldMap}
          className="pointer-events-auto flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-transform active:scale-95"
          style={grimBtn('#4fd8c8')}
        >
          <SpriteIcon name="map" size={26} fallback="🗺️" />
          <span className="text-[9px] font-semibold mt-0.5"
            style={{ fontFamily: 'MedievalSharp, serif', color: '#d9a441' }}>
            Mundo
          </span>
        </button>
      </div>
    </div>
  );
}
