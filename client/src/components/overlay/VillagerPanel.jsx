/**
 * VillagerPanel: Shows selected villager info and assignment controls.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import EventBridge from '../../game/EventBridge';

const ROLE_LABELS = {
  farmer: { icon: '🧑‍🌾', label: 'Granjero' },
  woodcutter: { icon: '🪓', label: 'Leñador' },
  miner: { icon: '⛏️', label: 'Minero' },
  soldier: { icon: '⚔️', label: 'Soldado' },
  merchant: { icon: '💰', label: 'Mercader' },
  builder: { icon: '🔨', label: 'Constructor' },
};

const BUILDING_NAMES = {
  farm_plot: 'Parcela',
  barn: 'Granero',
  mill: 'Molino',
  wall: 'Muralla',
  tower: 'Torre',
  barracks: 'Cuartel',
  tavern: 'Taberna',
  market: 'Mercado',
  throne_room: 'Sala del Trono',
  library: 'Biblioteca',
  stable: 'Establos',
  smithy: 'Herrería',
  sawmill: 'Serrería',
  trap: 'Trampa',
  embassy: 'Embajada',
};

const STATE_LABELS = {
  idle: { icon: '💤', label: 'Inactivo' },
  walking_to_work: { icon: '🚶', label: 'Caminando' },
  working: { icon: '⚙️', label: 'Trabajando' },
  resting: { icon: '🏠', label: 'Descansando' },
  sleeping: { icon: '😴', label: 'Durmiendo' },
  hungry: { icon: '🍽️', label: 'Hambriento' },
};

export default function VillagerPanel({ data, onClose }) {
  const buildings = useGameStore((s) => s.buildings) || [];
  const [assigning, setAssigning] = useState(false);

  const role = ROLE_LABELS[data.role] || { icon: '👤', label: data.role };
  const state = STATE_LABELS[data.state] || { icon: '❓', label: data.state || 'idle' };
  const hunger = data.hunger ?? 100;
  const happiness = data.happiness ?? 100;

  const handleAssign = async (buildingId) => {
    try {
      const res = await fetch('/api/villagers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ villagerId: data.villagerId, buildingId }),
      });
      if (res.ok) {
        setAssigning(false);
      }
    } catch (err) {
      console.error('Error assigning villager:', err);
    }
  };

  const handleUnassign = async () => {
    try {
      await fetch('/api/villagers/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ villagerId: data.villagerId }),
      });
    } catch (err) {
      console.error('Error unassigning villager:', err);
    }
  };

  return (
    <div
      className="mx-2 mb-2 p-4 rounded-t-xl"
      style={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3
          className="text-yellow-400 text-sm font-bold"
          style={{ fontFamily: 'MedievalSharp, serif' }}
        >
          {role.icon} {data.name || 'Aldeano'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">
          ✕
        </button>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="text-gray-400">
          Rol: <span className="text-white">{role.label}</span>
        </div>
        <div className="text-gray-400">
          Estado: <span className="text-white">{state.icon} {state.label}</span>
        </div>
      </div>

      {/* Stats bars */}
      <div className="space-y-1 mb-3">
        <StatBar label="Hambre" value={hunger} color="bg-orange-500" icon="🍖" />
        <StatBar label="Felicidad" value={happiness} color="bg-pink-500" icon="😊" />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {!assigning ? (
          <>
            <button
              className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded"
              onClick={() => setAssigning(true)}
            >
              Asignar a edificio
            </button>
            <button
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded"
              onClick={handleUnassign}
            >
              Desasignar
            </button>
          </>
        ) : (
          <div className="w-full">
            <p className="text-gray-400 text-xs mb-2">Selecciona un edificio:</p>
            <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto">
              {buildings.length > 0 ? (
                buildings.map((b) => (
                  <button
                    key={b.id}
                    className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded truncate"
                    onClick={() => handleAssign(b.id)}
                  >
                    {BUILDING_NAMES[b.building_id || b.buildingId] || (b.building_id || b.buildingId)}
                  </button>
                ))
              ) : (
                <p className="text-gray-500 text-xs col-span-2">No hay edificios disponibles</p>
              )}
            </div>
            <button
              className="mt-2 text-gray-400 hover:text-white text-xs"
              onClick={() => setAssigning(false)}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, color, icon }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs">{icon}</span>
      <span className="text-gray-400 text-[10px] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="text-gray-400 text-xs w-8 text-right">{value}%</span>
    </div>
  );
}
