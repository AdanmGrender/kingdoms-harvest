import React, { useState, useEffect, useCallback } from 'react';
import useGameStore from '../../store/gameStore';
import api from '../../services/api';
import SpriteIcon, { CharacterSprite } from '../ui/SpriteIcon';

const RESOURCE_NAMES = {
  wheat: 'Trigo', carrot: 'Zanahoria', potato: 'Papa', tomato: 'Tomate',
  corn: 'Maíz', pumpkin: 'Calabaza', grape: 'Uva',
  wood: 'Madera', stone: 'Piedra', iron: 'Hierro', gold: 'Oro',
  bread: 'Pan', planks: 'Tablones', ingots: 'Lingotes',
  flour: 'Harina', cheese: 'Queso', egg: 'Huevo', milk: 'Leche', wool: 'Lana',
};

const RESOURCE_ICONS = {
  wheat: '🌾', carrot: '🥕', potato: '🥔', tomato: '🍅', corn: '🌽',
  pumpkin: '🎃', grape: '🍇', wood: '🪵', stone: '🪨', iron: '⛏️',
  gold: '🪙', bread: '🍞', planks: '🪵', ingots: '⚙️',
  flour: '🌾', cheese: '🧀', egg: '🥚', milk: '🥛', wool: '🧶',
};

// KH tokens awarded per sell action (mirrors server TOKEN_CONFIG.TOKENS_PER_SALE)
const TOKENS_PER_SELL = 1;

function QuantitySelector({ value, onChange, max, min = 1 }) {
  return (
    <div className="flex items-center gap-1">
      <button
        className="w-6 h-6 rounded bg-gray-700 text-white text-xs font-bold hover:bg-gray-600 flex items-center justify-center"
        onClick={() => onChange(Math.max(min, value - (value >= 10 ? 5 : 1)))}
      >−</button>
      <span className="text-xs font-bold w-6 text-center text-white">{value}</span>
      <button
        className="w-6 h-6 rounded bg-gray-700 text-white text-xs font-bold hover:bg-gray-600 flex items-center justify-center"
        onClick={() => onChange(Math.min(max, value + (value >= 10 ? 5 : 1)))}
      >+</button>
    </div>
  );
}

