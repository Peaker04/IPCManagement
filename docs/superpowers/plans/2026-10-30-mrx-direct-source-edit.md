# MRX — Sửa nguồn trực tiếp theo ngày chưa xuất & số suất Mặn/Chay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin/Quản lý sửa món và số suất Mặn/Chay của tuần MRX được áp dụng ngay và đồng bộ lô, Kho, Bếp, Đối chiếu trên các ngày chưa có phiếu xuất; Điều phối gửi yêu cầu để Admin/Quản lý duyệt.

**Architecture:** Một service backend `MrxSourceChangeApplier` là đường ghi duy nhất cho sửa trực tiếp, duyệt yêu cầu và import lại; nó tính lại định lượng chỉ cho các ngày chưa khóa (khóa = căn tin × ngày đã có phiếu xuất) và cập nhật tại chỗ daily line/contributor của lô hiện có. Projection định lượng nhân món chay với số suất chay và món còn lại với số suất mặn. Frontend có lưới tuần sửa trực tiếp, panel xem trước, và xóa toàn bộ cache MRX sau mọi thao tác ghi.

**Tech Stack:** ASP.NET Core (.NET 9, EF Core, MySQL; test xUnit + SQLite qua `WorkflowFixture`), React 19 + Vite + Vitest + Testing Library, Playwright (`frontend/tests/e2e-mrx`).

**Spec:** `docs/superpowers/specs/2026-10-30-mrx-direct-source-edit-design.md`

## Global Constraints

- Chỉ áp dụng cho `MATERIAL_RECONCILIATION`; DEFAULT không đổi hành vi (`DOM-MODE-1`). `mealquantityplanlines.FinalServings` vẫn là trường DEFAULT đọc.
- Migration chỉ thêm cột/index; không backfill, không rewrite lô cũ, không seed, không đổi mode.
- Khóa ngày: đơn vị **căn tin × ngày phục vụ**; ngày có ≥1 phiếu xuất của lô là khóa; lô `COMPLETED` khóa toàn bộ (BR-MRX-EDIT-3).
- Yêu cầu có dòng **thay đổi** chạm ngày khóa → từ chối toàn bộ, không ghi gì (BR-MRX-EDIT-4).
- Không sinh delta `SUPPLEMENTAL_ISSUE`/`RETURN_REQUIRED` cho dữ liệu mới; delta mới `Status = "APPLIED"`.
- Mã lỗi: `MRX_DAY_LOCKED` 409, `MRX_SOURCE_STALE` 409, `MRX_BATCH_COMPLETED` 409, `MRX_SERVINGS_SPLIT_REQUIRED` 422, `MRX_BOM_MISSING` 422.
- Vai trò: áp dụng trực tiếp/duyệt = Admin + Quản lý; gửi yêu cầu = Điều phối; Thủ kho/Bếp trưởng không sửa nguồn.
- Copy UI tiếng Việt; không lộ UUID/enum thô; UI dùng UI Kit 3 vùng và primitives `frontend/src/components/ui/`; không token màu ngoài `frontend/src/styles/index.css`. Mỗi task sửa `.tsx` phải xuất "Scoped Pre-Code UI Gate Block" theo `AGENTS.md` trước khi sửa.
- Không commit/push khi owner chưa cho phép; các bước "Commit" chỉ chạy khi đã được phép (nếu chưa, bỏ qua và ghi vào `.planning/WORK.md`).
- Test theo `.pi/skills/ipc-test-audit/SKILL.md` (TA-1..5): fixture bám DTO C#, không mock component đang test.

## Review Focus

1. **Lưới tuần gửi cả dòng không đổi của ngày khóa** (editor gửi toàn bộ ô): chỉ dòng có giá trị khác nguồn mới tính là "chạm ngày khóa"; dòng giống hệt phải bỏ qua, không bị từ chối. Test: Task 6 `Unchanged_locked_day_line_is_ignored`.
2. **Số suất chay = 0** (căn tin không ăn chay hôm đó): hợp lệ; món chay đóng góp 0, không lỗi. Test: Task 3 `Zero_vegetarian_servings_contribute_nothing`.
3. **Nguyên liệu bị bỏ ở ngày mở nhưng còn ở ngày khóa:** daily line ngày mở về 0, ngày khóa giữ nguyên, tổng tuần = tổng daily. Test: Task 5 `Removed_ingredient_zeroes_open_day_and_keeps_locked_day`.
4. **Đổi sang món chưa có BOM hiệu lực cho ngày đó:** trả `MRX_BOM_MISSING`, không ghi phần nào. Test: Task 6 `Replacement_without_bom_writes_nothing`.
5. **Bấm "Áp dụng" hai lần liên tiếp:** lần hai gửi version lô cũ → `MRX_SOURCE_STALE`, chỉ một revision. Test: Task 6 `Double_apply_with_same_versions_creates_one_revision`.

---

## File Structure

