/**
 * ShopPanel — tienda de Gemas (Telegram Stars).
 *
 * ⚠️ Las gemas son moneda premium de UN SOLO SENTIDO: se compran con dinero real
 *    y se gastan dentro del juego. NUNCA se convierten a KH ni a TON (eso haría
 *    del juego una casa de cambio). El panel lo dice explícitamente al jugador.
 *
 * El crédito de gemas NO ocurre acá: el cliente abre la factura de Telegram y el
 * bot acredita cuando Telegram confirma el pago (ver server/paymentService).
 */
import { useEffect, useState } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

const PACK_STYLE = {
  pouch: { grad: 'from-slate-700 to-slate-800', ring: 'rgba(148,163,184,0.4)', icon: '💎' },
  chest: { grad: 'from-indigo-800 to-indigo-950', ring: 'rgba(129,140,248,0.5)', icon: '💎' },
  vault: { grad: 'from-purple-800 to-purple-950', ring: 'rgba(192,132,252,0.6)', icon: '💎' },
  relic: { grad: 'from-amber-700 to-amber-950', ring: 'rgba(251,191,36,0.7)', icon: '💎' },
};

export default function ShopPanel({ onClose }) {
  const gems = useGameStore((s) => s.gems);
  const catalog = useGameStore((s) => s.shopCatalog);
  const loadGems = useGameStore((s) => s.loadGems);
  const loadShopCatalog = useGameStore((s) => s.loadShopCatalog);
  const buyGemPack = useGameStore((s) => s.buyGemPack);

  const [busy, setBusy] = useState(null);

  useEffect(() => {
    loadGems();
    loadShopCatalog();
  }, [loadGems, loadShopCatalog]);

  const handleBuy = async (productId) => {
    setBusy(productId);
    await buyGemPack(productId);
    setBusy(null);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #16213e 0%, #0d1226 100%)',
        border: '1px solid rgba(255,255,255,0.10)',
        maxHeight: '78vh',
      }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">💎</span>
          <h2 className="text-yellow-400 font-bold text-sm" style={{ fontFamily: 'MedievalSharp, serif' }}>
            Arsenal del Bastión
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md"
            style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(192,132,252,0.4)' }}>
            <span className="text-xs">💎</span>
            <span className="text-purple-200 text-xs font-bold tabular-nums">
              {gems?.balance ?? 0}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg px-1">✕</button>
        </div>
      </div>

      <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(78vh - 56px)' }}>
        {/* Packs */}
        <div className="flex flex-col gap-2">
          {catalog.map((pack) => {
            const st = PACK_STYLE[pack.id] || PACK_STYLE.pouch;
            const isBusy = busy === pack.id;
            return (
              <button
                key={pack.id}
                onClick={() => handleBuy(pack.id)}
                disabled={isBusy}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-3 bg-gradient-to-r ${st.grad} transition-transform active:scale-[0.98] disabled:opacity-60`}
                style={{ border: `1px solid ${st.ring}` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{st.icon}</span>
                  <div className="text-left">
                    <p className="text-white font-bold text-sm leading-tight">{pack.name}</p>
                    <p className="text-purple-200 text-xs font-semibold tabular-nums">
                      {pack.gems} Gemas
                      {pack.bonus > 0 && (
                        <span className="ml-1 text-green-400">+{Math.round(pack.bonus * 100)}%</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <span className="text-sm">⭐</span>
                  <span className="text-white text-xs font-bold tabular-nums">
                    {isBusy ? '…' : pack.stars}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Para qué sirven */}
        <div className="mt-4 rounded-xl px-3 py-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Solo se listan sumideros IMPLEMENTADOS: prometerle al que paga algo
              que no funciona es la peor forma de romper la confianza. */}
          <p className="text-gray-300 text-xs font-semibold mb-1.5">Las Gemas sirven para:</p>
          <ul className="text-gray-400 text-[11px] flex flex-col gap-1">
            <li>⚡ Acelerar construcciones al instante</li>
            <li>🦸 Invocar héroes (precio fijo, cualquier rareza)</li>
          </ul>
        </div>

        {/* Aviso honesto — invariante de diseño. pb generoso: la barra inferior
            del HUD lo tapaba y este texto NO puede quedar oculto. */}
        <p className="text-gray-500 text-[10px] mt-3 mb-2 leading-relaxed text-center pb-24">
          Las Gemas son moneda del juego: <b>no se convierten en KH ni en TON</b> y
          no son retirables. Los pagos los procesa Telegram con Stars ⭐.
        </p>
      </div>
    </div>
  );
}
