/**
 * HeroPanel: Browse, summon, level up, equip, and deploy heroes for combat.
 */
import { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import { CharacterSprite } from '../ui/SpriteIcon';
import { HERO_LORE } from '../../config/heroLore';
import SpriteIcon from '../ui/SpriteIcon';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import Bar from '../ui/Bar';
import PortraitRing from '../ui/PortraitRing';
import { KH } from '../ui/kitPieces';

// Rareza (R28): borde por token kh + etiqueta de texto siempre visible (Q5: español, mapa local).
const RARITY_COLORS = {
  common:    { label: 'Común',      border: KH.iron },
  rare:      { label: 'Rara',       border: KH.brass },
  epic:      { label: 'Épica',      border: KH.ember },
  legendary: { label: 'Legendaria', border: KH['brass-light'] },
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
 * Retrato de héroe (R26, R27): PNG de /assets/game/heroes/<id>.png dentro de PortraitRing;
 * si la imagen falla (onError) el anillo muestra el CharacterSprite.
 */
function HeroPortrait({ hero, size }) {
  const heroId = hero.heroId || hero.id;
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [heroId]);
  if (failed || !heroId) {
    return (
      <PortraitRing size={size}>
        <CharacterSprite name={hero.sprite} height={Math.round(size * 0.7)} />
      </PortraitRing>
    );
  }
  return (
    <PortraitRing size={size}>
      <img
        src={`/assets/game/heroes/${heroId}.png`}
        alt={hero.name}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
        draggable={false}
      />
    </PortraitRing>
  );
}

function StatBar({ stat, value }) {
  const pct = Math.min(100, Math.round((value / STAT_CAPS[stat]) * 100));
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="w-5 text-center"><SpriteIcon name={STAT_ICONS[stat]} size={28} /></span>
      <span className="w-8 text-kh-bone-dim uppercase">{stat}</span>
      <Bar className="flex-1" value={pct} tone={stat === 'hp' ? 'seal' : 'ember'} label={stat} />
      <span className="w-8 text-right text-kh-bone">{value}</span>
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
      data-rarity={hero.rarity}
      aria-pressed={selected}
      className="p-2 rounded-lg text-left transition-all w-full"
      style={{
        minHeight: 44,
        backgroundColor: selected ? KH['oak-light'] : KH.oak,
        border: `2px solid ${selected ? KH['brass-light'] : rc.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <HeroPortrait hero={hero} size={48} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate text-kh-bone">{hero.name}</p>
          <p className="text-kh-bone-dim text-xs">
            {rc.label} · Nv.{hero.level}
          </p>
          {hero.deployed && (
            <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded font-bold text-kh-bone"
              style={{ backgroundColor: KH['oak-light'], border: `1px solid ${KH['brass-light']}` }}>
              EN COMBATE
            </span>
          )}
          {hero.inRecovery && (
            <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded text-kh-bone" style={{ backgroundColor: KH.seal }}>
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
      <div className="p-3 rounded-lg" data-rarity={hero.rarity}
        style={{ backgroundColor: KH.oak, border: `2px solid ${rc.border}` }}>
        <div className="flex items-center gap-3">
          <HeroPortrait hero={hero} size={72} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-kh-bone font-display break-words">{hero.name}</p>
            {lore?.title && (
              <p className="text-kh-bone-dim text-xs italic -mt-0.5">«{lore.title}»</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-1.5 py-0.5 rounded text-kh-bone"
                style={{ backgroundColor: KH['oak-light'], border: `1px solid ${rc.border}` }}>{rc.label}</span>
              <span className="text-kh-bone-dim text-xs">Nv.{hero.level} / 20</span>
            </div>
            {/* XP bar */}
            <div className="mt-1.5">
              <Bar value={xpPct} tone="ember" label="Experiencia" />
              <p className="text-kh-bone-dim text-xs mt-0.5">{hero.xp} / {hero.xpNeeded} XP</p>
            </div>
          </div>
        </div>
        <p className="text-kh-bone-dim text-xs mt-2 italic">{hero.passive}</p>
        {lore?.bio && (
          <p className="text-kh-bone-dim text-xs mt-2 leading-relaxed pt-2" style={{ borderTop: `1px solid ${KH.iron}` }}>
            {lore.bio}
          </p>
        )}
      </div>

      {/* Combat deployment */}
      <div className="p-2 rounded-lg" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.iron}` }}>
        {hero.inRecovery ? (
          <div className="text-center">
            <p className="text-kh-bone text-xs font-bold"><SpriteIcon name="moon" size={28} /> Recuperándose</p>
            <p className="text-kh-bone-dim text-xs">
              Disponible en <RecoveryTimer until={hero.recoveryUntil} />
            </p>
          </div>
        ) : hero.deployed ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-kh-brass-light text-xs font-bold"><SpriteIcon name="sword" size={28} /> Desplegado en combate</p>
              <p className="text-kh-bone-dim text-xs">{CLASS_BONUS_LABELS[hero.class]}</p>
            </div>
            <Button onClick={() => onRecall(hero.dbId)} disabled={loading} style={{ fontSize: 13 }}>
              Retirar
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-kh-bone-dim text-xs">Sin desplegar</p>
              <p className="text-kh-bone-dim text-xs">{CLASS_BONUS_LABELS[hero.class]}</p>
            </div>
            <Button onClick={() => onDeploy(hero.dbId)} disabled={loading} style={{ fontSize: 13 }}>
              Desplegar
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1" role="tablist">
        {['stats', 'equip'].map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`kh-tab flex-1 rounded font-bold ${activeTab === tab ? 'kh-tab--active' : ''}`}
          >
            {tab === 'stats' ? 'Stats' : 'Equipar'}
          </button>
        ))}
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-1.5 p-2 rounded-lg" style={{ backgroundColor: KH.ink }}>
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
              <div key={slot} className="p-2 rounded-lg" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.iron}` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-kh-bone-dim">{SLOT_LABELS[slot]}</span>
                  {equippedId && (
                    <Button onClick={() => onUnequip(hero.dbId, slot)} disabled={loading} style={{ fontSize: 13 }}>
                      Quitar
                    </Button>
                  )}
                </div>
                {equippedId ? (
                  <p className="text-kh-brass-light text-xs"><SpriteIcon name="check" size={28} /> {equippedId.replace(/_/g, ' ')}</p>
                ) : (
                  <p className="text-kh-bone-dim text-xs">— vacío —</p>
                )}
                {availableItems.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {availableItems.map((item) => (
                      <Button
                        key={item.id}
                        onClick={() => onEquip(hero.dbId, item.id)}
                        disabled={loading || item.id === equippedId}
                        style={{ fontSize: 13 }}
                      >
                        <SpriteIcon name="backpack" size={28} /> {item.name} ×{item.quantity}
                      </Button>
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
        <Button variant="primary" onClick={() => onLevelUp(hero.dbId)} disabled={loading} className="w-full" style={{ fontSize: 14 }}>
          Nivel {hero.level + 1} · <SpriteIcon name="gold" size={28} /> {goldCost} oro
        </Button>
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
    <Panel
      title={<><SpriteIcon name="sword" size={28} /> Héroes del Reino</>}
      onClose={onClose}
      className="mx-2 mb-2 overflow-y-auto"
      style={{ maxHeight: 'calc(var(--kh-frame-h) * 0.75)' }}
    >
      <div className="flex justify-end mb-3">
        <Button onClick={() => setView(view === 'summon' ? 'roster' : 'summon')} style={{ fontSize: 14 }}>
          Invocar
        </Button>
      </div>

      {/* Summon panel */}
      {view === 'summon' && (
        <div className="mb-4 p-3 rounded-lg space-y-3" style={{ backgroundColor: KH.ink, border: `1px solid ${KH.brass}` }}>
          <p className="text-kh-brass-light text-sm font-bold text-center font-display">
            Portal de Invocación
          </p>
          <p className="text-kh-bone-dim text-xs text-center">
            Invoca un héroe aleatorio. La rareza determina el costo en tokens.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-center text-kh-bone">
            <span>Común: 200 <SpriteIcon name="gem" size={28} /></span>
            <span>Raro: 500 <SpriteIcon name="gem" size={28} /></span>
            <span>Épico: 1000 <SpriteIcon name="gem" size={28} /></span>
            <span><SpriteIcon name="star" size={28} /> Legendario: 2000 <SpriteIcon name="gem" size={28} /></span>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => doSummon(true)} disabled={loading} className="flex-1" style={{ fontSize: 13 }}>
              <SpriteIcon name="gem" size={28} /> {tokenBalance} tokens disponibles
              <br />
              <span className="text-xs">Invocar (tokens)</span>
            </Button>
            <Button onClick={() => doSummon(false)} disabled={loading} className="flex-1" style={{ fontSize: 13 }}>
              <SpriteIcon name="gold" size={28} /> {goldAmount} oro
              <br />
              <span className="text-xs">Común (500 oro)</span>
            </Button>
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
                <p className="text-kh-bone-dim text-xs">Sin héroes</p>
                <Button onClick={() => setView('summon')} className="mt-2" style={{ fontSize: 13 }}>
                  Invocar primero
                </Button>
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
              <p className="text-kh-bone-dim text-xs text-center mt-8">Seleccioná un héroe</p>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