**Backend (`backend/src/IPCManagement.Api/`)**
- `Models/Entities/MealQuantityPlanLine.cs` — thêm `SavoryServings`, `VegetarianServings`.
- `Models/Entities/ReconciliationBatchContributor.cs` — thêm `FrozenMenuVariant`.
- `Models/Entities/ReconciliationSourceRevision.cs` — thêm `AppliedByRole`, `ApplyMode` (lớp revision).
- `Features/Reconciliation/Persistence/ReconciliationEntityConfigurations.cs`, `Features/Inventory/Persistence/InventoryEntityConfigurations.cs`, cấu hình EF của `MealQuantityPlanLine` — cột/index.
- `Migrations/<timestamp>_MrxDirectSourceEdit.cs` — migration thêm cột/index.
- `Exceptions/MrxSourceChangeException.cs` (mới) + `Middlewares/ExceptionMiddleware.cs` — lỗi có `code`.
- `Features/Reconciliation/Services/ReconciliationMaterialProjection.cs` — nhân theo loại thực đơn.
- `Features/Reconciliation/Services/ReconciliationQuantityImportService.cs` — fingerprint v3.
- `Features/Reconciliation/Services/ReconciliationBatchService.cs` — ghi `FrozenMenuVariant` khi materialize.
- `Features/Reconciliation/Services/MrxDayLockReader.cs` (mới) — tập ngày khóa.
- `Features/Reconciliation/Services/MrxBatchRecomputer.cs` (mới) — cập nhật lô cho ngày mở (thay `ReconciliationSourceRevisionService.StageBatchAsync`).
- `Features/Reconciliation/Services/MrxSourceChangeApplier.cs` (mới) — giao dịch áp dụng.
- `Features/SampleData/Services/MenuAmendmentService.cs`, `MrxMenuAmendmentCoordinator.cs`, `Contracts/MenuAmendmentDto.cs`, `Controllers/WeeklyMenuImportsController.Amendments.cs` — nối applier, endpoint `mrx-apply`.
- `Features/SampleData/Services/WeeklyMenuImportService.cs`, `WeeklyMenuBulkEditService.cs`; `Features/Coordination/Services/MealQuantityPlanService.cs`, `Contracts/CoordinationDto.cs` — một đường sửa, số suất tách.
- `Features/Reconciliation/Services/ReconciliationCompletionService.cs` — bỏ chặn bởi delta `PENDING` cũ.
- `Features/Reconciliation/Controllers/ReconciliationWeeklyMenuController.cs` + `Services/MrxEditScopeQuery.cs` (mới) — `GET edit-scope`.
- `Features/Reconciliation/Services/ReconciliationBatchService.cs` (warehouse-daily), `ReconciliationKitchenExportService.cs` — `lastRevisionAt/By`, `menuVariant`.
- `Security/AuthorizationPolicies.cs`, `Program.cs` — policy `ReconciliationSourceEditAccess`.

**Frontend (`frontend/src/`)**
- `store/serverStateCache.ts` — `deletePrefix`.
- `api/mrxCacheInvalidation.ts` (mới) — `invalidateMrxCaches()`.
- `hooks/useWorkbenchQuery.ts` — tải lại khi focus cho khóa `mrx_`.
- `api/mrxApi.ts` — API sửa nguồn mới; bỏ `adminConfirm…`.
- `api/mrxErrors.ts` (mới) — map mã lỗi → tiếng Việt.
- `features/weekly-menu/MrxSourceEditGrid.tsx` (mới), `MrxSourceChangePanel.tsx` (mới, thay `MrxSourceChangeModal.tsx`), `MrxPendingRequestsPanel.tsx` (mới), `hooks/useMrxSourceEdit.ts` (mới), sửa `MrxBatchWorkbench.tsx`, `hooks/useMrxBatchWorkspace.ts`, `WeeklyMenuImportModal.tsx`.
- `features/warehouse/branches/MrxDailyLinesBranch.tsx`, `features/chef/MrxCookingWorkbench.tsx` — ghi chú revision, cột Mặn/Chay.

---

### Task 1: Dữ liệu và migration

**Files:**
- Modify: `Models/Entities/MealQuantityPlanLine.cs`, `Models/Entities/ReconciliationBatchContributor.cs`, `Models/Entities/ReconciliationSourceRevision.cs`, các file cấu hình EF tương ứng
- Create: `Migrations/<timestamp>_MrxDirectSourceEdit.cs` (tạo bằng `dotnet ef migrations add MrxDirectSourceEdit`)
- Test: `backend/tests/IPCManagement.Api.Tests/MrxDirectSourceEditModelTests.cs`

**Interfaces:**
- Produces: `MealQuantityPlanLine.SavoryServings: int?`, `MealQuantityPlanLine.VegetarianServings: int?`; `ReconciliationBatchContributor.FrozenMenuVariant: string?` (max 16, giá trị `"savory"|"vegetarian"`); `ReconciliationSourceRevision.AppliedByRole: string?` (max 32), `ApplyMode: string?` (max 24, `"DIRECT"|"APPROVED_REQUEST"|"REIMPORT"`); index `ix_inventoryissues_reconciliationBatchId_issueDate` trên (`ReconciliationBatchId`, `IssueDate`).

- [ ] **Step 1: Viết test model** — theo kiểu `ReconciliationDailyPersistenceModelTests.cs`: `Model_exposes_mrx_direct_edit_columns_and_issue_date_index` khẳng định 5 property trên tồn tại, nullable, đúng max length, và index tồn tại với đúng 2 cột theo thứ tự.
- [ ] **Step 2: Chạy, xác nhận FAIL** — `dotnet test backend/tests/IPCManagement.Api.Tests --filter "FullyQualifiedName~MrxDirectSourceEditModelTests"` → FAIL (property không tồn tại).
- [ ] **Step 3: Thêm property + cấu hình EF + migration** — migration chỉ `AddColumn`/`CreateIndex`; `Down` gỡ đúng các thứ đó.
- [ ] **Step 4: Chạy lại test** → PASS; `dotnet build backend/src/IPCManagement.Api` → 0 lỗi.
- [ ] **Step 5: Commit** — `feat(mrx): add direct source edit columns and issue-date index`.

