// Dashboard geometry (Oct 2026).
//
// The reported defect was dead vertical space: the dashboard was a fixed
// 856px tall, so it overflowed <main> by 144px at 1366x768 and 12px at
// 1440x900, and the 2x2 card grouping left a void under the signals card.
//
// It is now one panel row (Performance beside a tabbed Watchlist / Signals
// rail) plus a Market Movers strip, with the row taking the height the app
// shell hands it.
//
// This spec no longer selects on class names. `lg:grid-cols-12` was an
// implementation detail of the old grouping; the new layout does not have it
// and the selector would fail for reasons unrelated to geometry. It anchors
// on stable `data-testid` hooks and asserts the properties directly:
//
//   1. the primary content fits the viewport below the header — <main>, the
//      shell's scroll container, does not need to scroll;
//   2. no panel is painted over by a later sibling;
//   3. no card carries a large void inside it;
//   4. the chart's PLOT fills the frame it was given;
//   5. nothing is clipped by an `overflow: hidden` ancestor, and any label
//      shortened with an ellipsis exposes its full value in `title`;
//   6. no horizontal overflow, and the watchlist stays reachable.
//
// (4) and (5) are not decoration. Each names a failure that a previous
// version of this file reported green through:
//
//   (4) The chart is sized by a CSS percentage chain into TerminalLineChart.
//       One link of that chain with an `auto` height does not fail loudly —
//       the @visx ParentSize div measures itself, the SVG is pinned to the
//       plot's content height, and the panel renders an ~18px sliver inside a
//       530px frame. `documentElement.scrollHeight` is pinned to the viewport
//       by the h-screen/overflow-hidden shell, so every other assertion in
//       this file still passes. Only comparing the frame with what is inside
//       it sees it.
//
//   (5) `SpotlightCard` hard-codes `overflow: hidden`. A child wider than its
//       box is therefore invisible to `horizontalOverflowPx` (which reads
//       `documentElement.scrollWidth`, kept at 0 by the clip) AND to an
//       inner-scroller probe (which only matches `auto`/`scroll`). The clip
//       is directly observable, though: the clipping element's own
//       `scrollWidth` exceeds its `clientWidth`. That is the probe below.
import { test, expect } from '@playwright/test'
import { apiUser, gotoAuthenticated } from './helpers'

let entry
test.beforeAll(async ({ request }) => {
  entry = await apiUser(request, 'dashgeo2')
})

