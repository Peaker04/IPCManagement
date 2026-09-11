import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '../../node_modules/@playwright/test/index.mjs'

const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required; default credentials are prohibited.')

const root = path.resolve('.artifacts/shipyard-live', process.env.IPC_SERVICE_RUN_E2E_RUN ?? 'service-run-lifecycle-20260805')
const baseUrl = 'http://127.0.0.1:3010'
const serviceDayLabel = process.env.IPC_SERVICE_RUN_DAY_LABEL ?? 'Thứ Bảy'
const expectBlocked = process.env.IPC_SERVICE_RUN_EXPECT_BLOCKED === 'true'
const database = process.env.IPC_E2E_DATABASE ?? 'ipc_e2e_template'
await fs.mkdir(root, { recursive: true })

const evidence = {
  startedAt: new Date().toISOString(),
  runtime: { baseUrl, apiUrl: 'http://127.0.0.1:8010', database, credentialSource: 'K6_PASSWORD' },
  headed: true,
  apiResponses: [], consoleErrors: [], pageErrors: [], requestFailures: [], screenshots: [],
}
const context = await chromium.launchPersistentContext(path.resolve('.artifacts/browser-use-service-run-lifecycle'), {
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false,
  viewport: { width: 1365, height: 900 }, args: ['--window-size=1365,900'],
})
const page = context.pages()[0] ?? await context.newPage()
let probe = 'startup'
page.on('console', (message) => { if (message.type() === 'error') evidence.consoleErrors.push({ probe, text: message.text() }) })
page.on('pageerror', (error) => evidence.pageErrors.push({ probe, message: error.message }))
page.on('requestfailed', (request) => evidence.requestFailures.push({ probe, method: request.method(), path: new URL(request.url()).pathname, failure: request.failure()?.errorText ?? 'unknown' }))
page.on('response', async (response) => {
  const url = new URL(response.url())
  if (!url.pathname.startsWith('/api/')) return
  const record = { probe, method: response.request().method(), status: response.status(), path: url.pathname }
  if (record.method === 'POST' && url.pathname.startsWith('/api/service-runs')) record.body = await response.json().catch(() => null)
  evidence.apiResponses.push(record)
})
const settle = async () => {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(400)
}
const screenshot = async (name) => {
  const file = path.join(root, name)
  await page.screenshot({ path: file, fullPage: true })
  evidence.screenshots.push(name)
}
const serviceResponse = () => page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.startsWith('/api/service-runs/'), { timeout: 20_000 })

