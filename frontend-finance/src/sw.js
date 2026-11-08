import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/docs\//],
  }),
);

// O injectManifest não gera runtimeCaching automaticamente. Esta rota mantém
// o POST da criação de transações em fila e o repete assim que houver rede.
const transactionsWriteQueue = new BackgroundSyncPlugin(
  "transactions-write-queue",
  { maxRetentionTime: 24 * 60 },
);
const API_ORIGIN = new URL(
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/",
).origin;
const transactionWriteStrategy = new NetworkOnly({
  plugins: [transactionsWriteQueue],
});

registerRoute(
  ({ request, url }) =>
    request.method === "POST" &&
    url.origin === API_ORIGIN &&
    /^\/transactions\/?$/.test(url.pathname),
  async ({ event, request }) => {
    try {
      return await transactionWriteStrategy.handle({ event, request });
    } catch {
      // O BackgroundSyncPlugin já colocou a requisição na fila. Responder 202
      // evita que o Axios trate a operação enfileirada como uma falha.
      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
  "POST",
);
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

// All production chunks (including lazy-loaded routes) are cached at install.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
const navigateFallback = "/index.html";
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(navigateFallback), {
    denylist: [/^\/auth\//, /^\/api\//],
  }),
);

const API_CACHE_NAME = "api-cache";
const API_METADATA_CACHE_NAME = "api-cache-metadata";
const STATIC_CACHE_NAME = "static-cache-v2";
// Retain an explicitly labelled offline snapshot for at most 24 hours.
const API_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const API_NETWORK_TIMEOUT_MS = 3000;
const API_CACHE_MAX_ENTRIES = 100;
const STATIC_CACHE_MAX_ENTRIES = 100;
const SESSION_HEADER = "X-Offline-Cache-Session";
const CACHEABLE_API_PATHS = new Set([
  "/summary",
  "/summary/by-category",
  "/transactions",
  "/categories",
  "/users/me",
]);
const EXTERNAL_STATIC_HOSTS = new Set([
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "images.unsplash.com",
]);

let apiCacheEpoch = 0;

// Uma nova versão fica em "waiting" até o usuário confirmar a atualização.
// O app envia SKIP_WAITING (via updateSW() de virtual:pwa-register) e, após a
// ativação, o clients.claim() abaixo dispara o recarregamento da página.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith("static-cache-") && name !== STATIC_CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_API_CACHE") {
    return;
  }

  apiCacheEpoch += 1;
  event.waitUntil(
    Promise.all([
      caches.delete(API_CACHE_NAME),
      caches.delete(API_METADATA_CACHE_NAME),
    ]).then(() => {
      event.ports[0]?.postMessage({ type: "API_CACHE_CLEARED" });
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Workbox exclusively handles app navigation and precached build assets.
  if (request.mode === "navigate") return;

  if (request.method === "GET" && isCacheableApiPath(url.pathname)) {
    event.respondWith(handleApiRequest(event, request, url));
    return;
  }

  if (isCacheableStaticRequest(request, url)) {
    event.respondWith(handleStaticRequest(event, request));
  }
});

function isCacheableApiPath(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "");
  return [...CACHEABLE_API_PATHS].some(
    (path) => normalizedPath === path || normalizedPath.endsWith(path),
  );
}

function getSessionContext(request, url) {
  const value = request.headers.get(SESSION_HEADER);

  if (!value) {
    return null;
  }

  const separator = value.indexOf("|");
  const sessionId = value.slice(0, separator);
  const apiOrigin = value.slice(separator + 1);

  if (
    separator < 1 ||
    !/^[a-zA-Z0-9-]{16,64}$/.test(sessionId) ||
    apiOrigin !== url.origin
  ) {
    return null;
  }

  return sessionId;
}

function makeCacheKey(url, sessionId, request) {
  const cacheUrl = new URL(url.href);
  cacheUrl.pathname = `/__api-cache__/${encodeURIComponent(sessionId)}${url.pathname}`;
  return new Request(cacheUrl.href, {
    method: "GET",
    headers: new Headers(request.headers),
  });
}
function withoutSessionHeader(request) {
  const headers = new Headers(request.headers);
  headers.delete(SESSION_HEADER);
  return new Request(request, { headers });
}

async function getCachedApiResponse(
  cache,
  metadataCache,
  cacheKey,
  { allowStale = false } = {},
) {
  const cached = await cache.match(cacheKey);

  if (!cached) {
    await metadataCache.delete(cacheKey);
    return null;
  }

  const metadata = await metadataCache.match(cacheKey);
  const cachedAt = Number(await metadata?.text()) || 0;

  if (!cachedAt || (!allowStale && Date.now() - cachedAt > API_CACHE_TTL_MS)) {
    await Promise.all([cache.delete(cacheKey), metadataCache.delete(cacheKey)]);
    return null;
  }

  return cached;
}

