# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> visual routes >> mobile >> approvals visual baseline
- Location: tests\visual-routes.spec.ts:270:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 390px by 1518px, received 390px by 1545px. 54075 pixels (ratio 0.09 of all image pixels) are different.

  Snapshot: approvals-mobile.png

Call log:
  - Expect "toHaveScreenshot(approvals-mobile.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 390px by 1518px, received 390px by 1545px. 54075 pixels (ratio 0.09 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 390px by 1518px, received 390px by 1545px. 54075 pixels (ratio 0.09 of all image pixels) are different.

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
          - generic [ref=e21]: Quản lí
        - heading "Duyệt vận hành" [level=1] [ref=e22]
      - generic "Ngữ cảnh vận hành" [ref=e23]:
        - generic [ref=e24]:
          - img [ref=e25]
          - generic [ref=e27]: 22/7/2026
        - generic [ref=e28]:
          - img [ref=e29]
          - generic [ref=e32]: Ca trưa · Quản lí vận hành
        - generic [ref=e35]: Chưa đồng bộ dữ liệu
    - main [ref=e36]:
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - generic [ref=e41]:
                - img [ref=e42]
                - text: "Nguồn: Nhu cầu nguyên liệu"
              - generic [ref=e46]: "Hạn duyệt gần nhất: 09/07/2026"
            - generic [ref=e47]:
              - generic [ref=e48]:
                - button "Từ chối" [ref=e49] [cursor=pointer]
                - link "Kiểm tra kho" [ref=e50] [cursor=pointer]:
                  - /url: /warehouse
                  - img [ref=e51]
                  - text: Kiểm tra kho
              - generic [ref=e54]:
                - button "Duyệt" [ref=e55] [cursor=pointer]
                - link "Sang thu mua" [ref=e56] [cursor=pointer]:
                  - /url: /purchasing
                  - img [ref=e57]
                  - text: Sang thu mua
          - generic [ref=e61]:
            - generic [ref=e62]:
              - img [ref=e64]
              - term [ref=e66]: Trạng thái chính
              - definition [ref=e67]: Chờ duyệt
            - generic [ref=e68]:
              - img [ref=e70]
              - term [ref=e79]: Đơn mua
              - definition [ref=e80]: 0 chứng từ
            - generic [ref=e81]:
              - img [ref=e83]
              - term [ref=e85]: Nhu cầu xuất
              - definition [ref=e86]: 0 phiếu
            - generic [ref=e87]:
              - img [ref=e89]
              - term [ref=e98]: Người duyệt
              - definition [ref=e99]: Quản lí vận hành
        - generic [ref=e101]:
          - tablist "Chọn góc nhìn duyệt vận hành" [ref=e102]:
            - tab "Cần duyệt" [selected] [ref=e103] [cursor=pointer]
            - tab "Lịch sử" [ref=e104] [cursor=pointer]
          - tabpanel "Cần duyệt" [ref=e106]:
            - region "Đối soát điều chỉnh thực đơn" [ref=e107]:
              - generic [ref=e108]:
                - generic [ref=e109]:
                  - heading "Đối soát điều chỉnh thực đơn" [level=2] [ref=e110]
                  - paragraph [ref=e111]: Xử lý các thay đổi đã liên quan đến chứng từ vận hành.
                - generic [ref=e112]:
                  - text: Khách hàng
                  - combobox "Khách hàng" [ref=e113]:
                    - option "Chọn khách hàng" [selected]
                    - option "Tất cả khách hàng"
              - paragraph [ref=e114]: Chọn khách hàng để xem yêu cầu cần xử lý.
            - generic [ref=e115]:
              - generic [ref=e117]:
                - heading "Danh sách cần duyệt" [level=3] [ref=e119]:
                  - img [ref=e120]
                  - generic [ref=e124]: Danh sách cần duyệt
                - generic [ref=e125]:
                  - generic [ref=e126]:
                    - text: Tìm chứng từ hoặc nguyên liệu
                    - textbox "Tìm chứng từ hoặc nguyên liệu" [ref=e127]:
                      - /placeholder: Mã phiếu, nhà cung cấp, nguyên liệu...
                  - paragraph [ref=e128]: "Phạm vi: Tất cả ngày đang chờ duyệt"
                - generic [ref=e129]:
                  - generic "Hàng đợi duyệt đã cập nhật" [ref=e130]:
                    - region "Hàng đợi duyệt vận hành" [ref=e131]:
                      - article [ref=e132]:
                        - generic [ref=e133]:
                          - strong [ref=e134]: Duyệt đơn mua
                          - paragraph [ref=e135]: PR-20260709-M
                          - generic "Thao tác cho Duyệt đơn mua" [ref=e136]:
                            - button "Duyệt chứng từ" [ref=e137]
                            - button "Từ chối chứng từ" [ref=e138]
                        - generic [ref=e139]:
                          - status "Chờ duyệt" [ref=e140]:
                            - generic [ref=e142]: Chờ duyệt
                          - paragraph [ref=e143]: Đơn mua đã gửi, chờ duyệt trước khi mua hàng.
                        - generic [ref=e144]:
                          - generic [ref=e145]:
                            - term [ref=e146]: "Gửi bởi:"
                            - definition [ref=e147]: Điều phối ca sáng
                          - generic [ref=e148]:
                            - term [ref=e149]: "Hạn:"
                            - definition [ref=e150]: 09/07/2026
                          - generic [ref=e151]:
                            - term [ref=e152]: "Người phụ trách:"
                            - definition [ref=e153]: Thu mua / Quản lý
                        - list [ref=e155]:
                          - listitem [ref=e156]:
                            - generic [ref=e157]: Sườn heo
                            - strong [ref=e158]: 15 kg
                  - navigation "Phân trang hàng đợi duyệt" [ref=e159]:
                    - generic [ref=e160]: Đã tải hết dữ liệu
                    - generic [ref=e161]:
                      - button "Trang trước" [disabled] [ref=e162]:
                        - img [ref=e163]
                      - generic [ref=e165]: Trang 1
                      - button "Trang sau" [disabled] [ref=e166]:
                        - img [ref=e167]
              - complementary "Chứng từ" [ref=e169]:
                - generic [ref=e170]: Chứng từ
                - generic [ref=e172]:
                  - img [ref=e174]
                  - paragraph [ref=e177]: Chưa có dữ liệu để hiển thị
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