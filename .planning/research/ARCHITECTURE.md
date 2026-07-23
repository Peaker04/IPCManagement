# Nghiên cứu kiến trúc — BOM mới và cleanup legacy

**Milestone:** v1.1 Chuẩn hóa BOM mới & loại bỏ dữ liệu legacy  
**Dimension:** Architecture  
**Ngày:** 2026-07-16  
**Phạm vi:** import contract → catalog/BOM version → material demand → production/purchase/inventory/report; cleanup/retention; xóa old-format API/UI; giữ CRUD thủ công.

## Kết luận kiến trúc

Không nên tiếp tục nhét format BOM mới vào `DishService` hoặc coi `SampleDataImportService.ReplaceBomCatalog` là cleanup chính thức. Hai đường hiện tại có trách nhiệm chồng lấn:

- `SampleDataImportService` vừa import BOM mới, vừa import thực đơn tuần, số suất và lịch sử mua hàng; nhánh `ReplaceBomCatalog` xóa toàn bộ `bomadjustments` và `dishbom`, không phân biệt history.
- `DishService` vừa là catalog/manual CRUD, vừa sinh template và parse format phẳng cũ (`DishCode`, `IngredientCode`, `GrossQtyPerServing`, ...).
- `WorkflowReportService` vừa tạo báo cáo, vừa thực thi cleanup dữ liệu; file đã vượt 3.000 dòng.

Kiến trúc đề xuất tách ba boundary rõ ràng:

1. **Canonical BOM ingestion:** parser thuần cho workbook `IPC. Định lượng 07.2026.xlsx`, ba sheet 25k/30k/34k, không truy cập DB.
2. **BOM reconciliation:** so sánh desired state từ workbook với catalog hiện tại, sinh preview có fingerprint, sau đó apply bằng transaction và versioning.
3. **Legacy cleanup:** classifier + retention policy riêng, dry-run mặc định; chỉ hard-delete marker/orphan chắc chắn, giữ chứng từ đã khóa/hoàn tất và audit.

`DishService` sau milestone chỉ còn catalog, coverage/validation và manual CRUD theo version. `MaterialDemandService` chỉ tiêu thụ BOM `PUBLISHED` đúng tier/scope/effective date; không còn áp dụng portion-rule legacy vào định lượng canonical.

## Hiện trạng và luồng dữ liệu

### Import canonical đang có

`SampleDataImportService.ImportBomDataAsync` đã đọc đúng file và ba sheet:

- `định lượng suất 25k` → 25.000
- `định lượng suất 30k` → 30.000
- `định lượng suất 34k` → 34.000

Khóa dedupe hiện tại là `tier + normalized dish name + normalized ingredient name`; nếu các dòng trùng khác định lượng thì tính bình quân gia quyền theo `Số lượng suất ăn`. `EnsureDish` và `EnsureIngredient` ghép theo tên normalize; mã mới sinh bằng SHA-1 ổn định. `EnsureBomLine` upsert theo `dish + ingredient + global scope + tier` và gán `PUBLISHED`, `effectiveFrom = 2026-01-01`, hao hụt 0.

Đơn vị kỹ thuật hiện map theo tên nguyên liệu: `CAI`, `HOP`, `QUA`, `O`, `MIENG`, `CAY`, `LAT`; còn lại dùng `KG`. Các giá trị lớn hơn 5 trong cột định lượng được hiểu là gram và chia 1.000; các giá trị 0,5–5 giữ nguyên cho đơn vị đếm.

### Consumption đang có

```text
MealQuantityPlanLine (final servings)
  → MenuSchedule.MenuPrice
  → normalize tier 25k / 30k / 34k
  → MenuItem.Dish.Dishboms
  → customer override nếu có, ngược lại global BOM
  → GrossQtyPerServing × servings × portion/yield factors
  → ProductionPlanLine + MaterialRequestLine
  → PurchaseRequest/Order/Receipt + InventoryIssue/Return/Movement
  → WorkflowReportService
```

