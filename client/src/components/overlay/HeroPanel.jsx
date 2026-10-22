/**
 * HeroPanel: Browse, summon, level up, equip, and deploy heroes for combat.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import { CharacterSprite } from '../ui/SpriteIcon';
import { HERO_LORE } from '../../config/heroLore';
import SpriteIcon from '../ui/SpriteIcon';

const RARITY_COLORS = {
  common:    { text: 'text-gray-300',   border: 'border-gray-500',   bg: 'bg-gray-800/60',    badge: 'bg-gray-700'   },
  rare:      { text: 'text-teal-300',   border: 'border-teal-500',   bg: 'bg-teal-900/30',    badge: 'bg-teal-800'   },
  epic:      { text: 'text-orange-300', border: 'border-orange-500', bg: 'bg-orange-900/30',  badge: 'bg-orange-800' },
  legendary: { text: 'text-yellow-300', border: 'border-yellow-400', bg: 'bg-yellow-900/30',  badge: 'bg-yellow-700' },
};

const RARITY_ICONS = {
  common: '', rare: '', epic: '', legendary: 'star',
};

const CLASS_ICONS = {
  warrior: 'sword', mage: 'crystal', ranger: 'bow', paladin: 'shield', rogue: 'sword',
};

const CLASS_BONUS_LABELS = {
  warrior: '+15% ATK de tropas',
  mage:    '−15% DEF enemiga',
  ranger:  '+10% ATK + 5% botín doble',
  paladin: '−25% bajas propias al ganar',
  rogue:   '+10% recursos robados en PvP',
};

const STAT_ICONS = { atk: 'sword', def: 'shield', hp: 'heart', spd: 'speedup', mgk: 'crystal' };
const STAT_CAPS  = { atk: 50,  def: 50,  hp: 200, spd: 20, mgk: 50  };

const SLOT_LABELS = { weapon: 'Arma', armor: 'Armadura', accessory: 'Accesorio' };

/**
 * Retrato de héroe: intenta primero el PNG generado por el agente de arte en
 * /assets/game/heroes/<id>.png (puede no existir todavía) y cae al
 * CharacterSprite legacy si el archivo falta (onError, estado por héroe).
 * Borde según rareza — misma convención RARITY_COLORS del panel.
 */
function HeroPortrait({ hero, height }) {
  const rc = RARITY_COLORS[hero.rarity] || RARITY_COLORS.common;
  const heroId = hero.heroId || hero.id;
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [heroId]);
  if (failed || !heroId) return <CharacterSprite name={hero.sprite} height={height} />;
  return (
    <img
      src={`/assets/game/heroes/${heroId}.png`}
      alt={hero.name}
      onError={() => setFailed(true)}
      className={`object-contain rounded-md border ${rc.border} shrink-0 bg-black/30`}
      style={{ height, width: height }}
      draggable={false}
    />
  );
}

