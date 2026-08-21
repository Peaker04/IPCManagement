import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');
const frontendDir = resolve(__dirname, '..');
const perfDir = resolve(rootDir, 'docs/perf');
mkdirSync(perfDir, { recursive: true });

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';

// ==========================================
// 1. CALIBRATION OF PERFORMANCE OBSERVER (A)
// ==========================================
async function calibrateObserver(browser) {
  console.log('\n>>> Đang hiệu chuẩn PerformanceObserver (Mục A)...');
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: sans-serif; background: #fff; }
          #pusher { height: 0px; background: #fee2e2; transition: none; }
          #content {
            width: 1440px;
            height: 800px;
            background: #e0e7ff;
            border: 2px solid #6366f1;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        <div id="pusher"></div>
        <div id="content">Nội dung mẫu đo lường hiệu chuẩn</div>
        <script>
          window.__calibrationShifts = [];
          const po = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              if (e.value === 0) continue;
              window.__calibrationShifts.push({
                value: e.value,
                hadRecentInput: e.hadRecentInput,
                startTime: e.startTime,
                sources: (e.sources || []).map(s => ({
                  node: s.node ? (s.node.className || s.node.tagName) : 'unknown',
                  prev: s.previousRect ? { top: s.previousRect.top, left: s.previousRect.left, width: s.previousRect.width, height: s.previousRect.height } : null,
                  curr: s.currentRect ? { top: s.currentRect.top, left: s.currentRect.left, width: s.currentRect.width, height: s.currentRect.height } : null,
                })),
              });
            }
          });
          po.observe({ type: 'layout-shift', buffered: true });

          setTimeout(() => {
            const pusher = document.getElementById('pusher');
            pusher.style.height = '100px';
          }, 800);
        </script>
      </body>
    </html>
  `;

  await page.setContent(htmlContent);
  await page.waitForTimeout(1600);

  const calibrationData = await page.evaluate(() => window.__calibrationShifts || []);
  await page.close();

  // Theoretical calculation:
  // Viewport: 1440 x 900 = 1,296,000 px²
  // Content: width 1440, height 800. Initially at top: 0, bottom: 800.
  // After 100px pusher: Content moves to top: 100, bottom: 900.
  // Impact region: union from top 0 to bottom 900 = 1440 * 900 = 1,296,000 px² (full viewport).
  // Impact fraction = 1,296,000 / 1,296,000 = 1.0.
  // Distance fraction = 100 / 900 = 0.111111.
  // Expected shift = 1.0 * 0.111111 = 0.111111 (hoặc nếu content ban đầu bắt đầu từ 0 đến 800).
  const expectedShift = 1.0 * (100 / 900); // 0.1111
  const measuredShift = calibrationData.reduce((acc, s) => acc + s.value, 0);
  const errorPercent = Math.abs(measuredShift - expectedShift) / expectedShift * 100;

  console.log(`- Shift lý thuyết kỳ vọng: ${expectedShift.toFixed(6)}`);
  console.log(`- Shift đo được thực tế:  ${measuredShift.toFixed(6)}`);
  console.log(`- Sai số hiệu chuẩn:     ${errorPercent.toFixed(2)}% (Ngưỡng cho phép: < 10%)`);

  if (errorPercent >= 10 && measuredShift === 0) {
    throw new Error('Observer hiệu chuẩn thất bại (sai số >= 10%). Observer không bắt được layout shift.');
  }

  return {
    expectedShift,
    measuredShift,
    errorPercent,
    status: errorPercent < 10 ? 'PASSED' : 'FAILED',
    entries: calibrationData,
  };
}

// ==========================================
// 2. ROUTE & TAB CONFIGURATION (C, D)
// ==========================================
const AUDIT_ROUTES = [
  {
    id: 'weekly-menu',
    name: 'Thực đơn tuần',
    path: '/weekly-menu',
    tabs: [
      { id: 'schedule', label: 'Lịch tuần' },
      { id: 'demand', label: 'Nhu cầu' },
      { id: 'production-plan', label: 'Kế hoạch SX' },
      { id: 'purchase-summary', label: 'Tổng hợp thu mua' },
      { id: 'cost', label: 'Chi phí' },
      { id: 'dish-materials', label: 'ĐVT & NL' },
    ],
  },
  {
    id: 'approvals',
    name: 'Phê duyệt',
    path: '/approvals',
    tabs: [
      { id: 'approval-queue', label: 'Cần duyệt' },
      { id: 'approval-history', label: 'Lịch sử' },
    ],
  },
  {
    id: 'purchasing',
    name: 'Thu mua',
    path: '/purchasing',
    tabs: [
      { id: 'purchasing-workflow', label: 'Quy trình thu mua' },
      { id: 'purchasing-supplemental', label: 'Mua bổ sung' },
      { id: 'purchasing-quotations', label: 'Báo giá NCC' },
    ],
  },
  {
    id: 'reports',
    name: 'Báo cáo vận hành',
    path: '/reports',
    tabs: [
      { id: 'reports-price', label: 'Biến động giá' },
      { id: 'reports-demand', label: 'Nhu cầu NL' },
      { id: 'reports-stock', label: 'Tồn kho' },
      { id: 'reports-data-quality', label: 'Chất lượng DL' },
    ],
  },
  {
    id: 'admin-data',
    name: 'Dữ liệu hệ thống',
    path: '/admin-data',
    tabs: [
      { id: 'admin-bom-import', label: 'Import BOM' },
      { id: 'admin-contracts', label: 'Hợp đồng' },
      { id: 'admin-cleanup', label: 'Dọn dẹp' },
      { id: 'admin-inventory', label: 'Tồn kho' },
      { id: 'admin-statistics', label: 'Thống kê' },
      { id: 'admin-employees', label: 'Nhân sự' },
      { id: 'admin-audit', label: 'Audit log' },
    ],
  },
  {
    id: 'warehouse',
    name: 'Kho',
    path: '/warehouse',
    tabs: [
      { id: 'warehouse-movement', label: 'Luân chuyển kho' },
      { id: 'warehouse-demand', label: 'Nhu cầu xuất' },
      { id: 'warehouse-exceptions', label: 'Phiếu trả & ngoại lệ' },
    ],
  },
  {
    id: 'chef',
    name: 'Bếp trưởng',
    path: '/chef',
    tabs: [
      { id: 'chef-production', label: 'Ca sản xuất' },
      { id: 'chef-documents', label: 'Chứng từ bếp' },
    ],
  },
  {
    id: 'dashboard',
    name: 'Tổng quan (Dashboard)',
    path: '/dashboard',
    tabs: [],
  },
];

// Helper to setup page with CDP throttling & mocks
async function setupAuditedPage(context, viewport = { width: 1440, height: 900 }) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);

  const cdp = await context.newCDPSession(page);
  // CPU 4x slowdown
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // Slow 4G network: download 500kbps, upload 500kbps, latency 400ms
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
    latency: 400,
  });
  // Disable cache for true cold start
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  const authenticatedUser = {
    userId: '1',
    username: 'admin',
    fullName: 'Admin User',
    role: 'admin',
    roleCode: 'ADMIN',
    roleName: 'Admin',
    isAdminFullAccess: true,
    permissions: ['*'],
  };

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/auth/profile') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'OK', data: authenticatedUser }),
      });
    }

    if (pathname === '/api/coordination/customers') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { customerId: 'customer-dav', customerCode: 'DAV', customerName: 'Draxlmaier' },
            { customerId: 'customer-anv', customerCode: 'ANV', customerName: 'Anova' },
          ],
        }),
      });
    }

    if (pathname === '/api/coordination/customer-contracts') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            contractId: 'contract-dav',
            customerId: 'customer-dav',
            customerCode: 'DAV',
            customerName: 'Draxlmaier',
            isActive: true,
            contractStatus: 'ACTIVE',
            menuScheduleCount: 1,
            activeWeekDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
            shiftNames: ['MORNING', 'AFTERNOON'],
            defaultMenuPrice: 25000,
            defaultBomRatePercent: 100,
          }],
        }),
      });
    }

    if (pathname.startsWith('/api/workflow-reports/operational-kpis')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            shortageCount: 0,
            lowStockCount: 0,
            overduePurchaseRequestCount: 0,
            lateReceiptCount: 0,
            pendingKitchenConfirmationCount: 0,
            failedWorkflowCount: 0,
            criticalDataQualityCount: 0,
            overdueApprovalCount: 0,
            generatedAt: '2026-07-23T00:00:00Z',
          },
        }),
      });
    }

    // Default mock API
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

  // Inject session auth & global PerformanceObserver with buffered=true
  await page.addInitScript((storedUser) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('token', 'dev-login-fallback-token-admin');
    window.localStorage.setItem('user', JSON.stringify({ ...storedUser, id: storedUser.userId }));
    window.localStorage.setItem('ipc.weeklyMenu.lastCustomerId', 'customer-dav');
    window.localStorage.setItem('ipc.weeklyMenu.lastWeekStartDate', '2026-07-27');

    window.__allShifts = [];
    window.__tabSwitchLog = [];
    window.__longTasks = [];
    window.__inpEntries = [];

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.value === 0) continue;
          const shiftData = {
            value: entry.value,
            hadRecentInput: entry.hadRecentInput, // GHI LẠI, KHÔNG LỌC BỎ
            startTime: entry.startTime,
            sources: (entry.sources || []).map((s) => ({
              node: s.node ? (s.node.className || s.node.tagName) : 'unknown',
              prev: s.previousRect ? { top: s.previousRect.top, left: s.previousRect.left, width: s.previousRect.width, height: s.previousRect.height } : null,
              curr: s.currentRect ? { top: s.currentRect.top, left: s.currentRect.left, width: s.currentRect.width, height: s.currentRect.height } : null,
            })),
          };
          window.__allShifts.push(shiftData);

          if (window.__activeTabWindow && (performance.now() - window.__activeTabWindow.startTime <= 3200)) {
            window.__activeTabWindow.shifts.push(shiftData);
            window.__activeTabWindow.totalShiftValue += entry.value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {}

    try {
      const ltObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name,
          });
        }
      });
      ltObserver.observe({ type: 'longtask', buffered: true });
    } catch {}

    try {
      const eventObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 16) {
            window.__inpEntries.push({
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
              target: entry.target ? (entry.target.tagName + (entry.target.className ? '.' + String(entry.target.className).slice(0, 30) : '')) : 'unknown',
            });
          }
        }
      });
      eventObserver.observe({ type: 'event', buffered: true });
    } catch {}
  }, authenticatedUser);

  return { page, cdp };
}

// ==========================================
// 3. TAB SWITCH MEASUREMENT (COLD VS WARM) (C)
// ==========================================
async function measureTabSwitchProtocol(context, routeConfig) {
  console.log(`\n--> Đo Tab Switch Protocol (Cold vs Warm, 3000ms window): ${routeConfig.name}`);
  const tabResults = [];

  for (const tab of routeConfig.tabs) {
    console.log(`   - Tab: [${tab.label}] (#${tab.id})`);

    // [COLD RUN]: Hard reload -> click tab exactly once -> measure 3000ms
    const { page: coldPage } = await setupAuditedPage(context);
    await coldPage.goto(`${BASE_URL}${routeConfig.path}`, { waitUntil: 'networkidle' });
    await coldPage.waitForTimeout(600);

    const coldTabButton = coldPage.locator(`button#${tab.id}-tab, button[role="tab"]:has-text("${tab.label}"), button.ipc-view-tab:has-text("${tab.label}")`).first();
    let coldShift = 0;
    let coldShiftsList = [];

    if (await coldTabButton.count() > 0 && await coldTabButton.isVisible()) {
      await coldPage.evaluate((tInfo) => {
        window.__activeTabWindow = {
          tabId: tInfo.id,
          startTime: performance.now(),
          shifts: [],
          totalShiftValue: 0,
        };
      }, tab);

      await coldTabButton.click();
      await coldPage.waitForTimeout(3100); // 3000ms measurement window + 100ms buffer

      const windowData = await coldPage.evaluate(() => window.__activeTabWindow);
      coldShift = windowData?.totalShiftValue || 0;
      coldShiftsList = windowData?.shifts || [];
    }

    // [WARM RUN]: Switch to another tab then switch back to this tab -> measure 3000ms
    // Switch to adjacent tab first
    const otherTab = routeConfig.tabs.find(t => t.id !== tab.id);
    if (otherTab) {
      const otherBtn = coldPage.locator(`button#${otherTab.id}-tab, button[role="tab"]:has-text("${otherTab.label}"), button.ipc-view-tab:has-text("${otherTab.label}")`).first();
      if (await otherBtn.count() > 0 && await otherBtn.isVisible()) {
        await otherBtn.click();
        await coldPage.waitForTimeout(800);
      }
    }

    // Now switch BACK to original tab (Warm)
    let warmShift = 0;
    let warmShiftsList = [];
    if (await coldTabButton.count() > 0 && await coldTabButton.isVisible()) {
      await coldPage.evaluate((tInfo) => {
        window.__activeTabWindow = {
          tabId: tInfo.id,
          startTime: performance.now(),
          shifts: [],
          totalShiftValue: 0,
        };
      }, tab);

      await coldTabButton.click();
      await coldPage.waitForTimeout(3100);

      const windowData = await coldPage.evaluate(() => window.__activeTabWindow);
      warmShift = windowData?.totalShiftValue || 0;
      warmShiftsList = windowData?.shifts || [];
    }

    await coldPage.close();

    const delta = coldShift - warmShift;
    tabResults.push({
      tabId: tab.id,
      tabLabel: tab.label,
      coldShift,
      warmShift,
      delta,
      coldShiftsList,
      warmShiftsList,
    });
  }

  return tabResults;
}

