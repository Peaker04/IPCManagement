# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> Phase 09 deterministic visual seam >> 768x1024 >> purchasing-phase09 visual baseline
- Location: tests\visual-routes.spec.ts:392:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  47087 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: purchasing-phase09-768x1024.png

Call log:
  - Expect "toHaveScreenshot(purchasing-phase09-768x1024.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 47087 pixels (ratio 0.06 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 47087 pixels (ratio 0.06 of all image pixels) are different.

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
          - generic [ref=e21]: Thu mua
        - heading "Thu mua" [level=1] [ref=e22]
      - generic "Ngữ cảnh vận hành" [ref=e23]:
        - generic [ref=e24]:
          - img [ref=e25]
          - generic [ref=e27]: 22/7/2026
        - generic [ref=e28]:
          - img [ref=e29]
          - generic [ref=e32]: Ca trưa · Nhân sự thu mua
        - generic [ref=e35]: Chưa đồng bộ dữ liệu
    - main [ref=e36]:
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - generic [ref=e41]:
                - img [ref=e42]
                - text: "Tuần mua hàng: 20/07/2026 - 26/07/2026"
              - generic [ref=e46]:
                - img [ref=e47]
                - text: Cả ngày (FULLDAY)
            - generic [ref=e50]:
              - button "Tuần trước" [ref=e51]:
                - img
              - button "Tuần hiện tại" [ref=e52]:
                - img
                - text: Tuần hiện tại
              - button "Tuần sau" [ref=e53]:
                - img
              - button "Mở màn hình nhập kho" [ref=e54]
          - generic [ref=e55]:
            - generic [ref=e56]:
              - img [ref=e58]
              - term [ref=e60]: Ngày cần xử lý
              - definition [ref=e61]: "1"
            - generic [ref=e62]:
              - img [ref=e64]
              - term [ref=e73]: Nhu cầu chờ duyệt
              - definition [ref=e74]: "0"
            - generic [ref=e75]:
              - img [ref=e77]
              - term [ref=e86]: Ngoại lệ giá
              - definition [ref=e87]: "0"
            - generic [ref=e88]:
              - img [ref=e90]
              - term [ref=e92]: Đơn chờ nhập
              - definition [ref=e93]: "1"
        - generic [ref=e96]:
          - generic [ref=e97]:
            - generic [ref=e98]:
              - heading "Thu mua theo nhu cầu đã duyệt" [level=1] [ref=e99]
              - paragraph [ref=e100]: Một luồng sáu giai đoạn từ nhu cầu đã duyệt đến tiến độ nhập kho.
            - status "Đã đồng bộ" [ref=e101]:
              - generic [ref=e103]: Đã đồng bộ
          - tablist "Chọn góc nhìn thu mua" [ref=e104]:
            - tab "Xử lý thu mua" [selected] [ref=e105] [cursor=pointer]
            - tab "Mua bổ sung" [ref=e106] [cursor=pointer]
            - tab "Báo giá nhà cung cấp" [ref=e107] [cursor=pointer]
          - tabpanel "Xử lý thu mua" [ref=e110]:
            - navigation "Sáu giai đoạn thu mua" [ref=e111]:
              - list [ref=e112]:
                - listitem [ref=e113]:
                  - button "Nhu cầu đã duyệt Hoàn tất, 1 ngày" [ref=e114]:
                    - generic [ref=e116]:
                      - img
                    - generic [ref=e117]:
                      - generic [ref=e118]: Nhu cầu đã duyệt
                      - generic [ref=e119]: Hoàn tất, 1 ngày
                - listitem [ref=e120]:
                  - button "Chọn nhà cung cấp và giá Hoàn tất, 1 ngày" [ref=e121]:
                    - generic [ref=e123]:
                      - img
                    - generic [ref=e124]:
                      - generic [ref=e125]: Chọn nhà cung cấp và giá
                      - generic [ref=e126]: Hoàn tất, 1 ngày
                - listitem [ref=e127]:
                  - button "Xử lý ngoại lệ giá Hoàn tất" [ref=e128]:
                    - generic [ref=e130]:
                      - img
                    - generic [ref=e131]:
                      - generic [ref=e132]: Xử lý ngoại lệ giá
                      - generic [ref=e133]: Hoàn tất
                - listitem [ref=e134]:
                  - button "Gửi đề xuất mua Hoàn tất, 1 ngày" [ref=e135]:
                    - generic [ref=e137]:
                      - img
                    - generic [ref=e138]:
                      - generic [ref=e139]: Gửi đề xuất mua
                      - generic [ref=e140]: Hoàn tất, 1 ngày
                - listitem [ref=e141]:
                  - button "Duyệt và tạo đơn Hoàn tất, 1 ngày" [ref=e142]:
                    - generic [ref=e144]:
                      - img
                    - generic [ref=e145]:
                      - generic [ref=e146]: Duyệt và tạo đơn
                      - generic [ref=e147]: Hoàn tất, 1 ngày
                - listitem [ref=e148]:
                  - button "Hiện tại Theo dõi nhập kho Đang xử lý, 1 ngày" [pressed] [ref=e149]:
                    - generic [ref=e150]:
                      - generic [ref=e151]:
                        - img
                      - status "Hiện tại" [ref=e152]:
                        - generic [ref=e154]: Hiện tại
                    - generic [ref=e155]:
                      - generic [ref=e156]: Theo dõi nhập kho
                      - generic [ref=e157]: Đang xử lý, 1 ngày
            - generic [ref=e158]:
              - heading "Ngày phục vụ" [level=3] [ref=e160]:
                - img [ref=e161]
                - generic [ref=e163]: Ngày phục vụ
              - generic [ref=e164]: Chọn đúng một ngày trong tuần. Mọi dòng bên dưới thuộc phạm vi Cả ngày (FULLDAY).
              - generic "Các ngày cần xử lý" [ref=e165]:
                - 'button "22/07/2026 Đang nhập kho Thiếu: 1 dòng NCC: 1/1 Ngoại lệ: 0 Nhập kho: Nhận một phần" [expanded] [ref=e166]':
                  - generic [ref=e167]:
                    - generic [ref=e168]: 22/07/2026
                    - status "Đang nhập kho" [ref=e169]:
                      - generic [ref=e171]: Đang nhập kho
                  - generic [ref=e172]:
                    - generic [ref=e173]: "Thiếu: 1 dòng"
                    - generic [ref=e174]: "NCC: 1/1"
                    - generic [ref=e175]: "Ngoại lệ: 0"
                    - generic [ref=e176]: "Nhập kho: Nhận một phần"
              - generic [ref=e177]:
                - region "Dòng nguyên liệu của ngày phục vụ đang chọn" [ref=e178]:
                  - generic [ref=e179]: Bảng có cuộn ngang cục bộ và giữ chiều cao ổn định.
                  - generic [ref=e181]:
                    - text: Tìm nguyên liệu, nhà cung cấp hoặc mã dòng nguồn
                    - generic [ref=e182]:
                      - img
                      - searchbox "Tìm nguyên liệu, nhà cung cấp hoặc mã dòng nguồn" [ref=e183]
                  - region "Nhóm dòng nguyên liệu cần mua" [ref=e184]:
                    - generic [ref=e185]: Mỗi hàng là một nhóm nguyên liệu; mở nguồn để xử lý từng dòng chứng từ.
                    - table [ref=e186]:
                      - rowgroup [ref=e187]:
                        - row "Nguyên liệu Số lượng mua Nhà cung cấp Bằng chứng hiện tại Giá đề xuất Ngày giao Thao tác" [ref=e188]:
                          - columnheader "Nguyên liệu" [ref=e189]
                          - columnheader "Số lượng mua" [ref=e190]
                          - columnheader "Nhà cung cấp" [ref=e191]
                          - columnheader "Bằng chứng hiện tại" [ref=e192]
                          - columnheader "Giá đề xuất" [ref=e193]
                          - columnheader "Ngày giao" [ref=e194]
                          - columnheader "Thao tác" [ref=e195]
                      - rowgroup [ref=e196]:
                        - row "Sườn heo 1 dòng nguồn 15 kg Thực phẩm An Phát 1/1 dòng đã xác nhận 115.000 ₫ 22/07/2026 Xem quyết định" [ref=e197]:
                          - cell "Sườn heo 1 dòng nguồn" [ref=e198]:
                            - generic [ref=e199]: Sườn heo
                            - generic [ref=e200]: 1 dòng nguồn
                          - cell "15 kg" [ref=e201]
                          - cell "Thực phẩm An Phát" [ref=e202]
                          - cell "1/1 dòng đã xác nhận" [ref=e203]
                          - cell "115.000 ₫" [ref=e204]
                          - cell "22/07/2026" [ref=e205]
                          - cell "Xem quyết định" [ref=e206]:
                            - button "Xem quyết định" [ref=e207]
                - generic [ref=e208]:
                  - heading "Quyết định thu mua" [level=3] [ref=e210]:
                    - img [ref=e211]
                    - generic [ref=e214]: Quyết định thu mua
                  - generic [ref=e215]: 22/07/2026 · Cả ngày. Theo tiến độ mới nhất.
                  - generic [ref=e217]:
                    - generic [ref=e218]:
                      - paragraph [ref=e219]: Tiến độ nhập kho chỉ đọc
                      - status "Chưa nhận" [ref=e220]:
                        - generic [ref=e222]: Chưa nhận
                    - paragraph [ref=e223]: 0/1 dòng đã nhận đủ trên 1 đơn đặt hàng.
                    - button "Mở màn hình nhập kho" [ref=e224] [cursor=pointer]:
                      - img
                      - text: Mở màn hình nhập kho
```

# Test source

```ts
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
  387 |         {
  388 |           name: 'warehouse-phase09',
  389 |           path: `${ROUTES.WAREHOUSE}?week=${PHASE09_WEEK}&purchaseRequestId=pr-phase09`,
  390 |         },
  391 |       ] as const) {
  392 |         test(`${route.name} visual baseline`, async ({ page }) => {
  393 |           await installPhase09Clock(page);
  394 |           await stubVisualApi(page);
  395 |           await stubPhase09Api(page);
  396 |           await login(page);
  397 |           await page.goto(route.path);
  398 |           await expect(page.locator('.ipc-app-shell')).toBeVisible();
  399 |           await expect(page.locator('.ipc-header-context')).toContainText(phase09HeaderDate);
  400 |           await stabilizeVisuals(page);
> 401 |           await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`);
      |                              ^ Error: expect(page).toHaveScreenshot(expected) failed
  402 |         });
  403 |       }
  404 |     });
  405 |   }
  406 | });
  407 | 
```