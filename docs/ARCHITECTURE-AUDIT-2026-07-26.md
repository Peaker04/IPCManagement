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

## Phần C — Sổ finding lịch sử (không phải workflow thực thi)

Phần này chỉ giữ ID và bằng chứng của audit ngày 26/07/2026 để truy vết. Các nhãn ưu tiên
P0–P3 cũ đã ngừng dùng để giao việc; **không thực thi các bảng dưới đây như một plan thứ hai**.
Mọi hạng mục kiến trúc còn hiệu lực đã được nhập vào duy nhất Bước 11→18 tại Phần F; khi
trạng thái, thứ tự hoặc gate mâu thuẫn, **Phần F là nguồn điều khiển duy nhất**.

Nguyên tắc lịch sử: sửa theo thứ tự rủi ro, mỗi giai đoạn có tiêu chí nghiệm thu đo
được và không gộp nhiều giai đoạn vào một commit.

### C1 — Finding chặn máu (ID cũ 0.x)

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

### C2 — Finding nền tảng an toàn (ID cũ 1.x)

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

### C3 — Finding kiến trúc (ID cũ 2.x)

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

### C4 — Finding tối ưu và trả nợ (ID cũ 3.x)

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

## Phần F — Workflow kiến trúc duy nhất sau Bước 10

Đây là **plan thực thi duy nhất**, không phải roadmap `f(data, state)` kèm thêm
một roadmap P0–P3. Toàn bộ việc của hai danh sách cũ được nhập trực tiếp thành work
package của Bước 11→18, dùng chung dependency, gate và trạng thái. Từ đây không giao việc,
commit hay báo tiến độ bằng nhãn P0/P1/P2/P3 nữa; chỉ dùng số Bước 11–18 bên dưới.

```text
Bước 11 → Bước 12 → Bước 13 → Bước 14 → Bước 15 → Bước 16 → Bước 17 → Bước 18
 state core    pilot      state rollout VSA boundary  functional   persistence  FE ownership  close/gates
```

### Hàng đợi thực thi đã hợp nhất

| Bước | Work package thuộc chính bước này | Dependency | Trạng thái |
|---|---|---|---|
| 11 | `QueryView<T>`, adapter thuần, ma trận tám trạng thái và lint guardrail | Bước 10 | **Hoàn tất** |
| 12 | Pilot Material Demand + Warehouse và browser evidence | 11 | **Hoàn tất** |
| 13 | Rollout state boundary: Purchasing → Approvals → Reports → Admin → Chef → Coordination | 12 | **Hoàn tất** |
| 14 | Architecture test + dependency DAG; gỡ bốn cycle; chuyển shared DTO/interface về đúng owner; bỏ controller→DbContext; không di chuyển migration/big-bang | 13 theo thứ tự logic; đã thực hiện sớm | **Hoàn tất sớm do numbering cũ** |
| 15 | Tách use case thật cho Reports → Coordination → Purchasing → Catalog → SampleData; tách pure policy/state transition khỏi EF/transaction | 13 + 14 | **Active tiếp theo: Reports** |
| 16 | EF mapping theo feature; transaction execution strategy; domain exception; canonical migration lineage; backup off-site/restore rehearsal | 15 | Chưa bắt đầu |
| 17 | Tách endpoint module nhưng giữ một `apiSlice`; chuyển `MainLayout`; giải quyết `projects→coordination`; xử lý 54 violation; thu nhỏ page model | 13 + 15 + 16 | Chưa bắt đầu |
| 18 | Tách test monolith/fixture builder; áp ngưỡng growth; full quality gate; đồng bộ tài liệu | 11–17 | Chưa bắt đầu |

Như vậy, bốn nhãn cũ đã biến mất khỏi execution queue: boundary cũ nằm trong
Bước 14; tách use case trong Bước 15; persistence trong Bước 16; frontend boundary
trong Bước 17; test/growth/documentation trong Bước 18. Các mục chi tiết dưới đây là
acceptance criteria của chính hàng đợi này, không phải một plan thứ hai.

