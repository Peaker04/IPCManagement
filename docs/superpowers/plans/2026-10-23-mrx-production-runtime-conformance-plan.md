# Kế Hoạch Thực Thi: Chuẩn Hóa Runtime & Kiến Trúc UI Phân Hệ MRX
*(MRX Production Runtime Conformance & Industrial UX Implementation Plan)*

- **Mã kế hoạch**: `PLAN-MRX-2026-10-23`
- **Phiên bản**: `2.1.0 (Locked Invariants Edition)`
- **Đặc tả kiến trúc tham chiếu**: `docs/superpowers/specs/2026-10-23-mrx-production-runtime-conformance-design.md`
- **Trạng thái**: Bản thảo kế hoạch (Chờ người dùng duyệt trước khi thực thi)
- **Phương pháp thực hiện**: Test-Driven Development (TDD) + Rào chắn Khóa Nguyên Tắc Từng Wave + Kiểm chứng Trực quan bằng Playwright Chromium thật.

---

## 1. Nguyên Tắc Quản Trị Cốt Lõi Xuyên Suốt (Overarching Invariants)

Mọi thao tác trong suốt quá trình thực thi phải tuân thủ nghiêm ngặt 3 thiết chế bất biến:
1. **Operational Mode Isolation (`DOM-MODE-1`)**: Tuyệt đối không làm ảnh hưởng hay trộn lẫn luồng tác nghiệp của chế độ `DEFAULT`. Các sửa đổi liên quan đến MRX chỉ có hiệu lực khi `operationalMode === 'MATERIAL_RECONCILIATION'`.
2. **Single Styling Authority**: 100% token styling nằm trong `frontend/src/styles/index.css`. Cấm tuyệt đối inline styles (`style={{...}}`) hoặc mã màu ad-hoc ngoài palette (cấm tạo màu lạ, cấm tạo BadgeV2 hay TableCustom).
3. **Strict Anti-AI Slop Mandate (`SLOP-1` đến `SLOP-5`)**:
   - `SLOP-1`: Cấm mã mồ côi và stub bù nhìn (mọi component/hook viết ra phải được import và render trực tiếp trong luồng người dùng).
   - `SLOP-2`: Cấm test tự biên tự diễn (không mock component dưới test, zero allowlist padding).
   - `SLOP-3`: Cấm fallback dữ liệu ảo (ném `ApiError` thật khi lỗi HTTP).
   - `SLOP-4`: Cổng kiểm chứng trình duyệt thật (Playwright Chromium trên Kestrel và MySQL thật).
   - `SLOP-5`: Chân thực nghiệp vụ suất ăn (Khử khuẩn bếp, Thủ kho kiểm đếm thực tế, Quản lý điều hành 5 hàng đợi).

---

## 2. Các Làn Thực Thi Chi Tiết Kèm Khóa Nguyên Tắc Từng Wave (Execution Waves with Locked Invariants)

```
[WAVE 1: Điều hướng Sidebar N6] ────> [WAVE 2: Kiến trúc Trạng thái Zero-CLS]
             │                                       │
             ▼                                       ▼
[WAVE 3: Chuẩn hóa Đối soát & 4 Tính năng FE cũ] ───> [WAVE 4: Phiếu nấu Bếp trưởng Card per Dish]
             │                                       │
             ▼                                       ▼
[WAVE 5: Chuẩn bị Kho & Kiểm đếm Cửa kho] ─────────> [WAVE 6: Kiểm chứng Trực quan & Đóng gói]
```

---

### WAVE 1: Tái cấu trúc Điều hướng & Nested Sidebar Navigation (Rule N6)
*Mục tiêu: Đưa toàn bộ các view con vào Sidebar Nav Nest, loại bỏ tab bar nội bộ trang.*

#### 🔒 Khóa Nguyên Tắc Cốt Lõi Wave 1 (Locked Invariants)
- **Khóa Rule N6 (Nested Sidebar Authority)**: Sidebar v2 (nhóm accordion + liên kết lá) là thẩm quyền điều hướng duy nhất khi route có >1 view con. Cấm duy trì song song cả tab bar trong trang lẫn menu lá sidebar cho cùng một đích đến.
- **Khóa Bất biến URL (`DOM-MODE-1`)**: Phân tách triệt để giữa Route Base Path và View Leaf Query (`view=...`). Các query parameters vận hành (`batchId`, `date`, `page`) là view state, không được dùng để so sánh chuỗi tuyệt đối trong `isRouteEligible` gây lỗi văng 403.
- **Khóa Anti-Slop (`SLOP-1`)**: Xóa bỏ hoàn toàn thanh tab bar trong `ReconciliationPage.tsx`, không để lại bất kỳ nút bấm mồ côi hay state dư thừa nào (`activeReportTab` bị bãi bỏ).

