# Shared BOM and MRX Excel Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task in the native session. Apply the repo's Pi runtime, single-writer and authorization rules.

**Goal:** Bổ sung BOM chung đúng tuần/mốc và xuất hai workbook MRX theo công việc của Kho và Bếp.

**Architecture:** Đọc ngữ cảnh tuần qua MRX, dùng resolver và import transaction của Catalog cho BOM. Dùng exporter nhu cầu Kho và projection đóng băng Bếp cho hai đầu ra XLSX riêng, giữ hợp đồng API cũ.

**Tech Stack:** ASP.NET Core, EF Core/MySQL, React/TypeScript, Open XML hiện hữu, xUnit, Vitest và Playwright.

**Spec:** [BOM dùng chung và hai file Excel MRX](../specs/2026-11-18-shared-bom-mrx-excel-design.md).

## Global Constraints

- Lượt triển khai đầu chạy Task 1–3 và phần nghiệm thu BOM của Task 6. Lượt tiếp theo triển khai Task 4–5 và kiểm chứng Excel Kho/Bếp trong phạm vi local. Các endpoint mới chỉ mở trong `MATERIAL_RECONCILIATION`. Bằng chứng và phần nghiệm thu còn chờ được ghi trong `.planning/WORK.md`.

- Giữ ba mốc giá máy chủ 25.000, 30.000 và 34.000 ₫. Luồng tạo mới chuẩn ghi phạm vi dùng chung. Precedence BOM riêng đã tồn tại tiếp tục theo resolver hiện hành trong giai đoạn chuyển tiếp.
- Giữ quyền ở route, action và API, bảo toàn DOM-MODE-1, lịch sử và snapshot. Export là read-only. Dùng SDK và thư viện đã khai báo. Áp dụng quy trình cấp quyền hiện hữu cho cài đặt và chạy clone/database.
- Dùng Impeccable Operate, `docs/DESIGN.md` và Scoped Pre-Code UI Gate Block trước lần sửa TSX/CSS đầu tiên. Dùng các primitive hiện hành và token trong `frontend/src/styles/index.css`.
- Giữ `includeMenus=true|false` trên API Kho cũ và URL một lô trên API Bếp cũ. Danh sách khách cung cấp chỉ dùng để đối chiếu nguyên liệu theo NCC trong cùng hạng mục XLS-02.

## Review Focus

1. Tuần đang xem không có đủ số suất và thiết lập mốc 34.000 ₫. Badge lấy từ dữ liệu lịch, nút theo đúng mốc. Task 1 và 3.
2. Hai khoảng thiếu của cùng mã món xen ngày đã có BOM. Dòng thêm chỉ dùng khoảng được phép, file cũ bị từ chối nếu phạm vi đổi. Task 2.
3. Tên giống nhau, ID khác nhau hoặc NCC thay đổi trong cùng tuần. Tổng được phân đúng và mỗi lượng chỉ xuất một lần. Task 4.
4. Hai lô của cùng khách có cùng món/ca hoặc một lô thiếu lineage. Dòng giữ đúng lô và phản hồi không trả workbook một phần. Task 5.
5. Có quyền xem thực đơn nhưng thiếu quyền ghi Catalog, hoặc người dùng đổi ca/phạm vi lúc export pending. Action và request giữ đúng quyền, đúng ngữ cảnh. Task 3–5.

## Chủ sở hữu và thứ tự

| Task | Chủ sở hữu | Phụ thuộc |
|---|---|---|
| 1. Kiểm tra BOM theo lịch tuần | MRX weekly menu controller và Catalog template/resolver | Baseline |
| 2. Template và ghi BOM | Catalog BOM template, parser, import transaction | 1 |
| 3. Giao diện BOM | Weekly Menu và Admin BOM | 1, 2 |
| 4. Excel Kho | Preparation endpoint, exporter, builder, Warehouse workbench | Độc lập với BOM |
| 5. Excel Bếp | Kitchen controller, projection, workbook, Chef workbench | Độc lập với BOM và file Kho |
| 6. Nghiệm thu | Canonical docs, hợp đồng API, E2E/Excel | 1–5 |

## Task 1 — Nguồn tuần cho badge và form (BOM-01–03)

