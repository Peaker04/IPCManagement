#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { buildSourceIdentity } from '../../tools/live-visual-audit-contract.mjs'
import { detectServedMode, summarizeFrameMetrics } from './perf-probe-metrics.mjs'

const CONFIG = {
  baseUrl: process.env.PROBE_BASE_URL || 'http://127.0.0.1:3037',
  runtimeMode: process.env.PROBE_RUNTIME_MODE || 'unspecified',
  profileQuery: process.env.PROBE_PROFILE || 'mock=huge',
  credentials: {
    username: process.env.PROBE_USERNAME || '',
    password: process.env.PROBE_PASSWORD || '',
  },
  viewports: [
    { w: 1280, h: 720 },
    { w: 1366, h: 768 },
    { w: 1440, h: 900 },
    { w: 1920, h: 1080 },
  ],
  primaryViewport: { w: 1440, h: 900 },
  throttle: {
    cpuRate: Number(process.env.PROBE_CPU_RATE || 4),
    downKbps: Number(process.env.PROBE_DOWN_KBPS || 500),
    upKbps: Number(process.env.PROBE_UP_KBPS || 500),
    latencyMs: Number(process.env.PROBE_LATENCY_MS || 400),
  },
  settle: { quietMs: 700, maxWaitMs: 60000, pollMs: 100 },
  thresholds: {
    CGR_MAX: 0.1,
    CLS_MAX: 0.1,
    SCROLL_GROWTH_MAX_RATIO: 0.5,
    INP_MAX: 200,
    INP_MAX_LAB_4X: 500,
    OVERFLOW_TOLERANCE_PX: 1,
    PRESENTATION_DOMINANT_SHARE: 0.6,
    REPEATS: Number(process.env.PROBE_REPEATS || 5),
  },
  reportPath: process.env.PROBE_REPORT || 'artifacts/perf-probe-report.json',
}

const ROUTES = [
  { id: 'dashboard', path: '/', tabs: [] },
  { id: 'weekly-menu', path: '/weekly-menu', tabs: ['schedule', 'demand', 'production-plan', 'purchase-summary', 'cost', 'dish-materials'] },
  { id: 'coordination', path: '/meal-orders', tabs: [] },
  { id: 'reports', path: '/reports', tabs: ['reports-price', 'reports-demand', 'reports-stock', 'reports-data-quality'] },
  { id: 'admin-data', path: '/admin-data', tabs: ['admin-bom-import', 'admin-contracts', 'admin-cleanup', 'admin-inventory', 'admin-statistics', 'admin-employees', 'admin-audit'] },
  { id: 'warehouse', path: '/warehouse', tabs: ['warehouse-movement', 'warehouse-demand', 'warehouse-exceptions'] },
  { id: 'purchasing', path: '/purchasing', tabs: ['purchasing-workflow', 'purchasing-supplemental', 'purchasing-quotations'] },
  { id: 'chef', path: '/chef-dashboard', tabs: ['chef-production', 'chef-documents'] },
  { id: 'approvals', path: '/approvals', tabs: ['approval-queue', 'approval-history'] },
  { id: 'approval-rules', path: '/admin/rules', tabs: [] },
]

const TARGETS = ROUTES.flatMap((route) =>
  (route.tabs.length ? route.tabs : [null]).map((tab) => ({
    id: tab || route.id,
    route: route.id,
    tab,
    path: route.path,
  })),
)

const INTERACTIONS = [
  { id: 'control', label: 'Thao tác 0 — Đối chứng', selector: null, action: null },
  { id: 'tab-switch', label: 'Thao tác 1 — Chuyển tab', selector: '[role="tab"]:not([aria-selected="true"])', action: 'click' },
  { id: 'scope-change', label: 'Thao tác 2 — Đổi phạm vi', selector: '[data-scope-control] button, [data-scope-control] [role="combobox"]', action: 'click' },
  { id: 'table-sort', label: 'Thao tác 3 — Sort cột', selector: 'thead th button, thead th [role="button"], thead th[aria-sort]', action: 'click' },
  { id: 'pagination', label: 'Thao tác 4 — Chuyển trang', selector: 'nav[aria-label*="Phân trang"] button:not(:disabled)', action: 'click' },
  { id: 'search-keystroke', label: 'Thao tác 5 — Gõ tìm kiếm', selector: 'input[type="search"], input[role="searchbox"]', action: 'type' },
  { id: 'modal-open', label: 'Thao tác 6 — Mở modal', selector: '[data-modal-trigger], [aria-haspopup="dialog"]', action: 'click' },
  { id: 'row-action', label: 'Thao tác 7 — Hành động hàng', selector: 'tbody tr button, tbody tr [role="button"], tbody tr a[href]', action: 'click' },
  { id: 'sidebar-toggle', label: 'Thao tác 8 — Sidebar toggle', selector: '[data-sidebar-toggle], nav button[aria-expanded][aria-controls]', action: 'click' },
  { id: 'export-action', label: 'Thao tác 9 — Xuất dữ liệu', selector: 'button[data-inp-action^="export-"]', action: 'click' },
  { id: 'workflow-submit', label: 'Thao tác 10 — Gửi quyết định', selector: 'button[data-inp-action$="submit-purchase-request"], button[data-inp-action="confirm-supplier"]', action: 'click' },
  { id: 'approval-confirm', label: 'Thao tác 11 — Xác nhận phê duyệt', selector: 'button[data-inp-action="confirm-approval-decision"]', action: 'click' },
]
const interactionFilter = process.env.PROBE_INTERACTIONS?.split(',').map((value) => value.trim()).filter(Boolean)
const ACTIVE_INTERACTIONS = interactionFilter?.length
  ? INTERACTIONS.filter((interaction) => interactionFilter.includes(interaction.id))
  : INTERACTIONS