async function pruneApiCache(cache, metadataCache) {
  const keys = await cache.keys();
  const entries = await Promise.all(
    keys.map(async (key) => {
      const metadata = await metadataCache.match(key);
      const cachedAt = Number(await metadata?.text()) || 0;

      if (!cachedAt || Date.now() - cachedAt > API_CACHE_TTL_MS) {
        await Promise.all([cache.delete(key), metadataCache.delete(key)]);
        return null;
      }

      return { key, cachedAt };
    }),
  );
  const retained = entries
    .filter(Boolean)
    .sort((first, second) => first.cachedAt - second.cachedAt);

  while (retained.length > API_CACHE_MAX_ENTRIES) {
    const oldest = retained.shift();
    await cache.delete(oldest.key);
  }
}

async function purgeApiCache() {
  apiCacheEpoch += 1;
  await Promise.all([
    caches.delete(API_CACHE_NAME),
    caches.delete(API_METADATA_CACHE_NAME),
  ]);
}

async function notifySessionExpired(clientId) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  clients.forEach((client) =>
    client.postMessage({ type: "API_CACHE_SESSION_EXPIRED" }),
  );
}

async function handleApiRequest(event, request, url) {
  const sessionId = getSessionContext(request, url);
  const networkRequest = withoutSessionHeader(request);

  if (!sessionId) {
    return fetch(networkRequest);
  }

  const cacheKey = makeCacheKey(url, sessionId, request);
  const requestEpoch = apiCacheEpoch;
  const networkPromise = fetch(networkRequest).then(async (response) => {
    if (response.status === 401) {
      await purgeApiCache();
      await notifySessionExpired(event.clientId);
      return response;
    }

    const cacheControl =
      response.headers.get("Cache-Control")?.toLowerCase() ?? "";
    const vary = response.headers.get("Vary")?.trim();

    if (
      response.status === 200 &&
      !cacheControl.includes("no-store") &&
      vary !== "*" &&
      requestEpoch === apiCacheEpoch
    ) {
      try {
        const cache = await caches.open(API_CACHE_NAME);
        const metadataCache = await caches.open(API_METADATA_CACHE_NAME);
        await cache.put(cacheKey, response.clone());
        await metadataCache.put(cacheKey, new Response(String(Date.now())));
        await pruneApiCache(cache, metadataCache);
      } catch {
        // A cache quota or storage error must not fail a successful API response.
      }
    }

    return response;
  });

  event.waitUntil(networkPromise.then(() => undefined).catch(() => undefined));
  const networkOutcomePromise = networkPromise.then(
    (response) => ({ response }),
    (error) => ({ error }),
  );

  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = self.setTimeout(
      () => resolve({ timedOut: true }),
      API_NETWORK_TIMEOUT_MS,
    );
  });
  const networkOutcome = await Promise.race([
    networkOutcomePromise,
    timeoutPromise,
  ]);
  self.clearTimeout(timeoutId);

  if (networkOutcome.response) {
    return networkOutcome.response;
  }

  const cache = await caches.open(API_CACHE_NAME);
  const metadataCache = await caches.open(API_METADATA_CACHE_NAME);
  // Em modo offline, a última resposta conhecida mantém as páginas utilizáveis
  // mesmo que tenha ultrapassado o TTL de atualização normal.
  const cached = await getCachedApiResponse(cache, metadataCache, cacheKey, {
    allowStale: true,
  });

  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-Offline-Cache", "true");
    const metadata = await metadataCache.match(cacheKey);
    headers.set("X-Offline-Cached-At", (await metadata?.text()) || "");
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers,
    });
  }

  return new Response(JSON.stringify({ message: "API request timed out" }), {
    status: 504,
    headers: { "Content-Type": "application/json" },
  });
}

function isCacheableStaticRequest(request, url) {
  if (request.method !== "GET") {
    return false;
  }

  const staticDestination = ["script", "style", "image", "font"].includes(
    request.destination,
  );

  if (url.origin === self.location.origin) {
    // Workbox owns same-origin build assets, with revision-aware cleanup.
    return false;
  }

  return EXTERNAL_STATIC_HOSTS.has(url.hostname) && staticDestination;
}

function handleStaticRequest(event, request) {
  const cachePromise = caches.open(STATIC_CACHE_NAME);
  const networkPromise = cachePromise.then((cache) =>
    fetch(request).then(async (response) => {
      if (response.status === 200 || response.type === "opaque") {
        try {
          await cache.put(request, response.clone());
          const cacheKeys = await cache.keys();

          while (cacheKeys.length > STATIC_CACHE_MAX_ENTRIES) {
            await cache.delete(cacheKeys.shift());
          }
        } catch {
          // Static cache failures should not affect the page request.
        }
      }

      return response;
    }),
  );

  event.waitUntil(networkPromise.then(() => undefined).catch(() => undefined));

  return cachePromise.then(async (cache) => {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    try {
      return await networkPromise;
    } catch {
      return new Response("Static resource unavailable offline", {
        status: 503,
      });
    }
  });
}
// End of runtime handlers; precache lifecycle is managed by Workbox.
