import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadFunction(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const {resolveApiBaseUrl} = await loadFunction('../src/utils/api-base-url.ts');
const {getAllowedOrigins} = await loadFunction('../../backend-financas/src/cors-origins.ts');
assert.equal(resolveApiBaseUrl(undefined, 'http://127.0.0.1:4173'), 'http://127.0.0.1:3000/');
assert.equal(resolveApiBaseUrl(undefined, 'http://localhost:5173'), 'http://localhost:3000/');
assert.equal(resolveApiBaseUrl('https://api.example.com/', 'https://example.com'), 'https://api.example.com/');
assert.deepEqual(getAllowedOrigins('https://example.com', 'production'), ['https://example.com']);
assert(getAllowedOrigins(undefined, 'development').includes('http://127.0.0.1:4173'));

// Public logout accepts an expired/invalid cookie. No account login or DB writes.
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const context = await browser.newContext();
  await context.addCookies([{name:'access_token',value:'logout-test-expired',domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/login');
  assert((await context.cookies('http://127.0.0.1:3000')).some(c=>c.name==='access_token' && c.httpOnly));
  const result = await page.evaluate(async () => {
    const r = await fetch('http://127.0.0.1:3000/auth/logout', {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}});
    return r.status;
  });
  assert.equal(result, 204);
  assert(!(await context.cookies('http://127.0.0.1:3000')).some(c=>c.name==='access_token'));
  console.log('PASS: local API hostname, production CORS restriction, real browser CORS/logout 204 and httpOnly cookie deletion.');
} finally { await browser.close(); }