import QuestRail from './QuestRail';
import PhaserGame from '../../game/PhaserGame';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

// Pantalla-ancla: el hub B (HubSceneB) ocupa todo el viewport detrás; el riel arriba y la botonera abajo
// flotan encima. Reemplaza al mundo paseable como entrada por defecto.
export default function BastionHub() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  return (
    <div className="fixed inset-0">
      <div className="absolute inset-0">
        <PhaserGame entry="hub" />
      </div>
      {/* TopResourceBar (absolute top-0 z-30) y BottomNavBar (absolute bottom-0
          z-30, con el botón-castillo desbordando hacia arriba) flotan SOBRE este
          layout: el riel y el botón necesitan despejarlas o quedan tapados. El
          flex-1 vacío deja pasar los taps al canvas. */}
      <div className="absolute inset-0 flex flex-col pointer-events-none">
        <div className="pt-20 pointer-events-auto">
          <QuestRail />
        </div>
        <div className="flex-1" />
        <div className="px-3 pb-28 pt-1 flex gap-2 pointer-events-auto">
          <button
            onClick={() => setOverlay('operations', {})}
            className="flex-1 py-3 rounded font-bold flex items-center justify-center gap-2 transition-transform active:scale-95"
            style={{
              fontFamily: 'MedievalSharp, serif',
              // CTA principal atenuado a la paleta: base de piedra con tinte sangre
              // + borde/glow rojo de acento (antes era relleno rojo sólido "candy").
              background: 'linear-gradient(180deg, rgba(74,42,36,0.98) 0%, rgba(38,20,17,0.97) 100%)',
              border: '1.5px solid #b32821',
              boxShadow: '0 2px 10px rgba(0,0,0,0.6), 0 0 12px rgba(179,40,33,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
              color: '#f0d9a8',
            }}
          >
            <SpriteIcon name="map" size={24} fallback="🗺️" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))' }} /> Operaciones
          </button>
          <button
            onClick={() => setOverlay('calendar', {})}
            className="px-4 py-3 rounded font-bold flex items-center justify-center"
            style={{ background: 'rgba(46,42,34,0.92)', border: '1px solid rgba(217,164,65,0.45)' }}
            title="Calendario de login"
          >
            <SpriteIcon name="scroll" size={24} fallback="📅" />
          </button>
          <button
            onClick={() => setOverlay('pass', {})}
            className="px-4 py-3 rounded font-bold flex items-center justify-center"
            style={{ background: 'rgba(46,42,34,0.92)', border: '1px solid rgba(217,164,65,0.45)' }}
            title="Pase de temporada"
          >
            <SpriteIcon name="scroll" size={24} fallback="🎫" />
          </button>
          <button
            onClick={() => setOverlay('codex', {})}
            className="px-4 py-3 rounded font-bold flex items-center justify-center"
            style={{ background: 'rgba(46,42,34,0.92)', border: '1px solid rgba(217,164,65,0.45)' }}
            title="Códice de colección"
          >
            <SpriteIcon name="medal" size={24} fallback="📖" />
          </button>
        </div>
      </div>
    </div>
  );
}