const T = CONFIG.thresholds
if (!Number.isInteger(T.REPEATS) || T.REPEATS < 3) throw new Error('PROBE_REPEATS phải là số nguyên >= 3 để tạo distribution hợp lệ.')
const round = (value, digits = 2) => value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits
const median = (values) => {
  const sorted = values.filter((value) => value != null).slice().sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const verdict = (value, maximum) => value == null ? 'N/A' : value <= maximum ? 'DAT' : 'TRUOT'

function targetUrl(target) {
  const url = new URL(target.path, CONFIG.baseUrl)
  for (const pair of CONFIG.profileQuery.split('&').filter(Boolean)) {
    const [key, ...rest] = pair.split('=')
    url.searchParams.set(key, rest.join('='))
  }
  return url.toString()
}

function initProbe() {
  const probe = { shifts: [], events: [], frameTimes: [], loafs: [], eventSupported: false, loafSupported: false, lcp: null }
  window.__probe = probe
  let lastFrame = performance.now()
  const captureFrame = (now) => {
    probe.frameTimes.push({ startTime: lastFrame, duration: now - lastFrame })
    lastFrame = now
    requestAnimationFrame(captureFrame)
  }
  probe.resetInteractionMetrics = () => {
    probe.events.length = 0
    probe.frameTimes.length = 0
    probe.loafs.length = 0
    lastFrame = performance.now()
    return lastFrame
  }
  requestAnimationFrame(captureFrame)
  const describe = (node) => {
    if (!node || node.nodeType !== 1) return null
    const id = node.id ? `#${node.id}` : ''
    const classes = (node.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3)
    return `${node.tagName.toLowerCase()}${id}${classes.length ? `.${classes.join('.')}` : ''}`
  }
  const rect = (value) => value ? { x: value.x, y: value.y, w: value.width, h: value.height } : null
  try {
    probe.loafSupported = PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame') === true
    if (probe.loafSupported) new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) probe.loafs.push({
        startTime: entry.startTime,
        duration: entry.duration,
        blockingDuration: entry.blockingDuration ?? 0,
        renderStart: entry.renderStart ?? null,
        styleAndLayoutStart: entry.styleAndLayoutStart ?? null,
        scriptCount: entry.scripts?.length ?? 0,
      })
    }).observe({ type: 'long-animation-frame', buffered: true })
  } catch (error) {
    probe.loafSupported = false
    probe.loafObserverError = String(error)
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) probe.shifts.push({
          value: entry.value,
          startTime: entry.startTime,
          sources: (entry.sources || []).map((source) => ({ node: describe(source.node), from: rect(source.previousRect), to: rect(source.currentRect) })),
        })
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch (error) { probe.shiftObserverError = String(error) }
  try {
    probe.eventSupported = PerformanceObserver.supportedEntryTypes?.includes('event') === true
    if (!probe.eventSupported) throw new Error('PerformanceEventTiming observer is unsupported')
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.interactionId) probe.events.push({
          name: entry.name,
          startTime: entry.startTime,
          processingStart: entry.processingStart,
          processingEnd: entry.processingEnd,
          duration: entry.duration,
          target: describe(entry.target),
        })
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
  } catch (error) { probe.eventObserverError = String(error) }
  try {
    new PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1)
      if (entry) probe.lcp = { startTime: entry.startTime, element: describe(entry.element), size: entry.size }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch (error) { probe.lcpObserverError = String(error) }
  probe.clsWindow = () => {
    let best = 0; let current = 0; let first = 0; let previous = 0
    for (const shift of probe.shifts) {
      if (current && (shift.startTime - previous > 1000 || shift.startTime - first > 5000)) current = 0
      if (!current) first = shift.startTime
      current += shift.value; previous = shift.startTime; best = Math.max(best, current)
    }
    return best
  }
}

let authState
let authToken
let authUser
const useMockAuth = () => CONFIG.credentials.username === 'admin' && CONFIG.credentials.password === 'admin'

