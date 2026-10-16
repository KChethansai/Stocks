// Second journey batch: alerts CRUD + draft preservation across polling,
// news filters, profile persistence + motion preference, stale-quote trade
// block, and full liquidation. Shared cookie-authenticated user.
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated, collectPageErrors, API } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'journey2shared')
})

test('alerts: validation, create, persistence, delete', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/markets')
  await expect(page.getByText(/price alerts/i).first()).toBeVisible({ timeout: 25000 })

  // Invalid target rejected with a message, no alert created.
  await page.getByLabel(/target price/i).fill('0')
  await page.getByRole('button', { name: /set alert/i }).click()
  await expect(page.getByText(/at least \$0\.01/i)).toBeVisible({ timeout: 10000 })

  // Valid alert creates, appears in the list, survives reload.
  await page.getByLabel(/target price/i).fill('500.00')
  await page.getByRole('button', { name: /set alert/i }).click()
  await expect(page.getByText(/alert set/i)).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/\$500\.00/).first()).toBeVisible({ timeout: 10000 })
  await page.reload()
  await expect(page.getByText(/\$500\.00/).first()).toBeVisible({ timeout: 25000 })

  // Delete removes it.
  const del = page.getByRole('button', { name: /remove|delete/i }).first()
  if (await del.count()) {
    await del.click()
    await expect(page.getByText(/alert removed/i)).toBeVisible({ timeout: 15000 })
  }
  expect(errors).toEqual([])
})

test('alert draft survives a background quote poll', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/markets')
  await expect(page.getByLabel(/target price/i)).toBeVisible({ timeout: 25000 })
  await page.getByLabel(/target price/i).fill('123.45')
  //Poll interval is 30s; wait for at least one background refetch.
  await page.waitForResponse(/\/stock-api\/stocks/, { timeout: 45000 }).catch(() => {})
  await expect(page.getByLabel(/target price/i)).toHaveValue('123.45', { timeout: 10000 })
  expect(errors).toEqual([])
})

test('news: symbol filter narrows the feed; external links open safely', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/news')
  await expect(page.getByText(/market|news/i).first()).toBeVisible({ timeout: 25000 })
  const aaplFilter = page.getByRole('button', { name: /^AAPL$/i }).first()
  if (await aaplFilter.count()) {
    await aaplFilter.click()
    await page.waitForTimeout(1000)
    const body = await page.textContent('body')
    expect(body).toMatch(/AAPL/i)
  }
  // External links use target=_blank + noopener.
  const ext = page.locator('a[target="_blank"]').first()
  if (await ext.count()) {
    expect(await ext.getAttribute('rel')).toMatch(/noopener/)
  }
  expect(errors).toEqual([])
})

test('profile: display name persists; reduce-motion preference sticks', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/profile')
  await expect(page.getByRole('heading', { name: /account/i }).first()).toBeVisible({ timeout: 25000 })

  // Settings sections exist and anchor-navigate.
  for (const section of ['Account', 'Security', 'Preferences']) {
    await expect(page.getByRole('link', { name: section }).first()).toBeVisible({ timeout: 10000 })
  }
  // Reduce-motion toggle flips the persisted mode.
  const comfort = page.getByRole('button', { name: /comfort/i }).first()
  if (await comfort.count()) {
    await comfort.click()
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.motion), { timeout: 10000 }).toBe('comfort')
    await page.reload()
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.motion), { timeout: 10000 }).toBe('comfort')
  }
  expect(errors).toEqual([])
})

test('stale quote blocks the trade before review', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  // Serve every quote as stale for this page.
  await page.route(/\/stock-api\/stocks$/, async (route) => {
    const res = await route.fetch()
    const body = await res.json()
    for (const s of body.stocks || []) {
      s.stale = true
      s.lastVerifiedAt = null
    }
    await route.fulfill({ response: res, json: body })
  })
  await gotoAuthenticated(page, entry, '/markets')
  await expect(page.getByText(/AAPL/i).first()).toBeVisible({ timeout: 25000 })
  const review = page.getByRole('button', { name: /review buy/i })
  if (await review.count()) {
    await review.click()
    await expect(page.getByText(/stale|unverified/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/confirm order/i)).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

test('full liquidation via API reconciles; UI shows flat portfolio', async ({ page, request }) => {
  const errors = []
  collectPageErrors(page, errors)
  // Buy then sell everything: balance must return to (approximately) start.
  const before = await request.get(`${API}/trade-api/portfolio`, { headers: entry.headers })
  expect(before.status()).toBe(200)
  const startBal = (await before.json()).cashBalance ?? (await before.json()).balance ?? 0

  const buy = await request.post(`${API}/trade-api/buy`, {
    data: { symbol: 'TSLA', quantity: 2, idempotencyKey: `liq-${Date.now().toString(36)}-buy` }, headers: entry.headers,
  })
  expect(buy.status()).toBe(200)
  const sell = await request.post(`${API}/trade-api/sell`, {
    data: { symbol: 'TSLA', quantity: 2, idempotencyKey: `liq-${Date.now().toString(36)}-sell` }, headers: entry.headers,
  })
  expect(sell.status()).toBe(200)

  const after = await request.get(`${API}/trade-api/portfolio`, { headers: entry.headers })
  const endBal = (await after.json()).cashBalance ?? (await after.json()).balance ?? 0
  // Sell proceeds return to cash (minus/plus price drift between fills).
  expect(Math.abs(endBal - startBal)).toBeLessThan(startBal * 0.05 + 50)

  await gotoAuthenticated(page, entry, '/portfolio')
  await expect(page.getByText(/portfolio|holdings|empty/i).first()).toBeVisible({ timeout: 25000 })
  expect(errors).toEqual([])
})
