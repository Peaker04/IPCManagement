# MRX supplemental demand implementation plan

> For implementation use superpowers:executing-plans inline in the current session after design approval.

**Goal** — Bù thiếu theo dòng ngày và cấp nhóm nguyên liệu cho nhu cầu suất tăng đã được Quản lý/Admin duyệt, có truy vết xuyên Bếp/Kho/đối soát.

**Architecture** — Reconciliation sở hữu nhu cầu có cấu trúc và snapshot BOM, Inventory sở hữu phiếu và phân bổ thực xuất. Read projection tổng hợp nguồn gốc cùng nhu cầu phát sinh đã duyệt; giữ các frozen row gốc và DOM-MODE-1.

**Tech stack** — C#/EF Core/Pomelo/MySQL, React/TypeScript, xUnit, Vitest, Playwright, Open XML và Excel hiện có. Không cần dependency mới.

**Spec** — `../specs/2026-11-15-mrx-supplemental-demand.md`, SD-01…07 và AC-01…16.

## Global constraints

- Quản lý/Admin duyệt nhu cầu, Thủ kho xác nhận thực xuất. Đúng role/capability kiểm tra tại API.
- Giữ khóa nguồn ngày sau initial issue, MRX không ghi tồn vật lý.
- Chỉ món đúng lô/ngày/ca/loại suất và nguyên liệu thuộc frozen daily lineage trong bản đầu.
- Quantity cuối 6 chữ số AwayFromZero, giữ precision rate trước phép nhân và gộp.
- Một nguồn trạng thái công việc ở `.planning/WORK.md`. Bảo toàn dirty tree kế thừa, một writer.
- Dùng UI primitives và tokens hiện có. Mỗi thay đổi TSX/CSS phải qua Scoped Pre-Code UI Gate, Impeccable và IPC UI review.
- Bằng chứng database dùng quy trình disposable clone hiện có. Production mutation/deploy cần scope riêng.

## Review focus

1. Baseline thiếu nhưng extra đã đủ phải tiếp tục chặn chốt — Task 3/4 kiểm tra B10/E3/Bissued8/Eissued3.
2. Cùng món nhiều ca/variant và cùng nguyên liệu nhiều món — Task 2 xác định snapshot và gộp đúng lineage.
3. Request sửa sau duyệt, cấp đồng thời và response mất sau commit — Task 2/3/6 kiểm tra version và replay.
4. Legacy issues chưa có allocation và return lịch sử — Task 1/3/4 giữ dữ liệu và chặn tự gán sai.
5. Bếp, Excel và reports đọc approved demand trước khi xuất — Task 4/5/6 kiểm tra approved/pending scope nhất quán.

## Task 1 — Contracts và persistence của nhu cầu/phân bổ

Owners hiện có gồm `Models/Entities/`, `Data/IpcManagementContext.cs`, `Features/Reconciliation/Persistence/ReconciliationEntityConfigurations.cs`, `Features/Inventory/Contracts/`, `Migrations/`, `Security/AuthorizationPolicies.cs` và đăng ký capability/mode hiện có.

Tạo `ReconciliationSupplementalDemand`, `ReconciliationSupplementalDemandDish`, `ReconciliationSupplementalDemandMaterial` và `ReconciliationIssueAllocation` ở `Models/Entities/`. Snapshot contribution món tới material giữ trong quan hệ child có định danh, không mã hóa mất quan hệ bằng free-text reason. Tạo `Features/Reconciliation/Contracts/ReconciliationSupplementalDemandContracts.cs`.

Interfaces mới theo `/api/reconciliation/supplemental-demands` gồm GET paged/detail, POST create draft, PUT draft, POST submit/approve/reject/cancel. Mỗi mutation có commandId/expectedVersion, scope batch và version nguồn khi chụp/duyệt. `CreateInventoryIssueRequest` giữ wire compatibility và thêm allocations cùng version hồ sơ nhu cầu khi có.

