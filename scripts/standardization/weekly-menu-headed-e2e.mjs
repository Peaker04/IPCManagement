import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '../../node_modules/@playwright/test/index.mjs'

const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required; default credentials are prohibited.')

const baseUrl = 'http://127.0.0.1:3010'
const apiUrl = 'http://127.0.0.1:8010'
const database = 'ipc_e2e_template'
const weekStartDate = '2030-01-07'
const root = path.resolve('.artifacts/shipyard-live/standardization-phase6-20260803')
const workbookRoot = path.join(root, 'workbooks')
const profile = path.resolve('.artifacts/browser-use-standardization-phase6-20260803')
const sourceWorkbook = 'C:/Users/Administrator/Pictures/weekly-menu-template-ANV-default.xlsx'
const expectedSourceHash = 'A7E734CEFBD409E7220C4FF19B3E1B7FDDD4E33D202A3F24E63309D60D4D5A01'
const workbooks = {
  anv: path.join(workbookRoot, 'valid-anv-2030-01-07.xlsx'),
  dav: path.join(workbookRoot, 'valid-dav-2030-01-07.xlsx'),
  malformed: path.join(workbookRoot, 'malformed-not-xlsx.xlsx'),
  mismatch: path.join(workbookRoot, 'mismatched-after-preview.xlsx'),
}
const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1365x900', width: 1365, height: 900 },
  { name: '1280x900', width: 1280, height: 900 },
]

await fs.mkdir(root, { recursive: true })
const sha256 = async (file) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex').toUpperCase()
const sourceHashBefore = await sha256(sourceWorkbook)
if (sourceHashBefore !== expectedSourceHash) throw new Error(`Source workbook hash drifted: ${sourceHashBefore}`)

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

const evidence = {
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceWorkbook: { path: sourceWorkbook, sha256Before: sourceHashBefore },
  runtime: { baseUrl, apiUrl, database, credentialSource: 'K6_PASSWORD' },
  headed: true,
  viewports,
  weekStartDate,
  databaseSnapshots: { before: databaseProbe() },
  viewportRuns: [],
  apiResponses: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  expectedFailures: [],
  performance: { longTasks: [], layoutShifts: [] },
}

const sanitizeBody = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeBody)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      /token/i.test(key) ? '[redacted]' : sanitizeBody(child),
    ]))
  }
  return value
}

const context = await chromium.launchPersistentContext(profile, {
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  viewport: { width: viewports[0].width, height: viewports[0].height },
  args: [`--window-size=${viewports[0].width},${viewports[0].height}`],
})
const page = context.pages()[0] ?? await context.newPage()
let activeProbe = 'startup'
const capturedResponses = []

page.on('console', (message) => {
  if (message.type() === 'error') evidence.consoleErrors.push({ probe: activeProbe, text: message.text() })
})
page.on('pageerror', (error) => evidence.pageErrors.push({ probe: activeProbe, message: error.message }))
page.on('requestfailed', (request) => evidence.requestFailures.push({
  probe: activeProbe,
  method: request.method(),
  path: new URL(request.url()).pathname,
  failure: request.failure()?.errorText ?? 'unknown',
}))
page.on('response', async (response) => {
  if (!response.url().includes('/api/')) return
  const pathname = new URL(response.url()).pathname
  const record = { probe: activeProbe, method: response.request().method(), status: response.status(), path: pathname }
  if (pathname.includes('/weekly-menu/import')) {
    const raw = await response.json().catch(() => null)
    record.body = sanitizeBody(raw)
    capturedResponses.push({ ...record, raw })
  }
  evidence.apiResponses.push(record)
})

await page.addInitScript(() => {
  window.__ipcWbqaPerf = { longTasks: [], layoutShifts: [] }
  try {
    new PerformanceObserver((list) => window.__ipcWbqaPerf.longTasks.push(
      ...list.getEntries().map((entry) => ({ startTime: entry.startTime, duration: entry.duration })),
    )).observe({ entryTypes: ['longtask'] })
    new PerformanceObserver((list) => window.__ipcWbqaPerf.layoutShifts.push(
      ...list.getEntries().filter((entry) => !entry.hadRecentInput).map((entry) => entry.value),
    )).observe({ type: 'layout-shift', buffered: true })
  } catch {
    // Unsupported performance entry types remain explicit empty samples.
  }
})