async function bootstrapAuth(browser) {
  if (!CONFIG.credentials.username || !CONFIG.credentials.password) {
    throw new Error('Thiếu PROBE_USERNAME hoặc PROBE_PASSWORD; đầu đo không được phép đo trang đăng nhập thay cho route bảo vệ.')
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  try {
    if (CONFIG.credentials.username === 'admin' && CONFIG.credentials.password === 'admin') {
      await page.goto(new URL('/login', CONFIG.baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: CONFIG.settle.maxWaitMs })
      await page.evaluate(() => {
        localStorage.setItem('user', JSON.stringify({
          id: 'dev-admin', username: 'admin', fullName: 'Trần Văn Giám Đốc', role: 'admin',
          roleCode: 'ADMIN', roleName: 'admin', isAdminFullAccess: true, permissions: ['*'],
        }))
        sessionStorage.setItem('token', 'dev-login-fallback-token-admin')
      })
      await page.goto(new URL('/', CONFIG.baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: CONFIG.settle.maxWaitMs })
      authState = await context.storageState()
      authToken = await page.evaluate(() => sessionStorage.getItem('token'))
      authUser = await page.evaluate(() => sessionStorage.getItem('user'))
      return
    }
    if (useMockAuth()) {
      // The repository's mock-login contract is activated by making the login
      // mutation fail, which lets LoginPage's explicit admin/admin fallback run.
      await page.route('**/api/auth/login', (route) => route.abort())
    }
    await page.goto(new URL('/login', CONFIG.baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: CONFIG.settle.maxWaitMs })
    await page.locator('#username').fill(CONFIG.credentials.username)
    await page.locator('#password').fill(CONFIG.credentials.password)
    const operationModeResponse = page.waitForResponse((response) => response.url().includes('/api/system-operation-mode') && response.status() === 200, { timeout: CONFIG.settle.maxWaitMs })
    await Promise.all([
      page.waitForURL((url) => url.pathname !== '/login', { timeout: CONFIG.settle.maxWaitMs }),
      operationModeResponse,
      page.getByRole('button', { name: 'Đăng nhập' }).click(),
    ])
    await page.waitForSelector('.ipc-content-shell', { state: 'attached', timeout: CONFIG.settle.maxWaitMs })
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('token') && sessionStorage.getItem('user')), undefined, { timeout: CONFIG.settle.maxWaitMs })
    authState = await context.storageState()
    authToken = await page.evaluate(() => sessionStorage.getItem('token'))
    authUser = await page.evaluate(() => sessionStorage.getItem('user'))
  } finally {
    await context.close()
  }
}

async function newColdPage(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.w, height: viewport.h },
    deviceScaleFactor: 1,
    storageState: authState,
  })
  const page = await context.newPage()
  await page.addInitScript(({ token, user }) => {
    if (token) sessionStorage.setItem('token', token)
    if (user) sessionStorage.setItem('user', user)
  }, { token: authToken, user: authUser })
  if (useMockAuth()) await page.route('**/api/auth/profile', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, data: {
        userId: 'dev-admin', username: 'admin', fullName: 'Trần Văn Giám Đốc',
        roleCode: 'ADMIN', roleName: 'admin', isAdminFullAccess: true, permissions: ['*'],
      },
    }),
  }))
  await page.addInitScript(initProbe)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.clearBrowserCache')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: CONFIG.throttle.latencyMs,
    downloadThroughput: CONFIG.throttle.downKbps * 128,
    uploadThroughput: CONFIG.throttle.upKbps * 128,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CONFIG.throttle.cpuRate })
  return { context, page }
}

async function openTarget(page, target) {
  const expected = new URL(target.path, CONFIG.baseUrl).pathname
  await page.goto(targetUrl(target), { waitUntil: 'commit', timeout: CONFIG.settle.maxWaitMs })
  await page.waitForSelector('.ipc-content-shell', { state: 'attached', timeout: CONFIG.settle.maxWaitMs })
  const actual = new URL(page.url()).pathname
  if (actual !== expected) throw new Error(`Route mismatch: expected ${expected}, received ${actual}`)
  if (target.tab) {
    await page.waitForSelector(`#${target.tab}-tab`, { state: 'attached', timeout: CONFIG.settle.maxWaitMs })
    const tab = page.locator(`#${target.tab}-tab`)
    if (await tab.count() !== 1) throw new Error(`Không tìm thấy đúng một tab #${target.tab}-tab`)
    if (await tab.getAttribute('aria-selected') !== 'true') await tab.click()
    await page.waitForFunction((id) => document.getElementById(`${id}-tab`)?.getAttribute('aria-selected') === 'true', target.tab)
  }
}

