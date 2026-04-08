import React, { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import useCountdown from '../../hooks/useCountdown';
import SpriteIcon from '../ui/SpriteIcon';

// Datos de cultivos (mirror del server)
const CROPS = {
  wheat: { id: 'wheat', name: 'Trigo', sprite: 'sunflower', growthTime: 30, seedCost: 5 },
  carrot: { id: 'carrot', name: 'Zanahoria', sprite: 'beet', growthTime: 20, seedCost: 8 },
  potato: { id: 'potato', name: 'Papa', sprite: 'cookie', growthTime: 45, seedCost: 10 },
  tomato: { id: 'tomato', name: 'Tomate', sprite: 'strawberry', growthTime: 60, seedCost: 15 },
  corn: { id: 'corn', name: 'Maiz', sprite: 'sunflower_alt', growthTime: 90, seedCost: 18 },
  pumpkin: { id: 'pumpkin', name: 'Calabaza', sprite: 'heart_gold', growthTime: 120, seedCost: 25 },
  grape: { id: 'grape', name: 'Uva', sprite: 'beet', growthTime: 180, seedCost: 30 },
};

function PlotCard({ plot }) {
  const { plantCrop, harvestCrop } = useGameStore();
  const [showCrops, setShowCrops] = useState(false);
  const countdown = useCountdown(plot.ready_at);

  const handlePlant = async (cropId) => {
    setShowCrops(false);
    await plantCrop(plot.id, cropId);
  };

  const handleHarvest = () => harvestCrop(plot.id);

  const crop = plot.crop_id ? CROPS[plot.crop_id] : null;

  return (
    <div className="game-card relative">
      {plot.state === 'empty' && (
        <div className="text-center">
          <SpriteIcon name="green_house" size={48} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs text-gray-400 mb-2">Parcela vacia</p>
          <button
            onClick={() => setShowCrops(!showCrops)}
            className="btn-primary text-xs w-full"
          >
            Plantar
          </button>

          {showCrops && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-kingdom-card border border-kingdom-blue rounded-lg p-2 z-10 shadow-xl">
              <div className="grid grid-cols-2 gap-1">
                {Object.values(CROPS).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handlePlant(c.id)}
                    className="flex items-center gap-1 p-2 rounded hover:bg-kingdom-blue/50 text-left"
                  >
                    <SpriteIcon name={c.sprite} size={24} />
                    <div>
                      <p className="text-xs font-bold">{c.name}</p>
                      <p className="text-[10px] text-yellow-400 flex items-center gap-0.5">
                        <SpriteIcon name="gold" size={10} /> {c.seedCost}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {plot.state === 'growing' && crop && (
        <div className="text-center">
          <SpriteIcon name={crop.sprite} size={48} className="mx-auto mb-1 opacity-50" />
          <p className="text-xs font-bold">{crop.name}</p>
          <div className="timer-badge mt-1">{countdown || 'Calculando...'}</div>
          <div className="progress-bar mt-2">
            <div
              className="progress-fill bg-green-500"
              style={{
                width: `${Math.max(0, 100 - (countdown ? 50 : 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {plot.state === 'ready' && crop && (
        <div className="text-center animate-pulse-gold rounded-lg">
          <SpriteIcon name={crop.sprite} size={48} className="mx-auto mb-1" />
          <p className="text-xs font-bold text-kingdom-gold">Listo!</p>
          <button onClick={handleHarvest} className="btn-gold text-xs w-full mt-2">
            Cosechar
          </button>
        </div>
      )}
    </div>
  );
}

function AnimalCard({ animal }) {
  const { feedAnimal, collectAnimalProduct } = useGameStore();

  const ANIMALS = {
    chicken: { sprite: 'farmer_girl', name: 'Gallina', productSprite: 'egg' },
    cow: { sprite: 'traveler', name: 'Vaca', productSprite: 'milk' },
    sheep: { sprite: 'ranger', name: 'Oveja', productSprite: 'cotton' },
  };

  const type = ANIMALS[animal.animal_id];
  const canCollect = animal.is_fed && animal.next_production_at &&
    new Date(animal.next_production_at) <= new Date();

  return (
    <div className="game-card text-center">
      <SpriteIcon name={type?.sprite} size={40} className="mx-auto mb-1" />
      <p className="text-xs font-bold">{animal.name || type?.name}</p>

      {!animal.is_fed && (
        <button
          onClick={() => feedAnimal(animal.id)}
          className="btn-primary text-xs w-full mt-2 flex items-center justify-center gap-1"
        >
          Alimentar <SpriteIcon name="wheat" size={14} />
        </button>
      )}

      {animal.is_fed && !canCollect && (
        <p className="text-xs text-yellow-300 mt-2">Produciendo...</p>
      )}

      {canCollect && (
        <button
          onClick={() => collectAnimalProduct(animal.id)}
          className="btn-gold text-xs w-full mt-2 flex items-center justify-center gap-1"
        >
          Recolectar <SpriteIcon name={type?.productSprite} size={14} />
        </button>
      )}
    </div>
  );
}

function FarmView() {
  const { plots, animals, loadPlots, loadAnimals } = useGameStore();

  useEffect(() => {
    loadPlots();
    loadAnimals();
    const interval = setInterval(() => {
      loadPlots();
      loadAnimals();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in">
      <h2 className="font-medieval text-lg text-kingdom-gold mb-3 flex items-center gap-2">
        <SpriteIcon name="nav_farm" size={24} /> Tu Granja
      </h2>

      {/* Parcelas */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {plots.map((plot) => (
          <PlotCard key={plot.id} plot={plot} />
        ))}
        {plots.length === 0 && (
          <p className="text-gray-400 text-sm col-span-2 text-center py-8">
            Construi parcelas en tu castillo para empezar a cultivar
          </p>
        )}
      </div>

      {/* Animales */}
      {animals.length > 0 && (
        <>
          <h3 className="font-medieval text-lg text-kingdom-gold mb-3 flex items-center gap-2">
            <SpriteIcon name="barn" size={24} /> Animales
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {animals.map((animal) => (
              <AnimalCard key={animal.id} animal={animal} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default FarmView;
