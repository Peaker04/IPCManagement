import { chromium } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chrome', headless: false })
const width = Number(process.env.IPC_VIEWPORT_WIDTH ?? 1365)
const height = Number(process.env.IPC_VIEWPORT_HEIGHT ?? 900)
const context = await browser.newContext({ viewport: { width, height } })
const page = await context.newPage()
await page.addInitScript(() => {
  globalThis.__clsSources = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue
      globalThis.__clsSources.push({
        value: entry.value,
        startTime: entry.startTime,
        sources: entry.sources.map((source) => ({
          tag: source.node?.tagName,
          className: typeof source.node?.className === 'string' ? source.node.className : '',
          text: source.node?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120),
          previousRect: source.previousRect,
          currentRect: source.currentRect,
        })),
      })
    }
  }).observe({ type: 'layout-shift', buffered: true })
})
await page.goto('http://127.0.0.1:3030/login', { waitUntil: 'domcontentloaded' })
await page.locator('#username').fill('quanly'); await page.locator('#password').fill(process.env.IPC_LANE7_MANAGER_PASSWORD)
await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
await page.goto('http://127.0.0.1:3030/chef-dashboard', { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
await page.waitForTimeout(1500)
console.log(JSON.stringify(await page.evaluate(() => globalThis.__clsSources), null, 2))
await context.close(); await browser.close()
