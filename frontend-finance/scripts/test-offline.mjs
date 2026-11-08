import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'

// Run from any directory: node --test frontend-finance/scripts/test-offline.mjs
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const swSource = source('src/sw.js')
const DAY = 24 * 60 * 60 * 1000
const ORIGIN = 'http://localhost:3000'
const SESSION = '11111111-1111-4111-8111-111111111111'
const offline = () => Promise.reject(new TypeError('Network unavailable'))

function worker() {
  let now = 1_800_000_000_000
  let network = async () => new Response('{"balance":100}', {
    headers: { 'Content-Type': 'application/json' },
  })
  const stores = new Map()
  const listeners = new Map()
  const timers = new Map()
  const requests = []
  const messages = []
  let timerId = 0
  const keyOf = (request) => typeof request === 'string' ? request : request.url
  const caches = {
    async keys() { return [...stores.keys()] },
    async delete(name) { return stores.delete(name) },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      const entries = stores.get(name)
      return {
        async match(key) { return entries.get(keyOf(key))?.clone() },
        async put(key, response) { entries.set(keyOf(key), response.clone()) },
        async delete(key) { return entries.delete(keyOf(key)) },
        async keys() { return [...entries.keys()].map((url) => new Request(url)) },
      }
    },
  }
  const self = {
    location: { origin: 'http://localhost:5173' },
    clients: {
      async matchAll() { return [{ postMessage: (message) => messages.push(message) }] },
      async claim() {},
    },
    async skipWaiting() {},
    setTimeout(callback, delay) {
      assert.equal(delay, 3000)
      timers.set(++timerId, callback)
      return timerId
    },
    clearTimeout(id) { timers.delete(id) },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(listener)
    },
  }
  // Workbox installation/navigation is checked separately; execute the entire
  // custom worker suffix unchanged, including its actual event listeners.
  const start = swSource.indexOf('const API_CACHE_NAME')
  assert.ok(start > 0, 'Expected Workbox setup followed by custom cache logic')
  vm.runInNewContext(swSource.slice(start), {
    self, caches, Request, Response, Headers, URL,
    Date: class extends Date { static now() { return now } },
    fetch(request) { requests.push(request); return network(request) },
  }, { filename: 'src/sw.js' })

  function dispatch(type, fields) {
    const pending = []
    let response
    const event = {
      ...fields,
      waitUntil(promise) { pending.push(promise) },
      respondWith(promise) { response = promise },
    }
    for (const listener of listeners.get(type) || []) listener(event)
    return { response, done: () => Promise.all(pending) }
  }
  return {
    stores, requests, messages,
    advance(milliseconds) { now += milliseconds },
    network(fn) { network = fn },
    timeout() { for (const callback of [...timers.values()]) callback() },
    begin(path = '/summary', session = SESSION, method = 'GET') {
      const headers = session ? { 'X-Offline-Cache-Session': `${session}|${ORIGIN}` } : {}
      return dispatch('fetch', {
        request: new Request(`${ORIGIN}${path}`, { method, headers }), clientId: 'client-1',
      })
    },
    async request(path, session) {
      const event = this.begin(path, session)
      const response = await event.response
      await event.done()
      return response
    },
    async clear() {
      const acknowledgements = []
      const event = dispatch('message', {
        data: { type: 'CLEAR_API_CACHE' },
        ports: [{ postMessage: (message) => acknowledgements.push(message.type) }],
      })
      await event.done()
      assert.deepEqual(acknowledgements, ['API_CACHE_CLEARED'])
    },
  }
}

test('network success is cached with metadata and never labelled offline', async () => {
  const sw = worker()
  const response = await sw.request()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { balance: 100 })
  assert.equal(response.headers.get('X-Offline-Cache'), null)
  assert.equal(sw.requests[0].headers.get('X-Offline-Cache-Session'), null)
  assert.equal(sw.stores.get('api-cache').size, 1)
  assert.equal(sw.stores.get('api-cache-metadata').size, 1)
})