`MaterialRequestLine` đã snapshot `BomId`, tier, scope, gross quantity, unit, servings, tổng demand và suggested purchase. Đây là điểm tách quan trọng: báo cáo lịch sử phải đọc snapshot trên chứng từ, không tính lại bằng BOM hiện hành.

### Các điểm không an toàn hiện tại

- `ReplaceBomCatalog` xóa toàn bộ BOM/adjustment; `MaterialRequestLine.BomId` có `SET NULL`, nhưng audit chi tiết BOM sẽ mất.
- `PruneStaleLines` xóa purchase-request lines khi regenerate demand mà chưa chặn đủ status approved/order/receipt. Cleanup v1.1 không được tái sử dụng logic này cho chứng từ đã khóa.
- `GetStalenessAsync` kiểm tra số suất, menu và tồn kho, nhưng chưa phát hiện BOM version đã đổi.
- `CorrectPresetBomTechnicalUnits` đổi `unitId` trên nhiều bảng dòng kho/chứng từ. Mọi migration tiếp theo phải chứng minh quantity semantics; không được chỉ đổi unit ID khi cần conversion số lượng.
- `SampleDataImportService` đang là dependency của `CoordinationController` cho weekly-menu production flow, nên không thể xóa nguyên service chỉ vì tên `SampleData`.
- Baseline `backend/database/Updated_IPCmanagement.sql` vẫn chứa `TMP-BOM-*`; fresh install có thể tái tạo dữ liệu đã cleanup.

## Kiến trúc đích

```text
AdminData / Canonical workbook
       |
       v
PresetBomWorkbookParser            [NEW, pure]
       | desired rows + source metadata + SHA-256
       v
BomCatalogReconciliationService    [NEW, application/domain]
       | preview: create/version/archive/deactivate/block
       | apply: revalidate fingerprint + single transaction
       +----------------------+
       |                      |
       v                      v
Dish/BOM catalog       LegacyDataCleanupService [NEW]
       |                      |
       |                drafts/orphans only
       v                      v
MaterialDemandService ----> production/purchase/inventory
       |
       v
Workflow reports read immutable document snapshots
```

### Component boundaries

| Component | Loại | Trách nhiệm |
|---|---|---|
| `PresetBomWorkbookParser` + `IPresetBomWorkbookParser` | **New** | Đọc 3 sheet, validate headers/tier, normalize Unicode/tên, dedupe, resolve technical unit definition, trả source row/sheet. Không EF Core. |
| `BomCatalogReconciliationService` + interface | **New** | So sánh desired set với DB; sinh action plan; apply idempotent; gán provenance; version BOM thay vì update/xóa mù. |
| `LegacyDataCleanupService` + policy/classifier | **New** | Phân loại marker, absence, history reference, draft dependency, orphan; dry-run/apply có audit và blocker. |
| `BomImportRun`/`BomReconciliationRun` | **New schema** | `fileName`, `sha256`, contract version, effective date, actor, status, counts, applied time. Có unique guard cho file hash + contract/effective date. |
| `Dishbom.SourceRunId`, `Dishbom.SourceKind` | **New schema** | Phân biệt `PRESET_WORKBOOK`, `MANUAL`, legacy/unknown; không dùng tên/mã là bằng chứng duy nhất trong các lần sau. |
| `BomMigrationController` hoặc admin-data controller | **New** | Multipart preview/apply/run status; authorization catalog/admin; controller mỏng. |
| `DishService`/`IDishService` | **Modified** | Giữ catalog, coverage, validation, add/update/close BOM version. Xóa template builder và old flat-file parser/commit. |
| `SampleDataImportService` | **Modified** | Tách `ImportBomDataAsync` sang canonical parser/reconciler; giữ weekly menu, quantity plan và các API coordination đang dùng. Dev import nếu còn giữ phải gọi service mới, không có logic BOM thứ hai. |
| `MaterialDemandService`/calculator | **Modified** | Fixed canonical BOM factor 100%; customer override/global fallback giữ nguyên; BOM change tham gia staleness; không mutate document locked/completed. |
| `WorkflowReportService` | **Modified/extract** | Report đọc snapshot; data-quality message dẫn đến import mới/manual CRUD; generic cleanup ủy quyền cho cleanup service thay vì cài business deletion trong report service. |
| `bomMigrationApi.ts` | **New frontend** | Typed preview/apply/run endpoints, tách khỏi manual `dishCatalogApi`. |
| `AdminDataPage` | **Modified** | Chỉ orchestration view; thay old template controls bằng import full workbook + cleanup preview; giữ manual CRUD. |
| `BomCatalogTable`, `BomMigrationPanel`, `CleanupPreviewDialog` | **New/extracted frontend** | Bảng fixed-layout/scroll riêng; shadcn `Dialog`, `Badge`, `Alert`, `Tabs`/existing `ViewSwitcher`, `DataTableShell`; hiển thị action/blocker trước apply. |

