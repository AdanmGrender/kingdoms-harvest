/**
 * WarPanel: Sieges, battle history, and territory expansion.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import ResultBanner from '../ui/ResultBanner';
import { KH } from '../ui/kitPieces';

// Insignia de estado: etiqueta de texto siempre visible; el tono solo tiñe el borde (R10).
const chipStyle = (tone) => ({ backgroundColor: tone === 'seal' ? KH.seal : KH['oak-light'], border: `1px solid ${tone === 'seal' ? KH.seal : tone === 'iron' ? KH.iron : KH['brass-light']}` });
const inputStyle = { backgroundColor: KH.ink, border: `1px solid ${KH.iron}`, minHeight: 44, minWidth: 44 };

const SIEGE_ABILITIES = {
  arrow_rain:    { name: 'Lluvia de Flechas', icon: 'bow', description: 'Reduce defensa enemiga un 20%' },
  battering_ram: { name: 'Ariete',            icon: 'ram', description: 'Dano masivo a murallas' },
  rally:         { name: 'Reagrupar',         icon: 'exclamation', description: 'Aumenta ataque un 15%' },
  shield_wall:   { name: 'Muro de Escudos',   icon: 'shield', description: 'Aumenta defensa un 25%' },
};

const TROOP_ICONS = {
  militia: 'sword', archer: 'bow', cavalry: 'horse', spearman: 'spear', siege_ram: 'ram',
};

// El tipo de plaza se lee por su etiqueta (`typeLabel`); el color es uno solo (R10).
const TYPE_COLORS = {};

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
      <div className="flex gap-2 mb-2 text-xs">
        <span className="px-2 py-0.5 rounded text-kh-bone" style={chipStyle('brass')}>
          <SpriteIcon name="check" size={28} /> Tu facción: {ownedByMyFaction}
        </span>
        <span className="px-2 py-0.5 rounded text-kh-bone-dim" style={chipStyle('iron')}>
          <SpriteIcon name="alliance" size={28} /> Neutral: {neutral}
        </span>
        <span className="px-2 py-0.5 rounded text-kh-bone" style={chipStyle('seal')}>
          <SpriteIcon name="sword" size={28} /> Enemigos: {territories.length - ownedByMyFaction - neutral}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-2" role="tablist">
        {[['all','Todos'],['mine','Mis'],['neutral','Neutral'],['enemy','Enemigos']].map(([f, label]) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`kh-tab flex-1 ${filter === f ? 'kh-tab--active' : ''}`}
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
                className="w-full text-left p-1.5 rounded text-xs transition-all"
                style={{
                  minHeight: 44,
                  backgroundColor: selected?.id === t.id ? KH['oak-light'] : KH.oak,
                  border: `1px solid ${selected?.id === t.id ? KH['brass-light'] : isMine ? KH.brass : isEnemy ? KH.seal : KH.iron}`,
                }}
              >
                <div className="flex items-center gap-1">
                  <SpriteIcon name="map" size={28} />
                  <span className="truncate font-semibold text-kh-bone">{t.name}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {isMine  && <span className="text-xs px-1 rounded text-kh-bone" style={chipStyle('brass')}>Tuyo</span>}
                  {isEnemy && <span className="text-xs px-1 rounded text-kh-bone" style={chipStyle('seal')}>Enemigo</span>}
                  {!t.ownerFactionId && <span className="text-xs px-1 rounded text-kh-bone-dim" style={chipStyle('iron')}>Neutral</span>}
                  <span className="text-kh-bone-dim text-xs">DEF {t.defenseStrength}</span>
                </div>
              </button>
            );
          })}
          {filteredTerritories.length === 0 && (
            <p className="text-kh-bone-dim text-xs text-center py-4">Sin territorios</p>
          )}
        </div>

        {/* Territory detail + attack */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="space-y-1.5">
              <div className="p-2 rounded" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.iron}` }}>
                <p className={`text-xs font-bold ${TYPE_COLORS[selected.type] || 'text-kh-bone'}`}>
                  <SpriteIcon name="map" size={28} /> {selected.name}
                </p>
                <p className="text-kh-bone-dim text-xs">{selected.typeLabel}</p>
                <p className="text-kh-brass-light text-xs mt-1"><SpriteIcon name="gold" size={28} /> {selected.bonusDesc}</p>
                <p className="text-kh-bone-dim text-xs">Dueño: {selected.ownerFactionName}</p>
                {selected.conqueredAt && (
                  <p className="text-kh-bone-dim text-xs">
                    Conquistado: {new Date(selected.conqueredAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {selected.ownerFactionId !== playerFactionId && (
                <>
                  <p className="text-kh-bone-dim text-xs font-bold">Ejército de ataque:</p>
                  {readyTroops.length === 0 ? (
                    <p className="text-kh-bone-dim text-xs">Sin tropas disponibles</p>
                  ) : (
                    <div className="space-y-1">
                      {readyTroops.map((t) => (
                        <div key={t.troop_id} className="flex items-center gap-1">
                          <span className="text-xs w-4"><SpriteIcon name={TROOP_ICONS[t.troop_id]} size={28} /></span>
                          <span className="text-kh-bone-dim text-xs flex-1 truncate">{t.troop_id}</span>
                          <span className="text-kh-bone-dim text-xs">/{t.quantity}</span>
                          <input
                            type="number"
                            min="0"
                            max={t.quantity}
                            value={army[t.troop_id] || 0}
                            onChange={(e) => {
                              const v = Math.min(Number(e.target.value), t.quantity);
                              setArmy((prev) => ({ ...prev, [t.troop_id]: v }));
                            }}
                            className="w-11 text-xs text-center rounded text-kh-bone" style={inputStyle}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="primary" onClick={doAttack} disabled={loading || totalArmy === 0} className="w-full" style={{ fontSize: 13 }}>
                    {loading ? 'Atacando...' : `Atacar (${totalArmy} tropas)`}
                  </Button>
                </>
              )}

              {selected.ownerFactionId === playerFactionId && (
                <div className="p-2 rounded" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.brass}` }}>
                  <p className="text-kh-brass-light text-xs font-bold"><SpriteIcon name="check" size={28} /> Territorio propio</p>
                  <p className="text-kh-bone-dim text-xs">Recibís {selected.bonusDesc} mientras lo controles.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-kh-bone-dim text-xs text-center mt-8">
              Seleccioná un territorio
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const FACTION_ICONS = {
  knights_of_dawn: 'sun',
  shadow_merchants: 'moon',
  iron_legion: 'shield',
  green_wardens: 'wheat',
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
      <ResultBanner
        outcome={won ? 'victory' : 'defeat'}
        title={`${won ? '¡Victoria!' : 'Derrota'} vs ${result.defenderName}`}
        onClose={() => { setResult(null); setSelected(null); setArmy({}); }}
        closeLabel="← Volver"
      >
        {won && Object.keys(loot).length > 0 && (
          <p className="text-xs">
            Botín: {Object.entries(loot).map(([r, a]) => `${a}x ${r}`).join(', ')}
          </p>
        )}
        <p className="text-xs">{result.message}</p>
      </ResultBanner>
    );
  }

  return (
    <div className="space-y-3">
      {/* Target list */}
      <div>
        <p className="text-kh-bone-dim text-xs font-bold mb-1">Jugadores disponibles:</p>
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {pvpPlayers.length === 0 && (
            <p className="text-kh-bone-dim text-xs text-center py-3">Sin jugadores disponibles</p>
          )}
          {pvpPlayers.map((p) => {
            const cdMs = getCooldownMs(p);
            const onCooldown = cdMs > 0;
            return (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setArmy({}); setResult(null); }}
                className="w-full text-left px-2 py-1.5 rounded text-xs transition-all flex items-center gap-2"
                style={{
                  minHeight: 44,
                  backgroundColor: selected?.id === p.id ? KH['oak-light'] : KH.oak,
                  border: `1px solid ${selected?.id === p.id ? KH['brass-light'] : KH.iron}`,
                }}
              >
                <span className="text-base"><SpriteIcon name={FACTION_ICONS[p.faction_id] || 'sword'} size={28} /></span>
                <span className="flex-1 font-semibold text-kh-bone truncate">{p.display_name || `Jugador #${p.id}`}</span>
                {onCooldown ? (
                  <span className="text-kh-ember text-xs font-mono"><SpriteIcon name="speedup" size={28} /> {formatCooldown(cdMs)}</span>
                ) : (
                  <span className="text-kh-bone-dim">Nv.{p.level}</span>
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
            <p className="text-kh-bone-dim text-xs font-bold mb-1">Habilidad de asedio:</p>
            <div className="flex gap-1 flex-wrap">
              {[null, ...Object.entries(SIEGE_ABILITIES)].map((entry) => {
                const [id, ab] = Array.isArray(entry) ? entry : [null, null];
                const active = abilityId === id;
                return (
                  <button
                    key={id || 'none'}
                    onClick={() => setAbilityId(id)}
                    aria-pressed={active}
                    className={`kh-tab font-bold ${active ? 'kh-tab--active' : ''}`}
                  >
                    {ab ? ab.name : '— Ninguna'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Army builder */}
          <div>
            <p className="text-kh-bone-dim text-xs font-bold mb-1">Ejército de ataque:</p>
            {readyTroops.length === 0 ? (
              <p className="text-kh-bone-dim text-xs">Sin tropas disponibles</p>
            ) : (
              <div className="space-y-1">
                {readyTroops.map((t) => (
                  <div key={t.troop_id} className="flex items-center gap-2">
                    <span className="text-xs w-5"><SpriteIcon name={TROOP_ICONS[t.troop_id]} size={28} /></span>
                    <span className="text-kh-bone-dim text-xs flex-1">{t.troop_id}</span>
                    <span className="text-kh-bone-dim text-xs">/{t.quantity}</span>
                    <input
                      type="number" min="0" max={t.quantity}
                      value={army[t.troop_id] || 0}
                      onChange={(e) => {
                        const v = Math.min(Number(e.target.value), t.quantity);
                        setArmy((prev) => ({ ...prev, [t.troop_id]: v }));
                      }}
                      className="w-11 text-xs text-center rounded text-kh-bone" style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedCooldownMs > 0 ? (
            <div className="w-full py-2 rounded text-xs font-bold text-center text-kh-ember" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.ember}` }}>
              <SpriteIcon name="speedup" size={28} /> Cooldown: {formatCooldown(selectedCooldownMs)}
            </div>
          ) : (
            <Button variant="primary" onClick={doAttack} disabled={loading || totalArmy === 0} className="w-full" style={{ fontSize: 13 }}>
              {loading ? 'Atacando...' : `Atacar a ${selected.display_name} (${totalArmy} tropas)`}
            </Button>
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
    <Panel
      title="Zona de Guerra"
      onClose={onClose}
      className="mx-2 mb-2 overflow-y-auto"
      style={{ maxHeight: 'calc(var(--kh-frame-h) * 0.65)' }}
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-3 flex-wrap" role="tablist">
        {[
          { id: 'territories', label: 'Territorios' },
          { id: 'pvp',         label: 'PvP' },
          { id: 'active',      label: `Asedios (${activeSieges.length})` },
          { id: 'history',     label: 'Historial' },
        ].map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`kh-tab flex-1 ${activeTab === id ? 'kh-tab--active' : ''}`}
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
            <p className="text-kh-bone-dim text-xs text-center py-4">No tienes asedios activos.</p>
          ) : (
            activeSieges.map((siege) => {
              const army = parseJSON(siege.attacker_army);
              const isMine = isAttacker(siege);
              return (
                <div
                  key={siege.id}
                  className="p-2 rounded"
                  style={{ backgroundColor: KH.ink, border: `1px solid ${KH.iron}` }}
                >
                  {/* Status + countdown */}
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs px-2 py-0.5 rounded text-kh-bone"
                      style={chipStyle(siege.status === 'marching' ? 'iron' : 'seal')}>
                      {siege.status === 'marching' ? 'En marcha' : 'En combate'}
                    </span>
                    {siege.status === 'marching' && (
                      <span className="text-kh-ember text-xs font-mono">
                        {formatCountdown(siege.arrives_at)}
                      </span>
                    )}
                  </div>

                  {/* Role */}
                  <div className="text-kh-bone-dim text-xs mb-1">
                    {isMine ? 'Atacando' : 'Defendiendo'}
                  </div>

                  {/* Army composition */}
                  <div className="flex gap-2 mb-1">
                    {Object.entries(army).map(([troopId, qty]) => (
                      <span key={troopId} className="text-kh-bone text-xs">
                        <SpriteIcon name={TROOP_ICONS[troopId]} size={28} /> x{qty}
                      </span>
                    ))}
                  </div>

                  {/* Abilities (only during fighting, only for attacker) */}
                  {siege.status === 'fighting' && isMine && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(SIEGE_ABILITIES).map(([id, ab]) => (
                        <Button
                          key={id}
                          onClick={() => useSiegeAbility(siege.id, id)}
                          title={ab.description}
                          style={{ fontSize: 13 }}
                        >
                          <SpriteIcon name="flame" size={28} /> {ab.name}
                        </Button>
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
            <p className="text-kh-bone-dim text-xs text-center py-4">No hay resultados recientes.</p>
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
                  style={{ backgroundColor: KH.ink, border: `1px solid ${KH.iron}` }}
                >
                  {/* Result badge */}
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs px-2 py-0.5 rounded font-bold text-kh-bone"
                      style={chipStyle(won ? 'brass' : 'seal')}>
                      {won ? 'Victoria' : 'Derrota'}
                    </span>
                    <span className="text-kh-bone-dim text-xs">
                      {isMine ? 'Ataque' : 'Defensa'}
                    </span>
                  </div>

                  {/* Loot */}
                  {won && Object.keys(loot).length > 0 && (
                    <div className="text-kh-brass-light text-xs mt-1">
                      Botin: {Object.entries(loot).map(([res, amt]) => `${amt} ${res}`).join(', ')}
                    </div>
                  )}

                  {/* Losses */}
                  {result.attackerLosses && (
                    <div className="text-kh-bone-dim text-xs mt-1">
                      Perdidas: {Object.entries(isMine ? result.attackerLosses : (result.defenderLosses || {}))
                        .filter(([, v]) => v > 0)
                        .map(([id, v]) => `${id} -${v}`)
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
        <Button className="flex-1" onClick={() => openTroopPanel('troops')} style={{ fontSize: 13 }}>
          Gestionar Tropas
        </Button>
        <Button variant="primary" className="flex-1" onClick={() => openTroopPanel('army')} style={{ fontSize: 13 }}>
          Declarar Guerra
        </Button>
      </div>
    </Panel>
  );
}
