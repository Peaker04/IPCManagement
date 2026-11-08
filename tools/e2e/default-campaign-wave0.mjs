import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.DEFAULT_CAMPAIGN_URL ?? 'http://127.0.0.1:3040'
const password = process.env.IPC_LANE7_ADMIN_PASSWORD
const output = path.resolve(process.env.DEFAULT_CAMPAIGN_OUTPUT ?? '.artifacts/default-feature-campaign/20260923-075251/browser-wave0')
if (!password) throw new Error('IPC_LANE7_ADMIN_PASSWORD is required')

const routes = ['/', '/weekly-menu', '/reports', '/meal-orders', '/chef-dashboard', '/approvals', '/purchasing', '/warehouse', '/admin-data', '/admin/rules', '/admin/advanced-settings']
const result = { verdict: 'RUNNING', baseUrl, actor: 'admin', routes: [], apiResponses: [], operationSnapshots: [], consoleErrors: [], pageErrors: [], requestFailures: [], mutationRequests: [] }
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1440,900'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', error => result.pageErrors.push(error.message))
page.on('requestfailed', request => {
  if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText })
})
page.on('response', async response => {
  const url = new URL(response.url())
  if (!url.pathname.startsWith('/api/')) return
  result.apiResponses.push({ method: response.request().method(), path: url.pathname, status: response.status() })
  if (url.pathname === '/api/system-operation-mode' && response.status() === 200) {
    const body = await response.json().catch(() => undefined)
    if (body?.data) result.operationSnapshots.push(body.data)
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(response.request().method()) && url.pathname !== '/api/auth/login') {
    result.mutationRequests.push({ method: response.request().method(), path: url.pathname, status: response.status() })
  }
})

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill(password)
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/login'),
    page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
  ])

  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    result.routes.push({
      requested: route,
      finalPath: new URL(page.url()).pathname,
      headings: await page.getByRole('heading').allTextContents(),
      overflow: await page.locator('body').evaluate(element => element.scrollWidth - element.clientWidth),
    })
  }
  result.operation = result.operationSnapshots.at(-1)
  await page.screenshot({ path: path.join(output, 'admin-default-direct-routes.png'), fullPage: true })
  const expectedNavigation = ['dashboard', 'weekly-menu', 'meal-orders', 'approvals', 'purchasing', 'warehouse', 'chef-dashboard', 'reports', 'admin-data', 'approval-rules']
  const navigation = result.operation?.capabilities?.navigation ?? []
  result.verdict = result.operation?.mode === 'DEFAULT'
    && JSON.stringify(navigation) === JSON.stringify(expectedNavigation)
    && result.routes.every(route => route.finalPath === route.requested && route.overflow <= 1)
    && result.mutationRequests.length === 0
    && result.consoleErrors.length === 0
    && result.pageErrors.length === 0
    && result.requestFailures.length === 0
    ? 'PASS' : 'FAIL'
} catch (error) {
  result.verdict = 'FAIL'
  result.failure = String(error?.stack ?? error)
  result.finalUrl = page.url()
  result.bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 20_000)
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
} finally {
  await context.close()
  await browser.close()
  result.finishedAt = new Date().toISOString()
  const serialized = JSON.stringify(result)
  if (serialized.includes(password) || /Bearer\s+[A-Za-z0-9._-]+|"password"\s*:/i.test(serialized)) throw new Error('Secret leaked into Wave 0 evidence')
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}

console.log(JSON.stringify({ verdict: result.verdict, operation: result.operation, routes: result.routes.length, errors: result.consoleErrors.length + result.pageErrors.length + result.requestFailures.length, mutationRequests: result.mutationRequests.length }, null, 2))
if (result.verdict !== 'PASS') process.exitCode = 1
