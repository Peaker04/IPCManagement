# Đặc Tả Thiết Kế Kiến Trúc & Chuẩn Hóa Runtime Toàn Diện Phân Hệ MRX
*(MRX Production Runtime Conformance & Industrial UX Architecture Specification)*

- **Mã tài liệu**: `SPEC-MRX-2026-10-23`
- **Phiên bản**: `2.0.0 (Master Conformance)`
- **Trạng thái**: Đã phê duyệt nguyên tắc (Chờ duyệt Spec & Plan trước khi thực thi)
- **Chủ quyền tài liệu**: `docs/DOMAIN.md`, `docs/DESIGN.md`, `docs/UI-KIT.md`, `AGENTS.md`
- **Phân hệ mục tiêu**: `MATERIAL_RECONCILIATION` (`FR-RECON`, `FR-WH`, `FR-CHEF`, `FR-MENU`, `FR-REP`)

---

## 1. Bối cảnh & Tầm nhìn Kiến trúc (Executive Summary)

Sau khi hoàn tất 12 Master Tasks Backend (87 migrations EF Core, MySQL 9.5 data integrity, và 1,406 automated tests pass 100%), cuộc audit thực tế toàn diện trên trình duyệt thật (Playwright Chromium) và đối chiếu với FE cũ (`IPCManagement-fe-legacy-backup`) đã phát hiện 4 khoảng trống kiến trúc nghiêm trọng:

1. **Vi phạm Kiến trúc Điều hướng (Rule N6 Violation)**: Màn hình `/reconciliation` vẫn duy trì 5 tab chuyển đổi nội bộ trang thay vì tích hợp vào hệ thống Sidebar Nav Nest của `routeRegistry.ts`, gây xé nhỏ sự chú ý của người dùng và làm sai lệch trạng thái URL.
2. **Lệch chuẩn Design Kit & Thành phần Tự chế (Ad-hoc UI Components)**: Nhiều màn hình tự viết các thẻ HTML trần (`<table>`, `<th>`, `<td>`, `grid-cols-5` tự chế) thay vì tái sử dụng 13 Primitives (`<DataGrid>`, `<Num>`, `<IdentifierText>`, `<Badge>`) và 4 Composites chuẩn của dự án. Lộ nhiều thông tin thô như UUID dài, ngày ISO `yyyy-mm-dd`, và số trần không phân cách hàng nghìn.
3. **Rung giật Bố cục Nghiêm trọng (Severe Layout Shift / CLS > 0.3)**: Các Skeleton loader hiện tại chia đều tỷ lệ cột (`flex-1`) không khớp với hình học thực tế của bảng; đồng thời việc gọi `setData(null)` cưỡng bức khi lọc dữ liệu làm xóa trắng bảng và gây rung giật DOM liên tục.
4. **Mất mát Tính năng Nghiệp vụ Vượt trội từ FE Cũ**: FE mới bị thiếu hụt 4 năng lực tác nghiệp cốt lõi: Thanh tiến trình vòng đời lô 5 bước (`ReconciliationLifecycleStrip`), Bộ lọc nhanh trạng thái dòng chênh lệch, Các chip gợi ý lý do giải trình nhanh, và Phiếu nấu ăn Bếp trưởng gom nhóm theo từng Món ăn (`Card per Dish`).

Bản thiết kế này quy định chi tiết toàn bộ giải pháp kiến trúc để khắc phục triệt để các vấn đề trên, nâng tầm phân hệ MRX đạt chuẩn công nghiệp cao cấp.

---

## 2. Nghiên cứu Tiêu chuẩn Chuyên nghiệp & Chuẩn hóa Ngành (Industrial Catering Standards)

### 2.1. Chu trình Kiểm soát Nguyên liệu theo Ca Chuẩn mực

