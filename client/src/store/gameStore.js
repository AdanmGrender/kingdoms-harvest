import { create } from 'zustand';
import api from '../services/api';

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
      // Cargar parcelas
      get().loadPlots();
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

  attackPVE: async (army, territoryId) => {
    try {
      const { data } = await api.post('/combat/attack/pve', { army, territoryId });
      get().addNotification(data.message, data.winner === 'attacker' ? 'success' : 'error');
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
}));

export default useGameStore;
