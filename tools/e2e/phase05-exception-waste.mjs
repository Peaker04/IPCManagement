import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/waste')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, requests: [], physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
result.dbPreflight = mq(`
SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
SELECT c.customerCode,pp.planDate,ppl.shiftName,i.ingredientName,u.unitName,iil.issuedQty,HEX(iil.issueLineId),ii.issueCode
FROM inventoryissuelines iil JOIN inventoryissues ii ON ii.issueId=iil.issueId JOIN materialrequestlines mrl ON mrl.requestLineId=iil.materialRequestLineId
JOIN productionplanlines ppl ON ppl.planLineId=mrl.planLineId JOIN productionplans pp ON pp.planId=ppl.planId JOIN customers c ON c.customerId=ppl.customerId
JOIN ingredients i ON i.ingredientId=iil.ingredientId JOIN units u ON u.unitId=iil.unitId
WHERE c.customerCode='ANV' AND pp.planDate='2026-08-10' AND ppl.shiftName='AFTERNOON' AND i.ingredientName='Cà rốt';
SELECT COUNT(*) FROM inventoryreturns ir JOIN inventoryreturnlines irl ON irl.returnId=ir.returnId WHERE ir.returnType='WASTE' AND irl.sourceIssueLineId=UNHEX('1B7C6D4BF61915489C0E39C3EFB59534');
`)
if (!result.dbPreflight.includes('ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions') || !result.dbPreflight.includes('ANV\t2026-08-10\tAFTERNOON\tCà rốt\tKilogram\t14.745630\t1B7C6D4BF61915489C0E39C3EFB59534') || !result.dbPreflight.endsWith('\n0')) throw new Error(`WASTE preflight drifted: ${result.dbPreflight}`)

const withActor = async (actor, password, task) => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__p05waste', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05waste('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05waste('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', async (response) => {
    const request = response.request(); const pathname = new URL(response.url()).pathname
    if (request.method() !== 'GET' && pathname.startsWith('/api/')) result.requests.push({ actor, method: request.method(), path: pathname, status: response.status() })
    if (actor === 'beptruong' && request.method() === 'GET' && pathname === '/api/workflow-reports/kitchen-issues') {
      const body = await response.json().catch(() => null)
      const items = body?.data ?? []
      result.actionResponse = { status: response.status(), count: items.length, scopes: items.slice(0, 5).map((item) => ({ issueDate: item.issueDate, shiftName: item.shiftName, sourceShiftName: item.sourceShiftName, ingredientName: item.ingredientName })) }
    }
  })
  try {
    await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
    await page.locator('#username').click(); await page.keyboard.type(actor)
    await page.locator('#password').click(); await page.keyboard.type(password)
    await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
    await task(page)
  } finally { await context.close(); await browser.close() }
}