```
[1. Kế hoạch Tuần] ──> [2. Đóng băng Lô] ──> [3. Xuất kho Tổng hợp] ──> [4. Bếp nhận & Nấu]
   Thực đơn + BOM        Khóa định mức          Thủ kho xuất ca          Phiếu nấu theo món
   Chốt số suất ca       Sinh mã lô tuần        In phiếu xuất kho        Khử khuẩn giá tiền
         │                                                                      │
         ▼                                                                      ▼
[5. Biến động Trong ca (Khách tăng/giảm suất, Đổi món)] ────────────────────────┘
         │
         ▼
[6. Cửa kho Kiểm đếm Thực tế (Physical Tally)] ──> [7. Đối soát Dung sai & Giải trình]
   Xuất bù thêm hoặc Nhập trả hàng thừa             So khớp Nhu cầu vs Thực xuất
   Bắt buộc cân đo đong đếm tại cửa dock             Vượt ngưỡng dung sai: lập biên bản
         │                                                              │
         ▼                                                              ▼
[8. Tháp Điều khiển (Control Tower)] ─────────────> [9. Chốt sổ Tuần Bất biến (Close Ledger)]
```

### 2.2. Bảng Đối chiếu & Chuẩn hóa Thuật ngữ Chuyên ngành (Domain Terminology Mapping)

Toàn bộ các chuỗi giao diện, nhãn bảng, thông báo lỗi và tài liệu được vi hóa chuẩn mực theo ngôn ngữ nhà bếp/kho/kế toán:

| Thuật ngữ Cũ / Kỹ thuật Thô | Thuật ngữ Chuyên ngành Chuẩn xác (Tiếng Việt) | Ý nghĩa Vận hành & Vị trí Áp dụng |
|---|---|---|
| `Daily Lineage` / `Lineage Policy` | **Định lượng nguyên liệu ngày** | Bảng phân rã định mức BOM chi tiết của từng nguyên liệu cho từng ngày và ca ăn. |
| `Legacy Daily Lineage Missing` (409) | **Lô cũ chưa có định lượng ngày** | Thông báo trung tính dạng warning nhẹ khi xem lô lịch sử (không dùng chữ Lỗi 409). |
| `Batch Amendment Fan` / `Coordinator` | **Đồng bộ thay đổi thực đơn** | Cập nhật lại định mức lô đối soát khi khách hàng thay đổi số suất hoặc cơ cấu món. |
| `Source Delta` / `Work Kind` | **Chênh lệch định lượng phát sinh** | Lượng nguyên liệu cần xuất bổ sung hoặc hoàn trả về kho do biến động thực đơn trong ca. |
| `Supplemental Issue` | **Xuất bổ sung ca** | Phiếu xuất thêm nguyên liệu từ kho ra bếp khi tăng suất hoặc đổi món ăn tốn nguyên liệu. |
| `Physical Return` | **Hoàn trả kho** | Phiếu nhận lại nguyên liệu thừa từ bếp về kho khi giảm suất hoặc đổi món ít nguyên liệu. |
| `Disposition Invalidation` | **Hủy biên bản giải trình do đổi định mức** | Khi thực đơn thay đổi sau khi đã giải trình, biên bản cũ tự động hủy để lập lại. |
| `Trạng thái DRAFT` | **Đang chuẩn bị** | Lô đối soát tuần mới tạo nháp, đang tổng hợp định lượng, chưa khóa số liệu. |
| `Trạng thái READY` | **Đã đóng băng kế hoạch** | Lô đã khóa số liệu định mức và số suất, sẵn sàng bàn giao cho Thủ kho. |
| `Trạng thái TRANSFERRED` | **Đã bàn giao kho** | Lô đã chuyển giao quyền tác nghiệp cho Thủ kho để xuất hàng theo ngày. |
| `Trạng thái IN_PROGRESS` | **Đang xuất ca** | Kho đang tiến hành xuất hàng phục vụ các ca ăn trong tuần. |
| `Trạng thái COMPLETED` | **Đã chốt sổ tuần** | Toàn bộ các ca đã xuất, 100% chênh lệch đã được giải trình, sổ sách bị khóa bất biến. |
| `Issued Required Difference` | **Chênh lệch xuất kho** | Hiệu số giữa Lượng thực xuất kho và Nhu cầu kế hoạch (`Thực xuất - Nhu cầu`). |
| `Physical Tally Discrepancy` | **Lệch kiểm đếm cửa kho** | Sai lệch giữa số lượng cân thực tế tại cửa kho so với số lý thuyết trên phần mềm. |

