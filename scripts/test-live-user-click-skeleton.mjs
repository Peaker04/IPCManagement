import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:5262';
const SNAPSHOTS_DIR = path.resolve(REPO_ROOT, '.artifacts', 'user-reproduction-snapshots');

fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

async function reproduceUserClicks() {
  console.log('========================================================================');
  console.log('  FRAME-BY-FRAME SKELETON REPRODUCTION (LOGGING EXACT USER EXPERIENCE)   ');
  console.log('========================================================================\n');

  // Obtain real backend JWT
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  const user = loginData.data?.user;

  console.log(`[AUTH] Logged in as: ${user.username} (${user.roleName})`);

  const browser = await chromium.launch({
    headless: true, // we can run headless or headed on Windows
    args: ['--no-sandbox', '--disable-web-security'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: SNAPSHOTS_DIR, size: { width: 1440, height: 900 } },
  });

  // Inject token & MRX mode into localStorage
  await context.addInitScript(({ authToken, authUser }) => {
    localStorage.setItem('ipc_v3_token', authToken);
    localStorage.setItem('ipc_v3_user', JSON.stringify(authUser));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  }, { authToken: token, authUser: user });

  const page = await context.newPage();

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER PAGEERROR:', err));

  // Attach a DOM mutation observer inside the browser page to catch ANY skeleton flash
  await page.addInitScript(() => {
    window.__skeletonFlashes = [];
    window.__isTrackingRevisits = false;

    const observer = new MutationObserver((mutations) => {
      if (!window.__isTrackingRevisits) return;

      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const el = node;
            const isSkeleton =
              el.hasAttribute?.('data-skeleton-kind') ||
              el.hasAttribute?.('data-loading-geometry') ||
              el.getAttribute?.('aria-label') === 'Đang tải nội dung' ||
              (typeof el.className === 'string' && el.className.includes('animate-pulse') && !el.closest('header') && !el.closest('nav') && !el.closest('footer')) ||
              el.querySelector?.('[data-skeleton-kind], [aria-label="Đang tải nội dung"]');

            if (isSkeleton) {
              window.__skeletonFlashes.push({
                timestamp: performance.now(),
                url: window.location.href,
                target: 'WorkbenchSkeleton',
                snippet: el.outerHTML?.slice(0, 200) || '',
              });
            }
          }
        }
      }
    });

    const attach = () => {
      if (document.documentElement) {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      } else {
        window.addEventListener('DOMContentLoaded', attach, { once: true });
      }
    };
    attach();
  });

  // Start at /reconciliation
  console.log('Navigating initially to /reconciliation...');
  await page.goto(`${BASE_URL}/reconciliation`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '01_initial_reconciliation.png') });

  const linksOnPage = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map((a) => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href'),
      visible: a.offsetParent !== null,
    }));
  });
  console.log('Visible links on /reconciliation:', JSON.stringify(linksOnPage, null, 2));

  console.log('\n========================================================================');
  console.log('  PHASE 1: INITIAL IN-SESSION WARMUP (FIRST MOUNT ACROSS SIDEBAR)       ');
  console.log('========================================================================');

  const warmupSteps = [
    { name: '1. Chuẩn bị lô đối soát', linkName: 'Chuẩn bị lô đối soát' },
    { name: '2. Định lượng xuất theo ngày', linkName: 'Định lượng xuất theo ngày' },
    { name: '3. Chuẩn bị xuất phối hợp', linkName: 'Chuẩn bị xuất phối hợp' },
    { name: '4. Thay đổi nguồn chờ xử lý', linkName: 'Thay đổi nguồn chờ xử lý' },
    { name: '5. Phiếu nấu theo lô', linkName: 'Phiếu nấu theo lô' },
    { name: '6. Rà soát dòng ngày', linkName: 'Rà soát dòng ngày' },
    { name: '7. Sổ theo dõi chênh lệch', linkName: 'Sổ theo dõi chênh lệch' },
    { name: '8. Lịch sử giao dịch kho', linkName: 'Lịch sử giao dịch kho' },
    { name: '9. Nhật ký kiểm toán', linkName: 'Nhật ký kiểm toán' },
    { name: '10. Danh bạ lô hoàn tất', linkName: 'Danh bạ lô hoàn tất' },
    { name: '11. Danh mục nguyên liệu', linkName: 'Danh mục nguyên liệu' },
    { name: '12. Danh mục món ăn', linkName: 'Danh mục món ăn' },
  ];

  for (const step of warmupSteps) {
    console.log(`[WARMUP] Loading ${step.name}...`);
    const link = page.getByRole('link', { name: step.linkName });
    await link.click();
    await page.waitForTimeout(600);
  }

  console.log('\n========================================================================');
  console.log('  PHASE 2: MUTATION OBSERVER REVISIT TEST ACROSS ALL 12 MRX LINKS       ');
  console.log('========================================================================');

  // Reset MutationObserver tracking array and activate tracking right before REVISIT sequence
  await page.evaluate(() => {
    window.__skeletonFlashes = [];
    window.__isTrackingRevisits = true;
  });

  const delays = [15, 35, 70, 150, 300, 600];

  const revisitSteps = [
    { name: 'REVISIT 1: "Chuẩn bị lô đối soát"', linkName: 'Chuẩn bị lô đối soát', expectedHeader: 'Chuẩn bị lô đối soát' },
    { name: 'REVISIT 2: "Định lượng xuất theo ngày"', linkName: 'Định lượng xuất theo ngày', expectedHeader: 'Xuất kho nguyên liệu theo ngày' },
    { name: 'REVISIT 3: "Chuẩn bị xuất phối hợp"', linkName: 'Chuẩn bị xuất phối hợp', expectedHeader: 'Chuẩn bị nguyên liệu phối hợp đa khách hàng' },
    { name: 'REVISIT 4: "Thay đổi nguồn chờ xử lý"', linkName: 'Thay đổi nguồn chờ xử lý', expectedHeader: 'Thay đổi nguồn chờ Kho xử lý' },
    { name: 'REVISIT 5: "Phiếu nấu theo lô"', linkName: 'Phiếu nấu theo lô', expectedHeader: 'Phiếu nấu theo lô' },
    { name: 'REVISIT 6: "Rà soát dòng ngày"', linkName: 'Rà soát dòng ngày', expectedHeader: 'Đối soát nguyên liệu', expectedSubbar: 'Lịch xuất ca:' },
    { name: 'REVISIT 7: "Sổ theo dõi chênh lệch"', linkName: 'Sổ theo dõi chênh lệch', expectedHeader: 'Đối soát nguyên liệu', expectedSubbar: 'Sổ theo dõi chênh lệch' },
    { name: 'REVISIT 8: "Lịch sử giao dịch kho"', linkName: 'Lịch sử giao dịch kho', expectedHeader: 'Đối soát nguyên liệu', expectedSubbar: 'Lịch sử giao dịch' },
    { name: 'REVISIT 9: "Nhật ký kiểm toán"', linkName: 'Nhật ký kiểm toán', expectedHeader: 'Đối soát nguyên liệu', expectedSubbar: 'Nhật ký kiểm toán' },
    { name: 'REVISIT 10: "Danh bạ lô hoàn tất"', linkName: 'Danh bạ lô hoàn tất', expectedHeader: 'Đối soát nguyên liệu', expectedSubbar: 'Danh bạ lưu trữ' },
    { name: 'REVISIT 11: "Danh mục nguyên liệu"', linkName: 'Danh mục nguyên liệu', expectedHeader: 'Quản trị dữ liệu & Danh mục', expectedSubbar: 'nguyên liệu' },
    { name: 'REVISIT 12: "Danh mục món ăn"', linkName: 'Danh mục món ăn', expectedHeader: 'Quản trị dữ liệu & Danh mục', expectedSubbar: 'món ăn' },
  ];

  const emptyStateFlashes = [];
  const layoutCollapseFlashes = [];

  for (const step of revisitSteps) {
    console.log(`>>> ${step.name}...`);
    const link = page.getByRole('link', { name: step.linkName });
    await link.click();

    const frameStates = [];

    for (const d of delays) {
      await page.waitForTimeout(d);
      const stateAtFrame = await page.evaluate(({ expectedHeader, expectedSubbar }) => {
        const skeleton = document.querySelector('[data-skeleton-kind], [aria-label="Đang tải nội dung"]');
        const emptyState = document.querySelector('.lucide-inbox');
        const table = document.querySelector('table');
        const rowCount = document.querySelectorAll('table tbody tr').length;
        const header = document.querySelector('header h1')?.textContent;
        const mainContent = document.querySelector('.flex-1.min-h-0');
        const contentHeight = mainContent ? mainContent.getBoundingClientRect().height : 0;
        const hasContent = Boolean(table || emptyState || document.querySelector('[role="status"]') || document.querySelector('[role="alert"]') || contentHeight > 100);

        // Check if main workbench (excluding sidebar) has rendered target content
        const mainText = mainContent ? mainContent.innerText : '';
        const isHeaderMounted = header === expectedHeader;
        const isSubbarMounted = !expectedSubbar || mainText.toLowerCase().includes(expectedSubbar.toLowerCase());
        const isTargetViewMounted = isHeaderMounted && isSubbarMounted;

        return {
          url: window.location.href,
          hasSkeleton: Boolean(skeleton),
          skeletonKind: skeleton?.getAttribute('data-skeleton-kind') || null,
          hasEmptyState: Boolean(emptyState),
          hasTable: Boolean(table),
          hasContent,
          isTargetViewMounted,
          contentHeight,
          rowCount,
          headerText: header || null,
        };
      }, { expectedHeader: step.expectedHeader, expectedSubbar: step.expectedSubbar });

      frameStates.push({ delay: d, ...stateAtFrame });
      const currentFlashes = (await page.evaluate(() => window.__skeletonFlashes.length)) + emptyStateFlashes.length + layoutCollapseFlashes.length;
      console.log(`  Frame +${d}ms (REVISIT): URL="${stateAtFrame.url}" | Skeleton: ${stateAtFrame.hasSkeleton} | EmptyState: ${stateAtFrame.hasEmptyState} | HasContent/Table: ${stateAtFrame.hasTable || stateAtFrame.hasContent} | FlashesCount: ${currentFlashes} | Header: "${stateAtFrame.headerText}"`);
    }

    // Check for premature Empty State Flash (only after target subview content has actually mounted in the main workbench)
    const subviewFrames = frameStates.filter((f) => f.isTargetViewMounted);
    const hadEarlyEmpty = subviewFrames.some((f) => (f.delay === 15 || f.delay === 35) && f.hasEmptyState);
    const lostEmptyLater = subviewFrames.some((f) => (f.delay === 150 || f.delay === 300 || f.delay === 600) && !f.hasEmptyState && f.hasTable);
    if (hadEarlyEmpty && lostEmptyLater) {
      emptyStateFlashes.push({ step: step.name, frames: frameStates });
    }

    // Check for Layout Collapse Flash (content area height collapsed to 0 after page mounted)
    const hadCollapsedContent = subviewFrames.some((f) => f.contentHeight <= 0 || !f.hasContent);
    if (hadCollapsedContent) {
      layoutCollapseFlashes.push({ step: step.name, frames: frameStates });
    }
  }

  // Authoritatively inspect all DOM mutations captured by the observer
  const recordedFlashes = await page.evaluate(() => window.__skeletonFlashes);
  console.log(`\n>>> MUTATION OBSERVER AUDIT ACROSS 12 MRX LINKS:`);
  console.log(`  • window.__skeletonFlashes.length = ${recordedFlashes.length}`);
  console.log(`  • __emptyStateFlashes.length = ${emptyStateFlashes.length}`);
  console.log(`  • __layoutCollapseFlashes.length = ${layoutCollapseFlashes.length}`);

  if (recordedFlashes.length > 0 || emptyStateFlashes.length > 0 || layoutCollapseFlashes.length > 0) {
    if (recordedFlashes.length > 0) {
      console.error('\n🚨 FATAL REGRESSION: MutationObserver caught transient skeleton insertions:');
      recordedFlashes.forEach((f, idx) => console.error(`  [SKELETON FLASH #${idx + 1}] at ${f.timestamp.toFixed(1)}ms | URL=${f.url} | snippet=${f.snippet}`));
    }
    if (emptyStateFlashes.length > 0) {
      console.error('\n🚨 FATAL REGRESSION: Premature empty state flashes detected (appeared then replaced by table):');
      emptyStateFlashes.forEach((f, idx) => console.error(`  [EMPTY FLASH #${idx + 1}] at ${f.step}`));
    }
    if (layoutCollapseFlashes.length > 0) {
      console.error('\n🚨 FATAL REGRESSION: Layout collapse flashes detected:');
      layoutCollapseFlashes.forEach((f, idx) => console.error(`  [LAYOUT COLLAPSE FLASH #${idx + 1}] at ${f.step}`));
    }
    process.exit(1);
  } else {
    console.log('\n✓ PASS: ALL 3 AUDIT CATEGORIES PASSED ON ALL 12 MRX LINKS (100% SWR Synchronous Cache Hydration):');
    console.log('  • 0 Skeleton Flashes recorded');
    console.log('  • 0 Empty State Flashes recorded');
    console.log('  • 0 Layout Collapse Flashes recorded');
  }

  await browser.close();

  console.log('\n========================================================================');
  console.log(`All frames and video saved to: ${SNAPSHOTS_DIR}`);
  console.log('========================================================================\n');
}

reproduceUserClicks().catch((err) => {
  console.error('[REPRODUCTION FATAL]', err);
  process.exit(1);
});
