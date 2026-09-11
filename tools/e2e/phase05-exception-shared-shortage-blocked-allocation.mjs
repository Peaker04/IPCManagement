import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/shared-shortage-blocked-allocation')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, mode: 'headed-current-source-explicit-choice', physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, requests: [], mutationRequests: [], consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
result.dbPreflight = mq(`
  SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
  SELECT currentQty FROM currentstock WHERE warehouseId=UNHEX('A0520000000000000000000000000001') AND ingredientId=UNHEX('65B8047268F5AE489108B1A6043DFBC3');
  SELECT COUNT(*) fixtureIssues FROM inventoryissues WHERE materialRequestId IN (UNHEX('A0520000000000000000000000000011'),UNHEX('A0520000000000000000000000000021'));
  SELECT COUNT(*) movements FROM stockmovements;
  SELECT COUNT(*) dispositions FROM inventoryallocationdispositions;
`)
if (!result.dbPreflight.includes('ipc_lane7\t70\t20260813171032_AddMenuAmendmentDecisionFanRemediations') || !result.dbPreflight.includes('currentQty\r\n1.000000') || !result.dbPreflight.includes('fixtureIssues\r\n0') || !result.dbPreflight.includes('movements\r\n1662') || !result.dbPreflight.endsWith('dispositions\r\n1')) throw new Error(`Shared shortage preflight drifted: ${result.dbPreflight}`)

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.exposeBinding('__phase05SharedShortagePhysical', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
await context.addInitScript(() => {
  addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__phase05SharedShortagePhysical('pointer') }, true)
  addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__phase05SharedShortagePhysical('keyboard') }, true)
})
const page = await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => result.pageErrors.push(error.message))
page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
page.on('response', (response) => {
  const request = response.request(); const pathname = new URL(response.url()).pathname
  if (pathname.startsWith('/api/')) result.requests.push({ method: request.method(), path: pathname, status: response.status() })
  if (pathname.startsWith('/api/') && request.method() !== 'GET' && pathname !== '/api/auth/login') result.mutationRequests.push({ method: request.method(), path: pathname, status: response.status() })
})

