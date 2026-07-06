import { io } from 'socket.io-client';
import EventBridge from '../game/EventBridge';
import useGameStore from '../store/gameStore';

let socket = null;

export function connectSocket(initData) {
  if (socket?.connected) return socket;

  const url = import.meta.env.VITE_API_URL || window.location.origin;
  socket = io(url, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    socket.emit('join_game', { initData });
  });

  socket.on('building_complete', ({ buildingType }) => {
    EventBridge.emit('game:notification', {
      text: `🏗️ ¡Construcción lista! ${buildingType}`,
      type: 'success',
    });
  });

  socket.on('troops_trained', ({ troopId, quantity }) => {
    EventBridge.emit('game:notification', {
      text: `⚔️ ${quantity}x ${troopId} entrenados y listos`,
      type: 'success',
    });
  });

  socket.on('animal_ready', ({ animalType }) => {
    EventBridge.emit('game:notification', {
      text: `🐄 Tu ${animalType} tiene productos listos para recolectar`,
      type: 'info',
    });
  });

  socket.on('resources_updated', () => {
    // Debounced — store handles actual reload
    EventBridge.emit('resources:tick');
  });

  socket.on('crop_ready', ({ count }) => {
    EventBridge.emit('game:notification', {
      text: `🌾 ${count} cultivo${count > 1 ? 's' : ''} listo${count > 1 ? 's' : ''} para cosechar`,
      type: 'success',
    });
  });

  // Alliance chat — server fans out one event per member when someone posts.
  socket.on('alliance_message', (msg) => {
    useGameStore.getState().appendAllianceMessage(msg);
  });

  // Tormentas Disformes (F2 idle) — broadcast global del server
  socket.on('storm_started', (storm) => {
    useGameStore.getState().setActiveStorm(storm);
    EventBridge.emit('storm:started', storm);
    EventBridge.emit('game:notification', {
      text: `${storm.icon} ¡${storm.name}! ${storm.description}`,
      type: 'warning',
    });
  });
  socket.on('storm_ended', () => {
    useGameStore.getState().setActiveStorm(null);
    EventBridge.emit('storm:ended');
  });

  // Escala Sistema (G1 idle) — la Nave llegó a un planeta
  socket.on('ship_arrived', ({ planetId }) => {
    useGameStore.getState().loadSystem();
    EventBridge.emit('game:notification', {
      text: `🛰️ ¡La Nave llegó y reclamó un nuevo planeta! (${planetId})`,
      type: 'success',
    });
  });

  // Escala Galaxia (G2 idle) — el Crucero emergió de la Disformidad
  socket.on('warp_arrived', ({ systemId }) => {
    useGameStore.getState().loadGalaxy();
    EventBridge.emit('game:notification', {
      text: `🌌 ¡El Crucero emergió y reclamó un nuevo sistema! (${systemId})`,
      type: 'success',
    });
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