**Files:** `Features/Catalog/Controllers/MrxWeeklyBomCoverageController.cs`, `Features/Catalog/Services/{MrxWeeklyBomCoverage,DishBomTemplateService}.cs`, và `Features/SystemOperation/Services/SystemOperationEligibility.cs` trong API project. Mở rộng `DishCatalogTests.cs` và `DishBomImportsControllerTests.cs`.

**Interfaces:** `GET /api/reconciliation/weekly-menu/bom-coverage?customerId&weekStartDate&menuVersionId` trả `MrxWeeklyBomCoverage` gồm scope, `priceTierAmount` và `missingDishes` gồm `dishId, dishCode, dishName, occurrences[], intervals[]`. Occurrence giữ `serviceDate, shiftName`. Catalog cung cấp cùng phép xác định phạm vi để tạo template và xác minh import. Controller giữ quyền đọc tuần và MRX mode hiện tại.

- [ ] Kiểm thử lịch 34.000 ₫, món xuất hiện hai ca, tuần chưa đủ số suất, phiên bản tuần sai và BOM có hiệu lực đúng phạm vi.
- [ ] Chạy `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj -c Release --filter 'FullyQualifiedName~DishService_MrxMissingTemplate|FullyQualifiedName~DishBomImportsControllerTests'`. RED do thiếu contract hoặc trả sai phạm vi.
- [ ] Triển khai query từ lịch MRX hiệu lực đã lưu, tập ID món và BOM hiệu lực theo exact tier/date. Dùng ID để nhóm, giới hạn đọc theo đúng tuần, dùng lỗi rõ ràng khi mốc không xác định. Kiểm tra loại diagnostic định lượng ở owner hiện tại và giữ hành vi chốt định lượng.
- [ ] Chạy lại bộ test; PASS khi dữ liệu badge khớp resolver và kiểm soát mode/quyền được khóa trong kiểm thử API.

## Task 2 — Mẫu linh hoạt và commit BOM chung (BOM-02–05)

**Files:** `Features/Catalog/Contracts/DishDto.cs`, `Controllers/DishBomImportsController.cs`, `Services/DishBomTemplateService.cs`, `BomTemplateWorkbookBuilder.cs`, `DishBomImportParser.cs` và `DishBomImportService.cs` dưới Catalog. Tests `DishBomImportServiceTests.cs`, `DishBomImportsControllerTests.cs` và `CanonicalBomWorkbookTests.cs`.

**Interfaces:** Dùng `GET /api/Dishes/mrx/bom-template`, `POST /api/Dishes/mrx/bom-import/preview`, và `POST /api/Dishes/mrx/bom-import/commit` với mode guard MRX. Template `mrx-shared-missing` và form theo tuần dùng `ScopeCustomerId, WeekStartDate, MenuVersionId` để định danh nguồn, còn audit ghi `CustomerId=null`. Preview trả `previewFingerprint`, commit nhận lại fingerprint và tự kiểm tra từ dữ liệu hiện hành. Catalog dùng `missing` hoặc `dish + DishId` cho mẫu, `all` cho toàn danh mục của đúng một mốc. Định ngày áp dụng trong form danh mục khi khách nhập file đã chỉnh.

