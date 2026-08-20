import QuestRail from './QuestRail';
import PhaserGame from '../../game/PhaserGame';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

// Pantalla-ancla: riel arriba, base compacta (Phaser en modo hub) al medio,
// botón Operaciones abajo. Reemplaza al mundo paseable como entrada por defecto.
export default function BastionHub() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  return (
    <div className="fixed inset-0 flex flex-col">
      {/* TopResourceBar (absolute top-0 z-30) y BottomNavBar (absolute bottom-0
          z-30, con el botón-castillo desbordando hacia arriba) flotan SOBRE este
          layout: el riel y el botón necesitan despejarlas o quedan tapados. */}
      <div className="pt-20">
        <QuestRail />
      </div>
      {/* PRUEBA de arte: el hub como diorama iso grimdark (estilo de referencia,
          anclado). Reemplaza temporalmente al mundo Phaser top-down para ver el
          look. El sistema final compone la base con sprites de edificios. */}
      <div className="flex-1 relative" style={{
        backgroundImage: 'url(/assets/game/dioramas/hub_bastion.png)',
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#12100e',
      }} />
      <div className="px-3 pb-28 pt-1 flex gap-2">
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
          style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid #ffd700' }}
          title="Calendario de login"
        >
          <SpriteIcon name="scroll" size={24} fallback="📅" />
        </button>
        <button
          onClick={() => setOverlay('pass', {})}
          className="px-4 py-3 rounded font-bold flex items-center justify-center"
          style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid #ffd700' }}
          title="Pase de temporada"
        >
          <SpriteIcon name="scroll" size={24} fallback="🎫" />
        </button>
        <button
          onClick={() => setOverlay('codex', {})}
          className="px-4 py-3 rounded font-bold flex items-center justify-center"
          style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid #4ade80' }}
          title="Códice de colección"
        >
          <SpriteIcon name="medal" size={24} fallback="📖" />
        </button>
      </div>
    </div>
  );
}
