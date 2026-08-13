import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/excess-disposition')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const typeControlled = async (page, locator, value) => {
  for (const character of value) {
    await locator.click(); await page.keyboard.press('End'); await page.keyboard.press(character === ' ' ? 'Space' : character)
  }
}
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, requests: [], physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
result.dbPreflight = mq(`
SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
SELECT c.customerCode,i.ingredientName,iil.issuedQty,COALESCE(SUM(CASE WHEN ir.returnType='RETURN' THEN irl.quantity ELSE 0 END),0) returned,COALESCE(SUM(CASE WHEN ir.returnType='WASTE' THEN irl.quantity ELSE 0 END),0) wasted,HEX(iil.issueLineId)
FROM inventoryissuelines iil JOIN inventoryissues ii ON ii.issueId=iil.issueId JOIN materialrequestlines mrl ON mrl.requestLineId=iil.materialRequestLineId
JOIN productionplanlines ppl ON ppl.planLineId=mrl.planLineId JOIN productionplans pp ON pp.planId=ppl.planId JOIN customers c ON c.customerId=ppl.customerId JOIN ingredients i ON i.ingredientId=iil.ingredientId
LEFT JOIN inventoryreturnlines irl ON irl.sourceIssueLineId=iil.issueLineId LEFT JOIN inventoryreturns ir ON ir.returnId=irl.returnId
WHERE pp.planDate='2026-08-10' AND ppl.shiftName='AFTERNOON' AND i.ingredientName='Cá hố' GROUP BY iil.issueLineId ORDER BY c.customerCode;
SELECT COUNT(*) FROM inventoryallocationdispositions WHERE sourceIssueLineId=UNHEX('77436B29BB29D145803429901CD750D0');
`)
const pre = result.dbPreflight.replaceAll('\r', '')
if (!pre.includes('ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions') || !pre.includes('ANV\tCá hố\t102.585180\t0.000000\t0.000000\t77436B29BB29D145803429901CD750D0') || !pre.includes('DAV\tCá hố\t102.585180\t0.000800\t0.000000\t0C384EC541F3864A89BB20B1650220B0') || !pre.endsWith('\n0')) throw new Error(`EXCESS preflight drifted: ${result.dbPreflight}`)

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.exposeBinding('__p05excess', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
await context.addInitScript(() => {
  addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05excess('pointer') }, true)
  addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05excess('keyboard') }, true)
})
const page = await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => result.pageErrors.push(error.message))
page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
page.on('response', (response) => { const request = response.request(); const pathname = new URL(response.url()).pathname; if (request.method() !== 'GET' && pathname.startsWith('/api/')) result.requests.push({ method: request.method(), path: pathname, status: response.status() }) })
try {
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('admin')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_ADMIN_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const balanceResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/inventory-returns/allocation-balances')
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const balanceHttpResponse = await balanceResponse
  result.balanceResponse = { status: balanceHttpResponse.status(), count: (await balanceHttpResponse.json().catch(() => null))?.data?.length }
  const balanceSection = page.getByText('Đối soát nguyên liệu đã xuất', { exact: true }).locator('xpath=ancestor::section[1]')
  const balanceTable = balanceSection.locator('table')
  await balanceTable.waitFor().catch((error) => { throw new Error(`Balance table missing: ${JSON.stringify(result.balanceResponse)}`, { cause: error }) })
  const sourceRow = page.getByRole('row').filter({ hasText: 'AMANN (ANV)' }).filter({ hasText: '10/08/2026' }).filter({ hasText: 'Cá hố' })
  if (await sourceRow.count() !== 1) throw new Error(`Expected one user-labelled ANV Cá hố balance row, found ${await sourceRow.count()}: ${JSON.stringify(await balanceTable.getByRole('row').allTextContents())}`)
  result.sourceRowBefore = await sourceRow.innerText()
  await sourceRow.getByRole('button', { name: 'Điều phối phần dư', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Điều phối nguyên liệu còn dư' })
  const destination = dialog.getByLabel('Chuyển sang phạm vi')
  const destinationOption = destination.locator('option').filter({ hasText: /Draxlmaier.*10\/08\/2026.*Ca chiều.*25\.000/i })
  if (await destinationOption.count() !== 1) throw new Error(`Expected one user-labelled destination, found ${await destinationOption.count()}`)
  await destination.selectOption(await destinationOption.getAttribute('value'))
  const quantity = dialog.getByLabel('Số lượng điều phối (kg)')
  await quantity.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('5')
  for (let index = 0; index < 4; index += 1) { await quantity.click(); await page.keyboard.press('Home'); await page.keyboard.press('0') }
  await quantity.click(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('.')
  await typeControlled(page, dialog.getByLabel('Lý do'), 'Dieu phoi phan du da duoc duyet')
  result.formBeforeSubmit = { destination: await destination.inputValue(), quantity: await quantity.inputValue(), reason: await dialog.getByLabel('Lý do').inputValue() }
  let capturedResponse
  page.on('response', (response) => { if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/inventory-returns/allocation-dispositions') capturedResponse = response })
  await dialog.getByRole('button', { name: 'Xác nhận điều phối', exact: true }).click()
  await page.waitForTimeout(800)
  if (!capturedResponse) throw new Error(`Disposition request not emitted: ${JSON.stringify({ form: result.formBeforeSubmit, alerts: await dialog.getByRole('alert').allTextContents() })}`)
  if (capturedResponse.status() !== 200) throw new Error(`Disposition failed ${capturedResponse.status()}`)
  await page.getByText('Đã ghi nhận điều phối', { exact: true }).waitFor()
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const reloaded = page.getByRole('row').filter({ hasText: 'AMANN (ANV)' }).filter({ hasText: '10/08/2026' }).filter({ hasText: 'Cá hố' }); await reloaded.waitFor()
  result.sourceRowAfter = await reloaded.innerText()
  await page.screenshot({ path: path.join(output, 'excess-disposition-reload.png'), fullPage: true })
} finally { await context.close(); await browser.close() }

result.dbPostflight = mq(`
SELECT d.quantity,d.reason,ux.username,HEX(d.sourceIssueLineId),HEX(d.destinationIssueLineId) FROM inventoryallocationdispositions d JOIN users ux ON ux.userId=d.createdBy WHERE d.sourceIssueLineId=UNHEX('77436B29BB29D145803429901CD750D0');
SELECT COUNT(*),MIN(aggregateSequence),MAX(aggregateSequence) FROM lifecycletransitions WHERE aggregateType='InventoryAllocationDisposition' AND aggregateId=UNHEX('77436B29BB29D145803429901CD750D0');
SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='InventoryAllocationDisposition' AND aggregateId=UNHEX('77436B29BB29D145803429901CD750D0');
SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='InventoryAllocationDisposition' AND aggregateId=UNHEX('77436B29BB29D145803429901CD750D0');
SELECT COUNT(*) audits FROM auditlogs WHERE businessArea='Lifecycle' AND entityName='InventoryAllocationDisposition' AND entityId=UNHEX('77436B29BB29D145803429901CD750D0');
SELECT COUNT(*) rewrittenReturns FROM inventoryreturnlines WHERE sourceIssueLineId=UNHEX('77436B29BB29D145803429901CD750D0');
`)
const post = result.dbPostflight.replaceAll('\r', '')
const passed = post.includes('0.000500\tDieu phoi phan du da duoc duyet\tadmin\t77436B29BB29D145803429901CD750D0\t0C384EC541F3864A89BB20B1650220B0')
  && post.includes('COUNT(*)\tMIN(aggregateSequence)\tMAX(aggregateSequence)\n1\t1\t1') && post.includes('receipts\n1') && post.includes('outbox\n1') && post.includes('audits\n1') && post.includes('rewrittenReturns\n0')
  && result.requests.some((item) => item.path === '/api/inventory-returns/allocation-dispositions' && item.status === 200)
  && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
result.verdict = passed ? 'PASS' : 'FAIL'; result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result); if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized)) throw new Error('Credential leaked into EXCESS evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2)); if (!passed) process.exitCode = 1