### Task 2: Lỗi có mã cho MRX

**Files:**
- Create: `Exceptions/MrxSourceChangeException.cs`
- Modify: `Middlewares/ExceptionMiddleware.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/MrxSourceChangeErrorContractTests.cs`

**Interfaces:**
- Produces: `public sealed class MrxSourceChangeException(string code, int statusCode, string message, IReadOnlyList<DateOnly>? lockedDates = null) : Exception` với hằng `MrxErrorCodes.DayLocked="MRX_DAY_LOCKED"`, `SourceStale="MRX_SOURCE_STALE"`, `BatchCompleted="MRX_BATCH_COMPLETED"`, `ServingsSplitRequired="MRX_SERVINGS_SPLIT_REQUIRED"`, `BomMissing="MRX_BOM_MISSING"`. Body lỗi: `{ success:false, code, message, lockedDates: ["yyyy-MM-dd", …] | null, correlationId }`.

- [ ] **Step 1: Test** — `Middleware_maps_day_locked_to_409_with_code_and_dates`: ném `new MrxSourceChangeException(MrxErrorCodes.DayLocked, 409, "…", [new DateOnly(2026,6,15)])` qua middleware (dùng `DefaultHttpContext`), khẳng định status 409, `code == "MRX_DAY_LOCKED"`, `lockedDates == ["2026-06-15"]`. Thêm `Middleware_maps_servings_split_required_to_422`.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Implement** — thêm arm cho `MrxSourceChangeException` trước arm mặc định; body thêm `code`, `lockedDates`.
- [ ] **Step 4: Chạy** → PASS.
- [ ] **Step 5: Commit** — `feat(mrx): structured error codes for source changes`.

### Task 3: Định lượng theo Mặn/Chay

