# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> visual routes >> mobile >> dashboard visual baseline
- Location: tests\visual-routes.spec.ts:270:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 390px by 3443px, received 390px by 2375px. 74452 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: dashboard-mobile.png

Call log:
  - Expect "toHaveScreenshot(dashboard-mobile.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 390px by 3443px, received 390px by 2375px. 74452 pixels (ratio 0.06 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 390px by 3443px, received 390px by 2375px. 74452 pixels (ratio 0.06 of all image pixels) are different.

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
        - link "Tổng quan" [ref=e19] [cursor=pointer]:
          - /url: /
        - heading "Bàn điều hành hôm nay" [level=1] [ref=e20]
      - generic "Ngữ cảnh vận hành" [ref=e21]:
        - generic [ref=e22]:
          - img [ref=e23]
          - generic [ref=e25]: 22/7/2026
        - generic [ref=e26]:
          - img [ref=e27]
          - generic [ref=e30]: Ca trưa · Điều phối ca
        - generic [ref=e33]: Theo dõi điểm tắc
    - main [ref=e34]:
      - generic [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e40]: Ngày phục vụ hôm nay · Ca đang vận hành
          - generic [ref=e41]:
            - link "Mở điều phối ca" [ref=e42] [cursor=pointer]:
              - /url: /meal-orders
            - link "Hàng đợi duyệt" [ref=e43] [cursor=pointer]:
              - /url: /approvals
            - link "Kiểm dữ liệu" [ref=e44] [cursor=pointer]:
              - /url: /admin-data
        - generic [ref=e47]:
          - region "Tổng quan ca hôm nay" [ref=e48]:
            - heading "Tổng quan ca hôm nay" [level=2] [ref=e51]
            - generic [ref=e52]:
              - generic [ref=e53]:
                - generic [ref=e54]: Cần xử lý
                - strong [ref=e55]: "5"
              - generic [ref=e56]:
                - generic [ref=e57]: Đang chờ
                - strong [ref=e58]: "2"
              - generic [ref=e59]:
                - generic [ref=e60]: Điểm tắc
                - strong [ref=e61]: "3"
          - region "Tín hiệu vận hành" [ref=e62]:
            - generic [ref=e63]:
              - link "Thiếu / tồn thấp 1 2 tồn thấp" [ref=e64] [cursor=pointer]:
                - /url: /reports?view=demand
                - generic [ref=e65]:
                  - generic [ref=e66]: Thiếu / tồn thấp
                  - strong [ref=e67]: "1"
                  - generic [ref=e68]: 2 tồn thấp
              - link "Thu mua trễ 1 1 PR / 0 receipt" [ref=e69] [cursor=pointer]:
                - /url: /reports?view=purchase
                - generic [ref=e70]:
                  - generic [ref=e71]: Thu mua trễ
                  - strong [ref=e72]: "1"
                  - generic [ref=e73]: 1 PR / 0 receipt
              - link "Bếp chờ xác nhận 1 Issue chưa nhận bếp" [ref=e74] [cursor=pointer]:
                - /url: /reports?view=kitchen
                - generic [ref=e75]:
                  - generic [ref=e76]: Bếp chờ xác nhận
                  - strong [ref=e77]: "1"
                  - generic [ref=e78]: Issue chưa nhận bếp
              - link "Dữ liệu chặn luồng 1 1 lỗi dữ liệu" [ref=e79] [cursor=pointer]:
                - /url: /admin-data?view=cleanup
                - generic [ref=e80]:
                  - generic [ref=e81]: Dữ liệu chặn luồng
                  - strong [ref=e82]: "1"
                  - generic [ref=e83]: 1 lỗi dữ liệu
              - link "Duyệt quá hạn 1 Cần quản lý xử lý" [ref=e84] [cursor=pointer]:
                - /url: /approvals
                - generic [ref=e85]:
                  - generic [ref=e86]: Duyệt quá hạn
                  - strong [ref=e87]: "1"
                  - generic [ref=e88]: Cần quản lý xử lý
          - generic [ref=e89]:
            - generic [ref=e90]:
              - generic [ref=e91]:
                - heading "Việc cần xử lý trước" [level=3] [ref=e93]
                - link "Xem toàn bộ" [ref=e94] [cursor=pointer]:
                  - /url: /approvals
              - group "Lọc hàng đợi xử lý" [ref=e95]:
                - button "Tất cả" [pressed] [ref=e96] [cursor=pointer]
                - button "Chặn bếp 1" [ref=e97] [cursor=pointer]:
                  - text: Chặn bếp
                  - generic [ref=e98]: "1"
                - button "Thu mua 2" [ref=e99] [cursor=pointer]:
                  - text: Thu mua
                  - generic [ref=e100]: "2"
                - button "Dữ liệu 2" [ref=e101] [cursor=pointer]:
                  - text: Dữ liệu
                  - generic [ref=e102]: "2"
              - generic [ref=e103]:
                - link "Thiếu hoặc tồn thấp nguyên liệu Mở kế hoạch mua Phụ tráchThu mua Thời hạnTrước đặt hàng" [ref=e104] [cursor=pointer]:
                  - /url: /reports?view=demand
                  - generic [ref=e105]:
                    - strong [ref=e106]: Thiếu hoặc tồn thấp nguyên liệu
                    - generic [ref=e107]: Mở kế hoạch mua
                  - generic [ref=e108]:
                    - text: Phụ trách
                    - strong [ref=e109]: Thu mua
                  - generic [ref=e110]:
                    - text: Thời hạn
                    - strong [ref=e111]: Trước đặt hàng
                - link "Dữ liệu đang chặn luồng 0 workflow lỗi / 1 lỗi dữ liệu Phụ tráchAdmin Thời hạnTrước gửi bếp" [ref=e112] [cursor=pointer]:
                  - /url: /admin-data?view=cleanup
                  - generic [ref=e113]:
                    - strong [ref=e114]: Dữ liệu đang chặn luồng
                    - generic [ref=e115]: 0 workflow lỗi / 1 lỗi dữ liệu
                  - generic [ref=e116]:
                    - text: Phụ trách
                    - strong [ref=e117]: Admin
                  - generic [ref=e118]:
                    - text: Thời hạn
                    - strong [ref=e119]: Trước gửi bếp
                - link "Thiếu Sườn heo Cần 18 kg, hiện có 3 kg. Phụ tráchKHSX Thời hạnSau kiểm tồn" [ref=e120] [cursor=pointer]:
                  - /url: /weekly-menu
                  - generic [ref=e121]:
                    - strong [ref=e122]: Thiếu Sườn heo
                    - generic [ref=e123]: Cần 18 kg, hiện có 3 kg.
                  - generic [ref=e124]:
                    - text: Phụ trách
                    - strong [ref=e125]: KHSX
                  - generic [ref=e126]:
                    - text: Thời hạn
                    - strong [ref=e127]: Sau kiểm tồn
                - link "Sườn heo vượt ngưỡng giá Tăng 16,5% tại Nhà cung cấp A. Phụ tráchThu mua Thời hạnTrước khi đặt hàng" [ref=e128] [cursor=pointer]:
                  - /url: /purchasing
                  - generic [ref=e129]:
                    - strong [ref=e130]: Sườn heo vượt ngưỡng giá
                    - generic [ref=e131]: Tăng 16,5% tại Nhà cung cấp A.
                  - generic [ref=e132]:
                    - text: Phụ trách
                    - strong [ref=e133]: Thu mua
                  - generic [ref=e134]:
                    - text: Thời hạn
                    - strong [ref=e135]: Trước khi đặt hàng
                - link "Bếp chờ xác nhận nguyên liệu 1 issue chưa được xác nhận Phụ tráchBếp trưởng Thời hạnTrong ca" [ref=e136] [cursor=pointer]:
                  - /url: /chef-dashboard
                  - generic [ref=e137]:
                    - strong [ref=e138]: Bếp chờ xác nhận nguyên liệu
                    - generic [ref=e139]: 1 issue chưa được xác nhận
                  - generic [ref=e140]:
                    - text: Phụ trách
                    - strong [ref=e141]: Bếp trưởng
                  - generic [ref=e142]:
                    - text: Thời hạn
                    - strong [ref=e143]: Trong ca
            - generic [ref=e144]:
              - generic [ref=e145]:
                - heading "Tiến độ 4 công đoạn" [level=3] [ref=e147]
                - link "Xem KHSX" [ref=e148] [cursor=pointer]:
                  - /url: /weekly-menu
              - generic [ref=e149]:
                - link "Menu & số suất Điều phối chốt menu, khách và ca phục vụ. Theo dõi công đoạn" [ref=e150] [cursor=pointer]:
                  - /url: /meal-orders
                  - generic [ref=e151]:
                    - strong [ref=e152]: Menu & số suất
                    - generic [ref=e153]: Điều phối chốt menu, khách và ca phục vụ.
                  - generic [ref=e154]: Theo dõi công đoạn
                - link "Định lượng BOM KHSX kiểm mức BOM, định lượng và tồn kho. Đề xuất mua thêm" [ref=e155] [cursor=pointer]:
                  - /url: /weekly-menu
                  - generic [ref=e156]:
                    - strong [ref=e157]: Định lượng BOM
                    - generic [ref=e158]: KHSX kiểm mức BOM, định lượng và tồn kho.
                  - generic [ref=e159]: Đề xuất mua thêm
                - link "Duyệt & thu mua Quản lý duyệt, thu mua chọn NCC và theo receipt. Gửi cảnh báo biến động giá" [ref=e160] [cursor=pointer]:
                  - /url: /purchasing
                  - generic [ref=e161]:
                    - strong [ref=e162]: Duyệt & thu mua
                    - generic [ref=e163]: Quản lý duyệt, thu mua chọn NCC và theo receipt.
                  - generic [ref=e164]: Gửi cảnh báo biến động giá
                - link "Kho & bếp Thủ kho xuất nguyên liệu, bếp xác nhận nhận hàng. Theo dõi công đoạn" [ref=e165] [cursor=pointer]:
                  - /url: /warehouse
                  - generic [ref=e166]:
                    - strong [ref=e167]: Kho & bếp
                    - generic [ref=e168]: Thủ kho xuất nguyên liệu, bếp xác nhận nhận hàng.
                  - generic [ref=e169]: Theo dõi công đoạn
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