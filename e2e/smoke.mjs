// Smoke test and screenshot run. Usage: npm run build && npm run e2e
// Starts the production server on a spare port, walks the main flows at phone
// and desktop widths, writes screenshots to e2e/screenshots, and fails on any
// console error or uncaught page error.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright')

const PORT = process.env.PORT || 3123
const BASE = `http://localhost:${PORT}`
mkdirSync('e2e/screenshots', { recursive: true })

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  stdio: 'pipe',
  shell: true,
  detached: true,
})
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
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
  const browser = await chromium.launch(
    proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}
  )
  for (const [name, viewport, mobile] of [
    ['phone', { width: 390, height: 844 }, true],
    ['desktop', { width: 1280, height: 860 }, false],
  ]) {
    const ctx = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: 2,
    })
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
    await page.waitForTimeout(400)
    await page.screenshot({ path: `e2e/screenshots/${name}-02-onboarding-taste.png` })
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Peanuts' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.screenshot({ path: `e2e/screenshots/${name}-03-onboarding-pantry.png` })
    await page.getByRole('button', { name: 'Show me tonight' }).click()
    await page.waitForURL(`${BASE}/`)
    await page.waitForTimeout(900)
    if (/peanut/i.test(await page.locator('main').innerText()))
      throw new Error(`${name}: a peanut dish was suggested to a peanut-free household`)
    await page.screenshot({ path: `e2e/screenshots/${name}-04-tonight.png`, fullPage: true })

    // Navigate by clicking, the way people do. page.goto hides transition bugs.
    for (const label of ['Week', 'Recipes', 'Pantry', 'Shop', 'Tonight', 'Week', 'Shop']) {
      await page
        .locator('nav[aria-label="Primary"]:visible')
        .getByRole('link', { name: label, exact: true })
        .click()
      await page.waitForTimeout(700)
      const opacity = await page.evaluate(() =>
        Number(getComputedStyle(document.querySelector('main')).opacity)
      )
      if (opacity < 0.95)
        throw new Error(
          `${name}: page stayed invisible after clicking ${label} (opacity ${opacity})`
        )
    }
    await page.goBack()
    await page.waitForTimeout(700)
    const backOpacity = await page.evaluate(() =>
      Number(getComputedStyle(document.querySelector('main')).opacity)
    )
    if (backOpacity < 0.95)
      throw new Error(`${name}: page stayed invisible after Back (opacity ${backOpacity})`)

    for (const [i, route] of [
      'week',
      'recipes',
      'pantry',
      'shop',
      'household',
      'settings',
    ].entries()) {
      await page.goto(`${BASE}/${route}`)
      await page.waitForTimeout(700)
      await page.screenshot({
        path: `e2e/screenshots/${name}-${String(i + 5).padStart(2, '0')}-${route}.png`,
        fullPage: true,
      })
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

    // The core loop: energy -> lock in -> fill week -> shopping list -> check -> done -> cook.
    if (name === 'phone') {
      await page.goto(`${BASE}/`)
      await page.getByRole('radio', { name: /Something quick/ }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Shuffle' }).click()
      await page.waitForTimeout(1500)
      await page
        .getByRole('button', { name: /^Cook this (tonight|tomorrow)$/ })
        .last()
        .click()
      await page.waitForTimeout(500)
      await page.screenshot({
        path: `e2e/screenshots/${name}-14-tonight-locked.png`,
        fullPage: true,
      })
      if (!(await page.getByRole('link', { name: /^Start cooking/ }).count()))
        throw new Error('Cook link missing after lock in')

      await page.goto(`${BASE}/week`)
      await page.getByRole('button', { name: 'Fill my week' }).click()
      await page.waitForTimeout(900)
      await page.screenshot({ path: `e2e/screenshots/${name}-15-week-filled.png`, fullPage: true })
      await page.getByRole('button', { name: 'Make the shopping list' }).click()
      await page.waitForURL('**/shop')
      await page.waitForTimeout(700)
      const rows = await page.getByRole('checkbox').count()
      if (rows < 5) throw new Error(`expected a generated list, got ${rows} items`)
      await page.getByRole('checkbox').first().click()
      await page.getByRole('checkbox').nth(1).click()
      await page.waitForTimeout(600)
      await page.screenshot({ path: `e2e/screenshots/${name}-16-shop-list.png`, fullPage: true })
      await page.getByRole('button', { name: 'Done shopping' }).click()
      await page.waitForTimeout(500)

      // Several things at once, the way people say them.
      const before = await page.getByRole('checkbox').count()
      await page
        .getByLabel('Add to your list. Separate things with commas.')
        .fill("dish soap, two birthday candles and we're out of bin bags")
      await page.getByRole('button', { name: 'Add to list' }).click()
      await page.waitForTimeout(600)
      const after = await page.getByRole('checkbox').count()
      if (after !== before + 3) throw new Error(`capture added ${after - before} items, expected 3`)
      await page.screenshot({
        path: `e2e/screenshots/${name}-16b-shop-capture.png`,
        fullPage: true,
      })

      await page.goto(`${BASE}/`)
      await page.getByRole('link', { name: /^Start cooking/ }).click()
      await page.waitForURL('**/cook/**')
      await page.waitForTimeout(600)
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(500)
      const startTimer = page.getByRole('button', { name: /Start/ })
      if (await startTimer.count()) await startTimer.first().click()
      await page.waitForTimeout(600)
      await page.screenshot({ path: `e2e/screenshots/${name}-17-cook-step2.png` })

      // Save a recipe from a link. The page fetch is stubbed: sandboxes can't reach recipe sites.
      await page.route('**/api/import?*', (route) =>
        route.fulfill({
          json: {
            recipe: {
              title: 'Summer meatballs & spaghetti',
              description: 'A quick meal for two.',
              servings: 2,
              activeMinutes: 10,
              totalMinutes: 30,
              ingredients: [
                { name: 'olive oil', quantity: 2, unit: 'tbsp' },
                { name: 'onion', quantity: 1, unit: '' },
                { name: 'spaghetti', quantity: 200, unit: 'g' },
              ],
              steps: [
                { text: 'Heat the olive oil and soften the onion for 5 minutes.', timerMinutes: 5 },
                { text: 'Boil the spaghetti for 10 minutes and toss everything together.' },
              ],
              source: 'bbcgoodfood.com',
              sourceUrl: 'https://www.bbcgoodfood.com/recipes/summer-meatballs',
            },
          },
        })
      )
      await page.goto(`${BASE}/recipes/new?tab=link`)
      await page
        .getByLabel('Recipe link')
        .fill('https://www.bbcgoodfood.com/recipes/summer-meatballs')
      await page.screenshot({ path: `e2e/screenshots/${name}-18-import-link.png` })
      await page.getByRole('button', { name: 'Get the recipe' }).click()
      await page.waitForTimeout(600)
      if ((await page.getByLabel('Title').inputValue()) !== 'Summer meatballs & spaghetti')
        throw new Error('link import did not fill the form')
      await page.screenshot({
        path: `e2e/screenshots/${name}-19-import-filled.png`,
        fullPage: true,
      })
      await page.getByRole('button', { name: /^Save/ }).last().click()
      await page.waitForURL(/\/recipes\/(?!new)/)
      await page.waitForTimeout(600)
      if (!(await page.getByRole('link', { name: 'bbcgoodfood.com' }).count()))
        throw new Error('saved recipe does not link back to its source')
      const imported = page.url().split('/').pop()
      await page.goto(`${BASE}/cook/${imported}`)
      await page.waitForTimeout(700)
      if (!(await page.getByRole('list', { name: 'For this step' }).count()))
        throw new Error('cook mode does not show the ingredients for the step')
      await page.screenshot({ path: `e2e/screenshots/${name}-20-cook-step-ingredients.png` })
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Done' }).click()
      await page.waitForTimeout(350)
      await page.screenshot({ path: `e2e/screenshots/${name}-21-cook-finish.png` })
    }

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
  // Kill the whole process group so next-server does not outlive the test.
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {}
}

// Image hosts may be unreachable in a sandbox; a failed resource load is not an app error.
const realErrors = errors.filter(
  (e) => !/favicon|Download the React DevTools|Failed to load resource/i.test(e)
)
if (realErrors.length) {
  console.error('Console errors:\n' + realErrors.join('\n'))
  failed = true
}
process.exit(failed ? 1 : 0)