async function snapshot(page, target) {
  return page.evaluate((tab) => {
    const scope = tab ? document.getElementById(`${tab}-panel`) : document.querySelector('.ipc-content-shell')
    const visible = (node) => node && node.getClientRects().length > 0
    const frame = scope ? [...scope.querySelectorAll('.ipc-table-viewport')].find(visible) : null
    const rows = frame ? [...frame.querySelectorAll('tbody tr')].filter(visible) : []
    const skeletons = rows.filter((row) => row.matches('.ipc-skeleton-row'))
    const anchor = rows[0] || null
    return {
      t: performance.now(),
      scopeFound: Boolean(scope),
      frameFound: Boolean(frame),
      frameSelector: tab ? `#${tab}-panel .ipc-table-viewport` : '.ipc-content-shell .ipc-table-viewport',
      anchorSelector: tab ? `#${tab}-panel tbody tr:first-child` : '.ipc-content-shell tbody tr:first-child',
      anchorFound: Boolean(anchor),
      anchorTop: anchor?.getBoundingClientRect().top ?? null,
      anchorHeight: anchor?.getBoundingClientRect().height ?? null,
      clientHeight: frame?.clientHeight ?? null,
      scrollHeight: frame?.scrollHeight ?? null,
      overflowY: frame ? getComputedStyle(frame).overflowY : null,
      rowsData: rows.length - skeletons.length,
      rowsSkeleton: skeletons.length,
      rowHeights: rows.slice(0, 20).map((row) => Math.round(row.getBoundingClientRect().height * 100) / 100),
      innerHeight: window.innerHeight,
    }
  }, target.tab)
}

async function sampleT0(page, target) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return snapshot(page, target)
}

async function sampleSettled(page, target) {
  const started = Date.now(); let signature; let stableSince = 0; let last
  while (Date.now() - started < CONFIG.settle.maxWaitMs) {
    last = await snapshot(page, target)
    const next = [last.rowsData, last.rowsSkeleton, last.scrollHeight, last.clientHeight, last.anchorTop, last.anchorHeight].join('|')
    if (next === signature) {
      if (!stableSince) stableSince = Date.now()
      if (Date.now() - stableSince >= CONFIG.settle.quietMs) return { snapshot: last, timedOut: false }
    } else { signature = next; stableSince = 0 }
    await page.waitForTimeout(CONFIG.settle.pollMs)
  }
  return { snapshot: last, timedOut: true }
}

async function measureLoad(browser, target) {
  const { context, page } = await newColdPage(browser, CONFIG.primaryViewport)
  const row = { id: target.id, route: target.route, tab: target.tab, url: targetUrl(target), notes: [] }
  try {
    await openTarget(page, target)
    const start = await sampleT0(page, target)
    const settledResult = await sampleSettled(page, target)
    const end = settledResult.snapshot
    if (settledResult.timedOut) row.notes.push(`hết hạn t_settled sau ${CONFIG.settle.maxWaitMs}ms`)
    Object.assign(row, { t0: start, settled: end, rowsDataSettled: end.rowsData, rowsSkeletonAtT0: start.rowsSkeleton })
    const extra = await page.evaluate(() => ({
      clsSum: window.__probe.shifts.reduce((sum, shift) => sum + shift.value, 0),
      clsWindow: window.__probe.clsWindow(),
      clsSources: window.__probe.shifts.slice().sort((a, b) => b.value - a.value).slice(0, 3),
      lcp: window.__probe.lcp,
      frameTimes: [...window.__probe.frameTimes],
      loafs: [...window.__probe.loafs],
      loafSupported: window.__probe.loafSupported,
      loafObserverError: window.__probe.loafObserverError ?? null,
    }))
    row.clsSum = round(extra.clsSum, 4); row.clsWindow = round(extra.clsWindow, 4); row.clsSources = extra.clsSources; row.lcp = extra.lcp
    row.frameMetrics = summarizeFrameMetrics(extra.frameTimes, extra.loafs, extra.loafSupported)
    if (extra.loafObserverError) row.notes.push(`LoAF observer unavailable: ${extra.loafObserverError}`)
    if (!start.anchorFound || !end.anchorFound) {
      row.deltaTop = null; row.cgr = null
      row.notes.push(`mốc neo vắng tại ${!start.anchorFound ? 't_0' : 't_settled'}`)
    } else {
      row.deltaTop = round(end.anchorTop - start.anchorTop)
      row.cgrDenominator = end.innerHeight
      row.cgr = round(Math.abs(row.deltaTop) / row.cgrDenominator, 4)
    }
    if (start.clientHeight && end.scrollHeight != null) {
      row.growthDenominator = start.clientHeight
      row.growthRatio = round((end.scrollHeight - start.clientHeight) / start.clientHeight, 4)
      row.growthFrameSelector = start.frameSelector
    } else { row.growthDenominator = null; row.growthRatio = null; row.notes.push('khung cuộn vắng tại t_0') }
    if (!end.rowsData) row.notes.push('không có dữ liệu: 0 hàng tại t_settled')
    row.gradable = end.rowsData > 0 && row.deltaTop != null
    row.verdicts = row.gradable ? {
      cgr: verdict(row.cgr, T.CGR_MAX), cls: verdict(row.clsWindow, T.CLS_MAX), growth: verdict(row.growthRatio, T.SCROLL_GROWTH_MAX_RATIO),
    } : { cgr: 'N/A', cls: 'N/A', growth: 'N/A' }
  } catch (error) {
    row.error = error instanceof Error ? error.message : String(error)
    row.gradable = false; row.verdicts = { cgr: 'N/A', cls: 'N/A', growth: 'N/A' }
  } finally { await context.close() }
  return row
}

