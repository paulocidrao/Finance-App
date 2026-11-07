import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Isolated mock API: never connect this test to a database or real account.
const api = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4173');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/users/me') return res.end(JSON.stringify({ id:'test-user', name:'Teste PWA', email:'test@example.local', createdAt:'2026-01-01T00:00:00Z' }));
  if (url.pathname === '/transactions') return res.end(JSON.stringify({ items:[], total:0, page:1, limit:20 }));
  if (url.pathname === '/categories') return res.end(JSON.stringify([{ id:'test-category', userId:'test-user', name:'Mercado', type:'EXPENSE', transactionCount:0, createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-01T00:00:00Z' }]));
  res.end('[]');
});
await new Promise((resolve, reject) => { api.once('error', reject); api.listen(3000, resolve); });
const profile = await mkdtemp(join(tmpdir(), 'meu-bolso-pwa-'));
const context = await chromium.launchPersistentContext(profile, { channel:'chrome', headless:true });
try {
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/login');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.enable');
  const manifest = await cdp.send('Page.getAppManifest');
  assert.equal(manifest.errors.length, 0);
  const installability = await cdp.send('Page.getInstallabilityErrors');
  assert.equal(installability.installabilityErrors.length, 0, JSON.stringify(installability));
  await page.evaluate(() => sessionStorage.setItem('finance-offline-cache-session', crypto.randomUUID()));
  await page.goto('http://127.0.0.1:4173/transactions');
  await page.waitForFunction(async () => (await (await caches.open('api-cache')).keys()).length >= 2);
  await context.setOffline(true);
  await cdp.send('Network.enable');
  await cdp.send('Network.overrideNetworkState', {offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await page.goto('http://127.0.0.1:4173/transactions', {waitUntil:'domcontentloaded'});
  await page.getByRole('status').filter({hasText:'Você está offline'}).waitFor();
  assert(await page.getByRole('button', {name:'Nova transação',exact:true}).isDisabled());
  assert((await page.locator('body').innerText()).includes('Os dados podem estar desatualizados'));
  const snapshot = await page.evaluate(async () => {
    const id = sessionStorage.getItem('finance-offline-cache-session');
    const r = await fetch('http://127.0.0.1:3000/categories', {credentials:'include', headers:{'X-Offline-Cache-Session':`${id}|http://127.0.0.1:3000`}});
    return {status:r.status, cached:r.headers.get('X-Offline-Cache')};
  });
  assert.deepEqual(snapshot, {status:200,cached:'true'});
  await page.goto('http://127.0.0.1:4173/categories', {waitUntil:'domcontentloaded'});
  await page.getByRole('button', {name:'Editar Mercado',exact:true}).waitFor();
  assert(await page.getByRole('button', {name:'Nova categoria',exact:true}).isDisabled());
  assert(await page.getByRole('button', {name:'Editar Mercado',exact:true}).isDisabled());
  assert(await page.getByRole('button', {name:'Excluir Mercado',exact:true}).isDisabled());
  await page.getByRole('searchbox', {name:'Buscar categoria pelo nome'}).fill('não existe');
  await page.getByText('Nenhuma categoria encontrada', {exact:true}).waitFor();
  await page.goto('http://127.0.0.1:4173/login', {waitUntil:'domcontentloaded'});
  await page.getByRole('status').filter({hasText:'Você está offline'}).waitFor();
  assert(await page.getByRole('button', {name:'Entrar',exact:true}).isDisabled());
  await context.setOffline(false);
  await cdp.send('Network.overrideNetworkState', {offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  console.log('PASS: Chromium installability, offline deep links, cached data, banner, category search and disabled create/edit/delete/login.');
} finally {
  await context.close();
  await rm(profile, {recursive:true, force:true});
  await new Promise(resolve => api.close(resolve));
}