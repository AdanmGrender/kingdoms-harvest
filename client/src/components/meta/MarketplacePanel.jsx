import React, { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';

const RESOURCE_ICONS = {
  gold: '🪙', wood: '🪵', stone: '🪨', iron: '⛏️',
  wheat: '🌾', water: '💧', flour: '🌽', bread: '🍞',
  ingots: '🔩', planks: '🪵', crystal: '💎', relic: '🏺', blueprint: '📜',
};

const SELLABLE = ['wood', 'stone', 'iron', 'wheat', 'water', 'flour', 'bread', 'ingots', 'planks', 'crystal', 'relic', 'blueprint'];

/**
 * MarketplacePanel — two sub-tabs: Comprar (browse + buy) y Vender
 * (create listing + manage own active listings).
 */
export default function MarketplacePanel() {
  const {
    marketListings, myListings, resources, player,
    loadMarketListings, loadMyListings,
    createListing, buyFromListing, cancelListing,
  } = useGameStore();
  const [tab, setTab] = useState('buy');

  useEffect(() => {
    loadMarketListings();
    loadMyListings();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[
          { id: 'buy',  label: '🛒 Comprar' },
          { id: 'sell', label: '💰 Vender' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold transition-all ${
              tab === t.id ? 'bg-kingdom-accent text-white' : 'bg-kingdom-blue/50 text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'buy' && (
        <BuyTab
          listings={marketListings}
          myId={player?.telegram_id}
          onBuy={buyFromListing}
        />
      )}
      {tab === 'sell' && (
        <SellTab
          resources={resources}
          myListings={myListings}
          onCreate={createListing}
          onCancel={cancelListing}
        />
      )}
    </div>
  );
}

function BuyTab({ listings, myId, onBuy }) {
  const filtered = (listings || []).filter((l) => l.seller_id !== myId);
  if (filtered.length === 0) {
    return <p className="text-gray-500 text-xs text-center py-6">Sin listados activos por ahora.</p>;
  }
  return (
    <div className="space-y-2">
      {filtered.map((l) => (
        <ListingRow key={l.id} listing={l} onBuy={onBuy} />
      ))}
    </div>
  );
}

function ListingRow({ listing, onBuy }) {
  const [qty, setQty] = useState(1);
  const total = listing.price_per_unit * qty;
  return (
    <div className="game-card flex items-center gap-2 py-2">
      <span className="text-2xl shrink-0">{RESOURCE_ICONS[listing.resource_id] || '📦'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">
          {listing.quantity_remaining}× {listing.resource_id}
          <span className="text-yellow-400 ml-1">@ {listing.price_per_unit}🪙</span>
        </p>
        <p className="text-[10px] text-gray-400 truncate">de {listing.seller_name} (Lv {listing.seller_level})</p>
      </div>
      <input
        type="number"
        min="1"
        max={listing.quantity_remaining}
        value={qty}
        onChange={(e) => setQty(Math.min(parseInt(e.target.value) || 1, listing.quantity_remaining))}
        className="bg-kingdom-blue rounded px-2 py-1 text-xs w-14 text-white"
      />
      <button
        onClick={() => onBuy(listing.id, qty)}
        className="btn-primary text-[10px] px-2 py-1 shrink-0"
      >
        {total}🪙
      </button>
    </div>
  );
}

function SellTab({ resources, myListings, onCreate, onCancel }) {
  const [resourceId, setResourceId] = useState('wood');
  const [qty, setQty] = useState(10);
  const [price, setPrice] = useState(2);

  const resourceMap = {};
  (resources || []).forEach((r) => { resourceMap[r.resource_id] = r.amount; });

  const available = resourceMap[resourceId] || 0;

  const handleCreate = async () => {
    if (qty < 1 || price < 1) return;
    if (qty > available) return;
    await onCreate(resourceId, qty, price);
  };

  const activeListings = (myListings || []).filter((l) => l.status === 'active');

  return (
    <div className="space-y-3">
      {/* Create form */}
      <div className="game-card space-y-2">
        <p className="text-xs text-gray-400">Crear listado:</p>
        <div className="flex gap-2 flex-wrap">
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            className="bg-kingdom-blue rounded px-2 py-1 text-xs text-white flex-1 min-w-[80px]"
          >
            {SELLABLE.map((r) => (
              <option key={r} value={r}>
                {RESOURCE_ICONS[r]} {r} ({resourceMap[r] || 0})
              </option>
            ))}
          </select>
          <input
            type="number" min="1"
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || 1)}
            placeholder="Cant"
            className="bg-kingdom-blue rounded px-2 py-1 text-xs text-white w-16"
          />
          <input
            type="number" min="1"
            value={price}
            onChange={(e) => setPrice(parseInt(e.target.value) || 1)}
            placeholder="Precio"
            className="bg-kingdom-blue rounded px-2 py-1 text-xs text-white w-20"
          />
        </div>
        <p className="text-[10px] text-gray-500">
          Disponible: {available}. Total esperado: {(qty * price).toLocaleString()}🪙 (5% fee)
        </p>
        <button
          onClick={handleCreate}
          disabled={qty > available || qty < 1}
          className="btn-primary text-xs w-full disabled:opacity-40"
        >
          Listar {qty}× {resourceId} @ {price}🪙
        </button>
      </div>

      {/* My active listings */}
      {activeListings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Mis listados activos:</p>
          {activeListings.map((l) => (
            <div key={l.id} className="game-card flex items-center gap-2 py-2 text-xs">
              <span className="text-xl">{RESOURCE_ICONS[l.resource_id] || '📦'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold">
                  {l.quantity_remaining}/{l.quantity}× {l.resource_id} @ {l.price_per_unit}🪙
                </p>
                <p className="text-[10px] text-gray-500">
                  Expira: {new Date(l.expires_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => onCancel(l.id)}
                className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1"
              >
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
