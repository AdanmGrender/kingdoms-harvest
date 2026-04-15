import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar initData de Telegram
api.interceptors.request.use((config) => {
  if (window.Telegram?.WebApp?.initData) {
    config.headers['x-telegram-init-data'] = window.Telegram.WebApp.initData;
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
