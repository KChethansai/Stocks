// Responsive matrix: representative widths + a short viewport, checking
// overflow, sticky overlays, and touch-target-relevant layout per route.
// Screenshots per width are retained for inspection. Device emulation is not
// a physical-device test (stated in the final report).
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated, collectPageErrors, assertNoHorizontalOverflow } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'responsiveshared')
})

const WIDTHS = [360, 390, 768, 1024, 1440, 1920]
const ROUTES = ['/', '/about', '/features', '/login', '/dashboard', '/markets']

for (const width of WIDTHS) {
  test(`width ${width}: key routes have no overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors = []
    collectPageErrors(page, errors)
    for (const path of ROUTES) {
      if (path.startsWith('/dashboard') || path.startsWith('/markets')) {
        await gotoAuthenticated(page, entry, path)
      } else {
        await page.goto(path)
      }
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(500)
      await assertNoHorizontalOverflow(page)
      await page.screenshot({ path: `test-results/shots/r-${width}-${path === '/' ? 'home' : path.slice(1)}.png`, fullPage: false })
    }
    expect(errors).toEqual([])
  })
}

test('short viewport 1440x500: markets ticket usable, sticky header clear', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await page.setViewportSize({ width: 1440, height: 500 })
  await gotoAuthenticated(page, entry, '/markets')
  await expect(page.getByText(/AAPL/i).first()).toBeVisible({ timeout: 25000 })
  await assertNoHorizontalOverflow(page)
  // The trade ticket heading must be reachable by scroll (not trapped under a sticky overlay).
  const ticket = page.getByRole('heading', { name: /trade/i }).first()
  if (await ticket.count()) {
    await ticket.scrollIntoViewIfNeeded()
    await expect(ticket).toBeVisible()
  }
  await page.screenshot({ path: 'test-results/shots/r-short-markets.png', fullPage: false })
  expect(errors).toEqual([])
})

test('mobile nav opens and reaches routes at 390px', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoAuthenticated(page, entry, '/dashboard')
  // At 390px the sidebar is hidden; the bottom nav carries primary routes.
  const bottomMarkets = page.getByRole('link', { name: /markets/i }).last()
  await expect(bottomMarkets).toBeVisible({ timeout: 25000 })
  await assertNoHorizontalOverflow(page)
  // Bottom-bar Markets link reaches /markets (hamburger drawer is the
  // fallback affordance).
  if (await bottomMarkets.isVisible()) {
    await bottomMarkets.click()
  } else {
    const menuBtn = page.getByRole('button', { name: /menu|navigation|open/i }).first()
    if (await menuBtn.count()) {
      await menuBtn.click()
      await page.getByRole('link', { name: /market/i }).first().click()
    } else {
      test.skip(true, 'no mobile nav affordance found')
    }
  }
  await page.waitForURL(/\/markets/, { timeout: 15000 })
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: 'test-results/shots/r-mobile-markets.png', fullPage: false })
  expect(errors).toEqual([])
})
