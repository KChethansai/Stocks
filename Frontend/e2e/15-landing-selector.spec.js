// Landing-page stock selector verification (Oct 2026).
//
// The shipped control was a read-only input with decorative category chips.
// This drives the real selector: search by ticker and by company name,
// select, and confirm the header/quote/chart context follows the selection.
// Runs pre-login, proving public browsing works.
import { test, expect } from '@playwright/test'

const VIEWPORTS = [
  { name: '360', width: 360, height: 740 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 900 },
  { name: '1024', width: 1024, height: 800 },
  { name: '1440', width: 1440, height: 900 },
  { name: 'short', width: 1280, height: 620 }
]

async function scrollToSelector(page) {
  // The section is a deferred chunk: it mounts on scroll approach, so drive
  // the page down to it before waiting for its controls.
  await page.evaluate(() => {
    const shell = document.querySelector('#markets')
    if (shell) shell.scrollIntoView({ block: 'center' })
  })
  const search = page.locator('#landing-stock-search')
  await search.scrollIntoViewIfNeeded()
  await expect(search).toBeVisible({ timeout: 25000 })
  return search
}

test('landing selector browses the real universe and follows the selection', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('/')
  const search = await scrollToSelector(page)

  // The decorative category chips must be gone from this section.
  const section = page.locator('section', { has: search }).first()
  await expect(section.getByText('Technology', { exact: true })).toHaveCount(0)

  // Search by ticker.
  await search.fill('msft')
  const byTicker = page.getByRole('option', { name: /MSFT/ })
  await expect(byTicker).toBeVisible({ timeout: 15000 })
  await byTicker.click()

  // Search by company name and select a different symbol.
  await search.fill('NVIDIA')
  const byName = page.getByRole('option', { name: /NVDA/ })
  await expect(byName).toBeVisible({ timeout: 15000 })
  await byName.click()

  // The selected symbol's context follows the selection.
  await expect(page.getByText('NVDA', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('img', { name: /NVDA candlesticks/i })).toBeVisible({ timeout: 20000 })

  // A genuine no-result state rather than fabricated symbols.
  await search.fill('zzzznotarealticker')
  await expect(page.getByText(/No stocks match/i)).toBeVisible({ timeout: 10000 })

  // Keyboard operability, per the ARIA combobox pattern: focus stays in the
  // input and ArrowDown/Enter drive the selection through aria-activedescendant.
  await search.fill('')
  await search.fill('aapl')
  await search.focus()
  await page.keyboard.press('ArrowDown')
  await expect(search).toHaveAttribute('aria-activedescendant', /landing-stock-option-AAPL/)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('img', { name: /AAPL candlesticks/i })).toBeVisible({ timeout: 20000 })

  expect(errors).toEqual([])
})

test('landing selector has no horizontal overflow at supported widths', async ({ page }) => {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/')
    const search = await scrollToSelector(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `horizontal overflow at ${vp.name}px`).toBeLessThanOrEqual(1)
    await expect(search).toBeVisible()
  }
})