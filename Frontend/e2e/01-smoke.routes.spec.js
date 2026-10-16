// Route smoke: every known route loads (or redirects to /login when
// protected), with no page exceptions, no horizontal overflow, and a
// screenshot per route for visual inspection.
import { test, expect } from '@playwright/test'
import { collectPageErrors, assertNoHorizontalOverflow } from './helpers'

const PUBLIC = [
  { path: '/', heading: /Practice with real prices/i },
  { path: '/about', heading: /About MarketForge/i },
  { path: '/features', heading: /What the product does/i },
  { path: '/login', heading: /Welcome back/i },
  { path: '/register', heading: /Create account/i },
]
const PROTECTED = [
  '/dashboard', '/markets', '/news', '/watchlist', '/portfolio',
  '/activity', '/analytics', '/accuracy', '/profile',
]

for (const { path, heading } of PUBLIC) {
  test(`public ${path} renders`, async ({ page }) => {
    const errors = []
    collectPageErrors(page, errors)
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 20000 })
    await assertNoHorizontalOverflow(page)
    const name = path === '/' ? 'home' : path.slice(1)
    await page.screenshot({ path: `test-results/shots/smoke-${name}.png`, fullPage: false })
    expect(errors, `page errors on ${path}: ${errors.join(' | ')}`).toEqual([])
  })
}

for (const path of PROTECTED) {
  test(`protected ${path} redirects to login when signed out`, async ({ page }) => {
    await page.goto(path)
    await page.waitForURL(/\/login/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible()
  })
}

test('unknown route renders 404', async ({ page }) => {
  await page.goto('/no-such-page-xyz')
  await expect(page.getByRole('heading', { name: /does not exist/i }).first()).toBeVisible({ timeout: 15000 })
})
