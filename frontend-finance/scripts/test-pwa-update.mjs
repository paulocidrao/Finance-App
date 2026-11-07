import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Run from any directory: node frontend-finance/scripts/test-pwa-update.mjs
// Requires an existing production build, preview on 4173 and installed Chrome.
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const origin = 'http://127.0.0.1:4180';
const preview = 'http://127.0.0.1:4173';
const timeout = 30_000;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function snapshot(directory, prefix = '') {
  const files = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const key = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      for (const [name, bytes] of await snapshot(path, key)) files.set(name, bytes);
    } else {
      files.set(key, await readFile(path));
    }
  }
  return files;
}

const files = await snapshot(dist);
const fingerprints = (entries) => [...entries].map(([name, bytes]) => [name, hash(bytes)]).sort();
for (const path of ['/index.html', '/sw.js']) {
  const response = await fetch(`${preview}${path}`);
  assert.equal(response.status, 200, `Preview unavailable: ${path}`);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(files.get(path)),
    `Preview and current dist differ: ${path}`);
}
console.log('PASS: preview 4173 and read-only dist snapshot contain the same current build.');

const baseWorker = files.get('/sw.js').toString('utf8');
const indexEntry = /"revision"\s*:\s*"([^"]+)"\s*,\s*"url"\s*:\s*"index\.html"/;
const originalRevision = baseWorker.match(indexEntry)?.[1];
assert(originalRevision, 'Expected Workbox index.html revision in the built worker');
const nextRevision = `${originalRevision}-controlled-update`;
const variants = [
  `${baseWorker}\n// controlled-update-test: initial\n`,
  `${baseWorker.replace(indexEntry, (entry) => entry.replace(originalRevision, nextRevision))}\n// controlled-update-test: approved\n`,
];
let revision = 0;
const workerRequests = [];
const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.json': 'application/json',
};
const server = http.createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, origin).pathname);
  response.setHeader('Cache-Control', 'no-store');
  if (path === '/sw.js') {
    workerRequests.push(revision);
    response.setHeader('Content-Type', 'text/javascript');
    response.setHeader('Service-Worker-Allowed', '/');
    response.end(variants[revision]);
    return;
  }
  const filePath = files.has(path) ? path : (request.headers.accept?.includes('text/html') ? '/index.html' : null);
  if (!filePath) {
    response.writeHead(404).end();
    return;
  }
  const extension = filePath.slice(filePath.lastIndexOf('.'));
  response.setHeader('Content-Type', mimeTypes[extension] ?? 'application/octet-stream');
  response.end(files.get(filePath));
});