### Quy tắc chạy chung cho Bước 11→18

- Mỗi bước chỉ được đóng khi gate của chính bước đó xanh; mỗi feature/use case là
  một commit nguyên tử, không gom thành big-bang restructure.
- Trước khi sửa symbol phải chạy GitNexus upstream impact, báo HIGH/CRITICAL và phủ toàn
  blast radius đã được cho phép. Trước commit phải chạy `detect_changes` trên staged diff.
- Giữ nguyên UI/API/cache/business behavior trừ khi một bước nói rõ khác; OpenAPI regenerate phải
  deterministic và không sửa type FE viết tay thay cho generated contract.
- Không push, không reset/seed database, không di chuyển migrations. Mọi DB gate chạy trên đúng
  lane/database hiện hành sau khi kiểm tra lineage và evidence cần bảo toàn.
- Browser gate chỉ kiểm website tại `1365×900`, `1280×900`, `768×1024`; mobile ngoài scope.
  Kết luận E2E phải đối chiếu FE control/render, BE request/response và DB transition/reload.
- Bước 14 đã hoàn tất sớm dưới tên “Bước 13” cũ; không rollback các commit đã qua gate.
  Gate 13 nay đã xanh; luồng active chuyển sang Bước 15, bắt đầu từ Reports.

### Bước 11 — Khóa hợp đồng `f(data, state)`

**Mục tiêu:** có một state algebra chung, exhaustively testable tại query-owning boundary.

- Tạo `QueryView<T>` và adapter thuần từ RTK Query result.
- Phủ đủ uninitialized, loading, ready-empty, ready-success, refreshing, partial, forbidden và error.
- Empty chỉ được dẫn xuất từ `ready`; forbidden không retry; refreshing giữ stale data.
- Lint chặn query đã qua adapter nhưng vẫn nuốt state bằng `query.data ?? []`.

**Gate 11:** unit test tám trạng thái xanh, probe cố ý vi phạm lint phải đỏ, full FE gate xanh.

**Trạng thái: hoàn tất 27/07/2026.** Commit `d2a5d62`; test contract **8/8**. Các commit
`d877d83`, `c549bd2`, `6a5259b` là guardrail hỗ trợ đã làm sớm cho Bước 14/18, không
được dùng để coi các bước đó đã hoàn tất.

### Bước 12 — Pilot hai luồng thật

**Mục tiêu:** chứng minh hợp đồng Bước 11 trên Material Demand và Warehouse trước khi rollout.

- Material Demand/Weekly Menu; Warehouse current stock + stock ledger.
- Giữ nguyên endpoint, request/response, query args, cache key/tag, URL, DOM contract và nghiệp vụ.
- Evidence browser headed phải có screenshot cuối, API sau action, console/page error, long task và CLS.

**Gate 12:** tám state render đúng; partial không bị coi là complete; warm revisit không tăng refetch,
CLS giữ 0 và ba viewport website không overflow.

**Trạng thái: hoàn tất 27/07/2026.** Material Demand `71656bc`, Warehouse `87ad944`;
targeted state/component **21/21**. Browser headed trên ba viewport: API 2xx, 0 request fail,
0 console/page error, warm revisit 0 request/0 long task/CLS 0. Evidence ở
`.artifacts/shipyard-live/query-view-pilot-performance.json` và sáu screenshot pilot.

### Bước 13 — Nhân rộng state boundary

**Mục tiêu:** hoàn tất `f(data, state)` trên các data-owning page mà chưa thay đổi ownership/file tree.

Thực hiện đúng thứ tự, mỗi feature một commit:

1. Purchasing.
2. Approvals.
3. Reports.
4. Admin.
5. Chef.
6. Coordination.

Trong từng feature:

- Mọi query có `skip` phải render uninitialized; trả hết swallowed query error.
- Response có `isTruncated` hoặc limit không pager phải render partial/truncation evidence.
- Query-level 403 thành forbidden, không retry và không bị hiểu là empty.
- Refreshing giữ data cũ đúng cache key; common leaf component chỉ nhận presentation state.
- Chưa tách `workflowApi.ts`, chưa di chuyển `MainLayout` và chưa đổi ownership; các việc đó thuộc Bước 17.

**Gate 13:** không còn data-owning page coerce error/skip thành mảng rỗng; state/component matrix và
full FE gate xanh; endpoint/cache/DOM không drift; browser ba viewport xanh và CLS warm giữ 0.

**Tiến độ 27/07/2026 — Purchasing hoàn tất tại `86a2347`.** Cả 8 query-owning boundary
trong feature đã qua `QueryView`: workbench tuần (1), supplemental/purchase/order liên kết (3),
ingredient/supplier/quotation (3) và supplier evidence (1). Forbidden không có retry, lỗi khác có
retry, refreshing giữ stale data; danh sách supplemental giới hạn 100 dòng hiển thị truncation
evidence thay vì bị coi là complete. Targeted state/component/cache **28/28**; full FE **354/354**,
BE **634 pass / 1 skip**, lint 0 error/4 warning baseline, dependency không tăng, production build,
OpenAPI và migration gate xanh. Browser headed trên `1365×900`, `1280×900`, `768×1024`:
9/9 capture workflow/quotation/warm, API 2xx, warm switch 0 request, 0 console/page/request error,
0 long task, CLS 0, 0 page overflow. Evidence tại
`.artifacts/shipyard-live/query-view-purchasing-performance.json` và chín screenshot cùng prefix.

**Approvals hoàn tất tại `c0cf976`.** Bốn query owner (approval inbox, workflow documents,
purchase-request page và approval history có `skip`) đều đi qua `QueryView`; forbidden không
retry, lỗi khác có retry, refreshing giữ stale rows và history chưa chọn chứng từ giữ
uninitialized instruction. Query ownership vẫn ở `ApprovalPage`; ba presentation-state panel được
tách theo responsibility, đưa page từ 625 xuống **491 dòng** mà không đổi endpoint,
args, skip, cache hay mutation behavior. Targeted state/component **22/22**; full FE **362/362**,
BE **634 pass / 1 skip**, lint 0 error/1 warning baseline thuộc Admin, dependency không tăng,
production build, OpenAPI và migration gate xanh. Browser headed trên ba viewport: **12/12**
queue/role/history/warm capture, API và history action 200, warm revisit 0 request,
0 console/page/request error, 0 long task, CLS 0, 0 page overflow. Evidence tại
`.artifacts/shipyard-live/query-view-approvals-performance.json` và mười hai screenshot cùng prefix.

**Reports hoàn tất tại `e4d24bb`.** Mười hai query owner (bốn price subview và tám
report view còn lại) giữ nguyên args/skip/cache nhưng đều qua `QueryView`; active boundary
phân biệt uninitialized/loading/forbidden/error/ready, refreshing giữ stale table và metric của
query chưa authoritative hiển thị `—` thay vì số 0 giả. Price navigation vẫn tồn tại khi
query con đang tải. `ReportsPage` từ 800 xuống **515 dòng**; price panel 352 dòng và
page model 594 dòng, cả ba dưới growth warning 600. CSV helper được chuyển nguyên
logic và có BOM/escaping test. Targeted Reports/contracts **25/25**; full FE **368/368**,
BE **634 pass / 1 skip**, lint 0 error/1 warning baseline thuộc Admin, dependency không tăng,
production build, OpenAPI và migration gate xanh. Browser headed trên ba viewport: **39/39**
capture, mỗi tab/subview action API 200, warm price revisit 0 request, 0 non-2xx/request fail/
console/page error/long task, CLS 0, 0 page overflow. Evidence tại
`.artifacts/shipyard-live/query-view-reports-performance.json` và ba mươi chín screenshot cùng prefix.