#### 📋 Danh sách Task Thực thi Wave 1
- [ ] **Task 1.1**: Cập nhật `frontend/src/routes/routeRegistry.ts`:
  - Khai báo 5 canonical leaves cho `/reconciliation`:
    - `reconciliation.lines`: `/reconciliation?view=lines` (Rà soát dòng ngày)
    - `reconciliation.variances`: `/reconciliation?view=variances` (Sổ theo dõi chênh lệch)
    - `reconciliation.transactions`: `/reconciliation?view=transactions` (Lịch sử giao dịch kho)
    - `reconciliation.audit`: `/reconciliation?view=audit` (Nhật ký kiểm toán)
    - `reconciliation.completed`: `/reconciliation?view=completed` (Danh bạ lô hoàn tất)
  - Khai báo 2 canonical leaves cho `/warehouse`: `mrx.preparation` (`/warehouse?view=mrx-preparation`) và `mrx.deltas` (`/warehouse?view=mrx-deltas`).
  - Cập nhật `/reports` cho phép `modes: ['DEFAULT', 'MATERIAL_RECONCILIATION']`.
- [ ] **Task 1.2**: Cập nhật `navigationEligibility.ts` và `workbenchSurfaceRegistry.ts`:
  - Đảm bảo các view query con của `/reconciliation` và `/warehouse` đều được nhận diện hợp lệ, loại bỏ hoàn toàn nguy cơ văng 403 khi gõ URL trực tiếp hoặc chuyển view.
- [ ] **Task 1.3**: Tái cấu trúc `ReconciliationPage.tsx`:
  - Đọc `searchParams.get('view')` (mặc định là `lines`) để xác định view hiện tại.
  - **Xóa bỏ vĩnh viễn 5 nút bấm tab bar nội bộ trong `TelemetrySubbar`**.
- [ ] **Task 1.4**: Viết unit test xác minh cấu trúc menu điều hướng:
  - Cập nhật `AppShell.test.tsx` và `navigationEligibility.test.ts` xác minh accordion "Đối soát nguyên liệu" hiển thị đúng 5 mục con khi ở chế độ MRX.

#### 🚪 Cổng Thoát Bắt Buộc Wave 1 (Mandatory Exit Gate)
1. `npm test -- AppShell.test.tsx` và `navigationEligibility.test.ts` PASS 100%.
2. Không còn bất kỳ nút tab bar nội bộ nào trong `ReconciliationPage.tsx`.
3. Nhấp vào từng mục con trong 5 lá trên Sidebar điều hướng mượt mà, URL đổi `?view=...` mà không bị văng 403 `/forbidden`.

---

### WAVE 2: Kiến trúc Trạng thái Zero-CLS & Loading Overlay
*Mục tiêu: Triệt tiêu hoàn toàn rung giật layout khi tải lần đầu và khi chuyển view/lọc.*

#### 🔒 Khóa Nguyên Tắc Cốt Lõi Wave 2 (Locked Invariants)
- **Khóa NFR-UI-01 & Nielsen Norman Heuristic (CLS $\le$ 0.05)**: Tuyệt đối không để xảy ra hiện tượng nhảy giật kích thước bảng hay rung giật thanh cuộn khi tải dữ liệu.
- **Khóa Quy tắc 2 Pha Tải (Cold Load vs Warm Navigation)**:
  - *Cold Load*: Bắt buộc dùng Skeleton có `columnWidths` khớp 1:1 với tỷ lệ % của DataGrid thật. Cấm dùng `flex-1` chia đều cột.
  - *Warm Navigation*: Khi đã có dữ liệu cũ trong DOM (`hasExistingData === true`), cấm tuyệt đối xóa trắng bảng để hiện lại skeleton. Bắt buộc giữ nguyên bảng cũ mờ `opacity-70` và hiển thị thanh hairline progress bar 2px màu xanh navy trên đỉnh bảng.
- **Khóa Chiều cao Bố cục 3-Zone**: Zone 1 cố định đúng `48px`, Zone 2 cố định đúng `40px` ngay từ frame đầu tiên.