### Canonical import contract

Parser phải trả một model nội bộc, không trả thẳng EF entity:

```text
CanonicalBomRow
  SourceSheet, SourceRow
  PriceTier (25000|30000|34000)
  DishName, DishNormalizedKey, DishGroup, DishType
  IngredientName, IngredientNormalizedKey
  TechnicalUnitCode, GrossQtyPerServing
  ReferencePrice, SupplierName?, ServingWeight
```

Khóa reconciliation tối thiểu: `tier + scope + dish normalized key + ingredient normalized key + technical unit`. Việc bổ sung unit vào key ngăn merge nhầm hai row trùng tên nhưng khác semantics. Collision có cùng tên normalize nhưng khác mã/unit phải là blocker, không tự chọn.

`effectiveFrom` không nên hardcode trong parser. Preview/apply nhận ngày hiệu lực rõ ràng và hiển thị trên UI; file hash + effective date tạo identity của run.

## Phân loại cleanup và retention

### Ma trận quyết định

| Nhóm | Nhận diện | Hành động | Hard delete? |
|---|---|---|---|
| Canonical current | Khớp desired key + supported tier + unit/qty hợp lệ | Giữ, gắn provenance; không tạo version nếu payload không đổi | Không |
| Canonical changed | Khớp key nhưng qty/unit/effective payload đổi | Đóng version cũ, tạo version mới; ghi adjustment/audit | Không |
| Customer override thủ công | `CustomerId != null`, tier hợp lệ | Giữ trừ khi admin chọn; workbook global không được xóa override | Không |
| Known temporary | `TMP-BOM-DISH-*`, `TMP-BOM-ING-*`, `TMP-BOM-WH-*` | Xóa leaf-first nếu không có retained reference; nếu có history thì archive/deactivate | Chỉ khi unreferenced |
| Legacy tier/format | Published BOM ngoài 25k/30k/34k hoặc dòng old importer | Archive; xóa nếu không có adjustment/chứng từ/audit cần giữ | Có điều kiện |
| Catalog by absence | Món/nguyên liệu không có trong desired set | Deactivate; xem menu, production, inventory, quotations, document refs trước khi xóa | Mặc định không |
| Draft/open dependent | Draft material request, purchase request, production plan, menu draft dùng legacy | Cancel/remove/rebuild theo thứ tự dependency | Có, có audit |
| Locked/completed history | Approved/ordered/received/issued/returned/completed; audit/approval history | Giữ entity và snapshot, không regenerate; BOM cũ archive để truy vết | Không |
| Stock-bearing legacy ingredient | Current qty khác 0, lot/movement/receipt/issue/return refs | Block apply, yêu cầu stocktake/transfer/adjustment hợp lệ | Không |
| True orphan leaf | Không canonical, không active ref, không history ref, stock 0 | Xóa theo thứ tự con → cha | Có |
| Ambiguous collision | Tên normalize trùng nhưng code/unit/reference khác | Block và yêu cầu mapping thủ công | Không |

