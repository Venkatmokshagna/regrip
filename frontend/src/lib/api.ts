import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://regrip-production.up.railway.app/api';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://regrip-production.up.railway.app';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
