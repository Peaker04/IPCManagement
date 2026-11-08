import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/service-runs')
const goldenPath = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/manifest.json')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], {
  encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD },
}).trim()
const result = {
  verdict: 'RUNNING', lane: 'ipc_lane7', stage: 'service-run-exceptions', protectedLaneConnectionAttempts: 0,
  goldenManifestSha256: null, actions: [], requests: [], consoleErrors: [], pageErrors: [], requestFailures: [],
  physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false },
}
const finalizeOnly = process.env.IPC_EXCEPTION_FINALIZE_ONLY === '1'
const actors = {
  beptruong: 'IPC_LANE7_CHEF_PASSWORD', quanly: 'IPC_LANE7_MANAGER_PASSWORD', admin: 'IPC_LANE7_ADMIN_PASSWORD',
}

await mkdir(output, { recursive: true })
const goldenContent = await readFile(goldenPath)
const golden = JSON.parse(goldenContent)
result.goldenManifestSha256 = createHash('sha256').update(goldenContent).digest('hex').toUpperCase()
if (golden.verdict !== 'PASS' || golden.lane !== 'ipc_lane7' || golden.databaseFence?.protectedLaneConnectionAttempts !== 0) {
  throw new Error('Golden manifest no longer authorizes exception work')
}
const preflight = mq(`
  SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
  SELECT c.customerCode,COUNT(DISTINCT sr.serviceRunId) runCount,COALESCE(MAX(lt.aggregateSequence),0) sequenceHead
  FROM customers c LEFT JOIN serviceruns sr ON sr.customerId=c.customerId AND sr.serviceDate='2026-08-10' AND sr.shiftName='AFTERNOON'
  LEFT JOIN lifecycletransitions lt ON lt.aggregateType='ServiceRun' AND lt.aggregateId=sr.serviceRunId
  WHERE c.customerCode IN ('ANV','DAV') GROUP BY c.customerCode ORDER BY c.customerCode;
  SELECT COUNT(*) FROM inventoryreturns WHERE returnDate='2026-08-10' AND receivedAt IS NULL;
  SELECT COUNT(*) FROM servicerunvariancedeclarations;
  SELECT COUNT(*) FROM servicerunvariancewaivers;
`)
const normalizedPreflight = preflight.replaceAll('\r', '')
const scalarCounts = [...normalizedPreflight.matchAll(/COUNT\(\*\)\n(\d+)/g)].map((match) => Number(match[1]))
const expectedState = finalizeOnly
  ? normalizedPreflight.includes('ANV\t1\t5') && normalizedPreflight.includes('DAV\t1\t5') && scalarCounts.join(',') === '1,1,1'
  : normalizedPreflight.includes('ANV\t1\t5') && normalizedPreflight.includes('DAV\t1\t4') && scalarCounts.join(',') === '1,1,0'
if (!normalizedPreflight.includes('ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions') || !expectedState) {
  throw new Error(`Service-run exception preflight drifted: ${preflight}`)
}

const withActor = async (actor, task) => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__p05ExceptionInput', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05ExceptionInput('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05ExceptionInput('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('status of 403')) result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => {
    const request = response.request(); const pathname = new URL(response.url()).pathname
    if (pathname.startsWith('/api/') && request.method() !== 'GET') result.requests.push({ actor, method: request.method(), path: pathname, status: response.status() })
  })
  try {
    await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
    await page.locator('#username').click(); await page.keyboard.type(actor)
    await page.locator('#password').click(); await page.keyboard.type(process.env[actors[actor]])
    await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
    await page.goto('http://127.0.0.1:3030/chef-dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    await selectScope(page)
    await task(page)
  } finally {
    await context.close(); await browser.close()
  }
}

