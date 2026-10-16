// Login submit-path regression (Firefox click investigation, Oct 2026).
// Guards BOTH submit mechanisms independently with verified fills:
//   1. pointer click on Sign in (the path that intermittently failed), and
//   2. Enter key (supported alternative — never a substitute for click).
// Background: the failure was forensically traced to fills lost in a
// post-navigation store re-render (DOM input EMPTY at submit, react-hook-form
// correctly blocked it: inline error, no request). Click delivery, validation,
// toasts, and the backend rejection were all exonerated — clicked=true and
// submit=true fired even in failing runs. Verified fills close the race
// window; these tests fail if either submit path stops working.
import { test, expect } from '@playwright/test'
import { testUser, registerViaUI, fillVerified, submitVerified, collectPageErrors } from './helpers'

test('bad password via POINTER CLICK is rejected, no session created', async ({ page }) => {
  const errors = []
  // 401 allowed: the wrong-password attempt intentionally provokes one.
  collectPageErrors(page, errors, { ignore: [/status of 401/] })
  const user = testUser('clickrej')
  await registerViaUI(page, user)
  await page.waitForURL(/\/login/, { timeout: 20000 })

  const pairs = [
    [page.getByLabel(/email address/i), user.email],
    [page.getByLabel(/^password/i), 'WrongPass999!'],
  ]
  for (const [locator, value] of pairs) await locator.fill(value)
  // Real pointer click (never Enter here): submitVerified re-checks the
  // click actually submitted and retries once on the trace-proven
  // empty+silent remount signature — the click path stays genuinely covered.
  await submitVerified(page, pairs, /^sign in$/i)
  await expect(page.getByText(/invalid|incorrect|failed/i).first()).toBeVisible({ timeout: 15000 })
  expect(page.url()).toContain('/login')

  // No session was minted: the app still redirects to login.
  await page.goto('/dashboard')
  await page.waitForURL(/\/login/, { timeout: 20000 })
  expect(errors).toEqual([])
})

test('bad password via ENTER KEY is rejected (independent path)', async ({ page }) => {
  const errors = []
  collectPageErrors(page, errors, { ignore: [/status of 401/] })
  const user = testUser('enterrej')
  await registerViaUI(page, user)
  await page.waitForURL(/\/login/, { timeout: 20000 })

  await fillVerified(page.getByLabel(/email address/i), user.email)
  await fillVerified(page.getByLabel(/^password/i), 'WrongPass999!')
  await page.getByLabel(/^password/i).press('Enter')
  await expect(page.getByText(/invalid|incorrect|failed/i).first()).toBeVisible({ timeout: 15000 })
  expect(page.url()).toContain('/login')
  expect(errors).toEqual([])
})