#### 📋 Danh sách Task Thực thi Wave 2
- [ ] **Task 2.1**: Nâng cấp `WorkbenchSkeleton.tsx`:
  - Bổ sung prop `columnWidths?: string[]` vào `SkeletonGeometry` để nhận mảng tỷ lệ % cột thực tế của DataGrid (ví dụ: `['22%', '8%', '14%', '14%', '14%', '14%', '14%']`).
  - Đảm bảo thead skeleton cao đúng 40px, mỗi dòng cao đúng 36px (khớp Rule `T8`).
- [ ] **Task 2.2**: Nâng cấp `StateBoundary.tsx`:
  - Thêm cơ chế **Loading Overlay**: Khi `isFetching === true` và `hasExistingData === true`, giữ nguyên `children` trong DOM với class `opacity-70 transition-opacity pointer-events-none` và hiển thị thanh hairline progress bar 2px màu xanh navy (`bg-blue-600 animate-pulse`) chạy ngang trên đỉnh bảng.
  - Loại bỏ hoàn toàn việc gọi `setData(null)` cưỡng bức trong các page khi lọc dữ liệu.
- [ ] **Task 2.3**: Viết unit test kiểm chứng Zero-CLS:
  - Viết test case trong `Primitives.test.tsx` kiểm tra `StateBoundary` bảo toàn DOM của `children` khi chuyển trạng thái từ đã có dữ liệu sang `isFetching === true`.

#### 🚪 Cổng Thoát Bắt Buộc Wave 2 (Mandatory Exit Gate)
1. `npm test -- Primitives.test.tsx` PASS 100%.
2. Đổi khách hàng hoặc đổi ngày trên màn hình Đối soát: Bảng dữ liệu cũ mờ nhẹ êm ái, thanh tiến trình hairline 2px xuất hiện, DOM không bị xóa trắng, vị trí các cột không bị nhảy giật.

---

### WAVE 3: Chuẩn Hóa Giao Diện Đối Soát & Khôi Phục 4 Tính Năng FE Cũ
*Mục tiêu: Đưa phân hệ đối soát đạt chuẩn Fiori/Impeccable và khôi phục toàn bộ tính năng hữu ích từ FE cũ.*

#### 🔒 Khóa Nguyên Tắc Cốt Lõi Wave 3 (Locked Invariants)
- **Khóa Impeccable Design Kit & Bãi bỏ Thành phần Tự chế**: Cấm viết thẻ HTML trần `<table>`, `<th>`, `<td>` trong `ReconciliationReportTables.tsx`. 100% các bảng phải dùng `<DataGrid<T>>`.
- **Khóa Rule T1–T8 (Data Precision)**: 100% số lượng dùng `<Num format="quantity" suffix=" kg">` căn phải `tabular-nums`; 100% mã dùng `<IdentifierText>` monospace kèm icon copy; 100% ngày dùng định dạng tiếng Việt `dd/MM/yyyy`. Tuyệt đối không hiển thị UUID/GUID thô dài dằng dặc hay số trần không phân cách hàng nghìn.
- **Khóa Tháp Điều Khiển Tác Nghiệp (Control Tower)**: Loại bỏ lặp số 2 lần trong `ReconciliationQueueCards.tsx`. Bấm vào thẻ là deep-link kèm auto-filter.
- **Khóa WCAG 2.2 AA (Modal Focus Trap)**: `ReconciliationDispositionModal.tsx` phải có Focus Trap tuần hoàn và tự động phục hồi focus về nút kích hoạt khi đóng.

#### 📋 Danh sách Task Thực thi Wave 3
- [ ] **Task 3.1**: Tái thiết kế Tháp Điều Khiển `ReconciliationQueueCards.tsx`:
  - Thiết kế lại các thẻ chỉ số theo tiêu chuẩn Flat Metric Strip của UI Kit: Con số sắc nét (`tabular-nums text-lg font-bold`), nhãn nghiệp vụ ngắn gọn, chấm trạng thái màu, không lặp lại con số vô nghĩa.
  - Tích hợp Deep-link tự động: Bấm thẻ 1 sang đổi nguồn, thẻ 2 sang chuẩn bị kho, thẻ 3 sang hàng đợi bù/trả, thẻ 4 sang sổ chênh lệch bật lọc, thẻ 5 kích hoạt chốt sổ.