try {
  await page.goto('http://127.0.0.1:3036/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('thukho')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_WAREHOUSE_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3036/warehouse', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  await page.getByRole('button', { name: 'Tạo phiếu xuất kho', exact: true }).click()
  const demand = page.getByRole('combobox', { name: 'Chọn nhu cầu nguyên liệu' })
  await demand.click()
  const anvOption = page.getByRole('option').filter({ hasText: 'AMANN (ANV)' })
  const davOption = page.getByRole('option').filter({ hasText: 'Draxlmaier (DAV)' })
  result.domBefore = {
    anvCandidateCount: await anvOption.count(),
    davCandidateCount: await davOption.count(),
    technicalRequestCodeVisible: (await page.locator('body').innerText()).includes('MR-P05-SHARED'),
  }
  await anvOption.click()
  const warehouse = page.getByRole('combobox', { name: 'Chọn kho xuất' })
  await warehouse.click(); await page.getByRole('option', { name: 'Kho chia sẻ kiểm thử', exact: true }).click()
  await page.getByText('Kho có thể xuất 1/1 nhóm nguyên liệu còn lại; 1 nhóm đủ toàn bộ số lượng.', { exact: true }).waitFor()
  const issueResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/inventory-issues')
  await page.getByRole('button', { name: 'Xác nhận xuất 1 dòng', exact: true }).click()
  const issueResponse = await issueResponsePromise
  const issueBody = await issueResponse.json()
  result.explicitDecision = {
    selectedCustomer: 'ANV',
    selectedWarehouse: 'P05-SHARED',
    status: issueResponse.status(),
    issueCode: issueBody?.data?.issueCode,
    concurrencyVersion: issueBody?.data?.concurrencyVersion,
  }
  await page.getByText('Đã tạo phiếu xuất kho', { exact: true }).waitFor()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.getByRole('button', { name: 'Tạo phiếu xuất kho', exact: true }).click()
  const demandAfter = page.getByRole('combobox', { name: 'Chọn nhu cầu nguyên liệu' })
  await demandAfter.click(); await page.getByRole('option').filter({ hasText: 'Draxlmaier (DAV)' }).click()
  const warehouseAfter = page.getByRole('combobox', { name: 'Chọn kho xuất' })
  await warehouseAfter.click(); await page.getByRole('option', { name: 'Kho chia sẻ kiểm thử', exact: true }).click()
  const blockedText = page.getByText('Kho này không có tồn phù hợp với nhu cầu còn lại. Chọn kho khác để tiếp tục.', { exact: true })
  await blockedText.waitFor()
  const confirm = page.getByRole('button', { name: 'Xác nhận xuất 0 dòng', exact: true })
  result.domAfterReload = {
    selectedCustomer: 'DAV',
    blockedGuidanceVisible: await blockedText.isVisible(),
    confirmDisabled: await confirm.isDisabled(),
    implicitTransferControlCount: await page.getByText(/tự động ưu tiên|tự động chuyển/i).count(),
    technicalRequestCodeVisible: (await page.locator('body').innerText()).includes('MR-P05-SHARED'),
  }
  await page.screenshot({ path: path.join(output, 'shared-shortage-dav-blocked.png'), fullPage: true })
} finally { await context.close(); await browser.close() }

result.dbPostflight = mq(`
  SELECT requestCode,status FROM materialrequests WHERE requestId IN (UNHEX('A0520000000000000000000000000011'),UNHEX('A0520000000000000000000000000021')) ORDER BY requestCode;
  SELECT currentQty FROM currentstock WHERE warehouseId=UNHEX('A0520000000000000000000000000001') AND ingredientId=UNHEX('65B8047268F5AE489108B1A6043DFBC3');
  SELECT COUNT(*) anvIssues FROM inventoryissues WHERE materialRequestId=UNHEX('A0520000000000000000000000000011');
  SELECT COUNT(*) davIssues FROM inventoryissues WHERE materialRequestId=UNHEX('A0520000000000000000000000000021');
  SELECT COUNT(*) fixtureIssueMovements FROM stockmovements WHERE warehouseId=UNHEX('A0520000000000000000000000000001') AND movementType='ISSUE';
  SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='InventoryIssue' AND aggregateId=UNHEX('A0520000000000000000000000000011');
  SELECT COUNT(*) transitions FROM lifecycletransitions WHERE aggregateType='InventoryIssue' AND aggregateId=UNHEX('A0520000000000000000000000000011');
  SELECT COUNT(*) lifecycleAudits FROM auditlogs WHERE businessArea='Lifecycle' AND entityName='InventoryIssue' AND entityId=UNHEX('A0520000000000000000000000000011');
  SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='InventoryIssue' AND aggregateId=UNHEX('A0520000000000000000000000000011');
  SELECT COUNT(*) dispositions FROM inventoryallocationdispositions;
`)
const apiFailures = result.requests.filter((item) => item.status >= 400 && item.path !== '/api/auth/profile')
const passed = result.domBefore.anvCandidateCount === 1 && result.domBefore.davCandidateCount === 1 && !result.domBefore.technicalRequestCodeVisible && result.explicitDecision.status === 201 && result.explicitDecision.concurrencyVersion === 1 && result.domAfterReload.blockedGuidanceVisible && result.domAfterReload.confirmDisabled && result.domAfterReload.implicitTransferControlCount === 0 && !result.domAfterReload.technicalRequestCodeVisible && result.mutationRequests.length === 1 && result.dbPostflight.includes('MR-P05-SHARED-ANV\tEXPORTED') && result.dbPostflight.includes('MR-P05-SHARED-DAV\tSENTTOWAREHOUSE') && result.dbPostflight.includes('currentQty\r\n0.000000') && result.dbPostflight.includes('anvIssues\r\n1') && result.dbPostflight.includes('davIssues\r\n0') && result.dbPostflight.includes('fixtureIssueMovements\r\n1') && result.dbPostflight.includes('receipts\r\n1') && result.dbPostflight.includes('transitions\r\n1') && result.dbPostflight.includes('lifecycleAudits\r\n1') && result.dbPostflight.includes('outbox\r\n1') && result.dbPostflight.endsWith('dispositions\r\n1') && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !apiFailures.length && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
if (!passed) throw new Error(`Shared shortage headed gate failed: ${JSON.stringify(result, null, 2)}`)
result.verdict = 'PASS'
result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result)
if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized) || serialized.includes(process.env.IPC_LANE7_WAREHOUSE_PASSWORD) || serialized.includes(process.env.IPC_LANE7_MYSQL_PASSWORD)) throw new Error('Credential leaked into shared shortage evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
