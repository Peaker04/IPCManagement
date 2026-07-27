# Audit kiến trúc & Plan chỉnh sửa — IPCManagement

Ngày audit gốc: 26/07/2026 · Nhánh: `feature/production-plan` · HEAD khi audit gốc: `110e3c0`
Re-audit sau Bước 10: 27/07/2026 · HEAD code được kiểm: `24338e0` · xem Phần E–F; roadmap tại Phần F thay thế roadmap lịch sử ở Phần C cho các đợt tiếp theo.
Phạm vi: Frontend (React 19 + Vite + RTK Query) · Backend (ASP.NET Core 9 + EF Core) · Database (MySQL 9.5, schema `ipcmanagement`)
Phương pháp: đọc mã nguồn + cấu hình + lịch sử git, chạy SQL read-only trên DB thật, đo bundle từ `dist/` đã build, đối chiếu với kết quả k6 cùng ngày. Mọi phát hiện đều có `file:dòng` hoặc câu SQL kèm theo.

---

## Phần A — Chuẩn hóa khung NFR

Danh sách NFR ban đầu là bộ ISO/IEC 25010 đầy đủ (8 nhóm, ~50 thuộc tính). Dùng nguyên bộ đó cho dự án này sẽ phân tán nguồn lực vào những thuộc tính không áp dụng. Dưới đây là bản đã cắt gọt theo bối cảnh thật: **hệ nội bộ một tổ chức, vài chục người dùng đồng thời, một deployment, MySQL tự quản, FE trên Vercel, dữ liệu vận hành bếp ăn công nghiệp phải giữ 5–10 năm**.

### A1. Bổ sung một nhóm bị thiếu: Tính đúng đắn nghiệp vụ (Functional Suitability)

Danh sách gốc không có nhóm này, nhưng audit tìm ra các lỗi **sai kết quả nghiệp vụ** nghiêm trọng hơn mọi vấn đề hiệu năng. Một hệ thống nhanh mà tính sai ngày phục vụ thì vô dụng. Nhóm này phải đứng đầu:

| Thuộc tính | Vì sao áp dụng ở đây |
|---|---|
| **Functional correctness** | Bậc giá 25k/30k/34k, định lượng BOM, số suất theo ca — sai một mắt xích là sai toàn bộ nhu cầu nguyên liệu |
| **Temporal correctness** (ngày/ca/múi giờ) | Toàn bộ nghiệp vụ neo vào "ngày phục vụ" và "ca sáng/chiều". Đã phát hiện 4 lỗi thật ở đây |
| **Contract correctness** (FE↔BE) | Contract viết tay 100%, không codegen — đã phát hiện 10 điểm lệch |

### A2. Ma trận giữ / hạ / loại

| Nhóm gốc | Giữ ở mức cao | Hạ xuống thấp hoặc loại — lý do |
|---|---|---|
| **1. Hiệu năng** | Latency, Throughput, Capacity | **Loại** Elasticity, Cost-efficiency-per-unit: không chạy cloud auto-scale, không tính chi phí theo đơn vị xử lý. **Hạ** Scalability: đã đo chịu 60 RPS với p95 18ms, dư xa nhu cầu vài chục người dùng |
| **2. Độ tin cậy** | **Durability, Recoverability (RPO/RTO), Data Integrity/Consistency, Robustness** | **Hạ** Availability/SLA, MTBF/MTTR: chưa có hệ đo nào để nói về con số 99.9%. **Hạ** Fault Tolerance/Resilience: một instance, một DB — redundancy/circuit-breaker chưa phải bài toán hiện tại |
| **3. Bảo mật** | **AuthN/AuthZ, Confidentiality (secrets), Auditability, Non-repudiation** | **Hạ** Compliance: GDPR/PCI-DSS không áp dụng (không dữ liệu EU, không thẻ thanh toán). NĐ13/2023 áp dụng nhưng ở mức nhẹ nhất — dữ liệu là nhân viên + nhà cung cấp, **không có** dữ liệu nhạy cảm theo Điều 2.4 |
| **4. Vận hành** | **Observability, Deployability, Configurability, Supportability** | Giữ nguyên toàn bộ — đây là nhóm yếu nhất của dự án |
| **5. Chất lượng mã** | **Modularity, Testability, Analyzability, Simplicity** | **Hạ** Reusability: không xuất bản thư viện dùng lại ở đâu khác |
| **6. Tương thích & khả chuyển** | **Interoperability** (nhưng hiểu là *contract FE↔BE*, không phải liên thông hệ ngoài) | **Loại** Co-existence, Portability, Installability, Adaptability, Replaceability: một deployment, một môi trường. **Tách đôi i18n/l10n**: bỏ phần đa ngôn ngữ (chỉ tiếng Việt), **nâng phần l10n ngày/giờ/tiền tệ lên nhóm A1** vì đó là lỗi đúng-sai, không phải lỗi tiện nghi |
| **7. Khả dụng người dùng** | **Accessibility (WCAG 2.1 mức A trước), User Error Protection** | **Hạ** Learnability, UI Aesthetics: đã có hệ SAP Fiori nhất quán, không phải điểm yếu |
| **8. Ràng buộc phi kỹ thuật** | **Data residency** (dữ liệu ở đâu — liên quan backup off-site) | **Loại** Time-to-market, Sustainability/Green IT, Licensing: không có gì cần quyết. Licensing đã sạch (không phụ thuộc nào dính CVE hay license xung đột) |

### A3. Bộ NFR rút gọn để theo dõi (14 thuộc tính, xếp theo ưu tiên)

| # | Thuộc tính | Hiện trạng | Chỉ tiêu đề xuất |
|---|---|---|---|
| 1 | Temporal correctness | **Nguy cấp** | 0 lỗi lệch ngày/múi giờ; mọi phép tính ngày qua 1 module |
| 2 | Contract correctness FE↔BE | **Nguy cấp** | Type sinh tự động từ OpenAPI; 0 magic number |
| 3 | Durability / Recoverability | **Nguy cấp** | RPO ≤ 24h, RTO ≤ 4h, restore được diễn tập |
| 4 | AuthN/AuthZ | **Nguy cấp** | 0 endpoint `[Authorize]` trần; 1 nguồn permission duy nhất |
| 5 | Data Integrity/Consistency | **Yếu** | Mọi luồng đa bảng có transaction; invariant có unique constraint |
| 6 | Confidentiality (secrets) | **Yếu** | 0 secret trong source/lịch sử git |
| 7 | Observability | **Yếu** | Health check thật, access log, log JSON, cid tra cứu được |
| 8 | Auditability | **Yếu** | Audit đủ cho: luật duyệt, giá NCC, quyết định duyệt, đăng nhập, mọi hard delete |
| 9 | Testability | **Yếu** | FE test chạy trong CI; test không phụ thuộc ngày lịch |
| 10 | Modularity / Simplicity | **Yếu** | 0 file > 1000 dòng; ranh giới feature có lint chặn |
| 11 | Deployability | **Yếu** | Có artifact bất biến; rollback được |
| 12 | Accessibility | **Yếu** | WCAG 2.1 mức A đầy đủ (AA sau) |
| 13 | Configurability | **Khá** | Master data (bậc giá) ra khỏi code |
| 14 | Performance (Latency/Throughput) | **Tốt** | Giữ p95 danh sách < 800ms; đã đạt 16–18ms @ 60 RPS |