- [ ] **Task 3.2**: Khôi phục Thanh Tiến Trình Vòng Đời Lô (`ReconciliationLifecycleStrip`):
  - Tạo component `ReconciliationLifecycleStrip.tsx` đặt tại Zone 2 của `/reconciliation`.
  - Hiển thị trực quan 5 bước: `1. Tạo nháp` $\rightarrow$ `2. Đóng băng` $\rightarrow$ `3. Bàn giao kho` $\rightarrow$ `4. Đang xuất ca` $\rightarrow$ `5. Đã chốt sổ`.
- [ ] **Task 3.3**: Khôi phục Bộ Lọc Nhanh Trạng Thái Dòng & Tìm Kiếm:
  - Tích hợp 4 nút lọc nhanh ngay trên bảng rà soát dòng ngày: `Tất cả`, `Cần xử lý`, `Đã giải trình`, `Khớp định mức`.
  - Tích hợp ô tìm kiếm nguyên liệu theo tên hoặc mã.
- [ ] **Task 3.4**: Chuẩn hóa Toàn bộ Bảng Báo cáo trong `ReconciliationReportTables.tsx`:
  - Thay thế 100% thẻ `<table>` trần bằng `<DataGrid<T>>` composite cho cả 4 bảng: Sổ chênh lệch (`variances`), Lịch sử giao dịch (`transactions`), Nhật ký kiểm toán (`audit`), và Danh bạ hoàn tất (`completed`).
  - Format ngày tiếng Việt `dd/MM/yyyy`, format số lượng `<Num tabular-nums>`, format mã `<IdentifierText>`.
  - Hiển thị họ tên người chốt thay vì UUID thô trong bảng Danh bạ hoàn tất.
- [ ] **Task 3.5**: Khôi phục 4 Chip Gợi Ý Lý Do Giải Trình Nhanh trong `ReconciliationDispositionModal.tsx`:
  - Thêm 4 chip: `[Chấp nhận hao hụt thực tế]`, `[Điều chỉnh định lượng BOM kỳ tới]`, `[Đã xuất bù thực tế trong ca]`, `[Sai số đo lường lúc xuất kho]`.
  - Bấm vào chip là tự động điền nội dung vào ô lý do.
- [ ] **Task 3.6**: Viết unit test xác minh:
  - Cập nhật `Reconciliation.test.tsx` kiểm thử bộ lọc nhanh, thanh tiến trình, và việc mở modal giải trình với các chip gợi ý.

#### 🚪 Cổng Thoát Bắt Buộc Wave 3 (Mandatory Exit Gate)
1. `npm test -- Reconciliation.test.tsx` PASS 100%.
2. Không còn bất kỳ thẻ `<table>` trần nào trong `ReconciliationReportTables.tsx`.
3. Bảng Danh bạ hoàn tất hiển thị mã lô rút gọn kèm nút copy, ngày tiếng Việt `dd/MM/yyyy`, họ tên người chốt rõ ràng, không còn UUID thô.
4. Bấm 4 nút lọc nhanh: Bảng tự động lọc đúng số lượng dòng chênh lệch.

---

### WAVE 4: Chuẩn Hóa Phiếu Nấu Bếp Trưởng & Thẻ Món Ăn (Card per Dish)
*Mục tiêu: Đạt chuẩn công thái học nhà bếp, khử khuẩn dữ liệu và thân thiện với đầu bếp.*

#### 🔒 Khóa Nguyên Tắc Cốt Lõi Wave 4 (Locked Invariants)
- **Khóa Công Thái Học Bếp & Khử Khuẩn Dữ Liệu**: Tuyệt đối không để lộ giá tiền, giá vốn, chênh lệch kho, hay mã UUID kế toán trên màn hình Bếp trưởng.
- **Khóa Cấu trúc Card per Dish**: Bếp trưởng nấu theo món ăn, không nấu theo bảng phẳng nguyên liệu. Bắt buộc gom nhóm dữ liệu theo từng Món ăn trong ca (`serviceDate - shiftName - dishCode`).
- **Khóa Xử Lý Thông Báo Neutral (Anti-Slop `SLOP-5`)**: Tuyệt đối cấm hiển thị banner đỏ chót báo lỗi 409 "Xung đột dữ liệu đồng thời" khi gặp lô lịch sử. Bắt buộc hiển thị thông báo neutral hướng dẫn nhẹ nhàng.
- **Khóa Zone 2 TelemetrySubbar**: Bổ sung thanh Zone 2 (40px) đồng nhất với toàn bộ hệ thống.