async function runInteraction(browser, target, interaction) {
  const { context, page } = await newColdPage(browser, CONFIG.primaryViewport)
  try {
    await openTarget(page, target); await sampleT0(page, target); await sampleSettled(page, target)
    let locator
    if (interaction.selector) {
      // Tab switching and global navigation belong to the route shell; all
      // other interactions must resolve inside the active target panel so a
      // warehouse search or row action cannot accidentally measure a sibling
      // table that happens to render earlier in the DOM.
      const interactionRoot = interaction.id === 'tab-switch' || interaction.id === 'sidebar-toggle'
        ? page
        : target.tab
          ? page.locator(`#${target.tab}-panel`)
          : page.locator('.ipc-content-shell')
      locator = interactionRoot.locator(interaction.selector)
      if (!await locator.count()) return { na: `selector không khớp: ${interaction.selector}`, observerSupport: await page.evaluate(() => ({ event: window.__probe.eventSupported, eventError: window.__probe.eventObserverError ?? null, loaf: window.__probe.loafSupported, loafError: window.__probe.loafObserverError ?? null })) }
      if (!await locator.first().isVisible()) return { na: `phần tử không hiển thị: ${interaction.selector}`, observerSupport: await page.evaluate(() => ({ event: window.__probe.eventSupported, eventError: window.__probe.eventObserverError ?? null, loaf: window.__probe.loafSupported, loafError: window.__probe.loafObserverError ?? null })) }
    }
    const windowStart = await page.evaluate(() => window.__probe.resetInteractionMetrics())
    if (locator) {
      if (interaction.action === 'type') { await locator.first().click(); await locator.first().type('a') } else await locator.first().click()
    }
    await page.waitForFunction(() => window.__probe.events.length > 0, undefined, { timeout: 1500 }).catch(() => {})
    const measured = await page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return {
        endTime: performance.now(),
        events: window.__probe.events.slice(),
        frameTimes: [...window.__probe.frameTimes],
        loafs: [...window.__probe.loafs],
        eventSupported: window.__probe.eventSupported,
        eventObserverError: window.__probe.eventObserverError ?? null,
        loafSupported: window.__probe.loafSupported,
        loafObserverError: window.__probe.loafObserverError ?? null,
      }
    })
    const observerSupport = { event: measured.eventSupported, eventError: measured.eventObserverError, loaf: measured.loafSupported, loafError: measured.loafObserverError }
    if (!measured.eventSupported) return { na: 'PerformanceEventTiming observer không được hỗ trợ', windowStart, windowEnd: measured.endTime, observerSupport }
    if (!measured.events.length) return { na: 'không có entry tương tác', frameMetrics: summarizeFrameMetrics(measured.frameTimes, measured.loafs, measured.loafSupported, { startTime: windowStart, endTime: measured.endTime }), windowStart, windowEnd: measured.endTime, observerSupport }
    const events = measured.events.filter((entry) => entry.startTime >= windowStart && entry.startTime <= measured.endTime)
    if (!events.length) return { na: 'entry tương tác nằm ngoài cửa sổ đo', windowStart, windowEnd: measured.endTime, observerSupport }
    const inputStart = Math.min(...events.map(({ startTime }) => startTime))
    const frameMetrics = summarizeFrameMetrics(measured.frameTimes, measured.loafs, measured.loafSupported, { startTime: inputStart, endTime: measured.endTime })
    const worst = events.reduce((current, entry) => entry.duration > current.duration ? entry : current)
    return {
      duration: round(worst.duration),
      inputDelay: round(worst.processingStart - worst.startTime),
      processing: round(worst.processingEnd - worst.processingStart),
      presentation: round(worst.startTime + worst.duration - worst.processingEnd),
      target: worst.target,
      frameMetrics,
      inputStart,
      windowEnd: measured.endTime,
      observerSupport,
    }
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({ url: location.href, hasToken: Boolean(sessionStorage.getItem('token')), hasUser: Boolean(sessionStorage.getItem('user')), body: document.body.innerText.slice(0, 160) })).catch(() => null)
    return { na: `lỗi thực thi: ${error instanceof Error ? error.message : String(error)}`, diagnostic, observerSupport: { event: null, eventError: String(error), loaf: null, loafError: null } }
  } finally {
    await context.close()
  }
}