---

## Phần B — Hiện trạng kiến trúc

### B1. Bức tranh tổng thể

```
Browser (Chrome desktop)
  │
  ├─ React 19 + Vite 8 + TypeScript 6 · Redux Toolkit + RTK Query
  │  10 route lazy-load · 31.296 dòng src · entry 95.5 KB gzip
  │  Vercel (main/dev) — backend KHÔNG có deployment target
  │
  ▼ HTTP /api  (contract viết tay, không versioning)
  │
  ├─ ASP.NET Core 9 — MỘT project duy nhất (không phân tầng)
  │  24 controller · 62 service · 40.412 dòng src
  │  JWT + refresh rotation · rate limit · Serilog file
  │
  ▼ EF Core 9 + Pomelo (SplitQuery toàn cục, không retry, không pool tuning)
  │  11 repository — bị 76.9% bảng bỏ qua, 608 chỗ dùng DbContext thẳng
  │
  ▼ MySQL 9.5 — `ipcmanagement`
     61 bảng · 100% InnoDB · 130 FK (đều có index) · 225 index
     data 15.58 MB · index 20.97 MB · phân mảnh 17 MB
     KHÔNG backup · KHÔNG soft-delete · KHÔNG PITR
```

### B2. Điểm mạnh thật sự (phải giữ khi refactor)

Không phải mọi thứ đều cần sửa. Những thứ dưới đây làm đúng và là nền tảng để xây tiếp:

- **Schema vững**: 100% InnoDB, 130/130 FK đều có index dẫn đầu, FK trong DB khớp hoàn toàn với model EF — không có drift cấu trúc.
- **Mật mã học đúng**: BCrypt cho mật khẩu, refresh token chỉ lưu SHA-256 hash, chặn algorithm-confusion trong luồng refresh (`JwtTokenService.cs:91-97`), `ClockSkew = Zero`.
- **Không có lỗ hổng injection**: 0 raw SQL trên toàn backend, 57/57 tham số `[FromBody]` đều là DTO (không mass-assignment), 0 XSS sink ở FE, XXE không áp dụng.
- **Phụ thuộc sạch**: không gói nào dính CVE đã biết ở cả hai phía.
- **Mẫu phân tách tốt đã tồn tại**: `weekly-menu`, `chef`, `purchasing` theo đúng `model thuần + hook data + section view` — chính nó cho phép 53 file test FE tồn tại. Đây là kiến trúc tham chiếu để nhân rộng, không cần phát minh mới.
- **Kỷ luật hiệu năng FE**: query gating theo tab (69 chỗ `skip`), `useDeferredValue`/`useTransition`, route loader cache — đo được 65–83ms click-to-content, CLS 0.
- **Hiệu năng backend sau tối ưu hôm nay**: 60 RPS với p95 danh sách 16–18ms, 0% lỗi, 0 dropped iteration.

### B3. Bốn rủi ro nguy cấp

#### R1 — Không có lưới an toàn dữ liệu

Không có backup, không PITR, không soft-delete, không rollback được backend (không Dockerfile/artifact), không rollback được migration (có `Down()` nhưng chưa từng chạy/test).

Bằng chứng: `grep mysqldump` toàn repo → 0 script chạy được; `find -iname Dockerfile*` → 0; 7 bảng `backup_*_20260717_141300` nằm **cùng database** với dữ liệu gốc nên mất DB là mất cả "backup".

`stockmovements` (17.256 dòng) là sổ cái tồn kho không thể tái tạo từ nguồn khác. Một lệnh `DELETE` sai là mất vĩnh viễn, và **không ai biết chuyện đó xảy ra lúc nào** vì cũng không có access log.

#### R2 — Ba lỗ hổng chiếm quyền / phá vỡ kiểm soát

| # | Lỗ hổng | Vị trí |
|---|---|---|
| C1 | `POST /api/admin/employees/seed` gắn `[AllowAnonymous]`, tạo `admin`/`admin` quyền Admin, **không có rào chắn môi trường** (`SampleDataProductionGuardMiddleware` chỉ chặn `/api/sample-data`) | `AdminEmployeesController.cs:91-98` + `AdminEmployeeService.cs:356-389` |
| C2 | JWT secret production hardcode trong file `.cs` **được commit** (dùng làm blocklist) — ai clone repo đều ký được token Admin. Thêm nữa secret + mật khẩu DB còn nguyên trong lịch sử git tại `fdbc0e3` | `DeploymentConfigurationValidator.cs:7` |
| C3 | `ApprovalRulesController` chỉ `[Authorize]` trần → **mọi tài khoản đăng nhập** tự đặt mình làm người duyệt mọi mức tiền, hoặc xóa sạch luật duyệt. Hard delete, không audit | `ApprovalRulesController.cs:17,57,89,132` + `ApprovalRoutingService.cs:128,150` |

Gốc rễ: **phân quyền tồn tại ở hai hệ thống không đồng bộ**. Policy ASP.NET dùng `RequireRole` (phân biệt hoa/thường, so `RoleName` tự do) còn `ResolvePermissions` dùng `OrdinalIgnoreCase` + `.Trim()`. Role `"admin"` viết thường bị policy từ chối nhưng lại có toàn quyền ở mọi endpoint `[Authorize]` trần. `AdminRoles` không có `"Quản trị"` nhưng `IsAdminRole` thì có.

Hệ quả lan tỏa: 6 controller `[Authorize]` trần trở thành cửa mở — trong đó `StocktakesController` cho phép cùng một người tạo → sửa số lượng → trình → **tự duyệt** kiểm kê kho, và `WorkflowReportsController` để lộ toàn bộ chênh lệch giá theo nhà cung cấp cho mọi tài khoản, đồng thời cho phép hard-delete dữ liệu qua `data-quality/cleanup`.

#### R3 — Sai lệch thời gian xuyên suốt hệ thống

Backend serialize `DateTime` **không có hậu tố `Z`** (`Program.cs:147-152` không đăng ký DateTime converter, Pomelo trả `Kind=Unspecified`), trong khi ghi bằng `DateTime.UtcNow` (119 chỗ). FE `new Date("2026-07-26T14:30:00")` parse thành **local** → mọi timestamp hiển thị **sớm hơn thực tế 7 giờ**.

Ba lỗi ranh giới ngày đã xác nhận:

| Lỗi | Hậu quả |
|---|---|
| `getNextDayInputValue` (`AdminDataPage.tsx:131-135`) — cộng 1 ngày ở local rồi `.toISOString()` triệt tiêu | Trả về **đúng ngày đầu vào**. Hợp đồng mới có thể chồng lấn ngày cuối hợp đồng cũ |
| `getTodayInputValue` (`AdminDataPage.tsx:129`) | Trả về **hôm qua** trong khung 00:00–07:00 ICT — đúng giờ ca sáng chuẩn bị |
| `toIsoMonday(new Date())` (`purchasingModel.ts:110`) | Workbench mua hàng mở ra **tuần trước** suốt 7 tiếng đầu mỗi thứ Hai |

Backend cũng có hai định nghĩa "hôm nay" trong **cùng một file**: `CoordinationService.cs:2671` dùng `DateTime.Today` (giờ server) còn `:1809` dùng `DateTime.UtcNow`. Nếu server chạy UTC, `ResolveActiveContract` chọn sai hợp đồng → sai `menuPrice` → **sai giá thành**.

