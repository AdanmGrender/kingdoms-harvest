import QuestRail from './QuestRail';
import PhaserGame from '../../game/PhaserGame';
import useGameStore from '../../store/gameStore';

// Pantalla-ancla: riel arriba, base compacta (Phaser en modo hub) al medio,
// botón Operaciones abajo. Reemplaza al mundo paseable como entrada por defecto.
export default function BastionHub() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  return (
    <div className="fixed inset-0 flex flex-col">
      <QuestRail />
      <div className="flex-1 relative">
        <PhaserGame hubMode />
      </div>
      <div className="p-3">
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
