// Screenshot capture for the landing stock selector.
// Run: npx playwright test e2e/16-landing-shots.spec.js
import { test } from '@playwright/test'

test('capture landing selector states', async ({ page }) => {
  const open = async () => {
    await page.evaluate(() => {
      const shell = document.querySelector('#markets')
      if (shell) shell.scrollIntoView({ block: 'center' })
    })
    await page.locator('#landing-stock-search').scrollIntoViewIfNeeded()
  }

  for (const vp of [
    { name: '1440', width: 1440, height: 900 },
    { name: '390', width: 390, height: 844 }
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/')
    await open()
    await page.locator('#landing-stock-search').waitFor({ timeout: 25000 })
    await page.screenshot({ path: `/home/chethan/.tmp/opencode/shots/landing-selector-${vp.name}-idle.png` })
    await page.locator('#landing-stock-search').fill('aapl')
    await page.getByRole('option').first().waitFor({ timeout: 15000 })
    await page.screenshot({ path: `/home/chethan/.tmp/opencode/shots/landing-selector-${vp.name}-results.png` })
    await page.getByRole('option').first().click()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `/home/chethan/.tmp/opencode/shots/landing-selector-${vp.name}-selected.png` })
  }
})