await withActor('beptruong', process.env.IPC_LANE7_CHEF_PASSWORD, async (page) => {
  await page.goto('http://127.0.0.1:3030/chef-dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const day = page.getByRole('combobox', { name: 'Chọn ngày sản xuất' }); await day.click(); await page.getByRole('option', { name: 'Thứ Hai', exact: true }).click()
  const afternoonResponse = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/workflow-reports/kitchen-issues' && new URL(response.url()).searchParams.get('shiftName') === 'AFTERNOON')
  const shift = page.getByRole('combobox', { name: 'Chọn ca sản xuất' }); await shift.click(); await page.getByRole('option', { name: 'Ca Chiều', exact: true }).click()
  await afternoonResponse
  await page.getByRole('button', { name: /Ghi nhận nguyên liệu thừa/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Ghi nhận nguyên liệu thừa' })
  const material = dialog.getByRole('combobox', { name: 'Chọn nguyên liệu *' }); await material.click()
  await page.getByRole('option').first().waitFor()
  const optionLabels = await page.getByRole('option').allTextContents()
  result.materialOptionLabels = optionLabels
  const anvCarrot = page.getByRole('option').filter({ hasText: /Cà rốt/i }).filter({ hasText: /AMANN/i })
  if (await anvCarrot.count() !== 1) throw new Error(`Expected one ANV Cà rốt option, found: ${JSON.stringify({ optionLabels, actionResponse: result.actionResponse })}`)
  await anvCarrot.click()
  await dialog.getByLabel('Số lượng trả lại *').click(); await page.keyboard.type('0.0007')
  await dialog.getByRole('button', { name: 'Hư hỏng', exact: true }).click()
  await dialog.getByLabel('Ghi chú bổ sung').pressSequentially('Hao hụt kiểm đếm cuối ca', { delay: 5 })
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/inventory-returns')
  await dialog.getByRole('button', { name: 'Ghi nhận nguyên liệu thừa', exact: true }).click()
  const response = await responsePromise; if (response.status() !== 201) throw new Error(`WASTE create ${response.status()}`)
  await page.getByText(/Đã ghi nhận hao hụt thực tế/).waitFor()
})

const waste = mq(`SELECT ir.returnCode FROM inventoryreturns ir JOIN inventoryreturnlines irl ON irl.returnId=ir.returnId WHERE ir.returnType='WASTE' AND ir.receivedAt IS NULL AND irl.sourceIssueLineId=UNHEX('1B7C6D4BF61915489C0E39C3EFB59534');`).split('\n').at(-1)
if (!waste?.startsWith('WST-')) throw new Error('WASTE create did not persist exact source line')
result.wasteCode = waste

await withActor('thukho', process.env.IPC_LANE7_WAREHOUSE_PASSWORD, async (page) => {
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: waste }); await row.getByRole('button', { name: 'Tiếp nhận', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tiếp nhận nguyên liệu trả' })
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && /\/confirm-receipt$/.test(new URL(response.url()).pathname))
  await dialog.getByRole('button', { name: 'Xác nhận tiếp nhận', exact: true }).click()
  const response = await responsePromise; if (response.status() !== 200) throw new Error(`WASTE confirm ${response.status()}`)
  await page.getByText('Đã ghi nhận hao hụt', { exact: true }).waitFor()
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  if (await page.getByText(waste, { exact: true }).count()) throw new Error('Confirmed WASTE remained pending after reload')
  await page.screenshot({ path: path.join(output, 'waste-recorded-reload.png'), fullPage: true })
})

result.dbPostflight = mq(`
SELECT ir.returnCode,ir.receivedAt IS NOT NULL,ux.username,irl.quantity,HEX(irl.sourceIssueLineId),ir.reason FROM inventoryreturns ir JOIN inventoryreturnlines irl ON irl.returnId=ir.returnId LEFT JOIN users ux ON ux.userId=ir.receivedBy WHERE ir.returnCode='${waste}';
SELECT COUNT(*) movements FROM stockmovements WHERE refTable='inventoryreturns' AND refId=(SELECT returnId FROM inventoryreturns WHERE returnCode='${waste}');
SELECT COUNT(*),MIN(aggregateSequence),MAX(aggregateSequence) FROM lifecycletransitions WHERE aggregateType='InventoryReturn' AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='${waste}');
SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='InventoryReturn' AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='${waste}');
SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='InventoryReturn' AND aggregateId=(SELECT returnId FROM inventoryreturns WHERE returnCode='${waste}');
SELECT COUNT(*) wasteAudit FROM auditlogs WHERE businessArea='ProductionWaste' AND entityId=(SELECT returnLineId FROM inventoryreturnlines WHERE returnId=(SELECT returnId FROM inventoryreturns WHERE returnCode='${waste}'));
`)
const post = result.dbPostflight.replaceAll('\r', '')
const passed = post.includes(`${waste}\t1\tthukho\t0.000700\t1B7C6D4BF61915489C0E39C3EFB59534\tHao hụt kiểm đếm cuối ca`)
  && post.includes('movements\n0') && post.includes('COUNT(*)\tMIN(aggregateSequence)\tMAX(aggregateSequence)\n2\t0\t1') && post.includes('receipts\n2') && post.includes('outbox\n2') && post.includes('wasteAudit\n1')
  && result.requests.some((item) => item.actor === 'beptruong' && item.path === '/api/inventory-returns' && item.status === 201)
  && result.requests.some((item) => item.actor === 'thukho' && item.path.endsWith('/confirm-receipt') && item.status === 200)
  && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
result.verdict = passed ? 'PASS' : 'FAIL'; result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result); if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized)) throw new Error('Credential leaked into WASTE evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2)); if (!passed) process.exitCode = 1