- [ ] Viết `ReconciliationSupplementalDemandModelTests.cs` bảo vệ identity, foreign keys, unique command/allocation owner, precision và trạng thái.
- [ ] Bổ sung request/DTO enums và permissions trong owner hiện có, xác định role codes từ server. Duyệt hồ sơ qua endpoint MRX chỉ nhận Quản lý/Admin.
- [ ] Tạo migration additive, reviewed SQL và model snapshot. Legacy rows không tự có allocation giả. Đảm bảo field mới không làm request cũ mất hợp lệ.
- [ ] Chạy `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj -c Release --filter FullyQualifiedName~ReconciliationSupplementalDemandModelTests`, yêu cầu PASS.
- [ ] Kiểm tra `dotnet ef migrations has-pending-model-changes --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj -c Release`. Cập nhật migration chain/schema manifest test theo diff schema đã kiểm tra.

## Task 2 — Nhu cầu, snapshot BOM và duyệt

Tạo `Features/Reconciliation/Controllers/ReconciliationSupplementalDemandsController.cs` và `Services/ReconciliationSupplementalDemandService.cs`. Reuse `FrozenBomQuantityPolicy.cs`, `ReconciliationBatchQueryProjector.cs`, `ServiceCalendar`, protected transaction, audit và lifecycle receipt hiện có. Kiểm tra `Features/Approvals/Services/ApprovalWorkflowService.cs` và handlers để dùng đúng quyền/quy tắc đã áp dụng; không đưa request MRX vào inbox DEFAULT chỉ để có giao diện duyệt.

Interfaces service gồm `CreateAsync`, `UpdateDraftAsync`, `SubmitAsync`, `ApproveAsync`, `RejectAsync`, `CancelAsync`, `GetAsync` và `GetPageAsync`, nhận DTO Task 1/actor/token. Kết quả là hồ sơ có decision version, approved material snapshot và fulfillment riêng.

- [ ] Viết RED trong `ReconciliationSupplementalDemandTests.cs` cho thiếu quyền, approve pending, stale version, cancel sau cấp và trạng thái COMPLETED.
- [ ] Viết kiểm tra cùng món hai ca/variant, hai món chung nguyên liệu, missing rate, ambiguous rate, 0,0000004×10 và số suất lẻ/âm/overflow.
- [ ] Implement snapshot trên server khi submit; approve kiểm tra đúng snapshot/version. Ghi audit từng quyết định, replay đúng response và giữ frozen source fingerprint.
- [ ] Chạy test Task 2 cùng `ReconciliationBatchDishProjectionTests` và `ReconciliationKitchenExportTests`; yêu cầu PASS, không sửa expectation để bỏ missing-conversion guard.

## Task 3 — Phiếu bổ sung có phân bổ và chống ghi trùng

Sửa `Features/Inventory/Services/ReconciliationInventoryIssueCreator.cs`, contracts/service/controller Inventory hiện có. Tạo `Features/Reconciliation/Services/ReconciliationSupplementalFulfillmentQuery.cs` để đọc phần được cấp theo allocation/ledger. Tổng thực xuất tiếp tục từ Inventory ledger hiện có.

Interface read `GetAsync(batchId, serviceDate, cancellationToken)` trả nhu cầu gốc, lượng cấp gốc, thiếu gốc, nhu cầu approved, lượng đã cấp/còn lại theo demand material, unplanned và trạng thái legacy unallocated. API phải giữ identity ở batch/day/daily line/unit/demand material.

