# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> visual routes >> desktop >> dashboard visual baseline
- Location: tests\visual-routes.spec.ts:270:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 1365px by 1125px, received 1365px by 1148px. 46654 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: dashboard-desktop.png

Call log:
  - Expect "toHaveScreenshot(dashboard-desktop.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 1365px by 1125px, received 1365px by 1148px. 46654 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 1365px by 1125px, received 1365px by 1148px. 46654 pixels (ratio 0.03 of all image pixels) are different.

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
        - link "Tổng quan" [ref=e95] [cursor=pointer]:
          - /url: /
        - heading "Bàn điều hành hôm nay" [level=1] [ref=e96]
      - generic "Ngữ cảnh vận hành" [ref=e97]:
        - generic [ref=e98]:
          - img [ref=e99]
          - generic [ref=e101]: 22/7/2026
        - generic [ref=e102]:
          - img [ref=e103]
          - generic [ref=e106]: Ca trưa · Điều phối ca
        - generic [ref=e109]: Theo dõi điểm tắc
    - main [ref=e110]:
      - generic [ref=e111]:
        - generic [ref=e113]:
          - generic [ref=e116]: Ngày phục vụ hôm nay · Ca đang vận hành
          - generic [ref=e117]:
            - link "Mở điều phối ca" [ref=e118] [cursor=pointer]:
              - /url: /meal-orders
            - link "Hàng đợi duyệt" [ref=e119] [cursor=pointer]:
              - /url: /approvals
            - link "Kiểm dữ liệu" [ref=e120] [cursor=pointer]:
              - /url: /admin-data
        - generic [ref=e123]:
          - region "Tổng quan ca hôm nay" [ref=e124]:
            - heading "Tổng quan ca hôm nay" [level=2] [ref=e127]
            - generic [ref=e128]:
              - generic [ref=e129]:
                - generic [ref=e130]: Cần xử lý
                - strong [ref=e131]: "5"
              - generic [ref=e132]:
                - generic [ref=e133]: Đang chờ
                - strong [ref=e134]: "2"
              - generic [ref=e135]:
                - generic [ref=e136]: Điểm tắc
                - strong [ref=e137]: "3"
          - region "Tín hiệu vận hành" [ref=e138]:
            - generic [ref=e139]:
              - link "Thiếu / tồn thấp 1 2 tồn thấp" [ref=e140] [cursor=pointer]:
                - /url: /reports?view=demand
                - generic [ref=e141]:
                  - generic [ref=e142]: Thiếu / tồn thấp
                  - strong [ref=e143]: "1"
                  - generic [ref=e144]: 2 tồn thấp
              - link "Thu mua trễ 1 1 PR / 0 receipt" [ref=e145] [cursor=pointer]:
                - /url: /reports?view=purchase
                - generic [ref=e146]:
                  - generic [ref=e147]: Thu mua trễ
                  - strong [ref=e148]: "1"
                  - generic [ref=e149]: 1 PR / 0 receipt
              - link "Bếp chờ xác nhận 1 Issue chưa nhận bếp" [ref=e150] [cursor=pointer]:
                - /url: /reports?view=kitchen
                - generic [ref=e151]:
                  - generic [ref=e152]: Bếp chờ xác nhận
                  - strong [ref=e153]: "1"
                  - generic [ref=e154]: Issue chưa nhận bếp
              - link "Dữ liệu chặn luồng 1 1 lỗi dữ liệu" [ref=e155] [cursor=pointer]:
                - /url: /admin-data?view=cleanup
                - generic [ref=e156]:
                  - generic [ref=e157]: Dữ liệu chặn luồng
                  - strong [ref=e158]: "1"
                  - generic [ref=e159]: 1 lỗi dữ liệu
              - link "Duyệt quá hạn 1 Cần quản lý xử lý" [ref=e160] [cursor=pointer]:
                - /url: /approvals
                - generic [ref=e161]:
                  - generic [ref=e162]: Duyệt quá hạn
                  - strong [ref=e163]: "1"
                  - generic [ref=e164]: Cần quản lý xử lý
          - generic [ref=e165]:
            - generic [ref=e166]:
              - generic [ref=e167]:
                - heading "Việc cần xử lý trước" [level=3] [ref=e169]
                - link "Xem toàn bộ" [ref=e170] [cursor=pointer]:
                  - /url: /approvals
              - group "Lọc hàng đợi xử lý" [ref=e171]:
                - button "Tất cả" [pressed] [ref=e172] [cursor=pointer]
                - button "Chặn bếp 1" [ref=e173] [cursor=pointer]:
                  - text: Chặn bếp
                  - generic [ref=e174]: "1"
                - button "Thu mua 2" [ref=e175] [cursor=pointer]:
                  - text: Thu mua
                  - generic [ref=e176]: "2"
                - button "Dữ liệu 2" [ref=e177] [cursor=pointer]:
                  - text: Dữ liệu
                  - generic [ref=e178]: "2"
              - generic [ref=e179]:
                - link "Thiếu hoặc tồn thấp nguyên liệu Mở kế hoạch mua Phụ trách Thu mua Thời hạn Trước đặt hàng" [ref=e180] [cursor=pointer]:
                  - /url: /reports?view=demand
                  - generic [ref=e181]:
                    - strong [ref=e182]: Thiếu hoặc tồn thấp nguyên liệu
                    - generic [ref=e183]: Mở kế hoạch mua
                  - generic [ref=e184]:
                    - generic [ref=e185]: Phụ trách
                    - strong [ref=e186]: Thu mua
                  - generic [ref=e187]:
                    - generic [ref=e188]: Thời hạn
                    - strong [ref=e189]: Trước đặt hàng
                - link "Dữ liệu đang chặn luồng 0 workflow lỗi / 1 lỗi dữ liệu Phụ trách Admin Thời hạn Trước gửi bếp" [ref=e190] [cursor=pointer]:
                  - /url: /admin-data?view=cleanup
                  - generic [ref=e191]:
                    - strong [ref=e192]: Dữ liệu đang chặn luồng
                    - generic [ref=e193]: 0 workflow lỗi / 1 lỗi dữ liệu
                  - generic [ref=e194]:
                    - generic [ref=e195]: Phụ trách
                    - strong [ref=e196]: Admin
                  - generic [ref=e197]:
                    - generic [ref=e198]: Thời hạn
                    - strong [ref=e199]: Trước gửi bếp
                - link "Thiếu Sườn heo Cần 18 kg, hiện có 3 kg. Phụ trách KHSX Thời hạn Sau kiểm tồn" [ref=e200] [cursor=pointer]:
                  - /url: /weekly-menu
                  - generic [ref=e201]:
                    - strong [ref=e202]: Thiếu Sườn heo
                    - generic [ref=e203]: Cần 18 kg, hiện có 3 kg.
                  - generic [ref=e204]:
                    - generic [ref=e205]: Phụ trách
                    - strong [ref=e206]: KHSX
                  - generic [ref=e207]:
                    - generic [ref=e208]: Thời hạn
                    - strong [ref=e209]: Sau kiểm tồn
                - link "Sườn heo vượt ngưỡng giá Tăng 16,5% tại Nhà cung cấp A. Phụ trách Thu mua Thời hạn Trước khi đặt hàng" [ref=e210] [cursor=pointer]:
                  - /url: /purchasing
                  - generic [ref=e211]:
                    - strong [ref=e212]: Sườn heo vượt ngưỡng giá
                    - generic [ref=e213]: Tăng 16,5% tại Nhà cung cấp A.
                  - generic [ref=e214]:
                    - generic [ref=e215]: Phụ trách
                    - strong [ref=e216]: Thu mua
                  - generic [ref=e217]:
                    - generic [ref=e218]: Thời hạn
                    - strong [ref=e219]: Trước khi đặt hàng
                - link "Bếp chờ xác nhận nguyên liệu 1 issue chưa được xác nhận Phụ trách Bếp trưởng Thời hạn Trong ca" [ref=e220] [cursor=pointer]:
                  - /url: /chef-dashboard
                  - generic [ref=e221]:
                    - strong [ref=e222]: Bếp chờ xác nhận nguyên liệu
                    - generic [ref=e223]: 1 issue chưa được xác nhận
                  - generic [ref=e224]:
                    - generic [ref=e225]: Phụ trách
                    - strong [ref=e226]: Bếp trưởng
                  - generic [ref=e227]:
                    - generic [ref=e228]: Thời hạn
                    - strong [ref=e229]: Trong ca
            - generic [ref=e230]:
              - generic [ref=e231]:
                - heading "Tiến độ 4 công đoạn" [level=3] [ref=e233]
                - link "Xem KHSX" [ref=e234] [cursor=pointer]:
                  - /url: /weekly-menu
              - generic [ref=e235]:
                - link "01 Menu & số suất Điều phối chốt menu, khách và ca phục vụ. Theo dõi công đoạn" [ref=e236] [cursor=pointer]:
                  - /url: /meal-orders
                  - generic [ref=e237]: "01"
                  - generic [ref=e238]:
                    - strong [ref=e239]: Menu & số suất
                    - generic [ref=e240]: Điều phối chốt menu, khách và ca phục vụ.
                  - generic [ref=e242]: Theo dõi công đoạn
                - link "02 Định lượng BOM KHSX kiểm mức BOM, định lượng và tồn kho. Đề xuất mua thêm" [ref=e243] [cursor=pointer]:
                  - /url: /weekly-menu
                  - generic [ref=e244]: "02"
                  - generic [ref=e245]:
                    - strong [ref=e246]: Định lượng BOM
                    - generic [ref=e247]: KHSX kiểm mức BOM, định lượng và tồn kho.
                  - generic [ref=e249]: Đề xuất mua thêm
                - link "03 Duyệt & thu mua Quản lý duyệt, thu mua chọn NCC và theo receipt. Gửi cảnh báo biến động giá" [ref=e250] [cursor=pointer]:
                  - /url: /purchasing
                  - generic [ref=e251]: "03"
                  - generic [ref=e252]:
                    - strong [ref=e253]: Duyệt & thu mua
                    - generic [ref=e254]: Quản lý duyệt, thu mua chọn NCC và theo receipt.
                  - generic [ref=e256]: Gửi cảnh báo biến động giá
                - link "04 Kho & bếp Thủ kho xuất nguyên liệu, bếp xác nhận nhận hàng. Theo dõi công đoạn" [ref=e257] [cursor=pointer]:
                  - /url: /warehouse
                  - generic [ref=e258]: "04"
                  - generic [ref=e259]:
                    - strong [ref=e260]: Kho & bếp
                    - generic [ref=e261]: Thủ kho xuất nguyên liệu, bếp xác nhận nhận hàng.
                  - generic [ref=e263]: Theo dõi công đoạn
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