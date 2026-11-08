import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve('.')
const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/ui-gate')
const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required.')
await mkdir(output, { recursive: true })

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1365, height: 900 },
  { width: 1280, height: 900 },
]
const canonicalSlots = ['Món mặn 1', 'Món mặn 2', 'Rau', 'Canh', 'Tráng miệng']
const settings = JSON.parse(await readFile(path.join(root, 'backend/src/IPCManagement.Api/appsettings.json'), 'utf8'))
const connection = settings.ConnectionStrings.DefaultConnection.replace(/(Database|Initial Catalog)=[^;]*/i, '$1=ipc_lane7')
if (!/(Database|Initial Catalog)=ipc_lane7(?:;|$)/i.test(connection)) throw new Error('Unsafe lane.')

const evidence = {
  lane: 'ipc_lane7',
  mode: 'headed-read-only-ui-gate',
  protectedLaneConnectionAttempts: 0,
  canonicalSlots,
  viewports: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  apiFailures: [],
  startedAtUtc: new Date().toISOString(),
}
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const waitFor = async url => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(url)).ok) return } catch {}
    await sleep(500)
  }
  throw new Error(`Unavailable: ${url}`)
}
const stop = async child => {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  for (let attempt = 0; attempt < 20 && child.exitCode === null; attempt += 1) await sleep(250)
  if (child.exitCode === null) child.kill('SIGKILL')
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }

