# STACK Research — v1.1 Chuẩn hóa BOM mới & loại bỏ dữ liệu legacy

**Dimension:** STACK  
**Ngày nghiên cứu:** 2026-07-16  
**Phạm vi:** dependency, parser Excel, cleanup/migration, transaction EF/MySQL, test tooling và primitive shadcn/Tailwind. Không thay đổi source code trong bước research.

## Current stack

### Backend và dữ liệu

- ASP.NET Core 9, C# 13, EF Core 9.0.16 và Pomelo MySQL 9.0.0 là đủ cho milestone này; không cần thêm package persistence hay job runner.
- `SampleDataImportService` đang sở hữu luồng nạp workbook canonical `IPC. Định lượng 07.2026.xlsx`: ba sheet `định lượng suất 25k/30k/34k`, dedupe theo tier + món + nguyên liệu, gán đơn vị kỹ thuật và ghi BOM `PUBLISHED` hiệu lực từ 2026-01-01.
- `XlsxWorkbookReader` là parser OpenXML nội bộ dựa trên `System.IO.Compression` + `System.Xml.Linq`; đã hỗ trợ shared strings, inline strings, merged cells, tìm header và sheet không phân biệt hoa thường. Backend không phụ thuộc ClosedXML/EPPlus/NPOI.
- `DishService` đang sở hữu một luồng import cũ khác: sinh workbook theo `BomTemplateWorkbookBuilder.Headers`, đọc sheet `BOM` hoặc CSV, preview/commit theo các cột `DishCode`, `IngredientCode`, `UnitCode`, `GrossQtyPerServing`, `WasteRatePercent`, `EffectiveFrom/To`, `BomStatus`, v.v. Luồng này không phải contract ba sheet mới.
- CRUD thủ công BOM trong `DishService` đã có các invariant cần giữ: tier 25k/30k/34k, global/customer scope, kiểm tra overlap theo hiệu lực, version mới khi sửa dòng published, archive khi ngừng và ghi `Bomadjustment`.
- `SampleDataImportService.ImportAsync` ghi theo nhiều checkpoint (BOM, menu, quantity plan, purchase history), không có transaction bao toàn import. `ReplaceBomCatalog` có thể xóa toàn bộ `Bomadjustments` và `Dishboms` trước checkpoint đầu.
- Repo đã có mẫu dry-run/apply + audit trong `WorkflowReportService.CleanupDataQualityAsync`: apply mở EF transaction, mỗi action ghi `Auditlog`, dry-run không ghi DB. Đây là convention nên tái sử dụng, nhưng cleanup BOM nên có service riêng thay vì tiếp tục làm phình reporting service.
- Migration `20260716090000_CleanLegacyPortionData` đã dọn portion rule và các code `TMP-BOM-*` theo predicate có kiểm tra tham chiếu. Script `Clean_Legacy_Imported_Bom.sql` rộng hơn vì xóa toàn bộ BOM/adjustment; không phù hợp là runner chính cho retention boundary 2A.

### Frontend

- React 19 + TypeScript 6 + Vite 8 + Redux Toolkit/RTK Query + Tailwind CSS 4.3.0.
- Repo đã có `shadcn` 4.11.0, Base UI, CVA, `clsx`, `tailwind-merge`, `lucide-react`; không cần cài thêm component framework.
- `AdminDataPage` đang dùng `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` cho CRUD BOM; dùng common primitives `DataTableShell`, `InlineAlert`, `SectionPanel`, `ViewSwitcher`, `FieldRow`, `PaginationBar`, `StatusBadge`.
- UI primitive khác đã có sẵn: `Button`, `Input`, `Select`, `Checkbox`, `Alert`, `Table`, `Card`, `Badge`, `Separator`, `Textarea`. `DataTableShell` đã cung cấp region có `overflow-x-auto` và keyboard focus; BOM table hiện giới hạn `max-h-[520px]`.
- Màn import hiện tại vẫn gọi `useDownloadBomTemplateMutation`, `usePreviewBomImportMutation`, `useCommitBomImportMutation` và hiển thị `BOM thiếu`, `Mẫu trống`, `Preview`, `Commit`; đây là bề mặt của contract cũ phải thay.