Toàn FE chỉ có **một** module xử lý múi giờ đúng: `chefServiceDate.ts:31` ghim `Asia/Bangkok` qua `Intl.DateTimeFormat`. Không nơi nào khác dùng nó.

Lý do lỗi chưa bị bắt: fixture test dùng `'2026-07-20T00:00:00Z'` — **có `Z`, thứ mà API không bao giờ gửi**. Test đang mã hóa một giả định contract sai.

#### R4 — Contract FE↔BE viết tay, không versioning

Không có codegen (`openapi-typescript`/`orval`/`nswag` đều vắng), Swagger chỉ bật ở Development (`Program.cs:256-265`) nên CI không lấy được spec. Không có `AddApiVersioning`. "Bảo chứng" duy nhất là comment tiếng Việt *"Khớp với ApiResponse&lt;T&gt; ở backend"* (`types/api.ts:3`).

Điểm lệch nguy hiểm nhất — `ApprovalDecision`:
```csharp
public enum ApprovalDecision { Approve, Reject }   // ApprovalWorkflowDto.cs:13
```
Không đăng ký `JsonStringEnumConverter` → serialize thành **số**. FE bù bằng ordinal hardcode:
```ts
body: { status: status === 'Approve' ? 0 : 1, reason }   // workflowApi.ts:2228
```
**Chèn một giá trị vào enum C# trước `Reject` sẽ biến DUYỆT thành TỪ CHỐI**, không có tín hiệu nào ở cả hai phía. Trớ trêu là `SupplierEvidenceType` cùng API lại *có* `[JsonConverter]` → hai enum, hai wire format.

Chín điểm lệch khác gồm: `SupplierDto` đảo nullability (FE khai non-null cho field BE trả `null` → crash runtime), `ProductionPlanDto` bị mirror **hai lần** với hai tập field thiếu khác nhau, `AdjustOrderAfterLockRequestDto` thiếu `quantityPlanLineId` khiến BE luôn trả 404, `DateOnly` bất đối xứng ở write path, và file chết `types/api.types.ts` đã drift 3 field.

### B4. Bảy vấn đề mức cao

| # | Vấn đề | Bằng chứng |
|---|---|---|
| H1 | **Zero observability**: không health check thật (`MapGet("/")` không chạm DB — nên `health.sh` báo xanh cả khi MySQL chết), không metrics, không tracing, **không access log** (`UseSerilogRequestLogging` vắng mặt), chỉ 26 câu lệnh log cho 40k dòng. `InvalidOperationException → 400` biến lỗi 500 thật thành 4xx nên mọi alert theo error-rate đều mù | `Program.cs:269-280`; `ExceptionMiddleware.cs:45-54`; `health.sh:6` |
| H2 | **Transaction áp dụng tùy hứng**: `InventoryReturnService.ConfirmReceiptAsync` chạm 6 bảng **không transaction** trong khi `CreateAsync` cùng file thì có. `AdminEmployeeService.CreateAsync` có **2 `SaveChangesAsync` rời rạc** — insert user fail thì roles đã commit vĩnh viễn. TOCTOU ở `StocktakeService.cs:106` và `DishService.cs:811` phá chính invariant đang bảo vệ. `CurrentStockRepository.cs:45` dùng `ExecuteUpdateAsync` **bypass RowVersion** — bảng duy nhất có optimistic lock lại có đường vòng bỏ qua nó | `InventoryReturnService.cs:170,255`; `AdminEmployeeService.cs:102,319` |
| H3 | **Repository/UoW phá vỡ toàn diện**: `IUnitOfWork` chỉ có 2 method (**không có Commit/Rollback**); `GenericRepository.AddAsync/UpdateAsync/DeleteAsync` tự gọi `SaveChanges`; **76.9% bảng không có repository**; 608 chỗ truy cập `_context` thẳng từ 22 service. Cùng file có 2 phong cách mâu thuẫn (`AddAsync` tự save vs `Add` chỉ stage) — gọi nhầm là mất transaction không cảnh báo | `IUnitOfWork.cs:8-9`; `GenericRepository.cs:75,81,90` |
| H4 | **CI không chạy frontend test**: 53 file / 299 test **chưa bao giờ chạy trong CI**. Không coverage gate, không security scan, không Dependabot. CI dựng hẳn MySQL container nhưng **không set `IPC_TEST_CONNECTION_STRING`** → integration test `return` sớm, **pass giả**. `UnitTest1.ForceRegisterMigrations` không phải test mà là công cụ **ghi 24 migration ID vào `__EFMigrationsHistory`** (danh sách đã lỗi thời — thực tế có 38) | `verify.yml:91-94`; `WorkflowLifecycleE2ETests.cs:30-33`; `UnitTest1.cs:16-74` |
| H5 | **God-object + không phân tầng**: backend **một project duy nhất** → compiler không cưỡng chế được hướng phụ thuộc nào. `WorkflowReportService.cs` 3.972 dòng/151 thành viên inject `DbContext` thẳng, bỏ qua 11 repository. `AdminDataPage.tsx` 2.258 dòng/35 useState/7 view — đặt sai feature (nằm trong `workflow` nhưng gọi `projects`+`coordination`+`admin`). 44 import chéo feature, không lint chặn | `WorkflowReportService.cs:21`; `AdminDataPage.tsx:214-245` |
| H6 | **Dialog tự viết tay**: `createPortal` + 2 `<div>`, **không focus trap, không Escape, không trả focus, không `inert` nền**. Ảnh hưởng ~20 dialog, nhiều cái gác hành động phá hủy/tài chính → **không thao tác được bằng bàn phím**. `aria-modal="true"` được set trong khi nền vẫn phơi ra cho screen reader — tệ hơn là không set | `ui/dialog.tsx:12,42`; grep `Escape` toàn repo = 3 hit |
| H7 | **Nuốt lỗi API thành empty state** ở đúng màn hình ra quyết định: API nhu cầu nguyên liệu chết → bảng hiện "Chưa có dữ liệu" → người dùng kết luận tuần này không cần mua gì. 112 chỗ `?? []` nhưng chỉ 35 `QueryErrorAlert` trên 98 call-site | `useMaterialDemand.ts:76-77`; `WeeklyMenuPage.tsx:69` |

### B5. Nợ kỹ thuật cần ghi nhận thẳng thắn