### 2.3. Tiêu chuẩn Tháp Điều khiển Tác nghiệp (Operational Control Tower)
- Bố trí tại phần đỉnh của phân hệ đối soát với 5 thẻ chỉ số then chốt (5 Queues):
  1. *Đổi nguồn chờ duyệt* (kết nối hộp thư sửa suất).
  2. *Lô chờ xuất kho* (kết nối kho chuẩn bị xuất phối hợp).
  3. *Hàng đợi bù/trả cửa kho* (kết nối kiểm đếm thực tế).
  4. *Sai lệch chưa giải trình* (kết nối sổ chênh lệch).
  5. *Lô đủ điều kiện chốt sổ* (kết nối thao tác chốt sổ tuần).
- Tương tác: Bấm vào từng thẻ là **Deep-link kèm auto-filter** tới đúng màn hình và dòng dữ liệu cần xử lý. Loại bỏ hoàn toàn lỗi hiển thị số 2 lần (chỉ hiển thị 1 con số sắc nét kèm nhãn nghiệp vụ).

### 2.4. Tiêu chuẩn Bếp ăn (Kitchen Ergonomics & Data Decoupling)
- **Khử khuẩn 100%**: Tuyệt đối không để lộ giá tiền, giá vốn, chênh lệch kho, hay mã UUID kế toán trên màn hình Bếp trưởng.
- **Card per Dish**: Dữ liệu phiếu nấu được gom nhóm theo từng Món ăn trong ca: Tên món · Số suất · Bảng định mức chi tiết (BOM/suất, Tỷ lệ hao hụt %, Tổng lượng cần nấu).

### 2.5. Tiêu chuẩn Cửa kho (Physical Dock Tally & Discrepancy Ledger)
- Thủ kho có quyền nhập **Số lượng thực nhận / thực xuất tại cửa kho**.
- Khi số thực tế lệch so với số lý thuyết toán học: Bắt buộc chọn Lý do chênh lệch thực tế kèm các chip gợi ý nhanh (*Hao hụt rã đông/rơi vãi, Bếp giữ lại dùng cho ca sau, Sai lệch bao bì cân đong, Giao thiếu so với phiếu*).

### 2.6. Chuẩn mực Dung sai Định mức BOM & Phân loại Sai lệch
- Ngưỡng dung sai tự động: Rau củ tươi ($\pm 5\% - 8\%$), Thịt cá đông lạnh ($\pm 3\% - 5\%$), Hàng khô/Gia vị ($\pm 1\% - 2\%$).
- Phân loại giải trình 4 nhóm: *Chấp nhận hao hụt thực tế, Điều chỉnh định lượng BOM kỳ tới, Đã xuất bù thực tế trong ca, Sai số đo lường lúc xuất kho*.

---

## 3. Bộ 5 Quy chuẩn Chống AI Slop (`SLOP-1` đến `SLOP-5`)

Mọi dòng code, cấu trúc component và kiểm thử bắt buộc phải vượt qua 5 rào chắn:
- **`SLOP-1` (Cấm mã mồ côi & stub bù nhìn)**: 100% component, hook, hàm tiện ích phải được import và render trực tiếp trong luồng người dùng thật. Không viết code chỉ để phục vụ unit test của chính nó.
- **`SLOP-2` (Cấm test tự biên tự diễn)**: Không mock component, không mock hook dưới test; fixture bám sát DTO C#; không nới lỏng assertion regex; zero allowlist padding.
- **`SLOP-3` (Cấm fallback dữ liệu giả trong API)**: Ném `ApiError` thật khi gặp mã lỗi HTTP; kích hoạt error boundary thật với nút thử lại.
- **`SLOP-4` (Cổng kiểm chứng trình duyệt thật)**: Chỉ công nhận hoàn thành khi kiểm chứng bằng mắt qua ảnh chụp Playwright Chromium trên Kestrel và MySQL thật.
- **`SLOP-5` (Chân thực theo nghiệp vụ suất ăn)**: Khử khuẩn bếp ăn; Thủ kho kiểm đếm thực tế; Quản lý điều hành qua 5 hàng đợi; không lộ UUID thô; ngày chuẩn tiếng Việt; số liệu căn phải font số học `tabular-nums`.

---

## 4. Kiến trúc Điều hướng Nested Sidebar (Rule N6)

### 4.1. Bãi bỏ Hoàn toàn Tab Bar Nội Bộ Trang
Thanh tab bar nội bộ trang cũ trong `ReconciliationPage.tsx` bị xóa bỏ hoàn toàn. Quyền điều hướng được chuyển giao 100% cho Sidebar Nav Nest v2 thông qua `routeRegistry.ts`.

