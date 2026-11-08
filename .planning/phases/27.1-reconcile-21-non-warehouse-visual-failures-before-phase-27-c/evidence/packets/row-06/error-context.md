# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> visual routes >> desktop >> approvals visual baseline
- Location: tests\visual-routes.spec.ts:270:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 1365px by 900px, received 1365px by 943px. 37673 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: approvals-desktop.png

Call log:
  - Expect "toHaveScreenshot(approvals-desktop.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 1365px by 900px, received 1365px by 943px. 37673 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 1365px by 900px, received 1365px by 943px. 37673 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - link "Bỏ qua điều hướng" [ref=e4] [cursor=pointer]:
    - /url: "#ipc-main-content"
  - complementary [ref=e5]:
    - generic [ref=e6]:
      - img [ref=e8]
      - generic [ref=e10]:
        - heading "IPC System" [level=2] [ref=e11]
        - generic [ref=e12]: Điều hành bếp ăn
    - navigation "Điều hướng chính" [ref=e13]:
      - link "Tổng quan" [ref=e14] [cursor=pointer]:
        - /url: /
        - img [ref=e16]
        - generic [ref=e21]: Tổng quan
      - link "Thực đơn tuần" [ref=e22] [cursor=pointer]:
        - /url: /weekly-menu
        - img [ref=e24]
        - generic [ref=e26]: Thực đơn tuần
      - link "Điều phối đơn" [ref=e27] [cursor=pointer]:
        - /url: /meal-orders
        - img [ref=e29]
        - generic [ref=e32]: Điều phối đơn
      - link "Duyệt vận hành" [ref=e33] [cursor=pointer]:
        - /url: /approvals
        - img [ref=e35]
        - generic [ref=e39]: Duyệt vận hành
      - link "Thu mua" [ref=e40] [cursor=pointer]:
        - /url: /purchasing
        - img [ref=e42]
        - generic [ref=e46]: Thu mua
      - link "Kho nguyên liệu" [ref=e47] [cursor=pointer]:
        - /url: /warehouse
        - img [ref=e49]
        - generic [ref=e52]: Kho nguyên liệu
      - link "Bếp trưởng" [ref=e53] [cursor=pointer]:
        - /url: /chef-dashboard
        - img [ref=e55]
        - generic [ref=e57]: Bếp trưởng
      - link "Báo cáo vận hành" [ref=e58] [cursor=pointer]:
        - /url: /reports
        - img [ref=e60]
        - generic [ref=e63]: Báo cáo vận hành
      - link "Quản trị dữ liệu" [ref=e64] [cursor=pointer]:
        - /url: /admin-data
        - img [ref=e66]
        - generic [ref=e70]: Quản trị dữ liệu
      - link "Thiết lập quy trình duyệt" [ref=e71] [cursor=pointer]:
        - /url: /admin/rules
        - img [ref=e73]
        - generic [ref=e76]: Thiết lập quy trình duyệt
    - generic [ref=e77]:
      - link "Thiết lập nâng cao" [ref=e78] [cursor=pointer]:
        - /url: /admin/advanced-settings
        - img [ref=e79]
        - generic [ref=e80]: Thiết lập nâng cao
      - generic "Tài khoản đang đăng nhập" [ref=e81]:
        - generic [ref=e82]: T
        - generic [ref=e83]:
          - generic [ref=e84]: Trần Văn Giám Đốc
          - generic [ref=e85]: Giám đốc / Admin
      - button "Đăng xuất" [ref=e86] [cursor=pointer]:
        - img [ref=e87]
        - generic [ref=e90]: Đăng xuất
  - generic [ref=e91]:
    - banner [ref=e92]:
      - generic [ref=e93]:
        - generic [ref=e94]:
          - link "Tổng quan" [ref=e95] [cursor=pointer]:
            - /url: /
          - generic [ref=e96]: /
          - generic [ref=e97]: Quản lí
        - heading "Duyệt vận hành" [level=1] [ref=e98]
      - generic "Ngữ cảnh vận hành" [ref=e99]:
        - generic [ref=e100]:
          - img [ref=e101]
          - generic [ref=e103]: 22/7/2026
        - generic [ref=e104]:
          - img [ref=e105]
          - generic [ref=e108]: Ca trưa · Quản lí vận hành
        - generic [ref=e111]: Chưa đồng bộ dữ liệu
    - main [ref=e112]:
      - generic [ref=e113]:
        - generic [ref=e114]:
          - generic [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]:
                - img [ref=e118]
                - text: "Nguồn: Nhu cầu nguyên liệu"
              - generic [ref=e122]: "Hạn duyệt gần nhất: 09/07/2026"
            - generic [ref=e123]:
              - generic [ref=e124]:
                - button "Từ chối" [ref=e125] [cursor=pointer]
                - link "Kiểm tra kho" [ref=e126] [cursor=pointer]:
                  - /url: /warehouse
                  - img [ref=e127]
                  - text: Kiểm tra kho
              - generic [ref=e130]:
                - button "Duyệt" [ref=e131] [cursor=pointer]
                - link "Sang thu mua" [ref=e132] [cursor=pointer]:
                  - /url: /purchasing
                  - img [ref=e133]
                  - text: Sang thu mua
          - generic [ref=e137]:
            - generic [ref=e138]:
              - img [ref=e140]
              - term [ref=e142]: Trạng thái chính
              - definition [ref=e143]: Chờ duyệt
            - generic [ref=e144]:
              - img [ref=e146]
              - term [ref=e155]: Đơn mua
              - definition [ref=e156]: 0 chứng từ
            - generic [ref=e157]:
              - img [ref=e159]
              - term [ref=e161]: Nhu cầu xuất
              - definition [ref=e162]: 0 phiếu
            - generic [ref=e163]:
              - img [ref=e165]
              - term [ref=e174]: Người duyệt
              - definition [ref=e175]: Quản lí vận hành
        - generic [ref=e177]:
          - tablist "Chọn góc nhìn duyệt vận hành" [ref=e178]:
            - tab "Cần duyệt" [selected] [ref=e179] [cursor=pointer]
            - tab "Lịch sử" [ref=e180] [cursor=pointer]
          - tabpanel "Cần duyệt" [ref=e182]:
            - region "Đối soát điều chỉnh thực đơn" [ref=e183]:
              - generic [ref=e184]:
                - generic [ref=e185]:
                  - heading "Đối soát điều chỉnh thực đơn" [level=2] [ref=e186]
                  - paragraph [ref=e187]: Xử lý các thay đổi đã liên quan đến chứng từ vận hành.
                - generic [ref=e188]:
                  - text: Khách hàng
                  - combobox "Khách hàng" [ref=e189]:
                    - option "Chọn khách hàng" [selected]
                    - option "Tất cả khách hàng"
              - paragraph [ref=e190]: Chọn khách hàng để xem yêu cầu cần xử lý.
            - generic [ref=e191]:
              - generic [ref=e193]:
                - heading "Danh sách cần duyệt" [level=3] [ref=e195]:
                  - img [ref=e196]
                  - generic [ref=e200]: Danh sách cần duyệt
                - generic [ref=e201]:
                  - generic [ref=e202]:
                    - text: Tìm chứng từ hoặc nguyên liệu
                    - textbox "Tìm chứng từ hoặc nguyên liệu" [ref=e203]:
                      - /placeholder: Mã phiếu, nhà cung cấp, nguyên liệu...
                  - paragraph [ref=e204]: "Phạm vi: Tất cả ngày đang chờ duyệt"
                - generic [ref=e205]:
                  - generic "Hàng đợi duyệt đã cập nhật" [ref=e206]:
                    - region "Hàng đợi duyệt vận hành" [ref=e207]:
                      - article [ref=e208]:
                        - generic [ref=e209]:
                          - strong [ref=e210]: Duyệt đơn mua
                          - paragraph [ref=e211]: PR-20260709-M
                          - generic "Thao tác cho Duyệt đơn mua" [ref=e212]:
                            - button "Duyệt chứng từ" [ref=e213]
                            - button "Từ chối chứng từ" [ref=e214]
                        - generic [ref=e215]:
                          - status "Chờ duyệt" [ref=e216]:
                            - generic [ref=e218]: Chờ duyệt
                          - paragraph [ref=e219]: Đơn mua đã gửi, chờ duyệt trước khi mua hàng.
                        - generic [ref=e220]:
                          - generic [ref=e221]:
                            - term [ref=e222]: "Gửi bởi:"
                            - definition [ref=e223]: Điều phối ca sáng
                          - generic [ref=e224]:
                            - term [ref=e225]: "Hạn:"
                            - definition [ref=e226]: 09/07/2026
                          - generic [ref=e227]:
                            - term [ref=e228]: "Người phụ trách:"
                            - definition [ref=e229]: Thu mua / Quản lý
                        - list [ref=e231]:
                          - listitem [ref=e232]:
                            - generic [ref=e233]: Sườn heo
                            - strong [ref=e234]: 15 kg
                  - navigation "Phân trang hàng đợi duyệt" [ref=e235]:
                    - generic [ref=e236]: Đã tải hết dữ liệu
                    - generic [ref=e237]:
                      - button "Trang trước" [disabled] [ref=e238]:
                        - img [ref=e239]
                      - generic [ref=e241]: Trang 1
                      - button "Trang sau" [disabled] [ref=e242]:
                        - img [ref=e243]
              - complementary "Chứng từ" [ref=e245]:
                - generic [ref=e246]: Chứng từ
                - generic [ref=e248]:
                  - img [ref=e250]
                  - paragraph [ref=e253]: Chưa có dữ liệu để hiển thị
