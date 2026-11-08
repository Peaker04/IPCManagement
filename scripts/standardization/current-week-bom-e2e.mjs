import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '../../node_modules/@playwright/test/index.mjs'

const password = process.env.K6_PASSWORD
const workbook = process.env.IPC_CURRENT_WEEK_BOM_WORKBOOK
const runName = process.env.IPC_CURRENT_WEEK_BOM_RUN ?? 'current-week-bom-e2e-20260804'
const mode = process.env.IPC_CURRENT_WEEK_BOM_MODE ?? 'import'
if (!password) throw new Error('K6_PASSWORD is required; default credentials are prohibited.')
if (!workbook) throw new Error('IPC_CURRENT_WEEK_BOM_WORKBOOK is required.')
if (!/^[a-z0-9][a-z0-9-]*$/i.test(runName)) throw new Error('IPC_CURRENT_WEEK_BOM_RUN must contain only letters, numbers, and hyphens.')
if (!['import', 'verify'].includes(mode)) throw new Error('IPC_CURRENT_WEEK_BOM_MODE must be import or verify.')

const baseUrl = 'http://127.0.0.1:3010'
const apiUrl = 'http://127.0.0.1:8010'
const database = 'ipc_e2e_template'
const weekStartDate = '2026-08-03'
const customerCode = 'ANV'
const missingBomDish = 'Món E2E thiếu BOM tuần 20260803'
const completeBomDish = 'Thịt heo kho sả ruốc'
const root = path.resolve('.artifacts/shipyard-live', runName)
const profile = path.resolve('.artifacts/browser-use-current-week-bom-e2e')

await fs.mkdir(root, { recursive: true })
const sha256 = async (file) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex').toUpperCase()
const databaseProbe = () => {
  const output = execFileSync('dotnet', [
    'run', '--project', 'backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj', '--no-build', '--',
    'weekly-menu-evidence', '--settings', 'backend/src/IPCManagement.Api/appsettings.json',
    '--database', database, '--week', weekStartDate,
  ], { cwd: path.resolve('.'), encoding: 'utf8' })
  const jsonLine = output.split(/\r?\n/).findLast((line) => line.trim().startsWith('{'))
  if (!jsonLine) throw new Error(`Database probe returned no JSON: ${output}`)
  return JSON.parse(jsonLine)
}
const sanitize = (value) => {
  if (Array.isArray(value)) return value.map(sanitize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key, /token|password/i.test(key) ? '[redacted]' : sanitize(child),
  ]))
  return value
}
const findCustomer = (probe) => probe.Customers.find((item) => item.CustomerCode === customerCode)
const before = databaseProbe()
const beforeCustomer = findCustomer(before)
if (mode === 'import' && (!beforeCustomer || beforeCustomer.MenuVersionCount || beforeCustomer.MenuScheduleCount || beforeCustomer.TierCount)) {
  throw new Error(`Refusing to import into a non-empty ${customerCode} scope: ${JSON.stringify(beforeCustomer)}`)
}
const workbookHashBefore = await sha256(workbook)
const evidence = {
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  runtime: { baseUrl, apiUrl, database, credentialSource: 'K6_PASSWORD' },
  headed: true,
  mode,
  weekStartDate,
  customerCode,
  workbook: { path: workbook, sha256Before: workbookHashBefore },
  databaseSnapshots: { before },
  apiResponses: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  performance: { longTasks: [], layoutShifts: [] },
}