function CaravanSection({ resources }) {
  const [caravan, setCaravan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyQty, setBuyQty] = useState({});
  const [sellQty, setSellQty] = useState({});
  const addNotification = useGameStore((s) => s.addNotification);
  const refreshResources = useGameStore((s) => s.refreshResources);

  const loadCaravan = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/commerce/caravan');
      setCaravan(data);
    } catch {
      addNotification('Error al cargar la caravana', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCaravan(); }, []);

  const handleBuy = async (offer) => {
    const qty = buyQty[offer.resource_id] || 1;
    try {
      const { data } = await api.post('/commerce/caravan/buy', {
        resourceId: offer.resource_id, quantity: qty,
      });
      addNotification(data.message, 'success');
      refreshResources();
      loadCaravan();
    } catch (e) {
      addNotification(e.response?.data?.error || 'Error al comprar', 'error');
    }
  };

  const handleSell = async (offer) => {
    const qty = sellQty[offer.resource_id] || 1;
    try {
      const { data } = await api.post('/commerce/caravan/sell', {
        resourceId: offer.resource_id, quantity: qty,
      });
      addNotification(data.message, 'success');
      refreshResources();
      loadCaravan();
    } catch (e) {
      addNotification(e.response?.data?.error || 'Error al vender', 'error');
    }
  };

  const playerGold = resources?.gold?.amount ?? 0;

  if (loading) {
    return (
      <div className="text-center py-6">
        <span className="text-2xl animate-spin inline-block">🎠</span>
        <p className="text-gray-400 text-xs mt-2">Convocando caravana...</p>
      </div>
    );
  }

  if (!caravan) return <p className="text-gray-400 text-xs text-center py-4">Sin caravana disponible.</p>;

  const departs = new Date(caravan.departs_at);
  const now = new Date();
  const minsLeft = Math.max(0, Math.floor((departs - now) / 60000));

  return (
    <div>
      {/* Caravan header */}
      <div className="game-card mb-3 py-2 text-center">
        <p className="text-kingdom-gold text-xs font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
          🐪 {caravan.name}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {minsLeft > 0 ? `Se va en ${minsLeft} min` : '¡Partiendo pronto!'}
        </p>
      </div>

      {/* Buy offers */}
      <p className="text-xs text-gray-400 font-bold mb-1.5 uppercase tracking-wide">Comprar</p>
      <div className="space-y-1 mb-3">
        {(caravan.buy_offers || []).map((offer) => {
          const qty = buyQty[offer.resource_id] || 1;
          const total = offer.price * qty;
          const canAfford = playerGold >= total;
          const maxBuy = Math.min(offer.quantity, Math.floor(playerGold / offer.price) || 0);
          return (
            <div key={offer.resource_id}
              className="game-card flex items-center gap-2 py-1.5 px-2">
              <span className="text-base w-6 text-center">
                {RESOURCE_ICONS[offer.resource_id] || '📦'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {RESOURCE_NAMES[offer.resource_id] || offer.resource_id}
                </p>
                <p className="text-[10px] text-yellow-400">
                  🪙 {offer.price}/u · stock: {offer.quantity}
                </p>
              </div>
              <QuantitySelector
                value={qty}
                onChange={(v) => setBuyQty((p) => ({ ...p, [offer.resource_id]: v }))}
                max={Math.max(1, maxBuy)}
              />
              <button
                onClick={() => handleBuy(offer)}
                disabled={!canAfford || offer.quantity < qty}
                className={`text-xs px-2 py-1 rounded font-bold whitespace-nowrap transition-colors ${
                  canAfford && offer.quantity >= qty
                    ? 'bg-kingdom-accent text-white hover:bg-red-600'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                🪙{total}
              </button>
            </div>
          );
        })}
      </div>

      {/* Sell offers */}
      <p className="text-xs text-gray-400 font-bold mb-1.5 uppercase tracking-wide">Vender</p>
      <div className="space-y-1">
        {(caravan.sell_offers || []).map((offer) => {
          const qty = sellQty[offer.resource_id] || 1;
          const playerStock = resources?.[offer.resource_id]?.amount ?? 0;
          const canSell = playerStock >= qty;
          const totalGold = offer.price * qty;
          return (
            <div key={offer.resource_id}
              className="game-card flex items-center gap-2 py-1.5 px-2">
              <span className="text-base w-6 text-center">
                {RESOURCE_ICONS[offer.resource_id] || '📦'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {RESOURCE_NAMES[offer.resource_id] || offer.resource_id}
                </p>
                <p className="text-[10px] text-gray-400">
                  🪙 {offer.price}/u · tenés: {playerStock}
                </p>
              </div>
              <QuantitySelector
                value={qty}
                onChange={(v) => setSellQty((p) => ({ ...p, [offer.resource_id]: v }))}
                max={Math.max(1, playerStock)}
              />
              <div className="flex flex-col items-end gap-0.5">
                <button
                  onClick={() => handleSell(offer)}
                  disabled={!canSell}
                  className={`text-xs px-2 py-1 rounded font-bold whitespace-nowrap transition-colors ${
                    canSell
                      ? 'btn-gold text-xs'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  +🪙{totalGold}
                </button>
                <p className="text-[9px] text-purple-400">+{TOKENS_PER_SELL * qty} KH</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickSellSection({ resources }) {
  const addNotification = useGameStore((s) => s.addNotification);
  const refreshResources = useGameStore((s) => s.refreshResources);
  const [sellQty, setSellQty] = useState({});

  const sellable = Object.entries(resources || {})
    .filter(([id, r]) => r.amount > 0 && id !== 'gold')
    .sort((a, b) => b[1].amount - a[1].amount);

  const handleQuickSell = async (resourceId) => {
    const qty = sellQty[resourceId] || 1;
    try {
      const { data } = await api.post('/commerce/sell', { resourceId, quantity: qty });
      addNotification(data.message, 'success');
      refreshResources();
    } catch (e) {
      addNotification(e.response?.data?.error || 'Error al vender', 'error');
    }
  };

  if (sellable.length === 0) {
    return (
      <p className="text-gray-400 text-xs text-center py-4">
        No tenés recursos para vender.
      </p>
    );
  }

  return (
    <div>
      <div className="game-card mb-3 py-2 px-3">
        <p className="text-[10px] text-gray-400">
          Precio fijo al <span className="text-yellow-400 font-bold">70%</span> del valor de mercado.
          Siempre disponible, sin esperar caravana.
        </p>
      </div>
      <div className="space-y-1">
        {sellable.map(([id, res]) => {
          const qty = sellQty[id] || 1;
          return (
            <div key={id} className="game-card flex items-center gap-2 py-1.5 px-2">
              <span className="text-base w-6 text-center">{RESOURCE_ICONS[id] || '📦'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">
                  {RESOURCE_NAMES[id] || id}
                </p>
                <p className="text-[10px] text-gray-400">Tenés: {res.amount}</p>
              </div>
              <QuantitySelector
                value={qty}
                onChange={(v) => setSellQty((p) => ({ ...p, [id]: v }))}
                max={res.amount}
              />
              <button
                onClick={() => handleQuickSell(id)}
                className="btn-primary text-xs px-2 py-1"
              >
                Vender
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissionsSection() {
  const { missions, loadMissions, generateMissions, acceptMission, completeMission } =
    useGameStore();

  useEffect(() => { loadMissions(); }, []);

  const getNpcSprite = (icon) => {
    const map = {
      '👨‍🌾': 'farmer', '👩‍🍳': 'baker', '🧙': 'wizard', '👸': 'princess',
      '🤴': 'knight', '🧝': 'ranger', '👨‍🔬': 'mage', '🧙‍♂️': 'wizard',
    };
    return map[icon] || 'explorer';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] text-gray-400">Pedidos activos</p>
        <button onClick={generateMissions} className="btn-primary text-[10px] px-2 py-1">
          Actualizar
        </button>
      </div>

      {missions.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-400 text-xs">Sin misiones disponibles.</p>
          <p className="text-gray-500 text-[10px] mt-1">Construí una Taberna para recibir pedidos.</p>
        </div>
      )}

      <div className="space-y-2">
        {missions.map((mission) => {
          const reqs = typeof mission.requirements === 'string'
            ? JSON.parse(mission.requirements) : mission.requirements;
          const rewards = typeof mission.rewards === 'string'
            ? JSON.parse(mission.rewards) : mission.rewards;

          return (
            <div key={mission.id}
              className={`game-card ${mission.is_urgent ? 'border border-yellow-500/50' : ''}`}>
              <div className="flex items-start gap-2">
                <CharacterSprite name={getNpcSprite(mission.npc_icon)} height={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <p className="font-bold text-xs text-white">{mission.title}</p>
                    {mission.is_urgent && (
                      <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1 py-0.5 rounded">
                        URGENTE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mb-1">{mission.npc_name}</p>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {reqs.map((req, i) => (
                      <span key={i} className="text-[10px] bg-kingdom-blue/50 px-1.5 py-0.5 rounded">
                        {RESOURCE_ICONS[req.resource_id] || '📦'} {req.amount}×{RESOURCE_NAMES[req.resource_id] || req.resource_id}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 text-[10px]">
                    <span className="text-yellow-400">🪙 {rewards.gold}</span>
                    <span className="text-blue-300">⭐ {rewards.xp} XP</span>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                {mission.status === 'available' && (
                  <button
                    onClick={() => acceptMission(mission.id)}
                    className="w-full btn-primary text-xs py-1.5"
                  >
                    Aceptar misión
                  </button>
                )}
                {mission.status === 'accepted' && (
                  <button
                    onClick={() => completeMission(mission.id)}
                    className="w-full btn-gold text-xs py-1.5"
                  >
                    Entregar pedido
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Default active tab per building type
const DEFAULT_TAB = {
  market: 'caravan',
  tavern: 'missions',
  embassy: 'caravan',
};

const TABS = [
  { id: 'caravan',  label: 'Caravana',    icon: '🐪' },
  { id: 'sell',     label: 'Venta rápida', icon: '💰' },
  { id: 'missions', label: 'Misiones',     icon: '📜' },
];

export default function CommerceView({ buildingId = 'market' }) {
  const [tab, setTab] = useState(DEFAULT_TAB[buildingId] || 'caravan');
  const resources = useGameStore((s) => s.resources);
  const playerGold = resources?.gold?.amount ?? 0;

  return (
    <div>
      {/* Gold display */}
      <div className="flex items-center gap-1 mb-3">
        <span className="text-xs text-gray-400">Oro disponible:</span>
        <span className="text-yellow-400 text-xs font-bold">🪙 {playerGold.toLocaleString()}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              tab === t.id
                ? 'bg-kingdom-accent text-white'
                : 'bg-kingdom-blue/40 text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable area */}
      <div className="overflow-y-auto" style={{ maxHeight: '46vh' }}>
        {tab === 'caravan'  && <CaravanSection resources={resources} />}
        {tab === 'sell'     && <QuickSellSection resources={resources} />}
        {tab === 'missions' && <MissionsSection />}
      </div>
    </div>
  );
}