### Thứ tự cleanup dependency

1. Chốt workbook fingerprint, retention cut-off và snapshot counts.
2. Khóa/cancel draft `PurchaseRequest`/line không có order/receipt.
3. Xóa draft inventory issue chưa received, return hay stock movement.
4. Xóa/rebuild draft `MaterialRequestLine`, `MaterialRequest`, `ProductionPlanLine/Plan`.
5. Xử lý menu draft/menu item active tham chiếu món legacy; history menu đã publish giữ nguyên.
6. Archive/delete BOM + adjustment theo policy.
7. Deactivate/delete dish, ingredient, supplier/warehouse/unit chỉ khi không cò reference.
8. Reconcile current stock/lot; tuyệt đối không xóa stock khác 0.
9. Ghi một audit batch và per-action summary, commit transaction.

Cleanup phải idempotent: chạy lại cùng plan sau apply trả `0 action`, không tạo thêm version/audit rỗng.

## API compatibility

### Giữ

- `GET /api/dishes/catalog`
- `GET /api/dishes/bom-coverage`
- `GET /api/dishes/bom-validation`
- `GET /api/dishes/{id}/bom`
- `POST /api/dishes/{id}/bom`
- `PUT /api/dishes/{id}/bom/{bomId}`
- `DELETE /api/dishes/{id}/bom/{bomId}` (close/version semantics, không hard-delete)
- Customer/global scope và tier 25k/30k/34k cho manual CRUD.

### Thay thế old format

Loại bỏ sau khi frontend mới đã chuyển:

- `GET /api/dishes/bom-template`
- `POST /api/dishes/bom-import/preview`
- `POST /api/dishes/bom-import/commit`
- `BomTemplateWorkbookBuilder`
- `BomTemplateQueryDto`, `BomImport*` DTO cũ; interface methods tương ứng.
- RTK hooks `downloadBomTemplate`, `previewBomImport`, `commitBomImport` và UI `BOM thiếu`/`Mẫu trống`.

Data-quality text hiện cò hướng dẫn “tải mẫu Excel” phải chuyển thành “import workbook định lượng canonical hoặc sửa thủ công”.

### Endpoint mới đề xuất

- `POST /api/admin-data/bom-reconciliation/preview` — multipart workbook + effective date; trả counts theo sheet/tier, action list, blockers, file hash và plan token.
- `POST /api/admin-data/bom-reconciliation/apply` — nhận plan token/hash + confirmation; parse/revalidate lại file để chống TOCTOU.
- `GET /api/admin-data/bom-reconciliation/runs/{id}` — kết quả/audit của run.
- `POST /api/admin-data/legacy-cleanup/preview` và `/apply` — có thể ủy quyền chung cho reconciliation service nếu UI muốn một flow duy nhất.

Preview response phải tách `willCreate`, `willVersion`, `willArchive`, `willDeactivate`, `willDeleteDraft`, `willHardDeleteOrphan`, `blockedByHistory`, `blockedByStock`, `warnings`; không chỉ trả valid/error rows.

## Portion-rule compatibility

Migration `CleanLegacyPortionData` đã xóa row `portionrules` và đặt các factor về 100, nhưng schema, DTO, Coordination endpoints, service resolution và frontend fields vẫn còn. Đây là legacy calculation path cần xử lý theo hai bước:

1. **Runtime cutover:** `MaterialDemandService` dùng fixed factor 100 cho canonical BOM; xóa create/update/resolve portion-rule API và UI. Customer contract/menu schedule không còn cho phép chỉnh BOM rate.
2. **Schema cleanup:** giữ các snapshot field trên `MaterialRequestLine` cho historical report (`AppliedPortionRuleSource`, rate, yield) nhưng không dùng để tính mới. Sau khi test compatibility, xóa `portionrules` entity/table và các live input field `defaultBomRatePercent`/`menuschedules.bomRatePercent`; nếu giữ các cột này trong v1.1 thì phải read-only 100 và đánh dấu deprecated.

