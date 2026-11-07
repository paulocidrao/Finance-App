import axios from "axios";
import { getOfflineCacheSessionHeader } from "./offline-cache";
import { markCachedResponse, useNetworkStatus } from './network-status';
import { endSession } from './session';
import { resolveApiBaseUrl } from './api-base-url';

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL, window.location.origin);

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const cacheablePaths = new Set([
  "/summary",
  "/summary/by-category",
  "/transactions",
  "/categories",
  "/users/me",
]);

api.interceptors.request.use((config) => {
  if (config.method?.toLowerCase() !== 'get' && !useNetworkStatus().isOnline.value) {
    return Promise.reject(new Error('Você está offline. Conecte-se para salvar alterações.'));
  }
  if (config.method?.toLowerCase() !== "get" || !config.url) {
    return config;
  }

  const requestUrl = new URL(config.url, API_BASE_URL);
  const path = requestUrl.pathname.replace(/\/+$/, "");

  if (cacheablePaths.has(path)) {
    const sessionHeader = getOfflineCacheSessionHeader(API_BASE_URL);

    if (sessionHeader) {
      config.headers.set("X-Offline-Cache-Session", sessionHeader);
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config.method?.toLowerCase() === 'get') {
      markCachedResponse(response.config.url || '', response.headers['x-offline-cache'] === 'true');
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401 && !/auth\/(login|register)/.test(error.config?.url || '')) {
      await endSession();
    }
    return Promise.reject(error);
  },
);
