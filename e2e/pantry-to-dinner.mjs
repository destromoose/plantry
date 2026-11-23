import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const origin = `http://127.0.0.1:${Number(process.env.PORT || 4405)}`
const output = process.env.SCREENSHOT_DIR || 'e2e/screenshots/pantry-to-dinner'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'en-US',
  timezoneId: 'America/Montreal',
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const button = (name) => page.getByRole('button', { name, exact: true })
const visit = async (path, expected = 200) => {
  const response = await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 60000 })
  assert.equal(response.status(), expected, path)
}
const capture = async (label) => {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => document.querySelector('h1, [role="progressbar"]'))
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(700)
  const heading = await page
    .locator('h1:visible, [role="progressbar"]:visible')
    .first()
    .evaluate((el) => el.innerText || el.getAttribute('aria-valuetext'))
  assert.doesNotMatch(heading, /something went wrong/i)
  await page.waitForFunction(() => {
    const main = document.querySelector('#main')
    return !main || Number(getComputedStyle(main).opacity) > 0.98
  })
  if (process.env.PRODUCTION_CAPTURE === '1') {
    assert.equal(await page.locator('nextjs-portal').count(), 0, `${label}: dev overlay mounted`)
    const nav = page.getByRole('navigation', { name: 'Primary' })
    if (await nav.count()) {
      const first = nav.getByRole('link').first()
      assert.equal(await first.innerText(), 'Tonight')
      const clear = await first.evaluate((link) =>
        [...link.querySelectorAll('svg, span')]
          .filter((part) => part.tagName.toLowerCase() === 'svg' || part.textContent === 'Tonight')
          .every((part) => {
            const box = part.getBoundingClientRect()
            return [0.1, 0.5, 0.9].every((offset) =>
              link.contains(
                document.elementFromPoint(box.x + box.width * offset, box.y + box.height / 2)
              )
            )
          })
      )
      assert(clear, `${label}: Tonight icon or label is covered`)
      console.log(`${label}: Tonight icon and label unobstructed`)
    }
  }
  await page.screenshot({ path: join(output, `${label}.png`) })
  console.log(label, new URL(page.url()).pathname, heading)
}

try {
  console.log('Browser:', browser.version())
  await visit('/')
  await page.waitForURL('**/onboarding')
  await capture('01-onboarding')
  const restore = button('Restore from a Plantry backup')
  assert.equal(await restore.isVisible(), false)
  await page.locator('summary').filter({ hasText: 'Join or restore a household' }).press('Enter')
  assert(await restore.isVisible())
  assert.equal(
    await page.getByRole('link', { name: 'Join your household' }).getAttribute('href'),
    '/join'
  )
  assert.equal(
    await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((entry) => entry.name.includes('images.unsplash.com'))
    ),
    false
  )
  await page.getByLabel('Your name').fill('Demo')
  await button('Add someone').click()
  await page.getByLabel('Household member 2').fill('Sample')
  await button('Next').click()
  await button(/^Cozy/).click()
  await capture('02-tastes')
  await button('Next').click()
  await button('Peanuts').click()
  await capture('03-avoid')
  await button('Next').click()
  for (const item of ['Rice', 'Olive oil', 'Garlic', 'Eggs', 'Onions', 'Butter'])
    await button(item).click()
  await capture('04-staples')
  await button('Show me tonight').click()
  await page.waitForURL(origin + '/')
  await button(/^Cook this/).waitFor()
  await capture('05-tonight')
  const action = await button(/^Cook this/).boundingBox()
  assert(
    action.y + action.height < page.viewportSize().height,
    'Dinner action should fit on screen'
  )
  console.log('Dinner action y:', Math.round(action.y))
  await page.locator('nav:visible').getByRole('link', { name: 'Pantry', exact: true }).click()
  await page.getByLabel('Add a pantry item').fill('Demo lentils')
  await button('Add to pantry').click()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await button('Demo lentils, options').waitFor()
  await button('Rice, options').waitFor()
  await capture('06-pantry')
  const entry = await page.getByLabel('Add a pantry item').boundingBox()
  assert(entry.width > page.viewportSize().width / 2, 'Pantry input should get most of the row')
  console.log('Pantry input width:', Math.round(entry.width))
  await button('Rice, options').click()
  await page.getByLabel('How much').fill('750')
  const unit = page.getByLabel('Unit', { exact: true })
  await unit.fill('g')
  await unit.blur()
  await button('Close').click()
  await button('Cook from what I have').click()
  const match = page
    .getByRole('dialog')
    .getByRole('link')
    .filter({ hasText: 'Creamy mushroom risotto' })
  const recipePath = await match.getAttribute('href')
  await match.click()
  await page.waitForURL(origin + recipePath)
  const title = await page.locator('h1').innerText()
  await capture('07-recipe')
  await button('Cook').click()
  await page.waitForURL('**/cook/**')
  await capture('08-cook')
  for (let step = 0; step < 30 && (await button('Next step').isVisible()); step++) {
    await page.waitForTimeout(350)
    const progress = await page.getByRole('progressbar').getAttribute('aria-valuenow')
    await button('Next step').click()
    await page.waitForFunction(
      (old) =>
        document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') !== old,
      progress
    )
  }
  await page.waitForTimeout(350)
  await button('Done').click()
  await button('Finish').click()
  await page.waitForURL(origin + '/')
  await visit('/history')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText(title, { exact: true }).first().waitFor()
  await capture('09-history')
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('plantry-v1')).state)
  assert.equal(stored.cooked.length, 1)
  assert.equal(stored.cooked[0].recipeId, recipePath.split('/').pop())
  assert(stored.plan.some((entry) => entry.recipeId === stored.cooked[0].recipeId && entry.done))
  assert(stored.pantry.some((item) => item.name === 'Demo lentils'))
  const rice = stored.pantry.find((item) => item.key === 'rice')
  assert.equal(rice?.unit, 'g')
  assert.equal(rice.quantity, 600, 'Two portions of risotto should use 150 g of rice')
  for (const path of [
    '/week',
    '/shop',
    '/recipes',
    '/recipes/new',
    '/household',
    '/settings',
    '/join',
  ]) {
    await visit(path)
    await capture(path.slice(1).replace('/', '-'))
  }
  await visit('/not-a-plantry-route', 404)
  await capture('not-found')
  await visit('/move.html#t=' + '0'.repeat(32))
  await capture('move-confirm')
  assert.deepEqual(errors, [])
  console.log('PASS pantry → dinner → persisted history:', title)
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png') })
  console.error('Last screen:', await page.locator('body').innerText())
  throw error
} finally {
  await browser.close()
}
