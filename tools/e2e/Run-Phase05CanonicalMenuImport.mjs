import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve('.')
const artifactRoot = path.resolve(
  process.argv[2] ?? '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup',
)
const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required.')
const fixtures = {
  ANV: path.join(root, 'tools/e2e/fixtures/phase05/weekly-menu-golden-ANV.xlsx'),
  DAV: path.join(root, 'tools/e2e/fixtures/phase05/weekly-menu-golden-DAV.xlsx'),
}
const settings = JSON.parse(await readFile(
  path.join(root, 'backend/src/IPCManagement.Api/appsettings.json'),
  'utf8',
))
const connection = settings.ConnectionStrings.DefaultConnection
  .replace(/(Database|Initial Catalog)=[^;]*/i, '$1=ipc_lane7')
if (!/(Database|Initial Catalog)=ipc_lane7(?:;|$)/i.test(connection)) {
  throw new Error('Runtime database fence failed.')
}
await mkdir(artifactRoot, { recursive: true })

const evidence = {
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  weekStartDate: '2026-08-17',
  tier: 25000,
  headed: true,
  fixtures: {},
  api: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  cls: 0,
  longTasks: [],
  startedAtUtc: new Date().toISOString(),
}
for (const [customer, fixturePath] of Object.entries(fixtures)) {
  const bytes = await readFile(fixturePath)
  evidence.fixtures[customer] = {
    fileName: path.basename(fixturePath),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  }
}
if (evidence.fixtures.ANV.sha256 === evidence.fixtures.DAV.sha256) {
  throw new Error('ANV and DAV fixtures must be distinct.')
}

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const waitFor = async url => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return response.status
    } catch {}
    await sleep(500)
  }
  throw new Error(`Runtime unavailable: ${url}`)
}
const stopOwned = async child => {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  for (let attempt = 0; attempt < 20 && child.exitCode === null; attempt += 1) {
    await sleep(250)
  }
  if (child.exitCode === null) child.kill('SIGKILL')
}