**Files:**
- Modify: `Features/Reconciliation/Services/ReconciliationMaterialProjection.cs`, `ReconciliationQuantityImportService.cs` (fingerprint), `ReconciliationBatchService.cs:426-439` (materialize contributor)
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationVariantServingsTests.cs`

**Interfaces:**
- Consumes: Task 1 columns; `WeeklyMenuImportSupport.ParsePersistedDishSlot(string?)`.
- Produces: `ProjectedDish` có thêm `string MenuVariant` và `int Servings` (số suất của đúng loại); `ReconciliationMaterialProjection.Project(...)` ném `MrxSourceChangeException(ServingsSplitRequired, 422, …)` khi một dòng nguồn có `SavoryServings` hoặc `VegetarianServings` null; fingerprint nguồn ghi tiền tố `v3` và thêm `SavoryServings`, `VegetarianServings` vào chuỗi băm.

- [ ] **Step 1: Test** (seed qua `WorkflowFixture.SeedMenuWithDemandAsync`, thêm 1 món slot `vegetarian-main` cùng ngày/ca):
  - `Vegetarian_slot_multiplies_vegetarian_servings`: Savory=280, Vegetarian=20 → yêu cầu món chay = BOM × 20, món mặn = BOM × 280.
  - `Same_dish_in_both_menus_counts_twice`: cùng `DishId` ở `savory-main` và `vegetarian-main` → 2 đóng góp (×280 và ×20).
  - `Zero_vegetarian_servings_contribute_nothing`: Vegetarian=0 → món chay đóng góp 0, không lỗi.
  - `Missing_split_throws_servings_split_required`: cả hai null → `MrxSourceChangeException.Code == "MRX_SERVINGS_SPLIT_REQUIRED"`.
  - `Materialized_contributor_records_variant_and_variant_servings`: commit tạo lô → contributor món chay có `FrozenMenuVariant=="vegetarian"`, `FrozenServings==20`.
  - `Fingerprint_changes_when_split_changes_with_same_total`: (280,20) và (270,30) cho fingerprint khác nhau.
- [ ] **Step 2: Chạy** `--filter "FullyQualifiedName~ReconciliationVariantServingsTests"` → FAIL.
- [ ] **Step 3: Implement** — khử trùng `DistinctBy` theo `(variant, DishId)`; nhân `bom.GrossQtyPerServing * servingsOfVariant`; khi tạo contributor ghi `FrozenMenuVariant` và `FrozenServings` theo loại.
- [ ] **Step 4: Chạy** → PASS; chạy cả `ReconciliationQuantityImport*Tests` và `ReconciliationKitchenExportTests` → PASS (cập nhật seed của các test này để set cả hai số suất; không nới assertion).
- [ ] **Step 5: Commit** — `feat(mrx): split servings by savory/vegetarian menu in projection`.

### Task 4: Nhập số suất tách và một đường sửa sau khi có lô

**Files:**
- Modify: `Features/Coordination/Contracts/CoordinationDto.cs` (`UpsertQuickServingsRequest`), `Features/Coordination/Services/MealQuantityPlanService.cs:103,306-329`, `Features/SampleData/Services/WeeklyMenuBulkEditService.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/MealQuantityPlanPolicyTests.cs`

**Interfaces:**
- Produces: `UpsertQuickServingsRequest.SavoryServings: int?`, `VegetarianServings: int?`. Ở MRX: bắt buộc cả hai (≥0, tổng >0), `FinalServings = tổng`; `Servings` bị bỏ qua. Ở DEFAULT: hành vi cũ giữ nguyên.
- `EnsureNoActiveReconBatchAsync` đổi điều kiện từ `TRANSFERRED|IN_PROGRESS|COMPLETED` thành **mọi lô** của căn tin × tuần; message: "Tuần này đã có lô đối soát. Vui lòng dùng chức năng Điều chỉnh nguồn." `BulkUpdateWeeklyMenuAsync` gọi cùng kiểm tra ở MRX.

- [ ] **Step 1: Test** — `Mrx_quick_servings_requires_both_split_values`; `Mrx_quick_servings_sets_final_as_sum` (280+20 → 300); `Mrx_quick_servings_rejected_when_draft_batch_exists`; `Mrx_bulk_update_rejected_when_batch_exists`; `Default_quick_servings_unchanged` (DEFAULT với `Servings=100`, không có split → FinalServings 100).
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Implement** theo Interfaces (đọc mode từ `SystemOperationRequestContext`).
- [ ] **Step 4: Chạy** → PASS.
- [ ] **Step 5: Commit** — `feat(mrx): savory/vegetarian quick servings and single edit path`.

### Task 5: Khóa ngày và tính lại lô theo ngày mở

**Files:**
- Create: `Features/Reconciliation/Services/MrxDayLockReader.cs`, `Features/Reconciliation/Services/MrxBatchRecomputer.cs`
- Modify: `Features/Reconciliation/Services/ReconciliationSourceRevisionService.cs` (bỏ `StageBatchAsync`/`StageIssuedBatchAsync`, `StageAffectedBatchesAsync` gọi recomputer)
- Test: `backend/tests/IPCManagement.Api.Tests/MrxBatchRecomputerTests.cs`

**Interfaces:**
- Produces:
  - `MrxDayLockReader.GetLockedDatesAsync(IpcManagementContext ctx, byte[] batchId, CancellationToken ct) : Task<IReadOnlySet<DateOnly>>` — hợp của `InventoryIssue.IssueDate` của lô **và** `ServiceDate` của daily line mà issue line của lô tham chiếu (bảo thủ).
  - `MrxBatchRecomputer.ApplyAsync(ReconciliationBatch batch, IReadOnlyList<ReconciliationRevisionMaterialFact> requirements, IReadOnlySet<DateOnly> lockedDates, MrxRevisionStamp stamp, CancellationToken ct) : Task<ReconciliationSourceRevision>` với `record MrxRevisionStamp(byte[] ActorId, string ActorRole, string ApplyMode, string Reason, byte[] PreviousMenuVersionId, byte[] AppliedMenuVersionId, byte[]? MenuAmendmentId)`.
  - Hành vi cho mỗi ngày **không** thuộc `lockedDates`: daily line có sẵn → `RequiredQuantity` mới, `Version++`; nguyên liệu mới → thêm batch line (dùng tolerance như hiện tại) + daily line; nguyên liệu không còn → `RequiredQuantity = 0`; xóa và tạo lại contributor **của ngày đó** (có `FrozenMenuVariant`). Ngày khóa: không đụng daily line, không đụng contributor. Sau cùng: `batchLine.RequiredQuantity = Σ daily`; `batch.MenuVersionId = stamp.AppliedMenuVersionId`; `batch.Version++`; revision `Status="APPLIED"` + delta `Status="APPLIED"`, `WorkKind="SOURCE_CHANGE"` chỉ cho các cặp ngày × nguyên liệu có số thay đổi.

- [ ] **Step 1: Test** (dựng lô như `MrxMenuAmendmentTests.Admin_approval_of_issued_batch…`, có 2 ngày 2026-06-15 và 2026-06-17, phiếu xuất cho 2026-06-15):
  - `Lock_reader_returns_issued_service_dates` → {2026-06-15}.
  - `Open_day_requirement_and_contributors_are_replaced` (2026-06-17 đổi; version daily +1; contributor mới có variant).
  - `Locked_day_lines_and_contributors_are_untouched` (so sánh từng trường trước/sau).
  - `Removed_ingredient_zeroes_open_day_and_keeps_locked_day` (Review Focus 3; tổng tuần = Σ daily).
  - `New_ingredient_creates_batch_line_and_daily_line`.
  - `Batch_points_to_applied_menu_version_and_version_increments`.
  - `No_supplemental_or_return_deltas_are_created` (mọi delta `Status=="APPLIED"`).
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Implement** theo Interfaces.
- [ ] **Step 4: Chạy** → PASS; chạy `ReconciliationSourceDeltaProjectorTests` và `MrxMenuAmendmentTests` → cập nhật các test đang khẳng định hành vi cũ (`pending_delta`) cho đúng spec mới, ghi rõ test nào đổi kỳ vọng trong mô tả commit.
- [ ] **Step 5: Commit** — `feat(mrx): per-day lock and in-place batch recompute`.

### Task 6: Service áp dụng và API sửa trực tiếp

**Files:**
- Create: `Features/Reconciliation/Services/MrxSourceChangeApplier.cs`
- Modify: `Features/SampleData/Contracts/MenuAmendmentDto.cs`, `Features/SampleData/Services/MenuAmendmentService.cs:90-200,242-300`, `MrxMenuAmendmentCoordinator.cs`, `Features/SampleData/Controllers/WeeklyMenuImportsController.Amendments.cs`, `Security/AuthorizationPolicies.cs`, `Program.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/MrxSourceChangeApplierTests.cs`, `MrxMenuAmendmentTests.cs`

**Interfaces:**
- Consumes: Task 2, 3, 5.
- Produces:
  - DTO: `CreateMenuAmendmentLineRequest.NewSavoryServings: int?`, `NewVegetarianServings: int?`; `CreateMenuAmendmentRequest.ExpectedBatchVersion: long?`; `MenuAmendmentImpactLineDto` thêm `CurrentSavoryServings`, `CurrentVegetarianServings`, `NewSavoryServings`, `NewVegetarianServings`; `MenuAmendmentResultDto` thêm `LockedDates: List<DateOnly>` và `MaterialImpact: List<MrxMaterialImpactDto>` với `record MrxMaterialImpactDto(DateOnly ServiceDate, string IngredientCode, string IngredientName, string UnitName, decimal PreviousQuantity, decimal NewQuantity)`. Ở MRX, `NewServings` khác null → 400.
  - `MrxSourceChangeApplier.ApplyAsync(MenuAmendment amendment, byte[] actorId, string actorRole, string applyMode, long? expectedBatchVersion, CancellationToken ct) : Task<MenuAmendmentResultDto>` chạy trong `EfTransactionRunner.ExecuteProtectedAsync` (Serializable), theo thứ tự §4.1 của spec; lô bị ảnh hưởng tìm theo căn tin × tuần qua `Menuversions`, không theo phiên bản gốc.
  - Policy `AuthorizationPolicies.ReconciliationSourceEditAccess` = alias Admin + Quản lý hiện có.
  - Endpoint `POST /api/coordination/weekly-menu/amendments/mrx-apply` (ReconciliationOnly, `ReconciliationSourceEditAccess`) thay `admin-confirm` (xóa); `mrx-decision` và `mrx-inbox` đổi sang `ReconciliationSourceEditAccess`; duyệt gọi applier với `applyMode="APPROVED_REQUEST"`, nếu `MRX_DAY_LOCKED` thì đặt yêu cầu `CORRECTION_REQUIRED` rồi ném lại lỗi.
  - Preview (`POST …/amendments/preview`) ở MRX điền `LockedDates`, `MaterialImpact`; không ghi.
  - Audit: mỗi thay đổi `SavoryServings`/`VegetarianServings` ghi một `AuditLog` (`EntityName = MealQuantityPlanLine`, `FieldName` tương ứng, giá trị trước/sau, `Reason` = lý do yêu cầu), cùng mẫu dòng audit `FinalServings` hiện có ở `MenuAmendmentService.cs:170`.

- [ ] **Step 1: Test**:
  - `Manager_direct_apply_updates_open_day` (role Quản lý; DB thay đổi như Task 5).
  - `Change_touching_locked_day_is_rejected_and_writes_nothing` (code `MRX_DAY_LOCKED`, `LockedDates==[2026-06-15]`, số menuversion/revision không đổi).
  - `Unchanged_locked_day_line_is_ignored` (Review Focus 1).
  - `Replacement_without_bom_writes_nothing` (Review Focus 4, `MRX_BOM_MISSING`).
  - `Double_apply_with_same_versions_creates_one_revision` (Review Focus 5, lần hai `MRX_SOURCE_STALE`).
  - `Completed_batch_is_rejected` (`MRX_BATCH_COMPLETED`).
  - `Second_edit_after_issue_still_reaches_batch` (hồi quy P2: hai lần sửa liên tiếp trên lô đã có phiếu xuất, lần hai đổi daily line ngày mở).
  - `Approval_after_day_became_locked_sets_correction_required`.
  - `Preview_returns_material_impact_and_locked_dates_without_writes`.
  - `Endpoints_use_expected_policies` (reflection: `mrx-apply`, `mrx-decision`, `mrx-inbox` → `ReconciliationSourceEditAccess`; `mrx-submit` giữ `ReconciliationSourceReadAccess`; không còn action `admin-confirm`).
  - `Issue_and_apply_race_has_one_winner` (dùng mẫu file-SQLite hai context trong `Concurrent_admin_approvals_commit_exactly_one_source_version`: một giao dịch tạo phiếu xuất 2026-06-17, một giao dịch sửa 2026-06-17; đúng một thành công; nếu bên sửa thua thì code `MRX_DAY_LOCKED` hoặc `MRX_SOURCE_STALE`).
- [ ] **Step 2: Chạy** `--filter "FullyQualifiedName~MrxSourceChangeApplierTests|FullyQualifiedName~MrxMenuAmendmentTests"` → FAIL.
- [ ] **Step 3: Implement** theo Interfaces; actor role lấy từ claims người dùng hiện tại.
- [ ] **Step 4: Chạy** → PASS; chạy toàn bộ backend: `dotnet test backend/tests/IPCManagement.Api.Tests` → PASS.
- [ ] **Step 5: Commit** — `feat(mrx): direct source apply for admin/manager with per-day locks`.

### Task 7: Hoàn tất lô không bị chặn bởi delta cũ

**Files:**
- Modify: `Features/Reconciliation/Services/ReconciliationCompletionService.cs:27`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs`

