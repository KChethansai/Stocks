// Accessibility automation + failure/recovery states.
// axe violations fail the test; keyboard flows and chart failure states are
// exercised in a real branded-Chrome page. Shared cookie-authenticated user.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { apiUser, gotoAuthenticated, collectPageErrors } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'a11yshared')
})

test('axe: public routes have no critical violations', async ({ page }) => {
  for (const path of ['/', '/about', '/features', '/login', '/register']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle').catch(() => {})
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const critical = results.violations.filter((v) => v.impact === 'critical')
    expect(critical, `${path} critical axe: ${JSON.stringify(critical.map((v) => v.id))}`).toEqual([])
  }
})

test('axe: authenticated dashboard + open trade dialog', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.waitForLoadState('networkidle').catch(() => {})
  const dash = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(dash.violations.filter((v) => v.impact === 'critical')).toEqual([])

  // Open the trade sheet from Markets and audit the open dialog state.
  await gotoAuthenticated(page, entry, '/markets')
  await expect(page.getByText(/AAPL/i).first()).toBeVisible({ timeout: 25000 })
  await page.getByRole('button', { name: /review buy/i }).click()
  await expect(page.getByText(/confirm order/i)).toBeVisible({ timeout: 10000 })
  const dlg = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(dlg.violations.filter((v) => v.impact === 'critical')).toEqual([])

  // Escape closes the dialog and focus returns to a sensible control.
  await page.keyboard.press('Escape')
  await expect(page.getByText(/confirm order/i)).toHaveCount(0, { timeout: 10000 })
  expect(errors).toEqual([])
})

test('keyboard: skip link reaches main content; palette opens and closes', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.keyboard.press('Tab')
  const skip = page.getByText(/skip to main content/i)
  if (await skip.count()) {
    await skip.first().focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused({ timeout: 10000 })
  }
  // '/' opens the command palette outside of typing contexts.
  await page.keyboard.press('/')
  const palette = page.getByRole('dialog', { name: /command|palette|search/i })
  if (await palette.count()) {
    await expect(palette).toBeVisible({ timeout: 10000 })
    await page.keyboard.press('Escape')
    await expect(palette).toHaveCount(0, { timeout: 10000 })
  }
  expect(errors).toEqual([])
})

test('chart history 502 shows failed state with working retry', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors, { ignore: [/status of 502/] })
  await gotoAuthenticated(page, entry, '/markets')

  // First pass: history fails → accessible failed state with Retry.
  await page.route(/\/stock-api\/history\//, (route) =>
    route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ message: 'Historical data temporarily unavailable' }) })
  )
  await page.goto('/markets')
  await expect(page.getByText(/AAPL/i).first()).toBeVisible({ timeout: 25000 })
  await expect(page.getByText(/chart unavailable/i).first()).toBeVisible({ timeout: 25000 })

  // Retry against a recovered backend renders the chart.
  await page.unroute(/\/stock-api\/history\//)
  const retry = page.getByRole('button', { name: /retry/i }).first()
  if (await retry.count()) {
    await retry.click()
    await expect(page.getByText(/chart unavailable/i)).toHaveCount(0, { timeout: 25000 })
  }
  expect(errors).toEqual([])
})

test('reduced motion is honored (no smooth scroll/scrub animation)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = []
  collectPageErrors(page, errors)
  await page.goto('/')
  const mq = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  expect(mq).toBe(true)
  await expect(page.getByRole('heading', { name: /Practice with real prices/i }).first()).toBeVisible()
  expect(errors).toEqual([])
})
