import React, { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import api from '../../services/api';
import SpriteIcon, { CharacterSprite } from '../ui/SpriteIcon';

function CommerceView() {
  const { missions, loadMissions, generateMissions, acceptMission, completeMission, resources } = useGameStore();
  const [caravan, setCaravan] = useState(null);
  const [activeSection, setActiveSection] = useState('missions');

  useEffect(() => {
    loadMissions();
    loadCaravan();
  }, []);

  const loadCaravan = async () => {
    try {
      const { data } = await api.get('/commerce/caravan');
      setCaravan(data);
    } catch (e) {
      console.error('Error loading caravan:', e);
    }
  };

  const handleBuyFromCaravan = async (resourceId, quantity) => {
    try {
      const { data } = await api.post('/commerce/caravan/buy', { resourceId, quantity: 1 });
      useGameStore.getState().addNotification(data.message, 'success');
      useGameStore.getState().refreshResources();
      loadCaravan();
    } catch (e) {
      useGameStore.getState().addNotification(e.response?.data?.error || 'Error', 'error');
    }
  };

  const handleSellToCaravan = async (resourceId) => {
    try {
      const { data } = await api.post('/commerce/caravan/sell', { resourceId, quantity: 1 });
      useGameStore.getState().addNotification(data.message, 'success');
      useGameStore.getState().refreshResources();
      loadCaravan();
    } catch (e) {
      useGameStore.getState().addNotification(e.response?.data?.error || 'Error', 'error');
    }
  };

  const handleQuickSell = async (resourceId, quantity) => {
    try {
      const { data } = await api.post('/commerce/sell', { resourceId, quantity });
      useGameStore.getState().addNotification(data.message, 'success');
      useGameStore.getState().refreshResources();
    } catch (e) {
      useGameStore.getState().addNotification(e.response?.data?.error || 'Error', 'error');
    }
  };

  // Map NPC icons to character sprites
  const getNpcSprite = (npcIcon) => {
    const map = {
      '👨‍🌾': 'farmer', '👩‍🍳': 'baker', '🧙': 'wizard', '👸': 'princess',
      '🤴': 'knight', '🧝': 'ranger', '👨‍🔬': 'mage', '🧙‍♂️': 'wizard',
    };
    return map[npcIcon] || 'explorer';
  };

  return (
    <div className="animate-fade-in">
      <h2 className="font-medieval text-lg text-kingdom-gold mb-3 flex items-center gap-2">
        <SpriteIcon name="market_stall" size={24} /> Comercio
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'missions', label: 'Misiones', sprite: 'scroll' },
          { id: 'caravan', label: 'Caravana', sprite: 'backpack' },
          { id: 'sell', label: 'Vender', sprite: 'gold' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              activeSection === s.id
                ? 'bg-kingdom-accent text-white'
                : 'bg-kingdom-blue/50 text-gray-400'
            }`}
          >
            <SpriteIcon name={s.sprite} size={16} />
            {s.label}
          </button>
        ))}
      </div>

      {/* MISIONES */}
      {activeSection === 'missions' && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-300">Tablon de pedidos</p>
            <button onClick={generateMissions} className="btn-primary text-xs">
              Actualizar tablon
            </button>
          </div>

          {missions.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">
              No hay misiones. Construi una Taberna para recibir pedidos.
            </p>
          )}

          {missions.map((mission) => {
            const requirements = typeof mission.requirements === 'string'
              ? JSON.parse(mission.requirements)
              : mission.requirements;
            const rewards = typeof mission.rewards === 'string'
              ? JSON.parse(mission.rewards)
              : mission.rewards;

            return (
              <div key={mission.id} className={`game-card mb-2 ${mission.is_urgent ? 'border-yellow-500' : ''}`}>
                <div className="flex items-start gap-2">
                  <CharacterSprite name={getNpcSprite(mission.npc_icon)} height={40} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{mission.title}</p>
                      {mission.is_urgent && (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded">
                          URGENTE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{mission.npc_name}</p>

                    {/* Requisitos */}
                    <div className="mb-2">
                      <p className="text-[10px] text-gray-500 mb-1">Necesita:</p>
                      <div className="flex flex-wrap gap-1">
                        {requirements.map((req, i) => (
                          <span key={i} className="text-xs bg-kingdom-blue/50 px-2 py-0.5 rounded">
                            {req.amount}x {req.resource_id}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Recompensas */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-yellow-400 flex items-center gap-0.5">
                        <SpriteIcon name="gold" size={12} /> {rewards.gold}
                      </span>
                      <span className="text-blue-300 flex items-center gap-0.5">
                        <SpriteIcon name="medal" size={12} /> {rewards.xp} XP
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex gap-2">
                  {mission.status === 'available' && (
                    <button
                      onClick={() => acceptMission(mission.id)}
                      className="btn-primary text-xs flex-1"
                    >
                      Aceptar
                    </button>
                  )}
                  {mission.status === 'accepted' && (
                    <button
                      onClick={() => completeMission(mission.id)}
                      className="btn-gold text-xs flex-1"
                    >
                      Entregar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CARAVANA */}
      {activeSection === 'caravan' && (
        <div>
          {!caravan ? (
            <p className="text-gray-400 text-sm text-center py-4">Cargando caravana...</p>
          ) : (
            <>
              <div className="game-card mb-3 text-center">
                <SpriteIcon name="backpack" size={36} className="mx-auto" />
                <p className="font-bold text-sm">{caravan.name}</p>
                <p className="text-[10px] text-gray-400">
                  Se va a las {new Date(caravan.departs_at).toLocaleTimeString()}
                </p>
              </div>

              <p className="text-sm text-gray-300 mb-2">Comprar:</p>
              <div className="flex flex-col gap-1 mb-4">
                {caravan.buy_offers?.map((offer, i) => (
                  <div key={i} className="game-card flex items-center gap-2 py-2">
                    <span className="text-sm flex-1">{offer.resource_id}</span>
                    <span className="text-xs text-yellow-400 flex items-center gap-0.5">
                      <SpriteIcon name="gold" size={12} /> {offer.price}
                    </span>
                    <span className="text-xs text-gray-400">x{offer.quantity}</span>
                    <button
                      onClick={() => handleBuyFromCaravan(offer.resource_id)}
                      className="btn-primary text-xs"
                    >
                      Comprar
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-300 mb-2">Vender:</p>
              <div className="flex flex-col gap-1">
                {caravan.sell_offers?.map((offer, i) => (
                  <div key={i} className="game-card flex items-center gap-2 py-2">
                    <span className="text-sm flex-1">{offer.resource_id}</span>
                    <span className="text-xs text-yellow-400 flex items-center gap-0.5">
                      <SpriteIcon name="gold" size={12} /> {offer.price}
                    </span>
                    <button
                      onClick={() => handleSellToCaravan(offer.resource_id)}
                      className="btn-gold text-xs"
                    >
                      Vender
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* VENTA RAPIDA */}
      {activeSection === 'sell' && (
        <div>
          <p className="text-sm text-gray-300 mb-2">
            Venta rapida (70% del precio base):
          </p>
          <div className="flex flex-col gap-1">
            {Object.entries(resources)
              .filter(([_, r]) => r.amount > 0)
              .map(([id, res]) => (
                <div key={id} className="game-card flex items-center gap-2 py-2">
                  <span className="text-sm flex-1">{id}</span>
                  <span className="text-xs text-gray-400">{res.amount} disp.</span>
                  <button
                    onClick={() => handleQuickSell(id, 1)}
                    className="btn-primary text-xs"
                  >
                    Vender 1
                  </button>
                  {res.amount >= 10 && (
                    <button
                      onClick={() => handleQuickSell(id, 10)}
                      className="btn-gold text-xs"
                    >
                      x10
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CommerceView;