async function measureInteraction(browser, target, interaction) {
  const attempts = []; const samples = []; const reasons = []
  for (let index = 0; index < T.REPEATS; index += 1) {
    const result = await runInteraction(browser, target, interaction)
    attempts.push({ repeat: index + 1, ...result })
    if (result.na) reasons.push(result.na); else samples.push(result)
  }
  const base = {
    route: target.route,
    tab: target.tab,
    interaction: interaction.id,
    viewport: CONFIG.primaryViewport,
    configuredRepeats: T.REPEATS,
    attemptedRepeats: attempts.length,
    succeededRepeats: samples.length,
    attempts,
  }
  if (!samples.length) return { ...base, value: null, verdict: 'N/A', sampleStatus: 'NEEDS_EVIDENCE', naReason: reasons[0] || 'không thu được mẫu' }
  const value = median(samples.map((sample) => sample.duration))
  const components = {
    inputDelay: median(samples.map((sample) => sample.inputDelay)),
    processing: median(samples.map((sample) => sample.processing)),
    presentation: median(samples.map((sample) => sample.presentation)),
  }
  const presentationShare = value ? components.presentation / value : 0
  const processingShare = value ? components.processing / value : 0
  const supportedLoafSamples = samples.filter(({ frameMetrics }) => frameMetrics.loaf.supported)
  const frameSummary = {
    medianFrameMs: median(samples.map(({ frameMetrics }) => frameMetrics.medianFrameMs)),
    p95FrameMs: median(samples.map(({ frameMetrics }) => frameMetrics.p95FrameMs)),
    longestFrameMs: Math.max(...samples.map(({ frameMetrics }) => frameMetrics.longestFrameMs ?? 0)),
    framesOver8_33Ms: samples.reduce((sum, { frameMetrics }) => sum + frameMetrics.framesOver8_33Ms, 0),
    framesOver16_67Ms: samples.reduce((sum, { frameMetrics }) => sum + frameMetrics.framesOver16_67Ms, 0),
    framesOver33_3Ms: samples.reduce((sum, { frameMetrics }) => sum + frameMetrics.framesOver33_3Ms, 0),
    loaf: supportedLoafSamples.length === samples.length
      ? { supported: true, count: samples.reduce((sum, { frameMetrics }) => sum + frameMetrics.loaf.count, 0), longestDurationMs: Math.max(...samples.map(({ frameMetrics }) => frameMetrics.loaf.longestDurationMs ?? 0)) }
      : { supported: false, count: null, longestDurationMs: null },
  }
  const dominatedBy = presentationShare >= T.PRESENTATION_DOMINANT_SHARE ? 'trình bày' : processingShare >= T.PRESENTATION_DOMINANT_SHARE ? 'xử lý' : 'không rõ'
  const complete = samples.length === T.REPEATS
  return {
    ...base,
    samples: samples.length, value, min: Math.min(...samples.map((sample) => sample.duration)), max: Math.max(...samples.map((sample) => sample.duration)),
    components, frameSummary, presentationShare: round(presentationShare, 4), dominatedBy,
    isProcessingDebt: dominatedBy === 'xử lý' && value > T.INP_MAX_LAB_4X,
    verdict: complete ? verdict(value, T.INP_MAX_LAB_4X) : 'NEEDS_EVIDENCE', sampleStatus: complete ? 'COMPLETE' : 'PARTIAL', target: samples[0].target, partialReason: reasons[0],
  }
}

async function scanOverflow(browser, target, viewport, stripSelector) {
  const { context, page } = await newColdPage(browser, viewport)
  try {
    await openTarget(page, target); await sampleT0(page, target); await sampleSettled(page, target)
    return await page.evaluate(({ strip, tolerance, id, viewportLabel }) => {
      const root = strip ? document.querySelector(strip) : document.body
      if (!root) return { id, viewport: viewportLabel, scope: strip, scopeFound: false, verdict: 'N/A', findings: [] }
      const findings = []
      const describe = (element) => {
        const testId = element.getAttribute('data-testid')
        const stableId = element.id && !/^(_r_|base-ui-)/.test(element.id) ? `#${element.id}` : ''
        const classes = [...element.classList].filter((name) => !name.startsWith('base-ui-')).slice(0, 3)
        const suffix = classes.length ? `.${classes.join('.')}` : ''
        return testId ? `[data-testid="${testId}"]` : stableId || `${element.tagName.toLowerCase()}${suffix}`
      }
      for (const element of [root, ...root.querySelectorAll('*')]) {
        if (!element.getClientRects().length) continue
        if (element.classList.contains('sr-only')) continue
        const style = getComputedStyle(element)
        const isVisuallyHiddenControl = /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName) && (
          element.getAttribute('type') === 'hidden' ||
          style.opacity === '0' ||
          style.clip !== 'auto' ||
          style.clipPath !== 'none'
        )
        if (isVisuallyHiddenControl || element.getAttribute('aria-hidden') === 'true') continue
        const dx = element.scrollWidth - element.clientWidth; const dy = element.scrollHeight - element.clientHeight
        if (dx <= tolerance && dy <= tolerance) continue
        const scrollable = /(auto|scroll)/.test(style.overflowX) || /(auto|scroll)/.test(style.overflowY)
        const kind = scrollable ? 'có thanh cuộn' : style.textOverflow === 'ellipsis' ? 'thu gọn' : 'cắt mất chữ'
        findings.push({
          kind,
          element: describe(element),
          text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          dx,
          dy,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
        })
      }
      const pageOverflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth
      return { id, viewport: viewportLabel, scope: strip || 'toàn trang', scopeFound: true, pageOverflowX, findings: findings.slice(0, 40), verdict: findings.some((item) => item.kind === 'cắt mất chữ') || pageOverflowX > tolerance ? 'TRUOT' : 'DAT' }
    }, { strip: stripSelector, tolerance: T.OVERFLOW_TOLERANCE_PX, id: target.id, viewportLabel: `${viewport.w}x${viewport.h}` })
  } catch (error) { return { id: target.id, viewport: `${viewport.w}x${viewport.h}`, error: error instanceof Error ? error.message : String(error), verdict: 'N/A', findings: [] } } finally { await context.close() }
}

