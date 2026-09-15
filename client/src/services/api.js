import axios from 'axios';
import { getDeviceId, inTelegram } from './deviceId';

// APK/standalone: no hay proxy Vite → la base debe ser ABSOLUTA (VITE_API_URL,
// p.ej. http://10.0.2.2:3001 en el emulador). En web/dev queda relativa '/api'.
const BASE = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({
  baseURL: `${BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth: dentro de Telegram → HMAC (initData). Standalone (APK/web) → device-id.
api.interceptors.request.use((config) => {
  if (inTelegram()) {
    config.headers['x-telegram-init-data'] = window.Telegram.WebApp.initData;
  } else {
    config.headers['x-device-id'] = getDeviceId();
  }
  return config;
});

// Interceptor de respuesta para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
