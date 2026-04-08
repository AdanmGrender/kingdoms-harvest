import React, { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon, { CharacterSprite } from '../ui/SpriteIcon';

const TROOP_DATA = {
  militia: { sprite: 'knight', name: 'Milicia', atk: 10, def: 8 },
  archer: { sprite: 'guard', name: 'Arquero', atk: 15, def: 5 },
  cavalry: { sprite: 'warrior', name: 'Caballeria', atk: 20, def: 12 },
  spearman: { sprite: 'explorer', name: 'Lancero', atk: 12, def: 15 },
  siege_ram: { sprite: 'castle_small', name: 'Ariete', atk: 50, def: 5 },
};

function CombatView() {
  const { troops, trainTroops, attackPVE, refreshResources } = useGameStore();
  const [trainForm, setTrainForm] = useState({ troopId: 'militia', quantity: 1 });
  const [attackArmy, setAttackArmy] = useState({});
  const [battleResult, setBattleResult] = useState(null);
  const [activeSection, setActiveSection] = useState('troops');

  useEffect(() => {
    refreshResources();
  }, []);

  const handleTrain = async () => {
    await trainTroops(trainForm.troopId, trainForm.quantity);
  };

  const handleAttack = async () => {
    const armyToSend = {};
    for (const [id, qty] of Object.entries(attackArmy)) {
      if (qty > 0) armyToSend[id] = qty;
    }
    if (Object.keys(armyToSend).length === 0) return;

    const result = await attackPVE(armyToSend);
    if (result) setBattleResult(result);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="font-medieval text-lg text-kingdom-gold mb-3 flex items-center gap-2">
        <SpriteIcon name="castle_flag" size={24} /> Guerra
      </h2>

      {/* Tabs de seccion */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'troops', label: 'Tropas' },
          { id: 'train', label: 'Entrenar' },
          { id: 'attack', label: 'Atacar' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === s.id
                ? 'bg-kingdom-accent text-white'
                : 'bg-kingdom-blue/50 text-gray-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Mis Tropas */}
      {activeSection === 'troops' && (
        <div className="flex flex-col gap-2">
          {troops.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">
              No tenes tropas. Construi un Cuartel y entrena soldados.
            </p>
          )}
          {troops.map((t) => {
            const data = TROOP_DATA[t.troop_id];
            return (
              <div key={t.id} className="game-card flex items-center gap-3">
                <CharacterSprite name={data?.sprite} height={44} />
                <div className="flex-1">
                  <p className="font-bold text-sm">{data?.name}</p>
                  <p className="text-xs text-gray-400">
                    ATK:{data?.atk} DEF:{data?.def}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-kingdom-gold">{t.quantity}</p>
                  {t.training_quantity > 0 && (
                    <p className="text-[10px] text-yellow-300">
                      +{t.training_quantity} entrenando
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Entrenar */}
      {activeSection === 'train' && (
        <div className="game-card">
          <p className="font-bold text-sm mb-3">Entrenar tropas</p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {Object.entries(TROOP_DATA).map(([id, data]) => (
              <button
                key={id}
                onClick={() => setTrainForm({ ...trainForm, troopId: id })}
                className={`p-2 rounded-lg text-center transition-all ${
                  trainForm.troopId === id
                    ? 'bg-kingdom-accent/30 border border-kingdom-accent'
                    : 'bg-kingdom-blue/30'
                }`}
              >
                <CharacterSprite name={data.sprite} height={36} className="mx-auto" />
                <p className="text-[10px] mt-1">{data.name}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <label className="text-xs text-gray-400">Cantidad:</label>
            <input
              type="number"
              min="1"
              max="50"
              value={trainForm.quantity}
              onChange={(e) => setTrainForm({ ...trainForm, quantity: parseInt(e.target.value) || 1 })}
              className="bg-kingdom-blue rounded-lg px-3 py-2 text-sm w-20 text-white"
            />
          </div>

          <button onClick={handleTrain} className="btn-primary w-full">
            Entrenar {trainForm.quantity}x {TROOP_DATA[trainForm.troopId]?.name}
          </button>
        </div>
      )}

      {/* Atacar */}
      {activeSection === 'attack' && (
        <div>
          <div className="game-card mb-3">
            <p className="font-bold text-sm mb-2">Seleccionar ejercito:</p>
            {troops.filter((t) => t.quantity > 0).map((t) => {
              const data = TROOP_DATA[t.troop_id];
              return (
                <div key={t.id} className="flex items-center gap-2 mb-2">
                  <SpriteIcon name={data?.sprite} size={22} />
                  <span className="text-xs flex-1">{data?.name} ({t.quantity} disp.)</span>
                  <input
                    type="number"
                    min="0"
                    max={t.quantity}
                    value={attackArmy[t.troop_id] || 0}
                    onChange={(e) =>
                      setAttackArmy({
                        ...attackArmy,
                        [t.troop_id]: Math.min(parseInt(e.target.value) || 0, t.quantity),
                      })
                    }
                    className="bg-kingdom-blue rounded px-2 py-1 text-sm w-16 text-white"
                  />
                </div>
              );
            })}

            <button onClick={handleAttack} className="btn-primary w-full mt-3">
              Atacar Aldea NPC
            </button>
          </div>

          {/* Resultado de batalla */}
          {battleResult && (
            <div className={`game-card animate-fade-in ${
              battleResult.winner === 'attacker'
                ? 'border-green-500'
                : 'border-red-500'
            }`}>
              <div className="flex justify-center mb-2">
                <SpriteIcon
                  name={battleResult.winner === 'attacker' ? 'trophy' : 'close'}
                  size={40}
                />
              </div>
              <p className="text-center font-bold mb-2">
                {battleResult.winner === 'attacker' ? 'Victoria!' : 'Derrota'}
              </p>
              <p className="text-xs text-gray-400 text-center">
                ATK: {battleResult.attackPower} vs DEF: {battleResult.defensePower}
              </p>
              {battleResult.loot && Object.keys(battleResult.loot).length > 0 && (
                <div className="mt-2 text-center">
                  <p className="text-xs text-kingdom-gold">Botin:</p>
                  <p className="text-sm">
                    {Object.entries(battleResult.loot).map(([k, v]) => `${v} ${k}`).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CombatView;
