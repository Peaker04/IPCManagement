import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '../../node_modules/@playwright/test/index.mjs'

const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required.')
const root = path.resolve('.artifacts/shipyard-live', process.env.IPC_SERVICE_RUN_E2E_RUN ?? 'service-run-reports-20260805')
await fs.mkdir(root, { recursive: true })
const evidence = { headed: true, runtime: { baseUrl: 'http://127.0.0.1:3010', database: 'ipc_e2e_template' }, api: [], consoleErrors: [], pageErrors: [], requestFailures: [] }
const context = await chromium.launchPersistentContext(path.resolve('.artifacts/browser-use-service-run-reports'), { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, viewport: { width: 1365, height: 900 }, args: ['--window-size=1365,900'] })
const page = context.pages()[0] ?? await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => evidence.pageErrors.push(error.message))
page.on('requestfailed', (request) => evidence.requestFailures.push(new URL(request.url()).pathname))
page.on('response', async (response) => {
  if (new URL(response.url()).pathname !== '/api/service-runs/page') return
  evidence.api.push({ status: response.status(), method: response.request().method() })
  if (response.status() !== 200) return
  const payload = await response.json().catch(() => null)
  const rows = payload?.data?.items ?? []
  const costRows = rows.map((row) => ({ planCode: row.lifecycle?.planCode, estimatedPurchaseCost: row.estimatedPurchaseCost, actualReceivedCost: row.actualReceivedCost, hasActualReceivedCost: Object.hasOwn(row, 'actualReceivedCost') }))
  evidence.costProjection = costRows
})
try {
  await page.goto('http://127.0.0.1:3010/login'); await page.waitForLoadState('networkidle').catch(() => {})
  if (await page.locator('#username').isVisible().catch(() => false)) {
    await page.locator('#username').fill('admin'); await page.locator('#password').fill(password)
    await Promise.all([page.waitForURL((url) => url.pathname !== '/login'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  }
  await page.goto('http://127.0.0.1:3010/reports?view=audit'); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(400)
  await page.getByText('Ca phục vụ và chứng từ nguồn', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByText('KHSX-E2E-SERVICE-RUN-20260808', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByText('Ước tính:', { exact: false }).first().waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: path.join(root, 'service-run-report-reload.png'), fullPage: true })
  evidence.performance = await page.evaluate(() => ({ cls: performance.getEntriesByType('layout-shift').filter((entry) => !(entry).hadRecentInput).reduce((sum, entry) => sum + (entry).value, 0), longTaskCount: performance.getEntriesByType('longtask').length }))
  if (evidence.api.some((entry) => entry.status !== 200)) throw new Error(`Service Run report API failed: ${JSON.stringify(evidence.api)}`)
  if (!evidence.costProjection?.some((row) => typeof row.estimatedPurchaseCost === 'number' && row.hasActualReceivedCost)) throw new Error(`Service Run cost projection is incomplete: ${JSON.stringify(evidence.costProjection)}`)
} catch (error) { evidence.failure = error instanceof Error ? error.message : String(error); throw error } finally { await fs.writeFile(path.join(root, 'service-run-reports-e2e.json'), `${JSON.stringify(evidence, null, 2)}\n`); await context.close() }
