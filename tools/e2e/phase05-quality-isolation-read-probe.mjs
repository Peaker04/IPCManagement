import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/quality-isolation/probe')
const result = { requests: [], consoleErrors: [], pageErrors: [] }
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
const page = await context.newPage()
page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
page.on('pageerror', (error) => result.pageErrors.push(error.message))
page.on('response', async (response) => {
  const pathname = new URL(response.url()).pathname
  if (!['/api/supplemental-material-requests', '/api/purchase-requests', '/api/purchase-orders'].includes(pathname)) return
  const body = await response.json().catch(() => null)
  const data = body?.data
  result.requests.push({ pathname, status: response.status(), count: Array.isArray(data) ? data.length : Array.isArray(data?.items) ? data.items.length : null, codes: Array.isArray(data) ? data.map((item) => item.purchaseRequestCode ?? item.purchaseOrderCode).filter(Boolean) : Array.isArray(data?.items) ? data.items.map((item) => item.requestCode).filter(Boolean) : [] })
})
try {
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('thumua')
  await page.locator('#password').click(); await page.keyboard.type(process.env.IPC_LANE7_PURCHASING_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/purchasing?week=2026-08-10', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  result.bodyText = (await page.locator('body').innerText()).slice(0, 12000)
  await page.screenshot({ path: path.join(output, 'page.png'), fullPage: true })
} finally {
  await context.close(); await browser.close()
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}
console.log(JSON.stringify(result, null, 2))