## Recommended changes

### 1. Không đổi technology stack; tách ownership theo domain

- Tách contract/parser canonical khỏi `SampleData` thành module BOM chuyên biệt, ví dụ `Services/BomImport/PresetBomWorkbookParser` + `IBomCatalogImportService`. `XlsxWorkbookReader` tiếp tục là low-level reader nội bộ, nhưng chuyển namespace/ownership để không gắn format sản xuất với “sample data”.
- Định nghĩa một contract typed cho ba sheet, required headers, tier, source row, normalized dish/ingredient, unit technical, quantity và warning. Preview và apply phải dùng cùng một parser/validator; không parse hai lần bằng hai rule khác nhau.
- `SampleDataImportService` chỉ orchestration menu/quantity/purchase sample nếu các luồng này còn cần; nạp BOM canonical phải ủy quyền sang BOM service. Về sau có thể xóa hẳn sample endpoint khỏi production mà không ảnh hưởng parser BOM.
- Không đưa workbook filesystem vào EF migration. Migration phải deterministic từ DB state; workbook được parse/validate trước apply bởi application service.

### 2. Chiến lược cleanup runner

- Tạo service chuyên biệt, ví dụ `IBomLegacyCleanupService`, với hai thao tác cùng policy engine: `Preview/DryRun` và `Apply`.
- Preview phải query `AsNoTracking`, phân loại theo ma trận retention và trả về count + action + blocker theo entity. Không thay đổi tracked entity trong dry-run.
- Apply phải tính lại candidate bên trong transaction, không tin hoàn toàn danh sách ID do client gửi. Ghi cleanup action và `Auditlog` trong cùng transaction; rollback toàn bộ khi một bước thất bại.
- Idempotency dựa trên predicate trạng thái/provenance, không dựa chỉ vào tên hiển thị. Lần apply thứ hai phải cho 0 action. Nếu cần lưu run, dùng entity/bảng EF nhỏ với unique operation key/hash; không cần job framework.
- Tái sử dụng `ApiResponse`, current-user service, audit convention và authorization Admin hiện có. Không tái sử dụng script `Clean_Legacy_Imported_Bom.sql` theo kiểu xóa toàn bộ.

### 3. EF Core/MySQL transaction và migration

- Chỉ tạo migration mới khi cần schema/provenance/index hoặc cleanup deterministic cho database mới. Không xóa/sửa migration cũ đã có thể đã apply; migration seed cũ được vô hiệu hóa bằng compensating migration/policy, không viết lại history.
- Apply cleanup dùng `Database.CreateExecutionStrategy().ExecuteAsync(...)` bao quanh `BeginTransactionAsync` nếu retry strategy được bật; mỗi attempt tính lại candidate. Tránh transaction lồng nhau với các service downstream.
- Giữ transaction ngắn, xử lý theo batch có giới hạn và revalidate FK/status ngay trước delete/archive. Không trộn DDL MySQL với cleanup DML trong cùng transaction vì DDL có implicit commit.
- Ưu tiên archive/deactivate hoặc unlink có nhãn `legacy-removed` khi entity đã được tham chiếu trong chứng từ lịch sử; chỉ hard-delete catalog mồ côi và chứng từ nháp/lỗi đủ điều kiện.
- Thêm index/constraint chỉ khi research schema chứng minh thiếu; không thay ORM/database.

### 4. UI shadcn/Tailwind