test('network failure returns a labelled snapshot without contaminating stored headers', async () => {
  const sw = worker()
  await sw.request('/transactions?page=2')
  sw.network(offline)
  const response = await sw.request('/transactions?page=2')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('X-Offline-Cache'), 'true')
  assert.equal(response.headers.get('X-Offline-Cached-At'), '1800000000000')
  assert.deepEqual(await response.json(), { balance: 100 })
  assert.equal([...sw.stores.get('api-cache').values()][0].headers.get('X-Offline-Cache'), null)
  assert.equal((await sw.request('/transactions?page=3')).status, 504)
  assert.equal((await sw.request('/transactions?page=2', '22222222-2222-4222-8222-222222222222')).status, 504)
})

test('24h TTL accepts the boundary, expires immediately after it, and removes both entries', async () => {
  const sw = worker()
  await sw.request()
  sw.network(offline)
  sw.advance(DAY)
  assert.equal((await sw.request()).status, 200)
  sw.advance(1)
  const response = await sw.request()
  assert.equal(response.status, 504)
  assert.equal(response.headers.get('X-Offline-Cache'), null)
  assert.equal(sw.stores.get('api-cache').size, 0)
  assert.equal(sw.stores.get('api-cache-metadata').size, 0)
})

test('401 purges all sessions and returns unauthorized instead of cached success', async () => {
  const sw = worker()
  await sw.request()
  await sw.request('/categories', '22222222-2222-4222-8222-222222222222')
  sw.network(async () => new Response('Unauthorized', { status: 401 }))
  const response = await sw.request()
  assert.equal(response.status, 401)
  assert.equal(await response.text(), 'Unauthorized')
  assert.equal(response.headers.get('X-Offline-Cache'), null)
  assert.equal(sw.stores.has('api-cache'), false)
  assert.equal(sw.stores.has('api-cache-metadata'), false)
  assert.deepEqual(sw.messages.map((message) => message.type), ['API_CACHE_SESSION_EXPIRED'])
  sw.network(offline)
  assert.equal((await sw.request()).status, 504)
})

test('clear message acknowledges purge and prevents in-flight success from repopulating cache', async () => {
  const sw = worker()
  await sw.request()
  let resolveNetwork
  sw.network(() => new Promise((resolve) => { resolveNetwork = resolve }))
  const event = sw.begin('/categories')
  await sw.clear()
  assert.equal(sw.stores.has('api-cache'), false)
  assert.equal(sw.stores.has('api-cache-metadata'), false)
  resolveNetwork(new Response('{}'))
  assert.equal((await event.response).status, 200)
  await event.done()
  assert.equal(sw.stores.has('api-cache'), false)
  sw.network(offline)
  assert.equal((await sw.request()).status, 504)
})

test('timeout serves snapshot; a later 401 still purges and notifies', async () => {
  const sw = worker()
  await sw.request()
  let resolveNetwork
  sw.network(() => new Promise((resolve) => { resolveNetwork = resolve }))
  const event = sw.begin()
  sw.timeout()
  assert.equal((await event.response).headers.get('X-Offline-Cache'), 'true')
  resolveNetwork(new Response('Unauthorized', { status: 401 }))
  await event.done()
  assert.equal(sw.stores.has('api-cache'), false)
  assert.equal(sw.messages[0].type, 'API_CACHE_SESSION_EXPIRED')
})

test('no-store, Vary wildcard and server errors are not cached or replaced by snapshots', async () => {
  for (const options of [
    { headers: { 'Cache-Control': 'no-store' } },
    { headers: { Vary: '*' } },
    { status: 500 },
  ]) {
    const sw = worker()
    sw.network(async () => new Response('{}', options))
    assert.equal((await sw.request()).status, options.status || 200)
    sw.network(offline)
    assert.equal((await sw.request()).status, 504)
  }
})

test('missing/invalid session bypasses cache and mutation fetches are not intercepted', async () => {
  const sw = worker()
  await sw.request('/summary', null)
  await sw.request('/summary', 'invalid')
  assert.equal(sw.stores.size, 0)
  assert.equal(sw.begin('/transactions', SESSION, 'POST').response, undefined)
})

function loadUtility(path, dependencies, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(source(path).replaceAll('import.meta.env', '({})'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
      return dependencies[name]
    },
    ...globals,
  }, { filename: path })
  return exports
}

