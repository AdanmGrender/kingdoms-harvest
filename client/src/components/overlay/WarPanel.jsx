/**
 * WarPanel: Sieges, battle history, and territory expansion.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';

const SIEGE_ABILITIES = {
  arrow_rain:    { name: 'Lluvia de Flechas', icon: '🏹', description: 'Reduce defensa enemiga un 20%' },
  battering_ram: { name: 'Ariete',            icon: '🪵', description: 'Dano masivo a murallas' },
  rally:         { name: 'Reagrupar',         icon: '📯', description: 'Aumenta ataque un 15%' },
  shield_wall:   { name: 'Muro de Escudos',   icon: '🛡️', description: 'Aumenta defensa un 25%' },
};

const TROOP_ICONS = {
  militia: '🗡️', archer: '🏹', cavalry: '🐎', spearman: '🔱', siege_ram: '🪵',
};

const TYPE_COLORS = {
  plains:   'text-green-400',
  forest:   'text-emerald-400',
  mountain: 'text-gray-300',
  coastal:  'text-blue-400',
  ruins:    'text-purple-400',
};

function TerritoryTab({ playerFactionId }) {
  const territories    = useGameStore((s) => s.territories);
  const troops         = useGameStore((s) => s.troops);
  const loadTerritories = useGameStore((s) => s.loadTerritories);
  const loadTroops     = useGameStore((s) => s.loadTroops);
  const attackPVE      = useGameStore((s) => s.attackPVE);

  const [selected, setSelected]   = useState(null);
  const [army, setArmy]           = useState({});
  const [loading, setLoading]     = useState(false);
  const [filter, setFilter]       = useState('all');

  useEffect(() => {
    loadTerritories();
    loadTroops();
  }, []);

  const readyTroops = (troops || []).filter((t) => t.quantity > 0);
  const totalArmy = Object.values(army).reduce((s, v) => s + v, 0);

  const doAttack = async () => {
    if (!selected || totalArmy === 0) return;
    setLoading(true);
    await attackPVE(army, selected.id, null);
    setLoading(false);
    await loadTerritories();
  };

  const filteredTerritories = filter === 'all'
    ? territories
    : filter === 'mine'
      ? territories.filter((t) => t.ownerFactionId === playerFactionId)
      : filter === 'neutral'
        ? territories.filter((t) => !t.ownerFactionId)
        : territories.filter((t) => t.ownerFactionId && t.ownerFactionId !== playerFactionId);

  const ownedByMyFaction = territories.filter((t) => t.ownerFactionId === playerFactionId).length;
  const neutral          = territories.filter((t) => !t.ownerFactionId).length;

  return (
    <div>
      {/* Summary */}
      <div className="flex gap-2 mb-2 text-[10px]">
        <span className="px-2 py-0.5 rounded bg-green-900/50 text-green-400">
          ✅ Tu facción: {ownedByMyFaction}
        </span>
        <span className="px-2 py-0.5 rounded bg-gray-700/50 text-gray-400">
          🏳️ Neutral: {neutral}
        </span>
        <span className="px-2 py-0.5 rounded bg-red-900/50 text-red-400">
          ⚔️ Enemigos: {territories.length - ownedByMyFaction - neutral}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-2">
        {[['all','Todos'],['mine','Mis'],['neutral','Neutral'],['enemy','Enemigos']].map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 text-[9px] py-1 rounded ${filter === f ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {/* Territory list */}
        <div className="w-1/2 space-y-1 overflow-y-auto max-h-48">
          {filteredTerritories.map((t) => {
            const isMine  = t.ownerFactionId === playerFactionId;
            const isEnemy = t.ownerFactionId && !isMine;
            return (
              <button
                key={t.id}
                onClick={() => { setSelected(t); setArmy({}); }}
                className={`w-full text-left p-1.5 rounded border text-[10px] transition-all ${
                  selected?.id === t.id ? 'border-yellow-400 bg-yellow-900/20' :
                  isMine  ? 'border-green-700/50 bg-green-900/10' :
                  isEnemy ? 'border-red-700/40 bg-red-900/10' :
                  'border-gray-700/40 bg-gray-900/10'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{t.typeIcon}</span>
                  <span className="truncate font-semibold text-white">{t.name}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {isMine  && <span className="text-[8px] px-1 rounded bg-green-800 text-green-300">Tuyo</span>}
                  {isEnemy && <span className="text-[8px] px-1 rounded bg-red-800 text-red-300">Enemigo</span>}
                  {!t.ownerFactionId && <span className="text-[8px] px-1 rounded bg-gray-700 text-gray-400">Neutral</span>}
                  <span className="text-gray-500 text-[8px]">DEF {t.defenseStrength}</span>
                </div>
              </button>
            );
          })}
          {filteredTerritories.length === 0 && (
            <p className="text-gray-600 text-[10px] text-center py-4">Sin territorios</p>
          )}
        </div>

        {/* Territory detail + attack */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="space-y-1.5">
              <div className="p-2 rounded bg-black/20 border border-gray-700/40">
                <p className={`text-xs font-bold ${TYPE_COLORS[selected.type] || 'text-white'}`}>
                  {selected.typeIcon} {selected.name}
                </p>
                <p className="text-gray-400 text-[9px]">{selected.typeLabel}</p>
                <p className="text-yellow-400 text-[9px] mt-1">💰 {selected.bonusDesc}</p>
                <p className="text-gray-500 text-[9px]">Dueño: {selected.ownerFactionName}</p>
                {selected.conqueredAt && (
                  <p className="text-gray-600 text-[9px]">
                    Conquistado: {new Date(selected.conqueredAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {selected.ownerFactionId !== playerFactionId && (
                <>
                  <p className="text-gray-400 text-[9px] font-bold">Ejército de ataque:</p>
                  {readyTroops.length === 0 ? (
                    <p className="text-gray-600 text-[9px]">Sin tropas disponibles</p>
                  ) : (
                    <div className="space-y-1">
                      {readyTroops.map((t) => (
                        <div key={t.troop_id} className="flex items-center gap-1">
                          <span className="text-[10px] w-4">{TROOP_ICONS[t.troop_id]}</span>
                          <span className="text-gray-400 text-[9px] flex-1 truncate">{t.troop_id}</span>
                          <span className="text-gray-500 text-[9px]">/{t.quantity}</span>
                          <input
                            type="number"
                            min="0"
                            max={t.quantity}
                            value={army[t.troop_id] || 0}
                            onChange={(e) => {
                              const v = Math.min(Number(e.target.value), t.quantity);
                              setArmy((prev) => ({ ...prev, [t.troop_id]: v }));
                            }}
                            className="w-10 text-[9px] text-center rounded bg-gray-800 border border-gray-600 text-white"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={doAttack}
                    disabled={loading || totalArmy === 0}
                    className="w-full py-1.5 rounded text-[10px] font-bold text-white disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #7f1d1d, #dc2626)' }}
                  >
                    {loading ? 'Atacando...' : `⚔️ Atacar (${totalArmy} tropas)`}
                  </button>
                </>
              )}

              {selected.ownerFactionId === playerFactionId && (
                <div className="p-2 rounded bg-green-900/20 border border-green-700/30">
                  <p className="text-green-400 text-[10px] font-bold">✅ Territorio propio</p>
                  <p className="text-gray-400 text-[9px]">Recibís {selected.bonusDesc} mientras lo controles.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-[10px] text-center mt-8">
              Seleccioná un territorio
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const FACTION_ICONS = {
  knights_of_dawn: '☀️',
  shadow_merchants: '🌙',
  iron_legion: '🛡️',
  green_wardens: '🌿',
};

function PvPTab() {
  const pvpPlayers      = useGameStore((s) => s.pvpPlayers);
  const loadPvpPlayers  = useGameStore((s) => s.loadPvpPlayers);
  const troops          = useGameStore((s) => s.troops);
  const attackPVP       = useGameStore((s) => s.attackPVP);
  const pvpCooldowns    = useGameStore((s) => s.pvpCooldowns);

  const [selected, setSelected]   = useState(null);
  const [army, setArmy]           = useState({});
  const [abilityId, setAbilityId] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [now, setNow]             = useState(Date.now());

  useEffect(() => { loadPvpPlayers(); }, []);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const readyTroops  = (troops || []).filter((t) => t.quantity > 0);
  const totalArmy    = Object.values(army).reduce((s, v) => s + v, 0);

  const getCooldownMs = (p) => {
    const expiresAt = pvpCooldowns[p.id] || pvpCooldowns[p.telegram_id];
    if (!expiresAt) return 0;
    return Math.max(0, expiresAt - now);
  };

  const formatCooldown = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectedCooldownMs = selected ? getCooldownMs(selected) : 0;

  const doAttack = async () => {
    if (!selected || totalArmy === 0 || selectedCooldownMs > 0) return;
    setLoading(true);
    setResult(null);
    const res = await attackPVP(army, selected.id, abilityId);
    if (res) setResult({ ...res, defenderName: selected.display_name });
    setLoading(false);
  };

  if (result) {
    const won = result.winner === 'attacker';
    const loot = result.loot || {};
    return (
      <div className="space-y-3">
        <div className={`p-3 rounded-lg border ${won ? 'border-green-600 bg-green-900/20' : 'border-red-700 bg-red-900/20'}`}>
          <p className={`text-sm font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>
            {won ? '⚔️ ¡Victoria!' : '💀 Derrota'} vs {result.defenderName}
          </p>
          {won && Object.keys(loot).length > 0 && (
            <p className="text-yellow-300 text-xs mt-1">
              Botín: {Object.entries(loot).map(([r, a]) => `${a}x ${r}`).join(', ')}
            </p>
          )}
          <p className="text-gray-400 text-xs mt-1">{result.message}</p>
        </div>
        <button
          onClick={() => { setResult(null); setSelected(null); setArmy({}); }}
          className="w-full py-2 rounded text-xs font-bold text-white"
          style={{ background: 'rgba(55,65,81,0.8)' }}
        >
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Target list */}
      <div>
        <p className="text-gray-400 text-[10px] font-bold mb-1">Jugadores disponibles:</p>
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {pvpPlayers.length === 0 && (
            <p className="text-gray-600 text-[10px] text-center py-3">Sin jugadores disponibles</p>
          )}
          {pvpPlayers.map((p) => {
            const cdMs = getCooldownMs(p);
            const onCooldown = cdMs > 0;
            return (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setArmy({}); setResult(null); }}
                className={`w-full text-left px-2 py-1.5 rounded text-[10px] transition-all flex items-center gap-2 ${
                  selected?.id === p.id
                    ? 'bg-red-900/40 border border-red-600'
                    : 'bg-gray-800/60 border border-gray-700/40 hover:border-red-700/50'
                }`}
              >
                <span className="text-base">{FACTION_ICONS[p.faction_id] || '⚔️'}</span>
                <span className="flex-1 font-semibold text-white truncate">{p.display_name || `Jugador #${p.id}`}</span>
                {onCooldown ? (
                  <span className="text-orange-400 text-[9px] font-mono">⏳ {formatCooldown(cdMs)}</span>
                ) : (
                  <span className="text-gray-400">Nv.{p.level}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <>
          {/* Ability selector */}
          <div>
            <p className="text-gray-400 text-[10px] font-bold mb-1">Habilidad de asedio:</p>
            <div className="flex gap-1 flex-wrap">
              {[null, ...Object.entries(SIEGE_ABILITIES)].map((entry) => {
                const [id, ab] = Array.isArray(entry) ? entry : [null, null];
                const active = abilityId === id;
                return (
                  <button
                    key={id || 'none'}
                    onClick={() => setAbilityId(id)}
                    className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${
                      active ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {ab ? `${ab.icon} ${ab.name}` : '— Ninguna'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Army builder */}
          <div>
            <p className="text-gray-400 text-[10px] font-bold mb-1">Ejército de ataque:</p>
            {readyTroops.length === 0 ? (
              <p className="text-gray-600 text-[9px]">Sin tropas disponibles</p>
            ) : (
              <div className="space-y-1">
                {readyTroops.map((t) => (
                  <div key={t.troop_id} className="flex items-center gap-2">
                    <span className="text-[10px] w-5">{TROOP_ICONS[t.troop_id]}</span>
                    <span className="text-gray-400 text-[9px] flex-1">{t.troop_id}</span>
                    <span className="text-gray-500 text-[9px]">/{t.quantity}</span>
                    <input
                      type="number" min="0" max={t.quantity}
                      value={army[t.troop_id] || 0}
                      onChange={(e) => {
                        const v = Math.min(Number(e.target.value), t.quantity);
                        setArmy((prev) => ({ ...prev, [t.troop_id]: v }));
                      }}
                      className="w-10 text-[9px] text-center rounded bg-gray-800 border border-gray-600 text-white"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedCooldownMs > 0 ? (
            <div className="w-full py-2 rounded text-xs font-bold text-center text-orange-400 bg-orange-900/20 border border-orange-700/40">
              ⏳ Cooldown: {formatCooldown(selectedCooldownMs)}
            </div>
          ) : (
            <button
              onClick={doAttack}
              disabled={loading || totalArmy === 0}
              className="w-full py-2 rounded text-xs font-bold text-white disabled:opacity-40"
              style={{ background: loading ? 'rgba(55,65,81,0.8)' : 'linear-gradient(135deg, #7f1d1d, #dc2626)' }}
            >
              {loading ? 'Atacando...' : `⚔️ Atacar a ${selected.display_name} (${totalArmy} tropas)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function WarPanel({ data, onClose }) {
  const sieges = useGameStore((s) => s.sieges);
  const player = useGameStore((s) => s.player);
  const loadSieges = useGameStore((s) => s.loadSieges);
  const loadTroops = useGameStore((s) => s.loadTroops);
  const useSiegeAbility = useGameStore((s) => s.useSiegeAbility);

  const [activeTab, setActiveTab] = useState('territories');
  const [now, setNow] = useState(Date.now());

  // Load data on mount
  useEffect(() => {
    loadSieges();
    loadTroops();
  }, []);

  // Countdown timer — tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll sieges every 15s
  useEffect(() => {
    const poll = setInterval(() => loadSieges(), 15000);
    return () => clearInterval(poll);
  }, []);

  const activeSieges = sieges.filter((s) => s.status === 'marching' || s.status === 'fighting');
  const historySieges = sieges.filter((s) => s.status === 'resolved');

  const formatCountdown = (arrivesAt) => {
    const remaining = Math.max(0, new Date(arrivesAt).getTime() - now);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseJSON = (str) => {
    try { return JSON.parse(str); } catch { return {}; }
  };

  const isAttacker = (siege) => {
    return siege.attacker_id === player?.id || siege.attacker_id === player?.telegram_id;
  };

  const openTroopPanel = (mode) => {
    useGameStore.getState().setOverlay('troops', { mode });
  };

  return (
    <div
      className="mx-2 mb-2 p-4 rounded-t-xl max-h-[65vh] overflow-y-auto"
      style={{ background: 'rgba(22, 33, 62, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          Zona de Guerra
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {[
          { id: 'territories', label: '🗺️ Territorios' },
          { id: 'pvp',         label: '⚔️ PvP' },
          { id: 'active',      label: `Asedios (${activeSieges.length})` },
          { id: 'history',     label: 'Historial' },
        ].map(({ id, label }) => (
          <button
            key={id}
            className={`flex-1 text-[10px] py-1.5 rounded ${activeTab === id ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Territories */}
      {activeTab === 'territories' && (
        <TerritoryTab playerFactionId={player?.faction_id || null} />
      )}

      {/* PvP */}
      {activeTab === 'pvp' && <PvPTab />}

      {/* Active Sieges */}
      {activeTab === 'active' && (
        <div className="space-y-2 mb-3">
          {activeSieges.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-4">No tienes asedios activos.</p>
          ) : (
            activeSieges.map((siege) => {
              const army = parseJSON(siege.attacker_army);
              const isMine = isAttacker(siege);
              return (
                <div
                  key={siege.id}
                  className="p-2 rounded"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}
                >
                  {/* Status + countdown */}
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      siege.status === 'marching' ? 'bg-blue-800 text-blue-300' : 'bg-red-800 text-red-300'
                    }`}>
                      {siege.status === 'marching' ? 'En marcha' : 'En combate'}
                    </span>
                    {siege.status === 'marching' && (
                      <span className="text-yellow-300 text-xs font-mono">
                        {formatCountdown(siege.arrives_at)}
                      </span>
                    )}
                  </div>

                  {/* Role */}
                  <div className="text-gray-400 text-[10px] mb-1">
                    {isMine ? 'Atacando' : 'Defendiendo'}
                  </div>

                  {/* Army composition */}
                  <div className="flex gap-2 mb-1">
                    {Object.entries(army).map(([troopId, qty]) => (
                      <span key={troopId} className="text-white text-xs">
                        {TROOP_ICONS[troopId] || troopId} x{qty}
                      </span>
                    ))}
                  </div>

                  {/* Abilities (only during fighting, only for attacker) */}
                  {siege.status === 'fighting' && isMine && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(SIEGE_ABILITIES).map(([id, ab]) => (
                        <button
                          key={id}
                          className="bg-purple-800 hover:bg-purple-700 text-white text-[10px] px-2 py-1 rounded"
                          onClick={() => useSiegeAbility(siege.id, id)}
                          title={ab.description}
                        >
                          {ab.icon} {ab.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div className="space-y-2 mb-3">
          {historySieges.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-4">No hay resultados recientes.</p>
          ) : (
            historySieges.map((siege) => {
              const result = parseJSON(siege.result);
              const loot = parseJSON(siege.loot);
              const isMine = isAttacker(siege);
              const won = (result.winner === 'attacker' && isMine) || (result.winner === 'defender' && !isMine);

              return (
                <div
                  key={siege.id}
                  className="p-2 rounded"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}
                >
                  {/* Result badge */}
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      won ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'
                    }`}>
                      {won ? 'Victoria' : 'Derrota'}
                    </span>
                    <span className="text-gray-500 text-[10px]">
                      {isMine ? 'Ataque' : 'Defensa'}
                    </span>
                  </div>

                  {/* Loot */}
                  {won && Object.keys(loot).length > 0 && (
                    <div className="text-green-400 text-[10px] mt-1">
                      Botin: {Object.entries(loot).map(([res, amt]) => `${amt} ${res}`).join(', ')}
                    </div>
                  )}

                  {/* Losses */}
                  {result.attackerLosses && (
                    <div className="text-red-400 text-[10px] mt-1">
                      Perdidas: {Object.entries(isMine ? result.attackerLosses : (result.defenderLosses || {}))
                        .filter(([, v]) => v > 0)
                        .map(([id, v]) => `${TROOP_ICONS[id] || id} -${v}`)
                        .join(', ') || 'ninguna'}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs py-2 rounded"
          onClick={() => openTroopPanel('troops')}
        >
          Gestionar Tropas
        </button>
        <button
          className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs py-2 rounded"
          onClick={() => openTroopPanel('army')}
        >
          Declarar Guerra
        </button>
      </div>
    </div>
  );
}