function assertIntegrity(report) {
  const violations = []
  if (!report.sourceIdentity?.headCommit || !report.servedIdentity?.entrySha256) violations.push('report thiếu local/served source identity')
  if (report.runtimeMode !== report.servedIdentity?.observedMode) violations.push('runtime mode không khớp served mode')
  if (!report.primaryViewport?.w || !report.primaryViewport?.h) violations.push('report thiếu primary viewport')
  if (!Number.isInteger(report.configuredRepeats) || report.configuredRepeats < 3) violations.push('report có repeat contract không hợp lệ')
  for (const row of report.load) {
    if (row.rowsDataSettled === 0 && row.verdicts?.cgr !== 'N/A') violations.push(`${row.id}: 0 hàng vẫn có phán quyết`)
    if (row.t0?.anchorFound === false && row.deltaTop != null) violations.push(`${row.id}: mốc neo vắng vẫn có hiệu số`)
    if (row.growthRatio != null && !row.growthDenominator) violations.push(`${row.id}: tỷ lệ tràn thiếu mẫu số`)
    if (row.growthRatio != null && !row.growthFrameSelector) violations.push(`${row.id}: tỷ lệ tràn thiếu selector khung cuộn`)
    if (row.cgr != null && !row.cgrDenominator) violations.push(`${row.id}: CGR thiếu mẫu số`)
    if (!row.frameMetrics) violations.push(`${row.id}: thiếu frame metrics`)
    if (row.frameMetrics?.loaf.supported === false && row.frameMetrics.loaf.count !== null) violations.push(`${row.id}: LoAF unsupported phải giữ count null`)
  }
  for (const cell of report.inp) {
    if (cell.attemptedRepeats !== report.configuredRepeats || cell.attempts?.length !== report.configuredRepeats) violations.push(`${cell.route}/${cell.interaction}: thiếu repeat attempts`)
    if (!cell.viewport?.w || !cell.viewport?.h) violations.push(`${cell.route}/${cell.interaction}: thiếu viewport`)
    if (cell.succeededRepeats < report.configuredRepeats && cell.verdict !== 'N/A' && cell.verdict !== 'NEEDS_EVIDENCE') violations.push(`${cell.route}/${cell.interaction}: partial sample có verdict bình thường`)
    if (cell.attempts?.some((attempt) => !attempt.observerSupport || !('event' in attempt.observerSupport) || !('loaf' in attempt.observerSupport))) violations.push(`${cell.route}/${cell.interaction}: attempt thiếu observer support`)
    if (cell.attempts?.some((attempt) => attempt.observerSupport.event === false && !attempt.observerSupport.eventError)) violations.push(`${cell.route}/${cell.interaction}: Event Timing unsupported thiếu reason`)
    if (cell.value == null && !cell.naReason) violations.push(`${cell.route}/${cell.interaction}: N/A thiếu lý do`)
    if (cell.value != null && !cell.components) violations.push(`${cell.route}/${cell.interaction}: INP thiếu ba thành phần`)
    if (cell.value != null && !cell.frameSummary) violations.push(`${cell.route}/${cell.interaction}: interaction thiếu frame summary`)
  }
  for (const row of report.overflow) if (row.verdict === 'N/A' && row.scopeFound !== false && !row.error) violations.push(`${row.id}@${row.viewport}: N/A thiếu lý do`)
  return violations
}

