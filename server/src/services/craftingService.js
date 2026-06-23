const { RESOURCES } = require('../../../shared/gameConfig');
const playerService = require('./playerService');

// All items that have a recipe field in RESOURCES config
function getCraftableItems() {
  return Object.values(RESOURCES)
    .filter((r) => r.recipe)
    .map((r) => ({ id: r.id, name: r.name, icon: r.icon, recipe: r.recipe }));
}

const craftingService = {
  getCraftableItems,

  async craft(playerId, itemId, quantity) {
    const resource = Object.values(RESOURCES).find((r) => r.id === itemId);
    if (!resource?.recipe) throw new Error('Ese objeto no se puede fabricar');

    // Deduct each ingredient atomically
    const deducted = [];
    try {
      for (const [ingredient, amount] of Object.entries(resource.recipe)) {
        await playerService.modifyResource(playerId, ingredient, -(amount * quantity));
        deducted.push({ ingredient, amount: amount * quantity });
      }
    } catch (err) {
      // Rollback already-deducted ingredients
      for (const { ingredient, amount } of deducted) {
        await playerService.modifyResource(playerId, ingredient, amount);
      }
      throw new Error(`No tenés suficientes ingredientes para fabricar ${resource.name}`);
    }

    await playerService.modifyResource(playerId, itemId, quantity);

    return {
      success: true,
      item: resource.name,
      icon: resource.icon,
      quantity,
      message: `Fabricaste ${quantity}x ${resource.icon} ${resource.name}!`,
    };
  },
};

module.exports = craftingService;
