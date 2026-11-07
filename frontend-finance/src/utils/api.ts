import axios from "axios";
import { getOfflineCacheSessionHeader } from "./offline-cache";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/";

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = `${import.meta.env.VITE_APP_URL ?? window.location.origin}/login`;
    }

    return Promise.reject(error);
  },
);
api.interceptors.request.use((config) => {
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