### 4.2. Khai báo Canonical Leaves cho `/reconciliation`
Trong `frontend/src/routes/routeRegistry.ts`, route `/reconciliation` được mở rộng với 5 liên kết lá (Route Leaves):
```ts
{
  path: '/reconciliation',
  title: 'Đối soát nguyên liệu',
  frCode: 'FR-RECON',
  allowedRoles: ADMIN_MANAGER_ROLES,
  permissions: ['reconciliation.read'],
  modes: ['MATERIAL_RECONCILIATION'],
  leaves: [
    { id: 'reconciliation.lines', to: '/reconciliation?view=lines', label: 'Rà soát dòng ngày', surfaceId: 'reconciliation.lines', capabilityIds: ['RECON.BATCH.READ', 'RECON.LINE.DISPOSE'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
    { id: 'reconciliation.variances', to: '/reconciliation?view=variances', label: 'Sổ theo dõi chênh lệch', surfaceId: 'reconciliation.variances', capabilityIds: ['RECON.BATCH.READ'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
    { id: 'reconciliation.transactions', to: '/reconciliation?view=transactions', label: 'Lịch sử giao dịch kho', surfaceId: 'reconciliation.transactions', capabilityIds: ['RECON.BATCH.READ'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
    { id: 'reconciliation.audit', to: '/reconciliation?view=audit', label: 'Nhật ký kiểm toán', surfaceId: 'reconciliation.audit', capabilityIds: ['RECON.BATCH.READ'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
    { id: 'reconciliation.completed', to: '/reconciliation?view=completed', label: 'Danh bạ lô hoàn tất', surfaceId: 'reconciliation.completed', capabilityIds: ['RECON.BATCH.READ'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
  ],
}
```

### 4.3. Đăng ký Đầy đủ các Bề mặt Kho & Mở quyền Báo cáo
- `/warehouse`: Đăng ký chuẩn xác lá `mrx.preparation` (`/warehouse?view=mrx-preparation`) và `mrx.deltas` (`/warehouse?view=mrx-deltas`).
- `/reports`: Cập nhật `modes: ['DEFAULT', 'MATERIAL_RECONCILIATION']` trong `routeRegistry.ts` để người dùng chế độ MRX truy cập được báo cáo chi phí và đối soát.

---

## 5. Chuẩn Hóa Design System & Impeccable UI Kit

### 5.1. Bãi bỏ Thành phần Tự chế $\rightarrow$ Thay thế bằng Primitives Chuẩn
1. **Thay thế thẻ `<table>` trần trong `ReconciliationReportTables.tsx`**:
   - Sử dụng `<DataGrid<T>>` composite cho cả 4 bảng: Sổ chênh lệch (`variances`), Lịch sử giao dịch (`transactions`), Nhật ký kiểm toán (`audit`), và Danh bạ hoàn tất (`completed`).
   - Cột mã dùng `<IdentifierText>`, cột số dùng `<Num>`, cột ngày dùng `formatVietnameseDate`.
2. **Thay thế thẻ `<table>` trần 10 cột trong `MrxCookingWorkbench.tsx`**:
   - Sử dụng cấu trúc **Card per Dish** sạch sẽ, mỗi card chứa thông tin Món ăn và bảng nguyên liệu con dùng font `tabular-nums`.
3. **Thay thế thẻ `<table>` trần trong `MrxSourceDeltaWorkbench.tsx`**:
   - Chuyển sang dùng `<DataGrid<MrxSourceDeltaItem>>` với các cột định dạng chuẩn và Zone 2 Subbar.
4. **Nâng cấp `ReconciliationQueueCards.tsx`**:
   - Thiết kế lại các thẻ chỉ số theo tiêu chuẩn Flat Metric Strip của UI Kit: Biểu tượng tinh tế, con số sắc nét, nhãn ngắn gọn, hiệu ứng hover êm dịu, không lặp lại con số vô nghĩa.