- **`double` cho tiền tệ (do đợt tối ưu hôm nay tạo ra)**: ba báo cáo price-variance đang aggregate qua `double` để tương thích SQLite trong test. Sai số thực tế nhỏ hơn nhiều so với bước `RoundMoney`, nhưng đây là **code production bị bẻ cong theo hạ tầng test**. Cách trả nợ đúng là chạy integration test trên MySQL thật (H4), rồi đưa `decimal` trở lại.
- **PK BINARY(16) từ UUIDv4 random + serialize mixed-endian** (`GuidHelper.cs:9`): index (20.97 MB) **lớn hơn** data (15.58 MB), phân mảnh 17 MB (~52% không gian cấp phát). Kéo theo 47 chỗ phải `SequenceEqual` lọc trong RAM vì EF không dịch được. Đây là chi phí kiến trúc lan tỏa, nhưng **migrate rất tốn kém** — xếp cuối.
- **Migration drift**: 38 dòng trong `__EFMigrationsHistory` vs 37 file; 2 migration mồ côi trong DB; 1 migration chưa apply **nhưng schema đã đúng** → DB đã bị vá tay ngoài đường ống EF. `backend/database/*.sql` (2.530 dòng) là nguồn sự thật song song. **Hai nhánh git có tập migration khác nhau** — merge sẽ sinh chồng lấn.
- **Tri thức vận hành nằm ngoài git**: `.gitignore` loại `docs/`, `.docs/`, `scripts/`, `tools/perf/`. `git ls-files docs/` = **1 file**. `scripts/Invoke-Iter1QualityGate.ps1` không tồn tại nhưng `package.json:32-33` vẫn gọi; `Invoke-WeeklyHappyPathE2E.ps1` không có trong git nhưng `shipyard/hooks/e2e.sh` phụ thuộc → **lane E2E không tái lập được trên máy khác**. README link tới file không tồn tại với mọi người clone. *(Chính tài liệu này cũng sẽ untracked cho tới khi sửa `.gitignore`.)*
- **Shipyard lane dùng root MySQL chung với DB chính**: `database-env.sh:4-9` luôn fallback về `appsettings.json` của repo chính (vì file bị gitignore nên lane clone không bao giờ có). Bảo vệ duy nhất là một regex thay tên database; `reset.sh` chạy `DROP DATABASE` không có allowlist.

---

## Phần C — Plan chỉnh sửa kiến trúc

Nguyên tắc: **sửa theo thứ tự rủi ro, không theo thứ tự dễ**. Mỗi giai đoạn có tiêu chí nghiệm thu đo được. Không gộp nhiều giai đoạn vào một commit.

### P0 — Chặn máu (1–2 ngày)

Mục tiêu: sau P0, một sự cố đơn lẻ không còn gây mất dữ liệu vĩnh viễn hoặc chiếm quyền hệ thống.

| # | Việc | File | Nghiệm thu |
|---|---|---|---|
| 0.1 | Xóa `[AllowAnonymous]` khỏi endpoint seed; thêm chặn theo môi trường; bỏ mật khẩu bằng username. **Kiểm tra DB xem đã tồn tại 6 tài khoản mẫu chưa** | `AdminEmployeesController.cs:92`, `AdminEmployeeService.cs:356` | Gọi endpoint khi chưa đăng nhập → 401; ở non-Development → 404 |
| 0.2 | Thêm policy cho 3 controller nguy hiểm nhất: `ApprovalRules` → `AdminAccess`; `Stocktakes` → `InventoryAccess` (approve/reject chặt hơn + người duyệt ≠ người trình); `WorkflowReports` → tách policy theo nhóm endpoint | `ApprovalRulesController.cs:17`, `StocktakesController.cs:13`, `WorkflowReportsController.cs:17` | Tài khoản role `staff` gọi 3 nhóm này → 403 |
| 0.3 | Xoay JWT secret + mật khẩu MySQL; bỏ hằng số secret khỏi `.cs`; tạo user MySQL riêng cho app (không dùng `root`) | `DeploymentConfigurationValidator.cs:7`, `appsettings.json` | `grep` secret trong source → 0; app chạy bằng user không phải root |
| 0.4 | **Backup tự động**: `mysqldump --single-transaction` theo lịch, lưu off-site, + bật binlog cho PITR. Viết quy trình restore và **diễn tập một lần** | script mới | Restore thành công vào DB tạm, đối chiếu số dòng `stockmovements` |
| 0.5 | Sửa serialize DateTime: đăng ký converter stamp `Kind=Utc` (sửa 8+ chỗ hiển thị cùng lúc); thống nhất `DateTime.Today` → `UtcNow` ở `CoordinationService` | `Program.cs:147`, `CoordinationService.cs:2671` | API trả `...Z`; test múi giờ giả lập ICT 02:00 cho kết quả đúng |
| 0.6 | Sửa 3 bug ranh giới ngày FE; đưa mọi phép tính ngày qua `chefServiceDate.ts`; xóa `dateUtils.ts:11` | `AdminDataPage.tsx:129,131`, `purchasingModel.ts:110` | Test chạy ở TZ=UTC và TZ=ICT cho cùng kết quả |
| 0.7 | Đăng ký `JsonStringEnumConverter` toàn cục; FE gửi string thay vì `0/1` | `Program.cs:147`, `workflowApi.ts:2228` | Duyệt/từ chối hoạt động đúng sau khi đảo thứ tự enum trong test |

### P1 — Nền tảng an toàn (1–2 tuần)

| # | Việc | Nghiệm thu |
|---|---|---|
| 1.1 | **Health check thật** (`/health/live`, `/health/ready` có chạm DB) + `UseSerilogRequestLogging` + log JSON (`CompactJsonFormatter`) + `WriteTo.Async` + `Log.CloseAndFlush()`; đổi `health.sh` sang endpoint mới | Tắt MySQL → `/health/ready` trả 503 |
| 1.2 | Phân loại lại exception: tạo exception nghiệp vụ riêng, để `InvalidOperationException` rơi về 500; đưa `correlationId` vào body lỗi; thêm `WithExposedHeaders("X-Correlation-ID")` vào CORS | Lỗi hệ thống → 500; người dùng đọc được mã tra cứu |
| 1.3 | **CI thật**: thêm `npm run test:fe:unit`; set `IPC_TEST_CONNECTION_STRING` để integration test chạy trên MySQL; đổi `return` sớm thành skip có báo cáo; xóa `UnitTest1.cs`; thêm `concurrency: cancel-in-progress`, cache NuGet, Dependabot, CodeQL | CI đỏ khi FE test fail; log CI hiện số integration test đã chạy |
| 1.4 | Gỡ `docs/`, `scripts/`, `tools/perf/` khỏi `.gitignore` và commit; sửa/xóa 2 npm script trỏ file không tồn tại | Clone mới chạy được `npm run e2e:weekly` |
| 1.5 | **Bọc transaction** cho mọi luồng đa bảng (ưu tiên `InventoryReturnService.ConfirmReceiptAsync`, `InventoryIssueService.ConfirmReceiptAsync`, `AdminEmployeeService.CreateAsync`); thêm unique constraint cho invariant TOCTOU; bật `EnableRetryOnFailure` + `CommandTimeout` | Test đồng thời 2 request không sinh dữ liệu trùng |
| 1.6 | Security headers: `UseHsts` + `nosniff` + `X-Frame-Options` + CSP trên Vercel (**xác định file `vercel.json` nào authoritative trước** — hiện có 2 file chồng chéo) | Kiểm tra header bằng curl |
| 1.7 | `UseForwardedHeaders` + `Secure = !IsDevelopment()` cho cookie; đặt `api-general` làm global rate limiter (opt-out thay vì opt-in) | Sau proxy, rate limit phân partition đúng theo IP thật |
| 1.8 | `[RequestSizeLimit]` cho 4 endpoint upload + giới hạn vùng merged-cell trong parser XLSX (hiện `ref="A1:XFD1048576"` treo worker vô hạn) | Upload file 50MB → 413; file merged-cell độc hại → 400 |
| 1.9 | **Đưa `isError` vào các hook `use*`** và bắt page render `QueryErrorAlert`; `EmptyState` phân biệt "rỗng thật" vs "lỗi"; lint rule cấm bỏ `isError` | Ngắt API demand → hiện alert lỗi, không phải "Chưa có dữ liệu" |

### P2 — Kiến trúc (3–4 tuần)