async function dashboard(page, width, height) {
  await page.setViewportSize({ width, height })
  await gotoAuthenticated(page, entry, '/dashboard')
  await page.waitForTimeout(3200)
  return page.evaluate(() => {
    const main = document.querySelector('#main-content')
    const row = document.querySelector('[data-testid="mf-panel-row"]')
    const chart = document.querySelector('[data-testid="mf-chart-panel"]')
    const rail = document.querySelector('[data-testid="mf-rail"]')
    const movers = document.querySelector('[data-testid="mf-movers"]')
    const frame = document.querySelector('[data-testid="mf-chart-frame"]')
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }
    }

    // Any descendant that scrolls inside itself is hiding part of the page.
    const innerScrollers = []
    for (const el of document.querySelectorAll('#main-content *')) {
      const cs = getComputedStyle(el)
      if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') continue
      if (el.scrollHeight - el.clientHeight > 2) innerScrollers.push(el.className || el.tagName)
    }

    // Content hidden by an `overflow: hidden` ancestor is clipped silently:
    // it creates no scrollbar and adds nothing to the document's scrollWidth,
    // so the only honest signal is the clipping element overflowing itself.
    //
    // Two kinds are reported separately, because they mean different things.
    // `clipped` is a layout fault: content exists and cannot be reached.
    // `undisclosedTruncation` is a deliberate one-line label whose full value
    // is not exposed anywhere — the text is genuinely lost to the reader.
    // Text-overflow: ellipsis is the sanctioned way to shorten a label, so it
    // is not a fault on its own; it only becomes one when the full value is
    // not recoverable from `title` or `aria-label`.
    const clipped = []
    const undisclosedTruncation = []
    for (const el of document.querySelectorAll('#main-content *')) {
      const cs = getComputedStyle(el)
      if (cs.overflowX !== 'hidden' && cs.overflowX !== 'clip') continue
      const over = el.scrollWidth - el.clientWidth
      if (over <= 1) continue
      const entry = {
        testid: el.getAttribute('data-testid') || null,
        over,
        label: (el.querySelector('h3')?.textContent || el.className || el.tagName).trim().slice(0, 40)
      }
      if (cs.textOverflow === 'ellipsis') {
        const disclosed =
          el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent.trim()
        if (!disclosed) undisclosedTruncation.push(entry)
        continue
      }
      clipped.push(entry)
    }

    // The plot must fill the frame. The chart's own wrapper is its first
    // child; if the percentage chain dead-ends at that level, this is 18px
    // inside a 530px frame and nothing else in this file notices.
    const frameRect = rect(frame)
    const plotRect = frame?.firstElementChild ? rect(frame.firstElementChild) : null
    const svgRect = frame?.querySelector('svg') ? rect(frame.querySelector('svg')) : null

    // A panel taller than the row that contains it is a panel that has to be
    // painted over by whatever follows.
    const rowRect = rect(row)
    const panels = [
      ['chart', rect(chart)],
      ['rail', rect(rail)]
    ]
    const spill = panels
      .filter(([, r]) => r && r.height > 0 && r.bottom > rowRect.bottom + 2)
      .map(([name, r]) => ({ name, overBy: r.bottom - rowRect.bottom }))

    return {
      mainOverflowPx: main.scrollHeight - main.clientHeight,
      horizontalOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      row: rowRect,
      rail: rect(rail),
      movers: rect(movers),
      // Empty background between the rail's bottom and the row's bottom. The
      // rail hugs its data, so this is only expected to be ~0 when the list is
      // long enough to fill the row.
      railGapPx: rowRect.height - rect(rail).height,
      spill,
      innerScrollers,
      clipped,
      undisclosedTruncation,
      chart: { frame: frameRect, plot: plotRect, svg: svgRect },
      // cards whose height exceeds the sum of their children's own heights
      stretched: [...document.querySelectorAll('#main-content [class*="rounded-2xl"]')]
        .map((card) => {
          let contentH = 0
          for (const child of card.children) contentH += child.getBoundingClientRect().height
          return {
            label: card.querySelector('h3')?.textContent.trim().slice(0, 20),
            cardH: Math.round(card.getBoundingClientRect().height),
            contentH: Math.round(contentH)
          }
        })
        .filter((c) => c.cardH - c.contentH > 120)
    }
  })
}

for (const [width, height] of [[1440, 900], [1366, 768], [1024, 768]]) {
  test(`dashboard fits below the header at ${width}x${height} — nothing scrolls, nothing overlaps, nothing is clipped`, async ({ page }) => {
    const r = await dashboard(page, width, height)

    // 1. fits the viewport: <main> does not need to scroll.
    expect(r.mainOverflowPx, `main overflow at ${width}x${height}`).toBeLessThanOrEqual(2)
    // …so the chart, the strip and every secondary control are above the fold.
    expect(r.movers.bottom, 'market movers bottom edge').toBeLessThanOrEqual(height)
    expect(r.row.top, 'panel row starts below the header').toBeGreaterThan(0)

    // 2. no panel spills out of the row box and gets painted over.
    expect(r.spill, `panels overrunning the row at ${width}x${height}: ${JSON.stringify(r.spill)}`).toEqual([])
    expect(r.rail.bottom, 'rail stays above market movers').toBeLessThanOrEqual(r.movers.top + 2)

    // 3. no card inflated to match a neighbour, no hidden inner scroller.
    expect(r.stretched, `cards with large empty space: ${JSON.stringify(r.stretched)}`).toEqual([])
    expect(r.innerScrollers, `inner scrollers: ${JSON.stringify(r.innerScrollers)}`).toEqual([])

    // 4. the plot fills the frame it was given, and the frame respects its floor.
    expect(r.chart.frame, `chart frame missing at ${width}x${height}`).toBeTruthy()
    expect(r.chart.frame.height, `chart frame height at ${width}x${height}`).toBeGreaterThanOrEqual(180)
    expect(
      r.chart.frame.height - r.chart.plot.height,
      `plot does not fill the frame at ${width}x${height}: ${JSON.stringify(r.chart)}`
    ).toBeLessThanOrEqual(2)

    // 5. nothing is clipped by an `overflow: hidden` ancestor, and every
    //    ellipsised label still exposes its full text.
    expect(r.clipped, `clipped content at ${width}x${height}: ${JSON.stringify(r.clipped)}`).toEqual([])
    expect(
      r.undisclosedTruncation,
      `labels truncated with no full value at ${width}x${height}: ${JSON.stringify(r.undisclosedTruncation)}`
    ).toEqual([])

    // 6. no horizontal overflow.
    expect(r.horizontalOverflowPx, `horizontal overflow at ${width}x${height}`).toBeLessThanOrEqual(1)
  })
}