function parseArgs(argv) {
  const flags = { load: false, inp: false, overflow: false, check: false, only: null, strip: null }
  for (const argument of argv) {
    if (argument === '--all') flags.load = flags.inp = flags.overflow = true
    else if (argument === '--load') flags.load = true
    else if (argument === '--inp') flags.inp = true
    else if (argument === '--overflow') flags.overflow = true
    else if (argument === '--check') flags.check = true
    else if (argument.startsWith('--only=')) flags.only = argument.slice(7).split(',').map((value) => value.trim()).filter(Boolean)
    else if (argument.startsWith('--strip=')) flags.strip = argument.slice(8).replace(/^['"]|['"]$/g, '')
  }
  if (!flags.load && !flags.inp && !flags.overflow && !flags.check) flags.load = true
  return flags
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

async function captureSourceIdentity() {
  const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const headCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim()
  const status = execFileSync('git', ['status', '--porcelain=v1', '--', 'frontend', 'package.json', 'package-lock.json', 'tools/live-visual-audit-contract.mjs'], { cwd: repositoryRoot, encoding: 'utf8' })
  const trackedDiff = execFileSync('git', ['diff', '--binary', 'HEAD', '--', 'frontend', 'package.json', 'package-lock.json', 'tools/live-visual-audit-contract.mjs'], { cwd: repositoryRoot, encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 })
  const untrackedPaths = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z', '--', 'frontend', 'package.json', 'package-lock.json', 'tools/live-visual-audit-contract.mjs'], { cwd: repositoryRoot, encoding: 'utf8' }).split('\0').filter(Boolean).sort()
  return buildSourceIdentity({
    status,
    headCommit,
    trackedDiff,
    untrackedFiles: await Promise.all(untrackedPaths.map(async (filePath) => ({ path: filePath, content: await readFile(join(repositoryRoot, filePath)) }))),
    publishedCommit: process.env.PROBE_PUBLISHED_COMMIT?.trim() || undefined,
  })
}

async function captureServedIdentity() {
  const indexResponse = await fetch(CONFIG.baseUrl)
  if (!indexResponse.ok) throw new Error(`Không đọc được served index: HTTP ${indexResponse.status}`)
  const index = await indexResponse.text()
  const viteClientResponse = await fetch(new URL('/@vite/client', CONFIG.baseUrl))
  const viteClient = viteClientResponse.ok ? await viteClientResponse.text() : ''
  const observedMode = detectServedMode(viteClientResponse.headers.get('content-type'), viteClient)
  if (observedMode !== CONFIG.runtimeMode) throw new Error(`Runtime mode mismatch: declared ${CONFIG.runtimeMode}, observed ${observedMode}`)
  const entryPath = observedMode === 'dev'
    ? '/src/main.tsx'
    : index.match(/<script[^>]+src="([^"]+)"/)?.[1]
  if (!entryPath) throw new Error('Không xác định được served entry module.')
  const entryResponse = await fetch(new URL(entryPath, CONFIG.baseUrl))
  if (!entryResponse.ok) throw new Error(`Không đọc được served entry ${entryPath}: HTTP ${entryResponse.status}`)
  const entry = Buffer.from(await entryResponse.arrayBuffer())
  return {
    declaredMode: CONFIG.runtimeMode,
    observedMode,
    indexSha256: sha256(index),
    entryPath,
    entrySha256: sha256(entry),
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))
  const targets = flags.only ? TARGETS.filter((target) => flags.only.includes(target.id) || flags.only.includes(target.route)) : TARGETS
  if (!targets.length) { console.error(`Không có đích khớp --only. Đích hợp lệ: ${TARGETS.map((target) => target.id).join(', ')}`); process.exit(2) }
  if (flags.check) { console.log(JSON.stringify({ routes: ROUTES.length, targets: TARGETS.length, interactions: INTERACTIONS.length, thresholds: T, runtimeModes: ['dev', 'preview'] }, null, 2)); return }
  if (!['dev', 'preview'].includes(CONFIG.runtimeMode)) throw new Error('PROBE_RUNTIME_MODE phải là dev hoặc preview để tránh trộn môi trường.')
  const report = {
    startedAt: new Date().toISOString(), baseUrl: CONFIG.baseUrl, profile: CONFIG.profileQuery,
    sourceIdentity: await captureSourceIdentity(),
    servedIdentity: await captureServedIdentity(),
    runtimeMode: CONFIG.runtimeMode,
    primaryViewport: CONFIG.primaryViewport,
    configuredRepeats: T.REPEATS,
    probeFlags: { load: flags.load, inp: flags.inp, overflow: flags.overflow, only: flags.only, strip: flags.strip, interactions: ACTIVE_INTERACTIONS.map(({ id }) => id) },
    navigation: 'context nguội theo route; tab được kích hoạt và xác minh aria-selected trước t_0',
    throttle: CONFIG.throttle, thresholds: T, load: [], inp: [], overflow: [],
  }
  // Reuse the headed Chrome installation already required by the repo's Playwright config.
  // This avoids a hidden dependency on a separately downloaded Playwright Chromium shell.
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] })
  report.browserVersion = browser.version()
  try {
    await bootstrapAuth(browser)
    if (flags.load) for (const target of targets) report.load.push(await measureLoad(browser, target))
    if (flags.inp) for (const target of targets) for (const interaction of ACTIVE_INTERACTIONS) report.inp.push(await measureInteraction(browser, target, interaction))
    if (flags.overflow) for (const target of targets) for (const viewport of CONFIG.viewports) report.overflow.push(await scanOverflow(browser, target, viewport, flags.strip))
  } finally { await browser.close() }
  report.integrityViolations = assertIntegrity(report)
  report.finishedAt = new Date().toISOString()
  report.counts = {
    loadRows: report.load.length, loadGradable: report.load.filter((row) => row.gradable).length,
    inpCells: report.inp.length, inpValueBearing: report.inp.filter((cell) => cell.value != null).length,
    overflowRuns: report.overflow.length, overflowFailing: report.overflow.filter((row) => row.verdict === 'TRUOT').length,
  }
  const markdown = `# Báo cáo đầu đo — ${report.startedAt}\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`
  await mkdir(dirname(CONFIG.reportPath), { recursive: true })
  await writeFile(CONFIG.reportPath, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(CONFIG.reportPath.replace(/\.json$/, '.md'), markdown, 'utf8')
  console.log(markdown)
  process.exit(report.integrityViolations.length ? 1 : 0)
}

main().catch((error) => { console.error(error); process.exit(3) })
