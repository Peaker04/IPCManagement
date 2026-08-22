# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> visual routes >> mobile >> admin-data visual baseline
- Location: tests\visual-routes.spec.ts:270:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 390px by 2040px, received 390px by 1805px. 111971 pixels (ratio 0.15 of all image pixels) are different.

  Snapshot: admin-data-mobile.png

Call log:
  - Expect "toHaveScreenshot(admin-data-mobile.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 390px by 2040px, received 390px by 1805px. 111971 pixels (ratio 0.15 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 390px by 2040px, received 390px by 1805px. 111971 pixels (ratio 0.15 of all image pixels) are different.

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
      - button "Mở menu điều hướng" [ref=e13]:
        - img [ref=e14]
  - generic [ref=e15]:
    - banner [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]:
          - link "Tổng quan" [ref=e19] [cursor=pointer]:
            - /url: /
          - generic [ref=e20]: /
          - generic [ref=e21]: Admin
        - heading "Quản trị dữ liệu" [level=1] [ref=e22]
      - generic "Ngữ cảnh vận hành" [ref=e23]:
        - generic [ref=e24]:
          - img [ref=e25]
          - generic [ref=e27]: 22/7/2026
        - generic [ref=e28]:
          - img [ref=e29]
          - generic [ref=e32]: Ca trưa · Quản trị dữ liệu
        - generic [ref=e35]: Chưa đồng bộ dữ liệu
    - main [ref=e36]:
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - generic [ref=e41]:
                - img [ref=e42]
                - text: "Phạm vi: BOM và tồn kho"
              - generic [ref=e43]: Yêu cầu có lý do điều chỉnh
            - generic [ref=e44]:
              - generic [ref=e45]:
                - button "Nhân viên" [ref=e46] [cursor=pointer]:
                  - img [ref=e47]
                  - text: Nhân viên
                - link "Về bàn điều hành" [ref=e52] [cursor=pointer]:
                  - /url: /
              - generic [ref=e53]:
                - button "BOM theo đơn giá" [ref=e54] [cursor=pointer]:
                  - img [ref=e55]
                  - text: BOM theo đơn giá
                - link "Xem KHSX/BOM" [ref=e60] [cursor=pointer]:
                  - /url: /weekly-menu
                  - img [ref=e61]
                  - text: Xem KHSX/BOM
          - generic [ref=e65]:
            - generic [ref=e66]:
              - img [ref=e68]
              - term [ref=e77]: BOM đang hiển thị
              - definition [ref=e78]: 0 dòng
            - generic [ref=e79]:
              - img [ref=e81]
              - term [ref=e90]: Mức định lượng
              - definition [ref=e91]: 25k
            - generic [ref=e92]:
              - img [ref=e94]
              - term [ref=e103]: Phạm vi
              - definition [ref=e104]: Dùng chung
            - generic [ref=e105]:
              - img [ref=e107]
              - term [ref=e116]: Kết quả kiểm tra
              - definition [ref=e117]: Chưa kiểm tra
        - generic [ref=e119]:
          - tablist "Chọn góc nhìn quản trị dữ liệu" [ref=e120]:
            - tab "BOM theo đơn giá" [selected] [ref=e121] [cursor=pointer]
            - tab "Hợp đồng" [ref=e122] [cursor=pointer]
            - tab "Dữ liệu lỗi" [ref=e123] [cursor=pointer]
            - tab "Tồn kho" [ref=e124] [cursor=pointer]
            - tab "Thống kê" [ref=e125] [cursor=pointer]
            - tab "Nhật ký thay đổi" [ref=e126] [cursor=pointer]
            - tab "Nhân viên" [ref=e127] [cursor=pointer]
          - tabpanel "BOM theo đơn giá" [ref=e128]:
            - generic [ref=e131]:
              - heading "Import BOM theo đơn giá" [level=3] [ref=e133]:
                - img [ref=e134]
                - generic [ref=e137]: Import BOM theo đơn giá
              - generic [ref=e138]:
                - generic [ref=e139]:
                  - generic [ref=e140]:
                    - generic [ref=e142]: Đơn giá BOM
                    - generic [ref=e143]:
                      - button "25k" [ref=e144]
                      - button "30k" [ref=e145]
                      - button "34k" [ref=e146]
                  - generic [ref=e147]:
                    - generic [ref=e149]: Khách hàng
                    - combobox [ref=e150]:
                      - generic [ref=e151]: BOM dùng chung
                      - img: ▼
                    - textbox [ref=e152]: __empty_bom_select__
                  - generic [ref=e153]:
                    - generic [ref=e155]: Hiệu lực từ
                    - generic [ref=e156]:
                      - textbox "dd/mm/yyyy" [ref=e157]: 22/07/2026
                      - button "Mở lịch chọn ngày" [ref=e158]:
                        - img
                  - generic [ref=e159]:
                    - generic [ref=e161]: Tải file Excel
                    - generic [ref=e162]:
                      - button "BOM thiếu" [ref=e163]:
                        - img
                        - text: BOM thiếu
                      - button "Mẫu trống" [ref=e164]:
                        - img
                        - text: Mẫu trống
                  - generic [ref=e165]:
                    - generic [ref=e167]: File import
                    - generic [ref=e168]:
                      - generic [ref=e169] [cursor=pointer]:
                        - img [ref=e170]
                        - generic [ref=e173]: Chọn file Excel
                        - button "Chọn file Excel" [ref=e174]
                      - generic [ref=e175]: Chưa chọn file (.xlsx, .csv)
                  - generic [ref=e176]:
                    - button "Kiểm tra file" [disabled]:
                      - img
                      - text: Kiểm tra file
                    - button "Nhập dữ liệu" [disabled]:
                      - img
                      - text: Nhập dữ liệu
                  - complementary [ref=e177]:
                    - generic [ref=e178]:
                      - img [ref=e180]
                      - generic [ref=e182]:
                        - heading "Cấu trúc nhập BOM mới" [level=4] [ref=e183]
                        - generic [ref=e184]: Tải BOM thiếu để nhập nhanh các món còn thiếu định lượng. Chọn file, kiểm tra bản xem trước và xử lý hết lỗi chặn trước khi nhập dữ liệu.
                - generic [ref=e185]:
                  - generic [ref=e186]:
                    - status [ref=e187]: BOM đang áp dụng
                    - generic [ref=e188]:
                      - generic [ref=e189]:
                        - generic [ref=e190]: Tìm món hoặc nguyên liệu
                        - img
                        - textbox "Tìm món hoặc nguyên liệu" [ref=e191]:
                          - /placeholder: Tìm món, nguyên liệu...
                      - button "Thêm dòng" [ref=e192]:
                        - img
                        - text: Thêm dòng
                  - tabpanel [ref=e193]:
                    - region "BOM hiện tại theo đơn giá" [ref=e194]:
                      - table [ref=e195]:
                        - rowgroup [ref=e205]:
                          - row "Món Nguyên liệu ĐVT Định lượng/suất Hao hụt Hiệu lực Trạng thái Thao tác" [ref=e206]:
                            - columnheader "Món" [ref=e207]
                            - columnheader "Nguyên liệu" [ref=e208]
                            - columnheader "ĐVT" [ref=e209]
                            - columnheader "Định lượng/suất" [ref=e210]
                            - columnheader "Hao hụt" [ref=e211]
                            - columnheader "Hiệu lực" [ref=e212]
                            - columnheader "Trạng thái" [ref=e213]
                            - columnheader "Thao tác" [ref=e214]
                        - rowgroup [ref=e215]:
                          - row "Chưa có dữ liệu để hiển thị" [ref=e216]:
                            - cell "Chưa có dữ liệu để hiển thị" [ref=e217]
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