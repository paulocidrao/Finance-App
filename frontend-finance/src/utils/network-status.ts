import { ref, readonly } from 'vue'

const isOnline = ref(navigator.onLine)
const cachedUrls = ref(new Set<string>())

let checking = false
let monitoring = false

export async function checkConnectivity(): Promise<void> {
  if (checking) return
  if (!navigator.onLine) {
    isOnline.value = false
    return
  }
  checking = true
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 4000)
  try {
    const local = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    // A local preview remains reachable without Wi-Fi, so probe the internet locally.
    // Production probes its own server; this URL is not handled by the service worker.
    const target = import.meta.env.VITE_CONNECTIVITY_URL || (local
      ? 'https://www.gstatic.com/generate_204'
      : new URL('/connectivity.txt', window.location.origin).href)
    const url = new URL(target, window.location.origin)
    url.searchParams.set('_', String(Date.now()))
    const response = await fetch(url, {
      method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit',
      signal: controller.signal,
    })
    isOnline.value = response.type === 'opaque' || response.ok
  } catch {
    isOnline.value = false
  } finally {
    window.clearTimeout(timeout)
    checking = false
  }
}

export function startConnectivityMonitoring(): void {
  if (monitoring) return
  monitoring = true
  void checkConnectivity()
  window.setInterval(() => void checkConnectivity(), 5000)
  window.addEventListener('online', () => void checkConnectivity())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkConnectivity()
  })
}

window.addEventListener('online', () => {
  if (!monitoring) isOnline.value = true
})
window.addEventListener('offline', () => { isOnline.value = false })

export function markCachedResponse(url: string, cached: boolean): void {
  const next = new Set(cachedUrls.value)
  if (cached) next.add(url)
  else next.delete(url)
  cachedUrls.value = next
}

export function resetCachedResponses(): void {
  cachedUrls.value = new Set()
}

export function useNetworkStatus() {
  return { isOnline: readonly(isOnline), cachedUrls: readonly(cachedUrls) }
}