import { useState, useEffect, useMemo } from 'react';
import useGameStore from '../../store/gameStore';

const RESOURCE_ICONS = {
  wheat: '🌾', wood: '🌲', stone: '⛰️', iron: '⚙️', bread: '🍞', gold: '💰',
};

const TRADEABLE = ['wheat', 'wood', 'stone', 'iron', 'bread'];

function ListingCard({ listing, myPlayerId, onBuy, onCancel, loading }) {
  const isMine = Number(listing.sellerId) === Number(myPlayerId);
  const [buyQty, setBuyQty] = useState(1);

  return (
    <div
      className="p-2.5 rounded-lg border text-[10px]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.12)' }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{RESOURCE_ICONS[listing.resourceId] || '📦'}</span>
          <div>
            <p className="text-white font-bold capitalize">{listing.resourceId}</p>
            <p className="text-gray-500">Vendedor {listing.sellerTag}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-yellow-300 font-bold">{listing.pricePerUnit} 💰/u</p>
          <p className="text-gray-400">{listing.quantityRemaining} disponibles</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-gray-500">⏱ {listing.hoursLeft}h</span>
        <span className="text-gray-600 mx-1">·</span>
        <span className="text-gray-500">Total: {listing.quantityRemaining * listing.pricePerUnit} 💰</span>
      </div>

      {!isMine ? (
        <div className="flex items-center gap-1 mt-2">
          <input
            type="number"
            min="1"
            max={listing.quantityRemaining}
            value={buyQty}
            onChange={(e) => setBuyQty(Math.min(Number(e.target.value), listing.quantityRemaining))}
            className="w-14 text-[10px] text-center rounded bg-gray-800 border border-gray-600 text-white py-1"
          />
          <span className="text-gray-400">= {buyQty * listing.pricePerUnit} 💰</span>
          <button
            onClick={() => onBuy(listing.id, buyQty)}
            disabled={loading}
            className="ml-auto text-[10px] px-3 py-1 rounded font-bold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)' }}
          >
            Comprar
          </button>
        </div>
      ) : (
        <button
          onClick={() => onCancel(listing.id)}
          disabled={loading}
          className="mt-2 w-full text-[10px] py-1 rounded border border-red-700/50 text-red-400 hover:bg-red-900/20 disabled:opacity-40"
        >
          Cancelar oferta
        </button>
      )}
    </div>
  );
}