function StatBar({ stat, value }) {
  const pct = Math.min(100, Math.round((value / STAT_CAPS[stat]) * 100));
  // Paleta grimdark (era arcoíris candy): sangre/acero/oliva/oro/teal — on-palette,
  // aún diferenciables.
  const color = { atk: '#b32821', def: '#7d8794', hp: '#6a9a4a', spd: '#d9a441', mgk: '#4fd8c8' }[stat];
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="w-5 text-center"><SpriteIcon name={STAT_ICONS[stat]} size={28} /></span>
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
        <HeroPortrait hero={hero} height={40} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${rc.text}`}>{hero.name}</p>
          <p className="text-gray-500 text-[10px]">
            {/* Punto de rareza en el color de la paleta (era emoji azul/violeta). */}
            <span className={rc.text}>●</span> {hero.rarity} · Nv.{hero.level}
          </p>
          {hero.deployed && (
            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded bg-green-800 text-green-300 font-bold">
              EN COMBATE
            </span>
          )}
          {hero.inRecovery && (
            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded bg-red-900 text-red-300">
              <SpriteIcon name="moon" size={28} /> <RecoveryTimer until={hero.recoveryUntil} />
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
  const lore = HERO_LORE[hero.heroId || hero.id] || null;

  const itemsBySlot = {};
  for (const slot of ['weapon', 'armor', 'accessory']) {
    itemsBySlot[slot] = heroItems.filter((i) => i.slot === slot);
  }

  return (
    <div className="space-y-3">
      {/* Hero header */}
      <div className={`p-3 rounded-lg border ${rc.border} ${rc.bg}`}>
        <div className="flex items-center gap-3">
          <HeroPortrait hero={hero} height={64} />
          <div className="flex-1">
            <p className={`text-sm font-bold ${rc.text} font-display`}>{hero.name}</p>
            {lore?.title && (
              <p className="text-gray-400 text-[10px] italic -mt-0.5">«{lore.title}»</p>
            )}
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
        {lore?.bio && (
          <p className="text-gray-500 text-[10px] mt-2 leading-relaxed border-t border-gray-700/40 pt-2">
            {lore.bio}
          </p>
        )}
      </div>

      {/* Combat deployment */}
      <div className="p-2 rounded-lg border border-gray-700/50 bg-black/20">
        {hero.inRecovery ? (
          <div className="text-center">
            <p className="text-red-400 text-[10px] font-bold"><SpriteIcon name="moon" size={28} /> Recuperándose</p>
            <p className="text-gray-500 text-[9px]">
              Disponible en <RecoveryTimer until={hero.recoveryUntil} />
            </p>
          </div>
        ) : hero.deployed ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-[10px] font-bold"><SpriteIcon name="sword" size={28} /> Desplegado en combate</p>
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
              className="text-[9px] px-2 py-1 rounded border border-teal-600 text-teal-300 hover:bg-teal-900/30 disabled:opacity-50"
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
            {tab === 'stats' ? 'Stats' : 'Equipar'}
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
                  <p className="text-yellow-300 text-[10px]"><SpriteIcon name="check" size={28} /> {equippedId.replace(/_/g, ' ')}</p>
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
                        <SpriteIcon name="backpack" size={28} /> {item.name} ×{item.quantity}
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
          Nivel {hero.level + 1} · <SpriteIcon name="gold" size={28} /> {goldCost} oro
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
      style={{ background: 'rgba(51, 47, 43, 0.97)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-yellow-400 text-sm font-bold font-display">
          <SpriteIcon name="sword" size={28} /> Héroes del Reino
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === 'summon' ? 'roster' : 'summon')}
            className="text-[10px] px-2 py-1 rounded border border-yellow-600 text-yellow-300 hover:bg-yellow-900/30"
          >
            Invocar
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
        </div>
      </div>

      {/* Summon panel */}
      {view === 'summon' && (
        <div className="mb-4 p-3 rounded-lg space-y-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(217,164,65,0.4)' }}>
          <p className="text-yellow-200 text-xs font-bold text-center font-display">
            Portal de Invocación
          </p>
          <p className="text-gray-400 text-[10px] text-center">
            Invoca un héroe aleatorio. La rareza determina el costo en tokens.
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-center text-gray-300">
            <span>Común: 200 <SpriteIcon name="gem" size={28} /></span>
            <span>Raro: 500 <SpriteIcon name="gem" size={28} /></span>
            <span>Épico: 1000 <SpriteIcon name="gem" size={28} /></span>
            <span><SpriteIcon name="star" size={28} /> Legendario: 2000 <SpriteIcon name="gem" size={28} /></span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => doSummon(true)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <SpriteIcon name="gem" size={28} /> {tokenBalance} tokens disponibles
              <br />
              <span className="text-[9px] opacity-75">Invocar (tokens)</span>
            </button>
            <button
              onClick={() => doSummon(false)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #92400e, #d97706)' }}
            >
              <SpriteIcon name="gold" size={28} /> {goldAmount} oro
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
