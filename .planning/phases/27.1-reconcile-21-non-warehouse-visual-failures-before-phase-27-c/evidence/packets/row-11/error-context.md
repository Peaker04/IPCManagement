# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> visual routes >> mobile >> weekly-menu visual baseline
- Location: tests\visual-routes.spec.ts:270:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 390px by 1809px, received 390px by 1264px. 54953 pixels (ratio 0.08 of all image pixels) are different.

  Snapshot: weekly-menu-mobile.png

Call log:
  - Expect "toHaveScreenshot(weekly-menu-mobile.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 390px by 1809px, received 390px by 1264px. 54953 pixels (ratio 0.08 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 390px by 1809px, received 390px by 1264px. 54953 pixels (ratio 0.08 of all image pixels) are different.

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
          - generic [ref=e21]: Kế hoạch sản xuất
        - heading "KHSX và định lượng" [level=1] [ref=e22]
      - generic "Ngữ cảnh vận hành" [ref=e23]:
        - generic [ref=e24]:
          - img [ref=e25]
          - generic [ref=e27]: 22/7/2026
        - generic [ref=e28]:
          - img [ref=e29]
          - generic [ref=e32]: Ca trưa · Kế hoạch định lượng
        - button "Theo dõi kế hoạch tuần" [ref=e33]:
          - generic [ref=e35]: Theo dõi kế hoạch tuần
    - main [ref=e36]:
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - generic [ref=e41]:
                - generic [ref=e43]: Khách hàng
                - combobox [ref=e44]:
                  - generic [ref=e45]: Chọn khách hàng
                  - img: ▼
                - textbox [ref=e46]: __empty-customer__
              - generic [ref=e47]:
                - generic [ref=e49]: Tuần bắt đầu
                - generic [ref=e50]:
                  - textbox "Tuần bắt đầu" [ref=e51]:
                    - /placeholder: dd/mm/yyyy
                  - button "Mở lịch chọn ngày" [ref=e52]:
                    - img
            - generic [ref=e53]:
              - button "Chỉnh sửa thực đơn" [ref=e54] [cursor=pointer]:
                - img [ref=e55]
                - text: Chỉnh sửa thực đơn
              - button "Nhập Excel" [ref=e58] [cursor=pointer]:
                - img [ref=e59]
                - text: Nhập Excel
              - button "Xuất báo cáo gửi kho" [ref=e62] [cursor=pointer]
          - region "Cấu hình định lượng đang áp dụng" [ref=e63]:
            - generic [ref=e64]:
              - generic [ref=e65]: Định mức đang áp dụng
              - strong [ref=e66]: 25k
              - status "Đang dùng" [ref=e67]:
                - generic [ref=e69]: Đang dùng
            - generic [ref=e71]:
              - term [ref=e72]: Nguồn
              - definition [ref=e73]: Mặc định
        - generic [ref=e76]:
          - region "Mức sẵn sàng của kế hoạch tuần" [ref=e77]:
            - status [ref=e78]:
              - img [ref=e79]
              - generic [ref=e88]:
                - generic [ref=e89]: "Mức sẵn sàng:"
                - strong [ref=e90]: Chọn khách hàng để bắt đầu
            - generic [ref=e91]:
              - 'generic "Thực đơn: Chưa có dữ liệu" [ref=e92]':
                - img [ref=e93]
              - 'generic "Số lượng khách: Chưa kiểm tra" [ref=e102]':
                - img [ref=e103]
              - 'generic "BOM & định mức: Chưa kiểm tra" [ref=e112]':
                - img [ref=e113]
              - 'generic "Nhu cầu theo ngày: Chưa tính" [ref=e122]':
                - img [ref=e123]
          - tablist "Chọn góc nhìn kế hoạch tuần" [ref=e132]:
            - tab "Kế hoạch tuần" [selected] [ref=e133] [cursor=pointer]
            - tab "Nhu cầu" [ref=e134] [cursor=pointer]
            - tab "Kế hoạch sản xuất" [ref=e135] [cursor=pointer]
            - tab "Tổng hợp mua" [ref=e136] [cursor=pointer]
            - tab "Giá vốn" [ref=e137] [cursor=pointer]
            - tab "Nguyên liệu món" [ref=e138] [cursor=pointer]
          - complementary [ref=e139]:
            - generic [ref=e140]:
              - img [ref=e142]
              - generic [ref=e144]:
                - heading "Danh mục món ăn đang trống" [level=4] [ref=e145]
                - generic [ref=e146]: Chưa có món ăn nào đang hoạt động, nên thực đơn tuần và bảng định lượng chưa thể chọn món.
          - tabpanel "Kế hoạch tuần" [ref=e148]:
            - generic [ref=e149]:
              - generic [ref=e150]:
                - heading "Bố cục menu theo file khách hàng" [level=3] [ref=e151]:
                  - img [ref=e152]
                  - generic [ref=e154]: Bố cục menu theo file khách hàng
                - status "Ngoài tuần menu (22/07/2026)" [ref=e155]:
                  - generic [ref=e157]: Ngoài tuần menu (22/07/2026)
              - region "Bảng bố cục thực đơn theo file khách hàng" [ref=e158]:
                - generic [ref=e159]: Bố cục thực đơn theo file khách hàng
                - table [ref=e160]:
                  - rowgroup [ref=e161]:
                    - row "Bố cục / dòng Thứ Hai Thứ Ba Thứ Tư Thứ Năm Thứ Sáu Thứ Bảy" [ref=e162]:
                      - columnheader "Bố cục / dòng" [ref=e163]
                      - columnheader "Thứ Hai" [ref=e164]:
                        - generic [ref=e166]: Thứ Hai
                      - columnheader "Thứ Ba" [ref=e167]:
                        - generic [ref=e169]: Thứ Ba
                      - columnheader "Thứ Tư" [ref=e170]:
                        - generic [ref=e172]: Thứ Tư
                      - columnheader "Thứ Năm" [ref=e173]:
                        - generic [ref=e175]: Thứ Năm
                      - columnheader "Thứ Sáu" [ref=e176]:
                        - generic [ref=e178]: Thứ Sáu
                      - columnheader "Thứ Bảy" [ref=e179]:
                        - generic [ref=e181]: Thứ Bảy
                  - rowgroup [ref=e182]:
                    - row "Chưa có dữ liệu thực đơn từ file cho khách hàng và tuần đang chọn." [ref=e183]:
                      - cell "Chưa có dữ liệu thực đơn từ file cho khách hàng và tuần đang chọn." [ref=e184]
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