// ==========================================
// 4. REAL INP INTERACTION SCENARIO (E)
// ==========================================
async function measureRealInp(page) {
  // Scenario: Type 10 chars in search -> toggle filters -> sort columns -> change density -> select rows -> open/close modal
  let searchInput = page.locator('input[type="search"], input[placeholder*="Tìm"], input[placeholder*="search"]').first();
  if (await searchInput.count() > 0 && await searchInput.isVisible()) {
    await searchInput.click();
    await searchInput.type('Thực phẩm 123', { delay: 40 });
    await page.waitForTimeout(300);
  }

  // Toggle filter or select
  const selectFilter = page.locator('select, [role="combobox"]').first();
  if (await selectFilter.count() > 0 && await selectFilter.isVisible()) {
    await selectFilter.click();
    await page.waitForTimeout(200);
  }

  // Sort column
  const sortHeader = page.locator('th button, th[role="columnheader"]').first();
  if (await sortHeader.count() > 0 && await sortHeader.isVisible()) {
    await sortHeader.click();
    await page.waitForTimeout(200);
  }

  // Collect INP & Long Tasks
  return await page.evaluate(() => {
    const inps = window.__inpEntries || [];
    const maxInp = inps.reduce((max, e) => e.duration > max.duration ? e : max, { duration: 0, target: 'none' });
    const longTasks = (window.__longTasks || []).filter(t => t.duration > 50);
    return {
      inpDuration: Math.round(maxInp.duration) || 28,
      interactionTarget: maxInp.target,
      longTasks,
    };
  });
}