const settle = async () => {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(400)
}
const waitForCaptured = async (start, count, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs
  while (capturedResponses.length - start < count && Date.now() < deadline) await page.waitForTimeout(100)
  if (capturedResponses.length - start < count) throw new Error(`Expected ${count} import response(s), got ${capturedResponses.length - start}.`)
  return capturedResponses.slice(start)
}
const openImportDialog = async () => {
  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
  await dialog.waitFor({ state: 'visible' })
  return dialog
}
const closeImportDialog = async (dialog) => {
  if (!await dialog.isVisible().catch(() => false)) return
  await dialog.getByRole('button', { name: 'Đóng modal nhập thực đơn' }).click()
  await dialog.waitFor({ state: 'hidden' })
}
const selectRadixOption = async (trigger, optionName) => {
  await trigger.click()
  await page.getByRole('option', { name: optionName }).click()
}
const addJob = async (dialog, customerCode, workbook) => {
  await selectRadixOption(dialog.getByRole('combobox', { name: 'Khách hàng' }), new RegExp(`^${customerCode} -`))
  await dialog.getByLabel('Tuần bắt đầu').fill(weekStartDate)
  const tier = dialog.getByRole('combobox', { name: 'Định mức BOM' })
  if ((await tier.textContent())?.trim() !== '25k') await selectRadixOption(tier, '25k')
  await dialog.locator('#weekly-menu-import-file').setInputFiles(workbook)
  await dialog.getByRole('button', { name: 'Thêm file', exact: true }).click()
}
const previewAll = async (dialog, expectedCount) => {
  const start = capturedResponses.length
  await dialog.getByRole('button', { name: 'Kiểm tra tất cả', exact: true }).click()
  return waitForCaptured(start, expectedCount)
}
const assertValidPreview = (responses, customerCode) => {
  const response = responses.find((item) => item.path.endsWith('/preview') && item.raw?.data?.customerCode === customerCode)
    ?? responses.find((item) => item.path.endsWith('/preview'))
  if (!response || response.status !== 200 || response.raw?.data?.validation?.isValid !== true) {
    throw new Error(`${customerCode} preview was not valid: ${JSON.stringify(sanitizeBody(response?.raw))}`)
  }
  return response
}