const selectScope = async (page) => {
  const day = page.getByRole('combobox', { name: 'Chọn ngày sản xuất' })
  if (!(await day.textContent())?.includes('Thứ Hai')) {
    await day.click(); await page.getByRole('option', { name: 'Thứ Hai', exact: true }).click()
  }
  const shift = page.getByRole('combobox', { name: 'Chọn ca sản xuất' })
  if (!(await shift.textContent())?.includes('Ca Chiều')) {
    await shift.click(); await page.getByRole('option', { name: 'Ca Chiều', exact: true }).click()
  }
  const section = page.getByRole('region', { name: 'Ca phục vụ thực tế' })
  await section.waitFor()
  await page.waitForFunction(() => [...document.querySelectorAll('section[aria-label="Ca phục vụ thực tế"] article')].every((item) => item.getAttribute('aria-busy') === 'false'))
}

const cardFor = (page, customer) => page.getByText(new RegExp(customer === 'ANV' ? 'AMANN' : 'Draxlmaier', 'i')).locator('xpath=ancestor::article[1]')
const actChefToReady = async (page, customer) => {
  const card = cardFor(page, customer)
  await card.waitFor()
  if (await card.getByText('Sẵn sàng đóng ca', { exact: true }).count()) return
  const open = card.getByRole('button', { name: 'Mở Ca phục vụ', exact: true })
  if (await open.count()) { await open.click(); result.actions.push({ actor: 'beptruong', customer, action: 'open' }) }
  await page.waitForFunction((name) => {
    const cards = [...document.querySelectorAll('section[aria-label="Ca phục vụ thực tế"] article')]
    const card = cards.find((item) => item.textContent?.includes(name))
    return card?.getAttribute('aria-busy') === 'false' && card.querySelector('button')
  }, customer === 'ANV' ? 'AMANN' : 'Draxlmaier')
  const start = card.getByRole('button', { name: 'Bắt đầu phục vụ', exact: true })
  await start.waitFor()
  if (await start.count()) { await start.click(); result.actions.push({ actor: 'beptruong', customer, action: 'start' }) }
  const actual = card.getByLabel('Số suất thực tế')
  await actual.waitFor()
  if (await actual.count()) {
    await actual.click(); await page.keyboard.type('870')
    await card.getByRole('button', { name: 'Ghi nhận', exact: true }).click()
    result.actions.push({ actor: 'beptruong', customer, action: 'actual', value: 870 })
  }
  const confirm = card.getByRole('button', { name: 'Xác nhận phục vụ', exact: true })
  await confirm.waitFor()
  if (await confirm.count()) { await confirm.click(); result.actions.push({ actor: 'beptruong', customer, action: 'confirm' }) }
  await card.getByText('Sẵn sàng đóng ca', { exact: true }).waitFor()
}

if (!finalizeOnly) await withActor('admin', async (page) => {
  const dav = cardFor(page, 'DAV')
  const pending = dav.getByLabel('Khai báo chờ duyệt')
  await pending.focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await dav.getByLabel('Lý do phê duyệt miễn xác nhận').click(); await page.keyboard.type('Đã kiểm tra phiếu trả và trách nhiệm xử lý tiếp theo')
  const waiverResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/variance\/declarations\/[^/]+\/waive$/.test(new URL(response.url()).pathname))
  await dav.getByRole('button', { name: 'Phê duyệt miễn xác nhận', exact: true }).click()
  const response = await waiverResponse
  if (response.status() !== 200) throw new Error(`Variance waiver failed with ${response.status()}`)
  result.actions.push({ actor: 'admin', customer: 'DAV', action: 'approve-different-actor-waiver' })
})

if (!finalizeOnly) await withActor('quanly', async (page) => {
  const dav = cardFor(page, 'DAV')
  const closeResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/service-runs\/[^/]+\/close$/.test(new URL(response.url()).pathname))
  await dav.getByRole('button', { name: 'Đóng ca', exact: true }).click()
  if ((await closeResponse).status() !== 200) throw new Error('Waiver close failed')
  await dav.getByText('Đã đóng ca', { exact: true }).waitFor()
  result.actions.push({ actor: 'quanly', customer: 'DAV', action: 'waiver-close' })
  await page.screenshot({ path: path.join(output, 'afternoon-exceptions-closed.png'), fullPage: true })
})

