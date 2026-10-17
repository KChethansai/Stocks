// Before/after screenshot capture for this change set.
// Run: npx playwright test e2e/18-change-shots.spec.js
// Capture-only spec: it asserts nothing and exists to write screenshots for
// human inspection. It is skipped unless explicitly requested, so it never
// creates an account or runs as part of `npx playwright test`.
//
//   CAPTURE_SHOTS=1 OUT_DIR=/path/to/dir npx playwright test e2e/18-change-shots.spec.js
import { test } from '@playwright/test'
import { apiUser, gotoAuthenticated } from './helpers'

const OUT = process.env.OUT_DIR || '/home/chethan/.tmp/opencode/shots'

test.skip(
  process.env.CAPTURE_SHOTS !== '1',
  'capture-only spec; set CAPTURE_SHOTS=1 to run'
)

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'changshots')
})

test('capture every changed surface', async ({ page }) => {
  const section = async (id) => {
    await page.evaluate((anchor) => {
      const el = document.querySelector(anchor)
      if (el) el.scrollIntoView({ block: 'center' })
    }, id)
    await page.waitForTimeout(2500)
  }

  // ---- Landing: markets selector, alerts, forecasts, palette ----
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await section('#markets')
  await page.screenshot({ path: `${OUT}/after-landing-markets-1440.png` })
  await section('#alerts')
  await page.screenshot({ path: `${OUT}/after-landing-alerts-1440.png` })
  await section('#forecasts')
  await page.screenshot({ path: `${OUT}/after-landing-forecasts-1440.png` })
  await section('#workspace')
  await page.screenshot({ path: `${OUT}/after-landing-keyboard-1440.png` })
  // Header must not offer "How it works".
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/after-header-1440.png` })

  // Mobile landing + header.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await section('#markets')
  await page.screenshot({ path: `${OUT}/after-landing-markets-390.png` })
  await section('#workspace')
  await page.screenshot({ path: `${OUT}/after-landing-keyboard-390.png` })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.getByRole('button', { name: /open navigation/i }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/after-header-mobile-menu-390.png` })

  // ---- Authenticated: dashboard, profile, markets filters ----
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${OUT}/after-dashboard-1440.png`, fullPage: true })

  await page.setViewportSize({ width: 1024, height: 800 })
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}/after-dashboard-1024.png`, fullPage: true })

  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoAuthenticated(page, entry, '/profile')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/after-profile-1440.png`, fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await gotoAuthenticated(page, entry, '/profile')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/after-profile-390.png`, fullPage: true })

  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoAuthenticated(page, entry, '/markets')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/after-markets-filters-1440.png` })

  // Collapsed sidebar.
  const collapse = page.getByRole('button', { name: /collapse sidebar/i }).first()
  if (await collapse.count()) {
    await collapse.click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/after-markets-filters-collapsed-1440.png` })
  }

  await page.setViewportSize({ width: 768, height: 900 })
  await gotoAuthenticated(page, entry, '/markets')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/after-markets-filters-768.png` })

  // ---- Trade ticket provenance (closed-market labelling) ----
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.getByRole('button', { name: /^trade$/i }).click()
  await page.getByRole('combobox', { name: /search symbols/i }).fill('AAPL')
  await page.getByRole('option', { name: /AAPL/ }).first().click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/after-ticket-provenance-1440.png` })
})