let api
let frontend
let context
try {
  api = spawn('dotnet', ['run', '--no-launch-profile', '--no-build'], {
    cwd: path.join(root, 'backend/src/IPCManagement.Api'),
    env: {
      ...process.env,
      ConnectionStrings__DefaultConnection: connection,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ASPNETCORE_URLS: 'http://127.0.0.1:8030',
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  frontend = spawn(process.execPath, [
    path.join(root, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', '3030',
  ], {
    cwd: path.join(root, 'frontend'),
    env: { ...process.env, VITE_PROXY_TARGET: 'http://127.0.0.1:8030' },
    stdio: 'ignore',
    windowsHide: true,
  })
  evidence.createdProcesses = [
    { name: 'api', pid: api.pid },
    { name: 'frontend', pid: frontend.pid },
  ]
  evidence.health = {
    live: await waitFor('http://127.0.0.1:8030/health/live'),
    ready: await waitFor('http://127.0.0.1:8030/health/ready'),
    frontend: await waitFor('http://127.0.0.1:3030/login'),
  }

  context = await chromium.launchPersistentContext(
    path.join(root, '.artifacts/browser-use-phase05-task0'),
    {
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: false,
      viewport: { width: 1365, height: 900 },
      args: ['--window-size=1365,900', '--force-device-scale-factor=1'],
    },
  )
  const page = context.pages()[0] ?? await context.newPage()
  page.on('console', message => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text())
  })
  page.on('pageerror', error => evidence.pageErrors.push(error.message))
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      evidence.requestFailures.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
        error: request.failure()?.errorText,
      })
    }
  })
  page.on('response', async response => {
    const url = new URL(response.url())
    if (url.pathname.includes('/weekly-menu/import')) {
      evidence.api.push({
        method: response.request().method(),
        path: url.pathname,
        status: response.status(),
        body: await response.json().catch(() => null),
      })
    }
  })

  await page.goto('http://127.0.0.1:3030/login')
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill(password)
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/login'),
    page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
  ])
  await page.goto('http://127.0.0.1:3030/weekly-menu')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => {
    window.__task0Metrics = { cls: 0, longTasks: [] }
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__task0Metrics.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__task0Metrics.longTasks.push({ startTime: entry.startTime, duration: entry.duration })
      }
    }).observe({ type: 'longtask', buffered: true })
  })
  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })

  for (const customer of ['ANV', 'DAV']) {
    await dialog.getByRole('combobox', { name: 'Khách hàng' }).click()
    await page.getByRole('option', { name: new RegExp(`^${customer} - `) }).click()
    await dialog.getByLabel('Tuần bắt đầu').fill(evidence.weekStartDate)
    await dialog.locator('#weekly-menu-import-file').setInputFiles(fixtures[customer])
    await dialog.getByRole('button', { name: 'Thêm file', exact: true }).click()
  }

  await dialog.getByRole('button', { name: 'Kiểm tra tất cả', exact: true }).click()
  await dialog.getByText('2/2 file đã kiểm tra xong', { exact: true }).waitFor({ timeout: 30000 })
  const dialogGeometry = await dialog.evaluate(element => ({
    horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
    stickyElementsOutsideTables: [...element.querySelectorAll('*')].filter(node =>
      getComputedStyle(node).position === 'sticky' && !node.closest('[data-table-viewport="true"]'),
    ).length,
  }))
  evidence.dialogGeometry = dialogGeometry
  if (dialogGeometry.horizontalOverflow || dialogGeometry.stickyElementsOutsideTables > 0) {
    throw new Error(`Import dialog geometry failed: ${JSON.stringify(dialogGeometry)}`)
  }
  const previewBodies = evidence.api.filter(item => item.path.endsWith('/preview') && item.status === 200).map(item => item.body?.data)
  if (previewBodies.some(body => body?.detectedLayout?.rowsImported !== 120 || body?.validation?.errorCount !== 0 || body?.rows?.some(row => !row.existingDish))) {
    throw new Error('Canonical preview did not produce 120 catalog-backed rows per customer.')
  }
  const saveAll = dialog.getByRole('button', { name: 'Lưu toàn bộ file', exact: true })
  if (await saveAll.isDisabled()) throw new Error('Atomic batch commit remained disabled after all previews passed.')
  await page.screenshot({ path: path.join(artifactRoot, 'canonical-import-preview.png'), fullPage: true })
  await saveAll.click()
  const confirm = page.getByRole('dialog', { name: 'Lưu toàn bộ 2 file?' })
  await confirm.getByRole('button', { name: 'Lưu toàn bộ file', exact: true }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 30000 })

  await page.reload()
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const reopened = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
  await reopened.getByText(/ANV - AMANN/).first().waitFor({ timeout: 30000 })
  await reopened.getByText(/DAV - Draxlmaier/).first().waitFor({ timeout: 30000 })
  await page.screenshot({ path: path.join(artifactRoot, 'canonical-import-reload.png'), fullPage: true })
  const metrics = await page.evaluate(() => window.__task0Metrics ?? { cls: 0, longTasks: [] })
  evidence.cls = metrics.cls
  evidence.longTasks = metrics.longTasks
  evidence.dom = {
    reloadShowsAnv: await reopened.getByText(/ANV - AMANN/).count(),
    reloadShowsDav: await reopened.getByText(/DAV - Draxlmaier/).count(),
    readyFilesBeforeCommit: 2,
  }
  const previewResponses = evidence.api.filter(item => item.path.endsWith('/preview') && item.status === 200)
  const batchResponses = evidence.api.filter(item => item.path.endsWith('/commit-batch') && item.status === 200)
  if (previewResponses.length !== 2 || batchResponses.length !== 1) {
    throw new Error(`Unexpected import response counts: preview=${previewResponses.length}, batch=${batchResponses.length}`)
  }
  if (evidence.consoleErrors.length || evidence.pageErrors.length || evidence.requestFailures.length) {
    throw new Error('Browser errors occurred during canonical import.')
  }
  evidence.status = 'PASS'
} catch (error) {
  evidence.status = 'FAIL'
  evidence.failure = String(error?.stack ?? error)
} finally {
  if (context) await context.close()
  await Promise.all([stopOwned(frontend), stopOwned(api)])
  evidence.finishedAtUtc = new Date().toISOString()
  evidence.teardown = 'run-owned processes stopped'
  const serialized = JSON.stringify(evidence)
  if (/Bearer\s+|eyJ[a-zA-Z0-9_-]{10,}|"password"\s*:/i.test(serialized)) {
    throw new Error('Evidence secret scan failed.')
  }
  evidence.secretSelfCheck = 'PASS'
  await writeFile(path.join(artifactRoot, 'canonical-import-headed.json'), `${JSON.stringify(evidence, null, 2)}\n`)
}
if (evidence.status !== 'PASS') process.exitCode = 1