**Interfaces:** Bỏ điều kiện `Reconciliationsourcedeltas … Status == "PENDING"`; các điều kiện hoàn tất khác giữ nguyên.

- [ ] **Step 1: Test** — `Legacy_pending_source_delta_does_not_block_completion` (lô WEEK_COMPLETE + 1 delta PENDING cũ → COMPLETED).
- [ ] **Step 2: Chạy** → FAIL. **Step 3:** sửa. **Step 4:** chạy → PASS.
- [ ] **Step 5: Commit** — `fix(mrx): legacy pending deltas no longer block completion`.

### Task 8: Import lại thực đơn khi đã có lô

**Files:**
- Modify: `Features/SampleData/Services/WeeklyMenuImportService.cs:100-160`
- Test: `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportBatchTests.cs`

**Interfaces:**
- Consumes: Task 5 `MrxDayLockReader`, Task 6 `MrxSourceChangeApplier`.
- Produces: `WeeklyMenuImportResultDto` thêm `MrxDayOutcomes: List<MrxReimportDayDto>?` (null ở DEFAULT và khi chưa có lô) với `record MrxReimportDayDto(DateOnly ServiceDate, string Outcome)`, `Outcome ∈ {"CHANGED","UNCHANGED","LOCKED_IDENTICAL","LOCKED_CONFLICT"}`; điền ở cả bước preview import và commit. Ở MRX, khi căn tin × tuần đã có lô: commit import dựng `MenuAmendment` cả tuần bằng cách so slot món của file với nguồn hiện tại (bỏ dòng giống); dòng khác ở ngày khóa → `MRX_DAY_LOCKED`; người gọi Admin/Quản lý → `ApplyAsync(..., applyMode: "REIMPORT")`; Điều phối → tạo yêu cầu `PENDING_REVIEW` và trả về `MenuAmendmentResultDto`. Số suất giữ nguyên. Khi chưa có lô: hành vi cũ.