const context = await chromium.launchPersistentContext(profile, {
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  viewport: { width: 1365, height: 900 },
  args: ['--window-size=1365,900'],
})
const page = context.pages()[0] ?? await context.newPage()
let probe = 'startup'
const importResponses = []
page.on('console', (message) => {
  if (message.type() === 'error') evidence.consoleErrors.push({ probe, text: message.text() })
})
page.on('pageerror', (error) => evidence.pageErrors.push({ probe, message: error.message }))
page.on('requestfailed', (request) => evidence.requestFailures.push({
  probe, method: request.method(), path: new URL(request.url()).pathname, failure: request.failure()?.errorText ?? 'unknown',
}))
page.on('response', async (response) => {
  const url = new URL(response.url())
  if (!url.pathname.startsWith('/api/')) return
  const record = { probe, method: response.request().method(), status: response.status(), path: url.pathname }
  if ([
    '/api/coordination/weekly-menu/import/preview',
    '/api/coordination/weekly-menu/import/commit',
    '/api/coordination/weekly-menu/import/commit-batch',
    '/api/coordination/weekly-menu/import/rollback',
  ].includes(url.pathname)) {
    const raw = await response.json().catch(() => null)
    record.body = sanitize(raw)
    importResponses.push({ ...record, raw })
  }
  evidence.apiResponses.push(record)
})
await page.addInitScript(() => {
  window.__ipcCurrentWeekBomPerf = { longTasks: [], layoutShifts: [] }
  try {
    new PerformanceObserver((list) => window.__ipcCurrentWeekBomPerf.longTasks.push(
      ...list.getEntries().map((entry) => ({ startTime: entry.startTime, duration: entry.duration })),
    )).observe({ entryTypes: ['longtask'] })
    new PerformanceObserver((list) => window.__ipcCurrentWeekBomPerf.layoutShifts.push(
      ...list.getEntries().filter((entry) => !entry.hadRecentInput).map((entry) => entry.value),
    )).observe({ type: 'layout-shift', buffered: true })
  } catch {
    // Unsupported browser metrics remain explicit empty samples.
  }
})
const settle = async () => {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(350)
}
const waitForImportResponse = async (start, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs
  while (importResponses.length <= start && Date.now() < deadline) await page.waitForTimeout(100)
  if (importResponses.length <= start) throw new Error('Timed out waiting for the import response.')
  return importResponses.at(-1)
}
const selectOption = async (trigger, optionName) => {
  await trigger.click()
  await page.getByRole('option', { name: optionName }).click()
}

