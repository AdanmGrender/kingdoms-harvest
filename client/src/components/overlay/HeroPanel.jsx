/**
 * HeroPanel: Browse, summon, level up, equip, and deploy heroes for combat.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import { CharacterSprite } from '../ui/SpriteIcon';

const RARITY_COLORS = {
  common:    { text: 'text-gray-300',   border: 'border-gray-500',   bg: 'bg-gray-800/60',    badge: 'bg-gray-700'   },
  rare:      { text: 'text-blue-300',   border: 'border-blue-500',   bg: 'bg-blue-900/30',    badge: 'bg-blue-800'   },
  epic:      { text: 'text-purple-300', border: 'border-purple-500', bg: 'bg-purple-900/30',  badge: 'bg-purple-800' },
  legendary: { text: 'text-yellow-300', border: 'border-yellow-400', bg: 'bg-yellow-900/30',  badge: 'bg-yellow-700' },
};

const RARITY_ICONS = {
  common: '⚪', rare: '🔵', epic: '🟣', legendary: '⭐',
};

const CLASS_ICONS = {
  warrior: '⚔️', mage: '🔮', ranger: '🏹', paladin: '🛡️', rogue: '🗡️',
};

const CLASS_BONUS_LABELS = {
  warrior: '⚔️ +15% ATK de tropas',
  mage:    '🔮 −15% DEF enemiga',
  ranger:  '🏹 +10% ATK + 5% botín doble',
  paladin: '🛡️ −25% bajas propias al ganar',
  rogue:   '🗡️ +10% recursos robados en PvP',
};

const STAT_ICONS = { atk: '⚔️', def: '🛡️', hp: '❤️', spd: '💨', mgk: '✨' };
const STAT_CAPS  = { atk: 50,  def: 50,  hp: 200, spd: 20, mgk: 50  };

const SLOT_LABELS = { weapon: '⚔️ Arma', armor: '🛡️ Armadura', accessory: '💍 Accesorio' };

function StatBar({ stat, value }) {
  const pct = Math.min(100, Math.round((value / STAT_CAPS[stat]) * 100));
  const color = { atk: '#ef4444', def: '#3b82f6', hp: '#22c55e', spd: '#f59e0b', mgk: '#a855f7' }[stat];
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="w-5 text-center">{STAT_ICONS[stat]}</span>
      <span className="w-6 text-gray-400 uppercase">{stat}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-700">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-6 text-right text-gray-300">{value}</span>
    </div>
  );
}

function RecoveryTimer({ until }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const update = () => {
      const ms = Math.max(0, new Date(until).getTime() - Date.now());
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setRemaining(ms === 0 ? 'Listo' : `${h}h ${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [until]);
  return <span>{remaining}</span>;
}

function HeroCard({ hero, selected, onClick }) {
  const rc = RARITY_COLORS[hero.rarity] || RARITY_COLORS.common;
  return (
    <button
      onClick={onClick}
      className={`p-2.5 rounded-lg border text-left transition-all w-full ${rc.border} ${rc.bg} ${selected ? 'ring-2 ring-yellow-400' : ''}`}
    >
      <div className="flex items-center gap-2">
        <CharacterSprite name={hero.sprite} height={40} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${rc.text}`}>{hero.name}</p>
          <p className="text-gray-500 text-[10px]">
            {RARITY_ICONS[hero.rarity]} {hero.rarity} · Nv.{hero.level}
          </p>
          {hero.deployed && (
            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded bg-green-800 text-green-300 font-bold">
              EN COMBATE
            </span>
          )}
          {hero.inRecovery && (
            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded bg-red-900 text-red-300">
              💤 <RecoveryTimer until={hero.recoveryUntil} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function HeroDetail({ hero, heroItems, onLevelUp, onEquip, onUnequip, onDeploy, onRecall, loading }) {
  const rc = RARITY_COLORS[hero.rarity] || RARITY_COLORS.common;
  const xpPct = Math.min(100, Math.round((hero.xp / hero.xpNeeded) * 100));
  const goldCost = 50 * hero.level;
  const [activeTab, setActiveTab] = useState('stats');

  const itemsBySlot = {};
  for (const slot of ['weapon', 'armor', 'accessory']) {
    itemsBySlot[slot] = heroItems.filter((i) => i.slot === slot);
  }

  return (
    <div className="space-y-3">
      {/* Hero header */}
      <div className={`p-3 rounded-lg border ${rc.border} ${rc.bg}`}>
        <div className="flex items-center gap-3">
          <CharacterSprite name={hero.sprite} height={64} />
          <div className="flex-1">
            <p className={`text-sm font-bold ${rc.text}`} style={{ fontFamily: 'MedievalSharp, serif' }}>{hero.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${rc.badge} ${rc.text}`}>{hero.rarity}</span>
              <span className="text-gray-400 text-[10px]">Nv.{hero.level} / 20</span>
            </div>
            {/* XP bar */}
            <div className="mt-1.5">
              <div className="h-1.5 rounded-full bg-gray-700">
                <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${xpPct}%` }} />
              </div>
              <p className="text-gray-500 text-[9px] mt-0.5">{hero.xp} / {hero.xpNeeded} XP</p>
            </div>
          </div>
        </div>
        <p className="text-gray-400 text-[10px] mt-2 italic">{hero.passive}</p>
      </div>

      {/* Combat deployment */}
      <div className="p-2 rounded-lg border border-gray-700/50 bg-black/20">
        {hero.inRecovery ? (
          <div className="text-center">
            <p className="text-red-400 text-[10px] font-bold">💤 Recuperándose</p>
            <p className="text-gray-500 text-[9px]">
              Disponible en <RecoveryTimer until={hero.recoveryUntil} />
            </p>
          </div>
        ) : hero.deployed ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-[10px] font-bold">⚔️ Desplegado en combate</p>
              <p className="text-gray-500 text-[9px]">{CLASS_BONUS_LABELS[hero.class]}</p>
            </div>
            <button
              onClick={() => onRecall(hero.dbId)}
              disabled={loading}
              className="text-[9px] px-2 py-1 rounded border border-gray-500 text-gray-300 hover:border-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Retirar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-[10px]">Sin desplegar</p>
              <p className="text-gray-600 text-[9px]">{CLASS_BONUS_LABELS[hero.class]}</p>
            </div>
            <button
              onClick={() => onDeploy(hero.dbId)}
              disabled={loading}
              className="text-[9px] px-2 py-1 rounded border border-green-600 text-green-300 hover:bg-green-900/40 disabled:opacity-50"
            >
              Desplegar
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {['stats', 'equip'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${activeTab === tab ? 'bg-yellow-700 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            {tab === 'stats' ? '📊 Stats' : '🎒 Equipar'}
          </button>
        ))}
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-1.5 p-2 rounded-lg bg-black/20">
          {Object.entries(hero.stats).map(([stat, val]) => (
            STAT_ICONS[stat] && <StatBar key={stat} stat={stat} value={val} />
          ))}
        </div>
      )}

      {activeTab === 'equip' && (
        <div className="space-y-2">
          {['weapon', 'armor', 'accessory'].map((slot) => {
            const equippedId = hero.equipment[slot];
            const availableItems = itemsBySlot[slot] || [];
            return (
              <div key={slot} className="p-2 rounded-lg bg-black/20 border border-gray-700/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-gray-400">{SLOT_LABELS[slot]}</span>
                  {equippedId && (
                    <button
                      onClick={() => onUnequip(hero.dbId, slot)}
                      disabled={loading}
                      className="text-[9px] text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {equippedId ? (
                  <p className="text-yellow-300 text-[10px]">✅ {equippedId.replace(/_/g, ' ')}</p>
                ) : (
                  <p className="text-gray-600 text-[10px]">— vacío —</p>
                )}
                {availableItems.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {availableItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onEquip(hero.dbId, item.id)}
                        disabled={loading || item.id === equippedId}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${item.id === equippedId ? 'border-yellow-600 text-yellow-400 opacity-50' : 'border-gray-600 text-gray-300 hover:border-blue-400 hover:text-blue-300'} disabled:opacity-40`}
                      >
                        {item.icon} {item.name} ×{item.quantity}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Level up button */}
      {hero.level < 20 && (
        <button
          onClick={() => onLevelUp(hero.dbId)}
          disabled={loading}
          className="w-full py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #b45309, #d97706)' }}
        >
          ⬆ Nivel {hero.level + 1} · 💰 {goldCost} oro
        </button>
      )}
    </div>
  );
}

export default function HeroPanel({ onClose }) {
  const heroes      = useGameStore((s) => s.heroes);
  const heroItems   = useGameStore((s) => s.heroItems);
  const tokenInfo   = useGameStore((s) => s.tokenInfo);
  const resources   = useGameStore((s) => s.resources);
  const loadHeroes        = useGameStore((s) => s.loadHeroes);
  const loadHeroItems     = useGameStore((s) => s.loadHeroItems);
  const loadDeployedHero  = useGameStore((s) => s.loadDeployedHero);
  const summonHero        = useGameStore((s) => s.summonHero);
  const levelUpHero       = useGameStore((s) => s.levelUpHero);
  const equipHeroItem     = useGameStore((s) => s.equipHeroItem);
  const unequipHeroItem   = useGameStore((s) => s.unequipHeroItem);
  const deployHeroAction  = useGameStore((s) => s.deployHero);
  const recallHeroAction  = useGameStore((s) => s.recallHero);

  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [view, setView]             = useState('roster'); // roster | summon

  useEffect(() => {
    loadHeroes();
    loadHeroItems();
    loadDeployedHero();
  }, []);

  useEffect(() => {
    if (heroes.length > 0 && !selectedId) {
      setSelectedId(heroes[0].dbId);
    }
  }, [heroes]);

  const selectedHero = heroes.find((h) => h.dbId === selectedId) || null;

  const doSummon = async (withTokens) => {
    setLoading(true);
    await summonHero(withTokens);
    setLoading(false);
    setView('roster');
  };

  const doLevelUp = async (heroDbId) => {
    setLoading(true);
    await levelUpHero(heroDbId);
    setLoading(false);
  };

  const doEquip = async (heroDbId, itemId) => {
    setLoading(true);
    await equipHeroItem(heroDbId, itemId);
    setLoading(false);
  };

  const doUnequip = async (heroDbId, slot) => {
    setLoading(true);
    await unequipHeroItem(heroDbId, slot);
    setLoading(false);
  };

  const doDeploy = async (heroDbId) => {
    setLoading(true);
    await deployHeroAction(heroDbId);
    setLoading(false);
  };

  const doRecall = async () => {
    setLoading(true);
    await recallHeroAction();
    setLoading(false);
  };

  const goldAmount = resources?.gold?.amount ?? resources?.gold ?? 0;
  const tokenBalance = tokenInfo?.balance ?? 0;

  return (
    <div
      className="mx-2 mb-2 p-4 pb-6 rounded-t-xl max-h-[75vh] overflow-y-auto"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          ⚔️ Héroes del Reino
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === 'summon' ? 'roster' : 'summon')}
            className="text-[10px] px-2 py-1 rounded border border-purple-500 text-purple-300 hover:bg-purple-900/40"
          >
            ✨ Invocar
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
        </div>
      </div>

      {/* Summon panel */}
      {view === 'summon' && (
        <div className="mb-4 p-3 rounded-lg border border-purple-700/50 bg-purple-900/20 space-y-3">
          <p className="text-purple-200 text-xs font-bold text-center" style={{ fontFamily: 'MedievalSharp, serif' }}>
            ✨ Portal de Invocación
          </p>
          <p className="text-gray-400 text-[10px] text-center">
            Invoca un héroe aleatorio. La rareza determina el costo en tokens.
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-center text-gray-300">
            <span>⚪ Común: 200 💎</span>
            <span>🔵 Raro: 500 💎</span>
            <span>🟣 Épico: 1000 💎</span>
            <span>⭐ Legendario: 2000 💎</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => doSummon(true)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              💎 {tokenBalance} tokens disponibles
              <br />
              <span className="text-[9px] opacity-75">Invocar (tokens)</span>
            </button>
            <button
              onClick={() => doSummon(false)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #92400e, #d97706)' }}
            >
              💰 {goldAmount} oro
              <br />
              <span className="text-[9px] opacity-75">Común (500 oro)</span>
            </button>
          </div>
        </div>
      )}

      {/* Roster view */}
      {view === 'roster' && (
        <div className="flex gap-3">
          {/* Hero list */}
          <div className="w-2/5 space-y-1.5 shrink-0">
            {heroes.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 text-xs">Sin héroes</p>
                <button
                  onClick={() => setView('summon')}
                  className="mt-2 text-[10px] text-purple-400 underline"
                >
                  Invocar primero
                </button>
              </div>
            ) : (
              heroes.map((hero) => (
                <HeroCard
                  key={hero.dbId}
                  hero={hero}
                  selected={selectedId === hero.dbId}
                  onClick={() => setSelectedId(hero.dbId)}
                />
              ))
            )}
          </div>

          {/* Hero detail */}
          <div className="flex-1 min-w-0">
            {selectedHero ? (
              <HeroDetail
                hero={selectedHero}
                heroItems={heroItems}
                onLevelUp={doLevelUp}
                onEquip={doEquip}
                onUnequip={doUnequip}
                onDeploy={doDeploy}
                onRecall={doRecall}
                loading={loading}
              />
            ) : (
              <p className="text-gray-600 text-xs text-center mt-8">Seleccioná un héroe</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
