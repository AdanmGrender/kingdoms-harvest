/**
 * BottomNavBar — Main tabs: Heroes (left) and World (right).
 * Center slot reserved for building/action context.
 */
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';
import IconButton from '../ui/IconButton';
import { KH } from '../ui/kitPieces';

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
        <IconButton icon="sword" label="Héroes" accent={KH.seal} onClick={openHeroes} style={{ width: 64, height: 64 }} />
        <IconButton icon="castle" accent={KH.brass} onClick={openCastle} aria-label="Castillo" style={{ width: 56, height: 56 }} />
        <IconButton icon="map" label="Mundo" accent={KH.macula} onClick={openWorldMap} style={{ width: 64, height: 64 }} />
      </div>
    </div>
  );
}