- [ ] **Step 1: Test** — `Reimport_preview_reports_day_outcomes` (một ngày mở đổi → `CHANGED`, ngày khóa giống → `LOCKED_IDENTICAL`, ngày khóa khác → `LOCKED_CONFLICT`); `Reimport_with_batch_applies_open_days_only`; `Reimport_identical_locked_day_is_skipped`; `Reimport_changed_locked_day_is_rejected`; `Coordinator_reimport_creates_pending_request`; `Reimport_keeps_servings`.
- [ ] **Step 2: Chạy** → FAIL. **Step 3:** implement. **Step 4:** chạy → PASS.
- [ ] **Step 5: Commit** — `feat(mrx): reimport weekly menu through source change applier`.

### Task 9: Endpoint đọc cho màn sửa, Kho, Bếp

**Files:**
- Create: `Features/Reconciliation/Services/MrxEditScopeQuery.cs`
- Modify: `Features/Reconciliation/Controllers/ReconciliationWeeklyMenuController.cs`, `Features/Reconciliation/Contracts/ReconciliationContracts.cs`, `ReconciliationBatchService.cs:40-160` (warehouse-daily), `ReconciliationKitchenExportService.cs`
- Generate: `frontend/src/shared/api/contracts/openapi.json`, `schema.ts` qua `npm run gen:api`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationWeeklyMenuControllerTests.cs`, `ReconciliationKitchenExportTests.cs`, `ReconciliationServiceTests.cs`

**Interfaces:**
- **Lệch spec có chủ đích:** spec ghi "mở rộng `GET /reconciliation/weekly-menu`", nhưng DTO đó (`WeeklyMenuImportResultDto`) dùng chung với DEFAULT; plan tạo endpoint riêng để không đổi DEFAULT.
- `GET /api/reconciliation/weekly-menu/edit-scope?customerId&weekStartDate` (ReconciliationOnly; `ReconciliationSourceReadAccess` + `ReconciliationSourceEditAccess`) → `MrxEditScopeDto(string? BatchId, string? BatchStatus, long? BatchVersion, string MenuVersionId, IReadOnlyList<MrxEditScopeDayDto> Days)`; `MrxEditScopeDayDto(DateOnly ServiceDate, bool IsLocked, string? LockReason, IReadOnlyList<MrxEditScopeShiftDto> Shifts)`; `MrxEditScopeShiftDto(string ShiftName, int? SavoryServings, int? VegetarianServings, IReadOnlyList<MrxEditScopeSlotDto> Slots)`; `MrxEditScopeSlotDto(string DishSlot, string MenuVariant, string SlotLabel, string? DishId, string? DishCode, string? DishName)`. `LockReason` = "Đã xuất kho" hoặc "Lô đã hoàn tất".
- warehouse-daily: `ReconciliationWarehouseDailyDayDto` thêm `LastRevisionAt: DateTime?`, `LastRevisionByName: string?`, `LastRevisionByRole: string?` (revision `APPLIED` mới nhất có delta ở ngày đó).
- kitchen-cooking: row DTO thêm `MenuVariant` ("Mặn"/"Chay"); nhóm theo `serviceDate × shift × variant × dish × ingredient`; CSV/XLSX thêm cột "Thực đơn"; `Servings` = số suất của loại.

- [ ] **Step 1: Test** — `Edit_scope_marks_issued_day_locked_and_returns_split_servings`; `Edit_scope_completed_batch_locks_all_days`; `Warehouse_daily_exposes_last_revision_for_changed_day`; `Kitchen_export_includes_menu_variant_and_variant_servings` (JSON và CSV header chứa "Thực đơn").
- [ ] **Step 2: Chạy** → FAIL. **Step 3:** implement. **Step 4:** chạy → PASS; `npm run gen:api` rồi `git diff --stat frontend/src/shared/api/contracts` chỉ chứa các thay đổi dự kiến.
- [ ] **Step 5: Commit** — `feat(mrx): edit scope read, revision note and variant in cooking export`.

### Task 10: Nền tảng FE — API, cache, lỗi

**Files:**
- Modify: `frontend/src/store/serverStateCache.ts`, `frontend/src/hooks/useWorkbenchQuery.ts`, `frontend/src/api/mrxApi.ts`
- Create: `frontend/src/api/mrxCacheInvalidation.ts`, `frontend/src/api/mrxErrors.ts`
- Test: `frontend/src/__tests__/MrxSourceEditFoundation.test.ts`

**Interfaces:**
- Consumes: kiểu sinh từ `schema.ts` (Task 9).
- Produces:
  - `serverStateCache.deletePrefix(prefix: string): void` — xóa mọi khóa bắt đầu bằng `prefix` ở bộ nhớ và sessionStorage (L2 + snapshot), notify listener.
  - `invalidateMrxCaches(): void` — `deletePrefix('mrx_')` và `deletePrefix('snapshot:mrx_')`. (Thay cho `invalidateMrxScope(batchId, customerId, week)` trong spec: xóa toàn bộ MRX đơn giản và luôn đúng.)
  - `useWorkbenchQuery`: khi `cacheKey` bắt đầu bằng `mrx_`, lắng nghe `visibilitychange` → `refetch(true)` khi tab hiện lại.
  - `mrxApi.getEditScope(customerId, weekStartDate)`, `mrxApi.previewSourceChange(req)`, `mrxApi.applySourceChange(req)`, `mrxApi.submitSourceChange(req)` (đã có, đổi shape), `mrxApi.decideSourceChange(...)` (giữ); xóa `adminConfirmSourceChange`.
  - `toMrxErrorMessage(error: unknown): { code?: string; message: string; lockedDates: string[] }` với bản dịch: `MRX_DAY_LOCKED` → "Các ngày đã xuất kho không thể sửa: {dd/MM, …}"; `MRX_SOURCE_STALE` → "Dữ liệu đã thay đổi. Vui lòng tải lại rồi thử lại."; `MRX_BATCH_COMPLETED` → "Lô đã hoàn tất, không thể sửa."; `MRX_SERVINGS_SPLIT_REQUIRED` → "Cần nhập đủ số suất Mặn và Chay."; `MRX_BOM_MISSING` → "Món thay thế chưa có định mức cho ngày phục vụ."
  - Gọi `invalidateMrxCaches()` sau mọi mutation MRX thành công: tạo lô, đóng băng, chuyển Kho, xuất kho ngày/bổ sung/phối hợp, disposition, hoàn tất, áp dụng/gửi/duyệt sửa nguồn, import thực đơn, quick-servings (đặt trong các hàm `mrxApi`/hook gọi API, một chỗ mỗi mutation).

- [ ] **Step 1: Test** — `deletePrefix_removes_memory_and_session_entries`; `invalidateMrxCaches_clears_only_mrx_keys` (khóa `catalog_x` còn lại); `visibility_change_refetches_mrx_query` (spy `queryFn` gọi 2 lần); `toMrxErrorMessage_formats_locked_dates` (`["2026-06-15"]` → "15/06"); `mrx_mutations_invalidate_caches` (spy `apiClient` resolve, gọi `mrxApi.applySourceChange` và `mrxApi.createIssue`… → `invalidateMrxCaches` được gọi).
- [ ] **Step 2: Chạy** `cd frontend && npx vitest run src/__tests__/MrxSourceEditFoundation.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Chạy** → PASS; `npx vitest run` toàn bộ → PASS.
- [ ] **Step 5: Commit** — `feat(mrx-fe): cache invalidation, focus refetch and source change api`.