**Admin hoàn tất tại `0e0279f`.** Mười bốn query owner trong `AdminDataPage`
và hai query của `ApprovalRulesPage` đều qua `QueryView`. Shared `AdminQueryBoundary`
phân loại group query, không retry 403, giữ children khi refreshing và không render
false-empty khi một dependency lỗi. Statistics nay thực sự tải current stock; BOM thực
sự tải customer contracts; dialog BOM bị chặn khi catalog chưa authoritative; employee
selector không pager hiển thị truncation `shown/total`. Endpoint, args, cache, URL và mutation
behavior không đổi. `useAdminDataPageModel` còn **785 dòng**, vẫn là growth warning đã
được xếp Bước 17; không big-bang split trong state rollout.

Targeted Admin/state **26/26**; full FE **386/386**; BE **634 pass / 1 skip**; lint sạch,
dependency không tăng, production build, OpenAPI deterministic và migration gate xanh.
Browser headed ba viewport: **30/30** capture cho 7 tab, BOM warm, Approval Rules và dialog;
55 API response đều 2xx, warm BOM 0 request, 0 request fail/non-2xx/console/page error/long task,
CLS 0 và 0 page overflow. Evidence tại `.artifacts/shipyard-live/query-view-admin-performance.json`
và ba mươi screenshot `query-view-admin-*.png`. Staged GitNexus audit: 13 file/45 symbol/
11 flow, **HIGH**, đúng blast radius shared Admin boundary đã được phủ gate.

**Chef hoàn tất tại `894012d`.** Sáu query owner — catalog món/BOM, daily production
plan, kitchen issues, inventory returns, workflow documents và stock movements — đều qua
`QueryView`. Tab sản xuất giữ fallback kế hoạch đã có nhưng gắn error/forbidden
tường minh; tab chứng từ block false-empty. Context của query skip/chưa authoritative
hiển thị `—`; return page và hai journal limit không pager hiển thị truncation evidence.
Refreshing giữ stale data và dùng overlay text cố định ngoài document flow. Browser gate
đã phát hiện stack alert ban đầu gây CLS ~0,15 khi đổi ngày; implementation cuối
đã loại regression này thay vì nới ngưỡng.

Targeted Chef/state **45/45**; full FE **400/400**; BE **634 pass / 1 skip**; lint sạch,
dependency không tăng, production build, OpenAPI deterministic và migration gate xanh.
Browser headed ba viewport: **12/12** capture cho production, đổi ngày, documents và warm;
31 API response đều 2xx, warm production 0 request, 0 non-2xx/request fail/console/page error/
long task, CLS 0 và 0 page overflow. Evidence tại
`.artifacts/shipyard-live/query-view-chef-performance.json` và mười hai screenshot
`query-view-chef-*.png`. Staged GitNexus audit: 9 file/24 symbol/4 flow, **MEDIUM**, đúng scope Chef.

**Coordination hoàn tất tại `fe5a438`.** Mười một query owner đã qua `QueryView`: hai query
workbench điều phối, lazy menu metadata của dialog món, sáu query shell Weekly Menu,
lịch sử import và kế hoạch sản xuất. `QueryViewBoundary` thuần được đặt ở `components/common`
để hai feature dùng chung mà không tạo cạnh `projects→coordination` mới; dependency gate từng
bắt 15 import vi phạm của bản đặt sai owner và implementation cuối đưa chúng về 0.

Uninitialized do `skip` không còn thành empty; 403 không retry và không lộ cached data;
lỗi khác có retry và giữ cached data đúng query key; refreshing dùng overlay tuyệt đối ngoài
document flow. Metric workbench chưa authoritative hiển thị `—`; import history và Weekly Menu
không còn xóa fallback khi refetch lỗi. Không đổi endpoint, query args, cache tag/key, URL,
mutation hay ownership feature hiện hữu.