- [ ] Viết test tải mẫu tuần 30.000 ₫ có hai khoảng thiếu, thêm dòng thứ 12 và xóa một dòng trống rồi nhập, xem trước đúng mã món/ĐVT. Test commit gửi scope khách như scope ghi, dữ liệu tuần đổi, BOM được ghi song song và phiên bản PUBLISHED đang hiệu lực. Xác nhận không có dòng ghi từng khách hoặc ghi một phần.
- [ ] Chạy bộ test API với filter `'FullyQualifiedName~DishBomImport|FullyQualifiedName~CanonicalBomWorkbook'`. RED phải chỉ ra hợp đồng mới chưa có hoặc workbook còn giới hạn.
- [ ] Dùng phạm vi Task 1 để tạo dòng gợi ý có mã món và khóa khoảng hợp lệ, theo ngày thiếu sớm nhất rồi mã món nếu không có metadata món mới đáng tin. Tab nhập cho thao tác dòng native. Parser hiện hữu đọc hàng theo header, bỏ dòng chưa nhập nguyên liệu, phát hiện thiếu khóa khoảng khi cùng món có nhiều khoảng. Sử dụng giới hạn Excel/upload sẵn có và kiểm tra đầy đủ ngày/đơn vị/số lượng tại server.
- [ ] Thực hiện preview và kiểm tra lại snapshot/phạm vi phiên bản trong transaction Catalog tại commit. Ràng buộc fingerprint với file, phạm vi và dữ liệu liên quan. Dùng khóa ghi theo món/mốc dùng chung khi cạnh tranh; kiểm chứng xung đột và không ghi dở bằng provider quan hệ phù hợp. Khi tạo phiên bản, giới hạn tới trước ranh giới hiệu lực kế tiếp. Giữ hợp đồng import file cũ và hành vi replay hiện có.
- [ ] Chạy lại bộ test và mở file bằng Excel thật. PASS của phần template đòi workbook lưu/mở lại được sau chèn/xóa rồi nhập đúng số dòng. Cập nhật catalog DTO OpenAPI/schema cho các contract mới qua toolchain repo đã được cấp quyền.

## Task 3 — Điều hướng và thao tác BOM (BOM-01–05)

**Files:** `frontend/src/api/{bomApi,mrxApi}.ts`, `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`, `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`, `frontend/src/features/admin/branches/AdminBomBranch.tsx`, `frontend/src/components/workbench/{DishBomBatchImportModal,DishBomEditorModal}.tsx`. Tests `WeeklyMenuMrxScope.test.tsx`, `AdminBomBranch.test.tsx`, `DishBomBatchImportPreview.contract.test.tsx` và `DishBomBatchImportModal.test.tsx`.

**Interfaces:** UI dùng `MrxWeeklyBomCoverage` theo key khách/tuần/phiên bản và form preview/commit Task 2. Trong modal chỉ có một hành động chính ở mỗi bước. Cả danh mục là lệnh xuất riêng.

- [ ] Xuất UI gate theo route. Với `/weekly-menu` dùng workbench thực đơn MRX và quyền đọc tuần. Với `/admin-data?view=bom` dùng workbench BOM, Catalog RBAC và `CAT.BOM.IMPORT` cho nhập. Ghi rõ quyền editor theo route registry/controller, sáu trạng thái, D6/D7, T7/T8, M1.2 và N6.
- [ ] Viết test tuần 34.000 ₫ hiển thị badge một món qua hai ca sau khi lưu thực đơn, lỗi khác loại không hiện CTA BOM, người chỉ đọc không có nút ghi, và tải mẫu Excel không dùng scope cũ khi đổi tuần. Sau commit verify đúng tuần được đọc lại. Test trang BOM gọi đúng kiểu tải file và khóa nút khi chưa chọn tier.
- [ ] Chạy `npm run test:fe:unit -- WeeklyMenuMrxScope AdminBomBranch DishBomBatchImport`. RED do badge/CTA, phạm vi hoặc tham số file cũ.
- [ ] Dùng `StatusBadge`/`InlineBanner`, `ActionGuard`, modal hiện có và query boundary. Khóa scope ghi chung. Hiện mốc/ngày theo server, bảo toàn file khi có thể, và vô hiệu preview khi scope thay đổi. Trả focus về CTA khi đóng modal. Giữ ngày hiệu lực có thể xem trong chi tiết và dùng parser/view hiện hữu cho lỗi từng dòng. Đổi nhãn và tách đúng hai ý định tải.
- [ ] Chạy lại bộ test và kiểm tra UI ở desktop/tablet, bàn phím, zoom và preview có dòng lỗi cuối. Test hợp đồng kiểm tra payload/file ở ranh giới API.

## Task 4 — Workbook Kho theo NCC (XLS-01, XLS-02, XLS-04)

**Files:** `Features/Reconciliation/Controllers/ReconciliationPreparationController.cs`, `Contracts/ReconciliationContracts.cs`, `Services/{ReconciliationPreparationService,ReconciliationPreparationWorkbookExporter,PreparationWorkbookBuilder}.cs`, `frontend/src/api/mrxApi.ts`, `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx` và `branches/MrxPrepHeaderBranch.tsx`. Tests `ReconciliationPreparationWorkbookTests.cs`, `PreparationWorkbookSchemaTests.cs`, `Warehouse.test.tsx`.