test('network status tracks browser events and removes cached response indicators', () => {
  const events = {}
  const module = loadUtility('src/utils/network-status.ts', {
    vue: { ref: (value) => ({ value }), readonly: (value) => value },
  }, {
    navigator: { onLine: true },
    window: { addEventListener: (type, callback) => { events[type] = callback } },
  })
  const state = module.useNetworkStatus()
  events.offline()
  assert.equal(state.isOnline.value, false)
  events.online()
  assert.equal(state.isOnline.value, true)
  module.markCachedResponse('/summary', true)
  assert.equal(state.cachedUrls.value.has('/summary'), true)
  module.markCachedResponse('/summary', false)
  assert.equal(state.cachedUrls.value.size, 0)
  module.markCachedResponse('/categories', true)
  module.resetCachedResponses()
  assert.equal(state.cachedUrls.value.size, 0)
})

test('connectivity detects failures even while navigator.onLine remains true', async () => {
  let reachable = false
  const module = loadUtility('src/utils/network-status.ts', {
    vue: { ref: value => ({ value }), readonly: value => value },
  }, {
    navigator: { onLine: true }, URL, AbortController,
    window: {
      location: { hostname: '127.0.0.1', origin: 'http://127.0.0.1:4173' },
      addEventListener() {}, setTimeout, clearTimeout,
    },
    fetch: async () => {
      if (!reachable) throw new TypeError('Network unavailable')
      return { type: 'opaque', ok: false }
    },
  })
  await module.checkConnectivity()
  assert.equal(module.useNetworkStatus().isOnline.value, false)
  reachable = true
  await module.checkConnectivity()
  assert.equal(module.useNetworkStatus().isOnline.value, true)
})

test('session cleanup is deduplicated and cancels queries before clearing and redirecting', async () => {
  const calls = []
  let finishCancel
  const module = loadUtility('src/utils/session.ts', {
    '@/router': { __esModule: true, default: {
      currentRoute: { value: { path: '/home' } },
      async replace(path) { calls.push(path) },
    } },
    './offline-cache': { async clearOfflineApiCache() { calls.push('offline-cache') } },
    './network-status': { resetCachedResponses() { calls.push('indicators') } },
    './vue-query': { queryClient: {
      cancelQueries() { calls.push('cancel'); return new Promise((resolve) => { finishCancel = resolve }) },
      clear() { calls.push('queries') },
    } },
  })
  const first = module.endSession()
  assert.equal(module.endSession(), first)
  assert.deepEqual(calls, ['cancel'])
  finishCancel()
  await first
  assert.deepEqual(calls, ['cancel', 'queries', 'indicators', 'offline-cache', '/login'])
  const next = module.endSession()
  assert.notEqual(next, first)
  finishCancel()
  await next
})

test('static evidence: Workbox precache/navigation and API offline/401 wiring', () => {
  assert.match(swSource, /precacheAndRoute\(self\.__WB_MANIFEST\)/)
  assert.match(swSource, /cleanupOutdatedCaches\(\)/)
  assert.match(swSource, /const navigateFallback = ['"]\/index\.html['"]/)
  assert.match(swSource, /new NavigationRoute\(createHandlerBoundToURL\(navigateFallback\)/)
  const api = source('src/utils/api.ts')
  assert.match(api, /config\.method\?\.toLowerCase\(\) !== 'get' && !useNetworkStatus\(\)\.isOnline\.value/)
  assert.match(api, /Promise\.reject\(new Error\(/)
  assert.match(api, /markCachedResponse\([^;]+\['x-offline-cache'\] === 'true'\)/)
  assert.match(api, /error\.response\?\.status === 401/)
  assert.match(api, /await endSession\(\)/)
})

test('static evidence: mutation controls are disabled offline and banner is accessible', () => {
  for (const path of [
    'views/home/HomeView.vue', 'views/transactions/TransactionsView.vue',
    'views/categories/CategoriesView.vue', 'views/login/LoginView.vue',
    'views/signin/SigninView.vue', 'components/transactions/NewTransactionDialog.vue',
    'components/transactions/EditTransactionDialog.vue',
  ]) assert.match(source(`src/${path}`), /:disabled="!isOnline(?:\s*\|\|[^" ]+|[^"]*)"/, path)
  const banner = source('src/components/pwa/OfflineBanner.vue')
  assert.match(banner, /!isOnline \|\| cachedUrls\.size > 0/)
  assert.match(banner, /role="status"/)
  assert.match(banner, /aria-live="polite"/)
})