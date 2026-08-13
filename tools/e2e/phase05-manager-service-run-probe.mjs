import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/service-runs/manager-probe')
await mkdir(output, { recursive: true })
const result = { url: '', responses: [], headings: [], alerts: [], combobox: null, options: [], planCodes: [], consoleErrors: [], pageErrors: [] }
const context = await chromium.launchPersistentContext(path.resolve('.artifacts/browser-use-service-run-manager-probe'), {
  channel: 'chrome', headless: false, viewport: { width: 1365, height: 900 }, args: ['--window-size=1365,900'],
})
try {
  const page = context.pages()[0] ?? await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname.startsWith('/api/')) result.responses.push({ method: response.request().method(), path: url.pathname, query: url.search, status: response.status() })
  })
  await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#username').fill('quanly'); await page.locator('#password').fill(process.env.IPC_LANE7_MANAGER_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto('http://127.0.0.1:3030/chef-dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  result.url = page.url()
  result.headings = await page.getByRole('heading').allTextContents()
  result.alerts = await page.getByRole('alert').allTextContents()
  const trigger = page.getByRole('combobox', { name: 'Chọn ngày sản xuất' })
  result.combobox = await trigger.count() ? await trigger.textContent() : null
  if (await trigger.count()) {
    await trigger.click()
    result.dayElements = await page.locator('body *').evaluateAll((elements) => elements
      .filter((element) => /^Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)$/.test(element.textContent?.trim() ?? ''))
      .map((element) => ({ tag: element.tagName, text: element.textContent?.trim(), role: element.getAttribute('role'), dataSlot: element.getAttribute('data-slot'), id: element.id, className: element.className })))
    await page.keyboard.press('Escape')
  }
  result.planCodes = await page.locator('article').locator('span').filter({ hasText: /^KHSX-/ }).allTextContents()
  await page.screenshot({ path: path.join(output, 'manager-workbench.png'), fullPage: true })
} finally {
  await context.close()
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
}
console.log(JSON.stringify(result, null, 2))
