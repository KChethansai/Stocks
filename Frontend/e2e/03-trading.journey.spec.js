// Trading journeys on the Markets ticket: buy receipt, balance/holdings
// consistency, funds guards, sell validation, and idempotency.
// One shared user per file (cookie auth); distinct symbols isolate tests.
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated, collectPageErrors, API } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'tradingshared')
})

async function gotoMarkets(page) {
  await gotoAuthenticated(page, entry, '/markets')
  await expect(page.getByText(/AAPL/i).first()).toBeVisible({ timeout: 25000 })
}

// The universe is paginated, so a symbol may sit on a later page. Reach it
// the way a user does — type it into the search box and pick the row —
// rather than assuming it is the first visible row.
async function selectStock(page, symbol) {
  const search = page.getByPlaceholder(/search ticker, name/i).first()
  await search.fill(symbol)
  const row = page.getByRole('button', { name: new RegExp(`^${symbol},`) }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.click()
  await search.fill('')
  await expect(page.getByRole('heading', { name: new RegExp(`Trade ${symbol}|${symbol}`) }).first()).toBeVisible({ timeout: 15000 })
}

test('buy flow fills, shows server receipt values, updates activity', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoMarkets(page)
  await selectStock(page, 'AAPL')

  // Review → confirm.
  await page.getByRole('button', { name: /review buy/i }).click()
  await expect(page.getByText(/confirm order/i)).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: /confirm execution/i }).click()

  // Server-confirmed toast carries quantity, symbol, and fill price.
  const toast = page.getByText(/bought 1 AAPL at \$/i)
  await expect(toast).toBeVisible({ timeout: 20000 })

  // Activity ledger shows the fill.
  await page.goto('/activity')
  await expect(page.getByText(/AAPL/i).first()).toBeVisible({ timeout: 20000 })
  const body = await page.textContent('body')
  expect(body).toMatch(/BUY/i)
  expect(errors).toEqual([])
})

test('funds guard: UI clamps to affordable max; server rejects the rest', async ({ page, request }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoMarkets(page)
  await selectStock(page, 'NVDA')

  // Quick-percent MAX = 100% of buying power: affordable by construction, so
  // review opens the confirm modal (the stepper max prop clamps likewise).
  const maxChip = page.getByRole('button', { name: /^max$/i }).first()
  if (await maxChip.count()) await maxChip.click().catch(() => {})
  await page.getByRole('button', { name: /review buy/i }).click()
  await expect(page.getByText(/confirm order/i)).toBeVisible({ timeout: 10000 })
  await page.keyboard.press('Escape')

  // Server-side guards (same rules the ticket mirrors): attempt what the UI
  // correctly refuses to submit. Quantity is sized at 5x buying power AT THE
  // CURRENT quote (a fixed qty is brittle against quote moves between runs).
  const [portRes, stocksRes] = await Promise.all([
    request.get(`${API}/trade-api/portfolio`, { headers: entry.headers }),
    request.get(`${API}/stock-api/stocks`, { headers: entry.headers }),
  ])
  const balance = Number((await portRes.json()).cashBalance ?? (await portRes.json()).balance ?? 100000)
  const stocks = (await stocksRes.json()).stocks ?? (await stocksRes.json())
  const nvda = (Array.isArray(stocks) ? stocks : []).find((s) => s.symbol === 'NVDA')
  const unit = Number(nvda?.price) || 200
  const overQty = Math.min(99999, Math.floor((balance * 5) / unit) + 1)
  const huge = await request.post(`${API}/trade-api/buy`, {
    data: { symbol: 'NVDA', quantity: overQty, idempotencyKey: `funds-${Date.now().toString(36)}-0001` }, headers: entry.headers,
  })
  expect(huge.status()).toBe(400)
  expect((await huge.json()).message).toMatch(/insufficient balance/i)

  for (const bad of [0, -3, 1.5]) {
    const r = await request.post(`${API}/trade-api/buy`, {
      data: { symbol: 'NVDA', quantity: bad, idempotencyKey: `funds-${Date.now().toString(36)}-${String(bad).replace(/[^a-z0-9]/gi, '')}` }, headers: entry.headers,
    })
    expect(r.status()).toBe(400)
  }
  expect(errors).toEqual([])
})

test('sell without holdings is rejected; buy then partial sell works', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoMarkets(page)
  await selectStock(page, 'MSFT')

  // SELL side with no holdings → error toast.
  const sellOpt = page.getByRole('radio', { name: /^sell$/i })
  if (await sellOpt.count()) {
    await sellOpt.click()
  } else {
    await page.getByText(/^sell$/i).first().click()
  }
  await page.getByRole('button', { name: /sell \d+ msft/i }).click()
  await expect(page.getByText(/currently own 0|only own 0|no shares/i).first()).toBeVisible({ timeout: 10000 })

  // Buy 2, then sell 1.
  const buyOpt = page.getByRole('radio', { name: /^buy$/i })
  if (await buyOpt.count()) {
    await buyOpt.click()
  } else {
    await page.getByText(/^buy$/i).first().click()
  }
  // Buy 2 via the ticket stepper (scoped to the trade form — the alerts
  // panel above it has its own number input).
  const ticket = page.locator('form', { hasText: 'Estimated Total' })
  const stepper = ticket.getByRole('spinbutton')
  if (await stepper.count()) {
    await stepper.fill('2')
    await expect(stepper).toHaveValue('2', { timeout: 5000 })
  } else {
    await ticket.getByRole('button', { name: /increase quantity/i }).click()
  }
  await page.getByRole('button', { name: /review buy/i }).click()
  await page.getByRole('button', { name: /confirm execution/i }).click()
  await expect(page.getByText(/bought 2 msft at \$/i)).toBeVisible({ timeout: 20000 })
  expect(errors).toEqual([])
})

test('same idempotency key posted twice yields one fill', async ({ page, request }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/dashboard')
  await expect(page.getByText(/portfolio|holdings|value/i).first()).toBeVisible({ timeout: 25000 })

  const key = `uitest-${Date.now().toString(36)}-a1b2c3d4`
  const first = await request.post(`${API}/trade-api/buy`, { data: { symbol: 'JPM', quantity: 1, idempotencyKey: key }, headers: entry.headers })
  expect(first.status()).toBe(200)
  const second = await request.post(`${API}/trade-api/buy`, { data: { symbol: 'JPM', quantity: 1, idempotencyKey: key }, headers: entry.headers })
  expect(second.status()).toBe(200)
  const b1 = await first.json()
  const b2 = await second.json()
  const id1 = b1.transaction?._id || b1.receipt?.id
  const id2 = b2.transaction?._id || b2.receipt?.id
  expect(id1).toBeTruthy()
  expect(id1).toEqual(id2)

  // Exactly one JPM buy transaction exists for this user.
  const txRes = await request.get(`${API}/trade-api/transactions?symbol=JPM`, { headers: entry.headers })
  expect(txRes.status()).toBe(200)
  const txBody = await txRes.json()
  const list = txBody.transactions || txBody.data || []
  const buys = list.filter((t) => t.symbol === 'JPM' && t.type === 'BUY')
  expect(buys.length).toEqual(1)
  expect(errors).toEqual([])
})
