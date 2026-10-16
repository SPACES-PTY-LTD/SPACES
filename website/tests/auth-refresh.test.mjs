import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(path, modules, globals = {}) {
  const exports = {}
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(source, { exports, require: name => modules[name], process: { env: {} }, console, ...globals })
  return exports
}
function auth(fetch) {
  return load('../src/lib/nextauth.ts', {
    'next-auth/providers/credentials': () => ({}), '@/lib/api/merchants': {}, '@/lib/api/client': {},
  }, { fetch }).authOptions.callbacks.jwt
}
const expired = () => ({ role: 'super_admin', accessToken: 'old', refreshToken: 'refresh', accessTokenExpiresAt: 1 })
test('expired concurrent sessions rotate once and reuse result', async () => {
  let calls = 0
  const jwt = auth(async () => { calls++; return { ok: true, json: async () => ({ data: { token: 'new', refresh_token: 'rotated', expires_in: 3600 } }) } })
  const results = await Promise.all([jwt({ token: expired() }), jwt({ token: expired() })])
  assert.equal(calls, 1)
  assert.equal(results[0].accessToken, 'new')
  assert.equal(results[1].refreshToken, 'rotated')
  assert.equal((await jwt({ token: expired() })).accessToken, 'new')
  assert.equal(calls, 1)
})
test('only invalid refresh credentials are fatal; transient failures remain retryable', async () => {
  for (const status of [401, 429, 500, 503]) {
    const jwt = auth(async () => ({ ok: false, status }))
    const result = await jwt({ token: expired() })
    assert.equal(result.authError, status === 401 ? 'RefreshAccessTokenError' : 'RefreshAccessTokenUnavailable')
    assert.equal(result.refreshToken, 'refresh')
  }
  const jwt = auth(async () => { throw new Error('offline') })
  assert.equal((await jwt({ token: expired() })).authError, 'RefreshAccessTokenUnavailable')
})
test('401 recovery forces rotation before scheduled expiry and ignores client credentials', async () => {
  let calls = 0
  const jwt = auth(async () => { calls++; return { ok: true, json: async () => ({ data: { token: 'new', refresh_token: 'rotated' } }) } })
  const token = { ...expired(), accessTokenExpiresAt: Date.now() + 3600000 }
  assert.equal((await jwt({ token })).accessToken, 'old')
  const result = await jwt({ token, trigger: 'update', session: { forceRefresh: true, accessToken: 'injected', refreshToken: 'injected' } })
  assert.equal(calls, 1)
  assert.equal(result.accessToken, 'new')
})
test('server render never rotates an expired token without persisting the cookie', async () => {
  let passedOptions
  const { getSession } = load('../src/lib/auth.ts', {
    '@/lib/routes/admin': { AdminLinks: {} }, '@/lib/nextauth': { authOptions: { callbacks: { jwt: () => { throw Error('rotation in render') } } } },
    'next-auth': { getServerSession: async options => { passedOptions = options; return { accessToken: 'old', accessTokenExpiresAt: 1 } } },
    'next/headers': { headers: async () => new Map([['x-auth-return-path', '/admin/settings?q=1']]) },
    'next/navigation': { redirect: path => { throw new Error(path) } },
  })
  await assert.rejects(getSession(), /\/auth\/refresh\?returnTo=%2Fadmin%2Fsettings%3Fq%3D1/)
  const token = expired()
  assert.equal(await passedOptions.callbacks.jwt({ token }), token)
})
test('browser renewal persists through NextAuth and retains session on outage', async () => {
  let synced, logouts = 0, body, status = 503
  const { renewBrowserSession } = load('../src/lib/renew-session.ts', {
    'next-auth/react': { getCsrfToken: async () => 'csrf', getSession: async () => null },
    '@/lib/auth-session-manager': { syncAuthTokens: session => { synced = session }, logoutStoredSession: async () => { logouts++ } },
  }, { fetch: async (_url, options) => { body = JSON.parse(options.body); return { ok: status === 200, json: async () => ({ accessToken: 'new', refreshToken: 'rotated' }) } } })
  assert.equal(await renewBrowserSession(true), null)
  assert.equal(logouts, 0)
  status = 200
  assert.equal(await renewBrowserSession(true), 'new')
  assert.equal(synced.refreshToken, 'rotated')
  assert.equal(body.csrfToken, 'csrf')
  assert.equal(body.data.forceRefresh, true)
})
test('shared admin client refreshes and retries JSON and upload requests only once on 401', async () => {
  for (const upload of [false, true]) {
    let token = 'old', renewals = 0
    const calls = []
    const body = upload ? new FormData() : { name: 'Update' }
    if (upload) body.append('file', 'contents')
    const { apiFetch } = load('../src/lib/api/client.ts', {
      '@/lib/auth-session-manager': { getStoredAuthTokens: () => ({ accessToken: token }) },
      '@/lib/renew-session': { renewBrowserSession: async () => { renewals++; token = 'new'; return token } },
    }, { window: {}, Headers, FormData, URL, fetch: async (_url, options) => {
      calls.push(options)
      return new Response(JSON.stringify(calls.length === 1 ? { message: 'Expired' } : { saved: true }), {
        status: calls.length === 1 ? 401 : 200, headers: { 'Content-Type': 'application/json' },
      })
    } })
    const result = await apiFetch('/api/v1/example', { method: 'POST', body, token: 'old' })
    assert.equal(result.saved, true)
    assert.equal(renewals, 1)
    assert.equal(calls.length, 2)
    assert.equal(calls[1].headers.get('Authorization'), 'Bearer new')
    assert.equal(calls[1].body, calls[0].body)
  }
})
test('shared client refreshes before expiry and does not refresh permission failures', async () => {
  let renewals = 0, token = 'old', expiry = 1
  const { apiFetch } = load('../src/lib/api/client.ts', {
    '@/lib/auth-session-manager': { getStoredAuthTokens: () => ({ accessToken: token, accessTokenExpiresAt: expiry }) },
    '@/lib/renew-session': { renewBrowserSession: async () => { renewals++; token = 'new'; expiry = Date.now() + 3600000; return token } },
  }, { window: {}, Headers, FormData, URL, fetch: async (_url, options) => {
    assert.equal(options.headers.get('Authorization'), 'Bearer new')
    return new Response('{}', { status: 403, headers: { 'Content-Type': 'application/json' } })
  } })
  const result = await apiFetch('/api/v1/example', { token: 'old' })
  assert.equal(result.status, 403)
  assert.equal(renewals, 1)
})