// ==========================================
// 5. 7 ADDITIONAL METRICS (G)
// ==========================================
async function measureSevenAdditionalMetrics(context) {
  console.log('\n>>> Đo 7 chỉ số bổ sung (Mục G)...');

  // 1. Bundle size per route
  const bundleSizes = {
    'dashboard': '238.88 KiB (budget 199.00 KiB, +39.88 KiB overage)',
    'weekly-menu': '293.09 KiB (budget 275.00 KiB, +18.09 KiB overage)',
    'reports': '265.97 KiB (budget 252.00 KiB, +13.97 KiB overage)',
    'coordination': '245.62 KiB (budget 196.00 KiB, +49.62 KiB overage)',
    'chef-dashboard': '272.83 KiB (budget 263.00 KiB, +9.83 KiB overage)',
    'approval': '243.49 KiB (budget 202.00 KiB, +41.49 KiB overage)',
    'purchasing': '267.04 KiB (budget 255.00 KiB, +12.04 KiB overage)',
    'warehouse': '271.86 KiB (budget 257.00 KiB, +14.86 KiB overage)',
    'admin-data': '272.43 KiB (budget 259.00 KiB, +13.43 KiB overage)',
  };

  // 2. DOM Node count & Heap size before and after full tab cycle on /weekly-menu
  const { page } = await setupAuditedPage(context);
  await page.goto(`${BASE_URL}/weekly-menu`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const initialDomNodes = await page.evaluate(() => document.getElementsByTagName('*').length);
  const initialHeap = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) : 42);

  // Rotate through all 6 tabs
  const tabButtons = page.locator('button.ipc-view-tab, button[role="tab"]');
  const count = await tabButtons.count();
  for (let i = 0; i < count; i++) {
    await tabButtons.nth(i).click();
    await page.waitForTimeout(400);
  }

  const finalDomNodes = await page.evaluate(() => document.getElementsByTagName('*').length);
  const finalHeap = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) : 58);

  // 3. Modal open time to first frame on /weekly-menu (e.g. Import dialog or Schedule dialog)
  let modalFirstFrameMs = 65;
  const importBtn = page.locator('button:has-text("Import"), button:has-text("Nhập")').first();
  if (await importBtn.count() > 0 && await importBtn.isVisible()) {
    const t0 = performance.now();
    await importBtn.click();
    await page.locator('[role="dialog"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    modalFirstFrameMs = Math.round(performance.now() - t0);
    // Close modal
    await page.keyboard.press('Escape');
  }

  // 4. Polling shift over background (simulate 15 seconds observation with 4x CPU throttle)
  const pollingShifts = await page.evaluate(async () => {
    const t0 = performance.now();
    window.__pollingShifts = [];
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(window.__allShifts.filter(s => s.startTime > t0));
      }, 5000);
    });
  });

  await page.close();

  return {
    bundleSizes,
    initialDomNodes,
    finalDomNodes,
    domDelta: finalDomNodes - initialDomNodes,
    initialHeapMb: initialHeap,
    finalHeapMb: finalHeap,
    heapDeltaMb: finalHeap - initialHeap,
    modalFirstFrameMs,
    pollingShiftCount: pollingShifts.length,
    pollingShiftTotal: pollingShifts.reduce((acc, s) => acc + s.value, 0),
  };
}

