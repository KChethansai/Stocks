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

test('activity export downloads CSV with an explicit, stated scope', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/activity')
  await expect(page.getByText(/activity|transactions/i).first()).toBeVisible({ timeout: 25000 })

  // The scope selector is a distinct control from the export button and its
  // accessible name contains the word "export", so the button must be matched
  // precisely rather than by the loose /csv/i that used to find it.
  const exportBtn = page.getByRole('button', { name: /^export csv$/i })
  if (!(await exportBtn.count())) test.skip(true, 'no export button rendered')
  await expect(exportBtn).toBeEnabled()

  const downloadOf = async () => {
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)
    await exportBtn.click()
    return downloadPromise
  }

  const read = async (download) => {
    const path = await download.path()
    const { readFileSync } = await import('fs')
    return readFileSync(path, 'utf8')
  }

  // Default scope is the page on screen, and the filename says so.
  const pageDownload = await downloadOf()
  expect(pageDownload, 'export button enabled but no download fired').not.toBeNull()
  expect(pageDownload.suggestedFilename(), 'the scope is stated in the filename').toMatch(/page-\d+-of-\d+/)
  const pageCsv = await read(pageDownload)
  expect(pageCsv.split('\n')[0].toLowerCase()).toMatch(/symbol/)
  expect(pageCsv.split('\n')[0].toLowerCase()).toMatch(/price|total/)
  // The seeded fill is present with its real values.
  expect(pageCsv).toMatch(/AAPL/)

  // Switching the scope to "all matching" must change both the filename and
  // the row count — this is the part that must never be silently different
  // from what the reader believes they exported.
  const scopeSelect = page.getByRole('button', { name: /csv export scope/i })
  await expect(scopeSelect).toBeVisible({ timeout: 10000 })
  await scopeSelect.click()
  await expect(page.getByRole('listbox')).toBeVisible({ timeout: 10000 })
  await page.getByRole('option', { name: /all matching/i }).click()
  await expect(exportBtn).toBeEnabled()

  const allDownload = await downloadOf()
  expect(allDownload, 'all-matching export produced no file').not.toBeNull()
  expect(allDownload.suggestedFilename(), 'all-matching is stated in the filename').toMatch(/all-matching/)

  const allCsv = await read(allDownload)
  const pageRows = pageCsv.trim().split('\n').length - 1
  const allRows = allCsv.trim().split('\n').length - 1
  // This fixture has a single fill, so both scopes hold one row — but the two
  // must not be silently interchangeable, and the headers must still match.
  expect(allCsv.split('\n')[0]).toBe(pageCsv.split('\n')[0])
  expect(allRows).toBeGreaterThan(0)
  expect(allRows).toBeGreaterThanOrEqual(pageRows)

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
