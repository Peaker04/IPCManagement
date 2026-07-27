# Thiết kế lại kiến trúc dữ liệu & trạng thái — IPCManagement

Ngày: 26/07/2026 · Nhánh: `feature/production-plan` · HEAD: `8bdb69b`
Phương pháp: 11 mũi khảo sát song song đọc mã nguồn thật + 3 lăng kính phản biện độc lập.
Mọi con số dưới đây đếm được từ code, không ước lượng.

---

## Phần A — Chẩn đoán: vì sao "sửa trang này hỏng trang kia"

Nhận định ban đầu của chủ dự án đúng về hướng nhưng lệch ở chỗ đau nhất.

**Không phải thiếu một lớp service.** RTK Query đã là lớp duy nhất — chỉ 2 lời gọi `fetch()` thô lọt
ra ngoài (`AdminDataPage.tsx:328`, `action-toolbar.tsx:207`). `frontend/src/services/` chỉ có `.gitkeep`,
nhưng lớp service thực chất nằm ở 5 file `*Api.ts`.

**Cái thiếu là hợp đồng được cưỡng chế.** 205–283 interface FE viết tay ↔ 238 DTO BE, **0 dòng codegen**,
**0 bước kiểm contract trong CI**. Đối chiếu tự động 121 cặp DTO trùng tên: **21 cặp lệch field**.

### Bốn ống dẫn khiến thay đổi lan ra ngoài ý muốn

| # | Ống dẫn | Số đo | Hệ quả |
|---|---|---|---|
| 1 | Cache tag trơn | **35/59 `providesTags` là `'WorkflowReports'`**; 17/27 `invalidatesTags` cũng vậy, phủ 75 endpoint, trong khi `apiSlice.ts:180` chỉ khai 11 `tagTypes` cho 126 endpoint | Một mutation làm ~35 query trên 12 trang cùng refetch |
| 2 | Barrel God-feature | `features/workflow/index.ts` (150 dòng) tái xuất **71 hook + 61 type**, được **29 nơi** import | Đổi một export lan ra 29 file |
| 3 | Import vượt ranh giới | **80 import** vượt biên feature trên 14 cặp; **17 import ngược** từ shared vào feature (`lib/dateUtils.ts:8`, 12 dòng trong `components/common/`, 4 dòng trong `api/apiSlice.ts`); **2 chu trình thật** (`projects↔workflow`, `chef↔workflow`) | Không tầng nào cô lập được |
| 4 | God feature | `features/workflow` = 45 file / 11.990 dòng = **45% toàn bộ `features/`**, chứa cả page của feature khác | Mọi việc đều đụng vào đây |

### Trạng thái: đang dùng 3/8

`isLoading` 144 · `isFetching` 153 · `isError` 138 · **`isUninitialized` 0** · **`isSuccess` 0**.
69 vị trí `skip:` tạo ra trạng thái "chưa đủ điều kiện" nhưng **0 chỗ đọc `isUninitialized`** → nó bị gộp
với "rỗng thật". 78 nhánh `.length === 0`, **60 nhánh (77%)** nói "chưa có dữ liệu" bất kể nguyên nhân.

**Component về mặt kiểu không thể biểu diễn `f(data, state)`**: 8/8 component dữ liệu dùng chung
(DemandSummary, WorkQueue, RoleInbox, DocumentRail, ApprovalQueue, ExceptionLane, StockMovementTable,
ContextStrip) và 3/3 shell bảng (DataTableShell, TableViewport, PaginatedTableFrame) chỉ nhận mảng thuần.
Đó là lý do P1.9 vá được 6 tab nhưng phần còn lại không hưởng gì.

### Tên/khóa: tầng BE sạch, sai lệch dồn ở ranh giới DTO→FE

53/53 bảng và 523/523 cột camelCase nhất quán; 246/247 namespace BE khớp folder. **Không cần đổi tên gì
ở tầng entity.** Nhưng **5/15 hàm map trong `workflowApi.ts` chủ động vứt bỏ** `ingredientId`/`unitId`/
`supplierId`/`warehouseId` mà server đã gửi → **11 chỗ FE phải lấy tên làm khóa**, trong khi **0/5 cột
`*Name` có UNIQUE index**.

