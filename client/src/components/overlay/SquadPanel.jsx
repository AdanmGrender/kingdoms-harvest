/**
 * SquadPanel — formación de escuadra (F4 idle): hasta 5 héroes que defienden
 * en la Marea Disforme y pelean en PvE. Tocá un slot y elegí héroe.
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import { CharacterSprite } from '../ui/SpriteIcon';

const CLASS_ROLE = {
  warrior: { label: 'Daño',    color: '#b32821' },
  mage:    { label: 'Daño',    color: '#7a5a8a' },
  ranger:  { label: 'Daño',    color: '#5a7a35' },
  paladin: { label: 'Tanque',  color: '#d9a441' },
  rogue:   { label: 'Asesino', color: '#4fd8c8' },
};

export default function SquadPanel({ onClose }) {
  const heroes = useGameStore((s) => s.heroes);
  const squad = useGameStore((s) => s.squad);
  const loadHeroes = useGameStore((s) => s.loadHeroes);
  const loadSquad = useGameStore((s) => s.loadSquad);
  const setSquadSlot = useGameStore((s) => s.setSquadSlot);
  const [picking, setPicking] = useState(null); // slot en selección

  useEffect(() => { loadHeroes(); loadSquad(); }, []);

  const bySlot = {};
  for (const h of squad || []) bySlot[h.slot] = h;
  const inSquad = new Set((squad || []).map((h) => h.dbId));

  const assign = async (slot, heroDbId) => {
    await setSquadSlot(slot, heroDbId);
    setPicking(null);
  };

  return (
    <div
      className="mx-2 mb-2 rounded-t-xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(23, 21, 26, 0.97)',
        border: '1px solid rgba(217, 164, 65, 0.35)',
        maxHeight: '78vh',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30 shrink-0">
        <div>
          <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
            🪖 Escuadra del Bastión
          </h3>
          <p className="text-[10px] text-gray-500">Defiende en la Marea y pelea en tus asaltos</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1">
        {/* 5 slots */}
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((slot) => {
            const h = bySlot[slot];
            return (
              <button
                key={slot}
                onClick={() => setPicking(picking === slot ? null : slot)}
                className={`relative rounded-lg border p-1 h-20 flex flex-col items-center justify-center transition-all ${
                  picking === slot ? 'ring-2 ring-yellow-400' : ''
                } ${h ? 'bg-black/50 border-gray-600/60' : 'bg-black/30 border-dashed border-gray-700/60'}`}
              >
                {h ? (
                  <>
                    <CharacterSprite name={h.sprite} height={34} />
                    <p className="text-[8px] text-white truncate w-full text-center mt-0.5">{h.name.split(',')[0]}</p>
                    <span className="text-[7px] px-1 rounded" style={{ color: CLASS_ROLE[h.class]?.color }}>
                      {CLASS_ROLE[h.class]?.label}
                    </span>
                    {h.recovering && <span className="absolute top-0.5 right-0.5 text-[9px]">🏥</span>}
                  </>
                ) : (
                  <span className="text-xl text-gray-600">＋</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selector de héroe para el slot activo */}
        {picking && (
          <div className="bg-black/40 border border-gray-700/50 rounded-lg p-2 space-y-1 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Slot {picking}</p>
              {bySlot[picking] && (
                <button onClick={() => assign(picking, null)}
                  className="text-[10px] text-red-400 hover:text-red-300">Vaciar slot</button>
              )}
            </div>
            {(heroes || []).length === 0 && (
              <p className="text-[11px] text-gray-500 text-center py-2">
                Sin héroes — invocá en el panel de Héroes
              </p>
            )}
            {(heroes || []).map((h) => {
              const taken = inSquad.has(h.dbId) && bySlot[picking]?.dbId !== h.dbId;
              return (
                <button
                  key={h.dbId}
                  disabled={taken}
                  onClick={() => assign(picking, h.dbId)}
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 bg-black/40 border border-gray-700/40
                             hover:bg-black/60 disabled:opacity-40 text-left"
                >
                  <CharacterSprite name={h.sprite} height={26} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white truncate">{h.name} <span className="text-gray-500">Nv.{h.level}</span></p>
                    <p className="text-[9px]" style={{ color: CLASS_ROLE[h.class]?.color }}>
                      {CLASS_ROLE[h.class]?.label} · ATK {h.stats?.atk ?? '—'}
                    </p>
                  </div>
                  {taken && <span className="text-[9px] text-gray-500">en escuadra</span>}
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-gray-500 text-center">
          Los bonos de clase se apilan: guerreros suman ATK, magos bajan la DEF
          enemiga, paladines reducen tus bajas. Si la escuadra cae, se retira a
          recuperación 30 min.
        </p>
      </div>
    </div>
  );
}