Targeted Coordination/state **26/26**; full FE **416/416**; BE **634 pass / 1 skip**;
lint sạch, dependency không có vi phạm mới và vẫn giữ 54 baseline cũ, production build,
OpenAPI deterministic và EF pending-model gate xanh. Browser headed trên ba viewport:
**21/21** capture, 118 API response đều 2xx, 0 business mutation, warm scope/production
0 request, 0 request fail/console/page error/long task, CLS 0 và 0 page overflow. Runtime
FE `3001`, API `8001`, Shipyard `8090`, `ipc_lane1` Healthy cho database + migrations.
Evidence tại `.artifacts/shipyard-live/query-view-coordination-performance.json` và 21 screenshot
`query-view-coordination-*.png`. Hai file `query-view-coordination-error.*` có timestamp cũ hơn
là lỗi locator của browser helper trước final run, không phải kết quả cuối.

Worktree runtime hiện không có order row ở cả 14 tổ hợp thứ/ngày + ca, nên browser xác minh
ready-empty authoritative của workbench nhưng không tạo dữ liệu giả để mở dialog món. Lazy query
của dialog được phủ bằng ma trận boundary tám trạng thái và ownership contract. Staged GitNexus:
12 file/31 symbol/0 flow, **LOW**, đúng scope.

**Gate 13 đã đóng ngày 28/07/2026.** Cả sáu feature đã hoàn tất; bước active tiếp theo là
**Bước 15 — Reports**, vì Bước 14 đã hoàn tất sớm.

### Bước 14 — Khóa VSA boundary

**Mục tiêu:** biến VSA-lite từ cách đặt folder thành dependency DAG được architecture test bảo vệ.

- Viết/siết backend architecture test kiểm dependency direction và chốt DAG rõ ràng.
- Loại bốn cycle `Purchasing↔Reports`, `Planning↔Purchasing`, `Coordination↔SampleData`,
  `Approvals↔Coordination`.
- Chỉ chuyển DTO thực sự dùng chung, ổn định vào `Shared/Contracts`; đưa interface/port
  về feature sở hữu.
- Bỏ direct `IpcManagementContext` khỏi controller; query đi qua application/query service của feature.
- Không di chuyển `Migrations`, không đổi schema và không tách god service trong cùng step.

**Gate 14:** architecture test 0 legacy cycle/0 cạnh cấm; 0 controller truy cập DbContext; namespace/path,
OpenAPI, full BE/FE và migration-diff gate xanh.

**Trạng thái: hoàn tất sớm ngày 27/07/2026 do roadmap trước đây gán nhầm số
Bước 13.** Bốn cycle về 0 tại `97bb33f`, `766fac7`, `baff911`, `91badde`; ceiling
tương ứng đã xóa. Commit `45d2072` đưa query của `PurchaseRequestsController` và
`ApprovalHistoryController` vào query service thuộc feature; quét source và architecture test xác nhận
0 feature controller còn reference `IpcManagementContext`. Gate: architecture **3/3**, characterization
**2/2**, BE **634 pass / 1 skip**, FE **341/341**, lint 0 error/4 warning baseline, dependency không có
vi phạm mới, OpenAPI deterministic, EF không có model change chưa migration và production build xanh.

### Bước 15 — Tách use case và functional core

**Mục tiêu:** giảm controller/service phình theo responsibility thật, không thay một file lớn bằng
nhiều partial file cùng trách nhiệm.

Thứ tự thực hiện:

1. **Reports:** `WorkflowReportsController` + `WorkflowReportService` tách inventory,
   demand/purchasing, price variance, audit/data-quality/KPI; controller không giữ cache,
   single-flight hay CSV command logic.
2. **Coordination:** `CoordinationController` + `CoordinationService` tách order, customer contract,
   portion rule, weekly menu/import, meal quantity plan, lock/signoff/export.
