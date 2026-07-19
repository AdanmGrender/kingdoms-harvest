import { create } from 'zustand';
import api from '../services/api';
import EventBridge from '../game/EventBridge';
import { connectSocket } from '../services/socketService';

const useGameStore = create((set, get) => ({
  // Estado del jugador
  player: null,
  resources: {},
  buildings: [],
  troops: [],
  sieges: [],
  animals: [],
  plots: [],
  missions: [],
  isLoading: true,
  error: null,

  // Crafting
  craftableItems: [],

  // Hero system
  heroes: [],
  heroItems: [],
  deployedHero: null,

  // Villagers
  villagers: [],

  // Territories
  territories: [],

  // Achievements
  achievements: [],

  // Marketplace
  marketListings: [],
  myMarketListings: [],

  // World events
  worldEvents: [],

  // Token system
  tokenInfo: null,
  gems: null,          // { balance, totalPurchased, totalSpent }
  shopCatalog: [],     // packs comprables con Telegram Stars
  dailyTasks: [],
  socialTasks: [],
  streakInfo: null,
  referralStats: null,
  referralLink: null,
  withdrawalHistory: [],
  withdrawalOTP: null, // { otpId, expiresAt, amount } — pending OTP

  // Captcha challenge
  captchaChallenge: null,

  // Preferencias de notificaciones push del bot
  notificationPrefs: null,

  // Overlay state for RTS mode
  overlayState: null, // { type: string, data: object } or null

  // Idle F1: menú de inicio + reporte offline "Mientras no estabas"
  menuDismissed: false,   // false → MainMenu visible; enterGame() lo despacha
  offlineReport: null,    // reporte del server en /player/init, null si no hay
  enterGame: () => set({ menuDismissed: true }),
  dismissOfflineReport: () => set({ offlineReport: null }),

  // Idle F2: Tormenta Disforme activa (socket push + poll de respaldo)
  activeStorm: null,
  setActiveStorm: (storm) => set({ activeStorm: storm }),
  loadActiveStorm: async () => {
    try {
      const { data } = await api.get('/storms/active');
      set({ activeStorm: data || null });
    } catch { /* silencioso — el banner simplemente no aparece */ }
  },

  // Idle F3: Marea Disforme (defensa por oleadas)
  waveStatus: null,
  loadWaveStatus: async () => {
    try {
      const { data } = await api.get('/waves/status');
      set({ waveStatus: data });
    } catch { /* panel muestra vacío */ }
  },
  startWaveRun: async () => {
    try {
      const { data } = await api.post('/waves/start');
      get().refreshResources();
      get().loadTokenInfo();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'La Marea no respondió', 'error');
      return null;
    }
  },

  // Idle G1: Escala Sistema (meta-mapa de planetas)
  systemMap: null,
  loadSystem: async () => {
    try {
      const { data } = await api.get('/system');
      set({ systemMap: data });
    } catch { /* panel muestra vacío */ }
  },
  launchShip: async (planetId) => {
    try {
      const { data } = await api.post('/system/launch', { planetId });
      get().addNotification(data.message, 'success');
      get().refreshResources();
      get().loadSystem();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'La Nave no pudo partir', 'error');
      return null;
    }
  },

  // Idle G2: Escala Galaxia (surcar la Disformidad)
  galaxyMap: null,
  loadGalaxy: async () => {
    try {
      const { data } = await api.get('/galaxy');
      set({ galaxyMap: data });
    } catch { /* panel muestra vacío */ }
  },
  launchWarp: async (systemId) => {
    try {
      const { data } = await api.post('/galaxy/warp', { systemId });
      get().addNotification(data.message, 'success');
      get().refreshResources();
      get().loadGalaxy();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'El Crucero no pudo zarpar', 'error');
      return null;
    }
  },

  // Idle F4: Escuadra de héroes
  squad: [],
  loadSquad: async () => {
    try {
      const { data } = await api.get('/heroes/squad');
      set({ squad: data || [] });
    } catch { /* panel muestra slots vacíos */ }
  },
  setSquadSlot: async (slot, heroDbId) => {
    try {
      const { data } = await api.post('/heroes/squad/set', { slot, heroDbId });
      get().addNotification(data.message, 'success');
      get().loadSquad();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'No se pudo asignar', 'error');
      return null;
    }
  },

  // ── Campaña (hub + instancias) ──────────────────────────────────────────
  campaignNodes: [],
  activeRun: null, // { runId, node, state } durante un combate

  loadCampaignMap: async () => {
    try {
      const { data } = await api.get('/campaign/map');
      set({ campaignNodes: data.nodes });
      return data.nodes;
    } catch (e) { console.error('loadCampaignMap', e); return []; }
  },

  enterNode: async (nodeId) => {
    const { data } = await api.post('/campaign/enter', { nodeId });
    if (data.kind === 'combat') {
      set({ activeRun: { runId: data.runId, node: data.node, state: data.state } });
    } else if (data.kind === 'cleared') {
      await get().loadCampaignMap();
    }
    return data; // el panel decide qué mostrar (combat / cleared / blocked)
  },

  stepInstance: async (action) => {
    const run = get().activeRun;
    if (!run) return null;
    const { data } = await api.post('/campaign/step', {
      runId: run.runId,
      actionType: action.type,
      slot: action.slot,
    });
    set({ activeRun: { ...run, state: data.state } });
    if (data.result) await get().loadCampaignMap(); // refrescar candados al terminar
    return data; // { state, roundLog, result, unlocked }
  },

  clearActiveRun: () => set({ activeRun: null }),

  // Notificaciones del juego
  notifications: [],

  setOverlay: (type, data) => set({ overlayState: { type, data } }),
  clearOverlay: () => set({ overlayState: null }),

  addNotification: (message, type = 'info') => {
    const id = Date.now();
    set((state) => ({
      notifications: [...state.notifications, { id, message, type }],
    }));
    // Auto-remove después de 3 segundos
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 3000);
  },

  // ---- Inicialización ----
  initGame: async (referralCode = null) => {
    try {
      set({ isLoading: true, error: null });
      const body = referralCode ? { referralCode } : {};
      const { data } = await api.post('/player/init', body);
      set({
        player: data,
        resources: data.resources || {},
        buildings: data.buildings || [],
        troops: data.troops || [],
        animals: data.animals || [],
        missions: data.activeMissions || [],
        offlineReport: data.offlineReport || null,
        isLoading: false,
      });
      // Cargar parcelas, animales, aldeanos y eventos del mundo
      get().loadPlots();
      get().loadAnimals();
      get().loadVillagers();
      get().loadWorldEvents();
      EventBridge.emit('game:missionsUpdated', data.activeMissions || []);

      // Conectar socket para notificaciones en tiempo real
      const initData = window.Telegram?.WebApp?.initData || '';
      connectSocket(initData);
    } catch (error) {
      console.error('Error init:', error);
      set({ error: 'Error al iniciar el juego', isLoading: false });
    }
  },

  refreshResources: async () => {
    try {
      const { data } = await api.get('/player/resources');
      set({ resources: data });
    } catch (error) {
      console.error('Error refreshing resources:', error);
    }
  },

  // ---- Eventos del mundo ----
  loadWorldEvents: async () => {
    try {
      const { data } = await api.get('/world-events');
      set({ worldEvents: data });
      EventBridge.emit('world_events:loaded', data);
    } catch (error) {
      console.error('Error loading world events:', error);
    }
  },

  claimWorldEvent: async (eventId) => {
    try {
      const { data } = await api.post(`/world-events/${eventId}/claim`);
      return data;
    } catch (error) {
      const msg = error.response?.data?.error || 'Error al reclamar el evento';
      get().addNotification(msg, 'error');
      return null;
    }
  },

  startCoopSession: async (eventId) => {
    try {
      const { data } = await api.post(`/world-events/${eventId}/start-coop`);
      return data;
    } catch (error) {
      const msg = error.response?.data?.error || 'Error al iniciar sesión cooperativa';
      get().addNotification(msg, 'error');
      return null;
    }
  },

  joinCoopSession: async (sessionId) => {
    try {
      const { data } = await api.post(`/world-events/session/${sessionId}/join`);
      return data;
    } catch (error) {
      const msg = error.response?.data?.error || 'Error al unirse a la sesión';
      get().addNotification(msg, 'error');
      return null;
    }
  },

  getCoopSession: async (sessionId) => {
    try {
      const { data } = await api.get(`/world-events/session/${sessionId}`);
      return data;
    } catch (error) {
      return null;
    }
  },

  // ---- Aldeanos ----
  loadVillagers: async () => {
    try {
      const { data } = await api.get('/villagers');
      set({ villagers: data });
      EventBridge.emit('game:villagersUpdated', data);
    } catch (error) {
      console.error('Error loading villagers:', error);
    }
  },

  // ---- Granja ----
  loadPlots: async () => {
    try {
      const { data } = await api.get('/farm/plots');
      set({ plots: data });
      EventBridge.emit('game:plotsUpdated', data);
    } catch (error) {
      console.error('Error loading plots:', error);
    }
  },

  plantCrop: async (plotId, cropId) => {
    try {
      const { data } = await api.post('/farm/plant', { plotId, cropId });
      get().addNotification(data.message, 'success');
      get().loadPlots();
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al plantar', 'error');
      throw error;
    }
  },

  harvestCrop: async (plotId) => {
    try {
      const { data } = await api.post('/farm/harvest', { plotId });
      get().addNotification(data.message, 'success');
      if (data.tokensAwarded > 0) {
        EventBridge.emit('token:earned', { amount: data.tokensAwarded });
      }
      get().loadPlots();
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al cosechar', 'error');
      throw error;
    }
  },

  // ---- Animales ----
  loadAnimals: async () => {
    try {
      const { data } = await api.get('/farm/animals');
      set({ animals: data });
      EventBridge.emit('game:animalsUpdated', data);
    } catch (error) {
      console.error('Error loading animals:', error);
    }
  },

  buyAnimal: async (animalId, name) => {
    try {
      const { data } = await api.post('/farm/animals/buy', { animalId, name });
      get().addNotification(data.message, 'success');
      get().loadAnimals();
      get().refreshResources();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  feedAnimal: async (animalId) => {
    try {
      const { data } = await api.post('/farm/animals/feed', { animalId });
      get().addNotification(data.message, 'success');
      get().loadAnimals();
      get().refreshResources();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  collectAnimalProduct: async (animalId) => {
    try {
      const { data } = await api.post('/farm/animals/collect', { animalId });
      get().addNotification(data.message, 'success');
      get().loadAnimals();
      get().refreshResources();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  // ---- Edificios ----
  loadBuildings: async () => {
    try {
      const { data } = await api.get('/buildings');
      // Detect buildings that just finished construction and notify Phaser
      const prev = get().buildings;
      for (const b of data) {
        if (!b.is_building) {
          const old = prev.find(p => p.id === b.id);
          if (old?.is_building) {
            EventBridge.emit('building:completed', {
              buildingId:  b.building_id,
              level:       b.level,
              is_building: false,
              posX:        b.position_x,
              posY:        b.position_y,
            });
          }
        }
      }
      set({ buildings: data });
    } catch (error) {
      console.error('Error loading buildings:', error);
    }
  },

  buildNew: async (buildingId, posX, posY) => {
    try {
      const { data } = await api.post('/buildings/build', { buildingId, posX, posY });
      get().addNotification(data.message, 'success');
      get().loadBuildings();
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
      return null;
    }
  },

  upgradeBuilding: async (buildingDbId) => {
    try {
      const { data } = await api.post('/buildings/upgrade', { buildingDbId });
      get().addNotification(data.message, 'success');
      get().loadBuildings();
      get().refreshResources();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  // ---- Misiones ----
  loadMissions: async () => {
    try {
      const { data } = await api.get('/missions');
      set({ missions: data });
      EventBridge.emit('game:missionsUpdated', data);
    } catch (error) {
      console.error('Error loading missions:', error);
    }
  },

  generateMissions: async () => {
    try {
      const { data } = await api.post('/missions/generate');
      set({ missions: data });
      get().addNotification('Nuevas misiones en el tablón!', 'info');
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  acceptMission: async (missionId) => {
    try {
      await api.post('/missions/accept', { missionId });
      get().addNotification('Misión aceptada!', 'success');
      get().loadMissions();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  completeMission: async (missionId) => {
    try {
      const { data } = await api.post('/missions/complete', { missionId });
      get().addNotification(data.message, 'success');
      if (data.tokensAwarded > 0) {
        EventBridge.emit('token:earned', { amount: data.tokensAwarded });
      }
      get().loadMissions();
      get().refreshResources();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  // ---- Combate ----
  trainTroops: async (troopId, quantity) => {
    try {
      const { data } = await api.post('/combat/train', { troopId, quantity });
      get().addNotification(data.message, 'success');
      get().loadTroops();
      get().refreshResources();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  attackPVE: async (army, territoryId, abilityId = null) => {
    try {
      const { data } = await api.post('/combat/attack/pve', { army, territoryId, abilityId });
      get().addNotification(data.message, data.winner === 'attacker' ? 'success' : 'error');
      if (data.winner === 'attacker' && data.tokensAwarded > 0) {
        EventBridge.emit('token:earned', { amount: data.tokensAwarded });
      }
      if (data.territoryClaimed) {
        get().loadTerritories();
        get().addNotification(`🏳️ ¡Tu facción conquistó ${data.territoryClaimed.territoryName}!`, 'success');
      }
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  loadTerritories: async () => {
    try {
      const { data } = await api.get('/territories');
      set({ territories: data });
    } catch (error) {
      console.error('Error loading territories:', error);
    }
  },

  joinFaction: async (factionId) => {
    try {
      await api.post('/player/faction/join', { factionId });
      set((state) => ({
        player: state.player ? { ...state.player, faction_id: factionId } : state.player,
      }));
      get().addNotification('¡Te uniste a la facción!', 'success');
      return true;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al unirse a la facción', 'error');
      return false;
    }
  },

  // ---- Achievement System ----
  loadAchievements: async () => {
    try {
      const { data } = await api.get('/achievements');
      set({ achievements: data });
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  },

  claimAchievement: async (achievementId) => {
    try {
      const { data } = await api.post(`/achievements/${achievementId}/claim`);
      get().loadAchievements();
      get().refreshResources();
      get().loadTokenInfo();
      get().addNotification(data.message, 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al reclamar logro', 'error');
      return null;
    }
  },

  // ---- Marketplace P2P ----
  loadMarket: async (resourceId = null) => {
    try {
      const url = resourceId ? `/market?resource=${resourceId}` : '/market';
      const { data } = await api.get(url);
      set({ marketListings: data });
    } catch (error) {
      console.error('Error loading market:', error);
    }
  },

  loadMyMarketListings: async () => {
    try {
      const { data } = await api.get('/market/my');
      set({ myMarketListings: data });
    } catch (error) {
      console.error('Error loading my listings:', error);
    }
  },

  createMarketListing: async (resourceId, quantity, pricePerUnit) => {
    try {
      const { data } = await api.post('/market/list', { resourceId, quantity, pricePerUnit });
      get().addNotification(data.message, 'success');
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al publicar', 'error');
      return null;
    }
  },

  buyMarketListing: async (listingId, quantity) => {
    try {
      const { data } = await api.post(`/market/${listingId}/buy`, { quantity });
      get().addNotification(data.message, 'success');
      get().refreshResources();
      get().loadAchievements();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al comprar', 'error');
      return null;
    }
  },

  cancelMarketListing: async (listingId) => {
    try {
      const { data } = await api.post(`/market/${listingId}/cancel`);
      get().addNotification(data.message, 'success');
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al cancelar', 'error');
      return null;
    }
  },

  loadTroops: async () => {
    try {
      const { data } = await api.get('/combat/troops');
      set({ troops: data });
    } catch (error) {
      console.error('Error loading troops:', error);
    }
  },

  battleHistory: [],
  loadBattleHistory: async () => {
    try {
      const { data } = await api.get('/combat/history');
      set({ battleHistory: data });
    } catch (error) {
      console.error('Error loading battle history:', error);
    }
  },

  // ---- Asedios ----
  loadSieges: async () => {
    try {
      const { data } = await api.get('/sieges');
      set({ sieges: data });
    } catch (error) {
      console.error('Error loading sieges:', error);
    }
  },

  declareWar: async (defenderId, army) => {
    try {
      const { data } = await api.post('/sieges/declare', { defenderId, army });
      get().addNotification(data.message, 'success');
      get().loadSieges();
      get().loadTroops();
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al declarar guerra', 'error');
      return null;
    }
  },

  useSiegeAbility: async (siegeId, abilityId) => {
    try {
      const { data } = await api.post('/sieges/ability', { siegeId, abilityId });
      get().addNotification(data.message, 'success');
      get().loadSieges();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al usar habilidad', 'error');
      return null;
    }
  },

  // ---- Crafting ----
  loadCraftableItems: async () => {
    try {
      const { data } = await api.get('/crafting');
      set({ craftableItems: data });
    } catch (error) {
      console.error('Error loading craftable items:', error);
    }
  },

  craftItem: async (itemId, quantity) => {
    try {
      const { data } = await api.post('/crafting/craft', { itemId, quantity });
      get().refreshResources();
      get().addNotification(data.message, 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al fabricar', 'error');
      return null;
    }
  },

  // ---- Hero System ----
  loadHeroes: async () => {
    try {
      const { data } = await api.get('/heroes');
      set({ heroes: data });
    } catch (error) {
      console.error('Error loading heroes:', error);
    }
  },

  loadHeroItems: async () => {
    try {
      const { data } = await api.get('/heroes/items');
      set({ heroItems: data });
    } catch (error) {
      console.error('Error loading hero items:', error);
    }
  },

  summonHero: async (payWithTokens = true) => {
    try {
      const { data } = await api.post('/heroes/summon', { payWithTokens });
      get().loadHeroes();
      get().loadHeroItems();
      if (!payWithTokens) get().refreshResources();
      else get().loadTokenInfo();
      get().addNotification(data.message, 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al invocar', 'error');
      return null;
    }
  },

  levelUpHero: async (heroDbId) => {
    try {
      const { data } = await api.post('/heroes/level-up', { heroDbId });
      get().loadHeroes();
      get().refreshResources();
      get().addNotification(data.message, 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al subir nivel', 'error');
      return null;
    }
  },

  equipHeroItem: async (heroDbId, itemId) => {
    try {
      const { data } = await api.post('/heroes/equip', { heroDbId, itemId });
      get().loadHeroes();
      get().loadHeroItems();
      get().addNotification(data.message, 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al equipar', 'error');
      return null;
    }
  },

  unequipHeroItem: async (heroDbId, slot) => {
    try {
      const { data } = await api.post('/heroes/unequip', { heroDbId, slot });
      get().loadHeroes();
      get().loadHeroItems();
      get().addNotification(data.message, 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al desequipar', 'error');
      return null;
    }
  },

  loadDeployedHero: async () => {
    try {
      const { data } = await api.get('/heroes/deployed');
      set({ deployedHero: data.hero });
    } catch (error) {
      console.error('Error loading deployed hero:', error);
    }
  },

  deployHero: async (heroDbId) => {
    try {
      const { data } = await api.post('/heroes/deploy', { heroDbId });
      get().loadHeroes();
      get().loadDeployedHero();
      get().addNotification(data.message, 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al desplegar', 'error');
      return null;
    }
  },

  recallHero: async () => {
    try {
      const { data } = await api.post('/heroes/recall');
      get().loadHeroes();
      set({ deployedHero: null });
      get().addNotification(data.message, 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al retirar', 'error');
      return null;
    }
  },

  // ---- KH Token System ----
  loadTokenInfo: async () => {
    try {
      const { data } = await api.get('/tokens/info');
      set({ tokenInfo: data });
    } catch (error) {
      console.error('Error loading token info:', error);
    }
  },

  // ─── Tienda (Gemas / Telegram Stars) ──────────────────────────────────────
  // Las gemas NUNCA se acreditan desde acá: el cliente solo abre la factura y
  // Telegram le avisa al bot, que es quien acredita (ver paymentService).
  loadGems: async () => {
    try {
      const { data } = await api.get('/shop/gems');
      set({ gems: data });
    } catch (error) {
      console.error('Error loading gems:', error);
    }
  },

  loadShopCatalog: async () => {
    try {
      const { data } = await api.get('/shop/catalog');
      set({ shopCatalog: data.packs || [] });
    } catch (error) {
      console.error('Error loading shop catalog:', error);
    }
  },

  /**
   * Pide el link de factura al server y lo abre con Telegram.
   * El crédito llega por el bot; acá solo refrescamos el saldo al volver.
   */
  buyGemPack: async (productId) => {
    try {
      const { data } = await api.post('/shop/invoice', { productId });
      const tg = window.Telegram?.WebApp;
      if (!tg?.openInvoice) {
        get().addNotification('Las compras solo funcionan dentro de Telegram', 'error');
        return { success: false };
      }
      return await new Promise((resolve) => {
        tg.openInvoice(data.link, async (status) => {
          if (status === 'paid') {
            // El bot ya acreditó (o está por hacerlo): refrescar saldo.
            setTimeout(() => get().loadGems(), 1200);
            get().addNotification(`¡Compra exitosa! +${data.gems} 💎`, 'success');
            resolve({ success: true });
          } else if (status === 'failed') {
            get().addNotification('El pago falló', 'error');
            resolve({ success: false });
          } else {
            resolve({ success: false, cancelled: true });
          }
        });
      });
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al crear la compra', 'error');
      return { success: false };
    }
  },

  speedupBuilding: async (buildingDbId) => {
    try {
      const { data } = await api.post('/shop/speedup/building', { buildingDbId });
      get().addNotification(data.message, 'success');
      await Promise.all([get().loadGems(), get().loadBuildings()]);
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'No se pudo acelerar', 'error');
      return null;
    }
  },

  loadDailyTasks: async () => {
    try {
      const { data } = await api.get('/tasks/daily');
      set({ dailyTasks: data });
    } catch (error) {
      console.error('Error loading daily tasks:', error);
    }
  },

  claimDailyTask: async (taskId) => {
    try {
      const { data } = await api.post('/tasks/daily/claim', { taskId });
      get().addNotification(data.message, 'success');
      if (data.tokensAwarded > 0) {
        EventBridge.emit('token:earned', { amount: data.tokensAwarded });
      }
      get().loadDailyTasks();
      get().loadTokenInfo();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  loadSocialTasks: async () => {
    try {
      const { data } = await api.get('/tasks/social');
      set({ socialTasks: data });
    } catch (error) {
      console.error('Error loading social tasks:', error);
    }
  },

  verifySocialTask: async (taskId) => {
    try {
      const { data } = await api.post('/tasks/social/verify', { taskId });
      get().addNotification(data.message, 'success');
      get().loadSocialTasks();
      get().loadTokenInfo();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  loadStreakInfo: async () => {
    try {
      const { data } = await api.get('/tasks/streak');
      set({ streakInfo: data });
    } catch (error) {
      console.error('Error loading streak:', error);
    }
  },

  burnResources: async (resourceId, quantity) => {
    try {
      const { data } = await api.post('/tokens/burn', { resourceId, quantity });
      get().addNotification(data.message, 'success');
      get().loadTokenInfo();
      get().refreshResources();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  linkWallet: async (walletAddress) => {
    try {
      const { data } = await api.post('/tokens/link-wallet', { walletAddress });
      get().addNotification(data.message, 'success');
      get().loadTokenInfo();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
    }
  },

  requestWithdrawalOTP: async (amount) => {
    try {
      const { data } = await api.post('/tokens/withdraw/request-otp', { amount });
      set({ withdrawalOTP: { otpId: data.otpId, expiresAt: data.expiresAt, amount } });
      get().addNotification(data.message || 'Código enviado por Telegram', 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al enviar código', 'error');
      return null;
    }
  },

  requestWithdrawal: async (amount, otpId, otp) => {
    try {
      const { data } = await api.post('/tokens/withdraw', { amount, otpId, otp });
      get().addNotification(data.message || '¡Retiro solicitado!', 'success');
      set({ withdrawalOTP: null });
      get().loadTokenInfo();
      get().loadWithdrawalHistory();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al retirar', 'error');
      return null;
    }
  },

  loadWithdrawalHistory: async () => {
    try {
      const { data } = await api.get('/tokens/withdrawals');
      set({ withdrawalHistory: data });
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    }
  },

  // ---- Captcha ----
  loadCaptchaChallenge: async () => {
    try {
      const { data } = await api.get('/tasks/captcha/challenge');
      set({ captchaChallenge: data });
    } catch (error) {
      console.error('Error loading captcha:', error);
    }
  },

  solveCaptcha: async (answer) => {
    try {
      const { data } = await api.post('/tasks/captcha/solve', { answer });
      if (data.correct) {
        get().addNotification('¡Correcto! +5 KH Tokens', 'success');
        EventBridge.emit('token:earned', { amount: 5 });
        get().loadDailyTasks();
        get().loadTokenInfo();
        set({ captchaChallenge: null });
      } else {
        get().addNotification(data.message, 'error');
      }
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al resolver', 'error');
      return null;
    }
  },

  loadReferralStats: async () => {
    try {
      const { data } = await api.get('/referral/stats');
      set({ referralStats: data });
    } catch (error) {
      console.error('Error loading referral stats:', error);
    }
  },

  loadReferralLink: async () => {
    try {
      const { data } = await api.get('/referral/link');
      set({ referralLink: data.link });
    } catch (error) {
      console.error('Error loading referral link:', error);
    }
  },

  // ---- Guild system ----
  guild: null,
  guildList: [],
  guildInvites: [],

  loadGuild: async () => {
    try {
      const { data } = await api.get('/guilds/me');
      set({ guild: data.guild || null });
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error loading guild:', error);
      }
      set({ guild: null });
    }
  },

  loadGuildInvites: async () => {
    try {
      const { data } = await api.get('/guilds/invites');
      set({ guildInvites: data.invites || [] });
    } catch (error) {
      console.error('Error loading guild invites:', error);
    }
  },

  listGuilds: async () => {
    try {
      const { data } = await api.get('/guilds');
      set({ guildList: data || [] });
    } catch (error) {
      console.error('Error listing guilds:', error);
    }
  },

  createGuild: async (payload) => {
    try {
      const { data } = await api.post('/guilds/create', payload);
      get().addNotification(data.message || '¡Gremio fundado!', 'success');
      get().loadGuild();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al crear gremio', 'error');
      return null;
    }
  },

  joinGuild: async (guildId) => {
    try {
      const { data } = await api.post(`/guilds/${guildId}/join`);
      get().addNotification(data.message || '¡Te uniste al gremio!', 'success');
      get().loadGuild();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al unirse', 'error');
      return null;
    }
  },

  respondGuildInvite: async (guildId, accept) => {
    try {
      const { data } = await api.post(`/guilds/${guildId}/respond-invite`, { accept });
      get().addNotification(
        data.message || (accept ? '¡Invitación aceptada!' : 'Invitación rechazada'),
        accept ? 'success' : 'info'
      );
      get().loadGuild();
      get().loadGuildInvites();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al responder', 'error');
      return null;
    }
  },

  leaveGuild: async () => {
    try {
      const { data } = await api.post('/guilds/leave');
      get().addNotification(data.message || 'Has abandonado el gremio', 'info');
      set({ guild: null });
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al abandonar gremio', 'error');
      return null;
    }
  },

  contributeToGuildTreasury: async (amount) => {
    try {
      const { data } = await api.post('/guilds/contribute', { amount });
      get().addNotification(data.message || `Donaste ${amount} al tesoro`, 'success');
      get().loadGuild();
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al donar', 'error');
      return null;
    }
  },

  // ---- Seasonal system ----
  seasonalData: null,

  loadSeasonalData: async () => {
    try {
      const { data } = await api.get('/seasonal');
      set({ seasonalData: data });
    } catch (error) {
      console.error('Error loading seasonal data:', error);
    }
  },

  claimSeasonalReward: async (challengeId) => {
    try {
      const { data } = await api.post(`/seasonal/claim/${challengeId}`);
      get().addNotification(data.message || '¡Recompensa reclamada!', 'success');
      get().loadSeasonalData();
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al reclamar', 'error');
      return null;
    }
  },

  // ---- Prestige system ----
  prestigeInfo: null,

  loadPrestige: async () => {
    try {
      const { data } = await api.get('/prestige');
      set({ prestigeInfo: data });
    } catch (error) {
      console.error('Error loading prestige:', error);
    }
  },

  executePrestige: async () => {
    try {
      const { data } = await api.post('/prestige/execute');
      get().addNotification(data.message || '¡Prestige realizado! El bastión renace.', 'success');
      set({ prestigeInfo: null });
      get().loadPrestige();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al hacer prestige', 'error');
      return null;
    }
  },

  purchasePrestigeUpgrade: async (upgradeId) => {
    try {
      const { data } = await api.post('/prestige/upgrade', { upgradeId });
      get().addNotification(data.message || '¡Mejora permanente adquirida!', 'success');
      get().loadPrestige();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al comprar mejora', 'error');
      return null;
    }
  },

  // ---- Tech Tree ----
  techResearch: null,
  loadTechResearch: async () => {
    try {
      const { data } = await api.get('/tech');
      set({ techResearch: data });
    } catch (error) {
      console.error('Error loading tech research:', error);
    }
  },
  startResearch: async (branchId, techId) => {
    try {
      const { data } = await api.post('/tech/research', { branchId, techId });
      get().addNotification(data.message, 'success');
      get().loadTechResearch();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al investigar', 'error');
      return null;
    }
  },

  // ---- Factions + Territories (world map) ----
  factionsList: [],
  factionMembers: {},  // factionId → array of members
  territories: [],

  loadFactions: async () => {
    try {
      const { data } = await api.get('/factions');
      set({ factionsList: data });
    } catch (error) {
      console.error('Error loading factions:', error);
    }
  },

  loadFactionMembers: async (factionId) => {
    try {
      const { data } = await api.get(`/factions/${factionId}/members`);
      set((state) => ({
        factionMembers: { ...state.factionMembers, [factionId]: data },
      }));
      return data;
    } catch (error) {
      console.error('Error loading faction members:', error);
      return [];
    }
  },

  joinFaction: async (factionId) => {
    try {
      const { data } = await api.post('/player/faction/join', { factionId });
      get().addNotification(`¡Te uniste a ${data.faction?.name || 'la facción'}!`, 'success');
      // Refresh player + factions list to reflect new membership
      const { data: profile } = await api.get('/player/profile');
      set({ player: profile });
      get().loadFactions();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al unirse', 'error');
      return null;
    }
  },

  loadTerritories: async () => {
    try {
      const { data } = await api.get('/territories');
      set({ territories: data });
    } catch (error) {
      console.error('Error loading territories:', error);
    }
  },

  attackTerritory: async (territoryId, army, abilityId = null) => {
    try {
      const { data } = await api.post(`/territories/${territoryId}/attack`, { army, abilityId });
      const won = data?.winner === 'attacker';
      const flipped = !!data?.territoryFlipped;
      const msg = flipped
        ? `🏴 ¡Conquistaste el territorio! +${data.pointsAwarded || 0} puntos de facción`
        : won
          ? `🏆 Victoria, pero el territorio no cambió de dueño (¿sin facción?).`
          : '💀 Derrota — el territorio resiste.';
      get().addNotification(msg, won ? 'success' : 'error');
      if (won && data.tokensAwarded > 0) {
        EventBridge.emit('token:earned', { amount: data.tokensAwarded });
      }
      get().refreshResources();
      get().loadTerritories();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al atacar', 'error');
      return null;
    }
  },

  // ---- Leaderboard (3 categorías para Rankings panel) ----
  leaderboard: [],
  leaderboardLevel: [],
  loadLeaderboard: async () => {
    try {
      const { data } = await api.get('/tokens/leaderboard');
      set({ leaderboard: data });
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  },
  loadLeaderboardLevel: async () => {
    try {
      const { data } = await api.get('/player/leaderboard');
      set({ leaderboardLevel: data });
    } catch (error) {
      console.error('Error loading level leaderboard:', error);
    }
  },

  // ---- Achievements ----
  achievements: [],
  loadAchievements: async () => {
    try {
      const { data } = await api.get('/achievements');
      set({ achievements: data });
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  },
  claimAchievement: async (achievementId) => {
    try {
      const { data } = await api.post(`/achievements/${achievementId}/claim`);
      get().addNotification(data.message, 'success');
      EventBridge.emit('token:earned', { amount: data.awarded || 0 });
      get().loadAchievements();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al reclamar', 'error');
      return null;
    }
  },

  // ---- Seasonal Events ----
  activeEvent: null,
  loadActiveEvent: async () => {
    try {
      const { data } = await api.get('/events/active');
      set({ activeEvent: data });
    } catch (error) {
      console.error('Error loading event:', error);
    }
  },

  // ---- Marketplace ----
  marketListings: [],
  myListings: [],
  loadMarketListings: async () => {
    try {
      const { data } = await api.get('/market');
      set({ marketListings: data });
    } catch (error) { console.error('Error loading market:', error); }
  },
  loadMyListings: async () => {
    try {
      const { data } = await api.get('/market/mine');
      set({ myListings: data });
    } catch (error) { console.error('Error loading my listings:', error); }
  },
  createListing: async (resourceId, quantity, pricePerUnit) => {
    try {
      const { data } = await api.post('/market', { resourceId, quantity, pricePerUnit });
      get().addNotification(data.message, 'success');
      get().refreshResources();
      get().loadMyListings();
      get().loadMarketListings();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al listar', 'error');
      return null;
    }
  },
  buyFromListing: async (listingId, quantity) => {
    try {
      const { data } = await api.post(`/market/${listingId}/buy`, { quantity });
      get().addNotification(data.message, 'success');
      get().refreshResources();
      get().loadMarketListings();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al comprar', 'error');
      return null;
    }
  },
  cancelListing: async (listingId) => {
    try {
      const { data } = await api.delete(`/market/${listingId}`);
      get().addNotification(data.message, 'success');
      get().refreshResources();
      get().loadMyListings();
      get().loadMarketListings();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al cancelar', 'error');
      return null;
    }
  },

  // ---- Alliances ----
  alliancesList: [],
  myAlliance: null,
  allianceMembers: {},  // allianceId → array of members
  loadAlliances: async () => {
    try {
      const { data } = await api.get('/alliances');
      set({ alliancesList: data });
    } catch (error) { console.error('Error loading alliances:', error); }
  },
  loadMyAlliance: async () => {
    try {
      const { data } = await api.get('/alliances/mine');
      set({ myAlliance: data });
    } catch (error) { console.error('Error loading my alliance:', error); }
  },
  loadAllianceMembers: async (allianceId) => {
    try {
      const { data } = await api.get(`/alliances/${allianceId}/members`);
      set((state) => ({ allianceMembers: { ...state.allianceMembers, [allianceId]: data } }));
      return data;
    } catch (error) { console.error('Error loading alliance members:', error); return []; }
  },
  createAlliance: async (name, motto) => {
    try {
      const { data } = await api.post('/alliances', { name, motto });
      get().addNotification(data.message, 'success');
      get().loadAlliances();
      get().loadMyAlliance();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al crear', 'error');
      return null;
    }
  },
  joinAlliance: async (allianceId) => {
    try {
      const { data } = await api.post(`/alliances/${allianceId}/join`);
      get().addNotification(data.message, 'success');
      get().loadAlliances();
      get().loadMyAlliance();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al unirse', 'error');
      return null;
    }
  },
  leaveAlliance: async () => {
    try {
      const { data } = await api.post('/alliances/leave');
      get().addNotification(data.message, 'success');
      get().loadAlliances();
      get().loadMyAlliance();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al salir', 'error');
      return null;
    }
  },
  disbandAlliance: async (allianceId) => {
    try {
      const { data } = await api.delete(`/alliances/${allianceId}`);
      get().addNotification(data.message, 'success');
      get().loadAlliances();
      get().loadMyAlliance();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al disolver', 'error');
      return null;
    }
  },

  // Alliance chat: messages + send action. Socket pushes to allianceMessages.
  allianceMessagesList: [],
  loadAllianceMessages: async () => {
    try {
      const { data } = await api.get('/alliances/messages/list');
      set({ allianceMessagesList: data });
    } catch (error) {
      console.error('Error loading alliance messages:', error);
    }
  },
  sendAllianceMessage: async (content) => {
    try {
      await api.post('/alliances/messages', { content });
      // Socket emit will refresh the list, but reload as a safety net so the
      // sender sees their own message even if their socket is disconnected.
      get().loadAllianceMessages();
      return true;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al enviar', 'error');
      return false;
    }
  },
  // Called by EventBridge when a socket alliance_message arrives
  appendAllianceMessage: (msg) => {
    set((state) => {
      // Skip if already in list (e.g. own message just reloaded)
      if (state.allianceMessagesList.some((m) => m.id === msg.id)) return state;
      const next = [...state.allianceMessagesList, msg];
      // Cap at 100 in memory to avoid unbounded growth on long sessions
      return { allianceMessagesList: next.slice(-100) };
    });
  },

  // Alliance: invitations inbox + leader/officer member management
  pendingInvitations: [],
  loadPendingInvitations: async () => {
    try {
      const { data } = await api.get('/alliances/invitations/mine');
      set({ pendingInvitations: data });
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  },
  respondInvitation: async (invitationId, accept) => {
    try {
      const { data } = await api.post(`/alliances/invitations/${invitationId}/respond`, { accept });
      get().addNotification(data.message, accept ? 'success' : 'info');
      get().loadPendingInvitations();
      get().loadMyAlliance();
      get().loadAlliances();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
      return null;
    }
  },
  invitePlayer: async (allianceId, targetPlayerId) => {
    try {
      const { data } = await api.post(`/alliances/${allianceId}/invite`, { playerId: targetPlayerId });
      get().addNotification(data.message, 'success');
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al invitar', 'error');
      return null;
    }
  },
  setMemberRole: async (allianceId, targetPlayerId, role) => {
    try {
      const { data } = await api.post(`/alliances/${allianceId}/members/${targetPlayerId}/role`, { role });
      get().addNotification(data.message, 'success');
      get().loadAllianceMembers(allianceId);
      get().loadMyAlliance();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al cambiar rol', 'error');
      return null;
    }
  },
  kickMember: async (allianceId, targetPlayerId) => {
    try {
      const { data } = await api.delete(`/alliances/${allianceId}/members/${targetPlayerId}`);
      get().addNotification(data.message, 'success');
      get().loadAllianceMembers(allianceId);
      get().loadMyAlliance();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al expulsar', 'error');
      return null;
    }
  },

  // Player search (alliance invite autocomplete)
  searchPlayers: async (query) => {
    try {
      if (!query || query.length < 2) return [];
      const { data } = await api.get('/player/search', { params: { q: query } });
      return data || [];
    } catch (error) {
      console.error('Error searching players:', error);
      return [];
    }
  },

  // Wars (faction-wide + alliance vs alliance)
  factionWar: { active: null, standings: [] },
  loadFactionWar: async () => {
    try {
      const { data } = await api.get('/wars/faction/active');
      set({ factionWar: data });
    } catch (error) {
      console.error('Error loading faction war:', error);
    }
  },
  myAllianceWar: null,
  loadMyAllianceWar: async () => {
    try {
      const { data } = await api.get('/wars/alliance/active');
      set({ myAllianceWar: data });
    } catch (error) {
      console.error('Error loading alliance war:', error);
    }
  },
  declareAllianceWar: async (targetAllianceId) => {
    try {
      const { data } = await api.post('/wars/alliance/declare', { targetAllianceId });
      get().addNotification(data.message, 'success');
      get().loadMyAllianceWar();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error al declarar guerra', 'error');
      return null;
    }
  },

  // Tournaments — active list + per-tournament leaderboards (lazy)
  tournaments: [],
  tournamentLeaderboards: {},
  loadTournaments: async () => {
    try {
      const { data } = await api.get('/tournaments/active');
      set({ tournaments: data });
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  },
  loadTournamentLeaderboard: async (tournamentId) => {
    try {
      const { data } = await api.get(`/tournaments/${tournamentId}/leaderboard`);
      set((state) => ({
        tournamentLeaderboards: { ...state.tournamentLeaderboards, [tournamentId]: data },
      }));
      return data;
    } catch (error) {
      console.error('Error loading tournament leaderboard:', error);
      return [];
    }
  },

  // Marketplace price history (per resource)
  marketHistory: {},
  loadMarketHistory: async (resource, limit = 30) => {
    try {
      const { data } = await api.get('/market/history', { params: { resource, limit } });
      set((state) => ({ marketHistory: { ...state.marketHistory, [resource]: data } }));
      return data;
    } catch (error) {
      console.error('Error loading market history:', error);
      return [];
    }
  },

  // ---- PvP ----
  pvpPlayers: [],
  pvpCooldowns: {}, // { [defenderId]: expiresAtMs }
  loadPvpPlayers: async () => {
    try {
      const { data } = await api.get('/combat/players');
      set({ pvpPlayers: data });
    } catch (error) {
      console.error('Error loading PvP players:', error);
    }
  },
  attackPVP: async (army, defenderId, abilityId = null) => {
    try {
      const { data } = await api.post('/combat/attack/pvp', { army, defenderId, abilityId });
      if (data.winner === 'attacker') {
        get().addNotification(`¡Victoria PvP! +${data.tokensAwarded || 0} KH`, 'success');
        EventBridge.emit('token:earned', { amount: data.tokensAwarded || 0 });
      } else {
        get().addNotification('Derrota en PvP...', 'error');
      }
      get().refreshResources();
      return data;
    } catch (error) {
      const msg = error.response?.data?.error || 'Error en ataque PvP';
      // Parse cooldown remaining minutes from error message and store per-defender expiry
      const cooldownMatch = msg.match(/(\d+) minutos/);
      if (cooldownMatch) {
        const mins = parseInt(cooldownMatch[1], 10);
        set((state) => ({
          pvpCooldowns: { ...state.pvpCooldowns, [defenderId]: Date.now() + mins * 60 * 1000 },
        }));
      }
      get().addNotification(msg, 'error');
      return null;
    }
  },

  // ---- Notification preferences ----
  loadNotificationPrefs: async () => {
    try {
      const { data } = await api.get('/notifications/prefs');
      set({ notificationPrefs: data });
    } catch (error) {
      console.error('Error loading notification prefs:', error);
    }
  },

  toggleNotificationPref: async (type) => {
    try {
      const { data } = await api.post('/notifications/toggle', { type });
      set((state) => ({
        notificationPrefs: state.notificationPrefs
          ? { ...state.notificationPrefs, [type]: data.enabled }
          : null,
      }));
      return data.enabled;
    } catch (error) {
      get().addNotification('Error actualizando preferencia', 'error');
      return null;
    }
  },
}));

// Expose store globally for dev/Puppeteer screenshot tool (stripped from prod builds by Vite)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__gameStore = useGameStore;
}

export default useGameStore;
