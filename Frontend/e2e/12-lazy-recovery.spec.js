// Lazy-chunk failure recovery (Oct 2026 launch validation).
// Guards the two concrete defects found by failure injection:
//   1. A failed route chunk must render the leaf RouteError UI (reload +
//      home recovery, role=alert, no dev-default page) — never a blank app.
//   2. A failed landing-section chunk must stay contained to that section
//      (rest of landing alive, Try again then Reload offered) — never a
//      whole-page error.
// Chunk blocking via route.abort is deterministic (not timing-dependent);
// recovery is verified by unblocking + reloading.
import { test, expect } from '@playwright/test'

test('failed route chunk shows recovery UI and reload recovers', async ({ page }) => {
  let hits = 0
  await page.route('**/components/Login.jsx*', (route) => { hits += 1; route.abort('failed') })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /didn.t load/i })).toBeVisible({ timeout: 20000 })
  // Bounded retries: 1 initial + 2 retries max, then the error must surface
  // with no request loop.
  await page.waitForTimeout(6000)
  expect(hits).toBeLessThanOrEqual(3)
  const settled = hits
  await page.waitForTimeout(4000)
  expect(hits).toBe(settled)
  // Understandable + accessible, no developer-default leak.
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: /reload page/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /back to home/i })).toBeVisible()
  expect(await page.evaluate(() => document.body.innerText.includes('Hey developer'))).toBe(false)
  // Recovery: unblock + reload renders login (no poisoned module cache).
  await page.unroute('**/components/Login.jsx*')
  await page.reload()
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 20000 })
})

test('failed landing section stays contained with two-tier recovery', async ({ page }) => {
  await page.route('**/landing-new/S06Analytics.jsx*', (route) => route.abort('failed'))
  await page.goto('/')
  await page.waitForTimeout(4000)
  await page.locator('#analytics').scrollIntoViewIfNeeded()
  await expect(page.getByRole('alert').filter({ hasText: /didn.t load/i }).first()).toBeVisible({ timeout: 20000 })
  // Rest of the landing is alive (hero present, no whole-page error).
  expect(await page.evaluate(() => (document.querySelector('h1')?.textContent || '').length > 5)).toBe(true)
  expect(await page.evaluate(() => document.body.innerText.startsWith('Unexpected Application Error'))).toBe(false)
  // Tier 1 (Try again) against a still-blocked URL fails fast from the
  // module cache without looping or harming the page, then offers reload.
  await page.getByRole('button', { name: /try again/i }).click()
  await expect(page.getByRole('button', { name: /reload page/i })).toBeVisible({ timeout: 20000 })
  expect(await page.evaluate(() => (document.querySelector('h1')?.textContent || '').length > 5)).toBe(true)
  // Tier 2: unblock + reload recovers the section for real.
  await page.unroute('**/landing-new/S06Analytics.jsx*')
  await page.reload()
  await page.waitForTimeout(4000)
  await page.locator('#analytics').scrollIntoViewIfNeeded()
  await expect(page.getByText(/performance with context/i)).toBeVisible({ timeout: 20000 })
})
