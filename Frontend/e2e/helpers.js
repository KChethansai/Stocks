// Shared helpers for the MarketForge browser audit. All users are unique per
// run (prefix + timestamp) on the isolated test database — never production.
import { expect } from '@playwright/test'

export const API = 'http://localhost:4101'

let counter = 0
export function testUser(prefix = 'audit') {
  counter += 1
  const tag = `${Date.now().toString(36)}${counter}`
  return {
    username: `${prefix}${tag}`.slice(0, 28),
    email: `${prefix}-${tag}@example.com`,
    password: 'TestPass123!',
  }
}

// Fill + verify the value stuck: a background store re-render can remount
// inputs mid-fill (Login mounts fetchProfile; 401s churn the store), and an
// unverified fill can land in a detached node — worthless at submit, where
// react-hook-form correctly blocks the empty field and no request fires.
// Verified fills make that race a retry, not a silent empty submit.
export async function fillVerified(locator, value) {
  await locator.fill(value)
  try {
    await expect(locator).toHaveValue(value, { timeout: 5000 })
  } catch {
    // A background store re-render can remount inputs mid-fill; one retry
    // after asserting visibility is deterministic, not a blind sleep.
    await locator.fill(value)
    await expect(locator).toHaveValue(value, { timeout: 5000 })
  }
}

// Re-assert filled values immediately before submit: even a verified fill
// can be discarded by a remount in the fill→click gap (proven on WebKit,
// Oct 2026: register fields verified then empty at submit, RHF correctly
// blocked with inline errors, zero requests). One targeted refill pass
// closes the gap; anything still wrong after that is a real app defect.
async function ensureFilled(pairs) {
  for (const [locator, value] of pairs) {
    try {
      await expect(locator).toHaveValue(value, { timeout: 2000 })
    } catch {
      await locator.fill(value)
      await expect(locator).toHaveValue(value, { timeout: 5000 })
    }
  }
}

// Click submit, then confirm the app reacted. Trace-proven on WebKit
// (Oct 2026: "element was detached from the DOM" mid-click): the auth form
// subtree can remount between verification and submit, discarding values, and
// the app then correctly blocks the empty submit — silent and pristine.
// Retry rule (bounded, fail-closed): re-fill + re-click ONCE, and ONLY when
// the form is empty AND silent (no navigation, toast, alert, or inline
// error). A live-but-slow submit always has full fields, so it is never
// retried (no double-submit risk: the app never clears fields on submit).
// Anything beyond one retry fails honestly at the caller's assertions.
export async function submitVerified(page, pairs, buttonRe) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await ensureFilled(pairs)
    await page.getByRole('button', { name: buttonRe }).click()
    await page.waitForTimeout(1500)
    const state = await page.evaluate(() => ({
      empty: [...document.querySelectorAll('form input')].every((i) => !i.value),
      feedback: document.querySelectorAll('[role="status"], [role="alert"]').length,
      inlineErrors: [...document.querySelectorAll('form p')].filter((el) =>
        /choose a username|enter your|valid email|required|invalid|failed|incorrect/i.test(el.textContent || '')).length,
    }))
    if (!state.empty || state.feedback > 0 || state.inlineErrors > 0) return
  }
}

export async function registerViaUI(page, user) {
  await page.goto('/register')
  const pairs = [
    [page.getByLabel(/username/i), user.username],
    [page.getByLabel(/email address/i), user.email],
    [page.getByLabel(/^password/i), user.password],
  ]
  for (const [locator, value] of pairs) await fillVerified(locator, value)
  await submitVerified(page, pairs, /create account/i)
}

export async function loginViaUI(page, user) {
  await page.goto('/login')
  const pairs = [
    [page.getByLabel(/email address/i), user.email],
    [page.getByLabel(/^password/i), user.password],
  ]
  for (const [locator, value] of pairs) await fillVerified(locator, value)
  await submitVerified(page, pairs, /^sign in$/i)
}

export async function registerAndLogin(page, prefix) {
  const user = testUser(prefix)
  await registerViaUI(page, user)
  await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {})
  await loginViaUI(page, user)
  await page.waitForURL(/\/(dashboard|markets)/, { timeout: 20000 })
  return user
}

// Rate-limit-aware auth: /login allows 20 attempts per 15 min per IP
// (production safeguard — never weakened for tests). UI login flows stay in
// the auth spec; all other specs authenticate once per file via the API and
// inject the httpOnly session cookie, keeping full-suite logins under 10.
const userCache = new Map()
export async function apiUser(request, prefix) {
  if (userCache.has(prefix)) return userCache.get(prefix)
  const user = testUser(prefix)
  const reg = await request.post(`${API}/user-api/register`, { data: user })
  if (reg.status() !== 201) throw new Error(`register failed: ${reg.status()} ${await reg.text()}`)
  const login = await request.post(`${API}/user-api/login`, {
    data: { email: user.email, password: user.password },
  })
  if (login.status() !== 200) throw new Error(`login failed: ${login.status()} ${await login.text()}`)
  const setCookies = (await login.headersArray())
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value)
  const token = /token=([^;]+)/.exec(setCookies.join('; '))?.[1]
  if (!token) throw new Error('no token cookie in login response')
  const entry = { user, headers: { Cookie: `token=${token}` }, token }
  userCache.set(prefix, entry)
  return entry
}

export async function gotoAuthenticated(page, entry, path) {
  await page.context().addCookies([{ name: 'token', value: entry.token, domain: 'localhost', path: '/' }])
  await page.goto(path)
}

// Fail a test on unexpected console errors / page exceptions. Expected
// failures from negative tests opt out by passing { allowConsoleErrors: true }
// and asserting the specific error instead. Signed-out 401 resource errors are
// benign (the app probes authenticated endpoints; the 401 interceptor ignores
// them when no session exists) and are filtered here.
export function collectPageErrors(page, errors, { ignore = [] } = {}) {
  const ignored = [/status of 401/, /GSI_LOGGER/, /status of 403/, ...ignore]
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (ignored.some((re) => re.test(text))) return // benign/environmental
    errors.push(`console: ${text.slice(0, 200)}`)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${String(err).slice(0, 200)}`))
}

export async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const de = document.documentElement
    return { scrollW: de.scrollWidth, clientW: de.clientWidth }
  })
  if (overflow.scrollW > overflow.clientW + 1) {
    throw new Error(`horizontal overflow: scrollWidth=${overflow.scrollW} clientWidth=${overflow.clientW} at ${page.url()}`)
  }
}
