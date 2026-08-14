import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { conditionalTableFixtures } from './conditionalTableFixture'
import { login } from './support/route-smoke/auth'

const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1365x900', width: 1365, height: 900 },
  { name: '1280x900', width: 1280, height: 900 },
] as const

type RenderRecord = {
  ownerId: string
  viewport: string
  route: string
  regionLabel: string
  tableLayout: string
  rowCount: number
  nonReadRequests: string[]
  apiResponseCount: number
  apiNon2xx: string[]
  consoleErrors: string[]
  pageErrors: string[]
  cls: number
  longTasks: number[]
}

const records: RenderRecord[] = []

const stubReadOnlyApi = async (page: Page) => {
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const request = route.request()
    if (request.method() !== 'GET') {
      await route.abort('blockedbyclient')
      return
    }
    const pathname = new URL(request.url()).pathname
    const emptyPage = { items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0, hasPrev: false, hasNext: false }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: pathname.endsWith('/page') ? emptyPage : [] }),
    })
  })
}

const openOwner = async (page: Page, fixture: typeof conditionalTableFixtures[number]) => {
  const query = new URLSearchParams({ view: fixture.view })
  if (fixture.id.startsWith('reports-price-')) query.set('subview', fixture.id.replace('reports-price-', ''))
  await page.goto(`${fixture.route}?${query}`)

  if (fixture.id === 'admin-bom-current') {
    const tab = page.getByRole('tab', { name: 'BOM hiện tại' })
    if (await tab.count()) await tab.click()
  }
  if (fixture.id === 'admin-bom-preview') {
    await page.getByRole('tab', { name: 'Bản xem trước' }).click()
  }

  const region = page.getByRole('region', { name: fixture.regionLabel })
  await expect(region, fixture.id).toBeVisible()
  const table = region.locator('table').first()
  await expect(table, fixture.id).toBeVisible()
  await expect(table, fixture.id).toHaveCSS('table-layout', 'fixed')
  return table
}

test.describe('Wave 2 conditional table production rendering', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 })

  test.afterAll(() => {
    const output = path.resolve(process.cwd(), '../.artifacts/shipyard-live/phase05-wave2-conditional-table-render-20260814.json')
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, JSON.stringify({
      schemaVersion: 1,
      semantics: 'production components with intercepted read-only API; not backend/DB E2E',
      ownerCount: conditionalTableFixtures.length,
      viewportCount: viewports.length,
      expectedRecordCount: conditionalTableFixtures.length * viewports.length,
      recordCount: records.length,
      mutationRequests: records.flatMap((record) => record.nonReadRequests).length,
      apiNon2xx: records.flatMap((record) => record.apiNon2xx).length,
      consoleErrors: records.flatMap((record) => record.consoleErrors).length,
      pageErrors: records.flatMap((record) => record.pageErrors).length,
      records,
    }, null, 2))
  })

  for (const viewport of viewports) {
    test(`renders all 16 source owners at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      const nonReadRequests: string[] = []
      const apiResponses: string[] = []
      const consoleErrors: string[] = []
      const pageErrors: string[] = []
      await page.addInitScript(() => {
        const metrics = { cls: 0, longTasks: [] as number[] }
        Object.defineProperty(window, '__wave2Metrics', { value: metrics, configurable: true })
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) metrics.longTasks.push(entry.duration)
        }).observe({ type: 'longtask', buffered: true })
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
            if (!entry.hadRecentInput) metrics.cls += entry.value ?? 0
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })
      page.on('request', (request) => {
        if (request.url().includes('/api/') && request.method() !== 'GET') {
          nonReadRequests.push(`${request.method()} ${new URL(request.url()).pathname}`)
        }
      })
      page.on('response', (response) => {
        if (response.url().includes('/api/')) apiResponses.push(`${response.status()} ${new URL(response.url()).pathname}`)
      })
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await stubReadOnlyApi(page)
      await login(page)
      nonReadRequests.length = 0

      for (const fixture of conditionalTableFixtures) {
        const apiStart = apiResponses.length
        const consoleStart = consoleErrors.length
        const pageErrorStart = pageErrors.length
        const table = await openOwner(page, fixture)
        const metrics = await page.evaluate(() => (window as Window & { __wave2Metrics?: { cls: number; longTasks: number[] } }).__wave2Metrics ?? { cls: 0, longTasks: [] })
        const ownerResponses = apiResponses.slice(apiStart)
        records.push({
          ownerId: fixture.id,
          viewport: viewport.name,
          route: `${fixture.route}?view=${fixture.view}`,
          regionLabel: fixture.regionLabel,
          tableLayout: await table.evaluate((element) => getComputedStyle(element).tableLayout),
          rowCount: await table.locator('tbody tr').count(),
          nonReadRequests: [...nonReadRequests],
          apiResponseCount: ownerResponses.length,
          apiNon2xx: ownerResponses.filter((entry) => !entry.startsWith('200 ')),
          consoleErrors: consoleErrors.slice(consoleStart),
          pageErrors: pageErrors.slice(pageErrorStart),
          cls: metrics.cls,
          longTasks: metrics.longTasks,
        })
        expect(nonReadRequests, fixture.id).toEqual([])
        expect(ownerResponses.filter((entry) => !entry.startsWith('200 ')), fixture.id).toEqual([])
        expect(consoleErrors.slice(consoleStart), fixture.id).toEqual([])
        expect(pageErrors.slice(pageErrorStart), fixture.id).toEqual([])
      }
      const screenshotPath = path.resolve(process.cwd(), `../.artifacts/shipyard-live/phase05-wave2-conditional-table-${viewport.name}-20260814.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true })
    })
  }
})