### Task 11: Màn sửa nguồn MRX

**Files:**
- Create: `frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx`, `MrxSourceChangePanel.tsx`, `MrxPendingRequestsPanel.tsx`, `hooks/useMrxSourceEdit.ts`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`, `hooks/useMrxBatchWorkspace.ts:243-299`, `WeeklyMenuImportModal.tsx:132-150`; xóa `MrxSourceChangeModal.tsx` và nhánh MRX của `WeeklyScheduleEditorModal` khi đã có lô
- Test: `frontend/src/__tests__/MrxSourceEdit.test.tsx`, cập nhật `WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: Task 10.
- Produces:
  - `useMrxSourceEdit(scope: { customerId: string; weekStartDate: string })` → `{ editScope, draft, setServings(date, shift, variant: 'savory'|'vegetarian', value: number|null), setDish(date, shift, dishSlot, dishId), changedLines, preview(): Promise<void>, previewResult, apply(reason): Promise<void>, submit(reason): Promise<void>, error, isSubmitting, reset() }`. `changedLines` chỉ gồm ô khác `editScope` và không bao giờ chứa ngày `isLocked`.
  - `MrxSourceEditGrid` props `{ editScope, draft, onServingsChange, onDishChange, lockedHighlight: string[] }`: cột ngày, hàng ca; ô số suất Mặn/Chay; slot nhóm Mặn/Chay; ngày khóa hiển thị nhãn "Đã xuất kho", input `disabled` + `aria-disabled`.
  - `MrxSourceChangePanel` (trong `SplitView` phải): bảng `MaterialImpact` (Ngày, Nguyên liệu, ĐVT, Trước, Sau, Chênh lệch), danh sách ngày khóa, ô lý do bắt buộc; nút chính theo vai trò: Admin/Quản lý "Áp dụng ngay" (mở dialog xác nhận "Áp dụng thay đổi cho {n} ngày, {m} nguyên liệu?"), Điều phối "Gửi duyệt".
  - `MrxPendingRequestsPanel` (Admin/Quản lý): danh sách `mrx-inbox`, xem preview, Duyệt/Từ chối (từ chối bắt buộc lý do).
  - Bỏ hoàn toàn khối gọi `quick-servings` với `servings: 100` ở `WeeklyMenuImportModal.tsx:138-147` và `useMrxBatchWorkspace.ts:289-297`; ô số suất chưa có hiển thị "Chưa nhập" và nút "Kiểm tra định lượng" bị chặn kèm lý do.
  - `MRX_DAY_LOCKED`: tô các ngày trong `lockedDates`, giữ `draft`.
  - `WeeklyMenuImportModal` ở MRX khi preview có `mrxDayOutcomes`: bảng tóm tắt theo ngày với nhãn "Thay đổi" / "Không đổi" / "Đã xuất kho – giống, bỏ qua" / "Đã xuất kho – khác, bị chặn"; có `LOCKED_CONFLICT` thì nút lưu bị chặn kèm lý do; nút lưu theo vai trò như luồng sửa (Admin/Quản lý "Áp dụng ngay", Điều phối "Gửi duyệt").

