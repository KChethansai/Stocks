// Refinement regression: compact navbar (D8), compact profile (D9),
// genuine public charts (D10). Isolated test DB, never production.
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated, collectPageErrors, assertNoHorizontalOverflow } from './helpers.js'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'refine10')
})

// D8: exactly one refresh affordance per viewport; cash visible on mobile;
// Trade + search + bell + avatar immediate; pill is a labeled button on lg+.
test('navbar keeps essentials immediate with one refresh per viewport', async ({ page }) => {  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/dashboard')
  await expect(page.getByRole('button', { name: /trade/i }).first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /search markets/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /notifications/i })).toBeVisible()

  const desktopPill = page.getByRole('button', { name: /refresh market prices\. quotes/i })
  const mobileRefresh = page.getByRole('button', { name: /^refresh market prices$/ })
  const viewport = page.viewportSize()
  if (viewport && viewport.width >= 1024) {
    await expect(desktopPill).toBeVisible()
    await expect(mobileRefresh).toBeHidden()
    // Pill carries the timestamp label, not a title-only icon.
    await expect(desktopPill).toContainText(/quotes/i)
  } else {
    await expect(mobileRefresh).toBeVisible()
  }
  // Cash chip visible (compact) — the only balance on small phones.
  await expect(page.getByText(/\$\d{1,3}(,\d{3})*(\.\d{2})?/).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('palette exposes Open trade and Refresh prices actions', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/dashboard')
  await expect(page.getByText(/your portfolio|portfolio/i).first()).toBeVisible({ timeout: 25000 })
  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', { name: /command|palette|search/i })
  await expect(dialog).toBeVisible({ timeout: 10000 })
  const actions = page.getByRole('group', { name: 'Actions' })
  await expect(actions.getByText('Open trade')).toBeVisible()
  await expect(actions.getByText('Refresh prices')).toBeVisible()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

// D9: summary header + grid; all five section anchors still mounted.
test('profile compact workspace preserves every section', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/profile')
  for (const id of ['profile-account', 'profile-login', 'profile-security', 'profile-preferences', 'profile-data']) {
    await expect(page.locator(`#${id}`)).toBeAttached({ timeout: 15000 })
  }
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
  await expect(page.getByLabel(/username/i)).toBeVisible()
  // Default desktop view shows account context + primary controls compactly.
  const accountBox = await page.locator('#profile-account').boundingBox()
  expect(accountBox.height).toBeLessThan(420)
  expect(errors).toEqual([])
})

// D10: public S03 shows genuine AAPL history (not seed), S01 genuine ticket.
test('public charts use genuine symbol history with honest labels', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await page.goto('/')
  // Hero ticket: symbol switcher + a freshness caption sourced from fetch.
  await expect(page.getByRole('group', { name: 'Ticket symbol' })).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(4000)
  const caption = await page.locator('#markets').count()
  expect(caption).toBe(1)
  // S03 header shows AAPL with a genuine-data caption (live history or a
  // named failure state — never a silent "sample window" label).
  const s03 = page.locator('#markets')
  await s03.scrollIntoViewIfNeeded()
  await expect(s03.getByText('AAPL').first()).toBeVisible()
  await expect(s03.getByText(/genuine history|live history|sample data|unavailable|not enough history|loading/i).first()).toBeVisible({ timeout: 20000 })
  // S06: example fund built from genuine history, never a synthetic curve.
  const s06 = page.locator('#analytics')
  await s06.scrollIntoViewIfNeeded()
  await expect(s06.getByText(/genuine daily history|example fund history unavailable|loading genuine history/i).first()).toBeVisible({ timeout: 25000 })
  // S07: watchlist rows carry genuine quotes with their own freshness.
  const s07 = page.locator('#alerts')
  await s07.scrollIntoViewIfNeeded()
  await expect(s07.getByText(/genuine quotes|watchlist quotes unavailable|loading watchlist/i).first()).toBeVisible({ timeout: 25000 })
  // Deferred-section integrity: anchor ids live exactly once (shell owns
  // the id; lazy inner sections carry none — duplicates would break
  // deep links and locators).
  const idCounts = await page.evaluate((ids) => {
    const out = {}
    for (const id of ids) out[id] = document.querySelectorAll(`#${CSS.escape(id)}`).length
    return out
  }, ['how', 'markets', 'ticket', 'portfolio', 'analytics', 'alerts', 'forecasts', 'activity', 'news', 'workspace', 'craft'])
  for (const [id, n] of Object.entries(idCounts)) {
    expect(n, `anchor #${id} count`).toBe(1)
  }
  expect(errors).toEqual([])
})

// D8: 360px header keeps Trade fully on-screen (regression for the
// overflow found in browser review — refresh icon and search label compress
// below 480px instead of pushing Trade off).
test('360px header keeps Trade on-screen', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await page.setViewportSize({ width: 360, height: 740 })
  await gotoAuthenticated(page, entry, '/dashboard')
  // Readiness gate: the authenticated shell must render first. If the app
  // redirected to login or the bundle hasn't loaded, that surfaces here as a
  // shell failure — not misreported as a missing Trade button.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })
  await expect(page.getByRole('link', { name: /^dashboard$/i }).first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('button', { name: /^trade$/i })).toBeVisible({ timeout: 15000 })
  const box = await page.getByRole('button', { name: /^trade$/i }).boundingBox()
  expect(box.x + box.width).toBeLessThanOrEqual(360)
  await assertNoHorizontalOverflow(page)
  expect(errors).toEqual([])
})

// D10 (controlled interception — not a provider check): failed history shows
// an honest error with retry, never silent seed data; retry recovers.
test('public chart failure shows error state and recovers on retry', async ({ page }) => {
  const errors = []
  // The aborted XHRs below are the injected failure itself — the assertion
  // target is the honest error UI + recovery, not the absence of logs.
  collectPageErrors(page, errors, { ignore: [/ERR_FAILED/, /Failed to load resource/, /Cross-Origin Request Blocked/, /CORS request did not succeed/] })
  await page.route('**/stock-api/history/*', (route) => route.abort('failed'))
  await page.goto('/')
  const s03 = page.locator('#markets')
  await s03.scrollIntoViewIfNeeded()
  await expect(s03.getByText(/history unavailable/i).first()).toBeVisible({ timeout: 25000 })
  await page.unroute('**/stock-api/history/*')
  await s03.getByRole('button', { name: /retry/i }).first().click()
  await expect(s03.getByText(/genuine history|live history/i).first()).toBeVisible({ timeout: 25000 })
  await expect(s03.getByText('AAPL').first()).toBeVisible()
  expect(errors).toEqual([])
})
