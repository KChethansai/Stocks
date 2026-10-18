// Markets sector-control guard (Oct 2026).
//
// Original symptom: the category control needed a tiny exposed strip to hit,
// and the two previous shapes both failed a different requirement. A permanent
// button grid is now gone: in a 288px rail "Communication Services" cannot share
// a row, so flex-wrap put one chip per line and the control ate ~330px of
// vertical space above the stock list; abbreviating to fit ("Comm Svcs",
// "Cons Def") then left the reader decoding stubs with no explanation.
//
// The control is now a single listbox, so this spec asserts the properties the
// requirements actually name, against that control:
//
//   1. it has a real hit target (WCAG 2.2 target size), not a sliver;
//   2. it is compact — one control, not a grid that sprawls;
//   3. every sector is offered with its FULL canonical name and count — no
//      abbreviations, no ellipsised stubs;
//   4. every option is individually selectable and keyboard-operable;
//   5. the count line agrees with the filter, and Reset restores the universe;
//   6. it survives both sidebar states.
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

const sectorTrigger = (page) => page.getByRole('button', { name: 'Filter by sector' })
const countLine = (page) => page.locator('aside [aria-live="polite"]')

test('the sector control is one compact, well-sized listbox with full names', async ({ page }) => {
  await openMarkets(page)

  const trigger = sectorTrigger(page)
  await expect(trigger).toBeVisible({ timeout: 20000 })

  // 1. Real hit target, not the sliver the old control degraded to.
  const box = await trigger.boundingBox()
  expect(box.height, 'sector trigger hit height').toBeGreaterThanOrEqual(32)
  expect(box.width, 'sector trigger hit width').toBeGreaterThanOrEqual(120)

  // 2. Compact: one control. The old grid stood ~330px tall; a single trigger
  //    must not approach that.
  const geometry = await page.evaluate(() => {
    const rail = document.querySelector('aside.w-full')
    const controls = [...rail.querySelectorAll('[aria-label="Filter by sector"], [aria-label="Sort stocks"]')]
    // Where does the stock list actually begin?
    const firstRow = [...rail.querySelectorAll('[role="button"],[tabindex="0"]')].find((e) => /\$\d/.test(e.textContent))
    const railBox = rail.getBoundingClientRect()
    return {
      controlCount: controls.length,
      triggerHeight: Math.round(controls[0].getBoundingClientRect().height),
      heightBeforeFirstRow: firstRow
        ? Math.round(firstRow.getBoundingClientRect().top - railBox.top)
        : null,
      // A permanent grid would show a role=group of buttons here.
      legacyChipGrid: !!rail.querySelector('[role="group"] button')
    }
  })
  expect(geometry.controlCount, 'exactly one sector control and one sort control').toBe(2)
  expect(geometry.legacyChipGrid, 'the old permanent button grid must be gone').toBe(false)
  expect(geometry.triggerHeight, 'the trigger stays a single row').toBeLessThanOrEqual(48)
  // Coarse guard against the sprawl that started this: the controls block must
  // stay well under the ~330px the one-chip-per-line grid consumed.
  expect(geometry.heightBeforeFirstRow, 'controls must not push the list off-panel').toBeLessThanOrEqual(280)

  // 3. Full canonical names, no abbreviations.
  await trigger.click()
  const options = page.getByRole('option')
  await expect(options.first()).toBeVisible({ timeout: 10000 })
  const labels = await options.allTextContents()
  expect(labels.length, 'every sector plus an "all" option').toBeGreaterThan(3)
  expect(labels[0]).toMatch(/^All stocks \(\d+\)$/)
  for (const label of labels.slice(1)) {
    expect(label, `"${label}" must be a full name with a count`).toMatch(/^[A-Za-z][A-Za-z ]+ \(\d+\)$/)
    // The abbreviations the abandoned grid used must not reappear.
    expect(label).not.toMatch(/\b(Comm Svcs|Cons Def|Cons Cyc|Financials\s*\(?\d)/)
  }
  // No option is ellipsised into a stub.
  const clippedOptions = await page.evaluate(() =>
    [...document.querySelectorAll('[role="option"]')]
      .filter((o) => o.scrollWidth > o.clientWidth + 1)
      .map((o) => o.textContent.trim())
  )
  expect(clippedOptions, `ellipsised options: ${clippedOptions.join(', ')}`).toEqual([])
})

test('every sector is selectable, keyboard-operable, and agrees with the count line', async ({ page }) => {
  await openMarkets(page)
  const trigger = sectorTrigger(page)

  // The listbox mounts with a motion transition. Clicking an option in the same
  // tick as opening the trigger detaches the node mid-click, so every
  // interaction waits for the listbox to settle. No force, no retry-by-force.
  const openListbox = async () => {
    await trigger.click()
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible({ timeout: 10000 })
    // The listbox animates in (motion/react). Clicking an option before the
    // transition finishes detaches the node mid-click, so wait for the
    // transition's end state — a deterministic condition, not a blind sleep.
    await page.waitForFunction(
      () => {
        const lb = document.querySelector('[role="listbox"]')
        return !!lb && lb.getAnimations().every((a) => a.playState !== 'running')
      },
      null,
      { timeout: 10000 }
    )
    return listbox
  }

  const labels = []
  await openListbox()
  const options = page.getByRole('option')
  const total = await options.count()
  for (let i = 0; i < total; i += 1) labels.push((await options.nth(i).textContent())?.trim())
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toBeHidden({ timeout: 5000 })

  // 4. Each option is reachable and selectable on its own.
  for (const label of labels.slice(1)) {
    const sectorName = label.split('(')[0].trim()
    await openListbox()
    await page.getByRole('option', { name: label }).click()
    await expect(trigger, `"${label}" becomes the active sector`).toContainText(sectorName)
    await expect(countLine(page), `scope line must name "${sectorName}"`).toContainText(sectorName)
    expect(await page.getByText(/listed/i).first()).toBeVisible({ timeout: 10000 })
  }

  // Keyboard: open the listbox and pick with ArrowDown + Enter.
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toBeHidden({ timeout: 5000 })

  // Escape closes without changing the selection.
  const before = await trigger.innerText()
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toBeHidden({ timeout: 5000 })
  expect(await trigger.innerText(), 'Escape leaves the selection alone').toBe(before)

  // 5. Reset restores the full universe.
  const reset = page.getByRole('button', { name: /^reset$/i })
  await expect(reset).toBeVisible({ timeout: 5000 })
  await reset.click()
  await expect(countLine(page)).toContainText(/listed/)
  expect(await countLine(page).innerText(), 'reset clears the sector').not.toContain('Technology')
})

test('search, sector, sort and pagination compose without stranding the user', async ({ page }) => {
  await openMarkets(page)
  const count = async () => (await countLine(page).innerText()).trim()

  const all = await count()
  const allRows = await page.locator('aside [role="button"]').count()
  expect(allRows).toBeGreaterThan(0)

  // Sector narrows, and the count agrees with the filtered set.
  await sectorTrigger(page).click()
  await expect(page.getByRole('listbox')).toBeVisible({ timeout: 10000 })
  await page.getByRole('option', { name: /^Technology \(\d+\)$/ }).click()
  await expect(countLine(page)).toContainText(/of \d+ listed/)
  const narrowed = await count()
  expect(narrowed).toMatch(/\d+ of \d+ listed/)

  // Sort applies on top without changing the filtered count.
  await page.getByRole('button', { name: 'Sort stocks' }).click()
  await page.getByRole('option', { name: /^Price high/ }).click()
  await expect(countLine(page)).toContainText(/of \d+ listed/)
  expect(await count(), 'sorting must not change how many match').toBe(narrowed)

  // Search composes on top of both.
  const search = page.getByPlaceholder(/Search ticker, name/i)
  await search.fill('a')
  await page.waitForTimeout(400)
  const searched = await count()
  expect(searched).toMatch(/\d+ of \d+ listed/)

  // Clearing search restores exactly the sector-filtered set.
  await search.fill('')
  await page.waitForTimeout(400)
  expect(await count(), 'clearing search returns to the sector filter').toBe(narrowed)

  // 6. Both sidebar states keep the control usable.
  const toggle = page.getByRole('button', { name: /collapse sidebar/i }).first()
  if (await toggle.count()) {
    await toggle.click()
    await page.waitForTimeout(500)
    const collapsed = await sectorTrigger(page).boundingBox()
    expect(collapsed?.height || 0, 'control survives a collapsed sidebar').toBeGreaterThanOrEqual(32)
    await page.getByRole('button', { name: /expand sidebar/i }).first().click()
    await page.waitForTimeout(500)
  }
  expect((await sectorTrigger(page).boundingBox())?.height || 0).toBeGreaterThanOrEqual(32)
})