let context;
let profile;
const pageErrors = [];
async function launch() {
  const browser = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless: true, serviceWorkers: 'allow',
  });
  browser.setDefaultTimeout(timeout);
  // Public auth routes need no API. Fail closed for every external request,
  // including worker requests; never contact a real backend or external service.
  await browser.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    return route.abort('internetdisconnected');
  });
  await browser.addInitScript((testOrigin) => {
    if (location.origin !== testOrigin) return;
    window.updateTestDocument = crypto.randomUUID();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const count = Number(sessionStorage.getItem('update-test-controller-changes') ?? 0);
      sessionStorage.setItem('update-test-controller-changes', String(count + 1));
    });
  }, origin);
  browser.on('page', (page) => page.on('pageerror', (error) => pageErrors.push(error.message)));
  return browser;
}

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(4180, '127.0.0.1', resolve);
  });
  profile = await mkdtemp(join(tmpdir(), 'finance-pwa-update-'));
  context = await launch();
  let page = await context.newPage();
  await page.goto(`${origin}/login`);
  await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return navigator.serviceWorker.controller && registration?.active?.state === 'activated' && !registration.waiting;
  }, null, { timeout });
  const cdpInstall = await context.newCDPSession(page);
  await cdpInstall.send('Page.enable');
  const installability = await cdpInstall.send('Page.getInstallabilityErrors');
  assert.deepEqual(installability.installabilityErrors, [], 'Chrome installability errors');
  await context.close();
  context = await launch();
  page = await context.newPage();
  await page.goto(`${origin}/login`);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout });
  console.log('PASS: initial worker installed; registration survives reopening the persistent Chrome profile.');

  const staleUrl = `${origin}/assets/update-test-stale-${randomUUID()}.js`;
  const initial = await page.evaluate(async ({ staleUrl, originalRevision }) => {
    const registration = await navigator.serviceWorker.getRegistration();
    const cacheNames = await caches.keys();
    const precacheNames = cacheNames.filter((name) => name.startsWith('workbox-precache'));
    if (precacheNames.length !== 1) throw new Error(`Expected one existing Workbox cache: ${cacheNames}`);
    const cacheName = precacheNames[0];
    const cache = await caches.open(cacheName);
    const oldIndex = `${location.origin}/index.html?__WB_REVISION__=${originalRevision}`;
    if (!await cache.match(oldIndex)) throw new Error('Initial index revision not precached');
    await cache.put(staleUrl, new Response('obsolete precache entry'));
    await (await caches.open('static-cache-v1')).put(staleUrl, new Response('obsolete static entry'));
    window.updateTestOldController = navigator.serviceWorker.controller;
    window.updateTestOldActive = registration.active;
    sessionStorage.setItem('update-test-controller-changes', '0');
    return { cacheName, oldIndex, document: window.updateTestDocument };
  }, { staleUrl, originalRevision });

  revision = 1;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    window.updateTestStates = [];
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      window.updateTestStates.push(worker.state);
      worker.addEventListener('statechange', () => window.updateTestStates.push(worker.state));
    });
    await registration.update();
  });
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.waiting?.state === 'installed' && !registration.installing;
  }, null, { timeout });
  await page.getByText('Nova versão disponível', { exact: true }).waitFor();
  const beforeApproval = await page.evaluate(async ({ cacheName, staleUrl, oldIndex }) => {
    const registration = await navigator.serviceWorker.getRegistration();
    const cache = await caches.open(cacheName);
    window.updateTestWaiting = registration.waiting;
    return {
      controllerUnchanged: navigator.serviceWorker.controller === window.updateTestOldController,
      activeUnchanged: registration.active === window.updateTestOldActive,
      waitingDistinct: registration.waiting !== registration.active,
      document: window.updateTestDocument,
      changes: Number(sessionStorage.getItem('update-test-controller-changes')),
      stalePresent: !!await cache.match(staleUrl),
      oldIndexPresent: !!await cache.match(oldIndex),
      staticV1Present: (await caches.keys()).includes('static-cache-v1'),
      states: window.updateTestStates,
    };
  }, { ...initial, staleUrl });
  assert.deepEqual({ ...beforeApproval, states: undefined }, {
    controllerUnchanged: true, activeUnchanged: true, waitingDistinct: true,
    document: initial.document, changes: 0, stalePresent: true, oldIndexPresent: true,
    staticV1Present: true, states: undefined,
  });
  assert(beforeApproval.states.includes('installing'));
  assert(beforeApproval.states.includes('installed'));
  console.log('PASS: installing → waiting; unchanged active controller/document, update UI visible, old caches retained before approval.');

  await Promise.all([
    page.waitForEvent('load', { timeout }),
    page.getByRole('button', { name: 'Atualizar', exact: true }).click(),
  ]);
  await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
  await page.waitForFunction(async ({ cacheName, staleUrl, oldIndex, nextRevision }) => {
    const registration = await navigator.serviceWorker.getRegistration();
    const cache = await caches.open(cacheName);
    return registration?.active?.state === 'activated' && !registration.waiting && !registration.installing
      && navigator.serviceWorker.controller === registration.active
      && !await cache.match(staleUrl) && !await cache.match(oldIndex)
      && !!await cache.match(`${location.origin}/index.html?__WB_REVISION__=${nextRevision}`)
      && !(await caches.keys()).includes('static-cache-v1');
  }, { ...initial, staleUrl, nextRevision }, { timeout });
  assert.notEqual(await page.evaluate(() => window.updateTestDocument), initial.document);
  assert.equal(await page.evaluate(() => Number(sessionStorage.getItem('update-test-controller-changes'))), 1);
  assert.equal(await page.getByText('Nova versão disponível', { exact: true }).count(), 0);
  assert(workerRequests.includes(0) && workerRequests.includes(1));
  console.log('PASS: Atualizar causes controllerchange and reload; waiting cleared, stale Workbox entries and static-cache-v1 removed, new index revision cached.');

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await context.setOffline(true);
  // Context offline alone is insufficient in some Chrome versions for SW fetches.
  await cdp.send('Network.overrideNetworkState', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
  await page.goto(`${origin}/signin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('status').filter({ hasText: 'Você está offline' }).waitFor();
  assert.equal(await page.evaluate(() => navigator.onLine), false);
  assert(await page.getByRole('button', { name: 'Criar conta', exact: true }).isDisabled());
  console.log('PASS: previously unvisited /signin route renders offline after the approved update; offline banner and disabled submit confirmed.');
  assert.deepEqual(pageErrors, [], 'Uncaught application errors');
} finally {
  try {
    await context?.close();
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (profile) await rm(profile, { recursive: true, force: true });
    assert.deepEqual(fingerprints(await snapshot(dist)), fingerprints(files), 'Production dist was modified');
    console.log('PASS: production dist unchanged; isolated server and temporary Chrome profile cleaned up.');
  }
}