| # | Việc | Nghiệm thu |
|---|---|---|
| 2.1 | **Hợp nhất hai hệ permission** — đây là hạng mục kiến trúc đáng giá nhất: phát hành claim bằng `RoleCode` viết hoa thay vì `RoleName` tự do; một bảng ánh xạ duy nhất cho cả policy và `ResolvePermissions`; bỏ `"*"`, luôn trả mảng tường minh; hợp nhất `/auth/profile` và `/auth/me` | Role `"admin"`, `"Quản trị"`, `" Admin"` cho kết quả giống nhau ở mọi endpoint |
| 2.2 | **Codegen contract**: bật Swagger ở mọi môi trường (hoặc export `openapi.json` trong CI) + `openapi-typescript` + script `gen:api`; xóa `types/api.types.ts` chết; thêm API versioning `/api/v1` | CI fail khi type FE lệch DTO BE |
| 2.3 | **Thay `ui/dialog.tsx` bằng `@base-ui/react/dialog`** — đã là dependency sẵn, API khớp gần 1-1. Đóng cả 3 vi phạm WCAG cùng lúc. Thêm `@axe-core/playwright` vào `ui-audit.spec.ts` | axe không báo violation mức A trên 10 route; Tab không thoát khỏi dialog; Escape đóng |
| 2.4 | Sửa ~15 control thiếu label (`htmlFor`), thêm `scope`/`caption` cho bảng, sửa contrast `text-slate-400` → `text-slate-500` | axe pass; NVDA đọc đúng nhãn 4 ô lọc audit |
| 2.5 | **Tách `WorkflowReportService`** (3.972 dòng) thành 5–6 service theo nhóm báo cáo; bỏ cặp `GetXxx`/`GetXxxPage` trùng lặp; chuyển sang projection `.Select()` thay vì 437 eager-load | 0 file backend > 1.500 dòng |
| 2.6 | **Tách `AdminDataPage`** thành 7 component theo tab, chuyển sang `features/admin`; rút helper trùng lặp (`getMutationErrorMessage` bị copy 7 lần) ra `lib/`; tách `workflowApi.ts` thành 5 module theo domain | 0 file FE > 800 dòng; thêm `eslint-plugin-boundaries` chặn import chéo |
| 2.7 | **Quyết dứt điểm repository**: hoặc bỏ `SaveChanges` khỏi repository + bổ sung `Commit/Rollback` vào UoW, **hoặc** bỏ hẳn repository và chuẩn hóa DbContext + CQRS. Hiện tại tệ nhất vì có cả ba phong cách | 1 phong cách truy cập dữ liệu duy nhất trong `Services/` |
| 2.8 | **`IAuditService` tập trung** thay 48 điểm gọi rời rạc; bổ sung audit cho luật duyệt, giá NCC, quyết định duyệt, tạo tài khoản, đăng nhập, mọi hard delete; thêm cột `ipAddress`/`correlationId`/`action`; user MySQL chỉ `INSERT`/`SELECT` trên `auditlogs` | Sửa luật duyệt → có audit row join được với log |
| 2.9 | Inject `TimeProvider` (.NET 8 BCL) thay 142 chỗ `DateTime.*`; dùng `FakeTimeProvider` trong test | Test SLA/hết hạn token chạy xác định, không phụ thuộc ngày lịch |
| 2.10 | Chốt **EF Migrations là nguồn sự thật duy nhất**: archive `backend/database/*.sql` sang `legacy/`; dựng lại DB dev từ migration sạch để xác thực; CI so khớp `__EFMigrationsHistory` với file; hợp nhất 2 nhánh trước khi thêm migration mới | ~~Dựng DB mới từ 0 bằng `dotnet ef database update` chạy được toàn bộ E2E~~ — **xem đính chính 27/07 bên dưới** |

> **Đính chính 27/07/2026 cho mục 2.10.** Tiêu chí nghiệm thu "dựng DB mới từ 0 bằng `dotnet ef database update`"
> **không đạt được như đang viết**, và đây là dữ kiện đã kiểm chứng bằng thực nghiệm chứ không phải suy đoán:
> chuỗi migration **không tự dựng được database từ trắng**. Migration đầu tiên
> (`20260605013906_AddCurrentStockTable`) tham chiếu `warehouses`, mà **không migration nào tạo** `warehouses`
> hay các bảng nền khác (`users`, `ingredients`, `units`, `suppliers`…). Chuỗi vốn được thiết kế để chạy **đè lên**
> baseline `backend/database/IPCmanagement.sql`. Chạy thử từ database trắng: hỏng ngay migration đầu tiên,
> 0/38 áp dụng, lỗi `Failed to open the referenced table 'warehouses'`.
>
> Hệ quả cho kế hoạch 2.10: **không thể chỉ archive `backend/database/*.sql` sang `legacy/`** — làm vậy là bỏ đi
> thứ mà chuỗi migration đang phụ thuộc. Muốn EF Migrations thành nguồn sự thật duy nhất thì trước hết phải
> viết một migration khởi tạo dựng toàn bộ bảng nền, rồi mới nói tới chuyện archive. Đây là hạng mục lớn hơn
> mô tả hiện tại đáng kể.
>
> Phần đã làm được của 2.10 tính đến 27/07: CI **có** replay migration trên MySQL thật và **có** so khớp schema
> sinh từ migration với schema sinh từ model (723/723 dòng khớp). Đường cài mới đã đúng bằng model. Chi tiết và
> giới hạn đã biết của phép so ở `docs/CURRENT-STATE.md`, mục "Sự cố mất dữ liệu và củng cố tầng database".
>
> Quan sát ở dòng 167 ("2 migration mồ côi trong DB; 1 migration chưa apply nhưng schema đã đúng") đã được xác
> nhận lại: 2 ID mồ côi là `20260626043000_SeedTemporaryBomData` và
> `20260705121500_AddCompletedMealQuantityPlanStatuses`; migration "chưa apply nhưng schema đã đúng" là
> `20260708130000_RestorePurchaseRequestReceiptStatuses` — thực chất **EF chưa bao giờ nhìn thấy nó** vì thiếu cả
> `.Designer.cs` lẫn `[Migration]` inline. File đó đã được xoá ngày 27/07.

### P3 — Tối ưu và trả nợ (sau khi P0–P2 ổn định)

| # | Việc | Ghi chú |
|---|---|---|
| 3.1 | Trả nợ `double` → `decimal` cho báo cáo tiền tệ | Chỉ làm được sau 1.3 (test chạy trên MySQL thật) |
| 3.2 | `Dockerfile` cho backend → có artifact bất biến → rollback theo tag | Mở đường cho blue-green |
| 3.3 | `manualChunks` (`vendor-react`/`vendor-redux`/`vendor-ui`); self-host font Inter; điều tra `select-*.js` 39 KB gzip | Ước entry 95.5 → 35–40 KB gzip |
| 3.4 | Quyết định dứt điểm giữa Tailwind và hệ `.ipc-*` 334 class viết tay (6.607 dòng CSS, 197 KB không split) | Đang trả tiền cho hai hệ thống styling |
| 3.5 | Đưa master data ra khỏi code: `SupportedBomPriceTiers = [25000, 30000, 34000]` đang là hằng số biên dịch | Thêm bậc giá cho khách hàng mới = sửa code + deploy |
| 3.6 | Vệ sinh schema: drop 7 bảng `backup_*`, 5 index thừa; thêm index `auditlogs(entityName,entityId,changedAt)` và `inventoryreceipts(receiptDate)` (đã chứng minh table scan); sửa collation `unitnormalizationreviews`; `OPTIMIZE TABLE` thu hồi 17 MB | Rẻ, làm bất cứ lúc nào |
| 3.7 | PK UUIDv7 time-ordered + `.ToByteArray(bigEndian: true)` | Tốn kém nhất, lợi ích rõ nhưng không cấp bách ở quy mô hiện tại |
| 3.8 | Hồ sơ DPIA + quy trình ứng phó sự cố 72h + chính sách lưu trữ (NĐ13/2023) | Chỉ khả thi sau khi có audit đăng nhập (2.8) |
| 3.9 | Quyết định dứt điểm desktop-only hay responsive — hiện đang trả tiền cho responsive mà không giao được nó (`MainLayout` không có breakpoint nào trong khi component con có 121 lượt) | |

