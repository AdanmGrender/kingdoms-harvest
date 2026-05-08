/**
 * DialogPanel: NPC conversation overlay with mission interaction.
 */
import { useState } from 'react';
import useGameStore from '../../store/gameStore';
import { CharacterSprite } from '../ui/SpriteIcon';

const NPC_GREETINGS = {
  farmer: '¡Hola, aventurero! ¿Buscas trabajo en los campos?',
  baker: '¡Bienvenido! El pan fresco está listo.',
  merchant: '¿Interesado en hacer negocios? Tengo ofertas especiales.',
  knight: '¡Soldado! ¿Estás listo para el combate?',
  princess: 'Bienvenido al castillo. Hay asuntos que requieren tu atención.',
  wizard: 'Los astros revelan grandes desafíos por delante...',
  ranger: 'Ten cuidado en el bosque. No todo es lo que parece.',
};

function parseRewards(rewards) {
  if (Array.isArray(rewards)) return rewards;
  if (typeof rewards === 'string') {
    try { return JSON.parse(rewards); } catch { return []; }
  }
  return [];
}

export default function DialogPanel({ data, onClose }) {
  const missions      = useGameStore((s) => s.missions);
  const acceptMission = useGameStore((s) => s.acceptMission);
  const completeMission = useGameStore((s) => s.completeMission);
  const [loadingId, setLoadingId] = useState(null);

  // Only show available/accepted missions; prefer NPC-specific ones when npc_name is set
  const npcMissions = (missions ?? []).filter((m) => {
    if (m.status !== 'available' && m.status !== 'accepted') return false;
    if (m.npc_name) return m.npc_name.toLowerCase().includes(data.npcId?.toLowerCase() ?? '');
    return true;
  });

  const handleAction = async (mission) => {
    if (loadingId) return;
    setLoadingId(mission.id);
    try {
      if (mission.status === 'accepted') {
        await completeMission(mission.id);
      } else {
        await acceptMission(mission.id);
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="mx-2 mb-2 p-4 pb-6 rounded-t-xl max-h-[65vh] overflow-y-auto"
      style={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>

      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,0,0.2)', padding: '2px' }}>
            <CharacterSprite name={`npc_${data.npcId}` || 'farmer'} height={44} fallback="👤" />
          </div>
          <div>
            <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
              {data.name}
            </h3>
            <p className="text-gray-400 text-[10px] capitalize">{data.npcId || 'NPC'}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      {/* Dialog text */}
      <div className="p-3 rounded-lg mb-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <p className="text-gray-200 text-sm italic">
          "{NPC_GREETINGS[data.npcId] || '¡Hola, aventurero!'}"
        </p>
      </div>

      {/* Missions */}
      {npcMissions.length > 0 && (
        <div>
          <h4 className="text-yellow-300 text-xs font-bold mb-2">Misiones disponibles:</h4>
          <div className="space-y-2">
            {npcMissions.slice(0, 3).map((mission) => (
              <div key={mission.id} className="p-2 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white text-xs font-semibold">{mission.title}</p>
                    <p className="text-gray-400 text-[10px] mt-0.5">{mission.description}</p>
                  </div>
                  {mission.is_urgent && (
                    <span className="text-red-400 text-[10px] font-bold">URGENTE</span>
                  )}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-yellow-300 text-[10px]">
                    Recompensa: {parseRewards(mission.rewards)
                      .map(r => `${r.amount} ${r.resource_id}`).join(', ') || '—'}
                  </span>
                  <button
                    onClick={() => handleAction(mission)}
                    disabled={!!loadingId}
                    className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-[10px] px-2 py-1 rounded"
                  >
                    {loadingId === mission.id
                      ? '...'
                      : mission.status === 'accepted' ? 'Entregar' : 'Aceptar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {npcMissions.length === 0 && (
        <p className="text-gray-500 text-xs text-center">No hay misiones disponibles ahora.</p>
      )}
    </div>
  );
}