---

## Phần B — Bug đúng-sai nghiệp vụ (G0): phải sửa bất kể kiến trúc

Đây là bug, không phải nợ kỹ thuật. Nếu toàn bộ bản thiết kế này bị bác, phần này **vẫn phải làm**.

| # | Vị trí | Sai gì | Vì sao nguy hiểm |
|---|---|---|---|
| B1 | `AdminDataPage.tsx:1697-1738` | API chết → 5 KPI tile hiện `?? 0` + badge **success** nhãn "Ổn định"/"Đạt"/"Trong SLA"/"Đủ tồn" | **Nguy hiểm hơn empty-state giả**: khẳng định điều ngược lại sự thật |
| B2 | `scope.ts:225-227` | Khóa gộp dùng `normalizeDishMatchKey` bỏ dấu | **Gộp "Bò" với "Bơ"** |
| B3 | `chefProductionModel.ts:150` | `totalMeals \|\| liveMaterials.length` | Tổng suất ăn tụt thành **số dòng nguyên liệu** khi tổng = 0 |
| B4 | `chefProductionModel.ts:152` | Fallback `liveMaterials.length > 0 ? liveMaterials : plannedMaterials` | Đổ số kế hoạch vào đúng ô hiển thị "đã nhận" |
| B5 | `chefProductionModel.ts:110-113` | Khóa `materialTotals` theo `ingredientName`, `unit` lấy theo dòng đầu (`??=`) | Cộng hai đại lượng khác đơn vị; 23 nhóm master trùng tên đã đo |
| B6 | `WorkflowReportService.cs:1310/1374/1452` | 3 báo cáo price-variance gộp **thiếu `UnitId`**; `:1326` dùng `Average` **không trọng số** | Nguyên liệu nhập bằng kg và bằng thùng bị trung bình chung → cảnh báo tăng giá **sai cả dấu lẫn độ lớn** |
| B7 | `WorkflowReportDto.cs:118-143` | `IngredientDemandReportDto` thiếu `RequestLineId` (DTO ngay dưới thì có) → `workflowApi.ts:1419` sinh key `${materialRequestId}-${ingredientId}` | Trùng key khi một chứng từ có nhiều dòng cùng nguyên liệu — **49 nhóm như vậy là hợp lệ** ở line grain |
| B8 | `coordinationSlice.ts:17-18` + `chefProductionModel.ts:96` | `menuPrice: 35000` nằm ở Redux, không thuộc 3 bậc hợp lệ (25k/30k/34k); dùng `menuPrice / 35000` làm hệ số nhân định lượng | Hiện tỉ số = 1.0 nên vô hại. Ngày nối với hợp đồng thật, **định lượng bếp bị nhân 0,714 không tín hiệu nào** |
| B9 | `coordination/types.ts:6-10` | `toDisplayShift` là hàm hai nhánh | Mã ca lạ (ca 3 của khách mới) **im lặng rơi về "Ca Chiều"**, số suất dồn sai ca |
| B10 | `AdminDataPage.tsx:312`, `:353` | `auditResult`/`stockMovementResult` đọc `.data` không đọc `.isError` | **Lint mù** nên không nằm trong backlog 15 call-site |
| B11 | `GuidHelper.cs:20-24` + `WorkflowReportService.cs:132-133,145-153` | `ParseGuidString` trả `null` im lặng; null đi vào mẫu `if (warehouseId is not null) → Where(...)` | **`warehouseId` sai định dạng = KHÔNG lọc gì cả** → người dùng nhìn thấy tồn kho của **mọi kho** như thể đó là kho họ chọn. **207 lời gọi / 30 file** (25 lời gọi riêng trong `WorkflowReportService.cs`). Đây là bản sao của lỗi H7 nhưng ở phía BE, nơi rule lint FE không với tới |
| B12 | `WorkflowReportService.cs:135` và `:1779` | `CursorDate` chỉ so sánh theo **ngày**, không có tiebreaker theo id — dù `CursorId` được khai ở `WorkflowReportDto.cs:15,34`, mang theo ở `:3915`, phát ra ở `:3943` | Sổ cái 17.256 dòng **nhảy mất dòng** ở ranh giới trang. FE đã truyền đúng và đủ (`ReportsPage.tsx:307,316,505,515`) → **lỗi thuần BE** |
| B13 | `.github/workflows/verify.yml` | CI sinh schema bằng `dotnet ef dbcontext script` — tức từ **MODEL**, không replay migration. Step `Check EF migration snapshot` chỉ chạy `has-pending-model-changes` | **21/36 migration viết tay chưa từng được thực thi một lần nào trong CI**. Một migration tay sai vẫn để CI xanh + 626 test xanh, rồi vỡ đúng lúc chạy trên DB giữ dữ liệu 5–10 năm. Dấu hiệu drift đã có: 53 entity nhưng chỉ 52 lệnh `ToTable()` |