---

## Phần D — Ghi chú về độ tin cậy của audit

- Số liệu DB lấy từ `information_schema` và `COUNT(*)` thật trên `ipcmanagement` lúc 26/07/2026, không phải ước lượng `TABLE_ROWS`.
- Bundle size đo từ `dist/` build ngày 26/07 12:59, không phải ước tính.
- Số liệu hiệu năng (60 RPS, p95 16–18ms) từ k6 cùng ngày, sau khi đã tối ưu price-variance.
- Các con số contrast tính từ hex token trong `styles/index.css` với nền giả định — hàng bảng cần kiểm lại trên pixel thật vì `nth-child(even)` đổi nền.
- Nhận định "focus ring hiện vẫn thấy nhờ `index.css:197` không bọc `@layer`" dựa trên đọc cascade, chưa verify trên trình duyệt.
- Branch protection của GitHub không kiểm tra được từ repo — chỉ kết luận được phần nằm trong mã nguồn.

---

## Phần E — Re-audit sau Bước 10: mức hoàn chỉnh của `f(data, state)`

### E1. Kết luận

**Chưa hoàn chỉnh.** Dự án đã hoàn thành phần nền quan trọng của `f(data, state)` — contract sinh từ
OpenAPI, model thuần ở một số workflow, error state an toàn hơn và giữ dữ liệu cũ khi refetch trên các
trang trọng yếu — nhưng chưa có một hợp đồng trạng thái thống nhất từ query boundary tới view.

Mức hoàn chỉnh hợp lý theo code hiện tại là **khoảng 55–60%**, không phải 100%. Đây là đánh giá về
kiến trúc trình bày dữ liệu, không phủ nhận việc Bước 1–10 đã hoàn tất đúng phạm vi. Bước 10 chủ yếu sửa
placement, dependency và kích thước file; nó không được thiết kế để hoàn tất ma trận tám trạng thái.

Định nghĩa đích cần dùng từ đây:

```text
renderedView = f(authoritativeData, queryState, localUiState, permissions)
```

Trong đó `f` phải là phép dẫn xuất kiểm thử được và không tự gọi API. Hook/page model là imperative shell
thực hiện I/O; model/presenter là functional core; component trình bày chỉ render kết quả đã phân loại.
Không yêu cầu EF Core, controller hoặc mọi component lá phải trở thành hàm thuần.

### E2. Scorecard theo từng lớp

| Lớp | Hiện trạng sau Bước 10 | Mức hoàn chỉnh |
|---|---|---:|
| Contract dữ liệu BE→FE | 5 API module đã derive wire type từ OpenAPI; regenerate deterministic | **85%** |
| Pure model/presentation | Weekly Menu có mẫu `state/status/actions/presentation`; purchasing và chef có model thuần cục bộ | **65%** |
| Query-state contract | Chưa có `QueryView<T>`/`ViewState<T>` chung; hook trả các boolean rời rạc | **35%** |
| Tám trạng thái | Error/refreshing có pilot; uninitialized, success và partial chưa được biểu diễn có hệ thống | **35%** |
| Component boundary | 8/8 component dữ liệu chung vẫn chỉ nhận mảng; 3/3 table shell chỉ là layout | **25%** |
| Guardrail/test | Có lint chống nuốt query error và test lỗi cục bộ; chưa có convention bắt exhaustiveness của state union | **50%** |

Phần contract chưa đạt 100% vì còn bốn success response không có JSON schema và hai legacy hook đang giữ
public surface cho route backend không tồn tại. Đây là nợ contract riêng, không phải lý do viết lại type FE
bằng tay.

### E3. Bằng chứng định lượng hiện tại

Quét `frontend/src` tại HEAD `24338e0`:

| Tín hiệu RTK Query | Số lượt xuất hiện |
|---|---:|
| `isLoading` | 138 |
| `isFetching` | 142 |
| `isError` | 163 |
| `skip:` | 80 |
| `isUninitialized` | **0** |
| `isSuccess` | **0** |

Điều này có nghĩa 80 query có khả năng ở trạng thái “chưa đủ điều kiện chạy”, nhưng view không đọc trạng
thái canonical của RTK Query để phân biệt nó với dữ liệu rỗng. `success` hiện là nhánh mặc định ngầm, không
phải một state được kiểm tra exhaustively.

Tám component dùng chung sau vẫn nhận collection thuần và tự suy luận `length === 0`:
`DemandSummary`, `WorkQueue`, `RoleInbox`, `DocumentRail`, `ApprovalQueue`, `ExceptionLane`,
`StockMovementTable`, `ContextStrip`. Ba shell `DataTableShell`, `TableViewport`,
`PaginatedTableFrame` chỉ sở hữu layout/scroll và không nên bị ép sở hữu API state.

`isTruncated` đã tồn tại trong contract và mapper của `workflowApi.ts`, nhưng chưa có presentation state
“đang xem N/M” tương ứng. Forbidden hiện được xử lý tốt ở route guard `/403`, nhưng chưa có query-level
classification dùng chung cho response 403. Vì vậy `partial` và `forbidden` vẫn có thể bị diễn giải thành
empty ở các data panel riêng lẻ.

### E4. Phần đã làm đúng và phải giữ

- `EmptyState` đã dùng discriminated union để bắt `onRetry` cho `variant="error"`; không đổi ngược về
  component props tùy chọn mơ hồ.
- Weekly Menu đã có các workflow trả `state/status/actions/presentation`; đây là mẫu gần đích nhất.
- Material Demand, Production Plan, Warehouse, Approval, Reports và các panel Admin quan trọng đã phân biệt
  nhiều lỗi tải dữ liệu với empty state; lint hiện chỉ còn bốn warning baseline ở hai trang approvals.
- Weekly Menu, Chef và Warehouse giữ panel cũ khi `isFetching`, dùng overlay `Đang cập nhật`; phải giữ
  hành vi này để không phá CLS warm 0 và cache/navigation performance.
- Contract OpenAPI và view/domain model FE là hai lớp khác nhau. Chỉ wire type được sinh; view model tiếp tục
  do frontend sở hữu.
- `TableViewport`/`PaginatedTableFrame` tiếp tục chỉ làm layout. State boundary nên nằm ở section/container
  sở hữu query, không đẩy tám trạng thái vào mọi `<table>` lá.

### E5. Khoảng trống kiến trúc còn lại

1. **Không có state algebra dùng chung.** Mỗi hook tự trả một tập boolean khác nhau; page phải tự quyết thứ
   tự ưu tiên giữa loading/error/empty/refetch.
