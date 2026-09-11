import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/ambiguous-lineage')
const mysql = 'C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe'
const mq = (sql) => execFileSync(mysql, ['--host=localhost', '--port=3306', '--user=root', '--database=ipc_lane7', '--batch', '--raw', `--execute=${sql}`], { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD } }).trim()
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, mode: 'headed-read-only-current-source', physicalInput: { pointerTrusted: false, keyboardTrusted: false, workaroundAccepted: false }, requests: [], mutationRequests: [], consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
result.dbPreflight = mq(`
  SELECT DATABASE(),COUNT(*),MAX(migrationId) FROM __EFMigrationsHistory;
  SELECT COUNT(*) fixtureLines FROM inventoryissuelines WHERE issueLineId=UNHEX('A0510000000000000000000000000002') AND materialRequestLineId IS NULL;
  SELECT COUNT(*) candidates FROM materialrequestlines mrl JOIN inventoryissues i ON i.materialRequestId=mrl.requestId JOIN inventoryissuelines il ON il.issueId=i.issueId WHERE il.issueLineId=UNHEX('A0510000000000000000000000000002') AND mrl.ingredientId=il.ingredientId AND mrl.unitId=il.unitId;
  SELECT COUNT(*) movements FROM stockmovements;
  SELECT COUNT(*) dispositions FROM legacylinedispositions;
`)
if (!result.dbPreflight.includes('ipc_lane7\t70\t20260813171032_AddMenuAmendmentDecisionFanRemediations') || !result.dbPreflight.includes('fixtureLines\r\n1') || !result.dbPreflight.includes('candidates\r\n3') || !result.dbPreflight.includes('movements\r\n1661') || !result.dbPreflight.endsWith('dispositions\r\n0')) throw new Error(`Ambiguous lineage preflight drifted: ${result.dbPreflight}`)

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.exposeBinding('__phase05AmbiguousPhysical', (_source, kind) => { result.physicalInput[`${kind}Trusted`] = true })
await context.addInitScript(() => {
  addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__phase05AmbiguousPhysical('pointer') }, true)
  addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__phase05AmbiguousPhysical('keyboard') }, true)
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
  await page.goto('http://127.0.0.1:3035/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('admin')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_ADMIN_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3035/reports?view=usage', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const usageTab = page.getByRole('tab', { name: 'Sử dụng thực tế' })
  if ((await usageTab.getAttribute('aria-selected')) !== 'true') await usageTab.click()
  for (const label of ['Từ ngày', 'Đến ngày']) {
    const date = page.getByLabel(label)
    await date.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('11/08/2026'); await page.keyboard.press('Tab')
  }
  const decisionBadges = page.getByText('Cần quyết định · 1 dòng', { exact: true })
  await decisionBadges.first().waitFor()
  await page.getByText(/Dòng xuất kho · MR-ANV-20260811-FULLDAY · Thịt bằm · Kilogram/).waitFor()
  const bodyBeforeCandidates = await page.locator('body').innerText()
  const candidateResponse = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/legacy-lineage-dispositions/candidates')
  await page.getByRole('button', { name: 'Chọn dòng đích', exact: true }).click()
  if ((await candidateResponse).status() !== 200) throw new Error('Candidate query failed')
  const candidateTrigger = page.getByRole('combobox', { name: 'Dòng chứng từ đích' })
  await candidateTrigger.click()
  const renderedCandidateItems = page.locator('[data-slot="select-content"] [data-slot="select-item"]')
  await renderedCandidateItems.last().waitFor()
  result.dom = {
    decisionBadgeCount: await decisionBadges.count(),
    workItemCount: await page.getByRole('button', { name: 'Chọn dòng đích', exact: true }).count(),
    sourceLabel: 'Dòng xuất kho · MR-ANV-20260811-FULLDAY · Thịt bằm · Kilogram',
    candidateCount: await renderedCandidateItems.count(),
    pageOptionCount: await page.getByRole('option').count(),
    candidateOptionLabels: await renderedCandidateItems.allTextContents(),
    openListboxCount: await page.getByRole('listbox').count(),
    placeholderPreserved: (await candidateTrigger.innerText()).includes('Chọn dòng chứng từ hợp lệ'),
    technicalLeakBeforeCandidates: /LEGACY_|ISSUE_LINE|A0510000|\bv0\b/.test(bodyBeforeCandidates),
    technicalLeakInOptions: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|Mã dòng kỹ thuật|Đơn vị: [0-9a-f-]{36}/i.test(await page.locator('body').innerText()),
  }
  await page.keyboard.press('Escape')
  await page.screenshot({ path: path.join(output, 'ambiguous-lineage-need-decision.png'), fullPage: true })
} finally { await context.close(); await browser.close() }
result.dbPostflight = mq(`
  SELECT COUNT(*) nullableFixture FROM inventoryissuelines WHERE issueLineId=UNHEX('A0510000000000000000000000000002') AND materialRequestLineId IS NULL;
  SELECT COUNT(*) movements FROM stockmovements;
  SELECT COUNT(*) fixtureMovements FROM stockmovements WHERE refId IN (UNHEX('A0510000000000000000000000000001'),UNHEX('A0510000000000000000000000000002'));
  SELECT COUNT(*) dispositions FROM legacylinedispositions;
`)
const apiFailures = result.requests.filter((item) => item.status >= 400 && item.path !== '/api/auth/profile')
const passed = result.dom.decisionBadgeCount === 3 && result.dom.workItemCount === 1 && result.dom.candidateCount === 3 && result.dom.placeholderPreserved && !result.dom.technicalLeakBeforeCandidates && !result.dom.technicalLeakInOptions && result.mutationRequests.length === 0 && result.dbPostflight.includes('nullableFixture\r\n1') && result.dbPostflight.includes('movements\r\n1661') && result.dbPostflight.includes('fixtureMovements\r\n0') && result.dbPostflight.endsWith('dispositions\r\n0') && result.physicalInput.pointerTrusted && result.physicalInput.keyboardTrusted && !apiFailures.length && !result.consoleErrors.length && !result.pageErrors.length && !result.requestFailures.length
if (!passed) throw new Error(`Ambiguous lineage headed gate failed: ${JSON.stringify(result, null, 2)}`)
result.verdict = 'PASS'
result.finishedAtUtc = new Date().toISOString()
const serialized = JSON.stringify(result)
if (/Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized) || serialized.includes(process.env.IPC_LANE7_ADMIN_PASSWORD)) throw new Error('Credential leaked into ambiguous lineage evidence')
await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
