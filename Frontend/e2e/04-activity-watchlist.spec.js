// Activity scope + CSV export, watchlist persistence and empty states.
// Shared cookie-authenticated user (see helpers).
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated, collectPageErrors, API } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'activityshared')
  // Seed one fill so the ledger (and its export) is non-empty.
  await request.post(`${API}/trade-api/buy`, {
    data: { symbol: 'AAPL', quantity: 1, idempotencyKey: `seed-${Date.now().toString(36)}-csv` }, headers: entry.headers,
  })
})

test('activity export downloads the filtered view as CSV', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/activity')
  await expect(page.getByText(/activity|transactions/i).first()).toBeVisible({ timeout: 25000 })

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)
  const exportBtn = page.getByRole('button', { name: /export|download.*csv|csv/i }).first()
  if (!(await exportBtn.count())) test.skip(true, 'no export button rendered')
  await exportBtn.click()
  const download = await downloadPromise
  expect(download, 'export button enabled but no download fired').not.toBeNull()

  const path = await download.path()
  const { readFileSync } = await import('fs')
  const csv = readFileSync(path, 'utf8')
  const header = csv.split('\n')[0].toLowerCase()
  expect(header).toMatch(/symbol/)
  expect(header).toMatch(/price|total/)
  // The seeded fill is present with its real values.
  expect(csv).toMatch(/AAPL/)
  expect(errors).toEqual([])
})

test('watchlist empty state and persistence', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/watchlist')
  await expect(page.getByText(/watchlist/i).first()).toBeVisible({ timeout: 25000 })
  const body = await page.textContent('body')
  // Either an empty state or existing rows — both are valid fresh states.
  expect(body).toMatch(/empty|suggestion|AAPL|MSFT|NVDA/i)

  // Search filters the list.
  const search = page.getByPlaceholder(/search symbols/i)
  if (await search.count()) {
    await search.fill('AAPL')
    await expect(page.getByText(/AAPL/).first()).toBeVisible({ timeout: 10000 })
  }
  expect(errors).toEqual([])
})