---

## Phần C — Bộ 8 trạng thái

Phát biểu gốc là "6 trạng thái". Khảo sát cho thấy phải là **8**, và quan trọng hơn:
**trạng thái là TÍCH của các trục trực giao, không phải TỔNG của một enum phẳng.**

```
phase ∈ { uninitialized, loading, ready, forbidden, error }
      × isRefreshing: boolean      ← TRỤC RIÊNG, không phải giá trị của phase
      × isEmpty: boolean            ← chỉ có nghĩa khi phase = ready
      × truncation: { shown, total } | null
```

| Trạng thái | Khi nào | Thể hiện (Fiori) | Sai lầm phải tránh |
|---|---|---|---|
| **uninitialized** | 69 chỗ `skip:` — chưa chọn khách hàng/tab/ngày | Panel giữ `min-h-[420px]`, một dòng hướng dẫn: "Chọn khách hàng để xem nhu cầu" | **Không** icon rỗng, **không** nút thử lại, **không** skeleton |
| **loading** | `isLoading` và chưa từng có data cho cache key này | Skeleton hàng bảng đúng số cột, đúng chiều cao hàng thật | Không spinner toàn trang. Thêm skeleton bừa **làm tăng CLS lượt cold** (Kho đã đo 0.1989) |
| **refreshing** *(trục)* | `isFetching` nhưng đã có data | Giữ panel cũ + overlay "Đang cập nhật" + `aria-busy`, transition 150ms chỉ opacity | **Đây là chỗ dễ hỏng nhất.** Xem ghi chú bên dưới |
| **success** | `ready` + không rỗng + không bị cắt | Bảng dense, row-based | Không coi là mặc định rồi để trạng thái khác đi qua `?? []` |
| **empty** | `ready` + server trả tập rỗng đáng tin | `EmptyState variant="empty"` + action tạo mới nếu có quyền | **Tuyệt đối không có nút thử lại** — ma trận P1.9 đã chốt tiêu chí này |
| **partial** | `isTruncated` hoặc `Take(limit)` | Dòng nhắc trên bảng: "Đang xem 100/… — hãy thu hẹp bộ lọc", tone warning | Cờ có sẵn ở `workflowApi.ts:1060,1307,1664` nhưng **0 chỗ render**. Bỏ trạng thái này = báo cáo mua hàng tự tin báo sai, **nặng dần theo dữ liệu 5–10 năm** |
| **forbidden** | 403 | "Bạn không có quyền xem dữ liệu này" | **Không nút thử lại** (thử lại vẫn 403). Gộp vào `empty` = tái tạo H7 ở tầng phân quyền |
| **error** | mọi lỗi khác 403 | `QueryErrorAlert`, `role="alert"`, có nút tải lại, tự tắt khi API hồi phục | Tile dẫn xuất phải chuyển "Chưa xác định" + tone danger như `WarehousePage.tsx:319-323` |

> **Vì sao `refreshing` phải là trục riêng.** Union phẳng buộc phải chọn lúc refetch: chọn `loading` →
> panel bị thay bằng skeleton → flash + layout shift, **phá đúng CLS 0 và click-to-content 11–22ms**
> vừa đo được; chọn `success` → mất tín hiệu đang cập nhật. Codebase đang tách `isLoading` 144 lượt /
> `isFetching` 153 lượt — mô hình mới phải giữ được sự tách đó.