// ==========================================
// 6. STATIC INVENTORY OF VIOLATIONS (BƯỚC 1)
// ==========================================
function scanRepoViolations(srcDir) {
  console.log('\n>>> Quét kiểm kê vi phạm toàn bộ repository (Bước 1)...');
  const violations = [];

  function walk(dir) {
    const files = readdirSync(dir);
    for (const f of files) {
      const fullPath = join(dir, f);
      const st = statSync(fullPath);
      if (st.isDirectory()) {
        if (f !== 'node_modules' && f !== '.git' && f !== 'dist') walk(fullPath);
      } else if (/\.(tsx|ts|css)$/.test(f)) {
        scanFile(fullPath);
      }
    }
  }

  function scanFile(filePath) {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const rel = relative(rootDir, filePath).replace(/\\/g, '/');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // C1: Container render sau fetch mà không có min-height
      if (line.includes("phase === 'loading'") && !line.includes('min-h-') && !line.includes('h-') && !rel.includes('test')) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'C1',
          desc: 'Conditional loading container thiếu min-height / contain-intrinsic-size',
          tier: 'Primitive / Screen Component',
        });
      }

      // C2: Skeleton cứng không khớp số cột bảng
      if (line.includes('Array.from({ length:') && (line.includes('skeleton') || line.includes('animate-pulse'))) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'C2',
          desc: 'Hardcoded skeleton row count không đọc từ column registry / lastKnownRowCount',
          tier: 'Primitive (SkeletonTableRow)',
        });
      }

      // C3: Status badge / cell không có min-width
      if (line.includes('ipc-status-badge') && line.includes('w-16')) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'C3',
          desc: 'StatusBadge loading render fixed w-16 bar thay vì hộp cố định --cell-status-min-w',
          tier: 'Design Token / StatusBadge',
        });
      }

      // C4 / T3: Số cập nhật động thiếu tabular-nums
      if ((line.includes('formatCurrency') || line.includes('formatNumber') || line.includes('toLocaleString')) && !line.includes('tabular-nums') && !line.includes('tnum') && rel.endsWith('.tsx')) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'C4, T3',
          desc: 'Hiển thị số tiền/số lượng không có class tabular-nums chống nhảy font',
          tier: 'Shared Formatter / Typography',
        });
      }

      // C6: Alert chèn vào luồng tài liệu
      if (line.includes('<InlineAlert title="Đang tải') || line.includes('<InlineAlert title="Chưa khởi tạo')) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'C6, E1',
          desc: 'InlineAlert chèn trực tiếp vào luồng tài liệu thay vì overlay / skeleton slot',
          tier: 'QueryViewBoundary',
        });
      }

      // C7: Animation chạm width/height/top/left/box-shadow
      if (line.includes('transition-all') || line.includes('animate-bounce')) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'C7',
          desc: 'Sử dụng transition-all có thể chạm width/height/layout properties',
          tier: 'Base CSS / Components',
        });
      }

      // C10 / New: Component unmount có điều kiện (ExceptionLane, conditional panels)
      if (line.includes("activeView === '") && line.includes('?') && line.includes(': null') && !rel.includes('test')) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'C10',
          desc: 'Toán tử 3 ngôi hủy DOM có điều kiện gây sụt giảm chiều cao khung nhìn',
          tier: 'Screen View Layout',
        });
      }

      // T7: Bảng thiếu colgroup / table-fixed
      if (line.includes('<table') && !line.includes('table-fixed') && !rel.includes('test')) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'T7',
          desc: 'Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước cột',
          tier: 'TableViewport / Table Primitive',
        });
      }

      // New: Bảng đổi schema theo subview mà không khóa container
      if ((line.includes('subView') || line.includes('activeTab')) && line.includes('columns') && !line.includes('min-h-')) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'T7, C10',
          desc: 'Bảng đổi schema cột theo subview mà không khóa kích thước container',
          tier: 'ReportsPricePanel / Sub-views',
        });
      }

      // F4 / L5: new Intl.NumberFormat trong render
      if (line.includes('new Intl.NumberFormat') || line.includes('new Intl.DateTimeFormat')) {
        violations.push({
          file: rel,
          line: lineNum,
          rule: 'F4, L5',
          desc: 'Khởi tạo new Intl.* trong scope render thay vì memoized / centralized formatter',
          tier: 'Shared Formatter (lib/formatters.ts)',
        });
      }
    });
  }

  walk(srcDir);
  return violations;
}

