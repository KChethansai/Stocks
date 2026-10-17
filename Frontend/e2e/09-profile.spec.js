// Stage G regression: profile workspace persistence, validation, data links.
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated, collectPageErrors } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'profileshared')
})

test('profile renders workspace without fabricated badges', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/profile')
  await expect(page.getByRole('heading', { name: /profile/i }).first()).toBeVisible({ timeout: 25000 })
  for (const section of ['Account', 'Login details', 'Security', 'Data & activity']) {
    await expect(page.getByRole('heading', { name: section }).first()).toBeVisible({ timeout: 10000 })
  }
  // Removed by request (Oct 2026): internal section nav + Preferences card.
  await expect(page.getByRole('link', { name: /^Preferences$/ })).toHaveCount(0)
  await expect(page.getByRole('group', { name: /profile sections/i })).toHaveCount(0)
  await expect(page.getByText(/verified/i)).toHaveCount(0)
  await expect(page.getByText(/upload photo|change photo/i).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('login details: validation then real save + reload persistence', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/profile')
  const name = page.getByLabel(/username/i)
  await expect(name).toBeVisible({ timeout: 25000 })

  // Invalid: too short.
  await name.fill('ab')
  await page.getByRole('button', { name: /save login details/i }).click()
  await expect(page.getByText(/3–30 characters/i)).toBeVisible({ timeout: 10000 })

  // Valid save persists across reload.
  const fresh = `prof${Date.now().toString(36)}`
  await name.fill(fresh)
  await page.getByRole('button', { name: /save login details/i }).click()
  await expect(page.getByText(/login details saved/i).first()).toBeVisible({ timeout: 15000 })
  await page.reload()
  await expect(page.getByLabel(/username/i)).toHaveValue(fresh, { timeout: 25000 })
  expect(errors).toEqual([])
})

test('duplicate username maps to the field, not a bare toast', async ({ page, request }) => {
  const errors = []
  collectPageErrors(page, errors)
  // Second user, then try to take the first user's CURRENT name (it may have
  // been renamed by the persistence test — read it from the API).
  const other = await apiUser(request, 'profileother')
  const prof = await request.get('http://localhost:4101/user-api/profile', { headers: entry.headers })
  const currentName = (await prof.json()).user.username
  await gotoAuthenticated(page, other, '/profile')
  await expect(page.getByLabel(/username/i)).toBeVisible({ timeout: 25000 })
  await page.getByLabel(/username/i).fill(currentName)
  await page.getByRole('button', { name: /save login details/i }).click()
  await expect(page.getByText(/already exists/i).first()).toBeVisible({ timeout: 15000 })
  // The server rejects with 400 — that rejection is the expected behavior
  // under test (proves the uniqueness guard), not a stray app error. Chrome
  // logs the failed XHR to console, Firefox does not, so only assert that no
  // NON-400 error occurred.
  expect(errors.every((e) => e.includes('400'))).toBe(true)
})

test('password: wrong current maps to field; right current updates', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/profile')
  await page.getByRole('heading', { name: /^security$/i }).first().scrollIntoViewIfNeeded()
  const currentBox = page.getByRole('textbox', { name: /current password/i })
  const newBox = page.getByRole('textbox', { name: /new password/i })
  await expect(currentBox).toBeVisible({ timeout: 25000 })
  await currentBox.fill('WrongPass1!')
  await newBox.fill('NewPass123!')
  await page.getByRole('button', { name: /update password/i }).click()
  await expect(page.getByText(/incorrect/i).first()).toBeVisible({ timeout: 15000 })

  // Correct current password updates (entry users share the known password).
  await currentBox.fill(entry.user.password)
  await page.getByRole('button', { name: /update password/i }).click()
  await expect(page.getByText(/password updated/i).first()).toBeVisible({ timeout: 15000 })
  // The wrong-password attempt above is rejected with 400 by design (field
  // validation, not session expiry) — that rejection is expected, not stray.
  expect(errors.every((e) => e.includes('400'))).toBe(true)
})

test('data links reach activity and watchlist', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors)
  await gotoAuthenticated(page, entry, '/profile')
  await page.getByRole('link', { name: /activity ledger/i }).click()
  await page.waitForURL(/\/activity/, { timeout: 15000 })
  await page.goBack()
  await page.getByRole('link', { name: /watchlist & price alerts/i }).click()
  await page.waitForURL(/\/watchlist/, { timeout: 15000 })
  expect(errors).toEqual([])
})