- Giữ route `/admin-data`, `OperationalFrame`, `ViewSwitcher` và bố cục operational hiện có.
- Dùng `SectionPanel`/`Card` cho summary preview; `Badge`/`StatusBadge` cho `remove/archive/block/keep`; `InlineAlert` hoặc shadcn `Alert` cho warning; `Checkbox` cho category selection; `Dialog` cho xác nhận destructive; `Button`, `Input`, `Select`, `Textarea` cho action/form; `DataTableShell` + table hiện có cho danh sách candidate.
- Bảng phải có container chiều cao cố định, `overflow-y-auto`, table layout/min-width và action cell `whitespace-nowrap`; search chỉ thay rows, không thay kích thước panel. Các nút thao tác dùng `shrink-0` và một hàng khi đủ viewport.
- Thay các hook/template cũ bằng RTK Query endpoints cho preview/apply canonical import và preview/apply cleanup. Giữ hooks CRUD BOM thủ công.

## Keep/Remove matrix

| Area | Giữ lại | Loại bỏ/thay thế |
|---|---|---|
| Runtime | .NET 9, EF Core 9, Pomelo MySQL, React 19, Vite 8, RTK Query, Tailwind 4 | Không thay runtime/framework |
| Excel low-level | Logic OpenXML nội bộ trong `XlsxWorkbookReader` sau khi đổi ownership | Parser trùng lặp trong service; temp-file/parser cũ chỉ hiểu sheet `BOM` |
| Contract import | Ba sheet 25k/30k/34k, headers tiếng Việt, dedupe, technical-unit mapping, preview/apply | Template `BOM thiếu`/`Mẫu trống`, contract `BomTemplateWorkbookBuilder.Headers`, CSV legacy nếu không còn consumer |
| BOM domain | Tier, customer scope, effective dates, status, versioning, overlap validation, adjustments/audit | `ReplaceBomCatalog` xóa toàn bộ BOM/adjustment không retention-aware |
| Catalog | Dish/ingredient/unit canonical; deactivate/archive entity có lịch sử | `TMP-BOM-*`, catalog mồ côi và active legacy không thuộc canonical set sau khi qua blocker check |
| Chứng từ | Locked/completed documents và audit bảo toàn nguyên | Draft/cancelled/failed phụ thuộc legacy được remove/regenerate theo policy |
| Migration history | Giữ file migration cũ để fresh DB và `__EFMigrationsHistory` nhất quán | Không chạy script broad-delete; không rewrite migration đã apply |
| Admin UI | Manual Add/Edit version/Stop, fixed scroll table, tabs/layout, dialogs và alerts | Nút download old template, preview/commit old header format, copy hướng dẫn cũ |
| Sample import | Các luồng menu/order/purchase còn được xác minh là cần | BOM production ownership trong `SampleDataImportService`; sample-only identity/warehouse nếu không còn consumer |
| UI primitives | shadcn-style `Dialog`, `Button`, `Input`, `Select`, `Checkbox`, `Alert`, `Table`, `Card`, `Badge`; common operational primitives | Raw modal/table/form mới và component framework thứ hai |

## Verification stack

### Backend

- xUnit + FluentAssertions cho parser/normalization, technical-unit mapping, dedupe, retention classifier và idempotency.
- EF Core SQLite tests cho quan hệ FK, transaction rollback và query relational; không dùng InMemory là bằng chứng duy nhất cho cleanup.
- `Microsoft.AspNetCore.Mvc.Testing` cho authorization, preview không mutation, apply/audit, stale-preview revalidation và response contract.
- MySQL 8 integration smoke trên database cô lập cho migration SQL/Pomelo semantics: migrate fresh DB, migrate database legacy fixture, dry-run, apply, apply lần hai, rollback khi lỗi.
- Invariant checks sau apply: không còn active BOM ngoài tier hỗ trợ; không còn candidate legacy đủ điều kiện; 0 FK mồ côi; locked/completed document và audit không đổi; material-demand draft được invalidate/regenerate đúng policy; technical unit/quantity vẫn hợp lệ.

### Frontend