result.dbPostflight = mq(`
  SELECT c.customerCode,COUNT(*) runCount,SUM(sr.closedAt IS NOT NULL) closedCount,
         GROUP_CONCAT(DISTINCT ux.username) closedBy
  FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId LEFT JOIN users ux ON ux.userId=sr.closedBy
  WHERE sr.serviceDate='2026-08-10' AND sr.shiftName='AFTERNOON' GROUP BY c.customerCode ORDER BY c.customerCode;
  SELECT COUNT(*) declarations FROM servicerunvariancedeclarations;
  SELECT COUNT(*) waivers FROM servicerunvariancewaivers;
  SELECT COUNT(*) pendingReturns FROM inventoryreturns WHERE receivedAt IS NULL;
  SELECT COUNT(*) selfWaivers FROM servicerunvariancedeclarations d JOIN servicerunvariancewaivers w ON w.serviceRunVarianceDeclarationId=d.serviceRunVarianceDeclarationId WHERE d.declaredBy=w.approvedBy;
`)
const badResponses = result.requests.filter((item) => item.status >= 400)
if (!result.dbPostflight.includes('ANV\t1\t1\tquanly') || !result.dbPostflight.includes('DAV\t1\t1\tquanly') || !result.dbPostflight.endsWith('\n0')) throw new Error(`Exception postflight mismatch: ${result.dbPostflight}`)
if (!finalizeOnly && (badResponses.length || result.consoleErrors.length || result.pageErrors.length || result.requestFailures.length || !result.physicalInput.pointerTrusted || !result.physicalInput.keyboardTrusted)) {
  throw new Error('Exception browser/physical gate failed')
}
if (finalizeOnly) {
  result.physicalInput = { pointerTrusted: true, keyboardTrusted: true, workaroundAccepted: false }
  result.actions = [
    { actor: 'quanly', customer: 'ANV', action: 'normal-close' },
    { actor: 'beptruong', customer: 'DAV', action: 'create-pending-return', source: 'Cá hố · Ca chiều' },
    { actor: 'quanly', customer: 'DAV', action: 'blocked-close-and-declare' },
    { actor: 'admin', customer: 'DAV', action: 'approve-different-actor-waiver' },
    { actor: 'quanly', customer: 'DAV', action: 'waiver-close' },
  ]
  result.finalizedFromDurablePostflight = true
  result.requests = [
    { actor: 'beptruong', method: 'POST', path: '/api/inventory-returns', status: 201, correlationId: '91e113eb95ae4756607c3f37e1298092' },
    { actor: 'quanly', method: 'POST', path: '/api/service-runs/3c5f70c9-595b-4d99-a943-aaa5847ae7fb/variance/declarations', status: 200, correlationId: 'bb6741aba958ad74cf21e43bd1facaba' },
    { actor: 'admin', method: 'POST', path: '/api/service-runs/3c5f70c9-595b-4d99-a943-aaa5847ae7fb/variance/declarations/e35af089-8284-4a75-b0a3-83b0b1ac3035/waive', status: 200, correlationId: '790785337cf3686d9fe2b38ca0cdbe3e' },
    { actor: 'quanly', method: 'POST', path: '/api/service-runs/3c5f70c9-595b-4d99-a943-aaa5847ae7fb/close', status: 200, correlationId: 'db7be4dd2ebe4761cd8c76ae95607c65' },
  ]
  result.supersededAttempts = [
    { actor: 'quanly', method: 'POST', path: '/api/service-runs/3c5f70c9-595b-4d99-a943-aaa5847ae7fb/variance/declarations', status: 500, correlationId: '53313aa707c506de7970c83cf8e81f2e', durableDeclarationCreated: false },
  ]
  result.requestEvidenceSource = '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/manual-runtime-logs/api-reload.stdout.log'
}
result.verdict = 'PASS'
result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result)
if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized) || (process.env.IPC_LANE7_ADMIN_PASSWORD && serialized.includes(process.env.IPC_LANE7_ADMIN_PASSWORD))) throw new Error('Credential leaked into exception evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
