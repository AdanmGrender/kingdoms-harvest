import React, { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon, { CharacterSprite } from '../ui/SpriteIcon';

const TROOP_DATA = {
  militia:   { sprite: 'knight',       name: 'Milicia',     atk: 10, def: 8  },
  archer:    { sprite: 'guard',        name: 'Arquero',     atk: 15, def: 5  },
  cavalry:   { sprite: 'warrior',      name: 'Caballeria',  atk: 20, def: 12 },
  spearman:  { sprite: 'explorer',     name: 'Lancero',     atk: 12, def: 15 },
  siege_ram: { sprite: 'castle_small', name: 'Ariete',      atk: 50, def: 5  },
};

const SIEGE_ABILITIES = [
  { id: 'rally',       icon: '📯', name: 'Reagrupar',          desc: '+15% ATK',         requires: null },
  { id: 'shield_wall', icon: '🛡️', name: 'Muro de Escudos',   desc: '+25% DEF propia',  requires: { spearman: 3 } },
  { id: 'arrow_rain',  icon: '🏹', name: 'Lluvia de Flechas',  desc: '-20% DEF enemiga', requires: { archer: 5 } },
];

const FACTION_LABELS = {
  knights_of_dawn: '☀️ Caballeros del Alba (+10% DEF)',
  shadow_merchants: '🌙 Mercaderes de la Sombra (+15% comercio)',
  iron_legion: '🛡️ Legión de Hierro (+10% ATK)',
  green_wardens: '🌳 Guardianes Verdes (+15% cosecha)',
};

function ArmySelector({ troops, army, setArmy }) {
  return (
    <div className="space-y-2">
      {troops.filter((t) => t.quantity > 0).map((t) => {
        const data = TROOP_DATA[t.troop_id];
        return (
          <div key={t.id} className="flex items-center gap-2">
            <SpriteIcon name={data?.sprite} size={22} />
            <span className="text-xs flex-1">{data?.name} ({t.quantity} disp.)</span>
            <input
              type="number" min="0" max={t.quantity}
              value={army[t.troop_id] || 0}
              onChange={(e) => setArmy({ ...army, [t.troop_id]: Math.min(parseInt(e.target.value) || 0, t.quantity) })}
              className="bg-kingdom-blue rounded px-2 py-1 text-sm w-16 text-white"
            />
          </div>
        );
      })}
    </div>
  );
}

function AbilityPicker({ troops, selected, onSelect }) {
  // Check if player has required troops for each ability
  const troopMap = {};
  troops.forEach((t) => { troopMap[t.troop_id] = t.quantity; });

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Habilidad de asedio (opcional):</p>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`p-2 rounded-lg text-center text-xs transition-all ${
            !selected ? 'bg-gray-700 border border-gray-500' : 'bg-kingdom-blue/30'
          }`}
        >
          <span className="text-lg block mb-1">—</span>
          Ninguna
        </button>
        {SIEGE_ABILITIES.map((ab) => {
          const hasReqs = !ab.requires || Object.entries(ab.requires).every(
            ([id, qty]) => (troopMap[id] || 0) >= qty
          );
          return (
            <button
              key={ab.id}
              onClick={() => hasReqs && onSelect(ab.id)}
              disabled={!hasReqs}
              className={`p-2 rounded-lg text-center text-xs transition-all ${
                selected === ab.id
                  ? 'bg-purple-700 border border-purple-400'
                  : hasReqs
                    ? 'bg-kingdom-blue/30 hover:bg-kingdom-blue/50'
                    : 'bg-kingdom-blue/10 opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="text-lg block mb-0.5">{ab.icon}</span>
              <span className="font-bold">{ab.name}</span>
              <span className="block text-purple-300 mt-0.5">{ab.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BattleResultCard({ result, isPvp }) {
  if (!result) return null;
  const won = result.winner === 'attacker';
  const losses = result.attackerLosses || {};
  const lossEntries = Object.entries(losses).filter(([, qty]) => qty > 0);
  const defLosses = result.defenderLosses || {};
  const defLossEntries = Object.entries(defLosses).filter(([, qty]) => qty > 0);

  return (
    <div className={`game-card animate-fade-in ${won ? 'border-green-500' : 'border-red-500'}`}>
      <p className="text-center font-bold mb-2">
        {won ? `🏆 Victoria${isPvp ? ' PvP' : ''}!` : `💀 Derrota${isPvp ? ' PvP' : ''}`}
      </p>
      <p className="text-xs text-gray-400 text-center mb-1">
        ATK: {result.attackPower} vs DEF: {result.defensePower}
      </p>
      {result.tokensAwarded > 0 && (
        <p className="text-xs text-yellow-400 text-center mb-2">+{result.tokensAwarded} KH 🪙</p>
      )}
      {result.loot && Object.keys(result.loot).length > 0 && (
        <p className="text-xs text-kingdom-gold text-center mb-2">
          {isPvp ? 'Botín robado' : 'Botín'}: {Object.entries(result.loot).map(([k, v]) => `${v} ${k}`).join(', ')}
        </p>
      )}
      {lossEntries.length > 0 && (
        <p className="text-xs text-red-300 text-center">
          Tus bajas: {lossEntries.map(([k, v]) => `${v} ${k}`).join(', ')}
        </p>
      )}
      {defLossEntries.length > 0 && (
        <p className="text-xs text-red-200/80 text-center">
          Bajas enemigas: {defLossEntries.map(([k, v]) => `${v} ${k}`).join(', ')}
        </p>
      )}
      {Array.isArray(result.battleLog) && result.battleLog.length > 0 && (
        <details className="mt-2 text-[10px] text-gray-400">
          <summary className="cursor-pointer">📜 Ver log de batalla</summary>
          <ul className="mt-1 space-y-0.5 pl-2">
            {result.battleLog.map((line, i) => <li key={i}>· {line}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function HistoryItem({ b, myId }) {
  const isAttacker = b.attacker_id === myId;
  const won = (isAttacker && b.winner === 'attacker') || (!isAttacker && b.winner === 'defender');
  const loot = (() => { try { return JSON.parse(b.loot || '{}'); } catch { return {}; } })();
  const lootEntries = Object.entries(loot);
  const at = b.resolved_at ? new Date(b.resolved_at).toLocaleString() : '';

  return (
    <div className={`game-card text-xs py-2 ${won ? 'border-green-700/60' : 'border-red-700/60'}`}>
      <div className="flex items-center justify-between">
        <span className="font-bold">
          {b.type === 'pve' ? '🏰 PvE' : '⚔️ PvP'} · {isAttacker ? 'Atacaste' : 'Te atacaron'}
        </span>
        <span className={won ? 'text-green-400' : 'text-red-400'}>
          {won ? 'Victoria' : 'Derrota'}
        </span>
      </div>
      {lootEntries.length > 0 && (
        <p className="text-kingdom-gold mt-1">
          {isAttacker ? 'Ganaste' : 'Perdiste'}: {lootEntries.map(([k, v]) => `${v} ${k}`).join(', ')}
        </p>
      )}
      {at && <p className="text-gray-500 mt-0.5">{at}</p>}
    </div>
  );
}

export default function CombatView() {
  const {
    troops, player, pvpPlayers, battleHistory,
    trainTroops, attackPVE, attackPVP,
    loadPvpPlayers, loadBattleHistory, refreshResources,
  } = useGameStore();

  const [trainForm, setTrainForm] = useState({ troopId: 'militia', quantity: 1 });
  const [attackArmy, setAttackArmy] = useState({});
  const [pvpArmy, setPvpArmy] = useState({});
  const [selectedAbility, setSelectedAbility] = useState(null);
  const [pvpAbility, setPvpAbility] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [pvpResult, setPvpResult] = useState(null);
  const [activeSection, setActiveSection] = useState('troops');

  useEffect(() => {
    refreshResources();
  }, []);

  useEffect(() => {
    if (activeSection === 'pvp') loadPvpPlayers();
    if (activeSection === 'history') loadBattleHistory();
  }, [activeSection]);

  const handleTrain = async () => {
    await trainTroops(trainForm.troopId, trainForm.quantity);
  };

  const handleAttack = async () => {
    const armyToSend = Object.fromEntries(
      Object.entries(attackArmy).filter(([, qty]) => qty > 0)
    );
    if (Object.keys(armyToSend).length === 0) return;
    const result = await attackPVE(armyToSend, null, selectedAbility);
    if (result) setBattleResult(result);
  };

  const handlePvpAttack = async () => {
    if (!selectedTarget) return;
    const armyToSend = Object.fromEntries(
      Object.entries(pvpArmy).filter(([, qty]) => qty > 0)
    );
    if (Object.keys(armyToSend).length === 0) return;
    const result = await attackPVP(armyToSend, selectedTarget.id, pvpAbility);
    if (result) setPvpResult(result);
  };

  const sections = [
    { id: 'troops',  label: 'Tropas' },
    { id: 'train',   label: 'Entrenar' },
    { id: 'attack',  label: 'PvE' },
    { id: 'pvp',     label: 'PvP' },
    { id: 'history', label: 'Historial' },
  ];

  return (
    <div className="animate-fade-in">
      <h2 className="font-medieval text-lg text-kingdom-gold mb-3 flex items-center gap-2">
        <SpriteIcon name="castle_flag" size={24} /> Guerra
      </h2>

      {/* Faction badge */}
      {player?.faction_id && (
        <div className="game-card mb-3 py-2 text-xs text-center text-yellow-300 border-yellow-700">
          {FACTION_LABELS[player.faction_id] || player.faction_id}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-2 mb-4">
        {sections.map((s) => (
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
                  <p className="text-xs text-gray-400">ATK:{data?.atk} DEF:{data?.def}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-kingdom-gold">{t.quantity}</p>
                  {t.training_quantity > 0 && (
                    <p className="text-[10px] text-yellow-300">+{t.training_quantity} entrenando</p>
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
              type="number" min="1" max="50"
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

      {/* Atacar PvE */}
      {activeSection === 'attack' && (
        <div className="space-y-3">
          <div className="game-card">
            <p className="font-bold text-sm mb-2">Seleccionar ejército:</p>
            <ArmySelector troops={troops} army={attackArmy} setArmy={setAttackArmy} />
          </div>

          <div className="game-card">
            <AbilityPicker troops={troops} selected={selectedAbility} onSelect={setSelectedAbility} />
          </div>

          <button onClick={handleAttack} className="btn-primary w-full">
            Atacar Aldea NPC {selectedAbility ? `(${SIEGE_ABILITIES.find(a => a.id === selectedAbility)?.name})` : ''}
          </button>

          <BattleResultCard result={battleResult} isPvp={false} />
        </div>
      )}

      {/* PvP */}
      {activeSection === 'pvp' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 text-center">Atacá a otros jugadores y robá recursos</p>

          {/* Target list */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pvpPlayers.length === 0 && (
              <p className="text-gray-400 text-xs text-center py-3">No hay jugadores disponibles</p>
            )}
            {pvpPlayers.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedTarget(p)}
                className={`w-full game-card text-left transition-all py-2 ${
                  selectedTarget?.id === p.id ? 'border-red-500 bg-red-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{p.display_name}</span>
                  <span className="text-xs text-gray-400">Lv{p.level}</span>
                </div>
                {p.faction_id && (
                  <span className="text-[10px] text-gray-500">{FACTION_LABELS[p.faction_id]?.split(' ')[0]} {p.faction_id}</span>
                )}
              </button>
            ))}
          </div>

          {selectedTarget && (
            <>
              <div className="game-card border-red-700">
                <p className="text-xs text-red-400 font-bold mb-2">
                  Atacando a: {selectedTarget.display_name} (Lv{selectedTarget.level})
                </p>
                <ArmySelector troops={troops} army={pvpArmy} setArmy={setPvpArmy} />
              </div>

              <div className="game-card">
                <AbilityPicker troops={troops} selected={pvpAbility} onSelect={setPvpAbility} />
              </div>

              <button
                onClick={handlePvpAttack}
                className="w-full py-3 rounded-lg text-sm font-bold bg-red-700 hover:bg-red-600 text-white transition-all"
              >
                ⚔️ Atacar {selectedTarget.display_name}
              </button>
            </>
          )}

          <BattleResultCard result={pvpResult} isPvp={true} />
        </div>
      )}

      {/* Historial */}
      {activeSection === 'history' && (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {(!battleHistory || battleHistory.length === 0) && (
            <p className="text-gray-400 text-xs text-center py-4">
              No hay batallas todavía. Atacá una aldea NPC o un jugador para empezar.
            </p>
          )}
          {(battleHistory || []).map((b) => (
            <HistoryItem key={b.id} b={b} myId={player?.telegram_id} />
          ))}
        </div>
      )}
    </div>
  );
}
