import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'

// Run from any directory: node --test backend-financas/scripts/test-auth-controller.mjs
// Use the installed TypeScript instead of the legacy Jest 25 / ts-jest 25 runner.
const require = createRequire(import.meta.url)
require('reflect-metadata')
const ts = require('typescript')
const common = require('@nestjs/common')
const { HTTP_CODE_METADATA, PATH_METADATA, METHOD_METADATA, ROUTE_ARGS_METADATA } = require('@nestjs/common/constants')
const noopDecorator = () => () => {}

function transpile(path, dependencies, environment) {
  const exports = {}
  const source = readFileSync(new URL(`../src/auth/${path}`, import.meta.url), 'utf8')
  const { outputText, diagnostics } = ts.transpileModule(source, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
    },
  })
  assert.equal(diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error).length, 0)
  vm.runInNewContext(outputText, {
    exports,
    process: { env: { NODE_ENV: environment } },
    require(name) {
      assert.ok(name in dependencies, `Unexpected controller dependency: ${name}`)
      return dependencies[name]
    },
  }, { filename: path })
  return exports
}

function controller(environment) {
  const decorators = transpile('decorators.ts', { '@nestjs/common': common }, environment)
  const { AuthController } = transpile('auth.controller.ts', {
    '@nestjs/common': common,
    '@nestjs/swagger': {
      ApiTags: noopDecorator, ApiOperation: noopDecorator, ApiResponse: noopDecorator,
    },
    './decorators': decorators,
    './auth.service': { AuthService: class {} },
    '../dtos': {},
  }, environment)
  return { AuthController, publicKey: decorators.IS_PUBLIC_KEY }
}

for (const environment of ['development', 'test', 'production', undefined]) {
  test(`logout clears the login cookie with matching attributes (${environment ?? 'unset NODE_ENV'})`, async () => {
    const { AuthController } = controller(environment)
    const calls = []
    const service = {
      async login(dto) {
        assert.deepEqual(dto, { email: 'user@example.com', password: 'password' })
        return { accessToken: 'test-token' }
      },
    }
    const instance = new AuthController(service)
    const response = {
      cookie(...args) { calls.push(['cookie', ...args]) },
      clearCookie(...args) { calls.push(['clearCookie', ...args]) },
    }

    assert.equal((await instance.login({ email: 'user@example.com', password: 'password' }, response)).message,
      'Login realizado com sucesso')
    assert.equal(instance.logout(response), undefined)
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0].slice(0, 3), ['cookie', 'access_token', 'test-token'])
    assert.deepEqual(calls[1].slice(0, 2), ['clearCookie', 'access_token'])
    // Normalize VM objects so assertions compare attributes, not realm prototypes.
    const loginOptions = { ...calls[0][3] }
    const logoutOptions = { ...calls[1][2] }
    assert.equal(loginOptions.maxAge, 60 * 60 * 1000)
    delete loginOptions.maxAge
    assert.deepEqual(logoutOptions, loginOptions)
    assert.deepEqual(logoutOptions, {
      httpOnly: true,
      secure: environment === 'production',
      sameSite: environment === 'production' ? 'none' : 'lax',
      path: '/',
    })
    assert.equal('maxAge' in logoutOptions, false)
    assert.equal('expires' in logoutOptions, false)
  })
}

test('logout is public POST /auth/logout, returns 204, and preserves Nest response passthrough', () => {
  const { AuthController, publicKey } = controller('production')
  const logout = AuthController.prototype.logout
  assert.equal(Reflect.getMetadata(publicKey, logout), true)
  assert.equal(Reflect.getMetadata(PATH_METADATA, AuthController), 'auth')
  assert.equal(Reflect.getMetadata(PATH_METADATA, logout), 'logout')
  assert.equal(Reflect.getMetadata(METHOD_METADATA, logout), common.RequestMethod.POST)
  assert.equal(Reflect.getMetadata(HTTP_CODE_METADATA, logout), 204)
  assert.equal(Reflect.getMetadata('__responsePassthrough__', AuthController, 'logout'), true)
  assert.ok(Reflect.getMetadata(ROUTE_ARGS_METADATA, AuthController, 'logout'))
  const instance = new AuthController(new Proxy({}, {
    get() { assert.fail('Logout must not require authentication or call AuthService') },
  }))
  let cleared = 0
  assert.equal(instance.logout({ clearCookie() { cleared += 1 } }), undefined)
  assert.equal(cleared, 1)
})