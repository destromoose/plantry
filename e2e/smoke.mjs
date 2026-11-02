// Smoke test and screenshot run. Usage: npm run build && npm run e2e
// Starts the production server on a spare port, walks the main flows at phone
// and desktop widths, writes screenshots to e2e/screenshots, and fails on any
// console error or uncaught page error.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const PORT = process.env.PORT || 3123
const BASE = `http://localhost:${PORT}`
mkdirSync('e2e/screenshots', { recursive: true })

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'pipe', shell: true })
server.stdout.on('data', (d) => process.stdout.write(`[next] ${d}`))
server.stderr.on('data', (d) => process.stderr.write(`[next] ${d}`))

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('server did not start')
}

const errors = []
let failed = false
try {
  await waitForServer()
  const browser = await chromium.launch()
  for (const [name, viewport, mobile] of [
    ['phone', { width: 390, height: 844 }, true],
    ['desktop', { width: 1280, height: 860 }, false],
  ]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`))
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))

    await page.goto(`${BASE}/`)
    await page.waitForURL('**/onboarding')
    await page.screenshot({ path: `e2e/screenshots/${name}-01-onboarding-who.png` })
    await page.getByLabel('Your name').fill('Maya')
    await page.getByRole('button', { name: 'Add someone' }).click()
    await page.getByLabel('Household member 2').fill('Sam')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: /^Cozy/ }).click()
    await page.getByRole('button', { name: /^One pan/ }).click()
    await page.screenshot({ path: `e2e/screenshots/${name}-02-onboarding-taste.png` })
    await page.getByRole('button', { name: 'Next' }).click()
    await page.screenshot({ path: `e2e/screenshots/${name}-03-onboarding-pantry.png` })
    await page.getByRole('button', { name: 'Show me tonight' }).click()
    await page.waitForURL(`${BASE}/`)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `e2e/screenshots/${name}-04-tonight.png`, fullPage: true })

    for (const [i, route] of ['week', 'recipes', 'pantry', 'shop', 'household', 'settings'].entries()) {
      await page.goto(`${BASE}/${route}`)
      await page.waitForTimeout(700)
      await page.screenshot({ path: `e2e/screenshots/${name}-${String(i + 5).padStart(2, '0')}-${route}.png`, fullPage: true })
    }

    // Recipe detail and cook mode from the first recipe card.
    await page.goto(`${BASE}/recipes`)
    await page.waitForTimeout(500)
    const firstCard = page.locator('a[href^="/recipes/r-"]').first()
    const href = await firstCard.getAttribute('href')
    await page.goto(`${BASE}${href}`)
    await page.waitForTimeout(700)
    await page.screenshot({ path: `e2e/screenshots/${name}-11-recipe.png`, fullPage: true })
    await page.goto(`${BASE}/cook/${href.split('/').pop()}`)
    await page.waitForTimeout(700)
    await page.screenshot({ path: `e2e/screenshots/${name}-12-cook.png` })

    // Night mood.
    await page.goto(`${BASE}/settings`)
    await page.getByRole('button', { name: 'Night' }).click()
    await page.goto(`${BASE}/`)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `e2e/screenshots/${name}-13-tonight-night.png`, fullPage: true })

    await ctx.close()
  }
  await browser.close()
} catch (e) {
  failed = true
  console.error(e)
} finally {
  server.kill('SIGTERM')
}

const realErrors = errors.filter((e) => !/favicon|hydrat|Download the React DevTools/i.test(e))
if (realErrors.length) {
  console.error('Console errors:\n' + realErrors.join('\n'))
  failed = true
}
process.exit(failed ? 1 : 0)
