# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> visual routes >> desktop >> admin-data visual baseline
- Location: tests\visual-routes.spec.ts:270:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 1365px by 925px, received 1365px by 1390px. 104291 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: admin-data-desktop.png

Call log:
  - Expect "toHaveScreenshot(admin-data-desktop.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 1365px by 925px, received 1365px by 1390px. 104291 pixels (ratio 0.06 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 1365px by 925px, received 1365px by 1390px. 104291 pixels (ratio 0.06 of all image pixels) are different.

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
          - generic [ref=e97]: Admin
        - heading "Quản trị dữ liệu" [level=1] [ref=e98]
      - generic "Ngữ cảnh vận hành" [ref=e99]:
        - generic [ref=e100]:
          - img [ref=e101]
          - generic [ref=e103]: 22/7/2026
        - generic [ref=e104]:
          - img [ref=e105]
          - generic [ref=e108]: Ca trưa · Quản trị dữ liệu
        - generic [ref=e111]: Chưa đồng bộ dữ liệu
    - main [ref=e112]:
      - generic [ref=e113]:
        - generic [ref=e114]:
          - generic [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]:
                - img [ref=e118]
                - text: "Phạm vi: BOM và tồn kho"
              - generic [ref=e119]: Yêu cầu có lý do điều chỉnh
            - generic [ref=e120]:
              - generic [ref=e121]:
                - button "Nhân viên" [ref=e122] [cursor=pointer]:
                  - img [ref=e123]
                  - text: Nhân viên
                - link "Về bàn điều hành" [ref=e128] [cursor=pointer]:
                  - /url: /
              - generic [ref=e129]:
                - button "BOM theo đơn giá" [ref=e130] [cursor=pointer]:
                  - img [ref=e131]
                  - text: BOM theo đơn giá
                - link "Xem KHSX/BOM" [ref=e136] [cursor=pointer]:
                  - /url: /weekly-menu
                  - img [ref=e137]
                  - text: Xem KHSX/BOM
          - generic [ref=e141]:
            - generic [ref=e142]:
              - img [ref=e144]
              - term [ref=e153]: BOM đang hiển thị
              - definition [ref=e154]: 0 dòng
            - generic [ref=e155]:
              - img [ref=e157]
              - term [ref=e166]: Mức định lượng
              - definition [ref=e167]: 25k
            - generic [ref=e168]:
              - img [ref=e170]
              - term [ref=e179]: Phạm vi
              - definition [ref=e180]: Dùng chung
            - generic [ref=e181]:
              - img [ref=e183]
              - term [ref=e192]: Kết quả kiểm tra
              - definition [ref=e193]: Chưa kiểm tra
        - generic [ref=e195]:
          - tablist "Chọn góc nhìn quản trị dữ liệu" [ref=e196]:
            - tab "BOM theo đơn giá" [selected] [ref=e197] [cursor=pointer]
            - tab "Hợp đồng" [ref=e198] [cursor=pointer]
            - tab "Dữ liệu lỗi" [ref=e199] [cursor=pointer]
            - tab "Tồn kho" [ref=e200] [cursor=pointer]
            - tab "Thống kê" [ref=e201] [cursor=pointer]
            - tab "Nhật ký thay đổi" [ref=e202] [cursor=pointer]
            - tab "Nhân viên" [ref=e203] [cursor=pointer]
          - tabpanel "BOM theo đơn giá" [ref=e204]:
            - generic [ref=e207]:
              - heading "Import BOM theo đơn giá" [level=3] [ref=e209]:
                - img [ref=e210]
                - generic [ref=e213]: Import BOM theo đơn giá
              - generic [ref=e214]:
                - generic [ref=e215]:
                  - generic [ref=e216]:
                    - generic [ref=e218]: Đơn giá BOM
                    - generic [ref=e219]:
                      - button "25k" [ref=e220]
                      - button "30k" [ref=e221]
                      - button "34k" [ref=e222]
                  - generic [ref=e223]:
                    - generic [ref=e225]: Khách hàng
                    - combobox [ref=e226]:
                      - generic [ref=e227]: BOM dùng chung
                      - img: ▼
                    - textbox [ref=e228]: __empty_bom_select__
                  - generic [ref=e229]:
                    - generic [ref=e231]: Hiệu lực từ
                    - generic [ref=e232]:
                      - textbox "dd/mm/yyyy" [ref=e233]: 22/07/2026
                      - button "Mở lịch chọn ngày" [ref=e234]:
                        - img
                  - generic [ref=e235]:
                    - generic [ref=e237]: Tải file Excel
                    - generic [ref=e238]:
                      - button "BOM thiếu" [ref=e239]:
                        - img
                        - text: BOM thiếu
                      - button "Mẫu trống" [ref=e240]:
                        - img
                        - text: Mẫu trống
                  - generic [ref=e241]:
                    - generic [ref=e243]: File import
                    - generic [ref=e244]:
                      - generic [ref=e245] [cursor=pointer]:
                        - img [ref=e246]
                        - generic [ref=e249]: Chọn file Excel
                        - button "Chọn file Excel" [ref=e250]
                      - generic [ref=e251]: Chưa chọn file (.xlsx, .csv)
                  - generic [ref=e252]:
                    - button "Kiểm tra file" [disabled]:
                      - img
                      - text: Kiểm tra file
                    - button "Nhập dữ liệu" [disabled]:
                      - img
                      - text: Nhập dữ liệu
                  - complementary [ref=e253]:
                    - generic [ref=e254]:
                      - img [ref=e256]
                      - generic [ref=e258]:
                        - heading "Cấu trúc nhập BOM mới" [level=4] [ref=e259]
                        - generic [ref=e260]: Tải BOM thiếu để nhập nhanh các món còn thiếu định lượng. Chọn file, kiểm tra bản xem trước và xử lý hết lỗi chặn trước khi nhập dữ liệu.
                - generic [ref=e261]:
                  - generic [ref=e262]:
                    - status [ref=e263]: BOM đang áp dụng
                    - generic [ref=e264]:
                      - generic [ref=e265]:
                        - generic [ref=e266]: Tìm món hoặc nguyên liệu
                        - img
                        - textbox "Tìm món hoặc nguyên liệu" [ref=e267]:
                          - /placeholder: Tìm món, nguyên liệu...
                      - button "Thêm dòng" [ref=e268]:
                        - img
                        - text: Thêm dòng
                  - tabpanel [ref=e269]:
                    - region "BOM hiện tại theo đơn giá" [ref=e270]:
                      - table [ref=e271]:
                        - rowgroup [ref=e281]:
                          - row "Món Nguyên liệu ĐVT Định lượng/suất Hao hụt Hiệu lực Trạng thái Thao tác" [ref=e282]:
                            - columnheader "Món" [ref=e283]
                            - columnheader "Nguyên liệu" [ref=e284]
                            - columnheader "ĐVT" [ref=e285]
                            - columnheader "Định lượng/suất" [ref=e286]
                            - columnheader "Hao hụt" [ref=e287]
                            - columnheader "Hiệu lực" [ref=e288]
                            - columnheader "Trạng thái" [ref=e289]
                            - columnheader "Thao tác" [ref=e290]
                        - rowgroup [ref=e291]:
                          - row "Chưa có dữ liệu để hiển thị" [ref=e292]:
                            - cell "Chưa có dữ liệu để hiển thị" [ref=e293]
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