3. **Purchasing:** `PurchaseRequestsController` tách query/filter/mapping; `PurchaseRequestWorkflowService`
   tách state transition/policy khỏi EF, transaction và clock.
4. **Catalog:** `DishesController` + `DishService` tách catalog, BOM, BOM import/validation.
5. **SampleData:** tách orchestration/import/seed policy khỏi persistence, không chạy seed trên DB đang dùng.

Pure policy, projection và state transition là functional core có test không cần DB; application service
là imperative shell sở hữu EF/transaction/I/O.

**Gate 15:** controller chỉ điều phối; pure core test không cần DB; API contract không drift;
characterization test bảo vệ hành vi và transaction boundary cũ; full gates xanh sau từng use case.

### Bước 16 — Persistence và reliability

**Mục tiêu:** chuẩn hóa mapping, transaction, exception, migration lineage và khả năng phục hồi
mà không reset dữ liệu.

- Tách EF mapping sang `IEntityTypeConfiguration<T>` theo feature; `IpcManagementContext` chỉ là registration root.
- Chuẩn hóa transaction runner cùng EF execution strategy trước khi bật transient retry; side effect
  phải idempotent hoặc nằm trong transaction phù hợp.
- Thay `InvalidOperationException` nghiệp vụ bằng domain/application exception có HTTP mapping rõ.
- Khôi phục canonical migration lineage theo baseline thực tế; không di chuyển migration, reset hay seed DB.
- Giữ backup hiện có, thêm bản sao khác ổ/máy và restore rehearsal có evidence.

**Gate 16:** retry không nhân đôi side effect; fresh-install/upgrade lineage được giải thích và test;
restore drill đạt RPO/RTO đã chốt; production/lane data không bị reset.

### Bước 17 — Thu hẹp frontend ownership

**Mục tiêu:** mỗi endpoint, layout và page model có owner rõ; import graph không dựa vào baseline nợ.

- Tách `workflowApi.ts` thành endpoint module thuộc từng feature.
- Giữ duy nhất một `apiSlice`, base query và cache-tag registry; endpoint name, query key và invalidation
  behavior không đổi.
- Chuyển `MainLayout` sang `app/layout`.
- Giải quyết `projects→coordination` bằng ownership hoặc shared contract/API rõ ràng.
- Xử lý 54 dependency violation về zero-baseline; ngoại lệ bắt buộc có lý do, owner và ngày hết hạn.
- Tách `useAdminDataPageModel` và `useReportsPageModel` theo panel/use case sau khi module ownership ổn định.

**Gate 17:** 0 feature cycle/import ngược không có whitelist; navigation/cache/state tests xanh;
OpenAPI-derived type và public hook surface không drift; browser ba viewport giữ UI/cache behavior.

### Bước 18 — Guardrail test, growth gate và tài liệu

**Mục tiêu:** khóa nợ còn lại bằng test/gate có thể chạy lại và đóng workflow bằng evidence.

- Tách `WorkflowGenerationTests.cs` và các test monolith theo workflow; dùng fixture builder,
  giữ nguyên coverage hành vi.
- Bật growth gate hai tầng:
  - Controller warning khi `>250` dòng hoặc `>12` actions; `>400` dòng hoặc `>20` actions bắt buộc plan split.
  - Service warning khi `>600` dòng; `>1.000` dòng bắt buộc plan split.
  - File FE viết tay warning khi `>600` dòng.
  - Test suite warning khi `>1.500` dòng.
- Sau một chu kỳ ổn định, chuyển threshold đã trả nợ từ warning sang blocking gate.
- Đồng bộ `ARCHITECTURE`, `TESTING`, `CURRENT-STATE` và audit với code/runtime/evidence thực tế.

**Gate kết thúc workflow:** full backend/frontend/contract/dependency/migration gates xanh; browser headed
website xác nhận FE state, BE request/response, DB transition và render sau reload; secret scan,
`git diff --check` và staged `detect_changes` sạch; không push tự động.
