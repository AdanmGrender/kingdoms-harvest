/**
 * TroopManagementPanel: Troop training, overview, and army composition for war.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const TROOP_INFO = {
  militia:   { name: 'Milicia',          icon: '🗡️', atk: 10, def: 8,  cost: { gold: 20, bread: 1 } },
  archer:    { name: 'Arquero',          icon: '🏹', atk: 15, def: 5,  cost: { gold: 35, bread: 1, wood: 5 } },
  cavalry:   { name: 'Caballeria',       icon: '🐎', atk: 20, def: 12, cost: { gold: 80, bread: 3, ingots: 2 } },
  spearman:  { name: 'Lancero',          icon: '🔱', atk: 12, def: 15, cost: { gold: 30, bread: 1, ingots: 1 } },
  siege_ram: { name: 'Ariete de Asedio', icon: '🪵', atk: 50, def: 5,  cost: { gold: 150, planks: 10, ingots: 5 } },
};

const RESOURCE_ICONS = {
  gold: '🪙', bread: '🍞', wood: '🪵', ingots: '🔩', planks: '🪵', stone: '🪨', iron: '⛏️',
};

const TABS = [
  { id: 'troops', label: 'Mis Tropas' },
  { id: 'train', label: 'Entrenar' },
  { id: 'army', label: 'Ejercito' },
];

export default function TroopManagementPanel({ data, onClose }) {
  const troops = useGameStore((s) => s.troops);
  const resources = useGameStore((s) => s.resources);
  const loadTroops = useGameStore((s) => s.loadTroops);
  const trainTroops = useGameStore((s) => s.trainTroops);
  const declareWar = useGameStore((s) => s.declareWar);

  const [activeTab, setActiveTab] = useState(data?.mode === 'army' ? 'army' : 'troops');
  const [trainForm, setTrainForm] = useState({ troopId: 'militia', quantity: 1 });
  const [armySelection, setArmySelection] = useState({});
  const [defenderId, setDefenderId] = useState(data?.defenderId || '');

  useEffect(() => { loadTroops(); }, []);

  const getTroopCount = (troopId) => {
    const t = troops.find((t) => t.troop_id === troopId);
    return t?.quantity || 0;
  };

  const getResourceAmount = (key) => {
    if (!resources) return 0;
    const res = resources[key];
    if (typeof res === 'object') return res?.amount ?? 0;
    return res ?? 0;
  };

  const totalCost = {};
  if (trainForm.troopId && TROOP_INFO[trainForm.troopId]) {
    for (const [res, amount] of Object.entries(TROOP_INFO[trainForm.troopId].cost)) {
      totalCost[res] = amount * trainForm.quantity;
    }
  }

  const canAffordTrain = Object.entries(totalCost).every(
    ([res, amount]) => getResourceAmount(res) >= amount
  );

  const handleTrain = async () => {
    await trainTroops(trainForm.troopId, trainForm.quantity);
  };

  const handleDeclareWar = async () => {
    const army = {};
    for (const [troopId, qty] of Object.entries(armySelection)) {
      if (qty > 0) army[troopId] = qty;
    }
    if (Object.keys(army).length === 0) return;
    if (!defenderId) return;
    const result = await declareWar(Number(defenderId), army);
    if (result) onClose();
  };

  const totalArmyPower = Object.entries(armySelection).reduce((sum, [troopId, qty]) => {
    return sum + (TROOP_INFO[troopId]?.atk || 0) * qty;
  }, 0);

  return (
    <div
      className="mx-2 mb-2 p-4 rounded-t-xl max-h-[65vh] overflow-y-auto"
      style={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          Gestion de Tropas
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`flex-1 text-xs py-1.5 rounded ${
              activeTab === tab.id
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mis Tropas */}
      {activeTab === 'troops' && (
        <div className="space-y-2">
          {Object.entries(TROOP_INFO).map(([id, info]) => {
            const count = getTroopCount(id);
            const troopRecord = troops.find((t) => t.troop_id === id);
            const training = troopRecord?.training_quantity || 0;
            return (
              <div
                key={id}
                className="flex items-center gap-2 p-2 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}
              >
                <span className="text-lg">{info.icon}</span>
                <div className="flex-1">
                  <div className="text-white text-xs font-bold">{info.name}</div>
                  <div className="text-gray-400 text-[10px]">ATK {info.atk} / DEF {info.def}</div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-300 text-sm font-bold">{count}</div>
                  {training > 0 && (
                    <div className="text-blue-400 text-[10px]">+{training} entrenando</div>
                  )}
                </div>
              </div>
            );
          })}
          {troops.length === 0 && (
            <p className="text-gray-500 text-xs text-center py-4">
              No tienes tropas. Construye un Cuartel para entrenar.
            </p>
          )}
        </div>
      )}

      {/* Entrenar */}
      {activeTab === 'train' && (
        <div className="space-y-3">
          {/* Troop selector */}
          <div className="grid grid-cols-3 gap-1">
            {Object.entries(TROOP_INFO).map(([id, info]) => (
              <button
                key={id}
                className={`p-2 rounded text-center ${
                  trainForm.troopId === id
                    ? 'bg-yellow-700 border border-yellow-400'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => setTrainForm({ ...trainForm, troopId: id })}
              >
                <div className="text-lg">{info.icon}</div>
                <div className="text-white text-[10px]">{info.name}</div>
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Cantidad:</span>
            <input
              type="number"
              min="1"
              max="50"
              value={trainForm.quantity}
              onChange={(e) => setTrainForm({ ...trainForm, quantity: Math.max(1, Math.min(50, Number(e.target.value))) })}
              className="bg-gray-800 rounded px-2 py-1 text-sm w-16 text-white border border-gray-600"
            />
          </div>

          {/* Cost preview */}
          <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-gray-400 text-[10px] mb-1">Costo total:</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(totalCost).map(([res, amount]) => (
                <span
                  key={res}
                  className={`text-xs ${getResourceAmount(res) >= amount ? 'text-green-400' : 'text-red-400'}`}
                >
                  {RESOURCE_ICONS[res] || res} {amount}
                </span>
              ))}
            </div>
          </div>

          <button
            className={`w-full py-2 rounded text-sm font-bold ${
              canAffordTrain
                ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            onClick={handleTrain}
            disabled={!canAffordTrain}
          >
            Entrenar {trainForm.quantity}x {TROOP_INFO[trainForm.troopId]?.name}
          </button>
        </div>
      )}

      {/* Ejercito (army composition for war) */}
      {activeTab === 'army' && (
        <div className="space-y-3">
          <div className="space-y-2">
            {Object.entries(TROOP_INFO).map(([id, info]) => {
              const available = getTroopCount(id);
              if (available === 0) return null;
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 p-2 rounded"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <span>{info.icon}</span>
                  <span className="text-white text-xs flex-1">{info.name}</span>
                  <span className="text-gray-400 text-[10px]">({available})</span>
                  <input
                    type="number"
                    min="0"
                    max={available}
                    value={armySelection[id] || 0}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(available, Number(e.target.value)));
                      setArmySelection({ ...armySelection, [id]: val });
                    }}
                    className="bg-gray-800 rounded px-2 py-1 text-sm w-14 text-white border border-gray-600"
                  />
                </div>
              );
            })}
          </div>

          {totalArmyPower > 0 && (
            <div className="text-center text-yellow-300 text-xs">
              Poder total: {totalArmyPower} ATK
            </div>
          )}

          {/* Target */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Objetivo (ID):</span>
            <input
              type="number"
              min="1"
              value={defenderId}
              onChange={(e) => setDefenderId(e.target.value)}
              className="bg-gray-800 rounded px-2 py-1 text-sm w-20 text-white border border-gray-600"
              placeholder="ID"
            />
          </div>

          <button
            className={`w-full py-2 rounded text-sm font-bold ${
              totalArmyPower > 0 && defenderId
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            onClick={handleDeclareWar}
            disabled={totalArmyPower === 0 || !defenderId}
          >
            Declarar Guerra
          </button>
        </div>
      )}
    </div>
  );
}
