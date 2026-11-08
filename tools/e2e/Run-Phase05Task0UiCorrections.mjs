import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve('.')
const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/ui-corrections')
const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required.')
await mkdir(output, { recursive: true })

const evidence = {
  mode: 'headed-read-only-ui-corrections',
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  apiFailures: [],
  startedAtUtc: new Date().toISOString(),
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }
let browser
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()) })
  page.on('pageerror', error => evidence.pageErrors.push(error.message))
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') evidence.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText })
  })
  page.on('response', response => {
    if (response.status() >= 400) evidence.apiFailures.push({ path: new URL(response.url()).pathname, status: response.status() })
  })

  await page.goto('http://127.0.0.1:3030/login')
  await page.locator('#username').fill('admin')
  await page.locator('#password').fill(password)
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/login'),
    page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
  ])
  await page.goto('http://127.0.0.1:3030/weekly-menu')
  await page.getByRole('tab', { name: 'Nhu cầu', exact: true }).click()
  const primaryButton = page.getByRole('button', { name: 'Tạo nhu cầu từ KHSX', exact: true })
  await primaryButton.waitFor({ timeout: 30000 })
  evidence.primaryButtons = await page.locator('button[data-variant="default"]').evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element)
      return {
        label: element.textContent?.replace(/\s+/g, ' ').trim(),
        variant: element.getAttribute('data-variant'),
        color: style.color,
        backgroundColor: style.backgroundColor,
      }
    }))
  assert(evidence.primaryButtons.every(button => button.variant === 'default' && button.color === 'rgb(255, 255, 255)'), 'Shared primary buttons do not use white semantic foreground.')

  await page.getByRole('tab', { name: 'Nguyên liệu món', exact: true }).click()
  const search = page.getByRole('textbox', { name: 'Tìm món ăn' })
  await search.fill('dau khuon')
  await page.getByRole('combobox', { name: 'Chọn món' }).click()
  const options = page.getByRole('option')
  await options.first().waitFor()
  evidence.dishSearch = {
    query: 'dau khuon',
    options: await options.allTextContents(),
  }
  assert(evidence.dishSearch.options.length > 0 && evidence.dishSearch.options.every(label => label.toLocaleLowerCase('vi-VN').includes('đậu khuôn')), 'Dish search did not filter the Select options.')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
  await dialog.getByRole('combobox', { name: 'Khách hàng' }).click()
  await page.getByRole('option', { name: 'ANV - AMANN', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Tuần bắt đầu' }).fill('2026-08-17')
  await dialog.locator('#weekly-menu-import-file').setInputFiles(path.join(root, 'tools/e2e/fixtures/phase05/weekly-menu-golden-ANV.xlsx'))
  await dialog.getByRole('button', { name: 'Thêm file', exact: true }).click()
  const actionRow = dialog.getByTestId('import-job-actions')
  await actionRow.waitFor()
  evidence.modal = await dialog.evaluate(element => {
    const boxes = labels => labels.map(label => {
      const button = [...element.querySelectorAll('button')].find(candidate => candidate.textContent?.replace(/\s+/g, ' ').trim() === label)
      if (!button) return null
      const rect = button.getBoundingClientRect()
      return { label, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    }).filter(Boolean)
    const setup = boxes(['Tải mẫu', 'Chọn file Excel', 'Thêm file'])
    const actions = boxes(['Kiểm tra', 'Lưu', 'Xóa'])
    const sameRow = values => values.length === 3 && Math.max(...values.map(value => value.top)) - Math.min(...values.map(value => value.top)) <= 1
    const nonOverlapping = values => values.every((value, index) => index === 0 || value.left >= values[index - 1].right)
    return {
      setup,
      actions,
      setupSameRow: sameRow(setup),
      actionSameRow: sameRow(actions),
      setupNonOverlapping: nonOverlapping(setup),
      actionNonOverlapping: nonOverlapping(actions),
      horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      documentHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })
  assert(evidence.modal.setupSameRow && evidence.modal.setupNonOverlapping, 'File setup buttons overlap or wrap.')
  assert(evidence.modal.actionSameRow && evidence.modal.actionNonOverlapping, 'Check/save/remove buttons overlap or wrap.')
  assert(!evidence.modal.horizontalOverflow && !evidence.modal.documentHorizontalOverflow, 'Modal or document has horizontal overflow.')

  await page.screenshot({ path: path.join(output, 'task0-ui-corrections-1280x900.png'), fullPage: true })
  assert(evidence.consoleErrors.length === 0 && evidence.pageErrors.length === 0 && evidence.requestFailures.length === 0 && evidence.apiFailures.length === 0, 'Browser or API errors occurred.')
  evidence.status = 'PASS'
  await context.close()
} catch (error) {
  evidence.status = 'FAIL'
  evidence.failure = String(error?.stack ?? error)
} finally {
  if (browser) await browser.close()
  evidence.finishedAtUtc = new Date().toISOString()
  const serialized = JSON.stringify(evidence)
  if (/Bearer\s+|eyJ[a-zA-Z0-9_-]{10,}|"password"\s*:/i.test(serialized)) throw new Error('Evidence secret scan failed.')
  evidence.secretSelfCheck = 'PASS'
  await writeFile(path.join(output, 'task0-ui-corrections.json'), `${JSON.stringify(evidence, null, 2)}\n`)
}
if (evidence.status !== 'PASS') process.exitCode = 1