try {
  probe = 'login'
  await page.goto(`${baseUrl}/login`)
  await settle()
  if (await page.locator('#username').isVisible().catch(() => false)) {
    await page.locator('#username').fill('admin')
    await page.locator('#password').fill(password)
    await Promise.all([
      page.waitForURL((url) => url.pathname !== '/login', { timeout: 20_000 }),
      page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
    ])
  }

  await page.goto(`${baseUrl}/weekly-menu`)
  await settle()
  if (mode === 'import') {
    probe = 'import-preview'
    await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
    await dialog.waitFor({ state: 'visible' })
    await selectOption(dialog.getByRole('combobox', { name: 'Khách hàng' }), new RegExp(`^${customerCode} -`))
    await dialog.getByLabel('Tuần bắt đầu').fill(weekStartDate)
    const tier = dialog.getByRole('combobox', { name: 'Định mức BOM' })
    if ((await tier.textContent())?.trim() !== '25k') await selectOption(tier, '25k')
    await dialog.locator('#weekly-menu-import-file').setInputFiles(workbook)
    await dialog.getByRole('button', { name: 'Thêm file', exact: true }).click()
    const previewStart = importResponses.length
    await dialog.getByRole('button', { name: 'Kiểm tra tất cả', exact: true }).click()
    const preview = await waitForImportResponse(previewStart)
    if (preview.status !== 200 || preview.raw?.data?.validation?.isValid !== true) {
      throw new Error(`Current-week preview is invalid: ${JSON.stringify(sanitize(preview.raw))}`)
    }
    const previewRows = preview.raw.data.rows ?? []
    const missingPreview = previewRows.find((row) => row.dishName === missingBomDish)
    const completePreview = previewRows.find((row) => row.dishName === completeBomDish)
    if (!missingPreview || missingPreview.existingDish !== false || !completePreview || completePreview.existingDish !== true) {
      throw new Error('Preview does not contain the expected missing-BOM and complete-BOM dishes.')
    }
    await page.screenshot({ path: path.join(root, '1365x900-import-preview.png'), fullPage: true })

    probe = 'import-commit'
    const commitStart = importResponses.length
    await dialog.getByRole('button', { name: 'Lưu file hợp lệ', exact: true }).click()
    await page.getByRole('dialog', { name: /Lưu 1 file hợp lệ/ })
      .getByRole('button', { name: 'Lưu các file hợp lệ', exact: true }).click()
    const commit = await waitForImportResponse(commitStart, 120_000)
    const committedResult = Array.isArray(commit.raw?.data) ? commit.raw.data[0] : commit.raw?.data
    if (commit.status !== 200 || !committedResult || committedResult?.counts?.dishesCreated < 1) {
      throw new Error(`Current-week commit did not create the missing-BOM dish: ${JSON.stringify(sanitize(commit.raw))}`)
    }
    await page.screenshot({ path: path.join(root, '1365x900-import-committed.png'), fullPage: true })
    const closeImportDialog = dialog.getByRole('button', { name: 'Đóng modal nhập thực đơn' })
    if (await closeImportDialog.isVisible().catch(() => false)) await closeImportDialog.click()
  }

  probe = 'reload-and-coverage'
  await page.reload()
  await settle()
  await page.getByText(missingBomDish, { exact: true }).first().waitFor({ state: 'visible', timeout: 20_000 })
  const accessToken = await page.evaluate(() => window.sessionStorage.getItem('token'))
  if (!accessToken) throw new Error('Authenticated browser session has no access token.')
  const coverageResponse = await context.request.get(`${apiUrl}/api/Dishes/bom-coverage`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const coverageBody = await coverageResponse.json().catch(() => null)
  const coverageDishes = coverageBody?.data?.dishes ?? []
  const missingCoverage = coverageDishes.find((dish) => dish.dishName === missingBomDish)
  const completeCoverage = coverageDishes.find((dish) => dish.dishName === completeBomDish)
  evidence.bomCoverage = {
    status: coverageResponse.status(),
    totalDishes: coverageBody?.data?.totalDishes,
    completeDishes: coverageBody?.data?.completeDishes,
    missingBomDishes: coverageBody?.data?.missingBomDishes,
    missingDish: sanitize(missingCoverage),
    completeDish: sanitize(completeCoverage),
  }
  if (coverageResponse.status() !== 200 || missingCoverage?.hasBom !== false || completeCoverage?.hasBom !== true) {
    throw new Error('BOM coverage does not expose both expected branches after reload.')
  }
  evidence.databaseSnapshots.afterCommit = databaseProbe()
  const afterCustomer = findCustomer(evidence.databaseSnapshots.afterCommit)
  if (!afterCustomer || afterCustomer.MenuVersionCount !== 1 || afterCustomer.MenuScheduleCount !== 12 || afterCustomer.TierCount !== 1 || afterCustomer.Statuses !== 'DRAFT') {
    throw new Error(`Current-week database snapshot is incomplete: ${JSON.stringify(afterCustomer)}`)
  }
  const metrics = await page.evaluate(() => ({
    cls: window.__ipcCurrentWeekBomPerf.layoutShifts.reduce((sum, value) => sum + value, 0),
    longTasks: [...window.__ipcCurrentWeekBomPerf.longTasks],
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }))
  evidence.performance.layoutShifts = metrics.cls
  evidence.performance.longTasks = metrics.longTasks
  evidence.horizontalOverflow = metrics.horizontalOverflow
  if (metrics.horizontalOverflow) throw new Error('Current-week menu reload has horizontal overflow.')
  await page.screenshot({ path: path.join(root, '1365x900-reload-bom-coverage.png'), fullPage: true })

  evidence.workbook.sha256After = await sha256(workbook)
  evidence.workbook.unchanged = evidence.workbook.sha256After === workbookHashBefore
  if (!evidence.workbook.unchanged) throw new Error('Workbook changed during E2E import.')
  const unexpectedRequestFailures = evidence.requestFailures.filter((failure) => failure.failure !== 'net::ERR_ABORTED')
  if (evidence.consoleErrors.length || evidence.pageErrors.length || unexpectedRequestFailures.length) {
    throw new Error('Unexpected browser errors were observed.')
  }
  evidence.completedAt = new Date().toISOString()
  await fs.writeFile(path.join(root, 'current-week-bom-e2e.json'), JSON.stringify(evidence, null, 2))
  console.log(`EVIDENCE=${path.join(root, 'current-week-bom-e2e.json')}`)
} catch (error) {
  evidence.failedAt = new Date().toISOString()
  evidence.error = error instanceof Error ? error.message : String(error)
  await fs.writeFile(path.join(root, 'current-week-bom-e2e-error.json'), JSON.stringify(evidence, null, 2))
  await page.screenshot({ path: path.join(root, 'current-week-bom-e2e-error.png'), fullPage: true }).catch(() => {})
  throw error
} finally {
  await context.close()
}