**Interfaces:** `GET /api/reconciliation/preparation/export-workbook?layout=supplier-demand` dùng đúng một trong `serviceDate|weekStartDate` và danh sách `batchIds` đang chọn. Layout mới xuất một sheet **Nhu cầu theo NCC**. Layout thiếu tham số tiếp tục đọc `includeMenus` như cũ.

- [ ] Xuất UI gate Warehouse MRX với quyền `reconciliation.warehouse.read`. Viết test ngày/tuần, bỏ chọn một lô, cùng tên khác ID/canonical unit, đổi NCC giữa tuần, hai NCC cùng hiệu lực và thiếu mapping. Assert workbook có đúng một sheet, tổng theo mỗi định danh bằng tổng nguồn và mọi ngoại lệ giữ nguyên lượng. Giữ các kiểm thử legacy.
- [ ] Chạy test API với filter `'FullyQualifiedName~ReconciliationPreparationWorkbookTests|FullyQualifiedName~PreparationWorkbookSchemaTests'` và `npm run test:fe:unit -- Warehouse.test`. RED do layout mới hoặc nút vẫn gửi `includeMenus=true`.
- [x] Tái sử dụng quyền MRX, resolver báo giá theo ngày và query đóng băng. Gom theo NCC thực tế trước, xuất tên/mã NCC và nguyên liệu/ĐVT/lượng, ghi ngoại lệ trong cùng sheet. Nhánh mới bỏ truy vấn thực đơn. Dùng đúng tập lô đã chọn, xử lý rỗng và phạm vi lỗi rõ, giữ hợp đồng legacy nguyên trạng.
- [ ] Khi nhận danh sách khách, dùng [quy trình đối soát hiện có](2026-11-15-preparation-source-mapping.md) cho phần định danh và bằng chứng. Báo ngoại lệ theo file/hash, sheet/dòng, mã NCC/nguyên liệu/ĐVT. Đối chiếu từng dòng sau mọi thay đổi mapping được duyệt và kiểm tra tổng bất biến. Khi danh sách còn chờ, chạy kiểm thử layout bằng dữ liệu NCC hiện có và ghi trạng thái kiểm chứng mapping khách là NEEDS_EVIDENCE trong cùng task.
- [ ] Chạy lại các test, mở Excel, đối chiếu tổng xuất của từng ngày và tuần. PASS phần layout khi cả URL mới và hai hợp đồng cũ đều đạt.

## Task 5 — Workbook Bếp theo ngày, ca và lô (XLS-03–04)

**Files:** `Features/Reconciliation/Controllers/ReconciliationKitchenCookingController.cs`, `Contracts/ReconciliationContracts.cs`, `Services/ReconciliationKitchenExportService.cs`, `frontend/src/api/mrxApi.ts`, `frontend/src/features/chef/MrxCookingWorkbench.tsx` và `branches/MrxCookingHeaderBranch.tsx`. Tests `ReconciliationKitchenExportTests.cs`, `Phase30EndpointAuthorityMatrixTests.cs`, `Chef.test.tsx`.

**Interfaces:** `GET /api/reconciliation/kitchen-cooking/xlsx?weekStartDate&batchIds&serviceDate&shift` với `weekStartDate` và ít nhất một batch ID bắt buộc, ngày tùy chọn, `shift=ALL|MORNING|AFTERNOON`. Dùng tham số lặp `batchIds`. Endpoint đặt tên độc lập với tuyến tải theo một lô. Quyền `ReconciliationKitchenAccess` và MRX mode. Bếp lấy ứng viên lô từ danh sách lô phân trang có sẵn với phạm vi tuần, giữ lô đang xem là lựa chọn mặc định.