2. **`uninitialized` vẫn bị mất.** Query `skip` vì chưa chọn khách hàng/ngày/tab có thể render giống empty.
3. **`partial` chưa tới UI.** Server có `isTruncated`, nhưng view chưa buộc cảnh báo dữ liệu bị cắt.
4. **`success` là default fall-through.** Thêm một state mới không làm TypeScript báo thiếu nhánh.
5. **Forbidden chỉ chắc ở route level.** Panel gọi nhiều endpoint có permission khác nhau chưa có quy ước
   chung cho 403.
6. **Refreshing chưa nhất quán.** Một số trang giữ stale data đúng, số khác chỉ expose `isFetching` hoặc thay
   nội dung cục bộ.
7. **Page model lớn vẫn là imperative bag.** `useAdminDataPageModel` trả hơn một trăm field phẳng;
   `useReportsPageModel` và một số hook chef/purchasing trộn data, query flags, form state và action.
8. **Backend chưa có functional-core boundary rộng.** Parser/reconciliation và một số policy đã deterministic,
   nhưng các god service vẫn trộn EF query, quyết định nghiệp vụ, transaction, mapping và response assembly.

### E6. Quyết định kiến trúc cập nhật

Không sửa bằng một `QueryProvider` toàn cục và không truyền tám boolean qua mọi component. Dùng một
discriminated union nhỏ ở query-owning boundary:

```ts
type QueryView<T> =
  | { phase: 'uninitialized'; instruction: string }
  | { phase: 'loading' }
  | { phase: 'forbidden'; message: string }
  | { phase: 'error'; message: string; retry: () => void; isRetrying: boolean }
  | {
      phase: 'ready';
      data: T;
      isRefreshing: boolean;
      truncation: { shown: number; total?: number } | null;
    };
```

`empty` được dẫn xuất duy nhất từ `phase === 'ready'` và collection rỗng. `refreshing` tiếp tục là trục
riêng của `ready`; không thay stale data bằng skeleton. Adapter từ RTK Query result sang `QueryView<T>` là
hàm thuần, có test bảng tám trạng thái và xử lý 403 tường minh.

### E7. Các finding lịch sử không còn được dùng như hiện trạng

- R1 “không có backup” trong audit gốc đã stale: Scheduled Task `IPC-DB-Backup` đang `Ready`, chạy bốn giờ
  một lần; lần chạy 27/07/2026 17:00:01 có result `0`. Rủi ro còn lại là backup cùng ổ D, phụ thuộc
  task/user Windows và chưa có bản sao off-site được diễn tập restore định kỳ.
- Contract viết tay, enum ordinal, timestamp UTC converter, migration replay CI, health/readiness và phần lớn
  lỗ hổng G0 đã được xử lý trong Bước 1–9; không đưa lại vào roadmap mới như việc chưa bắt đầu.
- `AdminDataPage.tsx` không còn là file 2.305 dòng trong `features/workflow`; shell hiện ở
  `src/app/pages/AdminDataPage.tsx`, còn page model tại `src/app/pages/admin-data/useAdminDataPageModel.ts`.
- Con số file/dòng và dependency ở Phần B–C là snapshot 26/07. Khi xung đột, dùng Phần E–F, bản đồ
  `.planning/codebase/*` và source hiện tại làm nguồn sự thật.

---

## Phần F — Workflow xử lý kiến trúc thống nhất sau Bước 10

Đây là **một workflow duy nhất**, hợp nhất roadmap `f(data, state)` với P0–P3 của audit kiến trúc. Các bước
chạy theo đúng thứ tự:

```text
Bước 11 → Bước 12 → Bước 13 → Bước 14 → Bước 15 → Bước 16 → Bước 17 → Bước 18
 nền/gate    pilot      BE boundary  BE use case   FE boundary  FE state      persistence  đóng audit
```

Không mở một roadmap phụ trong lúc thực hiện. Một bước chỉ được chuyển sang bước sau khi gate của nó xanh.
Mỗi lát nghiệp vụ là một commit nguyên tử; không push, không reset/seed database, không di chuyển migrations
và không big-bang restructure.

| Nguồn yêu cầu cũ | Đã được hợp nhất vào |
|---|---|
| Hợp đồng `f(data, state)` + guardrail | Bước 11 |
| Pilot Material Demand + Warehouse | Bước 12 |
| P0 khóa backend boundary | Bước 11 baseline + Bước 13 trả hết cycle |
| P1 tách controller/service theo use case | Bước 14 |
| P2 frontend boundary | Bước 15 |
| Nhân rộng state boundary | Bước 16, sau khi path/ownership ổn định |
| P3 persistence/reliability | Bước 17 |
| Test monolith + file-growth thresholds + docs | Bước 18 |

### Bước 11 — Dựng nền và khóa baseline cho toàn workflow

**Mục tiêu:** tạo guardrail trước khi tiếp tục thay đổi cả FE lẫn BE.

- Định nghĩa `QueryView<T>` và adapter thuần từ RTK Query result.
- Test đủ uninitialized, loading, ready-empty, ready-success, refreshing, partial, forbidden và error.
- Lint chặn query đã phân loại nhưng vẫn dùng `query.data ?? []`.
- Thêm backend architecture test ở chế độ baseline: khai dependency direction dự kiến, chặn cạnh/cycle mới
  trong khi bốn cycle cũ được trả ở Bước 13.
- Đóng băng baseline 54 dependency violation FE; cấm phát sinh vi phạm mới.
- Thêm báo cáo kích thước file/action-count ở chế độ warning, chưa block code cũ trong bước nền.

**Gate 11:** full BE/FE/contract/dependency gates xanh; migration diff bằng 0; guardrail cố ý vi phạm phải đỏ.

**Trạng thái: hoàn tất ngày 27/07/2026.** `QueryView` + lint guardrail tại `d2a5d62`;
backend dependency baseline tại `d877d83`; growth reporter tại `c549bd2`; contract build cô lập khỏi
binary API Release đang chạy tại `6a5259b`. Gate: BE **631 pass / 1 skip**, FE **341/341**, lint
**0 error / 4 warning baseline**, không có dependency violation mới, contract deterministic, EF không có
model change chưa migration và production build xanh. Bốn backend cycle legacy được ceiling hóa, chỉ
được giảm trong Bước 13.

### Bước 12 — Pilot và chốt mẫu `f(data, state)`

**Mục tiêu:** chứng minh state contract hoạt động trên hai luồng quyết định thật trước khi nhân rộng.

- Pilot Material Demand/Weekly Menu.
- Pilot Warehouse current stock + stock ledger.
- Giữ nguyên request/response, endpoint, query args, RTK Query cache key/tag, URL và business behavior.
- Browser headed kiểm tra đúng 1365×900, 1280×900 và 768×1024; mobile ngoài scope.
- Evidence phải có screenshot cuối, request API sau action, console/page error, long task và CLS.

**Gate 12 — go/no-go:** tám trạng thái render đúng; forbidden không retry; refreshing giữ data cũ; partial
không bị coi là complete; CLS warm vẫn 0; fan-out refetch không tăng. Nếu một pilot vượt hai ngày hoặc phá
performance contract thì dừng để sửa mẫu, không nhân rộng.

