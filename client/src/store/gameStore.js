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
  activeTab: 'farm', // farm, castle, combat, commerce, map

  // Token system
  tokenInfo: null,
  dailyTasks: [],
  socialTasks: [],
  streakInfo: null,
  referralStats: null,
  referralLink: null,
  withdrawalHistory: [],

  // Captcha challenge
  captchaChallenge: null,

  // Overlay state for RTS mode
  overlayState: null, // { type: string, data: object } or null
  selectedEntity: null, // currently selected entity info

  // Notificaciones del juego
  notifications: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  setOverlay: (type, data) => set({ overlayState: { type, data } }),
  clearOverlay: () => set({ overlayState: null }),
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),

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
      // Cargar parcelas y animales
      get().loadPlots();
      get().loadAnimals();

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

  // ---- Granja ----
  loadPlots: async () => {
    try {
      const { data } = await api.get('/farm/plots');
      set({ plots: data });
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
      get().refreshResources();
      return data;
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
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

  requestWithdrawal: async (amount) => {
    try {
      const { data } = await api.post('/tokens/withdraw', { amount });
      get().addNotification(data.message, 'success');
      get().loadTokenInfo();
      get().loadWithdrawalHistory();
    } catch (error) {
      get().addNotification(error.response?.data?.error || 'Error', 'error');
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

  // ---- PvP ----
  pvpPlayers: [],
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
      get().addNotification(error.response?.data?.error || 'Error en ataque PvP', 'error');
      return null;
    }
  },
}));

// Expose store globally for dev/Puppeteer screenshot tool
if (typeof window !== 'undefined') {
  window.__gameStore = useGameStore;
}

export default useGameStore;
