# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-routes.spec.ts >> Phase 09 deterministic visual seam >> 1365x900 >> purchasing-phase09 visual baseline
- Location: tests\visual-routes.spec.ts:392:9

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  36459 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: purchasing-phase09-1365x900.png

Call log:
  - Expect "toHaveScreenshot(purchasing-phase09-1365x900.png)" with timeout 10000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 36459 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 36459 pixels (ratio 0.03 of all image pixels) are different.

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
          - generic [ref=e97]: Thu mua
        - heading "Thu mua" [level=1] [ref=e98]
      - generic "Ngữ cảnh vận hành" [ref=e99]:
        - generic [ref=e100]:
          - img [ref=e101]
          - generic [ref=e103]: 22/7/2026
        - generic [ref=e104]:
          - img [ref=e105]
          - generic [ref=e108]: Ca trưa · Nhân sự thu mua
        - generic [ref=e111]: Chưa đồng bộ dữ liệu
    - main [ref=e112]:
      - generic [ref=e113]:
        - generic [ref=e114]:
          - generic [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]:
                - img [ref=e118]
                - text: "Tuần mua hàng: 20/07/2026 - 26/07/2026"
              - generic [ref=e122]:
                - img [ref=e123]
                - text: Cả ngày (FULLDAY)
            - generic [ref=e126]:
              - button "Tuần trước" [ref=e127]:
                - img
              - button "Tuần hiện tại" [ref=e128]:
                - img
                - text: Tuần hiện tại
              - button "Tuần sau" [ref=e129]:
                - img
              - button "Mở màn hình nhập kho" [ref=e130]
          - generic [ref=e131]:
            - generic [ref=e132]:
              - img [ref=e134]
              - term [ref=e136]: Ngày cần xử lý
              - definition [ref=e137]: "1"
            - generic [ref=e138]:
              - img [ref=e140]
              - term [ref=e149]: Nhu cầu chờ duyệt
              - definition [ref=e150]: "0"
            - generic [ref=e151]:
              - img [ref=e153]
              - term [ref=e162]: Ngoại lệ giá
              - definition [ref=e163]: "0"
            - generic [ref=e164]:
              - img [ref=e166]
              - term [ref=e168]: Đơn chờ nhập
              - definition [ref=e169]: "1"
        - generic [ref=e172]:
          - generic [ref=e173]:
            - generic [ref=e174]:
              - heading "Thu mua theo nhu cầu đã duyệt" [level=1] [ref=e175]
              - paragraph [ref=e176]: Một luồng sáu giai đoạn từ nhu cầu đã duyệt đến tiến độ nhập kho.
            - status "Đã đồng bộ" [ref=e177]:
              - generic [ref=e179]: Đã đồng bộ
          - tablist "Chọn góc nhìn thu mua" [ref=e180]:
            - tab "Xử lý thu mua" [selected] [ref=e181] [cursor=pointer]
            - tab "Mua bổ sung" [ref=e182] [cursor=pointer]
            - tab "Báo giá nhà cung cấp" [ref=e183] [cursor=pointer]
          - tabpanel "Xử lý thu mua" [ref=e186]:
            - navigation "Sáu giai đoạn thu mua" [ref=e187]:
              - list [ref=e188]:
                - listitem [ref=e189]:
                  - button "Nhu cầu đã duyệt Hoàn tất, 1 ngày" [ref=e190]:
                    - generic [ref=e192]:
                      - img
                    - generic [ref=e193]:
                      - generic [ref=e194]: Nhu cầu đã duyệt
                      - generic [ref=e195]: Hoàn tất, 1 ngày
                - listitem [ref=e196]:
                  - button "Chọn nhà cung cấp và giá Hoàn tất, 1 ngày" [ref=e197]:
                    - generic [ref=e199]:
                      - img
                    - generic [ref=e200]:
                      - generic [ref=e201]: Chọn nhà cung cấp và giá
                      - generic [ref=e202]: Hoàn tất, 1 ngày
                - listitem [ref=e203]:
                  - button "Xử lý ngoại lệ giá Hoàn tất" [ref=e204]:
                    - generic [ref=e206]:
                      - img
                    - generic [ref=e207]:
                      - generic [ref=e208]: Xử lý ngoại lệ giá
                      - generic [ref=e209]: Hoàn tất
                - listitem [ref=e210]:
                  - button "Gửi đề xuất mua Hoàn tất, 1 ngày" [ref=e211]:
                    - generic [ref=e213]:
                      - img
                    - generic [ref=e214]:
                      - generic [ref=e215]: Gửi đề xuất mua
                      - generic [ref=e216]: Hoàn tất, 1 ngày
                - listitem [ref=e217]:
                  - button "Duyệt và tạo đơn Hoàn tất, 1 ngày" [ref=e218]:
                    - generic [ref=e220]:
                      - img
                    - generic [ref=e221]:
                      - generic [ref=e222]: Duyệt và tạo đơn
                      - generic [ref=e223]: Hoàn tất, 1 ngày
                - listitem [ref=e224]:
                  - button "Hiện tại Theo dõi nhập kho Đang xử lý, 1 ngày" [pressed] [ref=e225]:
                    - generic [ref=e226]:
                      - generic [ref=e227]:
                        - img
                      - status "Hiện tại" [ref=e228]:
                        - generic [ref=e230]: Hiện tại
                    - generic [ref=e231]:
                      - generic [ref=e232]: Theo dõi nhập kho
                      - generic [ref=e233]: Đang xử lý, 1 ngày
            - generic [ref=e234]:
              - heading "Ngày phục vụ" [level=3] [ref=e236]:
                - img [ref=e237]
                - generic [ref=e239]: Ngày phục vụ
              - generic [ref=e240]: Chọn đúng một ngày trong tuần. Mọi dòng bên dưới thuộc phạm vi Cả ngày (FULLDAY).
              - generic "Các ngày cần xử lý" [ref=e241]:
                - 'button "22/07/2026 Đang nhập kho Thiếu: 1 dòng NCC: 1/1 Ngoại lệ: 0 Nhập kho: Nhận một phần" [expanded] [ref=e242]':
                  - generic [ref=e243]:
                    - generic [ref=e244]: 22/07/2026
                    - status "Đang nhập kho" [ref=e245]:
                      - generic [ref=e247]: Đang nhập kho
                  - generic [ref=e248]:
                    - generic [ref=e249]: "Thiếu: 1 dòng"
                    - generic [ref=e250]: "NCC: 1/1"
                    - generic [ref=e251]: "Ngoại lệ: 0"
                    - generic [ref=e252]: "Nhập kho: Nhận một phần"
              - generic [ref=e253]:
                - region "Dòng nguyên liệu của ngày phục vụ đang chọn" [ref=e254]:
                  - generic [ref=e255]: Bảng có cuộn ngang cục bộ và giữ chiều cao ổn định.
                  - generic [ref=e257]:
                    - text: Tìm nguyên liệu, nhà cung cấp hoặc mã dòng nguồn
                    - generic [ref=e258]:
                      - img
                      - searchbox "Tìm nguyên liệu, nhà cung cấp hoặc mã dòng nguồn" [ref=e259]
                  - region "Nhóm dòng nguyên liệu cần mua" [ref=e260]:
                    - generic [ref=e261]: Mỗi hàng là một nhóm nguyên liệu; mở nguồn để xử lý từng dòng chứng từ.
                    - table [ref=e262]:
                      - rowgroup [ref=e263]:
                        - row "Nguyên liệu Số lượng mua Nhà cung cấp Bằng chứng hiện tại Giá đề xuất Ngày giao Thao tác" [ref=e264]:
                          - columnheader "Nguyên liệu" [ref=e265]
                          - columnheader "Số lượng mua" [ref=e266]
                          - columnheader "Nhà cung cấp" [ref=e267]
                          - columnheader "Bằng chứng hiện tại" [ref=e268]
                          - columnheader "Giá đề xuất" [ref=e269]
                          - columnheader "Ngày giao" [ref=e270]
                          - columnheader "Thao tác" [ref=e271]
                      - rowgroup [ref=e272]:
                        - row "Sườn heo 1 dòng nguồn 15 kg Thực phẩm An Phát 1/1 dòng đã xác nhận 115.000 ₫ 22/07/2026 Xem quyết định" [ref=e273]:
                          - cell "Sườn heo 1 dòng nguồn" [ref=e274]:
                            - generic [ref=e275]: Sườn heo
                            - generic [ref=e276]: 1 dòng nguồn
                          - cell "15 kg" [ref=e277]
                          - cell "Thực phẩm An Phát" [ref=e278]
                          - cell "1/1 dòng đã xác nhận" [ref=e279]
                          - cell "115.000 ₫" [ref=e280]
                          - cell "22/07/2026" [ref=e281]
                          - cell "Xem quyết định" [ref=e282]:
                            - button "Xem quyết định" [ref=e283]
                - generic [ref=e284]:
                  - heading "Quyết định thu mua" [level=3] [ref=e286]:
                    - img [ref=e287]
                    - generic [ref=e290]: Quyết định thu mua
                  - generic [ref=e291]: 22/07/2026 · Cả ngày. Theo tiến độ mới nhất.
                  - generic [ref=e293]:
                    - generic [ref=e294]:
                      - paragraph [ref=e295]: Tiến độ nhập kho chỉ đọc
                      - status "Chưa nhận" [ref=e296]:
                        - generic [ref=e298]: Chưa nhận
                    - paragraph [ref=e299]: 0/1 dòng đã nhận đủ trên 1 đơn đặt hàng.
                    - button "Mở màn hình nhập kho" [ref=e300] [cursor=pointer]:
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