```

# Test source

```ts
  186 |           ingredientName: 'Gạo tẻ',
  187 |           unitId: 'unit-kg',
  188 |           unitName: 'kg',
  189 |           currentQty: 240,
  190 |           lastUpdated: '2026-07-09T05:00:00Z',
  191 |         },
  192 |       ],
  193 |       'receipt-price-variance': [
  194 |         {
  195 |           receiptId: 'receipt-visual',
  196 |           receiptCode: 'PN-20260709-01',
  197 |           receiptDate: '2026-07-09',
  198 |           supplierId: 'supplier-a',
  199 |           supplierName: 'Nhà cung cấp A',
  200 |           ingredientId: 'ing-rib',
  201 |           ingredientName: 'Sườn heo',
  202 |           unitId: 'unit-kg',
  203 |           unitName: 'kg',
  204 |           quantity: 15,
  205 |           unitPrice: 134000,
  206 |           referencePrice: 115000,
  207 |           variancePercent: 16.5,
  208 |           isWarning: true,
  209 |         },
  210 |       ],
  211 |     };
  212 | 
  213 |     await fulfill(route, rowsByEndpoint[endpoint] ?? []);
  214 |   });
  215 | }
  216 | 
  217 | async function login(page: Page) {
  218 |   await page.route('**/api/auth/login', async (route) => {
  219 |     await route.fulfill({
  220 |       status: 503,
  221 |       contentType: 'application/json',
  222 |       body: JSON.stringify({ success: false, message: 'Playwright mock login fallback' }),
  223 |     });
  224 |   });
  225 |   await page.route('**/api/auth/profile', async (route) => {
  226 |     await route.fulfill({
  227 |       status: 200,
  228 |       contentType: 'application/json',
  229 |       body: JSON.stringify({
  230 |         success: true,
  231 |         data: {
  232 |           userId: '1',
  233 |           username: 'admin',
  234 |           fullName: 'Trần Văn Giám Đốc',
  235 |           roleName: 'Admin',
  236 |         },
  237 |       }),
  238 |     });
  239 |   });
  240 | 
  241 |   await page.goto(ROUTES.LOGIN);
  242 |   await page.getByLabel('Tài khoản').fill('admin');
  243 |   await page.getByLabel('Mật khẩu').fill('admin');
  244 |   await page.getByRole('button', { name: 'Đăng nhập' }).click();
  245 |   await expect(page).toHaveURL(ROUTES.DASHBOARD);
  246 | }
  247 | 
  248 | async function stabilizeVisuals(page: Page) {
  249 |   await page.waitForLoadState('networkidle');
  250 |   await page.addStyleTag({
  251 |     content: `
  252 |       *, *::before, *::after {
  253 |         animation-delay: 0s !important;
  254 |         animation-duration: 0.001s !important;
  255 |         transition-delay: 0s !important;
  256 |         transition-duration: 0.001s !important;
  257 |         caret-color: transparent !important;
  258 |       }
  259 |     `,
  260 |   });
  261 |   await page.waitForTimeout(500);
  262 | }
  263 | 
  264 | test.describe('visual routes', () => {
  265 |   for (const viewport of visualViewports) {
  266 |     test.describe(viewport.name, () => {
  267 |       test.use({ viewport: { width: viewport.width, height: viewport.height } });
  268 | 
  269 |       for (const route of visualRoutes) {
  270 |         test(`${route.name} visual baseline`, async ({ page }) => {
  271 |           await installPhase09Clock(page);
  272 |           await stubVisualApi(page);
  273 |           if (route.path === ROUTES.LOGIN) {
  274 |             await page.goto(route.path);
  275 |           } else {
  276 |             await login(page);
  277 |             if (route.path !== ROUTES.DASHBOARD) {
  278 |               await page.goto(route.path);
  279 |             }
  280 |             await expect(page).toHaveURL(route.path);
  281 |             await expect(page.locator('.ipc-app-shell')).toBeVisible();
  282 |             await expect(page.locator('.ipc-header-context')).toContainText(phase09HeaderDate);
  283 |           }
  284 | 
  285 |           await stabilizeVisuals(page);
> 286 |           await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
      |                              ^ Error: expect(page).toHaveScreenshot(expected) failed
  287 |             fullPage: true,
  288 |           });
  289 |         });
  290 |       }
  291 |     });
  292 |   }
  293 | });
  294 | 
  295 | test.describe('full-system tab audit captures', () => {
  296 |   for (const viewport of [
  297 |     { name: 's-390', width: 390, height: 844 },
  298 |     { name: 'm-768', width: 768, height: 1024 },
  299 |     { name: 'l-1280', width: 1280, height: 900 },
  300 |     { name: 'xl-1440', width: 1440, height: 900 },
  301 |   ] as const) {
  302 |     test.describe(viewport.name, () => {
  303 |       test.use({ viewport: { width: viewport.width, height: viewport.height } });
  304 | 
  305 |       for (const route of visualRoutes) {
  306 |         test(`${route.name} tab audit capture`, async ({ page }) => {
  307 |           await installPhase09Clock(page);
  308 |           await stubVisualApi(page);
  309 |           if (route.path === ROUTES.LOGIN) {
  310 |             await page.goto(route.path);
  311 |           } else {
  312 |             await login(page);
  313 |             if (route.path !== ROUTES.DASHBOARD) {
  314 |               await page.goto(route.path);
  315 |             }
  316 |             await expect(page.locator('.ipc-app-shell')).toBeVisible();
  317 |           }
  318 | 
  319 |           await stabilizeVisuals(page);
  320 |           const auditState = process.env.TAB_AUDIT_STATE ?? 'before';
  321 |           const screenshotPath = resolve(
  322 |             process.cwd(),
  323 |             '..',
  324 |             '.planning',
  325 |             'ui-reviews',
  326 |             'tabs',
  327 |             auditState,
  328 |             viewport.name,
  329 |             `${route.name}.png`,
  330 |           );
  331 |           mkdirSync(dirname(screenshotPath), { recursive: true });
  332 |           await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  333 |         });
  334 |       }
  335 |     });
  336 |   }
  337 | });
  338 | 
  339 | test.describe('MainLayout responsive shell contract', () => {
  340 |   for (const viewport of [
  341 |     { name: '390x844', width: 390, height: 844, collapsed: true },
  342 |     { name: '768x1024', width: 768, height: 1024, collapsed: true },
  343 |     { name: '1280x900', width: 1280, height: 900, collapsed: false },
  344 |     { name: '1365x900', width: 1365, height: 900, collapsed: false },
  345 |   ] as const) {
  346 |     test(`${viewport.name} shell breakpoint`, async ({ page }) => {
  347 |       await page.setViewportSize({ width: viewport.width, height: viewport.height });
  348 |       await installPhase09Clock(page);
  349 |       await stubVisualApi(page);
  350 |       await login(page);
  351 |       await page.goto(ROUTES.WAREHOUSE);
  352 | 
  353 |       const toggle = page.getByRole('button', { name: 'Mở menu điều hướng' });
  354 |       const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  355 |       if (viewport.collapsed) {
  356 |         await expect(toggle).toBeVisible();
  357 |         await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  358 |         await expect(navigation).toBeHidden();
  359 |       } else {
  360 |         await expect(toggle).toBeHidden();
  361 |         await expect(navigation).toBeVisible();
  362 |       }
  363 | 
  364 |       await expect(page.locator('.ipc-header-context')).toContainText(phase09HeaderDate);
  365 |       expect(await page.evaluate(() =>
  366 |         document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  367 |       )).toBe(true);
  368 |     });
  369 |   }
  370 | });
  371 | 
  372 | test.describe('Phase 09 deterministic visual seam', () => {
  373 |   for (const viewport of [
  374 |     { name: '1365x900', width: 1365, height: 900 },
  375 |     { name: '1280x900', width: 1280, height: 900 },
  376 |     { name: '768x1024', width: 768, height: 1024 },
  377 |     { name: '390x844', width: 390, height: 844 },
  378 |   ] as const) {
  379 |     test.describe(viewport.name, () => {
  380 |       test.use({ viewport: { width: viewport.width, height: viewport.height } });
  381 | 
  382 |       for (const route of [
  383 |         {
  384 |           name: 'purchasing-phase09',
  385 |           path: `${ROUTES.PURCHASING}?week=${PHASE09_WEEK}&date=${PHASE09_DATE}&stage=receiving`,
  386 |         },
```