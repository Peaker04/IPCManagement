import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/kitchen-discrepancy')
const goldenPath = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/manifest.json')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], {
  encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD },
}).trim()
const result = {
  verdict: 'RUNNING', lane: 'ipc_lane7', branch: 'kitchen-discrepancy', protectedLaneConnectionAttempts: 0,
  scope: { customerCode: 'ANV', serviceDate: '2026-08-11', shiftName: 'AFTERNOON', priceTierAmount: 25000 },
  physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false },
  requests: [], consoleErrors: [], pageErrors: [], requestFailures: [],
}

await mkdir(output, { recursive: true })
const goldenContent = await readFile(goldenPath)
const golden = JSON.parse(goldenContent)
result.goldenManifestSha256 = createHash('sha256').update(goldenContent).digest('hex').toUpperCase()
if (golden.verdict !== 'PASS' || golden.lane !== 'ipc_lane7' || golden.databaseFence?.protectedLaneConnectionAttempts !== 0) {
  throw new Error('Kitchen discrepancy blocked: Golden manifest is not an authorized lane7 PASS')
}
result.dbPreflight = mq(`
  SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
  SELECT c.customerCode,p.planDate,pl.shiftName,COUNT(*) planLines,p.sentToKitchenAt IS NOT NULL sent
  FROM productionplans p JOIN customers c ON c.customerId=p.customerId JOIN productionplanlines pl ON pl.planId=p.planId
  WHERE p.planDate='2026-08-11' AND pl.shiftName='AFTERNOON' AND c.customerCode IN ('ANV','DAV')
  GROUP BY c.customerCode,p.planDate,pl.shiftName,p.sentToKitchenAt ORDER BY c.customerCode;
  SELECT c.customerCode,sr.concurrencyVersion,COUNT(d.serviceRunVarianceDeclarationId) declarations
  FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId
  LEFT JOIN servicerunvariancedeclarations d ON d.serviceRunId=sr.serviceRunId
  WHERE c.customerCode IN ('ANV','DAV') AND sr.serviceDate='2026-08-11' AND sr.shiftName='AFTERNOON'
  GROUP BY c.customerCode,sr.concurrencyVersion;
`)
if (!result.dbPreflight.includes('ipc_lane7\t70\t20260813171032_AddMenuAmendmentDecisionFanRemediations') ||
    !result.dbPreflight.includes('ANV\t2026-08-11\tAFTERNOON') || !result.dbPreflight.includes('DAV\t2026-08-11\tAFTERNOON') ||
    (/\nANV\t/.test(result.dbPreflight) && !result.dbPreflight.endsWith('ANV\t1\t0'))) throw new Error(`Kitchen discrepancy preflight drifted: ${result.dbPreflight}`)

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.exposeBinding('__phase05Physical', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
await context.addInitScript(() => {
  addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__phase05Physical('pointer') }, true)
  addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__phase05Physical('keyboard') }, true)
})
const page = await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => result.pageErrors.push(error.message))
page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
page.on('response', (response) => {
  const request = response.request(); const pathname = new URL(response.url()).pathname
  if (pathname.startsWith('/api/') && request.method() !== 'GET') {
    const body = request.postDataJSON?.() ?? null
    result.requests.push({ method: request.method(), path: pathname, status: response.status(), body })
  }
})

