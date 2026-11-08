import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.IPC_VISUAL_BASE_URL ?? 'http://127.0.0.1:3031'
const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions/lifecycle-fulfillment')
const result = { verdict: 'RUNNING', lane: 'ipc_lane7', protectedLaneConnectionAttempts: 0, pointerTrusted: false, keyboardTrusted: false, responses: [], consoleErrors: [], pageErrors: [], requestFailures: [] }
await mkdir(output, { recursive: true })
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1365,900'] })
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
  await context.exposeBinding('__fulfillmentEvidence', (_source, kind) => { result[`${kind}Trusted`] = true })
  await context.addInitScript(() => {
    addEventListener('pointerdown', (event) => { if (event.isTrusted) void globalThis.__fulfillmentEvidence('pointer') }, true)
    addEventListener('keydown', (event) => { if (event.isTrusted) void globalThis.__fulfillmentEvidence('keyboard') }, true)
  })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('requestfailed', (request) => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.requestFailures.push({ url: request.url(), error: request.failure()?.errorText }) })
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname
    if (pathname.includes('/ingredient-demand/aggregate/page')) result.responses.push({ pathname, status: response.status(), method: response.request().method() })
  })
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('#username').click(); await page.keyboard.type('admin')
  await page.locator('#password').click(); await page.keyboard.type(process.env.K6_PASSWORD)
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith('/login')), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.goto(`${baseUrl}/weekly-menu`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('combobox').first().click(); await page.getByRole('option', { name: /^ANV -/ }).click()
  const week = page.getByLabel('Tuần bắt đầu'); await week.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('10/08/2026'); await page.keyboard.press('Tab')
  await page.getByRole('tab', { name: 'Nhu cầu', exact: true }).click()
  const viewedDay = page.getByText(/Thứ Sáu 14\/08\/2026/).first()
  await viewedDay.waitFor()
  await page.waitForFunction(() => {
    const text = document.body.innerText
    return text.includes('Vật tư tuần đã được đáp ứng') && text.includes('37/37 nguyên liệu') && text.includes('Dữ liệu đã cập nhật')
  }, undefined, { timeout: 30_000 })
  const body = await page.locator('body').innerText()
  result.readback = {
    readiness: body.includes('Vật tư tuần đã được đáp ứng'),
    weeklyCheckpoint: body.includes('Đã đáp ứng 222/222'),
    dayFulfilled: body.includes('37/37 nguyên liệu'),
    dayRemaining: body.includes('Đã hoàn tất vật tư'),
    falseShortageAbsent: !body.includes('Thiếu 37/37 nguyên liệu') && !body.includes('Còn thiếu 37/37 nguyên liệu'),
    headerFreshness: body.includes('Dữ liệu đã cập nhật'),
  }
  await page.screenshot({ path: path.join(output, 'weekly-menu-2026-08-14.png'), fullPage: true })
  result.verdict = Object.values(result.readback).every(Boolean) && result.pointerTrusted && result.keyboardTrusted && result.responses.some((response) => response.status === 200) && result.consoleErrors.length === 0 && result.pageErrors.length === 0 && result.requestFailures.length === 0 ? 'PASS' : 'FAIL'
  await context.close()
} catch (error) { result.verdict = 'FAIL'; result.failure = String(error?.stack ?? error) }
finally { if (browser) await browser.close().catch(() => {}); result.finishedAtUtc = new Date().toISOString(); const serialized = JSON.stringify(result); if (serialized.includes(process.env.K6_PASSWORD) || /Bearer\s+|"password"\s*:/i.test(serialized)) throw new Error('Secret self-check failed'); await writeFile(path.join(output, 'readback.json'), `${JSON.stringify(result, null, 2)}\n`) }
console.log(JSON.stringify(result, null, 2)); if (result.verdict !== 'PASS') process.exitCode = 1