- [ ] RED tại `ReconciliationWarehouseIssueApplicationPathTests.cs` cho B10, gốc8, approved3; cấp extra3 giữ thiếu gốc2, cấp gốc2 mới đủ.
- [ ] Kiểm tra một phiếu nhiều purpose, many partial receipts, phân bổ tổng không bằng quantity, gán nhầm demand/ngày/khách/unit và extra chưa approved.
- [ ] Ghi issue, allocation, lifecycle, audit, version và receipt cùng transaction. Thiếu bất kỳ write nào phải rollback toàn bộ. Lượng vượt giữ attribution và lý do rõ ràng.
- [ ] Legacy request cũ và dữ liệu return compatibility tiếp tục đọc đúng net, không tự gán phần dư cho approved demand mới.
- [ ] Chạy tests application path, `InventoryIssuesControllerTests` và lineage policy. Yêu cầu PASS, stock/lots/movements bất biến.

## Task 4 — Đồng bộ bếp, chuẩn bị, đối soát, export và completion

Owners gồm `ReconciliationWarehouseDailyQuery.cs`, `ReconciliationKitchenExportService.cs`, `ReconciliationPreparationWorkbookExporter.cs`, `PreparationWorkbookBuilder.cs`, `ReconciliationReportsService.cs`, `ReconciliationCompletionService.cs`, `MrxAuditScopeQuery.cs` và DTO tương ứng trong `Features/Reconciliation/Contracts/`.

Các projection thêm approved demand và fulfillment theo Task 2/3. Chuẩn bị nguồn trả phần phát sinh chỉ đọc, phiếu bếp đọc số suất approved cùng trạng thái hủy. Kho và đối soát đọc phần cấp theo quyền. Export giữ hai sheet và bổ sung nhóm phát sinh có mã hồ sơ/ca/món, không nhân đôi baseline.

- [ ] RED cho pending/rejected/cancelled không cộng nhu cầu, approved chưa xuất vẫn lên phiếu bếp và nhiều approved request cộng đúng.
- [ ] Completion kiểm tra toàn phạm vi gốc/extra, pending, allocation ambiguity và overage. Ghi thêm approved demand khiến quyết định sai lệch cũ mất hiệu lực theo owner audit hiện có.
- [ ] Kiểm tra cancellation không đua với first fulfillment và completion; ngày gốc vẫn bị khóa sau mọi supplemental write.
- [ ] Mở rộng `ReconciliationKitchenExportTests`, `ReconciliationPreparationWorkbookTests`, reports/completion tests và schema tests. Chạy focused Release và Open XML, yêu cầu PASS.
- [ ] Regenerate `frontend/src/shared/api/contracts/openapi.json` và `schema.ts` bằng tooling có sẵn; kiểm tra diff chỉ có hợp đồng liên quan.

## Task 5 — FE/UI qua Impeccable

Owners gồm `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx`, `hooks/useMrxDailyWorkspace.ts`, `MrxDailyIssueWorkbench.tsx`, `branches/MrxDailyLinesBranch.tsx`, `frontend/src/features/reconciliation/ReconciliationPage.tsx`, `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`, `frontend/src/features/chef/MrxCookingWorkbench.tsx`, `frontend/src/api/mrxApi.ts`, cache invalidation và `routes/routeRegistry.ts`.

Tạo bounded branch `features/reconciliation/branches/ReconciliationSupplementalDemandsBranch.tsx` và modal detail dùng shared Modal. API facade mới `api/mrxSupplementalDemandApi.ts` dùng shared apiClient và DTO đã sinh. Registration của leaf mới phải cập nhật machine contracts/navigation tests liên quan, không tăng quyền vào route Kho cho Manager.