Không xóa snapshot historical chỉ vì source rule đã bỏ.

## Migration và rollback strategy

### Nguyên tắc

- Không sửa/xóa migration đã apply như `20260626043000_SeedTemporaryBomData`. EF migration là lịch sử schema; dùng forward cleanup migration.
- Không đặt destructive business cleanup vào một migration không có preview. Migration chỉ thêm provenance/schema/index/default; application cleanup service thực thi data policy có dry-run và audit.
- Cập nhật fresh-install baselines/scripts để không seed `TMP-BOM-*`; chỉ giữ một documented source of truth. `Clean_Legacy_Imported_Bom.sql` cần được thay bằng script sinh/tương đương với service, không drift policy.
- Backup DB và xuất dry-run artifact trước apply. Do retention không cho phép tái tạo dữ liệu cũ, `Down()` không phải rollback dữ liệu; rollback là restore backup + deploy code cũ.

### Cutover không gián đoạn

1. Deploy parser/reconciliation API + provenance schema, chưa xóa old endpoint.
2. Chạy preview trên snapshot DB; xử lý collision/blocker.
3. Chuyển Admin UI sang endpoint mới, giữ manual CRUD.
4. Apply canonical reconciliation, sau đó cleanup draft/orphan.
5. Verify demand/purchase/inventory/report và history.
6. Xóa old endpoint/DTO/builder/frontend hooks/test; cập nhật baseline.

Trong khoảng cutover, old endpoints có thể tạm thời trả deprecation warning; không cho phép hai importer cùng ghi BOM sau khi apply run đầu tiên.

## Downstream consistency

### Material demand/production

- Thêm BOM provenance/version vào staleness: draft/open request là stale nếu `BomId` không còn current/effective cho service date, tier và scope.
- Regenerate chỉ `DRAFT`/unlocked documents. Approved/issued/completed documents giữ snapshot; nếu cần thay đổi thì tạo adjustment/new document, không prune line.
- `ResolveBomLines` giữ precedence customer override → global; reconciliation workbook global không được làm mất override.
- Hủy các `Portionrule` active legacy và fixed factor 100 để tránh nhân đôi định lượng đã được workbook chốt.

### Purchase/inventory

- Draft purchase line từ stale demand được xóa/rebuild; line đã order/receipt là historical và bị block cleanup.
- Ingredient technical unit phải tương thích với stock unit theo `BaseUnitCode + ConvertRateToBase`; đơn vị đếm khác base (`CAI`, `HOP`, ...) không được convert ngầm sang KG.
- Legacy ingredient có stock khác 0 là blocker; cần stocktake/adjustment có audit trước khi deactivate/delete.

### Reporting/audit

- Historical reports dùng snapshot `MaterialRequestLine`; join sang BOM chỉ để enrich khi còn.
- Data-quality thêm các category: `legacy_bom_source`, `canonical_collision`, `draft_demand_stale_by_bom`, `legacy_stock_blocker`, `orphan_catalog`.
- Cleanup audit cần `runId`, file hash, actor, reason, counts và action summary. Không xóa `Auditlog`/`Approvalhistory`.

## Frontend/shadcn boundary

`AdminDataPage` hiện ôm hầu hết state và handler. Milestone nên tách UI theo feature, nhưng giữ route `/admin-data` và visual language hiện tại:

- `BomMigrationPanel`: chọn full workbook, effective date, preview/apply; không còn tier selector cho upload vì tier nằm trong sheet. Tier selector vẫn dùng để filter catalog/manual CRUD.
- `BomCatalogTable`: `table-fixed`, min-width cố định, `DataTableShell`/scroll container có chiều cao cố định; search không được làm co layout.
- `CleanupPreviewDialog`: shadcn `Dialog` + `Alert`/`Badge`, group action theo safe/warning/blocked, confirmation hiển thị hash và counts.
- Manual add/edit/close dialog giữ version semantics và reason bắt buộc khi sửa.
- RTK cache invalidation sau apply: `DishCatalog`, `WorkflowReports`, `MaterialDemandStaleness`, `Ingredients`; không reload toàn trang.

