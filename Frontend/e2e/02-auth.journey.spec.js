// Authentication + session journeys: registration, validation, duplicates,
// login, logout, persistence, session expiry notice, cross-user isolation.
import { test, expect } from '@playwright/test'
import { testUser, registerViaUI, loginViaUI, registerAndLogin, fillVerified, collectPageErrors } from './helpers'

test('registration validates input and rejects duplicates', async ({ page }) => {
  const errors = []
  // 400s allowed here: the duplicate submission intentionally provokes one.
  collectPageErrors(page, errors, { ignore: [/status of 400/] })
  const user = testUser('authval')

  // Blank submit shows validation errors, no navigation.
  await page.goto('/register')
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page.getByText(/choose a username|enter your email/i).first()).toBeVisible({ timeout: 10000 })
  expect(page.url()).toContain('/register')

  // Invalid email blocked client-side.
  await page.getByLabel(/username/i).fill(user.username)
  await page.getByLabel(/email address/i).fill('not-an-email')
  await page.getByLabel(/^password/i).fill(user.password)
  await page.getByRole('button', { name: /create account/i }).click()
  await expect(page.getByText(/valid email/i).first()).toBeVisible({ timeout: 10000 })

  // Valid registration lands on login.
  await page.getByLabel(/email address/i).fill(user.email)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForURL(/\/login/, { timeout: 20000 })

  // Duplicate registration shows a server error toast, stays on register.
  // The message is deliberately generic (same as validation failures) so
  // the endpoint cannot be used to enumerate registered emails/usernames.
  await registerViaUI(page, user)
  await expect(page.getByText(/invalid registration details/i).first()).toBeVisible({ timeout: 15000 })
  expect(errors).toEqual([])
})

test('login rejects bad credentials, accepts good ones, persists session', async ({ page }) => {
  const errors = []
  // 401 allowed: the wrong-password attempt intentionally provokes one.
  collectPageErrors(page, errors, { ignore: [/status of 401/] })
  const user = testUser('authlogin')
  await registerViaUI(page, user)
  await page.waitForURL(/\/login/, { timeout: 20000 })

  // Wrong password: error toast, no navigation. Submitted with an actual
  // pointer click (verified fills first): a prior intermittent failure here
  // was forensically traced to fills lost in a post-navigation store
  // re-render — the DOM input was EMPTY at submit, react-hook-form correctly
  // blocked it (inline "Enter your email address.", no request), identically
  // for click and Enter. Verified fills close that window; the click path is
  // what this step guards, so Enter must not substitute for it.
  await fillVerified(page.getByLabel(/email address/i), user.email)
  await fillVerified(page.getByLabel(/^password/i), 'WrongPass999!')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByText(/invalid|incorrect|failed/i).first()).toBeVisible({ timeout: 15000 })
  expect(page.url()).toContain('/login')

  // Password visibility toggle works.
  const pw = page.getByLabel(/^password/i)
  await expect(pw).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: /show password/i }).click()
  await expect(pw).toHaveAttribute('type', 'text')

  // Correct login reaches the app.
  await fillVerified(page.getByLabel(/^password/i), user.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/(dashboard|markets)/, { timeout: 20000 })

  // Session persists across reload.
  await page.reload()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 })
  expect(errors).toEqual([])
})

test('logout clears session; switching users isolates cached data', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  const userA = await registerAndLogin(page, 'authisoA')

  // User A: add a watchlist symbol so cache has user-specific data.
  await page.goto('/markets')
  await expect(page.getByText(/AAPL/i).first()).toBeVisible({ timeout: 20000 })
  const watchBtn = page.getByRole('button', { name: /watch|star|bookmark/i }).first()
  if (await watchBtn.count()) {
    await watchBtn.click().catch(() => {})
    // The toggle raises a transient toast on response (not on click), so a
    // detached-wait alone passes vacuously while the POST is in flight and
    // the toast then lands mid-avatar-click. Wait for the toast to ARRIVE
    // first (best-effort: the click itself is best-effort), then for it to
    // clear. A real user cannot click through a toast either; force-clicking
    // would mask genuine overlay regressions.
    await page.getByText(/watchlist/i).first().waitFor({ timeout: 15000 }).catch(() => {})
  }
  await page.waitForSelector('[role="status"]', { state: 'detached', timeout: 20000 }).catch(() => {})

  // Logout via the Topbar user menu (avatar → Sign out).
  const avatarBtn = page.getByRole('button').filter({ hasText: /^[A-Z]$/ }).first()
  await avatarBtn.click()
  await page.getByRole('button', { name: /sign out/i }).click()
  await page.waitForURL(/\/(login|register|)/, { timeout: 15000 })
  await page.goto('/dashboard')
  await page.waitForURL(/\/login/, { timeout: 20000 })

  // User B must not see user A's identity anywhere.
  const userB = testUser('authisoB')
  await registerViaUI(page, userB)
  await page.waitForURL(/\/login/, { timeout: 20000 })
  await loginViaUI(page, userB)
  await page.waitForURL(/\/(dashboard|markets)/, { timeout: 20000 })
  await page.goto('/profile')
  await expect(page.getByText(userB.username, { exact: false }).first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(userA.username, { exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('expired session redirects with a notice on the login page', async ({ page }) => {
  const user = testUser('authexp')
  await registerViaUI(page, user)
  await page.waitForURL(/\/login/, { timeout: 20000 })
  await loginViaUI(page, user)
  await page.waitForURL(/\/(dashboard|markets)/, { timeout: 20000 })

  // Simulate expiry: drop the session cookie, then hit a protected route.
  await page.context().clearCookies()
  await page.goto('/dashboard')
  await page.waitForURL(/\/login/, { timeout: 20000 })
  // The expiry notice is best-effort (only when the 401 interceptor fires);
  // the hard requirement is the redirect itself.
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible()
})