#### 📋 Danh sách Task Thực thi Wave 4
- [ ] **Task 4.1**: Tái cấu trúc `MrxCookingWorkbench.tsx` sang mô hình **Card per Dish**:
  - Gom nhóm dữ liệu theo từng Món ăn trong ca (`serviceDate - shiftName - dishCode`).
  - Mỗi món ăn hiển thị thành 1 Card chuyên nghiệp: Header gồm Tên món, ca ăn, ngày phục vụ và số lượng suất; Body là bảng nguyên liệu (Định mức BOM/suất, Tỷ lệ hao hụt %, Tổng lượng cần nấu).
  - Khử khuẩn hoàn toàn thông tin chi phí và mã kế toán.
- [ ] **Task 4.2**: Xử lý Thông Báo Trung Tính cho Lô Lịch Sử:
  - Bắt lỗi `LEGACY_DAILY_LINEAGE_MISSING` và hiển thị thông báo hướng dẫn neutral nhẹ nhàng (màu vàng nhạt/xanh), loại bỏ hoàn toàn banner đỏ chót "Lỗi 409 Xung đột dữ liệu đồng thời".
- [ ] **Task 4.3**: Bổ sung Thanh Zone 2 `TelemetrySubbar` (40px):
  - Hiển thị inline telemetry: Số món ăn trong ca, tổng số suất phục vụ, tổng lượng nguyên liệu.
- [ ] **Task 4.4**: Viết unit test xác minh:
  - Cập nhật `Chef.test.tsx` xác minh cấu trúc nhóm Card per Dish và xử lý thông báo neutral.

#### 🚪 Cổng Thoát Bắt Buộc Wave 4 (Mandatory Exit Gate)
1. `npm test -- Chef.test.tsx` PASS 100%.
2. Mở màn hình Bếp trưởng: Dữ liệu phân rã thành từng Card món ăn rõ ràng, không còn bảng phẳng 10 cột lặp tên món.
3. Mở lô cũ: Không xuất hiện banner đỏ 409, chỉ hiện thông báo hướng dẫn trung tính.

---

### WAVE 5: Chuẩn Hóa Màn Hình Kho & Kiểm Đếm Thực Tế Tại Cửa Kho
*Mục tiêu: Đảm bảo tính chân thực của khâu giao nhận vật tư tại cửa kho.*

#### 🔒 Khóa Nguyên Tắc Cốt Lõi Wave 5 (Locked Invariants)
- **Khóa Kiểm Đếm Thực Tế Cửa Kho (Physical Dock Tally)**: Cấm phần mềm tự động submit ngầm số lượng lý thuyết toán học vào thẻ kho. Bắt buộc Thủ kho phải có ô nhập số thực nhận/thực xuất và bắt buộc chọn lý do khi phát sinh lệch.
- **Khóa Bãi Bỏ Thành Phần Tự Chế**: Chuyển bảng thay đổi nguồn sang `<DataGrid<MrxSourceDeltaItem>>`.
- **Khóa Bố Cục 3-Zone**: Bổ sung thanh Zone 2 Subbar (40px) cho cả 2 màn hình kho MRX (`MrxSourceDeltaWorkbench` và `MrxMultiCustomerPreparationWorkbench`).
- **Khóa Trạng Thái Nút Bấm**: Nút xác nhận xuất kho khi có 0 lô được chọn phải hiển thị rõ ràng class disabled, cấm hiện màu đen gây hiểu nhầm có thể bấm được.

#### 📋 Danh sách Task Thực thi Wave 5
- [ ] **Task 5.1**: Chuẩn hóa `MrxSourceDeltaWorkbench.tsx`:
  - Thay thế thẻ `<table>` trần bằng `<DataGrid<MrxSourceDeltaItem>>`.
  - Bổ sung thanh Zone 2 `TelemetrySubbar` (40px) hiển thị số dòng xuất bù và hoàn trả đang chờ.
  - Bổ sung các chip chọn nhanh lý do chênh lệch thực tế trong modal kiểm đếm cửa kho (*Hao hụt rã đông/rơi vãi, Bếp giữ lại dùng ca sau, Sai lệch bao bì cân đong, Giao thiếu so với phiếu*).
- [ ] **Task 5.2**: Chuẩn hóa `MrxMultiCustomerPreparationWorkbench.tsx`:
  - Bổ sung thanh Zone 2 `TelemetrySubbar` (40px) đồng nhất với toàn bộ hệ thống.
  - Cập nhật logic nút "Xác nhận xuất phối hợp": khi có 0 lô được chọn, nút hiển thị rõ trạng thái disabled (màu xám nhạt, không click được) thay vì hiện màu đen.
