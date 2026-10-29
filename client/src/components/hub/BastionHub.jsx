import QuestRail from './QuestRail';
import PhaserGame from '../../game/PhaserGame';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

// Pantalla-ancla: el hub B (HubSceneB) ocupa todo el viewport detrás; el riel arriba y la botonera abajo
// flotan encima. Reemplaza al mundo paseable como entrada por defecto.
export default function BastionHub() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0">
        <PhaserGame entry="hub" />
      </div>
      {/* TopResourceBar (absolute top-0 z-30, 126 px de alto) y BottomNavBar (absolute bottom-0
          z-30, con el botón-castillo desbordando hacia arriba) flotan SOBRE este layout. El riel
          arranca en y=128 (bajo la barra) y queda entre las columnas laterales (8+64 px por lado →
          mx-20); la fila de Operaciones queda por debajo de ambas columnas (ver .kh-rail en
          index.css). El flex-1 vacío deja pasar los taps al canvas. */}
      <div className="absolute inset-0 flex flex-col pointer-events-none">
        <div className="pt-[calc(8rem+var(--kh-safe-top))] mx-20 pointer-events-auto">
          <QuestRail />
        </div>
        <div className="flex-1" />
        <div className="px-3 pb-[calc(84px+var(--kh-safe-bottom))] pt-1 flex gap-2 pointer-events-auto">
          <button
            onClick={() => setOverlay('operations', {})}
            className="flex-1 h-[52px] rounded font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 font-display"
            style={{
              // CTA principal atenuado a la paleta: base de piedra con tinte sangre
              // + borde/glow rojo de acento (antes era relleno rojo sólido "candy").
              background: 'linear-gradient(180deg, rgba(74,42,36,0.98) 0%, rgba(38,20,17,0.97) 100%)',
              border: '1.5px solid #b32821',
              boxShadow: '0 2px 10px rgba(0,0,0,0.6), 0 0 12px rgba(179,40,33,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
              color: '#f0d9a8',
            }}
          >
            <SpriteIcon name="map" size={28} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))' }} /> Operaciones
          </button>
          <button
            onClick={() => setOverlay('calendar', {})}
            className="w-14 h-[52px] shrink-0 rounded font-bold flex items-center justify-center"
            style={{ background: 'rgba(46,42,34,0.92)', border: '1px solid rgba(217,164,65,0.45)' }}
            title="Calendario de login"
          >
            <SpriteIcon name="scroll" size={28} />
          </button>
          <button
            onClick={() => setOverlay('pass', {})}
            className="w-14 h-[52px] shrink-0 rounded font-bold flex items-center justify-center"
            style={{ background: 'rgba(46,42,34,0.92)', border: '1px solid rgba(217,164,65,0.45)' }}
            title="Pase de temporada"
          >
            <SpriteIcon name="scroll" size={28} />
          </button>
          <button
            onClick={() => setOverlay('codex', {})}
            className="w-14 h-[52px] shrink-0 rounded font-bold flex items-center justify-center"
            style={{ background: 'rgba(46,42,34,0.92)', border: '1px solid rgba(217,164,65,0.45)' }}
            title="Códice de colección"
          >
            <SpriteIcon name="medal" size={28} />
          </button>
        </div>
      </div>
    </div>
  );
}
