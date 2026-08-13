import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve('.')
const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup')
const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required.')
await mkdir(output, { recursive: true })
const settings = JSON.parse(await readFile(path.join(root, 'backend/src/IPCManagement.Api/appsettings.json'), 'utf8'))
const connection = settings.ConnectionStrings.DefaultConnection.replace(/(Database|Initial Catalog)=[^;]*/i, '$1=ipc_lane7')
if (!/(Database|Initial Catalog)=ipc_lane7(?:;|$)/i.test(connection)) throw new Error('Unsafe lane.')
const evidence = {
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  mode: 'readback-only',
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  api: [],
  startedAtUtc: new Date().toISOString(),
}
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const waitFor = async url => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(url)).ok) return } catch {}
    await sleep(500)
  }
  throw new Error(`Unavailable: ${url}`)
}
const stop = async child => {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  for (let attempt = 0; attempt < 20 && child.exitCode === null; attempt += 1) await sleep(250)
  if (child.exitCode === null) child.kill('SIGKILL')
}
let api
let frontend
let context
try {
  api = spawn('dotnet', ['run', '--no-launch-profile', '--no-build'], {
    cwd: path.join(root, 'backend/src/IPCManagement.Api'),
    env: { ...process.env, ConnectionStrings__DefaultConnection: connection, ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: 'http://127.0.0.1:8030' },
    stdio: 'ignore',
    windowsHide: true,
  })
  frontend = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '3030'], {
    cwd: path.join(root, 'frontend'),
    env: { ...process.env, VITE_PROXY_TARGET: 'http://127.0.0.1:8030' },
    stdio: 'ignore',
    windowsHide: true,
  })
  evidence.createdProcesses = [{ name: 'api', pid: api.pid }, { name: 'frontend', pid: frontend.pid }]
  await waitFor('http://127.0.0.1:8030/health/ready')
  await waitFor('http://127.0.0.1:3030/login')
  context = await chromium.launchPersistentContext(path.join(root, '.artifacts/browser-use-phase05-task0-readback'), {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: false,
    viewport: { width: 1365, height: 900 },
    args: ['--window-size=1365,900', '--force-device-scale-factor=1'],
  })
  const page = context.pages()[0] ?? await context.newPage()
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()) })
  page.on('pageerror', error => evidence.pageErrors.push(error.message))
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') evidence.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText })
  })
  page.on('response', async response => {
    const url = new URL(response.url())
    if (response.status() >= 400) {
      evidence.api.push({ path: url.pathname, status: response.status(), errorBody: await response.json().catch(() => null) })
    }
    if (url.pathname === '/api/coordination/weekly-menu/import-history') {
      evidence.api.push({ path: url.pathname, status: response.status(), body: await response.json().catch(() => null) })
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
  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
  const historyTable = dialog.getByRole('region', { name: 'Lịch sử import thực đơn tuần' })
  const anvRow = historyTable.locator('tbody tr').filter({ hasText: 'ANV - AMANN' }).filter({ hasText: '17/08/2026' }).filter({ hasText: '120 thành công' }).first()
  const davRow = historyTable.locator('tbody tr').filter({ hasText: 'DAV - Draxlmaier' }).filter({ hasText: '17/08/2026' }).filter({ hasText: '120 thành công' }).first()
  await anvRow.waitFor({ timeout: 30000 })
  await davRow.waitFor({ timeout: 30000 })
  const history = evidence.api.at(-1)?.body?.data ?? []
  const active = history.filter(item => item.weekStartDate === '2026-08-17' && item.status === 'DRAFT')
  if (active.length !== 2 || !active.some(item => item.customerCode === 'ANV' && item.successRowCount === 120) || !active.some(item => item.customerCode === 'DAV' && item.successRowCount === 120)) {
    throw new Error('Reloaded import history does not contain both active 120-row Golden versions.')
  }
  evidence.dom = { anvRows: await anvRow.count(), davRows: await davRow.count() }
  evidence.activeHistory = active.map(item => ({
    customerCode: item.customerCode,
    weekStartDate: item.weekStartDate,
    versionNo: item.versionNo,
    status: item.status,
    sourceFileName: item.sourceFileName,
    successRowCount: item.successRowCount,
  }))
  await page.screenshot({ path: path.join(output, 'canonical-import-readback.png'), fullPage: true })
  if (evidence.consoleErrors.length || evidence.pageErrors.length || evidence.requestFailures.length) throw new Error('Browser errors occurred during readback.')
  evidence.status = 'PASS'
} catch (error) {
  evidence.status = 'FAIL'
  evidence.failure = String(error?.stack ?? error)
} finally {
  if (context) await context.close()
  await Promise.all([stop(frontend), stop(api)])
  evidence.finishedAtUtc = new Date().toISOString()
  evidence.teardown = 'run-owned processes stopped'
  const serialized = JSON.stringify(evidence)
  if (/Bearer\s+|eyJ[a-zA-Z0-9_-]{10,}|"password"\s*:/i.test(serialized)) throw new Error('Evidence secret scan failed.')
  evidence.secretSelfCheck = 'PASS'
  await writeFile(path.join(output, 'canonical-import-readback.json'), `${JSON.stringify(evidence, null, 2)}\n`)
}
if (evidence.status !== 'PASS') process.exitCode = 1