- [ ] Trước code, nạp Impeccable context một lần trong phiên thực thi và playbook shape/clarify/harden phù hợp. Đọc craft-floor ngay trước UI edits. Xuất Scoped Pre-Code UI Gate theo các route/roles thực tế và khóa lại states/copy/actions.
- [ ] Viết RED ở `Warehouse.test.tsx` cho số thiếu 6,77503, bù một phần, bù đủ nhiều dòng, preview sau xuất và fallback khi BOM thiếu rate. Bổ sung tests branch duyệt theo network boundary.
- [ ] Implement bảng Bù phần còn thiếu và luồng Suất phát sinh theo spec. Định mức do server trả; client không quyết định BOM hoặc approval. Chọn request đã duyệt mới mở input thực xuất theo quyền.
- [ ] Khôi phục draft đúng scope, xử lý 409/version mới, unknown outcome và duplicate click. Không tự retry mutation bằng command/version mới.
- [ ] Implement read-only approved extras ở chuẩn bị lô, bếp và lịch sử. Dùng badge semantic, button chuẩn, sticky table và một modal chặn.
- [ ] Chạy tests có liên quan gồm `Warehouse.test.tsx`, `WarehouseMrxTransitions.test.tsx`, reconciliation, chef, navigation và contract tests thực có. Nếu `operationalPageContracts.test.ts` vắng mặt, ghi rõ và dùng contract owner đang tồn tại; không tạo file test giả để đạt tên.
- [ ] Chạy FE build/lint và Impeccable detector trên touched components. Review hình ảnh một lượt tại 1440×900, 960×720, 600×480 và zoom 200%; sửa cùng đợt, xác nhận lại tối đa một lượt.

## Task 6 — Kiểm thử nối luồng trên MySQL clone và đóng phạm vi

Tạo `frontend/tests/e2e-mrx/specs/mrx-supplemental-demand.spec.ts`, relational integration `backend/tests/IPCManagement.Api.Tests/Integration/MrxSupplementalDemandMySqlTests.cs`, và thêm diagnostic có scope riêng vào `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` cùng safety/contract tests. Reuse fixture actors, prepared database ownership và cleanup hiện có.

- [ ] Thực thi preflight rồi clone source `ipcmanagement` qua runner. Ghi candidate/build hash, operational mode, roles và dữ liệu seed của clone; không dùng Production.
- [ ] UI Thủ kho tạo request ba món/ca phù hợp → Quản lý/Admin approve → Thủ kho cấp một phần rồi cấp đủ → Bếp đọc đúng suất → Quản lý chốt. Kiểm tra bypass API bởi role sai bị từ chối.
- [ ] Chạy hai actor contention cho approve/issue/cancel/complete, fault giữa issue/allocation, dropped committed response và replay. Assert zero duplicate/partial rows, đúng receipt/version và audit actor/time.
- [ ] Kết hợp ba khách cùng tuần, nguyên liệu dùng chung, bỏ khách khỏi export, exact day/week. Đối chiếu bằng independently computed frozen contribution và actual ledger allocation, không chỉ so hai endpoint dùng chung code.
- [ ] Kiểm tra lô cũ chưa allocation và lô missing conversion. Đưa rõ điều kiện bị chặn, dữ liệu còn đọc được và hướng phục hồi có quyền.
- [ ] Tải XLSX thật, xác minh Open XML và mở/reopen bằng Excel với alerts bật. Ảnh FE fixture và ảnh workflow clone ghi nguồn bằng chứng riêng.
- [ ] Nạp IPC test audit/code review/UI review và verification-before-completion. Chạy `npm run verify` cùng focused diagnostic/tests lane, đối chiếu AC-01…16 từng dòng.
- [ ] Xác nhận source/frozen baseline/stock fingerprint và cleanup. Chỉ ghi PASS với receipt hiện hành; giữ FAIL/NEEDS_EVIDENCE cho thiếu bằng chứng. Cập nhật `.planning/WORK.md` về IDLE.

## Handoff

Spec và plan đã bao phủ AC-01…16 theo Task 1…6. Các đề xuất cần duyệt cùng thiết kế gồm giới hạn món/nguyên liệu đã có, vị trí duyệt tại leaf MRX, legacy allocation và cách kết thúc yêu cầu đã cấp một phần. Chưa triển khai code hay migration theo tài liệu này. Phương thức đã dùng trong phiên là native; giữ phương thức đó khi được duyệt thực hiện.