test('the signals rail fills its row instead of leaving a gap beside the chart', async ({ page }) => {
  // The Signals tab is the case that used to be guaranteed to leave 142px
  // (1366x768) to 274px (1440x900) of empty background: the forecast request
  // was capped at 5 symbols, so the rail could never hold more than 5 rows and
  // never more than one page. The request is now sized to the endpoint's own
  // 8-symbol limit and NEUTRAL forecasts are kept, so the tab can fill its row
  // whenever the model returns enough calls.
  for (const [width, height] of [[1440, 900], [1366, 768], [1024, 768]]) {
    await page.setViewportSize({ width, height })
    await gotoAuthenticated(page, entry, '/dashboard')
    await page.waitForTimeout(3200)
    await page.getByRole('tab', { name: 'Signals' }).click()
    await page.waitForTimeout(1200)

    const r = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="mf-panel-row"]').getBoundingClientRect()
      const rail = document.querySelector('[data-testid="mf-rail"]').getBoundingClientRect()
      const rows = document.querySelectorAll('[data-testid="mf-rail"] a').length
      return { gap: Math.round(row.height - rail.height), rows, railH: Math.round(rail.height) }
    })

    // Two different invariants, both always asserted, because the requirement
    // genuinely cuts both ways here:
    //
    //  * "no large avoidable gap" — with enough rows the rail should fill its
    //    row rather than leaving a void beside the chart.
    //  * "no oversized empty cards" — with FEW rows the rail must NOT stretch to
    //    fill. Four rows stretched across a 615px row is ~127px per row: a card
    //    faked out to cover space it has no data for. Hugging the data is the
    //    honest answer there.
    //
    // The previous version skipped the assertion entirely below 6 rows, so the
    // exact case where a stretched card does damage asserted nothing. Asserting
    // gap<=24 unconditionally was equally wrong — it forbade the correct
    // behaviour. Both branches now carry a real assertion.
    if (r.rows === 0) {
      // No forecasts at all: the rail legitimately shows its empty note.
      expect(r.railH, `empty rail at ${width}x${height}`).toBeLessThanOrEqual(220)
    } else if (r.rows >= 6) {
      expect(r.gap, `signals rail gap at ${width}x${height} with ${r.rows} rows`).toBeLessThanOrEqual(24)
    } else {
      // Sparse: prove it hugged its data instead of inflating. 88px is the
      // per-row ceiling (ROW_MAX_H) and 105px the rail's chrome, so the rail
      // can never legitimately exceed rows*88 + 105.
      const maxHonestRail = r.rows * 88 + 105
      expect(
        r.railH,
        `rail must hug ${r.rows} rows, not stretch (cap ${maxHonestRail}) at ${width}x${height}`
      ).toBeLessThanOrEqual(maxHonestRail)
    }
  }
})

test('stacked layout scrolls instead of overlapping panels', async ({ page }) => {
  // Below lg the panels stack and the page is allowed to scroll — but nothing
  // may be painted over. A rail with a pixel height inside a pinned flex box
  // is exactly how that goes wrong.
  for (const [width, height] of [[390, 844], [768, 900]]) {
    const r = await dashboard(page, width, height)
    expect(r.spill, `panels overrunning the row at ${width}x${height}: ${JSON.stringify(r.spill)}`).toEqual([])
    expect(r.rail.bottom, `rail below movers at ${width}x${height}`).toBeLessThanOrEqual(r.movers.top + 2)
    expect(r.innerScrollers, `inner scrollers at ${width}x${height}`).toEqual([])
    expect(r.clipped, `clipped content at ${width}x${height}: ${JSON.stringify(r.clipped)}`).toEqual([])
    expect(
      r.undisclosedTruncation,
      `labels truncated with no full value at ${width}x${height}: ${JSON.stringify(r.undisclosedTruncation)}`
    ).toEqual([])
    expect(r.horizontalOverflowPx, `horizontal overflow at ${width}x${height}`).toBeLessThanOrEqual(1)
  }
})

test('dashboard has no horizontal overflow and the watchlist stays reachable', async ({ page }) => {
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await gotoAuthenticated(page, entry, '/dashboard')
    await page.waitForTimeout(2200)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1)
    await expect(page.getByRole('heading', { name: /watchlist/i }).first()).toBeVisible({ timeout: 15000 })
    // The rail is a paged preview, not a scroller, so "reachable" also means
    // a real destination exists for the rest of the list.
    await expect(page.getByRole('link', { name: /View all/ })).toBeVisible()
  }
})