import { test, expect } from '@playwright/test'

/**
 * E2E tests for Cartografía Estética v2.
 *
 * Strategy: lightweight functional checks against DOM-observable behaviour.
 * The app has two phases — intro (scrollytelling) and map — so tests cover
 * both the transition and the interactive map state.
 *
 * Validates: Requirements 4.1–4.5, 5.1–5.5, 6.1–6.4, 7.1–7.6, 9.1–9.4, 14.1–14.2
 */

test.describe('Cartografía Estética', () => {
  let consoleErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    page.on('console', msg => {
      // Ignore expected fallback warnings from ScoreEngine
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', err => consoleErrors.push(err.message))
    await page.goto('/')
  })

  // ── Intro ──────────────────────────────────────────────────────────────────

  test('intro: first screen is visible on load', async ({ page }) => {
    // The scrollytelling wrapper should be present
    const intro = page.locator('#scrollytelling-intro')
    await expect(intro).toBeVisible()

    // Screen 1 must contain the problem statement title
    const screen1 = page.locator('#screen-1')
    await expect(screen1).toBeVisible()
    await expect(screen1).toContainText('El problema de estudiar Arte y Estética')

    // Map must be hidden until the user clicks CTA
    const map = page.locator('#map-container')
    await expect(map).toBeHidden()

    expect(consoleErrors).toHaveLength(0)
  })

  test('intro: three screens exist', async ({ page }) => {
    await expect(page.locator('#screen-1')).toBeAttached()
    await expect(page.locator('#screen-2')).toBeAttached()
    await expect(page.locator('#screen-3')).toBeAttached()

    // Screen 2 has the layers diagram
    await expect(page.locator('#screen-2')).toContainText('Tres capas de lectura')

    // Screen 3 has the CTA button
    const cta = page.locator('#cta-enter-map')
    await expect(cta).toBeAttached()
    await expect(cta).toContainText('Entra al mapa')

    expect(consoleErrors).toHaveLength(0)
  })

  // ── Intro → Map transition ─────────────────────────────────────────────────

  test('transition: clicking CTA hides intro and shows map with nodes', async ({ page }) => {
    // Scroll to screen 3 and click the CTA
    await page.locator('#cta-enter-map').scrollIntoViewIfNeeded()
    await page.locator('#cta-enter-map').click()

    // Intro should be gone
    await expect(page.locator('#scrollytelling-intro')).not.toBeAttached()

    // Map container should now be visible
    const map = page.locator('#map-container')
    await expect(map).toBeVisible()

    // Wait for data to load: lens panel buttons appear after fetch completes
    await expect(page.locator('#lens-panel button').first()).toBeVisible({ timeout: 10000 })

    // SVG network should have faro nodes (triangles)
    const faroNodes = page.locator('.faro-node')
    await expect(faroNodes.first()).toBeVisible()

    // At least one archipielago node (circle) should be present
    const archNodes = page.locator('.arch-node')
    await expect(archNodes.first()).toBeVisible()

    expect(consoleErrors).toHaveLength(0)
  })

  // ── Map: UI components ─────────────────────────────────────────────────────

  test('map: lens panel and region filter are populated after data load', async ({ page }) => {
    await page.locator('#cta-enter-map').scrollIntoViewIfNeeded()
    await page.locator('#cta-enter-map').click()

    // Wait for map to be visible
    await expect(page.locator('#map-container')).toBeVisible()

    // Lens panel must have buttons (at least "Sin filtro" + 1 lens)
    const lensButtons = page.locator('#lens-panel button')
    await expect(lensButtons.first()).toBeVisible({ timeout: 10000 })
    const lensCount = await lensButtons.count()
    expect(lensCount).toBeGreaterThan(1)

    // Region filter must have buttons
    const regionButtons = page.locator('#region-filter button')
    await expect(regionButtons.first()).toBeVisible()
    const regionCount = await regionButtons.count()
    expect(regionCount).toBeGreaterThan(0)

    // Info panel must be visible with default content
    await expect(page.locator('#info-panel')).toBeVisible()

    // Formula display must be visible
    await expect(page.locator('#formula-display')).toContainText('vista')

    expect(consoleErrors).toHaveLength(0)
  })

  // ── Map: lens interaction ──────────────────────────────────────────────────

  test('map: clicking a lens button marks it active and updates edges', async ({ page }) => {
    await page.locator('#cta-enter-map').scrollIntoViewIfNeeded()
    await page.locator('#cta-enter-map').click()

    // Wait for data to load
    await expect(page.locator('#lens-panel button').first()).toBeVisible({ timeout: 10000 })

    // Click the second lens button (first real lens, after "Sin filtro")
    const lensButtons = page.locator('#lens-panel button')
    const secondLens = lensButtons.nth(1)
    await secondLens.click()

    // That button should now have the active class
    await expect(secondLens).toHaveClass(/active/)

    // "Sin filtro" should no longer be active
    await expect(lensButtons.first()).not.toHaveClass(/active/)

    // Info panel should update (show lens info)
    await expect(page.locator('#info-panel')).not.toBeEmpty()

    expect(consoleErrors).toHaveLength(0)
  })

  // ── Map: node click ────────────────────────────────────────────────────────

  test('map: clicking a faro node updates the info panel', async ({ page }) => {
    await page.locator('#cta-enter-map').scrollIntoViewIfNeeded()
    await page.locator('#cta-enter-map').click()

    // Wait for data to load
    await expect(page.locator('#lens-panel button').first()).toBeVisible({ timeout: 10000 })

    const firstFaro = page.locator('.faro-node').first()
    await expect(firstFaro).toBeVisible()

    // Capture default info panel text
    const defaultText = await page.locator('#info-panel').textContent()

    // Click the faro node — use force to bypass any overlapping UI panels
    await firstFaro.click({ force: true })

    // Info panel should have changed
    const updatedText = await page.locator('#info-panel').textContent()
    expect(updatedText).not.toBe(defaultText)

    // Panel should show a name (non-empty title)
    const infoName = page.locator('#info-panel .info-panel__title')
    await expect(infoName).not.toBeEmpty()

    expect(consoleErrors).toHaveLength(0)
  })
})