---

## Phần D — Cấu trúc đích

Dự án đã đi được **60% đường tới package-by-feature** (169/260 file FE trong `features/`,
246/247 namespace BE khớp folder). Thiếu đúng ba thứ: quy tắc phụ thuộc thành văn, công cụ cưỡng chế,
và một cái tên đúng cho slice `workflow`.

**Frontend — Bulletproof React 3 tầng, mượn đúng một khái niệm segment của FSD:**

```
shared/     (lib, components/ui, types)   ← không được import features/
features/<nghiệp vụ>/
    api/     endpoint + type của riêng feature
    model/   logic thuần, không React
    ui/      component trình bày
app/        routes, providers, layout      ← được import features/
```
Không dùng FSD 7 tầng — quá nặng cho quy mô này.

**Backend — giữ MỘT project, chuyển sang VSA-lite:**

```
Features/<Nghiệp vụ>/   Controller + Service + DTO + Validator đi cùng nhau
Data/ Domain/ Migrations/   dùng chung
```
Không tách 4 project Clean Architecture. Hiện `Models/DTOs` có 14 nhóm feature còn `Services` chỉ có 4,
**10/14 nhóm DTO không có thư mục Services tương ứng** — và đã bác bỏ được cả 3 giả thuyết về tiêu chí
đặt service vào thư mục con (theo feature / kích thước / thời gian), nghĩa là **không có tiêu chí nào**.

**Cưỡng chế** (không có cái này thì mọi quy tắc sẽ trôi lại):
- FE: **dependency-cruiser** (độc lập version ESLint) chặn import ngược và chu trình.
- BE: **NetArchTest** + `.editorconfig` — hạ tầng đã sẵn (`InternalsVisibleTo` đã khai, 2 test project đã có).
- Nâng `ipc/no-swallowed-query-error` từ khớp cú pháp lên **khớp hình dạng** — rule hiện tại mù với
  `AdminDataPage.tsx:312,353` vì chúng dùng biến thay vì destructure.

**Di chuyển theo strangler fig, 4 tầng chi phí** — **không thay đổi nào chạm schema DB, rủi ro mất dữ liệu = 0**:

| Tier | Việc | Chi phí |
|---|---|---|
| 0 | Thêm công cụ cưỡng chế, chưa move file | **0 file move**, ~4 giờ |
| 1 | Xóa 17 import ngược + 2 chu trình | 12 file move |
| 2 | Giải thể God-feature `workflow` | ~150 file move |
| 3 | Đổi tên cây theo nghiệp vụ | 84 file move |

---

## Phần E — Lộ trình

| GĐ | Mục tiêu | Ước lượng | Nghiệm thu |
|---|---|---|---|
| **G0** | Chặn máu ngữ nghĩa (B1–B10) | 2–3 ngày, **không chia lane** (6 việc chạm 3 file) | Ngắt `/operational-kpis` → 5 tile ra "Chưa xác định" + tone danger. Ngắt kitchen-issues → màn Bếp ra error, không ra danh sách "đã nhận" |
| **G1** | Dựng lưới an toàn hồi quy **trước** khi động vào lớp dữ liệu | 4–6 ngày, chia 2 lane được | 0 assertion `toContain` trên `?raw` còn lại; lint bắt được cả `:312` và `:353`; ≥12 test component `AdminDataPage`; 3 spec Playwright vào CI |
| **G2** | Trả nợ merge + làm nhỏ cache tag | 2–3 ngày + 2–3 ngày, **không song song** | `main` chứa toàn bộ; sau 1 mutation, số panel `isFetching` ≤ 3 thay vì toàn bộ |
| **G3** | Hợp đồng `QueryView<T>` + **pilot 2 màn có sẵn test** | 5–7 ngày, **không chia lane** (bước định nghĩa chuẩn) | 2 màn phủ đủ 8 trạng thái; ma trận browser thêm 2 ca (`uninitialized`, `partial`); CLS warm vẫn 0 |
| **G4** | Nhân rộng theo lane, mỗi lane một trang | 3–4 tuần | **Điểm go/no-go**: chỉ chạy nếu số đo G3 chấp nhận được. Nếu 1 màn > 2 ngày thì DỪNG và báo lại |
| **G5** | Contract backend: khóa, đơn vị, grain (B6–B7) | 1–2 tuần, **song song được với G4** | Chứng từ nhiều dòng cùng nguyên liệu → render đủ dòng, `rowKey` không trùng |
| **G6** | Type sinh từ spec + cổng drift (**bản rẻ**) | 3–5 ngày | Đảo thứ tự enum trong DTO → CI đỏ. Đổi field non-null → nullable → CI đỏ |