- [ ] **Step 0: Xuất Scoped Pre-Code UI Gate Block** (route `/weekly-menu?view=mrx-batch`, SplitWorkbench, MATERIAL_RECONCILIATION, ActionGuard theo vai trò, 6 trạng thái, primitives dùng).
- [ ] **Step 1: Test** (fixture từ `MrxEditScopeDto` theo C#; spy `mrxApi`):
  - `Locked_day_inputs_are_disabled`.
  - `Changed_lines_exclude_unchanged_cells`.
  - `Manager_sees_apply_now_and_coordinator_sees_submit`; `Warehouse_role_sees_no_edit_controls`.
  - `Apply_requires_reason_and_confirmation`.
  - `Day_locked_error_highlights_days_and_keeps_draft`.
  - `Import_does_not_write_default_servings` (không có lời gọi tới `/meal-quantity-plans/quick-servings` sau import).
  - `Reimport_summary_blocks_save_on_locked_conflict`.
  - `Missing_split_blocks_quantity_check`.
- [ ] **Step 2: Chạy** `npx vitest run src/__tests__/MrxSourceEdit.test.tsx` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Chạy** → PASS; `npm run lint` và `npm run build` trong `frontend` → PASS; `npx vitest run` toàn bộ → PASS.
- [ ] **Step 5: Commit** — `feat(mrx-fe): direct source edit grid, preview panel and approvals`.

### Task 12: Kho và Bếp hiển thị thay đổi

**Files:**
- Modify: `frontend/src/features/warehouse/branches/MrxDailyLinesBranch.tsx`, `frontend/src/features/chef/MrxCookingWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`, `Chef.test.tsx`

**Interfaces:** Consumes Task 9 DTO fields.
- Kho: ngày có `lastRevisionAt` hiện `InlineBanner` thông tin "Định lượng đã được điều chỉnh lúc HH:mm dd/MM bởi {LastRevisionByName} ({LastRevisionByRole})".
- Bếp: cột "Thực đơn" (Mặn/Chay); nhóm hiển thị theo ngày × ca × thực đơn × món.

- [ ] **Step 0: Scoped Pre-Code UI Gate Block** cho `/warehouse?view=mrx-daily` và `/chef?view=mrx-cooking`.
- [ ] **Step 1: Test** — `Daily_view_shows_revision_note_for_changed_day`; `Cooking_view_groups_by_menu_variant`.
- [ ] **Step 2: Chạy** → FAIL. **Step 3:** implement. **Step 4:** chạy → PASS.
- [ ] **Step 5: Commit** — `feat(mrx-fe): revision note in warehouse and variant in cooking sheet`.

### Task 13: Tài liệu và E2E

**Files:**
- Modify: `docs/domain/material-reconciliation.md`, `docs/FLOWS.md` (§F7), `docs/DOMAIN.md`, `.planning/WORK.md`
- Create: `frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts`

**Interfaces:** E2E dùng `mrxTest` fixture, `authHelpers`, `mysqlVerifier` hiện có; tag `@G6-DirectEdit`; thêm script `"test:e2e:mrx:g6"` vào `package.json` gốc theo mẫu g1–g5.

- [ ] **Step 1: Cập nhật tài liệu** — contract MRX: BR-MRX-EDIT-1..9, BR-MRX-SERV-1..2, đóng băng theo ngày đã xuất, MRX không có trả hàng, bỏ đoạn delta xuất thêm/trả hàng do đổi nguồn; FLOWS §F7 thêm hàng "Source change"; DOMAIN thêm mã BR.
- [ ] **Step 2: Viết E2E** theo kịch bản §6 spec: import → nhập Mặn/Chay → kiểm tra định lượng → tạo lô → đóng băng → chuyển Kho → Thủ kho xuất 2026-xx Thứ 2 → Quản lý đổi món + số suất Thứ 4, áp dụng → SQL: daily line Thứ 4 đổi và version +1, Thứ 2 nguyên → màn Kho Thứ 4, phiếu nấu, Đối chiếu hiện số mới, reload vẫn đúng → thử sửa Thứ 2: thông báo khóa → Điều phối gửi yêu cầu Thứ 5, Quản lý duyệt → SQL đổi. Thêm test tranh chấp trên MySQL thật theo mẫu G4 (hai `BrowserContext`): Thủ kho xuất Thứ 6 và Quản lý áp dụng sửa Thứ 6 cùng lúc → đúng một bên thành công; SQL không có daily line Thứ 6 bị đổi sau khi đã có phiếu xuất.
- [ ] **Step 3: Chạy cổng kiểm** — `npm run verify` → PASS (ghi kết quả). E2E: owner chạy `npm run test:e2e:mrx:g6` trên Windows với sandbox `ipc_mrx_e2e_sandbox` → PASS (đánh dấu NEEDS_EVIDENCE nếu chưa chạy).
- [ ] **Step 4: Commit** — `docs(mrx): direct source edit contract and e2e g6`.
