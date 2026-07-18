import QuestRail from './QuestRail';
import PhaserGame from '../../game/PhaserGame';
import useGameStore from '../../store/gameStore';

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
      <div className="flex-1 relative">
        <PhaserGame hubMode />
      </div>
      <div className="px-3 pb-28 pt-1">
        <button
          onClick={() => setOverlay('operations', {})}
          className="w-full btn-primary py-3 rounded font-bold"
          style={{ fontFamily: 'MedievalSharp, serif' }}
        >
          🗺️ Operaciones
        </button>
      </div>
    </div>
  );
}
