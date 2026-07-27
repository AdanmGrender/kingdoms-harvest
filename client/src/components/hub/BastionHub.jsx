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
          className="flex-1 btn-primary py-3 rounded font-bold flex items-center justify-center gap-2"
          style={{ fontFamily: 'MedievalSharp, serif' }}
        >
          <SpriteIcon name="map" size={24} fallback="🗺️" /> Operaciones
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
