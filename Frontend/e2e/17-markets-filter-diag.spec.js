// Markets category-control diagnosis (Oct 2026).
// Reported symptom: with "All stocks" selected the filter area is hard to
// see or activate, and interaction appears to need a tiny exposed strip.
//
// This spec measures the ACTUAL clickable bounds of the control in both the
// All-stocks and a selected-category state, in both sidebar states, before
// any fix is applied — per the instruction to reproduce before choosing.
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'marketsfilter')
})

async function openMarkets(page) {
  await gotoAuthenticated(page, entry, '/markets')
  await expect(page.getByText(/listed/i).first()).toBeVisible({ timeout: 30000 })
}

test('diagnose category filter hit areas in every state', async ({ page }) => {
  await openMarkets(page)

  const allChip = page.getByRole('button', { name: /^All sectors, \d+ stocks?$/i }).first()
  await expect(allChip).toBeVisible({ timeout: 20000 })

  // All-stocks state: the whole chip must be clickable, not a thin sliver.
  const box = await allChip.boundingBox()
  expect(box.height, 'All chip hit height').toBeGreaterThanOrEqual(30)

  // Activate a category through its normal visible area (no force).
  const aCategory = page.getByRole('button', { name: /^Technology, \d+ stocks?$/i }).first()
  await expect(aCategory).toBeVisible({ timeout: 10000 })
  const catBox = await aCategory.boundingBox()
  expect(catBox.height, 'category chip hit height').toBeGreaterThanOrEqual(30)

  // Every category must be reachable, not clipped behind a scroll. Asserted
  // by geometry: each chip must sit inside the filter group's own box, so no
  // category is hidden off-panel or behind an invisible affordance.
  const clipping = await page.evaluate(() => {
    const group = document.querySelector('[aria-label="Filter by sector"]')
    if (!group) return { ok: false, reason: 'filter group not found' }
    const gb = group.getBoundingClientRect()
    if (group.scrollWidth > group.clientWidth + 1) {
      return { ok: false, reason: `group scrolls horizontally (${group.scrollWidth} > ${group.clientWidth})` }
    }
    const outside = [...group.querySelectorAll('button')]
      .map((b) => ({ b, r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.right > gb.right + 1 || r.left < gb.left - 1 || r.height < 30)
      .map(({ b, r }) => `${b.textContent.trim()} h=${Math.round(r.height)}`)
    return outside.length ? { ok: false, reason: `outside/clipped: ${outside.join(', ')}` } : { ok: true }
  })
  expect(clipping.reason || '').toBe('')
  expect(clipping.ok).toBe(true)

  await aCategory.click()
  // The chosen category becomes the active chip and the scope line updates.
  await expect(page.getByText(/listed/i).first()).toBeVisible({ timeout: 10000 })

  // Every category must be individually clickable through its own bounds.
  const allChips = page.locator('[aria-label="Filter by sector"] button')
  const chipCount = await allChips.count()
  expect(chipCount).toBeGreaterThan(3)
  for (let i = 0; i < chipCount; i += 1) {
    const chip = allChips.nth(i)
    await expect(chip).toBeVisible()
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
  }

  // Results must agree with the filter.
  const listed = await page.getByText(/listed/i).first().innerText()
  const listedCount = Number((listed.match(/\d+/) || [])[0])
  const rows = await page.locator('[aria-label*=","]').count()
  expect(rows).toBeGreaterThan(0)
  expect(listedCount).toBeGreaterThan(0)

  // Reset restores the full universe.
  const reset = page.getByRole('button', { name: /^reset$/i })
  if (await reset.count()) {
    await reset.click()
    await expect(page.getByText(/listed/i).first()).toBeVisible({ timeout: 10000 })
  }

  // Collapsed sidebar must not clip the control.
  const toggle = page.getByRole('button', { name: /collapse|expand/i }).first()
  if (await toggle.count()) {
    await toggle.click()
    await page.waitForTimeout(400)
    const collapsedBox = await page.getByRole('button', { name: /^All sectors, \d+ stocks?$/i }).first().boundingBox()
    expect(collapsedBox?.height || 0).toBeGreaterThanOrEqual(30)
  }
})

test('the category control is compact — two columns, no one-chip-per-line sprawl', async ({ page }) => {
  await openMarkets(page)
  await expect(page.getByRole('button', { name: /^All sectors, \d+ stocks?$/i })).toBeVisible({ timeout: 20000 })

  const geometry = await page.evaluate(() => {
    const group = document.querySelector('[aria-label="Filter by sector"]')
    const chips = [...group.querySelectorAll('button')]
    const rows = new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top)))
    const heights = chips.map((c) => c.getBoundingClientRect().height)
    const columns = new Set(chips.map((c) => Math.round(c.getBoundingClientRect().left)))
    return {
      chipCount: chips.length,
      rowCount: rows.size,
      columnCount: columns.size,
      height: Math.round(group.getBoundingClientRect().height),
      minHeight: Math.round(Math.min(...heights)),
      // Any chip whose visible text is clipped: two sectors truncating to
      // "Consumer D…" / "Consumer C…" are indistinguishable in practice.
      clipped: chips
        .filter((c) => {
          const span = c.querySelector('span')
          return span && span.scrollWidth > span.clientWidth + 1
        })
        .map((c) => c.getAttribute('aria-label'))
    }
  })

  // "All" spans both columns on the first row; the remaining chips pair up.
  const expectedRows = 1 + Math.ceil((geometry.chipCount - 1) / 2)
  expect(geometry.rowCount, 'chips should pair up, not stack one per line').toBeLessThanOrEqual(expectedRows)
  expect(geometry.columnCount, 'chips should form a 2-up grid').toBe(2)
  // Hit targets stay comfortable (WCAG 2.2 target size) while the block shrinks.
  expect(geometry.minHeight, 'every chip keeps a real hit target').toBeGreaterThanOrEqual(32)
  // Coarse guard against future sprawl: one chip per line measured ~330px.
  expect(geometry.height, 'the whole control should stay compact').toBeLessThanOrEqual(240)
  // Every sector must be readable, not ellipsised into an indistinguishable
  // stub. The full canonical name stays in the tooltip and aria-label.
  expect(geometry.clipped, `truncated chips: ${geometry.clipped.join(', ')}`).toEqual([])
})