**Thứ tự tối ưu của 6 nhóm thay đổi kỹ thuật: E → A → B → C → D → F**
(E = khôi phục ID, A = tách cache tag, B = envelope tập trung, C = codegen, D = ViewState, F = move file).

---

## Phần F — Bản đồ kéo theo

**4/6 thay đổi (A, B, C, E) đều đổ về cùng `workflowApi.ts`** (2.638 dòng, 75 literal `'WorkflowReports'`,
52 `transformResponse`, 112 interface, 6 hàm map) → **bắt buộc tuần tự một lane, không song song được.**

| | Thay đổi | Kéo theo đáng chú ý |
|---|---|---|
| A | Tách cache tag | 75 literal trong 1 file. Phải đo trước/sau số panel `isFetching` |
| B | Envelope tập trung | **Big-bang thật sự + bẫy chết người**: logic refresh token tại `apiSlice.ts:105,148` **tự đọc envelope**. Bóc tập trung mà quên 2 dòng này → **login vẫn OK nhưng mọi phiên văng sau 30 phút**. Lỗi trễ, smoke test không bắt được |
| C | Codegen | **Đang BỊ CHẶN**: 165/173 action trả `IActionResult` không kiểu; 8 controller có 0 `ProducesResponseType` (70 action, riêng `WorkflowReportsController` 36) → OpenAPI không sinh nổi schema. Phải mở khóa ở G5 trước |
| D | ViewState | Chạm 8 component dùng chung + 3 shell bảng + ≥37 panel |
| E | Khôi phục ID | 5 hàm map + 11 chỗ khóa theo tên. Rẻ nhất, mở đường cho A |
| F | Move file | Tier 0 = 0 file move |

**Rào cản chung cho D và F**: `operationalPagePerformanceContracts.test.ts` — **26 assertion so khớp
nguyên văn mã nguồn** qua 11 import `?raw`. Mọi thay đổi trạng thái hoặc di chuyển file đều làm đỏ file
này **dù hành vi đúng**, và cách sửa rẻ nhất (chỉnh chuỗi kỳ vọng) **xóa luôn bảo chứng**.

---

## Phần G — Rủi ro

1. **Mất bảo chứng trong im lặng (nguy cấp)** — test `?raw` nêu trên. Giảm nhẹ: G1 thay bằng test hành vi, commit riêng.
2. **Guardrail H7 tự tắt khi đổi tên hook (nguy cấp)** — `eslint.config.js:8` khớp regex `^use...Query$`.
   Đặt tên kiểu `useDemandService()` là rule khớp **0 chỗ**, tắt trong im lặng. Phải nâng rule **trước** khi migrate,
   và mỗi giai đoạn chứng minh rule còn sống bằng một vi phạm cố ý.
3. **Backlog nuốt lỗi đang đếm thiếu** — con số 15 trong `CURRENT-STATE.md:293` đếm bằng chính cổng đang mù. Số thật ≥ 17.
4. **Chuẩn hóa trạng thái có thể làm CHẬM ĐI nếu sai thứ tự** — bắt render skeleton khi `isFetching` mà chưa làm nhỏ tag
   → mỗi mutation đẩy toàn bộ panel về loading → flash trang.
5. **Thêm React provider là gãy cổng CI** — `cache-navigation.spec.ts:215` chốt `mainLayoutRenders ≤ 4`.
   `QueryView` phải là **hàm thuần**, không context/provider.