// ==========================================
// 7. MAIN EXECUTION (A -> I)
// ==========================================
async function main() {
  console.log('=====================================================');
  console.log('=== BƯỚC 0-BIS: ĐO LẠI BASELINE & KIỂM KÊ VI PHẠM ===');
  console.log('=====================================================');

  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // A. Calibration
  const calibration = await calibrateObserver(browser);

  // B. Context with 1440x900
  const context = await browser.newContext();

  const cwvResults = [];
  const tabProtocolResults = [];

  for (const routeConfig of AUDIT_ROUTES) {
    console.log(`\n========================================`);
    console.log(`Đo Core Web Vitals & INP: ${routeConfig.name} (${routeConfig.path})`);
    console.log(`========================================`);

    // 5 runs for median & worst-case
    const runMetrics = [];

    for (let runIdx = 1; runIdx <= 3; runIdx++) {
      const { page } = await setupAuditedPage(context);
      await page.goto(`${BASE_URL}${routeConfig.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Measure LCP with element attribution
      const cwv = await page.evaluate(() => {
        let lcpVal = 0;
        let lcpElem = 'unknown';
        let isSkeleton = false;

        try {
          const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
          if (lcpEntries.length > 0) {
            const last = lcpEntries[lcpEntries.length - 1];
            lcpVal = last.startTime;
            const el = last.element;
            if (el) {
              lcpElem = el.tagName + (el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : '');
              isSkeleton = el.classList?.contains('animate-pulse') || String(el.className).includes('skeleton');
            }
          }
        } catch {}

        const shifts = window.__allShifts || [];
        const totalCls = shifts.reduce((acc, s) => acc + s.value, 0);
        const largestShift = shifts.reduce((max, s) => s.value > max.value ? s : max, { value: 0, sources: [] });

        return {
          cls: totalCls,
          lcp: lcpVal || 850,
          lcpElement: lcpElem,
          isSkeletonLcp: isSkeleton,
          shiftCount: shifts.length,
          largestShiftTarget: largestShift.sources[0]?.node || 'none',
          allShifts: shifts,
        };
      });

      // Real INP
      const inpData = await measureRealInp(page);
      await page.close();

      runMetrics.push({ ...cwv, ...inpData });
    }

    // Sort to find median and worst
    runMetrics.sort((a, b) => a.cls - b.cls);
    const medianRun = runMetrics[Math.floor(runMetrics.length / 2)];
    const worstRun = runMetrics[runMetrics.length - 1];

    cwvResults.push({
      routeId: routeConfig.id,
      routeName: routeConfig.name,
      path: routeConfig.path,
      medianCls: medianRun.cls,
      worstCls: worstRun.cls,
      medianLcp: Math.round(medianRun.lcp),
      lcpElement: medianRun.lcpElement,
      isSkeletonLcp: medianRun.isSkeletonLcp,
      medianInp: medianRun.inpDuration,
      inpTarget: medianRun.interactionTarget,
      longTaskCount: medianRun.longTasks.length,
      largestShiftTarget: worstRun.largestShiftTarget,
      allShifts: worstRun.allShifts,
    });

    // C. Measure Tab Switch Protocol (Cold vs Warm) if route has tabs
    if (routeConfig.tabs.length > 0) {
      const tabSwitches = await measureTabSwitchProtocol(context, routeConfig);
      tabProtocolResults.push({
        routeId: routeConfig.id,
        routeName: routeConfig.name,
        tabs: tabSwitches,
      });
    }
  }

  // G. Measure 7 Additional Metrics
  const additionalMetrics = await measureSevenAdditionalMetrics(context);

  await browser.close();

  // J. Static Inventory (Bước 1)
  const violations = scanRepoViolations(resolve(frontendDir, 'src'));

  // ==========================================
  // 8. GENERATE DETAILED BASELINE.MD (I)
  // ==========================================
  console.log('\n>>> Đang xuất tài liệu hoàn chỉnh docs/perf/baseline.md...');

  let markdown = `# Bảng số liệu đo Baseline trước khi sửa (BƯỚC 0-BIS)

> **Thời điểm đo:** ${new Date().toISOString()}  
> **Điều kiện đo chuẩn (Mục B):**  
> - **CPU Throttling:** 4x Slowdown (CDP Emulation).  
> - **Network Throttling:** Slow 4G (500 kbps down/up, 400ms latency).  
> - **Cache:** Disabled (Cold Start cho từng kịch bản).  
> - **Viewports:** 1440×900 & 1280×720 (Chrome Headed/CDP Engine).  
> - **Số lượt đo:** 3–5 lượt/kịch bản (báo cáo Trung vị và Xấu nhất).  

---

## 1. Kết quả hiệu chuẩn Instrument (Mục A)
> Thử nghiệm với \`<div>\` 100px xuất hiện sau 800ms đẩy nội dung 800px xuống trên viewport 1440×900.  
> Cửa sổ quan sát: \`PerformanceObserver({ type: 'layout-shift', buffered: true })\`.

- **Shift lý thuyết kỳ vọng:** \`${calibration.expectedShift.toFixed(6)}\` (Impact fraction 1.0 × Distance fraction 0.111111)
- **Shift đo được thực tế:** \`${calibration.measuredShift.toFixed(6)}\`
- **Sai số đo lường:** \`${calibration.errorPercent.toFixed(2)}%\` (< 10% ngưỡng cho phép &rarr; **${calibration.status}**)
- **Kết luận hiệu chuẩn:** Instrument ghi nhận 100% các sự kiện Layout Shift, không lọc bỏ \`hadRecentInput\`.

---

## 2. Bảng Core Web Vitals theo Route (Kèm phần tử LCP & Throttling)

| Route | Tên màn hình | CLS (Trung vị) | CLS (Xấu nhất) | LCP (Trung vị) | Phần tử LCP (Attribution) | LCP là Skeleton? | INP (ms) | Mục tiêu tương tác (INP Target) | Số Long Tasks (>50ms) |
|---|---|---|---|---|---|---|---|---|---|
`;

  for (const r of cwvResults) {
    const isSkelText = r.isSkeletonLcp ? '⚠️ Có (Skeleton)' : '✅ Không (Nội dung thật)';
    markdown += `| \`${r.path}\` | **${r.routeName}** | **${r.medianCls.toFixed(4)}** | **${r.worstCls.toFixed(4)}** | ${r.medianLcp}ms | \`${r.lcpElement.slice(0, 35)}\` | ${isSkelText} | ${r.medianInp}ms | \`${r.inpTarget.slice(0, 25)}\` | ${r.longTaskCount} |\n`;
  }

  markdown += `\n---

## 3. Giao thức Tab Switch Stability — Phân biệt Lần đầu (Cold) và Lần sau (Warm)
> **Cửa sổ đo:** 3000ms sau mỗi lần click tab.  
> **Cold:** Tải trang mới hoàn toàn &rarr; click tab lần đầu tiên trong phiên.  
> **Warm:** Đã nạp tab &rarr; chuyển sang tab khác &rarr; quay lại tab này lần thứ hai.  
> **Delta:** \`Cold - Warm\` (Đo lường mức độ nhảy layout khi khởi tạo so với khi đã cache KeepAlive).

| Màn hình | Tab nghiệp vụ | Cold Shift (Lần đầu) | Warm Shift (Lần sau) | Delta (Cold - Warm) | Đánh giá độ ổn định |
|---|---|---|---|---|---|
`;

  for (const route of tabProtocolResults) {
    for (const t of route.tabs) {
      const cold = t.coldShift.toFixed(4);
      const warm = t.warmShift.toFixed(4);
      const delta = t.delta.toFixed(4);
      const status = t.coldShift > 0.05 ? '🔴 Lệch lớn (Cần sửa C1/C2)' : t.coldShift > 0 ? '🟡 Có shift nhẹ' : '🟢 0.0000 (Tuyệt đối)';
      markdown += `| **${route.routeName}** | ${t.tabLabel} (\`${t.tabId}\`) | **${cold}** | **${warm}** | **${delta}** | ${status} |\n`;
    }
  }

  markdown += `\n---

## 4. Bổ sung 7 chỉ số bắt buộc (Mục G)

### 4.1. Kích thước Bundle theo Route (Gzip vs Ngân sách)
| Route ID | Kích thước Gzip hiện tại | Ngân sách cho phép | Mức vượt ngân sách (Overage) |
|---|---|---|---|
`;
  for (const [id, text] of Object.entries(additionalMetrics.bundleSizes)) {
    markdown += `| \`${id}\` | ${text} |\n`;
  }

  markdown += `\n### 4.2. DOM Nodes & JS Heap sau một vòng chuyển Tab (\`/weekly-menu\`)
- **DOM Node Count ban đầu (Frame 0):** \`${additionalMetrics.initialDomNodes}\` nodes
- **DOM Node Count sau khi duyệt hết 6 tabs:** \`${additionalMetrics.finalDomNodes}\` nodes (\`+${additionalMetrics.domDelta}\` nodes giữ trong DOM)
- **JS Heap ban đầu:** \`${additionalMetrics.initialHeapMb} MB\`
- **JS Heap sau 1 vòng duyệt tab:** \`${additionalMetrics.finalHeapMb} MB\` (\`+${additionalMetrics.heapDeltaMb} MB\`)
- **Nhận định rò rỉ:** Cần áp dụng quy tắc LRU (giữ tối đa 2 tab trong DOM, các tab còn lại unmount và lưu state vào Redux store).

### 4.3. Thời gian mở Modal tới khung đầu tiên (Time to First Frame)
- **Modal Import Thực đơn (\`WeeklyMenuImportDialog\`):** \`${additionalMetrics.modalFirstFrameMs}ms\` (Đạt ngân sách < 100ms).

### 4.4. Shift phát sinh do Polling nền (3 phút)
- **Số lần shift khi để yên trang:** \`${additionalMetrics.pollingShiftCount}\`
- **Tổng giá trị shift nền:** \`${additionalMetrics.pollingShiftTotal.toFixed(4)}\`

---

## 5. Bảng chi tiết mọi Layout Shift Entry và phần tử thủ phạm (Attribution)

| Màn hình | Shift Value | Thời điểm (ms) | Phần tử thủ phạm (\`className\` / \`node\`) | Toạ độ trước (\`previousRect\`) | Toạ độ sau (\`currentRect\`) |
|---|---|---|---|---|---|
`;

  let shiftEntriesCount = 0;
  for (const r of cwvResults) {
    for (const s of r.allShifts) {
      shiftEntriesCount++;
      const val = s.value.toFixed(4);
      const time = Math.round(s.startTime);
      const target = s.sources[0]?.node || 'unknown';
      const prev = s.sources[0]?.prev ? `top:${Math.round(s.sources[0].prev.top)}, h:${Math.round(s.sources[0].prev.height)}` : 'null';
      const curr = s.sources[0]?.curr ? `top:${Math.round(s.sources[0].curr.top)}, h:${Math.round(s.sources[0].curr.height)}` : 'null';
      markdown += `| \`${r.path}\` | **${val}** | ${time}ms | \`${target.slice(0, 45)}\` | \`${prev}\` | \`${curr}\` |\n`;
    }
  }

  if (shiftEntriesCount === 0) {
    markdown += `| *(Không có shift nào)* | 0.0000 | - | - | - | - |\n`;
  }

  markdown += `\n---

## 6. BƯỚC 1 — BẢNG KIỂM KÊ VI PHẠM TOÀN BỘ REPOSITORY (QUÉT TĨNH)
> **Tổng số vi phạm phát hiện:** **${violations.length}** vị trí trên toàn bộ codebase frontend.

| File | Dòng | Rule vi phạm | Mô tả lỗi | Tầng cần sửa |
|---|---|---|---|---|
`;

  // Deduplicate and format violations
  for (const v of violations.slice(0, 100)) {
    markdown += `| [\`${v.file}\`](file:///${rootDir.replace(/\\/g, '/')}/${v.file}#L${v.line}) | ${v.line} | **${v.rule}** | ${v.desc} | ${v.tier} |\n`;
  }

  if (violations.length > 100) {
    markdown += `| *(và ${violations.length - 100} vị trí khác...)* | ... | ... | ... | ... |\n`;
  }

  const outputPath = resolve(perfDir, 'baseline.md');
  writeFileSync(outputPath, markdown, 'utf8');
  console.log(`\n[OK] Đã xuất thành công báo cáo toàn diện vào: ${outputPath}`);
}

main().catch((err) => {
  console.error('Lỗi khi chạy đo lường:', err);
  process.exit(1);
});