### 5.2. Khôi phục 4 Tính Năng Vượt Trội từ FE Cũ
1. **`ReconciliationLifecycleStrip`**: Thanh tiến trình 5 bước đặt tại Zone 2 của `/reconciliation`: `Tạo nháp` $\rightarrow$ `Đóng băng` $\rightarrow$ `Bàn giao kho` $\rightarrow$ `Đang xuất ca` $\rightarrow$ `Đã chốt sổ`.
2. **Variance Status Quick Filters**: Bộ 4 nút lọc nhanh trên `/reconciliation?view=lines`: `Tất cả`, `Cần xử lý`, `Đã giải trình`, `Khớp định mức`, kèm ô tìm kiếm nguyên liệu theo tên hoặc mã.
3. **Preset Reason Chips trong Modal**: Thêm 4 nút bấm chọn nhanh lý do giải trình trong `ReconciliationDispositionModal.tsx`.
4. **Kitchen Cooking Cards**: Phiếu nấu ăn Bếp trưởng gom nhóm theo món ăn trong `MrxCookingWorkbench.tsx`.

---

## 6. Kiến trúc Trạng thái Không Rung Giật (Zero-CLS UI State Architecture)

### 6.1. Nguyên tắc Khắc phục Rung giật Bố cục
- **Khớp 1:1 Hình học Cột (Geometry-Matched Skeleton)**: Skeleton bảng dữ liệu phải nhận mảng tỷ lệ độ rộng của các cột thật (ví dụ: `w-[22%]`, `w-[8%]`, `w-[14%]...`), tuyệt đối không dùng `flex-1` chia đều.
- **Bảo toàn Dữ liệu Cũ khi Lọc (Warm Navigation)**: Sử dụng `useScopedQuery` với cấu hình `{ keepPreviousData: true }`. Khi đổi khách hàng, đổi ngày, hoặc chuyển trang: Bảng dữ liệu cũ vẫn giữ nguyên trên DOM, áp dụng hiệu ứng mờ nhẹ (`opacity-70`) và thanh hairline progress 2px màu xanh navy trên đỉnh bảng. Không xóa bảng để hiện lại skeleton.
- **Bảo toàn Chiều cao Zone 2**: 100% các màn hình phải duy trì chiều cao cố định của Zone 1 (`48px`) và Zone 2 (`40px`), ngăn chặn tình trạng bảng bị nhảy vị trí thanh cuộn.

### 6.2. Ma trận 6 Trạng thái UI trong `StateBoundary`
- `loading`: Cold load dùng Geometry Skeleton; Warm load dùng Previous Data + Opacity + Hairline progress bar.
- `empty`: 4 kịch bản rõ ràng (`true-empty`, `prerequisite-blocked`, `filter-empty`, `partial-data`) kèm hướng dẫn hành động kế tiếp.
- `error`: Khung lỗi rose-50 kèm nút "Thử lại".
- `permission-denied`: Trạng thái 403 giải thích vai trò bị thiếu.
- `partial`: Cảnh báo dữ liệu dở dang ở Zone 2.
- `write-reconciliation`: Modal xác nhận với thông tin phiên bản và focus trap chuẩn WCAG 2.2 AA.

---

## 7. Kiến trúc Hiệu năng (Performance Architecture)

1. **DataGrid Memoization**: Khai báo mảng `columns` bên ngoài render loop hoặc bọc trong `useMemo`, ngăn chặn việc tái tạo object làm DataGrid re-render.
2. **Debounce Tìm kiếm 250ms**: Áp dụng debounce cho ô tìm kiếm nguyên liệu, giảm tần suất filter và re-render.
3. **Phân tách Context**: Ngăn chặn re-render dây chuyền giữa việc chuyển đổi giao diện Sidebar và nội dung dữ liệu của Workbench.

---

## 8. Hợp đồng Kiểm thử & Ma trận Truy vết (Verification Contract)

Mỗi tính năng phải có bài kiểm tra hợp đồng tự động và ảnh chụp màn hình kiểm chứng trực quan:
- `conformance-runtime.spec.ts`: Bổ sung kiểm tra 5 view lá của `/reconciliation` qua Sidebar, kiểm tra Card per Dish của Bếp trưởng, kiểm tra modal kiểm đếm cửa kho.
- Chụp 8 ảnh màn hình kiểm chứng trực quan vào `.artifacts/audit-screenshots/` chứng minh không còn UUID thô, không còn ngày ISO, không còn lỗi 409 giật gân, và CLS $\le$ 0.05.