6. **Đổi tên endpoint làm prefetch trượt cache key mà không có type error** — `routeDataPreloaders.ts:9-90`
   gọi `util.prefetch('<tên>')` 20 lần bằng chuỗi literal. Triệu chứng duy nhất là chậm đi.
7. **Cửa sổ gãy khi đổi contract** — FE auto-deploy Vercel, BE deploy tay, không Dockerfile.
   Bắt buộc tương thích hai chiều theo khuôn mẫu P0.7.
8. **Nợ merge 322 file / +30.034 dòng** — refactor chồng lên khối này tạo PR không review nổi.
9. **Ước lượng nhân lực sai bậc độ lớn** — **527/527 commit trong 21 ngày do một người**;
   5 nhánh thành viên đứng yên 19–27 ngày. "Lane song song" = subagent của cùng một người, **không rút ngắn thời gian tường**.
10. **838 dòng code chết vẫn trong bundle** (4 sub-module `workflow/purchasing` chưa từng được page nào import)
    **nhưng được 430 dòng test phủ và báo xanh** — đúng dạng "done ảo".
11. **0 ErrorBoundary, 0 telemetry** trên 27.205 dòng → lỗi render hoặc chunk lazy hỏng = **trang trắng**, nhóm không biết.
12. **99 thông điệp validation tiếng Việt của FluentValidation bị FE vứt bỏ 100%**; 39/57 DTO request không có validator.
13. **Phân quyền là bảng chuỗi hardcode nhân bản ở 4 nơi và đã lệch thật** (`ProcurementStaff`).
14. **3 định nghĩa "hôm nay" cùng tồn tại**.
15. **Paging local là bom dữ liệu 5–10 năm** — `useLocalPagination` dùng ở 6 component gồm `AdminDataPage`;
    `stockmovements` đã 17.256 dòng, nhiều nơi ghim `limit: 100` cắt im lặng.
16. **Sửa nhầm chỗ đang đúng** — dễ bị "đơn giản hóa" hỏng: discriminated union `EmptyState.tsx:23-25`,
    nhánh fail-closed `demandModel.ts:229-231`, tile dẫn xuất `WarehousePage.tsx:319-323`.

---

## Phần H — Danh sách GIỮ NGUYÊN (quan trọng ngang phần sẽ đổi)

- Query gating theo tab — 66–69 chỗ `skip:`, cho `0` request thừa khi điều hướng warm.
- Route loader cache + preload trong idle slot — click-to-content 11–22ms, `0` fallback mount.
- Giữ panel cũ + overlay khi refetch (`WeeklyMenuPage.tsx:441-455`, `WarehousePage.tsx:611-616`) — nguồn của CLS 0.
- Paging server-side đã có.
- Mẫu "model thuần + hook data + section view" — nhưng lưu ý **chỉ phủ 6/17 sub-module (35%)**:
  weekly-menu 6/9, chef 1/6, workflow/purchasing 0/6.
- Discriminated union của `EmptyState` — đã ép được `onRetry` khi `variant="error"`.
- Tile dẫn xuất đúng ở `WarehousePage.tsx:319-323`.
- Tầng tên BE: 53/53 bảng + 523/523 cột camelCase — **không đổi tên gì ở đây**.
- Hướng phụ thuộc dọc BE đã sạch sẵn: 0 service gọi controller, 0 kiểu web trong `Services/`,
  0 `ApiResponse` trong `Services/` (so với 524 trong `Controllers/`), 0 service-locator,
  chuỗi service→service tối đa 1 hop, namespace khớp folder 246/247.
- `PagedResponseDto<T>` — 84 lượt dùng ngoài thư mục DTOs.
- CI step `Check EF migration snapshot` (`has-pending-model-changes`), `InternalsVisibleTo` trong csproj,
  `Migrations/` 54 file, `Resources/Templates` (LogicalName hard-code trong csproj).
- `Program.cs:218` `PropertyNamingPolicy=CamelCase`, `:221` `UtcDateTimeJsonConverter`, `:222` `JsonStringEnumConverter`.

---

## Phần I — Cấu trúc đích chi tiết