**Trạng thái: hoàn tất ngày 27/07/2026.** Hai pilot đã commit: Material Demand
`71656bc`, Warehouse `87ad944`. Browser headed trên `1365×900`, `1280×900`, `768×1024` dùng
ANV tuần 20/07 và database lane hiện hành: mọi API response đều 2xx, 0 request fail, 0
console/page error, warm revisit 0 API request/0 long task/CLS 0 và không viewport nào page-overflow.
Evidence: `.artifacts/shipyard-live/query-view-pilot-performance.json` và sáu ảnh
`query-view-{material-demand,warehouse-movement}-*.png`. State/component contract **21/21** xanh;
full static gate kế thừa Gate 11 vẫn xanh.

### Bước 13 — P0: khóa backend boundary thật sự

**Mục tiêu:** biến VSA từ cấu trúc folder thành dependency boundary được compiler/test bảo vệ.

- Chốt dependency DAG rõ ràng.
- Loại bốn cycle: `Purchasing↔Reports`, `Planning↔Purchasing`, `Coordination↔SampleData`,
  `Approvals↔Coordination`.
- Chỉ chuyển DTO thực sự dùng chung và ổn định vào `Shared/Contracts`.
- Đưa interface/port về đúng feature sở hữu.
- Bỏ direct `IpcManagementContext` khỏi `PurchaseRequestsController` và `ApprovalHistoryController`.
- Không di chuyển `Migrations`, không đổi schema và không gom refactor use case vào bước boundary.

**Gate 13:** architecture test không còn baseline cycle; controller không truy cập DbContext trực tiếp;
namespace/path gate và migration diff đều xanh.

**Trạng thái:** đang thực hiện. Cycle `Purchasing↔Reports` đã gỡ tại `97bb33f`:
`Purchasing→Reports` từ 3 reference về 0 và ceiling legacy đã bỏ, nên tái xuất hiện sẽ
làm architecture test đỏ. `WorkflowReportQueryDto`/`WorkflowReportPageQueryDto` chuyển nguyên
contract sang `Shared/Contracts`; `PurchasePlanReportDto` về Purchasing; price-exception classification
dùng `PurchasePricePolicy`. Còn ba cycle và hai controller truy cập DbContext trực tiếp.

### Bước 14 — P1: tách backend theo use case và functional core

**Mục tiêu:** xử lý controller/service đang phình sau khi dependency direction đã ổn định.

Thực hiện tuần tự, mỗi mục là một commit/plan độc lập:

1. `CoordinationController` + `CoordinationService`: order; customer contract; portion rule; weekly
   menu/import; meal quantity plan; lock/signoff/export.
2. `WorkflowReportsController` + `WorkflowReportService`: inventory; demand/purchasing; price variance;
   audit/data quality/KPI. Controller không giữ cache/single-flight/CSV command logic.
3. `PurchaseRequestsController`: EF query/filter/mapping đi vào query/application service.
4. `DishesController` + `DishService`: catalog; BOM; BOM import/validation.
5. `PurchaseRequestWorkflowService`: state transition/policy thuần tách khỏi EF, transaction và clock.

Không đổi một file lớn thành nhiều partial file cùng responsibility. Pure policy/projection/state transition
là functional core có test không cần DB; application service giữ imperative shell.

**Gate 14:** controller chỉ điều phối; pure core chạy không cần DB; API contract không drift; hành vi nghiệp vụ
và transaction boundary hiện có được characterization test bảo vệ.

### Bước 15 — P2a: sửa frontend structural boundary trước khi rollout state

**Mục tiêu:** ổn định ownership/import path để Bước 16 không phải migrate state hai lần.

- Tách `workflowApi.ts` thành endpoint module thuộc từng feature.
- Giữ đúng một `apiSlice`, base query và cache-tag registry để cache behavior không đổi.
- Chuyển `MainLayout` sang `app/layout`.
- Giải quyết `projects→coordination` bằng ownership hoặc shared API/contract rõ ràng; không đổi tên feature
  trước khi xóa dependency.
- Xử lý 54 violation thành zero-baseline; ngoại lệ bắt buộc có lý do, owner và ngày hết hạn.

**Gate 15:** endpoint name/query key/cache invalidation không đổi; navigation/cache tests xanh; không còn
feature cycle hoặc import ngược không có whitelist.

### Bước 16 — P2b: nhân rộng `f(data, state)` trên cây FE đã ổn định

**Mục tiêu:** hoàn tất state boundary mà không chồng lên một đợt di chuyển file khác.

- Thứ tự: Purchasing → Approvals → Reports → Admin → Chef → Coordination.
- Mỗi feature một commit; mọi query có `skip` phải biểu diễn uninitialized.
- Trả hết bốn warning `no-swallowed-query-error`.
- Render partial/truncation cho response có `isTruncated` hoặc limit không có pager đầy đủ.
- Query-level 403 phải thành forbidden, không retry và không empty.
- Refreshing giữ stale data đúng cache key; không thay toàn panel bằng skeleton.
- Sau khi state contract ổn định, tách `useAdminDataPageModel` và `useReportsPageModel` theo panel/use case.
- Common leaf component tiếp tục presentation-only; không truyền tám boolean xuống mọi table.

**Gate 16:** không còn data-owning page coerce lỗi/skip thành mảng rỗng; component/browser state matrix xanh;
ba viewport mục tiêu không overflow và CLS warm giữ 0.

### Bước 17 — P3a: persistence và reliability

**Mục tiêu:** trả nợ data/retry sau khi use case và ownership đã ổn định để tránh sửa mapping hai lần.

- Tách EF mapping sang `IEntityTypeConfiguration<T>` theo feature; `IpcManagementContext` chỉ là
  registration root.
- Chuẩn hóa transaction runner cùng execution strategy trước khi bật retry.
- Thay `InvalidOperationException` nghiệp vụ bằng domain/application exception có HTTP mapping rõ.
- Khôi phục canonical migration lineage mà không reset/seed dữ liệu.
- Giữ `IPC-DB-Backup`, bổ sung bản sao khác ổ/máy và restore rehearsal có evidence.

**Gate 17:** transient retry không nhân đôi side effect; fresh/install và upgrade lineage giải thích được;
restore drill đạt RPO/RTO đã chốt; schema/data chính không bị reset.

### Bước 18 — P3b: đóng test monolith, growth gate và tài liệu

**Mục tiêu:** biến các ngưỡng audit thành quality gate lâu dài và kết thúc workflow bằng evidence đầy đủ.

- Tách `WorkflowGenerationTests.cs` theo workflow và fixture builder, giữ nguyên coverage hành vi.
- Bật growth gate theo hai tầng:
  - Controller warning khi `>250` dòng hoặc `>12` actions; `>400` dòng hoặc `>20` actions bắt buộc plan split.
  - Service warning khi `>600` dòng; `>1.000` dòng bắt buộc plan split.
  - File FE viết tay warning khi `>600` dòng.
  - Test suite warning khi `>1.500` dòng.
- Sau một chu kỳ ổn định, chuyển các ngưỡng đã trả nợ từ warning sang blocking gate.
- Đồng bộ `ARCHITECTURE`, `TESTING`, `CURRENT-STATE` và audit với code/runtime thực tế.

**Gate kết thúc workflow:** full backend/frontend/contract/dependency/migration gates xanh; browser headed
desktop xác nhận FE state + request/response BE + trạng thái render sau reload; secret scan và
`detect_changes` sạch; không push tự động.