try {
  probe = 'login'
  await page.goto(`${baseUrl}/login`)
  await settle()
  if (await page.locator('#username').isVisible().catch(() => false)) {
    await page.locator('#username').fill('admin')
    await page.locator('#password').fill(password)
    await Promise.all([page.waitForURL((url) => url.pathname !== '/login', { timeout: 20_000 }), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  }

  probe = `chef:${serviceDayLabel}`
  await page.goto(`${baseUrl}/chef-dashboard`)
  await settle()
  await page.getByLabel('Chọn ngày sản xuất').click()
  await page.getByRole('option', { name: serviceDayLabel, exact: true }).click()
  await page.getByText('Ca phục vụ thực tế', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
  await screenshot('chef-service-run-before.png')

  const cards = page.locator('article[aria-busy]')
  const cardCount = await cards.count()
  if (!cardCount) throw new Error('No Service Run cards rendered for the selected day and shift.')
  evidence.initialCards = await cards.allTextContents()
  const unopenedCount = await cards.filter({ has: page.getByRole('button', { name: 'Mở Ca phục vụ', exact: true }) }).count()
  for (let index = 0; index < unopenedCount; index += 1) {
    const unopenedCard = cards.filter({ has: page.getByRole('button', { name: 'Mở Ca phục vụ', exact: true }) }).first()
    const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/service-runs', { timeout: 20_000 })
    await unopenedCard.getByRole('button', { name: 'Mở Ca phục vụ', exact: true }).click()
    if ((await responsePromise).status() !== 200) throw new Error('Open Service Run failed.')
  }
  const cardTexts = await cards.allTextContents()
  evidence.openedCards = cardTexts
  const readyCardIndex = cardTexts.findIndex((text) => text.includes('Sẵn sàng phục vụ'))
  const blockedCardIndex = cardTexts.findIndex((text) => text.includes('Đang bị chặn'))
  evidence.blockedBranchObserved = blockedCardIndex >= 0
  if (readyCardIndex < 0) {
    if (expectBlocked && blockedCardIndex >= 0) {
      evidence.expectedBlocked = true
      await screenshot('chef-service-run-blocked.png')
      evidence.performance = await page.evaluate(() => ({
        cls: performance.getEntriesByType('layout-shift').filter((entry) => !(entry).hadRecentInput).reduce((total, entry) => total + (entry).value, 0),
        longTasks: performance.getEntriesByType('longtask').map((entry) => ({ duration: entry.duration, startTime: entry.startTime })),
      }))
      throw new Error('__SERVICE_RUN_EXPECTED_BLOCKED__')
    }
    const existingClosed = cards.filter({ hasText: 'Đã đóng ca' }).first()
    if (await existingClosed.count()) {
      evidence.alreadyClosed = true
      await screenshot('chef-service-run-closed-recheck.png')
      evidence.performance = await page.evaluate(() => ({
        cls: performance.getEntriesByType('layout-shift').filter((entry) => !(entry).hadRecentInput).reduce((total, entry) => total + (entry).value, 0),
        longTasks: performance.getEntriesByType('longtask').map((entry) => ({ duration: entry.duration, startTime: entry.startTime })),
      }))
      throw new Error('__SERVICE_RUN_ALREADY_CLOSED__')
    }
    throw new Error(`No ready Service Run found after opening the available plans; observed cards: ${JSON.stringify(cardTexts)}`)
  }
  const card = cards.nth(readyCardIndex)
  if (await card.getByRole('button', { name: 'Bắt đầu phục vụ', exact: true }).count()) {
    const responsePromise = serviceResponse()
    await card.getByRole('button', { name: 'Bắt đầu phục vụ', exact: true }).click()
    if ((await responsePromise).status() !== 200) throw new Error('Start Service Run failed.')
  }
  const planned = Number((await card.locator('dd').first().innerText()).replace(/\D/g, ''))
  if (!Number.isFinite(planned) || planned < 0) throw new Error('Unable to read planned servings from the Service Run card.')
  const actualInput = card.getByLabel('Số suất thực tế')
  await actualInput.fill(String(planned))
  {
    const responsePromise = serviceResponse()
    await card.getByRole('button', { name: 'Ghi nhận', exact: true }).click()
    if ((await responsePromise).status() !== 200) throw new Error('Record actual servings failed.')
  }
  {
    const responsePromise = serviceResponse()
    await card.getByRole('button', { name: 'Xác nhận phục vụ', exact: true }).click()
    if ((await responsePromise).status() !== 200) throw new Error('Confirm Service Run failed.')
  }
  {
    const responsePromise = serviceResponse()
    await card.getByRole('button', { name: 'Đóng ca', exact: true }).click()
    if ((await responsePromise).status() !== 200) throw new Error('Close Service Run failed.')
  }
  await screenshot('chef-service-run-closed.png')
  await page.reload(); await settle()
  await page.getByLabel('Chọn ngày sản xuất').click(); await page.getByRole('option', { name: 'Thứ Bảy', exact: true }).click()
  const closedCard = page.locator('article').filter({ hasText: 'Đã đóng ca' }).first()
  await closedCard.waitFor({ state: 'visible', timeout: 20_000 })
  if (await closedCard.getByText('Đã đóng ca', { exact: true }).count() !== 1) throw new Error('Closed Service Run did not persist after reload.')
  await closedCard.getByLabel('Số suất điều chỉnh hậu kiểm').fill(String(planned))
  await closedCard.getByLabel('Lý do điều chỉnh hậu kiểm').fill('E2E hậu kiểm: xác nhận lại số suất sau khi đóng ca.')
  {
    const responsePromise = serviceResponse()
    await closedCard.getByRole('button', { name: 'Ghi điều chỉnh hậu kiểm', exact: true }).click()
    if ((await responsePromise).status() !== 200) throw new Error('Append-only Service Run correction failed.')
  }
  await screenshot('chef-service-run-adjustment.png')
  evidence.performance = await page.evaluate(() => ({
    cls: performance.getEntriesByType('layout-shift').filter((entry) => !(entry).hadRecentInput).reduce((total, entry) => total + (entry).value, 0),
    longTasks: performance.getEntriesByType('longtask').map((entry) => ({ duration: entry.duration, startTime: entry.startTime })),
  }))
} catch (error) {
  if (error instanceof Error && (error.message === '__SERVICE_RUN_ALREADY_CLOSED__' || error.message === '__SERVICE_RUN_EXPECTED_BLOCKED__')) {
    evidence.recheckOnly = true
  } else {
  evidence.failure = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) }
  await screenshot('service-run-failure.png').catch(() => {})
  throw error
  }
} finally {
  evidence.finishedAt = new Date().toISOString()
  await fs.writeFile(path.join(root, 'service-run-browser-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`)
  await context.close()
}
