import { io } from 'socket.io-client';
import EventBridge from '../game/EventBridge';

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
    // Refresh buildings so Phaser clears the construction scaffold
    EventBridge.emit('buildings:refresh');
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
    EventBridge.emit('resources:refresh');
  });

  socket.on('crop_ready', ({ count }) => {
    EventBridge.emit('game:notification', {
      text: `🌾 ${count} cultivo${count > 1 ? 's' : ''} listo${count > 1 ? 's' : ''} para cosechar`,
      type: 'success',
    });
  });

  socket.on('world_events_updated', () => {
    // Signal the app to reload world events from the API
    EventBridge.emit('world_events:refresh');
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