function BrowseTab({ myPlayerId, onBuy, onCancel, loading }) {
  const marketListings  = useGameStore((s) => s.marketListings);
  const loadMarket      = useGameStore((s) => s.loadMarket);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadMarket(); }, []);

  const filtered = filter === 'all'
    ? marketListings
    : marketListings.filter((l) => l.resourceId === filter);

  return (
    <div>
      {/* Resource filter */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`shrink-0 text-[9px] px-2 py-1 rounded ${filter === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          Todos
        </button>
        {TRADEABLE.map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`shrink-0 text-[9px] px-2 py-1 rounded ${filter === r ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            {RESOURCE_ICONS[r]} {r}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-600 text-xs py-8">No hay ofertas activas</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              myPlayerId={myPlayerId}
              onBuy={onBuy}
              onCancel={onCancel}
              loading={loading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SellTab({ resources, onCreateListing, loading }) {
  const [resourceId, setResourceId]     = useState(TRADEABLE[0]);
  const [quantity, setQuantity]         = useState(10);
  const [pricePerUnit, setPricePerUnit] = useState(5);

  const available = useMemo(() => {
    if (!resources) return 0;
    const val = resources[resourceId];
    return typeof val === 'object' ? (val?.amount ?? 0) : (val ?? 0);
  }, [resources, resourceId]);

  const totalPotential = quantity * pricePerUnit;
  const fee = Math.floor(totalPotential * 0.05);
  const receive = totalPotential - fee;

  const handleSubmit = () => {
    if (quantity < 1 || quantity > available) return;
    if (pricePerUnit < 1) return;
    onCreateListing(resourceId, quantity, pricePerUnit);
  };

  return (
    <div className="space-y-3">
      <p className="text-gray-400 text-[10px]">Publica recursos para que otros jugadores los compren con oro.</p>

      {/* Resource selector */}
      <div>
        <label className="text-[10px] text-gray-400 block mb-1">Recurso</label>
        <div className="flex gap-1 flex-wrap">
          {TRADEABLE.map((r) => (
            <button
              key={r}
              onClick={() => setResourceId(r)}
              className={`text-[10px] px-2 py-1 rounded border ${resourceId === r ? 'border-yellow-500 text-yellow-300 bg-yellow-900/20' : 'border-gray-600 text-gray-400'}`}
            >
              {RESOURCE_ICONS[r]} {r}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-gray-600 mt-1">Disponible: {available}</p>
      </div>

      {/* Quantity */}
      <div>
        <label className="text-[10px] text-gray-400 block mb-1">Cantidad</label>
        <input
          type="number"
          min="1"
          max={Math.min(available, 1000)}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.min(Number(e.target.value), available, 1000)))}
          className="w-full text-xs rounded bg-gray-800 border border-gray-600 text-white px-2 py-1.5"
        />
      </div>

      {/* Price */}
      <div>
        <label className="text-[10px] text-gray-400 block mb-1">Precio por unidad (💰 oro)</label>
        <input
          type="number"
          min="1"
          max="10000"
          value={pricePerUnit}
          onChange={(e) => setPricePerUnit(Math.max(1, Math.min(Number(e.target.value), 10000)))}
          className="w-full text-xs rounded bg-gray-800 border border-gray-600 text-white px-2 py-1.5"
        />
      </div>

      {/* Preview */}
      <div className="p-2 rounded bg-black/20 border border-gray-700/40 text-[10px] space-y-0.5">
        <div className="flex justify-between"><span className="text-gray-400">Total bruto</span><span className="text-white">{totalPotential} 💰</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Comisión (5%)</span><span className="text-red-400">−{fee} 💰</span></div>
        <div className="flex justify-between font-bold"><span className="text-gray-300">Recibís</span><span className="text-green-400">{receive} 💰</span></div>
        <p className="text-gray-600 text-[9px] pt-1">Expira en 24 horas · máx 5 ventas activas</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || quantity < 1 || quantity > available || pricePerUnit < 1}
        className="w-full py-2 rounded text-xs font-bold text-white disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #166534, #22c55e)' }}
      >
        {loading ? 'Publicando...' : `Publicar ${quantity}x ${resourceId}`}
      </button>
    </div>
  );
}

function MyListingsTab({ myPlayerId, onCancel, loading }) {
  const myMarketListings   = useGameStore((s) => s.myMarketListings);
  const loadMyMarketListings = useGameStore((s) => s.loadMyMarketListings);

  useEffect(() => { loadMyMarketListings(); }, []);

  const STATUS_LABELS = { active: '🟢 Activa', sold: '✅ Vendida', cancelled: '❌ Cancelada', expired: '⏰ Expirada' };

  if (myMarketListings.length === 0) {
    return <p className="text-center text-gray-600 text-xs py-8">No tenés ventas recientes</p>;
  }

  return (
    <div className="space-y-2">
      {myMarketListings.map((l) => (
        <div
          key={l.id}
          className="p-2.5 rounded-lg text-[10px]"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white font-bold capitalize">
                {RESOURCE_ICONS[l.resourceId]} {l.resourceId}
              </p>
              <p className="text-gray-500">{l.quantityRemaining}/{l.quantity} restante · {l.pricePerUnit} 💰/u</p>
            </div>
            <span className="text-[9px]">{STATUS_LABELS[l.status] || l.status}</span>
          </div>
          {l.status === 'active' && (
            <button
              onClick={() => onCancel(l.id)}
              disabled={loading}
              className="mt-1.5 text-[9px] text-red-400 hover:text-red-300 disabled:opacity-40"
            >
              Cancelar y recuperar {l.quantityRemaining}x {l.resourceId}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function MarketplacePanel({ onClose }) {
  const player             = useGameStore((s) => s.player);
  const resources          = useGameStore((s) => s.resources);
  const loadMarket         = useGameStore((s) => s.loadMarket);
  const loadMyMarketListings = useGameStore((s) => s.loadMyMarketListings);
  const createMarketListing  = useGameStore((s) => s.createMarketListing);
  const buyMarketListing     = useGameStore((s) => s.buyMarketListing);
  const cancelMarketListing  = useGameStore((s) => s.cancelMarketListing);

  const [activeTab, setActiveTab] = useState('browse');
  const [loading, setLoading]     = useState(false);

  const goldAmount = useMemo(() => {
    const val = resources?.gold;
    return typeof val === 'object' ? (val?.amount ?? 0) : (val ?? 0);
  }, [resources?.gold]);

  const doCreate = async (resourceId, quantity, pricePerUnit) => {
    setLoading(true);
    const result = await createMarketListing(resourceId, quantity, pricePerUnit);
    if (result) { loadMarket(); loadMyMarketListings(); }
    setLoading(false);
  };

  const doBuy = async (listingId, quantity) => {
    setLoading(true);
    const result = await buyMarketListing(listingId, quantity);
    if (result) { loadMarket(); loadMyMarketListings(); }
    setLoading(false);
  };

  const doCancel = async (listingId) => {
    setLoading(true);
    await cancelMarketListing(listingId);
    loadMyMarketListings();
    setLoading(false);
  };

  return (
    <div
      className="mx-2 mb-2 p-4 pb-6 rounded-t-xl max-h-[75vh] overflow-y-auto"
      style={{ background: 'rgba(22, 33, 62, 0.97)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-yellow-400 text-sm font-bold" style={{ fontFamily: 'MedievalSharp, serif' }}>
            🏷️ Mercado P2P
          </h3>
          <p className="text-gray-400 text-[10px]">Oro disponible: {goldAmount} 💰</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-2">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {[['browse','🛒 Comprar'],['sell','➕ Vender'],['my','📋 Mis ventas']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-colors ${activeTab === tab ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && (
        <BrowseTab
          myPlayerId={player?.telegram_id || player?.id}
          onBuy={doBuy}
          onCancel={doCancel}
          loading={loading}
        />
      )}
      {activeTab === 'sell' && (
        <SellTab resources={resources} onCreateListing={doCreate} loading={loading} />
      )}
      {activeTab === 'my' && (
        <MyListingsTab
          myPlayerId={player?.telegram_id || player?.id}
          onCancel={doCancel}
          loading={loading}
        />
      )}
    </div>
  );
}