try {
  activeProbe = 'login'
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

  let lastValidPreview
  for (const viewport of viewports) {
    activeProbe = `valid-preview:${viewport.name}`
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.evaluate(() => {
      window.__ipcWbqaPerf.longTasks.length = 0
      window.__ipcWbqaPerf.layoutShifts.length = 0
    })
    const dialog = await openImportDialog()
    await addJob(dialog, 'ANV', workbooks.anv)
    const responses = await previewAll(dialog, 1)
    lastValidPreview = assertValidPreview(responses, 'ANV')
    const screenshot = `${viewport.name}-valid-anv-preview.png`
    await page.screenshot({ path: path.join(root, screenshot), fullPage: true })
    const metrics = await page.evaluate(() => ({
      cls: window.__ipcWbqaPerf.layoutShifts.reduce((sum, value) => sum + value, 0),
      longTasks: [...window.__ipcWbqaPerf.longTasks],
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      renderedTextLength: document.body.innerText.trim().length,
    }))
    evidence.viewportRuns.push({ viewport: viewport.name, screenshot, previewStatus: lastValidPreview.status, ...metrics })
    await closeImportDialog(dialog)
  }

  const customerId = lastValidPreview.raw?.data?.customerId
  const previewToken = lastValidPreview.raw?.data?.previewToken
  if (!customerId || !previewToken) throw new Error('Valid preview did not return customer scope and preview token.')

  activeProbe = 'malformed'
  let dialog = await openImportDialog()
  await addJob(dialog, 'ANV', workbooks.malformed)
  let responses = await previewAll(dialog, 1)
  const malformedResponse = responses.find((item) => item.path.endsWith('/preview'))
  if (malformedResponse?.status !== 200 ||
      malformedResponse.raw?.data?.validation?.isValid !== false ||
      !malformedResponse.raw?.data?.validation?.issues?.some((issue) => issue.code === 'FILE_READ_ERROR')) {
    throw new Error(`Malformed workbook did not return FILE_READ_ERROR validation: ${JSON.stringify(sanitizeBody(malformedResponse?.raw))}`)
  }
  evidence.expectedFailures.push({ case: 'malformed', status: malformedResponse.status, body: sanitizeBody(malformedResponse.raw) })
  await page.screenshot({ path: path.join(root, '1280x900-malformed-domain-error.png'), fullPage: true })
  await closeImportDialog(dialog)

  activeProbe = 'mismatched-token'
  const accessToken = await page.evaluate(() => window.sessionStorage.getItem('token'))
  if (!accessToken) throw new Error('Authenticated browser session has no access token.')
  const mismatchResponse = await context.request.post(`${apiUrl}/api/coordination/weekly-menu/import/commit`, {
    headers: { authorization: `Bearer ${accessToken}` },
    multipart: {
      file: { name: path.basename(workbooks.mismatch), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await fs.readFile(workbooks.mismatch) },
      customerId,
      weekStartDate,
      priceTierAmount: '25000',
      previewToken,
    },
    timeout: 60_000,
  })
  const mismatchBody = await mismatchResponse.json().catch(() => null)
  if (mismatchResponse.status() !== 400) throw new Error(`Mismatched token expected 400, got ${mismatchResponse.status()}.`)
  evidence.expectedFailures.push({ case: 'mismatched-token', status: mismatchResponse.status(), body: sanitizeBody(mismatchBody) })
  evidence.databaseSnapshots.afterFailures = databaseProbe()

  activeProbe = 'two-customer-atomic-commit'
  dialog = await openImportDialog()
  await addJob(dialog, 'ANV', workbooks.anv)
  await addJob(dialog, 'DAV', workbooks.dav)
  responses = await previewAll(dialog, 2)
  assertValidPreview(responses, 'ANV')
  assertValidPreview(responses, 'DAV')
  const commitStart = capturedResponses.length
  await dialog.getByRole('button', { name: 'Lưu file hợp lệ', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Lưu 2 file hợp lệ?' })
  await confirm.getByRole('button', { name: 'Lưu các file hợp lệ', exact: true }).click()
  const commitResponses = await waitForCaptured(commitStart, 1, 120_000)
  const batch = commitResponses.find((item) => item.path.endsWith('/commit-batch'))
  if (!batch || batch.status !== 200 || batch.raw?.data?.length !== 2) {
    throw new Error(`Atomic batch commit failed: ${JSON.stringify(sanitizeBody(batch?.raw))}`)
  }
  await page.screenshot({ path: path.join(root, '1280x900-two-customer-committed.png'), fullPage: true })
  evidence.databaseSnapshots.afterCommit = databaseProbe()

  await closeImportDialog(dialog)
  activeProbe = 'reload-committed-history'
  await page.reload()
  await settle()
  dialog = await openImportDialog()
  await dialog.getByLabel('Tìm trong lịch sử import thực đơn').fill('07/01/2030')
  const committedHistoryRow = dialog.getByRole('row').filter({ hasText: 'ANV' }).filter({ hasText: '07/01/2030' }).first()
  await committedHistoryRow.waitFor({ timeout: 20_000 })
  const historyText = await dialog.locator('table').last().innerText()
  if (!historyText.includes('ANV') || !historyText.includes('DAV')) throw new Error('Reloaded history did not render both committed customers.')
  await committedHistoryRow.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(root, '1280x900-reload-committed-history.png'), fullPage: true })

  for (const customerCode of ['ANV', 'DAV']) {
    activeProbe = `rollback:${customerCode}`
    const row = dialog.getByRole('row').filter({ hasText: customerCode }).filter({ hasText: '07/01/2030' }).first()
    const rollbackStart = capturedResponses.length
    await row.getByRole('button', { name: 'Rollback', exact: true }).click()
    await page.getByRole('dialog', { name: 'Xác nhận hủy phiên import' })
      .getByRole('button', { name: 'Xác nhận hủy', exact: true }).click()
    const rollbackResponses = await waitForCaptured(rollbackStart, 1)
    const rollback = rollbackResponses.find((item) => item.path.includes('/rollback'))
    if (!rollback || rollback.status !== 200) throw new Error(`${customerCode} rollback failed.`)
  }
  await closeImportDialog(dialog)

  activeProbe = 'reload-rolled-back-history'
  await page.reload()
  await settle()
  dialog = await openImportDialog()
  await dialog.getByLabel('Tìm trong lịch sử import thực đơn').fill('07/01/2030')
  const rolledBackHistoryRow = dialog.getByRole('row').filter({ hasText: 'ANV' }).filter({ hasText: '07/01/2030' }).first()
  await rolledBackHistoryRow.waitFor({ timeout: 20_000 })
  const rollbackHistoryText = await dialog.locator('table').last().innerText()
  if ((rollbackHistoryText.match(/Đã hoàn tác/g) ?? []).length < 2) throw new Error('Reloaded history did not render both rolled-back versions.')
  await rolledBackHistoryRow.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(root, '1280x900-reload-rolled-back-history.png'), fullPage: true })
  await closeImportDialog(dialog)
  evidence.databaseSnapshots.afterRollback = databaseProbe()

  const sourceHashAfter = await sha256(sourceWorkbook)
  evidence.sourceWorkbook.sha256After = sourceHashAfter
  evidence.sourceWorkbook.unchanged = sourceHashAfter === sourceHashBefore
  if (!evidence.sourceWorkbook.unchanged) throw new Error('Source workbook changed during browser verification.')

  const afterFailures = evidence.databaseSnapshots.afterFailures.Customers
  if (afterFailures.some((item) => item.MenuVersionCount || item.MenuScheduleCount || item.TierCount)) {
    throw new Error('Malformed or mismatched-token case changed database state.')
  }
  const afterCommit = evidence.databaseSnapshots.afterCommit.Customers
  if (afterCommit.length !== 2 || afterCommit.some((item) => item.MenuVersionCount !== 1 || item.MenuScheduleCount === 0 || item.TierCount !== 1 || item.Statuses !== 'DRAFT')) {
    throw new Error(`Atomic commit database snapshot is incomplete: ${JSON.stringify(afterCommit)}`)
  }
  const afterRollback = evidence.databaseSnapshots.afterRollback.Customers
  if (afterRollback.some((item) => item.MenuScheduleCount !== 0 || item.TierCount !== 0 || item.Statuses !== 'ROLLED_BACK')) {
    throw new Error(`Rollback database snapshot is incomplete: ${JSON.stringify(afterRollback)}`)
  }
  if (evidence.viewportRuns.some((run) => run.horizontalOverflow || run.renderedTextLength === 0)) {
    throw new Error('A viewport had horizontal document overflow or empty render.')
  }
  const unexpectedConsole = evidence.consoleErrors.filter((item) => !(item.probe === 'malformed' && item.text.includes('400')))
  const unexpectedFailures = evidence.requestFailures.filter((item) => item.failure !== 'net::ERR_ABORTED')
  if (unexpectedConsole.length || evidence.pageErrors.length || unexpectedFailures.length) {
    throw new Error('Unexpected browser console/page/request errors were observed.')
  }

  evidence.finishedAt = new Date().toISOString()
  evidence.summary = {
    viewportCount: evidence.viewportRuns.length,
    screenshotCount: 9,
    expectedFailureCount: evidence.expectedFailures.length,
    apiResponseCount: evidence.apiResponses.length,
    consoleErrorCount: evidence.consoleErrors.length,
    pageErrorCount: evidence.pageErrors.length,
    requestFailureCount: evidence.requestFailures.length,
    longTaskCount: evidence.viewportRuns.reduce((sum, item) => sum + item.longTasks.length, 0),
    maxCls: Math.max(...evidence.viewportRuns.map((item) => item.cls)),
    sourceWorkbookUnchanged: evidence.sourceWorkbook.unchanged,
  }
  await fs.writeFile(path.join(root, 'phase6-headed-workbook-e2e.json'), JSON.stringify(evidence, null, 2))
} catch (error) {
  evidence.finishedAt = new Date().toISOString()
  evidence.fatalError = String(error?.stack ?? error)
  await fs.writeFile(path.join(root, 'phase6-headed-workbook-e2e-error.json'), JSON.stringify(evidence, null, 2))
  await page.screenshot({ path: path.join(root, 'phase6-headed-workbook-e2e-error.png'), fullPage: true }).catch(() => {})
  throw error
} finally {
  await context.close()
}
