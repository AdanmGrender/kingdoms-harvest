import { useState } from 'react';
import useGameStore from '../../store/gameStore';

const FACTIONS = [
  {
    id: 'knights_of_dawn',
    name: 'Caballeros del Alba',
    icon: '☀️',
    color: '#FFD700',
    bonus: '+10% defensa',
    desc: 'Orden noble que protege a los débiles. Ideal para jugadores defensivos.',
  },
  {
    id: 'shadow_merchants',
    name: 'Mercaderes de la Sombra',
    icon: '🌙',
    color: '#9333ea',
    bonus: '+15% ganancias comerciales',
    desc: 'Red de comerciantes astutos. Ideal para jugadores que comercian.',
  },
  {
    id: 'iron_legion',
    name: 'Legión de Hierro',
    icon: '🛡️',
    color: '#ef4444',
    bonus: '+10% ataque',
    desc: 'Guerreros implacables forjados en batalla. Ideal para jugadores agresivos.',
  },
  {
    id: 'green_wardens',
    name: 'Guardianes Verdes',
    icon: '🌳',
    color: '#22c55e',
    bonus: '+15% producción agrícola',
    desc: 'Protectores de la naturaleza. Ideal para jugadores que farmean.',
  },
];

export default function FactionSelectPanel({ onClose }) {
  const joinFaction = useGameStore((s) => s.joinFaction);
  const player = useGameStore((s) => s.player);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const alreadyInFaction = !!player?.faction_id;

  const handleJoin = async () => {
    if (!selected || loading) return;
    setLoading(true);
    const ok = await joinFaction(selected);
    setLoading(false);
    if (ok) onClose();
  };

  return (
    <div
      className="mx-2 mb-2 p-4 rounded-t-xl max-h-[70vh] overflow-y-auto"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3
          className="text-yellow-400 text-sm font-bold"
          style={{ fontFamily: 'MedievalSharp, serif' }}
        >
          {alreadyInFaction ? 'Tu Facción' : 'Elige una Facción'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">
          ✕
        </button>
      </div>

      {alreadyInFaction ? (
        <div className="text-center py-4">
          <p className="text-gray-300 text-sm mb-2">
            Ya pertenecés a una facción.
          </p>
          <p className="text-yellow-400 text-xl">
            {FACTIONS.find((f) => f.id === player.faction_id)?.icon}{' '}
            {FACTIONS.find((f) => f.id === player.faction_id)?.name}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {FACTIONS.find((f) => f.id === player.faction_id)?.bonus}
          </p>
          <p className="text-gray-600 text-[10px] mt-3">
            Las facciones son permanentes. Ayudá a tu facción conquistando territorios.
          </p>
        </div>
      ) : (
        <>
          <p className="text-gray-400 text-xs mb-3">
            Tu facción determina tus bonuses de juego y con quién compartes territorios.{' '}
            <span className="text-yellow-500">Esta elección es permanente.</span>
          </p>

          <div className="space-y-2 mb-4">
            {FACTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selected === f.id
                    ? 'border-yellow-400 bg-yellow-900/20'
                    : 'border-gray-700/40 bg-gray-900/20 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{f.icon}</span>
                  <span
                    className="font-bold text-sm"
                    style={{ color: selected === f.id ? f.color : 'white' }}
                  >
                    {f.name}
                  </span>
                  <span
                    className="ml-auto text-[10px] px-2 py-0.5 rounded font-bold"
                    style={{
                      background: `${f.color}22`,
                      color: f.color,
                      border: `1px solid ${f.color}44`,
                    }}
                  >
                    {f.bonus}
                  </span>
                </div>
                <p className="text-gray-400 text-[11px]">{f.desc}</p>
              </button>
            ))}
          </div>

          <button
            onClick={handleJoin}
            disabled={!selected || loading}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            {loading ? 'Uniéndose...' : selected ? `⚔️ Unirme a ${FACTIONS.find((f) => f.id === selected)?.name}` : 'Seleccioná una facción'}
          </button>
        </>
      )}
    </div>
  );
}
