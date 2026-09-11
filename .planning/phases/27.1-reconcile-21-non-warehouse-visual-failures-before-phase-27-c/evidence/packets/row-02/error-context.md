# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> visual routes >> desktop >> weekly-menu visual baseline
- Location: tests\visual-routes.spec.ts:270:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  36610 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: weekly-menu-desktop.png

Call log:
  - Expect "toHaveScreenshot(weekly-menu-desktop.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 36610 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 36610 pixels (ratio 0.03 of all image pixels) are different.

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
          - generic [ref=e97]: Kế hoạch sản xuất
        - heading "KHSX và định lượng" [level=1] [ref=e98]
      - generic "Ngữ cảnh vận hành" [ref=e99]:
        - generic [ref=e100]:
          - img [ref=e101]
          - generic [ref=e103]: 22/7/2026
        - generic [ref=e104]:
          - img [ref=e105]
          - generic [ref=e108]: Ca trưa · Kế hoạch định lượng
        - button "Theo dõi kế hoạch tuần" [ref=e109]:
          - generic [ref=e111]: Theo dõi kế hoạch tuần
    - main [ref=e112]:
      - generic [ref=e113]:
        - generic [ref=e114]:
          - generic [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]:
                - generic [ref=e119]: Khách hàng
                - combobox [ref=e120]:
                  - generic [ref=e121]: Chọn khách hàng
                  - img: ▼
                - textbox [ref=e122]: __empty-customer__
              - generic [ref=e123]:
                - generic [ref=e125]: Tuần bắt đầu
                - generic [ref=e126]:
                  - textbox "Tuần bắt đầu" [ref=e127]:
                    - /placeholder: dd/mm/yyyy
                  - button "Mở lịch chọn ngày" [ref=e128]:
                    - img
            - generic [ref=e129]:
              - button "Chỉnh sửa thực đơn" [ref=e130] [cursor=pointer]:
                - img [ref=e131]
                - text: Chỉnh sửa thực đơn
              - button "Nhập Excel" [ref=e134] [cursor=pointer]:
                - img [ref=e135]
                - text: Nhập Excel
              - button "Xuất báo cáo gửi kho" [ref=e138] [cursor=pointer]
          - region "Cấu hình định lượng đang áp dụng" [ref=e139]:
            - generic [ref=e140]:
              - generic [ref=e141]: Định mức đang áp dụng
              - strong [ref=e142]: 25k
              - status "Đang dùng" [ref=e143]:
                - generic [ref=e145]: Đang dùng
            - generic [ref=e147]:
              - term [ref=e148]: Nguồn
              - definition [ref=e149]: Mặc định
        - generic [ref=e152]:
          - region "Mức sẵn sàng của kế hoạch tuần" [ref=e153]:
            - status [ref=e154]:
              - img [ref=e155]
              - generic [ref=e164]:
                - generic [ref=e165]: "Mức sẵn sàng:"
                - strong [ref=e166]: Chọn khách hàng để bắt đầu
                - generic [ref=e167]: ·
                - generic "Chưa xác định phạm vi thực đơn tuần." [ref=e168]
            - generic [ref=e169]:
              - 'generic "Thực đơn: Chưa có dữ liệu" [ref=e170]':
                - img [ref=e171]
                - generic [ref=e180]: Thực đơn
              - 'generic "Số lượng khách: Chưa kiểm tra" [ref=e181]':
                - img [ref=e182]
                - generic [ref=e191]: Số lượng khách
              - 'generic "BOM & định mức: Chưa kiểm tra" [ref=e192]':
                - img [ref=e193]
                - generic [ref=e202]: BOM & định mức
              - 'generic "Nhu cầu theo ngày: Chưa tính" [ref=e203]':
                - img [ref=e204]
                - generic [ref=e213]: Nhu cầu theo ngày
          - tablist "Chọn góc nhìn kế hoạch tuần" [ref=e214]:
            - tab "Kế hoạch tuần" [selected] [ref=e215] [cursor=pointer]
            - tab "Nhu cầu" [ref=e216] [cursor=pointer]
            - tab "Kế hoạch sản xuất" [ref=e217] [cursor=pointer]
            - tab "Tổng hợp mua" [ref=e218] [cursor=pointer]
            - tab "Giá vốn" [ref=e219] [cursor=pointer]
            - tab "Nguyên liệu món" [ref=e220] [cursor=pointer]
          - complementary [ref=e221]:
            - generic [ref=e222]:
              - img [ref=e224]
              - generic [ref=e226]:
                - heading "Danh mục món ăn đang trống" [level=4] [ref=e227]
                - generic [ref=e228]: Chưa có món ăn nào đang hoạt động, nên thực đơn tuần và bảng định lượng chưa thể chọn món.
          - tabpanel "Kế hoạch tuần" [ref=e230]:
            - generic [ref=e231]:
              - generic [ref=e232]:
                - heading "Bố cục menu theo file khách hàng" [level=3] [ref=e233]:
                  - img [ref=e234]
                  - generic [ref=e236]: Bố cục menu theo file khách hàng
                - status "Ngoài tuần menu (22/07/2026)" [ref=e237]:
                  - generic [ref=e239]: Ngoài tuần menu (22/07/2026)
              - region "Bảng bố cục thực đơn theo file khách hàng" [ref=e240]:
                - generic [ref=e241]: Bố cục thực đơn theo file khách hàng
                - table [ref=e242]:
                  - rowgroup [ref=e243]:
                    - row "Bố cục / dòng Thứ Hai Thứ Ba Thứ Tư Thứ Năm Thứ Sáu Thứ Bảy" [ref=e244]:
                      - columnheader "Bố cục / dòng" [ref=e245]
                      - columnheader "Thứ Hai" [ref=e246]:
                        - generic [ref=e248]: Thứ Hai
                      - columnheader "Thứ Ba" [ref=e249]:
                        - generic [ref=e251]: Thứ Ba
                      - columnheader "Thứ Tư" [ref=e252]:
                        - generic [ref=e254]: Thứ Tư
                      - columnheader "Thứ Năm" [ref=e255]:
                        - generic [ref=e257]: Thứ Năm
                      - columnheader "Thứ Sáu" [ref=e258]:
                        - generic [ref=e260]: Thứ Sáu
                      - columnheader "Thứ Bảy" [ref=e261]:
                        - generic [ref=e263]: Thứ Bảy
                  - rowgroup [ref=e264]:
                    - row "Chưa có dữ liệu thực đơn từ file cho khách hàng và tuần đang chọn." [ref=e265]:
                      - cell "Chưa có dữ liệu thực đơn từ file cho khách hàng và tuần đang chọn." [ref=e266]
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