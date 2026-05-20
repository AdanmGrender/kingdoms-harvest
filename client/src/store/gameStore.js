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
      get().addNotification(data.message || '¡Prestige realizado! El reino renace.', 'success');
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

  // ---- Leaderboard ----
  leaderboard: [],
  loadLeaderboard: async () => {
    try {
      const { data } = await api.get('/tokens/leaderboard');
      set({ leaderboard: data });
    } catch (error) {
      console.error('Error loading leaderboard:', error);
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
