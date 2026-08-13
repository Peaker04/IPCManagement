import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/supplemental-partial')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const sourceLineHex = '77436B29BB29D145803429901CD750D0'
const sourceLineId = '296b4377-29bb-45d1-8034-29901cd750d0'
const otherLineHex = '0C384EC541F3864A89BB20B1650220B0'
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
SELECT c.customerCode,pp.planDate,ppl.shiftName,i.ingredientName,iil.issuedQty,cs.currentQty,HEX(ii.issueId),HEX(iil.issueLineId)
FROM inventoryissuelines iil JOIN inventoryissues ii ON ii.issueId=iil.issueId JOIN materialrequestlines mrl ON mrl.requestLineId=iil.materialRequestLineId
JOIN productionplanlines ppl ON ppl.planLineId=mrl.planLineId JOIN productionplans pp ON pp.planId=ppl.planId JOIN customers c ON c.customerId=ppl.customerId
JOIN ingredients i ON i.ingredientId=iil.ingredientId JOIN currentstock cs ON cs.warehouseId=ii.warehouseId AND cs.ingredientId=iil.ingredientId AND cs.unitId=iil.unitId
WHERE iil.issueLineId=UNHEX('${sourceLineHex}') AND ii.receivedAt IS NOT NULL;
SELECT COUNT(*) sourceRequests FROM supplementalmaterialrequests WHERE issueLineId=UNHEX('${sourceLineHex}');
SELECT COUNT(*) otherRequests FROM supplementalmaterialrequests WHERE issueLineId=UNHEX('${otherLineHex}');
`)
const pre = result.dbPreflight.replaceAll('\r', '')
if (!pre.includes('ipc_lane7\t69\t20260812174836_AddInventoryAllocationDispositions') || !pre.includes('ANV\t2026-08-10\tAFTERNOON\tCá hố\t102.585180\t0.000800') || !pre.includes('sourceRequests\n0') || !pre.includes('otherRequests\n0')) throw new Error(`Supplemental preflight drifted: ${result.dbPreflight}`)

const withActor = async (actor, password, task) => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__p05supplemental', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__p05supplemental('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__p05supplemental('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  page.on('response', (response) => { const request = response.request(); const pathname = new URL(response.url()).pathname; if (request.method() !== 'GET' && pathname.startsWith('/api/')) result.requests.push({ actor, method: request.method(), path: pathname, status: response.status() }) })
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
  const afternoon = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/workflow-reports/kitchen-issues' && new URL(response.url()).searchParams.get('shiftName') === 'AFTERNOON')
  const shift = page.getByRole('combobox', { name: 'Chọn ca sản xuất' }); await shift.click(); await page.getByRole('option', { name: 'Ca Chiều', exact: true }).click(); await afternoon
  await page.getByRole('button', { name: /Yêu cầu cấp bổ sung/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Gửi yêu cầu bổ sung' })
  const material = dialog.getByRole('combobox', { name: /Nguyên liệu cần bổ sung/ }); await material.click()
  const options = page.getByRole('option')
  result.materialOptions = await options.allTextContents()
  const exactOption = options.filter({ hasText: /Cá hố · AMANN · Ca chiều · 25\.000/i })
  if (await exactOption.count() !== 1) throw new Error(`Expected one user-labelled ANV Cá hố source, found: ${JSON.stringify(result.materialOptions)}`)
  await exactOption.click()
  const quantity = dialog.getByLabel('Số lượng cần thêm *')
  await quantity.click(); await page.keyboard.press('1')
  for (let index = 0; index < 3; index += 1) { await quantity.click(); await page.keyboard.press('Home'); await page.keyboard.press('0') }
  await quantity.click(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('.')
  const reason = dialog.getByLabel('Lý do'); await typeControlled(page, reason, 'Phat sinh them suat')
  result.createForm = { material: await material.innerText(), quantity: await quantity.inputValue(), reason: await reason.inputValue() }
  if (result.createForm.quantity !== '0.001' || result.createForm.reason !== 'Phat sinh them suat') throw new Error(`Controlled form readback failed: ${JSON.stringify(result.createForm)}`)
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/supplemental-material-requests')
  await dialog.getByRole('button', { name: 'Gửi tới kho', exact: true }).click()
  const response = await responsePromise; result.createResponse = { status: response.status(), body: await response.json() }
  if (response.status() !== 201) throw new Error(`Supplemental create ${response.status()}`)
  await page.getByText('Đã gửi yêu cầu bổ sung tới kho', { exact: true }).waitFor()
})

const requestCode = result.createResponse.body?.data?.requestCode
if (!requestCode?.startsWith('SUP-')) throw new Error('Supplemental request code missing')

await withActor('thukho', process.env.IPC_LANE7_WAREHOUSE_PASSWORD, async (page) => {
  await page.goto('http://127.0.0.1:3030/warehouse?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: requestCode }); await row.waitFor()
  result.rowBefore = await row.innerText()
  await row.getByRole('button', { name: 'Cấp bổ sung', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Cấp nguyên liệu bổ sung' })
  const quantity = dialog.getByLabel(/Số lượng cấp/)
  result.fulfillQuantity = await quantity.inputValue()
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/fulfill'))
  await dialog.getByRole('button', { name: 'Xác nhận cấp', exact: true }).click()
  const response = await responsePromise; result.fulfillResponse = { status: response.status(), body: await response.json() }
  if (response.status() !== 200) throw new Error(`Supplemental fulfill ${response.status()}`)
  await page.getByText('Đã tạo phiếu xuất bổ sung', { exact: true }).waitFor()
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('tab', { name: 'Ngoại lệ', exact: true }).click()
  const reloaded = page.getByRole('row').filter({ hasText: requestCode }); await reloaded.waitFor(); result.rowAfter = await reloaded.innerText()
  await page.screenshot({ path: path.join(output, 'supplemental-partial-reload.png'), fullPage: true })
})

result.dbPostflight = mq(`
SELECT smr.requestCode,smr.status,smr.requestedQty,HEX(smr.issueLineId),c.customerCode,pp.planDate,ppl.shiftName,i.ingredientName
FROM supplementalmaterialrequests smr JOIN inventoryissuelines src ON src.issueLineId=smr.issueLineId JOIN materialrequestlines mrl ON mrl.requestLineId=src.materialRequestLineId
JOIN productionplanlines ppl ON ppl.planLineId=mrl.planLineId JOIN productionplans pp ON pp.planId=ppl.planId JOIN customers c ON c.customerId=ppl.customerId JOIN ingredients i ON i.ingredientId=smr.ingredientId
WHERE smr.requestCode='${requestCode}';
SELECT COUNT(*) supplementalIssues FROM inventoryissues ii JOIN auditlogs a ON a.newValue=LOWER(CONCAT(SUBSTR(HEX(ii.issueId),1,8),'-',SUBSTR(HEX(ii.issueId),9,4),'-',SUBSTR(HEX(ii.issueId),13,4),'-',SUBSTR(HEX(ii.issueId),17,4),'-',SUBSTR(HEX(ii.issueId),21))) WHERE a.entityId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}') AND a.fieldName='FulfillmentIssueId';
SELECT quantityOut,beforeQty,afterQty FROM stockmovements WHERE refTable='supplementalmaterialrequests' AND refId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*),MIN(aggregateSequence),MAX(aggregateSequence) FROM lifecycletransitions WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) receipts FROM lifecyclecommandreceipts WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) outbox FROM lifecycleoutboxmessages WHERE aggregateType='SupplementalMaterialRequest' AND aggregateId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) lifecycleAudits FROM auditlogs WHERE businessArea='Lifecycle' AND entityName='SupplementalMaterialRequest' AND entityId=(SELECT requestId FROM supplementalmaterialrequests WHERE requestCode='${requestCode}');
SELECT COUNT(*) otherRequests FROM supplementalmaterialrequests WHERE issueLineId=UNHEX('${otherLineHex}');
`)
const post = result.dbPostflight.replaceAll('\r', '')
const passed = post.includes(`${requestCode}\tPARTIALLY_FULFILLED\t0.001000\t${sourceLineHex}\tANV\t2026-08-10\tAFTERNOON\tCá hố`)
  && post.includes('supplementalIssues\n1') && post.includes('0.000800\t0.000800\t0.000000')
  && post.includes('COUNT(*)\tMIN(aggregateSequence)\tMAX(aggregateSequence)\n2\t0\t1') && post.includes('receipts\n2') && post.includes('outbox\n2') && post.includes('lifecycleAudits\n2') && post.includes('otherRequests\n0')
  && result.createForm.quantity === '0.001' && result.fulfillQuantity === '0.0008'
  && result.fulfillResponse.body?.data?.remainingQty === 0.0002 && result.fulfillResponse.body?.data?.concurrencyVersion === 2
  && result.rowAfter.includes('0,0008 kg / 0,001 kg') && result.rowAfter.includes('0,0002')
  && result.requests.some((item) => item.actor === 'beptruong' && item.path === '/api/supplemental-material-requests' && item.status === 201)
  && result.requests.some((item) => item.actor === 'thukho' && item.path.endsWith('/fulfill') && item.status === 200)
  && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
result.verdict = passed ? 'PASS' : 'FAIL'; result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result); if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized)) throw new Error('Credential leaked into supplemental evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2)); if (!passed) process.exitCode = 1