- [ ] **Task 5.3**: Viết unit test xác minh:
  - Cập nhật `Warehouse.test.tsx` xác minh DataGrid, Subbar 40px, và modal kiểm đếm thực tế cửa kho.

#### 🚪 Cổng Thoát Bắt Buộc Wave 5 (Mandatory Exit Gate)
1. `npm test -- Warehouse.test.tsx` PASS 100%.
2. Màn hình kho có đầy đủ 3-Zone (Header 48px, Subbar 40px, DataGrid 85%).
3. Nút xuất phối hợp khi chọn 0 lô chuyển xám mờ disabled chuẩn xác.
4. Modal kiểm đếm cửa kho có các chip lý do nhanh bấm ăn ngay.

---

### WAVE 6: Kiểm Chứng Trực Quan Bằng Ảnh Chụp & Đóng Gói
*Mục tiêu: Chứng minh tính tuân thủ bằng bằng chứng thực tế trên Chromium thật.*

#### 🔒 Khóa Nguyên Tắc Cốt Lõi Wave 6 (Locked Invariants)
- **Khóa Rule SLOP-4 (Live Browser Reality Gate)**: Không tin tưởng output của test runner. Bắt buộc kiểm chứng bằng mắt qua 8 ảnh chụp màn hình Playwright Chromium trên Kestrel và MySQL thật.
- **Khóa Không Hồi Quy (Zero Regression)**: `npm run verify` phải pass 100% bao gồm 1,406 Backend tests, toàn bộ Frontend unit tests, lint clean, depcruise clean, và strict architecture gate clean.

#### 📋 Danh sách Task Thực thi Wave 6
- [ ] **Task 6.1**: Chạy kiểm tra kỹ thuật tự động toàn diện:
  - `npm run verify`.
- [ ] **Task 6.2**: Mở rộng và chạy bộ Playwright test `conformance-runtime.spec.ts`:
  - Xác minh cả 5 liên kết lá của `/reconciliation` trên Sidebar.
  - Xác minh Card per Dish của Bếp trưởng.
  - Xác minh modal kiểm đếm thực tế cửa kho.
- [ ] **Task 6.3**: Chụp 8 ảnh màn hình kiểm chứng trực quan vào `.artifacts/audit-screenshots/`:
  1. `01-mrx-sidebar-leaves.png`: Menu lồng nhau 5 mục của Đối soát trên Sidebar v2.
  2. `02-mrx-reconciliation-lines.png`: Bảng rà soát dòng ngày kèm 4 nút lọc nhanh và thanh tiến trình 5 bước.
  3. `03-mrx-control-tower.png`: 5 Thẻ hàng đợi điều hành tinh tế không lặp số.
  4. `04-mrx-completed-register.png`: Bảng danh bạ hoàn tất dùng DataGrid, mã rút gọn, tên người dùng, ngày tiếng Việt.
  5. `05-mrx-chef-cards.png`: Màn hình Bếp trưởng gom nhóm Card per Dish và thông báo neutral lô cũ.
  6. `06-mrx-warehouse-deltas.png`: Hàng đợi chênh lệch dùng DataGrid và Subbar 40px.
  7. `07-mrx-warehouse-prep.png`: Chuẩn bị xuất phối hợp đầy đủ 3-Zone bố cục.
  8. `08-mrx-zero-cls.png`: Ảnh chụp khi chuyển view chứng minh không bị giật layout.
- [ ] **Task 6.4**: Cập nhật `.planning/WORK.md` và chuyển trạng thái về `IDLE`.

#### 🚪 Cổng Thoát Bắt Buộc Wave 6 (Final Milestone Exit Gate)
1. `npm run verify` PASS 100%.
2. `npx playwright test tests/browser/conformance-runtime.spec.ts` PASS 100%.
3. 8 ảnh chụp màn hình đạt chuẩn thẩm mỹ cao cấp, không có lỗi hiển thị thô, không có lỗi 403, không có lỗi 409 giật gân, và CLS $\le$ 0.05.

---

### Kính Mời Bạn Đọc & Phê Duyệt

Tôi đã cập nhật bản kế hoạch **Implementation Plan v2.1.0** với các **nguyên tắc cốt lõi, rào chắn chống AI Slop và cổng thoát bắt buộc được khóa chặt vào từng Wave**. Tôi đang tiếp tục **tạm dừng hoàn toàn** để bạn đọc và xem xét bản cập nhật này!
