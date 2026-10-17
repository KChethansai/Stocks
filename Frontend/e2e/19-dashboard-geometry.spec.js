// Dashboard geometry (Oct 2026).
//
// The reported defect was dead vertical space: Market Movers sat beside a
// much taller Watchlist, and Short-term signals left a gap under itself. The
// cause was arranging four cards as two 2-up rows, which forces one void per
// row. The fix groups them into two columns (Performance + Movers | Signals +
// Watchlist) so the columns balance against each other instead.
//
// An earlier version of this spec asserted a 220px row tolerance with loose
// selectors and passed both before and after the fix. These assert the
// property that actually matters: the two columns end at nearly the same
// height, and no card is stretched to fake it.
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'dashgeo2')
})

async function columns(page, width) {
  await page.setViewportSize({ width, height: 900 })
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.waitForTimeout(3200)
  return page.evaluate(() => {
    const grid = document.querySelector('[class*="lg:grid-cols-12"]')
    if (!grid) return null
    return [...grid.children].map((c) => {
      const r = c.getBoundingClientRect()
      return { h: Math.round(r.height), top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY) }
    })
  })
}

for (const width of [1440, 1024]) {
  test(`dashboard columns are balanced at ${width}px — no void under a card`, async ({ page }) => {
    const cols = await columns(page, width)
    expect(cols, `grid columns at ${width}px`).toBeTruthy()
    expect(cols.length, 'two layout columns expected').toBe(2)

    const [main, side] = cols
    // Both columns start level: this is a side-by-side layout, not stacked.
    expect(Math.abs(main.top - side.top), 'columns must align at the top').toBeLessThanOrEqual(2)
    // The real property: the columns finish within a small tolerance.
    expect(
      Math.abs(main.h - side.h),
      `column height difference at ${width}px (main=${main.h}, side=${side.h})`
    ).toBeLessThanOrEqual(80)
  })
}

test('no card is stretched to match a neighbour', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.waitForTimeout(3200)

  // A card stretched to fill its column would grow far beyond its content.
  // Compare each card's height with the sum of its children's own heights.
  const stretched = await page.evaluate(() => {
    const grid = document.querySelector('[class*="lg:grid-cols-12"]')
    return [...grid.querySelectorAll('[class*="rounded-2xl"]')]
      .map((card) => {
        const cardH = card.getBoundingClientRect().height
        let contentH = 0
        for (const child of card.children) contentH += child.getBoundingClientRect().height
        return { label: card.querySelector('h3')?.textContent.trim().slice(0, 20), cardH: Math.round(cardH), contentH: Math.round(contentH) }
      })
      .filter((c) => c.cardH - c.contentH > 120)
  })
  expect(stretched, `cards with large empty space: ${JSON.stringify(stretched)}`).toEqual([])
})

test('dashboard has no horizontal overflow and the watchlist stays reachable', async ({ page }) => {
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await gotoAuthenticated(page, entry, '/dashboard')
    await page.waitForTimeout(2200)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1)
    await expect(page.getByRole('heading', { name: /watchlist/i }).first()).toBeVisible({ timeout: 15000 })
  }
})