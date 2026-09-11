import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '../../node_modules/@playwright/test/index.mjs'

const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required; default credentials are prohibited.')

const root = path.resolve('.artifacts/shipyard-live', process.env.IPC_SERVICE_RUN_E2E_RUN ?? 'service-run-variance-waiver-20260805')
const baseUrl = 'http://127.0.0.1:3010'
const planCode = process.env.IPC_SERVICE_RUN_PLAN_CODE ?? 'KHSX-E2E-SERVICE-RUN-WAIVER-20260808'
const requiresServingVarianceDecision = process.env.IPC_SERVICE_RUN_REQUIRE_VARIANCE_DECISION === 'true'
await fs.mkdir(root, { recursive: true })

const evidence = {
  startedAt: new Date().toISOString(), headed: true,
  runtime: { baseUrl, apiUrl: 'http://127.0.0.1:8010', database: 'ipc_e2e_template', credentialSource: 'K6_PASSWORD' },
  planCode, apiRequests: [], consoleErrors: [], pageErrors: [], requestFailures: [], screenshots: [],
}
const context = await chromium.launchPersistentContext(path.resolve('.artifacts/browser-use-service-run-variance-waiver'), {
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false,
  viewport: { width: 1365, height: 900 }, args: ['--window-size=1365,900'],
})
const page = context.pages()[0] ?? await context.newPage()
let probe = 'startup'
const requestBody = (request) => {
  const postData = request.postData()
  if (!postData) return null
  try { return JSON.parse(postData) } catch { return postData }
}
page.on('console', (message) => { if (message.type() === 'error') evidence.consoleErrors.push({ probe, text: message.text() }) })
page.on('pageerror', (error) => evidence.pageErrors.push({ probe, message: error.message }))
page.on('requestfailed', (request) => evidence.requestFailures.push({ probe, method: request.method(), path: new URL(request.url()).pathname, failure: request.failure()?.errorText ?? 'unknown' }))
page.on('response', (response) => {
  const request = response.request()
  const url = new URL(response.url())
  if (request.method() === 'POST' && url.pathname.startsWith('/api/service-runs/')) evidence.apiRequests.push({ probe, method: request.method(), path: url.pathname, status: response.status(), body: requestBody(request) })
})
const settle = async () => { await page.waitForLoadState('domcontentloaded'); await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {}); await page.waitForTimeout(350) }
const screenshot = async (name) => { await page.screenshot({ path: path.join(root, name), fullPage: true }); evidence.screenshots.push(name) }
const post = (pathSuffix) => page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith(pathSuffix), { timeout: 20_000 })

try {
  probe = 'login'
  await page.goto(`${baseUrl}/login`); await settle()
  if (await page.locator('#username').isVisible().catch(() => false)) {
    await page.locator('#username').fill('admin'); await page.locator('#password').fill(password)
    await Promise.all([page.waitForURL((url) => url.pathname !== '/login', { timeout: 20_000 }), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  }

  probe = 'chef:variance-waiver'
  await page.goto(`${baseUrl}/chef-dashboard`); await settle()
  await page.getByLabel('Chọn ngày sản xuất').click(); await page.getByRole('option', { name: 'Thứ Bảy', exact: true }).click()
  const card = page.locator('article[aria-busy]').filter({ hasText: planCode })
  await card.waitFor({ state: 'visible', timeout: 20_000 })
  await screenshot('chef-variance-waiver-before.png')
  const alreadyClosed = await card.getByText('Đã đóng ca', { exact: true }).count() > 0
  let planned
  let actual
  if (alreadyClosed) {
    if (!(await card.innerText()).includes('839 suất')) throw new Error('Closed variance-waiver Service Run did not retain actual servings.')
    evidence.recheckOnly = true
  } else {
  if (await card.getByRole('button', { name: 'Mở Ca phục vụ', exact: true }).count()) {
    const response = post('/api/service-runs'); await card.getByRole('button', { name: 'Mở Ca phục vụ', exact: true }).click()
    if ((await response).status() !== 200) throw new Error('Open variance-waiver Service Run failed.')
  }
  if (await card.getByRole('button', { name: 'Bắt đầu phục vụ', exact: true }).count()) {
    const response = post('/start'); await card.getByRole('button', { name: 'Bắt đầu phục vụ', exact: true }).click()
    if ((await response).status() !== 200) throw new Error('Start variance-waiver Service Run failed.')
  }
  planned = Number((await card.locator('dd').first().innerText()).replace(/\D/g, ''))
  if (!Number.isInteger(planned) || planned < 1) throw new Error('Unable to read planned servings for variance fixture.')
  actual = planned - 1
  await card.getByLabel('Số suất thực tế').fill(String(actual))
  await card.getByLabel('Lý do chênh lệch hoặc quyết định quản lý').fill('E2E: một khách vắng đã được điều phối xác nhận.')
  { const response = post('/actual-servings'); await card.getByRole('button', { name: 'Ghi nhận', exact: true }).click(); if ((await response).status() !== 200) throw new Error('Record variance actual servings failed.') }
  await card.getByText('Chưa xác nhận giao suất', { exact: false }).waitFor({ state: 'visible', timeout: 20_000 })
  await screenshot('chef-variance-recorded.png')
  if (requiresServingVarianceDecision) {
    { const response = post('/serving-variance/resolve'); await card.getByRole('button', { name: 'Quyết định chênh lệch suất', exact: true }).click(); if ((await response).status() !== 200) throw new Error('Serving variance decision failed.') }
    await screenshot('chef-serving-variance-resolved.png')
  }
  { const response = post('/service-confirmation/waive'); await card.getByRole('button', { name: 'Miễn xác nhận', exact: true }).click(); if ((await response).status() !== 200) throw new Error('Manager waiver failed.') }
  await card.getByText('Sẵn sàng đóng ca', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
  await screenshot('chef-confirmation-waived.png')
  { const response = post('/close'); await card.getByRole('button', { name: 'Đóng ca', exact: true }).click(); if ((await response).status() !== 200) throw new Error('Close variance-waiver Service Run failed.') }
  await card.getByText('Đã đóng ca', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
  await screenshot('chef-variance-waiver-closed.png')
  }

  probe = 'chef:variance-waiver-reload'
  await page.reload(); await settle(); await page.getByLabel('Chọn ngày sản xuất').click(); await page.getByRole('option', { name: 'Thứ Bảy', exact: true }).click()
  const reloaded = page.locator('article[aria-busy]').filter({ hasText: planCode })
  await reloaded.getByText('Đã đóng ca', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
  if (!(await reloaded.innerText()).includes(`${actual ?? 839} suất`)) throw new Error('Actual variance did not persist after browser reload.')
  await screenshot('chef-variance-waiver-reload.png')
  evidence.plannedServings = planned ?? 840; evidence.actualServings = actual ?? 839
  evidence.performance = await page.evaluate(() => ({ cls: performance.getEntriesByType('layout-shift').filter((entry) => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0), longTaskCount: performance.getEntriesByType('longtask').length }))
  if (evidence.apiRequests.some((request) => request.status !== 200)) throw new Error(`Service Run mutation failed: ${JSON.stringify(evidence.apiRequests)}`)
} catch (error) {
  evidence.failure = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) }
  await screenshot('service-run-variance-waiver-failure.png').catch(() => {})
  throw error
} finally {
  evidence.finishedAt = new Date().toISOString()
  await fs.writeFile(path.join(root, 'service-run-variance-waiver-e2e.json'), `${JSON.stringify(evidence, null, 2)}\n`)
  await context.close()
}