try {
  await page.goto('http://127.0.0.1:3032/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('beptruong')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_CHEF_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3032/chef-dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  const day = page.getByRole('combobox', { name: 'Chọn ngày sản xuất' })
  await day.click(); await page.getByRole('option', { name: 'Thứ Ba', exact: true }).click()
  const shift = page.getByRole('combobox', { name: 'Chọn ca sản xuất' })
  await shift.click(); await page.getByRole('option', { name: 'Ca Chiều', exact: true }).click()
  const section = page.getByRole('region', { name: 'Ca phục vụ thực tế' })
  await section.waitFor()
  const anv = page.getByText(/AMANN/i).locator('xpath=ancestor::article[1]')
  const dav = page.getByText(/Draxlmaier/i).locator('xpath=ancestor::article[1]')
  await anv.waitFor(); await dav.waitFor()
  result.unrelatedBefore = { davCanOpen: await dav.getByRole('button', { name: 'Mở Ca phục vụ', exact: true }).isVisible() }

  const open = anv.getByRole('button', { name: 'Mở Ca phục vụ', exact: true })
  if (await open.isVisible().catch(() => false)) {
    const openResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/service-runs')
    await open.click()
    if ((await openResponse).status() !== 200) throw new Error('Opening scoped ServiceRun failed')
  }
  const currentAnv = page.getByText(/AMANN/i).locator('xpath=ancestor::article[1]')
  await currentAnv.getByRole('group', { name: 'Khai báo ngoại lệ Ca phục vụ' }).waitFor()
  await currentAnv.getByLabel('Phạm vi ngoại lệ').selectOption('SERVICE_EXECUTION')
  const firstIngredient = currentAnv.getByRole('checkbox').first()
  const ingredientLabel = await firstIngredient.locator('xpath=..').innerText()
  await firstIngredient.click()
  await currentAnv.getByLabel('Lý do khai báo ngoại lệ').click()
  await page.keyboard.type('Bếp phát hiện lượng nguyên liệu thực nhận không khớp khi chuẩn bị ca')
  const declarationResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/variance\/declarations$/.test(new URL(response.url()).pathname))
  await currentAnv.getByRole('button', { name: 'Gửi khai báo ngoại lệ', exact: true }).click()
  if ((await declarationResponse).status() !== 200) throw new Error('Kitchen discrepancy declaration failed')
  const updatedAnv = page.getByText(/AMANN/i).locator('xpath=ancestor::article[1]')
  await updatedAnv.getByText('Cần đối soát', { exact: true }).waitFor()
  result.ingredientLabel = ingredientLabel.replace(/\s+/g, ' ').trim()
  result.afterAction = { status: 'Cần đối soát', davCanOpen: await dav.getByRole('button', { name: 'Mở Ca phục vụ', exact: true }).isVisible() }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const reloadedAnv = page.getByText(/AMANN/i).locator('xpath=ancestor::article[1]')
  await reloadedAnv.getByText('Cần đối soát', { exact: true }).waitFor()
  result.reload = { status: 'Cần đối soát', pendingReasonVisible: (await reloadedAnv.innerText()).includes('Bếp phát hiện lượng nguyên liệu thực nhận không khớp') }
  await page.screenshot({ path: path.join(output, 'kitchen-discrepancy-reload.png'), fullPage: true })
} finally {
  await context.close(); await browser.close()
}

const declarationRequest = result.requests.find((item) => /\/variance\/declarations$/.test(item.path))
if (!declarationRequest?.body?.commandId) throw new Error('Declaration request evidence is missing commandId')
const escapedCommandId = String(declarationRequest.body.commandId).replaceAll("'", "''")
result.dbPostflight = mq(`
  SELECT c.customerCode,sr.serviceDate,sr.shiftName,sr.status,sr.concurrencyVersion,COUNT(DISTINCT d.serviceRunVarianceDeclarationId) declarations,
         COUNT(DISTINCT w.serviceRunVarianceWaiverId) waivers
  FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId
  LEFT JOIN servicerunvariancedeclarations d ON d.serviceRunId=sr.serviceRunId
  LEFT JOIN servicerunvariancewaivers w ON w.serviceRunVarianceDeclarationId=d.serviceRunVarianceDeclarationId
  WHERE c.customerCode='ANV' AND sr.serviceDate='2026-08-11' AND sr.shiftName='AFTERNOON'
  GROUP BY c.customerCode,sr.serviceDate,sr.shiftName,sr.status,sr.concurrencyVersion;
  SELECT commandId,aggregateSequence,expectedVersion FROM lifecycletransitions WHERE commandId='${escapedCommandId}';
  SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE commandId='${escapedCommandId}';
  SELECT COUNT(*) audits FROM auditlogs WHERE businessArea='Lifecycle' AND reason='Bếp phát hiện lượng nguyên liệu thực nhận không khớp khi chuẩn bị ca';
  SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE commandId='${escapedCommandId}';
  SELECT COUNT(*) unrelatedDavRuns FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId
  WHERE c.customerCode='DAV' AND sr.serviceDate='2026-08-11' AND sr.shiftName='AFTERNOON';
`)
const badResponses = result.requests.filter((item) => item.status >= 400)
const passed = result.dbPostflight.includes('ANV\t2026-08-11\tAFTERNOON') && result.dbPostflight.includes(`${declarationRequest.body.commandId}\t2\t1`) &&
  result.dbPostflight.includes('receipts\r\n1') && result.dbPostflight.includes('audits\r\n1') && result.dbPostflight.includes('outbox\r\n1') &&
  result.dbPostflight.endsWith('unrelatedDavRuns\r\n0') && result.unrelatedBefore.davCanOpen && result.afterAction.davCanOpen &&
  result.reload.status === 'Cần đối soát' && !badResponses.length && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length &&
  result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted
if (!passed) throw new Error(`Kitchen discrepancy evidence gate failed: ${JSON.stringify(result, null, 2)}`)
result.verdict = 'PASS'
result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result)
if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized) || serialized.includes(process.env.IPC_LANE7_CHEF_PASSWORD)) throw new Error('Credential leaked into kitchen discrepancy evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