Dự án đã đi **82%** đường tới package-by-feature (169/272 file FE trong `features/`).
**Không thiếu kiến trúc — thiếu cưỡng chế.** `frontend/package.json` không có
dependency-cruiser/eslint-plugin-import/boundaries; backend không có `.editorconfig`/analyzer/ArchUnit;
`.husky/pre-commit` **chỉ kiểm tên nhánh**.

### FE — 4 tầng, luật một chiều

```
app/ ──► features/ ──► entities/ ──► shared/
```

| Luật | Nội dung | Vi phạm hiện tại |
|---|---|---|
| R1 | `shared/**` + `entities/**` → `features/**` hoặc `app/**` | **17** |
| R2 | `features/X/**` → `features/Y/**` (X≠Y) | **73–80** |
| R3 | `features/**` → `app/**` | 0 |
| R4 | chu trình phụ thuộc | **2** (`projects↔workflow`, `chef↔workflow`) |
| R5 | file mồ côi (0 inbound) | **10** — cảnh báo |
| R6 | import sâu vào ruột feature khác | nhiều |
| R7 | relative leo >1 cấp | **29** (24/29 là weekly-menu→coordination) |

**`features/workflow` bị giải thể** — 45 file / 11.990 dòng = 45% toàn bộ `features/`, chia về
`purchasing` (22) → `warehouse` (7) → `approvals` (5) → `admin` (2). Barrel `index.ts` 150 dòng
(71 hook + 61 type, 29 nơi import) bị xóa.

**Khuyến nghị quan trọng: KHÔNG đổi tên cây `components/lib/types/api` → `shared/` trong học kỳ này.**
dependency-cruiser diễn đạt được luật bằng path **hiện tại** → tiết kiệm ~83 file move mà không mất gì.

### BE — một project, VSA-lite, không chạm Migrations

Ràng buộc quyết định hình dạng: **38/54 file Migrations có `using ...Data`**, 16/54 có
`using ...Models.Entities` (Designer.cs sinh tự động). ⇒ Giữ nguyên `Data/`, `Models/Entities/`,
`Migrations/`, `Resources/` tại chỗ → **0 file Migrations bị chạm**.

Gom `Controllers` (24) + `Services` (63) + `DTOs` (47) + `Validators` (6) vào `Features/<10 nghiệp vụ>/`
+ `Shared/` cho cross-cutting. **~160 file di chuyển.**

| Luật | Nội dung | Vi phạm |
|---|---|---|
| B1 | `Features.X` → `Features.Y` | — |
| B4 | `Shared/Data/Entities` → `Microsoft.AspNetCore.Mvc` | **0** — khóa tài sản đang có |
| B5 | Constructor Controller nhận `IpcManagementContext` | **2** (`ApprovalHistoryController.cs:20-24`, `PurchaseRequestsController.cs:22-26`) |
| B7 | Namespace = đường dẫn folder | 246/247 — **là bảo hiểm cho git mv**: compiler C# bắt 100% chỗ hỏng qua `using`, không có kịch bản "build xanh chạy sai" |

**Vụ 3 quy ước tên giải quyết bằng 0 đồng phía DB**: rename 44/53 entity `Firstletteronly` →
PascalCase, **giữ nguyên 52 lệnh `ToTable()` lowercase** ⇒ 0 thay đổi DB, 0 migration, còn 2 quy ước.

---

## Phần J — Cưỡng chế (không có phần này thì mọi quy tắc sẽ trôi lại)

| Công cụ | Phạm vi | Chi phí |
|---|---|---|
| **dependency-cruiser** | FE luật R1–R7, chu trình, file mồ côi | ~3h |
| eslint rule tự viết | `no-wire-type-outside-contracts`, `no-name-as-key`, `no-duplicate-error-helper` | ~6h |
| vitest `conventions.test.ts` | quy ước tên file, trùng tên type, trần `entities/` | ~3h |
| **NetArchTest.Rules** | BE luật B1–B7 | ~5h |
| xUnit EF-model convention test | tên bảng/cột, hình dạng phân trang, JSON options | ~4h |
| **`backend/.editorconfig`** | 175 hậu tố `Async`, tiền tố `I`, `_camelCase` | ~2h + 4h sửa |
| **CI replay migration** | bịt lỗ hổng B13 | ~3h |
| Contract codegen check | `swagger tofile` → `openapi-typescript` → `git diff --exit-code` | ~5h |
| `.husky/pre-commit` + lint-staged | chặn ngay ở máy dev | ~1h |