let api
let frontend
let browser
try {
  api = spawn('dotnet', ['run', '--no-launch-profile', '--no-build'], {
    cwd: path.join(root, 'backend/src/IPCManagement.Api'),
    env: { ...process.env, ConnectionStrings__DefaultConnection: connection, ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: 'http://127.0.0.1:8030' },
    stdio: 'ignore',
    windowsHide: true,
  })
  frontend = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '3030'], {
    cwd: path.join(root, 'frontend'),
    env: { ...process.env, VITE_PROXY_TARGET: 'http://127.0.0.1:8030' },
    stdio: 'ignore',
    windowsHide: true,
  })
  evidence.createdProcesses = [{ name: 'api', pid: api.pid }, { name: 'frontend', pid: frontend.pid }]
  await waitFor('http://127.0.0.1:8030/health/ready')
  await waitFor('http://127.0.0.1:3030/login')

  browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: false,
  })

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const run = { viewport: `${viewport.width}x${viewport.height}`, customers: [], modal: null, primaryButtons: [] }
    page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push({ viewport: run.viewport, text: message.text() }) })
    page.on('pageerror', error => evidence.pageErrors.push({ viewport: run.viewport, text: error.message }))
    page.on('requestfailed', request => {
      if (request.failure()?.errorText !== 'net::ERR_ABORTED') evidence.requestFailures.push({ viewport: run.viewport, path: new URL(request.url()).pathname, error: request.failure()?.errorText })
    })
    page.on('response', response => {
      if (response.status() >= 400) evidence.apiFailures.push({ viewport: run.viewport, path: new URL(response.url()).pathname, status: response.status() })
    })

    await page.goto('http://127.0.0.1:3030/login')
    await page.locator('#username').fill('admin')
    await page.locator('#password').fill(password)
    await Promise.all([
      page.waitForURL(url => url.pathname !== '/login'),
      page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
    ])
    await page.goto('http://127.0.0.1:3030/weekly-menu')

    for (const customer of ['ANV - AMANN', 'DAV - Draxlmaier']) {
      const customerTrigger = page.getByRole('combobox').first()
      await customerTrigger.click()
      await page.getByRole('option', { name: customer, exact: true }).click()
      const table = page.getByRole('region', { name: 'Bảng bố cục thực đơn theo file khách hàng' })
      await table.getByText('Món mặn 1', { exact: true }).first().waitFor({ timeout: 30000 })
      const tableFacts = await table.evaluate((region, slots) => {
        const normalizeText = value => (value ?? '').replace(/\s+/g, ' ').trim()
        const rows = [...region.querySelectorAll('tbody tr')]
        const labels = rows
          .filter(row => row.querySelectorAll('td').length > 1)
          .map(row => normalizeText(row.querySelector('td')?.textContent))
        const dessertRows = rows.filter(row => normalizeText(row.querySelector('td')?.textContent) === slots[4])
        const dishNames = rows
          .filter(row => row.querySelectorAll('td').length > 1)
          .flatMap(row => [...row.querySelectorAll('td')].slice(1).map(cell => normalizeText(cell.textContent)))
          .filter(value => value && value !== '-')
        const overflowX = getComputedStyle(region).overflowX
        return {
          labels,
          uniqueLabels: [...new Set(labels)],
          dessertRows: dessertRows.map(row => ({ cellCount: row.cells.length, dishColSpan: row.cells[1]?.colSpan ?? 0 })),
          dishNames: [...new Set(dishNames)],
          clientWidth: region.clientWidth,
          scrollWidth: region.scrollWidth,
          overflowDelta: region.scrollWidth - region.clientWidth,
          overflowX,
          horizontalOverflow: !['hidden', 'clip'].includes(overflowX) && region.scrollWidth > region.clientWidth + 1,
        }
      }, canonicalSlots)
      run.customers.push({ customer, ...tableFacts })
      evidence.currentViewport = run
      assert(JSON.stringify(tableFacts.uniqueLabels) === JSON.stringify(canonicalSlots), `${run.viewport} ${customer}: canonical slot labels mismatch.`)
      assert(tableFacts.dessertRows.length > 0 && tableFacts.dessertRows.every(row => row.cellCount === 2 && row.dishColSpan === 6), `${run.viewport} ${customer}: dessert merge mismatch.`)
      assert(!tableFacts.dishNames.some(name => /ngày\s+\d+\s+25k|món chính|phụ\s*1/i.test(name)), `${run.viewport} ${customer}: fixture or legacy labels are visible.`)
      assert(!tableFacts.horizontalOverflow, `${run.viewport} ${customer}: weekly menu table overflows horizontally.`)
    }

    run.primaryButtons = await page.locator('button').evaluateAll(buttons => {
      const luminance = rgb => {
        const values = rgb.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
        return values.map(value => value / 255).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
          .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
      }
      const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      return buttons.map(button => {
        const style = getComputedStyle(button)
        const background = style.backgroundColor
        const foreground = style.color
        const channels = background.startsWith('rgb(') ? background.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [] : []
        const isBlue = channels.length === 3 && channels[2] > channels[0] * 1.15 && channels[2] > channels[1] * 1.05
        return isBlue ? { label: (button.textContent ?? '').replace(/\s+/g, ' ').trim(), background, foreground, contrast: contrast(luminance(background), luminance(foreground)) } : null
      }).filter(Boolean)
    })
    assert(run.primaryButtons.every(button => button.contrast >= 4.5), `${run.viewport}: a blue button has insufficient foreground contrast.`)

    await page.getByRole('button', { name: 'Nhập Excel', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Nhập thực đơn từ Excel' })
    await dialog.waitFor()
    run.modal = await dialog.evaluate(element => {
      const rect = node => { const value = node.getBoundingClientRect(); return { top: value.top, bottom: value.bottom, left: value.left, right: value.right } }
      const header = element.querySelector('[data-slot="dialog-header"]') ?? element.firstElementChild
      const footer = element.querySelector('[data-slot="dialog-footer"]') ?? element.lastElementChild
      const middle = header?.nextElementSibling
      const stickyOutsideTableOwner = [...element.querySelectorAll('*')].filter(node => {
        if (getComputedStyle(node).position !== 'sticky') return false
        return !node.closest('[role="region"], .ipc-table-viewport, .ipc-data-table-shell')
      })
      const text = element.textContent ?? ''
      return {
        horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
        documentHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        stickyOutsideTableOwner: stickyOutsideTableOwner.length,
        headerPosition: header ? getComputedStyle(header).position : null,
        footerPosition: footer ? getComputedStyle(footer).position : null,
        headerOverlapsBody: header && middle ? rect(header).bottom > rect(middle).top + 1 : true,
        footerOverlapsBody: footer && middle ? rect(footer).top < rect(middle).bottom - 1 : true,
        forbiddenTechnicalCopy: /\btier\b|rollback/i.test(text),
      }
    })
    assert(!run.modal.horizontalOverflow && !run.modal.documentHorizontalOverflow, `${run.viewport}: import modal has horizontal overflow.`)
    assert(run.modal.stickyOutsideTableOwner === 0, `${run.viewport}: import modal has sticky bars outside table owners.`)
    assert(run.modal.headerPosition === 'static' && run.modal.footerPosition === 'static', `${run.viewport}: import header/footer are not static.`)
    assert(!run.modal.headerOverlapsBody && !run.modal.footerOverlapsBody, `${run.viewport}: import header/footer overlap content.`)
    assert(!run.modal.forbiddenTechnicalCopy, `${run.viewport}: import modal exposes technical copy.`)
    await page.screenshot({ path: path.join(output, `weekly-menu-${run.viewport}.png`), fullPage: true })
    evidence.viewports.push(run)
    delete evidence.currentViewport
    await context.close()
  }

  assert(evidence.consoleErrors.length === 0, 'Browser console errors occurred.')
  assert(evidence.pageErrors.length === 0, 'Browser page errors occurred.')
  assert(evidence.requestFailures.length === 0, 'Browser request failures occurred.')
  assert(evidence.apiFailures.length === 0, 'API failures occurred.')
  evidence.status = 'PASS'
} catch (error) {
  evidence.status = 'FAIL'
  evidence.failure = String(error?.stack ?? error)
} finally {
  if (browser) await browser.close()
  await Promise.all([stop(frontend), stop(api)])
  evidence.finishedAtUtc = new Date().toISOString()
  evidence.teardown = 'run-owned processes stopped'
  const serialized = JSON.stringify(evidence)
  if (/Bearer\s+|eyJ[a-zA-Z0-9_-]{10,}|"password"\s*:/i.test(serialized)) throw new Error('Evidence secret scan failed.')
  evidence.secretSelfCheck = 'PASS'
  await writeFile(path.join(output, 'canonical-menu-ui-gate.json'), `${JSON.stringify(evidence, null, 2)}\n`)
}
if (evidence.status !== 'PASS') process.exitCode = 1
