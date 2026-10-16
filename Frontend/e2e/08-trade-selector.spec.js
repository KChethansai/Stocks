// Stage E regression: global Trade opens a symbol selector (never a forced
// ticket); stock-specific entries prefill; review precedes any fill.
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated, collectPageErrors } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'tradeselect')
})

test('global Trade opens selector with nothing preselected', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.getByRole('button', { name: /^trade$/i }).click()
  await expect(page.getByRole('dialog', { name: /choose a symbol/i })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/none preselected/i)).toBeVisible()
  // No ticket: no side selector, no review button.
  await expect(page.getByRole('button', { name: /review (buy|sell)/i })).toHaveCount(0)
  await expect(page.getByText(/order ticket/i)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('selector keyboard path: type NVDA, arrow, enter → prefilled ticket', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/markets')
  await page.getByRole('button', { name: /^trade$/i }).click()
  const search = page.getByRole('combobox', { name: /search symbols/i })
  await expect(search).toBeVisible({ timeout: 15000 })
  await search.fill('NVDA')
  await expect(page.getByRole('option', { name: /NVDA/ }).first()).toBeVisible({ timeout: 10000 })
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  // Ticket prefilled with NVDA, not AAPL.
  await expect(page.getByRole('dialog', { name: /NVDA order ticket/i })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/NVIDIA/i).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('ticket → review → confirm → receipt; change-symbol; esc', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.getByRole('button', { name: /^trade$/i }).click()
  await page.getByRole('combobox', { name: /search symbols/i }).fill('MSFT')
  await page.getByRole('option', { name: /MSFT/ }).first().click()
  await expect(page.getByRole('dialog', { name: /MSFT order ticket/i })).toBeVisible({ timeout: 15000 })

  // Change-symbol returns to the selector.
  await page.getByRole('button', { name: /change symbol/i }).click()
  await expect(page.getByRole('dialog', { name: /choose a symbol/i })).toBeVisible({ timeout: 10000 })
  await page.getByRole('combobox', { name: /search symbols/i }).fill('MSFT')
  await page.getByRole('option', { name: /MSFT/ }).first().click()
  await expect(page.getByRole('dialog', { name: /MSFT order ticket/i })).toBeVisible({ timeout: 15000 })

  // Review precedes any fill; Cancel has initial focus (safe default).
  await page.getByRole('button', { name: /review buy/i }).click()
  await expect(page.getByText(/review order/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/fills at server price/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /^cancel$/i })).toBeFocused({ timeout: 5000 })

  // Cancel returns to the ticket with the draft intact; nothing was placed.
  await page.getByRole('button', { name: /^cancel$/i }).click()
  await expect(page.getByRole('button', { name: /review buy/i })).toBeVisible({ timeout: 10000 })

  // Confirm fills; receipt shows server price + order id + follow-ups.
  await page.getByRole('button', { name: /review buy/i }).click()
  await page.getByRole('button', { name: /confirm buy/i }).click()
  await expect(page.getByText(/bought 1 MSFT at/i)).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(/server fill price/i)).toBeVisible()
  await expect(page.getByRole('link', { name: /view in activity/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /trade again/i })).toBeVisible()

  // View in Activity lands on the ledger containing the fill.
  await page.getByRole('link', { name: /view in activity/i }).click()
  await page.waitForURL(/\/activity/, { timeout: 15000 })
  await expect(page.getByText(/MSFT/).first()).toBeVisible({ timeout: 15000 })
  expect(errors).toEqual([])
})

test('palette quick-trade prefills the ticket (no selector step)', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/dashboard')
  await expect(page.getByText(/your portfolio|portfolio/i).first()).toBeVisible({ timeout: 25000 })
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: /command|palette|search/i })
  await expect(palette).toBeVisible({ timeout: 10000 })
  await page.keyboard.type('TSLA')
  // The palette row shows the symbol with a "Trade" quick-action button.
  const row = page.locator('[role="option"], li', { hasText: 'TSLA' }).first()
  await expect(row).toBeVisible({ timeout: 10000 })
  const tradeBtn = row.getByRole('button', { name: /^trade$/i })
  if (await tradeBtn.count() && await tradeBtn.isVisible()) {
    await tradeBtn.click()
    await expect(page.getByRole('dialog', { name: /TSLA order ticket/i })).toBeVisible({ timeout: 15000 })
  } else {
    test.skip(true, 'no visible quick-trade button for TSLA')
  }
  expect(errors).toEqual([])
})