- Vitest + Testing Library + user-event cho state preview/apply, disabled destructive action, confirmation, status badge, search và empty/error states.
- Playwright `control-surface`, `route-smoke`, `ui-audit` và visual snapshot cho `/admin-data` desktop/mobile; bổ sung assertions table giữ nguyên bounding box khi search, scroll riêng và action buttons không wrap.
- Chạy `npm run build --workspace frontend`, `npm run lint --workspace frontend`, `npm run test:unit --workspace frontend`, các Playwright suite liên quan và `dotnet test backend/IPCManagement.slnx`.

## What not to add

- Không thêm ClosedXML, EPPlus, NPOI hoặc ExcelDataReader: reader nội bộ đã đủ cho contract cố định; package mới tăng bề mặt license/bảo trì mà không giải quyết ownership.
- Không thêm Hangfire/Quartz/background worker: cleanup là thao tác Admin có preview/apply, có thể batch trong request và audit.
- Không thêm Dapper/raw-SQL framework: EF Core đủ cho classifier, transaction và audit; raw SQL chỉ dùng cục bộ trong migration khi cần.
- Không thêm state manager, data-grid, form library hay UI kit thứ hai; RTK Query + React state + shadcn/common primitives hiện có đủ.
- Không thêm Cypress/Jest; giữ Vitest + Playwright.
- Không thêm Testcontainers chỉ cho milestone này; dùng SQLite relational tests và MySQL 8 integration database hiện hữu. Chỉ xem xét lại nếu CI sau này cần provision MySQL tự động.

## Risks

1. **Broad destructive behavior:** `ReplaceBomCatalog` và `Clean_Legacy_Imported_Bom.sql` có thể xóa toàn bộ BOM/adjustment, trái retention 2A. Không được dùng làm cleanup production mà không thu hẹp predicate.
2. **Partial import:** checkpoint theo domain trong `SampleDataImportService` có thể commit BOM mới rồi thất bại menu/purchase. BOM canonical import/cleanup cần transaction boundary riêng và kết quả rõ ràng.
3. **Dry-run drift:** nhiều `Ensure*` hiện vẫn mutate entity đang track dù `DryRun`; request thường không save nhưng pattern này không an toàn để tái sử dụng. Cleanup preview phải `AsNoTracking` và pure classification.
4. **Hai contract Excel cùng tồn tại:** UI cũ chấp nhận sheet `BOM`/CSV trong khi canonical có ba sheet tên cố định. Nếu không tách ownership, preview UI và sample import có thể cho kết quả khác nhau.
5. **Technical-unit mapping bằng dictionary:** mapping theo tên nguyên liệu dễ drift do chính tả/alias. Contract typed cần normalization, fixture workbook và test regression cho toàn bộ mapping đã chấp nhận.
6. **Không có provenance mạnh:** stable code/tên không luôn đủ phân biệt canonical và legacy. Nếu schema hiện tại không lưu source batch/version, cần thêm marker/index nhỏ trước khi hard-delete.
7. **FK và historical semantics:** dish/ingredient/BOM có thể được menu item, production plan, material request, stock/purchasing tham chiếu. Classifier phải phân biệt completed/locked với draft; blocker phải hiển thị trên preview thay vì cascade mù.
8. **MySQL migration semantics:** DDL có implicit commit; không thể coi migration schema + cleanup DML là một rollback unit. Cần backup, preflight counts và post-migration verification.
9. **UI accessibility:** `Dialog` nội bộ hiện là custom portal, không phải full focus-trap primitive. Không thêm dependency trong milestone, nhưng destructive confirmation phải được test keyboard/focus và không dựa chỉ vào màu.

---

**Kết luận STACK:** milestone v1.1 là bài toán ownership, policy và transaction safety, không phải bài toán thêm công nghệ. Giữ nguyên stack; gom parser/import vào BOM domain, tạo cleanup service dry-run/apply retention-aware, và tái sử dụng shadcn/common primitives cùng test tooling sẵn có.
