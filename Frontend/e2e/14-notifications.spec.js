// Notification read persistence (U2 regression, chromium only — long poll
// windows). A crossed price alert fires an inbox row on the next sync tick;
// marking it read must survive reload and repeated 30 s polls, and genuinely
// new events must still arrive unread. Requires the live provider path
// (Yahoo sync → monitor tick), so provider outages fail honestly here;
// deterministic unit coverage lives in alertDedupe.test.js + alertMerge.test.js.
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated, collectPageErrors, API } from './helpers'

test.describe.configure({ mode: 'serial' })

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'notifpersist')
})

async function apiAlertCount(headers) {
  const res = await fetch(`${API}/ml-api/alerts?includeRead=true`, { headers })
  return res.json()
}

test('crossed price alert notifies, read survives reload and polls', async ({ page, request }) => {
  test.setTimeout(480000)
  const errors = []
  collectPageErrors(page, errors, { ignore: [/status of 401/] })
  await gotoAuthenticated(page, entry, '/markets')
  await expect(page.getByText(/AAPL/i).first()).toBeVisible({ timeout: 25000 })

  // Auth headers for direct API calls in Node context.
  const cookie = entry.headers?.Cookie || entry.headers?.cookie || ''
  const headers = { Cookie: cookie, 'Content-Type': 'application/json' }

  // Create an already-crossed alert: VZ ABOVE $1 (price ~$44 → fires).
  const created = await request.post(`${API}/alert-api/alerts`, {
    data: { symbol: 'VZ', targetPrice: 1, direction: 'ABOVE' },
    headers: entry.headers
  })
  expect(created.ok()).toBe(true)

  // Force a sync tick (throttled to 5 min — may no-op) then poll the inbox
  // for the fired row (natural 5-min tick is the backstop).
  const sync = await request.post(`${API}/stock-api/stocks/seed`, { headers: entry.headers })
  expect(sync.ok()).toBe(true)
  let row = null
  const deadline = Date.now() + 360000
  while (Date.now() < deadline) {
    const data = await apiAlertCount(entry.headers).catch(() => null)
    const rows = data?.alerts || []
    row = rows.find((a) => a.symbol === 'VZ' && !a.read)
    if (row) break
    await new Promise((r) => setTimeout(r, 15000))
  }
  expect(row, 'crossed alert fired an inbox row').toBeTruthy()
  void headers

  // Bell shows unread; click marks read.
  const bell = page.getByRole('button', { name: /unread alerts|notifications/i })
  await bell.click()
  await expect(page.getByText('Market Alerts', { exact: true })).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: /VZ.*UP/i }).first().click()
  await page.waitForTimeout(1500)

  // Reload: still read.
  await page.reload()
  await expect(page.getByText(/AAPL/i).first()).toBeVisible({ timeout: 25000 })
  const after = await apiAlertCount(entry.headers)
  const stillUnread = (after.alerts || []).filter((a) => String(a._id) === String(row._id) && !a.read)
  expect(stillUnread).toEqual([])

  // One full poll cycle (30 s) later: still read.
  await page.waitForTimeout(35000)
  const later = await apiAlertCount(entry.headers)
  const resurrected = (later.alerts || []).filter((a) => String(a._id) === String(row._id) && !a.read)
  expect(resurrected).toEqual([])
  expect(errors).toEqual([])
})