## Build order đề xuất

1. **Freeze contract + characterization tests:** fixture workbook ba sheet, Unicode/header/unit/dedupe tests; snapshot DB invariants và retention statuses.
2. **Pure parser + provenance schema:** không đổi runtime demand.
3. **Read-only reconciliation preview/classifier:** action matrix, fingerprint, blockers; API và integration tests.
4. **Transactional apply + manual CRUD convergence:** idempotent versioning, audit, customer override preservation.
5. **Downstream hardening:** BOM staleness, draft-only regenerate/cleanup, fixed factor 100, historical snapshot reports.
6. **Admin UI cutover:** shadcn preview/confirm, fixed catalog table, manual CRUD giữ nguyên.
7. **Forward cleanup + fresh baseline:** apply trên backup, xử lý TMP/orphans/drafts, loại portion-rule runtime, cập nhật SQL bootstrap.
8. **Delete old format surface:** controller/service/DTO/builder/RTK hooks/tests/docs/messages; quét repo không cò old endpoint/copy.

Thứ tự này giữ hệ thống luôn có manual CRUD và cho phép quan sát preview trước bất kỳ deletion nào.

## Blast radius và rủi ro

GitNexus index hiện cho `DishService` mức LOW nhưng ghi rõ `lower-bound` do interface/DI; `AdminDataPage` LOW/exact. Index không nhận diện được các class partial/mới (`SampleDataImportService`, `MaterialDemandService`, `WorkflowReportService`), nên không được coi kết quả 0 caller là bằng chứng an toàn. Static inspection cho thấy blast radius thực tế là **HIGH** vì:

- Importer ghi dishes, ingredients, units, suppliers, BOM, menu, quantity plan, stock/purchase sample data.
- BOM là input trực tiếp của production plan/material request và gián tiếp của purchase, warehouse, reports.
- Xóa portion-rule path ảnh hưởng Coordination controller/service/DTO, contract/schedule UI, demand DTO/report DTO và tests.
- Old-format removal chạm `DishesController`, `IDishService`, `DishService`, `BomTemplateWorkbookBuilder`, Dish DTOs, RTK API, `AdminDataPage`, data-quality copy và `DishCatalogTests`.

Vì vậy implementation phải chạy GitNexus impact trên từng symbol ngay trước edit, và `detect_changes` trước commit; không dựa vào class-level lower-bound này.

## Verification gates

- Parser: đúng 3 tier, không row zero, không unknown unit, technical unit/quantity semantics đúng, duplicate weighted result deterministic.
- Reconciliation: cùng file apply hai lần → lần hai 0 action; file đổi sau preview → apply bị từ chối.
- Retention: 100% locked/completed document và audit còn nguyên; draft stale được cancel/rebuild; không dangling FK.
- Demand: với mỗi tier/scope, output = servings × canonical quantity (và yield nếu business còn cho phép); customer override precedence đúng; BOM update đánh dấu draft stale.
- Inventory: không delete non-zero stock; không conversion khác base unit; ledger reconciliation về 0 discrepancy.
- API/UI: old routes trả 404/410 sau cutover, không cò old template copy; manual add/edit/close pass; table không co khi search và có scroll riêng.
- Fresh DB và upgraded DB cho cùng invariant: không `TMP-BOM-*`, không published legacy tier, không active dish legacy by absence trừ approved exception, không orphan draft.

## Kiến nghị cho planner

Chia milestone thành nhiều plan theo vertical safety boundary, không gom “xóa legacy” vào một migration duy nhất. Plan đầu tiên phải cho ra parser + preview read-only; plan destructive chỉ bắt đầu sau khi retention tests và backup/restore rehearsal đã pass. Phần xóa old API/UI là plan cuối của cutover, không phải bước đầu.