- [ ] Xuất UI gate Chef MRX với quyền `reconciliation.kitchen.read`. Viết test ba khách, hai lô cùng khách, ca Chiều, món nhiều nguyên liệu, ngày không thuộc tuần, ID trùng và lô thiếu lineage. Assert exact set, sort theo thứ tự nghiệp vụ, số suất hiện một lần, nguyên liệu giữ số và ĐVT, quyền/mode chặn và hợp đồng CSV/XLSX cũ.
- [ ] Chạy test API với filter `'FullyQualifiedName~ReconciliationKitchenExportTests|FullyQualifiedName~Phase30EndpointAuthorityMatrixTests'` và `npm run test:fe:unit -- Chef.test`. RED do endpoint mới hoặc file bỏ qua ca.
- [x] Dùng logic projection kiểm tra đủ dữ liệu đóng băng, giữ batch ID xuyên suốt và truy vấn theo tập ID có giới hạn. Dedupe ID trước đọc, từ chối toàn bộ nếu lô sai tuần hoặc thiếu dữ liệu yêu cầu. Lọc theo ngày/ca ở server, xuất từ nguồn đóng băng và giữ quy ước missing conversion hiện có. Giữ ngày Chủ nhật lịch sử khi thuộc phạm vi hợp lệ của phiếu nấu.
- [x] Nối bộ chọn phạm vi xuất và nút `Xuất phiếu nấu Excel` vào workbench. Ngày/ca và số lô hiện rõ trước khi tải, khóa request trong lúc dữ liệu cũ hoặc đang tải. CSV/in tiếp tục có nhãn phạm vi tương ứng. Kiểm chứng local bằng Chrome, Excel và bản in A4 ngang.

## Task 6 — Hợp đồng, nghiệm thu và bàn giao native

**Files:** `docs/domain/weekly-menu.md`, `docs/domain/material-reconciliation.md`, `frontend/src/shared/api/contracts/{openapi.json,schema.ts}`, `frontend/tests/e2e-mrx/specs/mrx-export-consistency.spec.ts`, `.planning/WORK.md`.

### Mẫu Bếp một bảng đã duyệt

- Kiểm thử XLSX xuất theo phạm vi với hai khách cùng công thức, một khách khác định lượng, ca riêng và nhiều lô cùng khách. Đối chiếu số suất, lượng nguồn, vùng ô gộp và quyền MRX.
- Dùng định danh món, nguyên liệu, đơn vị chuẩn và dữ liệu định lượng, hao hụt đóng băng để gom trong cùng ngày, ca và loại thực đơn. Công thức không đủ dữ kiện giữ cụm riêng. Giữ nguồn lô trong phân bổ. Dùng một bảng gồm món, tổng suất, các dòng nguyên liệu, cột suất theo khách hoặc lô và ghi chú. Với số cột khách vượt bề rộng in, đưa phân bổ khách xuống từng dòng trong ô. Ghi chú vận hành để trống nếu chưa có nguồn.
- Kiểm chứng XLSX sinh từ backend và bản in Excel A4. Cập nhật bài kiểm thử tải file theo hợp đồng mới. Giữ các tuyến một lô và CSV hiện hữu.

- [x] Đối chiếu docs nghiệp vụ và API generated với DTO và các caller thực tế. Kiểm tra tuyến xuất Bếp kế thừa quyền đọc của controller MRX và tuyến xuất Kho giữ quyền đọc riêng.
- [ ] Áp dụng IPC test audit, code review và UI review. Chạy `npm run verify`, bộ contract FE đang có và detector Impeccable trên các target đã sửa. Báo rõ tình trạng file `operationalPageContracts.test.ts` nếu checkout vẫn thiếu.
- [ ] Chạy kịch bản E2E ở scope đã được cấp quyền với quy trình `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`, profile Qualification và diagnostic phù hợp. So tổng ngày/tuần và ba khách với từng file riêng cả trước/sau bỏ chọn. Mở chính file tải từ trình duyệt trong Excel, kiểm tra round trip của template, lặp tiêu đề in, không có ghi kho hoặc thay snapshot do xuất. Ghi riêng bằng chứng đối chiếu danh sách NCC thật khi nhận được.
- [ ] Chạy `git diff --check`. Ghi PASS/FAIL/NEEDS_EVIDENCE/BLOCKED theo BOM-01–05 và XLS-01–04, kèm SHA/run log và phạm vi chưa xác minh. Stage/commit từng phần khi được cấp quyền. Giữ thay đổi kế thừa và không trộn vào phạm vi task.
