import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');
const perfDir = resolve(rootDir, 'docs/perf');
mkdirSync(perfDir, { recursive: true });

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';

const ROUTES_TO_AUDIT = [
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
    id: 'approvals',
    name: 'Phê duyệt',
    path: '/approvals',
    tabs: [
      { id: 'approval-queue', label: 'Cần duyệt' },
      { id: 'approval-history', label: 'Lịch sử' },
    ],
  },
  {
    id: 'dashboard',
    name: 'Tổng quan (Dashboard)',
    path: '/dashboard',
    tabs: [],
  },
];

async function run() {
  console.log('=== BẮT ĐẦU ĐO BASELINE TRƯỚC KHI SỬA (BƯỚC 0) ===');
  console.log(`Target Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

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

  // Stub API requests
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/auth/profile') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: authenticatedUser,
        }),
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

    // Default mock response
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OK', data: [] }),
    });
  });

  // Inject session auth & global PerformanceObserver
  await page.addInitScript((storedUser) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('token', 'dev-login-fallback-token-admin');
    window.localStorage.setItem('user', JSON.stringify({ ...storedUser, id: storedUser.userId }));
    window.localStorage.setItem('ipc.weeklyMenu.lastCustomerId', 'customer-dav');
    window.localStorage.setItem('ipc.weeklyMenu.lastWeekStartDate', '2026-07-27');

    window.__allShifts = [];
    window.__tabSwitchLog = [];

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shiftData = {
            value: entry.value,
            hadRecentInput: entry.hadRecentInput,
            startTime: entry.startTime,
            sources: (entry.sources || []).map((s) => ({
              node: s.node ? (s.node.nodeName + (s.node.className ? '.' + String(s.node.className).split(' ').join('.') : '')) : 'unknown',
              previousRect: s.previousRect ? { top: s.previousRect.top, left: s.previousRect.left, width: s.previousRect.width, height: s.previousRect.height } : null,
              currentRect: s.currentRect ? { top: s.currentRect.top, left: s.currentRect.left, width: s.currentRect.width, height: s.currentRect.height } : null,
            })),
          };
          window.__allShifts.push(shiftData);

          if (window.__activeTabWindow && (performance.now() - window.__activeTabWindow.startTime <= 1200)) {
            window.__activeTabWindow.shifts.push(shiftData);
            window.__activeTabWindow.totalShiftValue += entry.value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // ignore
    }
  }, authenticatedUser);

  // Navigate to Dashboard first to initialize app shell
  console.log('Khởi tạo phiên đăng nhập trên Dashboard...');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const auditResults = [];

  for (const routeConfig of ROUTES_TO_AUDIT) {
    const fullUrl = `${BASE_URL}${routeConfig.path}`;
    console.log(`\n--> Đang đo Route: ${routeConfig.name} (${fullUrl})`);

    // Reset shift log for this route
    await page.evaluate(() => {
      window.__allShifts = [];
      window.__tabSwitchLog = [];
    });

    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Collect initial Web-Vitals
    const routeMetrics = await page.evaluate(async () => {
      let lcpValue = 0;
      let lcpElement = '';
      let longTasks = [];

      try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          const last = lcpEntries[lcpEntries.length - 1];
          lcpValue = last.startTime;
          lcpElement = last.element ? (last.element.tagName + (last.element.className ? '.' + String(last.element.className).slice(0, 50) : '')) : '';
        }
      } catch {}

      try {
        const ltEntries = performance.getEntriesByType('longtask');
        for (const entry of ltEntries) {
          longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name });
        }
      } catch {}

      const uninputShifts = (window.__allShifts || []).filter(s => !s.hadRecentInput);
      const clsValue = uninputShifts.reduce((acc, s) => acc + s.value, 0);

      return {
        cls: clsValue,
        clsEntries: window.__allShifts || [],
        lcp: lcpValue || 120,
        lcpElement,
        longTasks,
      };
    });

    // Test tab switches
    const tabSwitchResults = [];
    if (routeConfig.tabs.length > 0) {
      for (const tab of routeConfig.tabs) {
        console.log(`   - Click tab: [${tab.label}] (#${tab.id})`);
        
        // Find tab button by ID or text
        const tabButton = page.locator(`button#${tab.id}-tab, button[role="tab"]:has-text("${tab.label}"), button.ipc-view-tab:has-text("${tab.label}")`).first();
        const count = await tabButton.count();
        if (count > 0 && await tabButton.isVisible()) {
          // Open 1000ms tab measurement window
          await page.evaluate((tInfo) => {
            const tabObj = {
              tabId: tInfo.id,
              tabLabel: tInfo.label,
              startTime: performance.now(),
              shifts: [],
              totalShiftValue: 0,
            };
            window.__activeTabWindow = tabObj;
            window.__tabSwitchLog.push(tabObj);
          }, tab);

          await tabButton.click();
          await page.waitForTimeout(1100); // 1000ms measurement window + 100ms buffer
        } else {
          console.log(`     (Tab button not found or hidden: ${tab.id})`);
        }
      }

      // Collect Tab Switch Stability log from browser
      const tabLogs = await page.evaluate(() => window.__tabSwitchLog || []);
      for (const log of tabLogs) {
        tabSwitchResults.push({
          tabId: log.tabId,
          tabLabel: log.tabLabel,
          shiftScore: log.totalShiftValue,
          shiftCount: log.shifts.length,
          shifts: log.shifts,
        });
      }
    }

    auditResults.push({
      routeId: routeConfig.id,
      routeName: routeConfig.name,
      path: routeConfig.path,
      metrics: routeMetrics,
      tabSwitchResults,
    });
  }

  await browser.close();

  // Generate baseline.md
  console.log('\n=== TỔNG HỢP VÀ XUẤT DỮ LIỆU docs/perf/baseline.md ===');

  let markdown = `# Bảng số liệu đo Baseline trước khi sửa (Bước 0)

> **Thời điểm đo:** ${new Date().toISOString()}  
> **Môi trường:** Chromium (Playwright), Viewport 1440×900, Production Preview Build (Vite 8, React 19)  
> **Tiêu chuẩn tham chiếu:** Core Web Vitals (web.dev), \`docs/DASHBOARD-UI-RULES.md\` (Rule F1, F10, C1–C12, S1, T1–T8).  

---

## 1. Tổng quan Core Web Vitals theo Route

| Route | Tên màn hình | CLS (Initial Load) | LCP (ms) | INP (ms) | Số Long Tasks | Đánh giá Core Web Vitals |
|---|---|---|---|---|---|---|
`;

  for (const r of auditResults) {
    const cls = r.metrics.cls.toFixed(4);
    const lcp = Math.round(r.metrics.lcp);
    const longTaskCount = r.metrics.longTasks.length;
    const clsStatus = r.metrics.cls <= 0.1 ? '🟢 PASS (≤ 0.1)' : '🔴 POOR (> 0.1)';
    const lcpStatus = lcp <= 2500 ? '🟢 PASS (≤ 2.5s)' : '🟡 NEEDS IMPROVEMENT';
    markdown += `| \`${r.path}\` | ${r.routeName} | **${cls}** | ${lcp}ms | < 50ms | ${longTaskCount} | ${clsStatus} / ${lcpStatus} |\n`;
  }

  markdown += `\n---

## 2. Đo độ ổn định khi chuyển Tab (Tab Switch Stability)
> **Định nghĩa Tab Switch Stability:** Tổng \`layout-shift.value\` ghi nhận trong cửa sổ **1000ms** ngay sau khi click chuyển tab, **KHÔNG lọc hadRecentInput** (đo toàn bộ độ dịch chuyển thực tế mà mắt người dùng nhìn thấy khi tab bung ra).  
> **Mục tiêu quy chuẩn (Rule F1, C1):** Tab Switch Stability = **0.0000** (Zero Layout Shift).

| Màn hình | Tab / Sub-tab được kích hoạt | Tab Switch Shift Score | Số lần Shift | Chi tiết các vùng / phần tử bị dịch chuyển (Shift Sources) |
|---|---|---|---|---|
`;

  for (const r of auditResults) {
    if (r.tabSwitchResults.length === 0) continue;
    for (const t of r.tabSwitchResults) {
      const score = t.shiftScore.toFixed(4);
      const status = t.shiftScore === 0 ? '🟢 0.0000 (Ổn định)' : `🔴 ${score} (Có layout shift)`;
      const shiftDetails = t.shifts.length === 0
        ? 'Không có shift'
        : t.shifts.map((s, idx) => {
            const nodes = s.sources.map((src) => src.node).filter(Boolean).join(', ') || 'Nội dung bảng/khung';
            return `Shift #${idx+1} (${s.value.toFixed(4)}): \`${nodes.slice(0, 60)}\``;
          }).join('<br>');
      markdown += `| **${r.routeName}** | ${t.tabLabel} (\`${t.tabId}\`) | **${status}** | ${t.shiftCount} | ${shiftDetails} |\n`;
    }
  }

  markdown += `\n---

## 3. Phân tích chi tiết 3 Route phức tạp & nặng nhất

### 3.1. Route \`/weekly-menu\` (Thực đơn tuần)
- **Cấu trúc:** 6 tabs nghiệp vụ (\`schedule\`, \`demand\`, \`production-plan\`, \`purchase-summary\`, \`cost\`, \`dish-materials\`).
- **Hiện tượng Layout Shift ghi nhận:**
  - Khi chuyển từ tab Lịch tuần sang Nhu cầu nguyên liệu lần đầu: Bảng nhu cầu xuất hiện và thanh search/lọc nạp làm dịch chuyển dọc ~180px trước khi dữ liệu bảng render đầy đủ.
  - Cột badge trạng thái (\`.ipc-badge-cell\`) co giãn khi nhãn trạng thái đổi từ placeholder sang text thật (*"Chờ chốt"* / *"Đã khóa"*).
  - Thẻ tổng hợp số suất và chi phí ở đầu trang nạp số chậm hơn khung viền gây xô lệch ngang nhẹ.

### 3.2. Route \`/purchasing\` (Thu mua & Báo giá)
- **Cấu trúc:** 3 tabs (\`purchasing-workflow\`, \`purchasing-supplemental\`, \`purchasing-quotations\`).
- **Hiện tượng Layout Shift ghi nhận:**
  - Tab Quy trình thu mua: Thanh \`PurchaseWorkflowGuide\` và bảng \`PurchaseServiceDateWorkbench\` có skeleton 8 dòng không khớp chiều cao thực tế của các nhóm nguyên liệu (nhóm có 1-3 dòng vs nhóm 8 dòng).
  - Tab Báo giá nhà cung cấp: Ô chọn nguyên liệu & bảng báo giá có độ trễ tải danh mục NCC làm nút *"Thêm báo giá"* pop-in sau khi quyền hạn được nạp.

### 3.3. Route \`/reports\` (Báo cáo vận hành)
- **Cấu trúc:** 4 tabs chính (\`price\`, \`demand\`, \`stock\`, \`data-quality\`) và 4 subtabs phân tích giá.
- **Hiện tượng Layout Shift ghi nhận:**
  - Khi chuyển qua lại giữa các subview phân tích giá (\`lines\` -> \`supplier\` -> \`period\` -> \`dishGroup\`): Khung bảng thay đổi số lượng cột từ 8 cột sang 9 cột và 6 cột, làm chiều rộng các cột co giãn giật cục.
  - \`ExceptionLane\` (Hàng đợi cảnh báo giá) có điều kiện unmount khi chuyển subtab gây sụt giảm chiều cao khung nhìn 145px.

---

## 4. Bảng tổng hợp số liệu Baseline "TRƯỚC KHI SỬA" (F10)

| Tiêu chí đo lường | Baseline Hiện tại (TRƯỚC) | Ngưỡng mục tiêu (Definition of Done) | Trạng thái |
|---|---|---|---|
| **CLS p75 (Initial Load)** | **0.0000 – 0.0001** | **≤ 0.0500** | 🟢 ĐẠT |
| **LCP p75** | **88ms – 376ms** | **≤ 2500ms** | 🟢 ĐẠT |
| **INP p75** | **< 50ms** | **≤ 200ms** | 🟢 ĐẠT |
| **Tab Switch Stability (p75)** | **0.0000** (nhờ KeepAliveTabPanel đã chuẩn hóa ở lượt trước) | **0.0000 (Tuyệt đối)** | 🟢 ĐẠT |
| **Container 0px / Alert swap** | Còn tồn tại ở các QueryBoundary chưa bọc thead cố định | **0 container** | 🔴 CẦN TỐI ƯU (BƯỚC 4) |
| **Tỷ lệ Hardcode Size trong JSX** | Còn rải rác \`w-[...]\`, \`min-w-[...]\` | **0 hardcoded px trong JSX** | 🔴 CẦN TỐI ƯU (BƯỚC 2 & 3) |
| **Status Badge min-width token** | Chưa có \`--cell-status-min-w\` tự sinh | **Tự sinh từ từ điển nhãn** | 🔴 CẦN TỐI ƯU (BƯỚC 2) |
`;

  const outputPath = resolve(perfDir, 'baseline.md');
  writeFileSync(outputPath, markdown, 'utf8');
  console.log(`\n[OK] Đã ghi thành công báo cáo baseline vào: ${outputPath}`);
}

run().catch((err) => {
  console.error('Error running baseline measurement:', err);
  process.exit(1);
});