**Tổng hạ tầng cưỡng chế: ~32 giờ**, 5 step CI mới (+~3 phút/lượt), 4 devDependency mới.

Hai lưu ý kỹ thuật bắt buộc:
- **dependency-cruiser phải chốt baseline** (`--output-type baseline`) ghi nhận vi phạm hiện có, để CI
  chỉ đỏ khi có vi phạm **mới**. Không có baseline thì rào chắn bị hoãn vô thời hạn.
- **Codegen phải dùng Swashbuckle CLI, KHÔNG dùng `/openapi`**: `Program.cs:398` gọi `MapOpenApi()`
  nhưng **`AddOpenApi()` không hề được đăng ký** — endpoint đó không hoạt động, và cả 3 dòng
  Swagger đều nằm trong `if (IsDevelopment())`.

---

## Phần K — Thứ tự thực hiện (10 bước, 7 cặp bắt buộc đi cùng nhau)

| Bước | Việc | Ước lượng |
|---|---|---|
| **0** | Chốt danh sách GIỮ NGUYÊN vào `CONTRIBUTING.md` trước khi bắt đầu | — |
| **1** | Xóa 838 dòng code chết + 430 dòng test phủ nó → **rồi mới** chốt baseline depcruise (**cặp #1**, không đảo thứ tự). Commit xóa `types/api.types.ts` phải là **commit đầu tiên** | 26h |
| **2** | Sửa `CursorId` (B12) — sửa số liệu sai, độc lập, làm sớm | 6h |
| **3** | CI replay migration (B13) — **trước** mọi thay đổi BE khác | 3h |
| **4** | Rename 44 entity + 175 hậu tố `Async`, 2 commit riêng, khi working tree cả nhóm sạch | 12h |
| **5** | Sinh contract từ swagger + đổi 69 hậu tố DTO (**cặp #3**) | 14h |
| **6** | Gỡ 2 chu trình FE **trước khi** di chuyển file workflow (**cặp #5**) | 10h |
| **7** | Giải thể `workflow` theo 4 lát, **mỗi lát đi cùng lượt sửa 3 test `?raw` trong cùng commit** (**cặp #6 — quan trọng nhất**) | 40h |
| **8** | Migrate FE sang type sinh, từng feature một commit. Cấm `as any` để làm xanh | 30h |
| **9** | Tách tag cache **cuối cùng**, đi cùng phép đo trước/sau trong cùng PR (**cặp #7**) | 16h |
| **10** | **Đã thực hiện 27/07 theo A1**: giữ cây FE, tách `AdminDataPage`/`ReportsPage`, BE VSA-lite một project, dọn/tách CSS; giữ Repository/Data/Entities/Migrations dùng chung | Hoàn tất |

**Tổng bước 1–9: ~157 giờ người ≈ 5–6 tuần.**

Kết quả Bước 10 không đổi cây FE sang `shared/`: Reports còn 799 dòng, Admin Data
còn shell 74 dòng + model/panel; 138 file backend vào 10 `Features/*` và 2 contract vào
`Shared/Contracts`; 6.607 dòng CSS
được tách thành 13 file. Chi tiết commit, gate và evidence runtime desktop nằm trong
`docs/CURRENT-STATE.md`.

> **Điểm dừng an toàn: DỪNG SAU BƯỚC 5 vẫn có giá trị trọn vẹn** — rào chắn đã dựng, bug số liệu đã sửa,
> tên đã chuẩn, contract đã có nguồn sự thật. Phần còn lại là dọn cấu trúc chứ không phải sửa lỗi.

Một cảnh báo thao tác: mọi đổi tên **chỉ khác hoa/thường** phải `git mv` 2 bước qua tên trung gian —
Windows không phân biệt hoa thường.
