# Kế hoạch native — Trung tâm Duyệt vận hành

> Native execution approved on 2026-11-16. Current progress and remaining acceptance are owned only by `.planning/WORK.md`; historical proposal wording below is superseded by that approval.

> Dùng superpowers:executing-plans sau khi thiết kế được duyệt. Một writer trong worktree hiện tại.

Spec `../specs/2026-11-16-operational-approval-center.md`. Kế hoạch này bổ sung và là dependency của `2026-11-15-mrx-supplemental-demand.md`.

Goal — Quản lý/Admin xử lý quyết định tại `/approvals` ở cả hai mode, đủ queue/detail/history và giữ domain authority hiện có.

## Baseline và giới hạn

Worktree `codex/operational-approval-center-20261116`, HEAD `05b920c0`, source dựa trên commit đã đọc; không chứa các fix chưa commit của workspace gốc. Hai tài liệu supplemental được copy vào worktree. Trước triển khai phải chọn baseline tích hợp các fix cần thiết đã review, không tự ghi đè hoặc commit toàn dirty tree.

29 Node tests repository-entrypoints/conformance PASS trong worktree, không cài dependency, không chạy DB hay runtime. Code baseline integration/FE runtime là NEEDS_EVIDENCE tại thời điểm lập plan.

## Review focus

- Không mất hồ sơ sau candidate 200 hoặc trang đầu — Task 3 test high-cardinality/filter pushdown.
- Mode/actor/scope rò qua detail/history/cursor/cache — Task 2/3/6 negative tests.
- Duyệt bước chưa cuối bị báo đã áp dụng, hoặc Admin được bật quyền sai — Task 4 per-target parity.
- Quyết định ngoài hub tiếp tục tạo duplicate effects — Task 4/7 kiểm hai entry dùng cùng owner/version/command.
- Approved suất tăng và actual Kho lệch luồng — Task 5/8 chứng minh approval → kitchen demand → partial actual → completion.

## Task 1 — Chốt registry coverage và contracts

Owners `docs/backend-action-index.json`, `docs/conformance-contracts.json`, `Features/Approvals/Contracts/ApprovalWorkflowDto.cs`, `ApprovalHistoryItemDto.cs`, `ApprovalWorkflowService.cs`, `ApprovalHandlers.cs`, `SystemOperationEligibility.cs`, `Security/AuthorizationPolicies.cs` và các owner trong target matrix của spec.

- [ ] Tạo registry hữu hạn `Features/Approvals/Services/OperationalApprovalRegistry.cs`, mỗi target định danh mode/type/actions và các owner nguồn hiện có. Không phát minh target PO/BOM approval từ nhãn UI.
- [ ] Lập mapping target → pending query/detail/history/service/action/version/idempotency/policy/caller, xác minh cả legacy aliases và sub-decision. Gắn gap cụ thể cho loại thiếu read/list.
- [ ] Bổ sung contracts `OperationalApprovalQuery`, `OperationalApprovalPage`, `OperationalApprovalDetail`, `OperationalApprovalActionRequest`, `OperationalApprovalOutcome` theo spec OC-01…04, giữ adapter request cũ theo caller thật.
- [ ] Item identity mode/type/id/subId, query nhận customer/date/week/search/state/cursor; page có hasNext/nextCursor và total chỉ khi authority hỗ trợ. Detail trả version/evidence/allowedActions/blockedReasons.
- [ ] RED test registry contract tại `OperationalApprovalRegistryTests.cs`; coverage phải khớp mọi nhóm target, không exemption padding. Chạy focused dotnet tests và kiểm DTO/OpenAPI trước task tiếp.

## Task 2 — Route, mode và bảo mật xuyên read/write

Owners `SystemOperationEligibility.cs`, operation catalog/attributes hiện có, `AuthorizationPolicies.cs`, `ApprovalInboxUserPolicy.cs`, `ApprovalHistoryController.cs`, `ApprovalHistoryQueryService.cs`, `frontend/src/routes/routeRegistry.ts`, `navigationEligibility.ts`, guards và `docs/table-contracts.json`.

- [ ] RED cho approvals route hiện vắng MRX; tests quyền list/detail/history/summary/command cho Manager/Admin và ba role khác.
- [ ] Khai báo operations read/detail/history/decision theo mode, guard server trước query. Không xóa excluded fence DEFAULT mà chưa có owner MRX tương ứng.
- [ ] History nhận actor/scope và resolve target trước đọc audit. Cursor gắn mode/version/access scope/filter, từ chối tái sử dụng scope khác.
- [ ] Source owner giữ receipt Manager-only, self-approval và Admin-only actions. AllowedActions từ server, FE chỉ trình bày.
- [ ] Chạy SystemOperation/security/navigation/approval history tests, bao gồm deep-link UUID sai mode và customer scope.

## Task 3 — Inbox thật, phân trang và history đúng DTO

Owners `ApprovalInboxService.cs`, `ApprovalInboxQueryPolicy.cs`, `ApprovalInboxCursor.cs`, các `ApprovalInbox*Source.cs`, `ApprovalInboxSlaEnricher.cs`, `ApprovalHistoryQueryService.cs`.

- [ ] RED dataset >200 ứng viên, >50 mỗi loại, nhiều dueDate/code trùng. Filter customer/search/week trước limit, page merge cursor ổn định.
- [ ] Dùng source projection trong database, keyset có tie-breaker identity; nếu cần bounded k-way merge, mỗi source có next position thật, không suy hasNext từ trang đã cắt mất dữ liệu.
- [ ] Summary đúng actor/mode/filter, counts không lộ target bị denied. Source failure có partial metadata và retry, không thay bằng empty/full total.
- [ ] Map history ActionByName/ActionAt/Decision và outcome từ domain evidence; lỗi query trả error rõ. Không giữ `.catch(() => [])` ở transport để che failure.
- [ ] Chạy `MaterialDemandAndPriceExceptionApprovalTests`, `WorkflowGenerationTests.ApprovalDecisions` và test mới `OperationalApprovalPagingTests`. Yêu cầu no missing/duplicate target qua full traversal.

## Task 4 — Giữ sáu target DEFAULT và tập trung quyết định đang rải

Owners `ApprovalWorkflowService.cs`, `ApprovalHandlers.cs`, `ApprovalRoutingService.cs`, `Coordination/Services/InventoryAdjustmentApprovalHandler.cs`, `Inventory/Controllers/StocktakesController.cs` và StocktakeService, `SampleData/Services/MenuAmendmentService.cs`, `MenuAmendmentDecisionFanRemediator.cs`, `Planning/Services/ServiceRunService*`, `Reports/Services` của data-quality/unit-review, legacy-lineage service hiện có.

- [ ] Test parity sáu target hiện có, type alias, multi-step assignment, quality gates và các action admin/manager khác nhau.
- [ ] Bổ sung queue/detail/history projections cho stocktake, menu amendments/fan, service waiver, data quality/unit/legacy review. Quyết định chạy trực tiếp qua service owner; giữ payload chuyên biệt, không chuyển mọi action thành Status=Approve.
- [ ] Source operation chưa có version/command receipt phải được bảo vệ ở owner, có kiểm caller cũ. Duyệt đồng thời/reject/apply/final-step không tạo lịch sử hay side effect trùng.
- [ ] Kiểm kê đầy đủ Admin receipt post/void/correction và return allocation disposition; task trung tâm gọi đúng owner/effect receipt. Order signoff, supplier selection và supplemental DEFAULT được ghi trong coverage là thao tác theo role trạm, không tự nâng thành Manager approval.
- [ ] Giữ review/execute/apply là các stage riêng. UI chỉ báo status thật và actual side effect receipt khi đã có.
- [ ] Chạy `WorkflowGenerationTests.ApprovalDecisions`, `WorkflowGenerationTests.InventoryAndApprovals`, `Phase30InactiveApprovalOwnerTests`, tests stocktake/amendment/waiver/data-quality/unit-review liên quan.

## Task 5 — MRX source change và supplemental demand

Owners `SampleData/Services/MrxMenuAmendmentCoordinator.cs`, `WeeklyMenuImportsController.Amendments.cs`, `ReconciliationDailyLinesController.cs`, `ReconciliationCompletionService.cs` và Task 1…4 của supplemental plan.

- [ ] Đưa source-change pending thật vào inbox MRX qua facade, quyền Quản lý/Admin. Duyệt vẫn gọi `DecideMrxAsync`, khóa ngày và snapshot được kiểm lại.
- [ ] Registry target `mrx-supplemental-demand` phụ thuộc domain service của supplemental Task 1…3. Hub đọc same request/snapshot/version và chỉ quyết định nhu cầu; Kho ghi actual ở owner Inventory.
- [ ] Discrepancy/completion là review work với context chuyên môn đúng quyền và blocker thật, không bỏ yêu cầu đủ định lượng để approve hàng loạt.
- [ ] Chạy `MrxMenuAmendmentTests`, supplemental service/application-path tests và completion tests, zero source-lock bypass/stock effects.

## Task 6 — Impeccable UI hub và entry từ các trạm

Owners `frontend/src/features/approvals/ApprovalPage.tsx`, `api/approvalsApi.ts`, `api/mrxApi.ts`, `routes/routeRegistry.ts`, shared guards/cache/query/recovery, `features/dashboard/`, các source pages tuần/menu/reconciliation/purchasing/warehouse/report có entry duyệt.

- [ ] Nạp Impeccable context/playbook shape/clarify/harden, đọc docs/DESIGN/UI-KIT và craft-floor trước code. Xuất Scoped Pre-Code UI Gate cho `/approvals`, work object OperationalFrame/SplitWorkbench, mode, guards, 6 states và D6/D7/T7/T8/M1.2/N6.
- [ ] FE transport giữ cursor/hasNext, map generated DTO và filter ở server. Keys chứa actor/mode/modeVersion/scope, reset selection khi scope đổi.
- [ ] Thay type options sai bằng registry server; các count dùng server summary, lịch sử lỗi không hiện rỗng. Detail giữ đúng stage/blockedReasons/evidence.
- [ ] Một mục Duyệt vận hành, queue và history, filter không nhân đôi bằng tabs loại. Bảng compact và detail chọn đúng viewport, nút standard, badge căn cột và màu semantic. 403/history error/source partial có states riêng.
- [ ] Draft reason được giữ khi reject/409/retry phù hợp. Approved acknowledged/reload failed chặn resend; unknown outcome kiểm receipt. Navigation/cancel/pending/focus theo modal chuẩn.
- [ ] RED/GREEN `Approvals.test.tsx` mở rộng hoặc tách test theo owner, network boundary mock đúng DTO; thêm mode/rbac/paging/history/decision state. Chạy contracts/navigation/dashboard tests liên quan.
- [ ] Batched visual check desktop 1440×900/tablet960×720/hẹp600×480/zoom200%, keyboard và one-modal; detector trên touched files; FE lint/build. Chỉ fixture UI không được gọi là live workflow PASS.

## Task 7 — Chuyển các điểm duyệt và kiểm caller tương thích

Owners các page/route source tìm từ registry Task 1, `docs/FLOWS.md`, `docs/DOMAIN.md`, `docs/DESIGN.md`, machine conformance/action index và API contracts.

- [ ] Từng target chỉ chuyển entry sau khi queue/detail/action/history parity PASS. Nơi lập phiếu giữ submit/status/history/link, Quản lý/Admin quyết định tại hub hoặc context chuyên môn liên kết cùng use case.
- [ ] Deep links cũ và new identity mở đúng target, có back-to-queue/filter phục hồi. Không xóa endpoint có retained caller.
- [ ] Khi hai entry còn tồn tại tạm, test concurrent click qua hai path vẫn một domain outcome/receipt.
- [ ] Cập nhật supplemental spec/plan bỏ leaf duyệt riêng, quy định dependency hub và mapping acceptance chung. Regenerate OpenAPI/types theo tooling sẵn có.
- [ ] Chạy conformance/backend-action-index/repository-entrypoint/contracts gates, không allowlist padding.

## Task 8 — Ma trận E2E, performance và triển khai theo wave

Reuse MRX disposable runner `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` và DEFAULT evidence/integration workflow hiện có. Tạo diagnostic riêng cho hub với runtime ownership và cleanup rõ. Không chạy qualification chỉ để điền hình ảnh trước khi preflight xác minh môi trường.

- [ ] Test actor × mode × target × stage × scope × error/replay. Registry mọi target có ít nhất một success và một denial/prerequisite thật; không chỉ test fake unified handler.
- [ ] Chạy 3 khách cùng tuần, nhiều ca/variant, hồ sơ cùng display code, >200 pending. Bằng chứng pagination SQL/query plan và bounded latency cần báo dataset/hardware/scope, không công bố SLA giả.
- [ ] MRX E2E Coordinator submit source → Manager/Admin decide → Warehouse extra request → Manager/Admin approve → Warehouse partial/remaining actual → Chef reads approved servings → Manager completion. Assert locked baseline và stock invariant.
- [ ] DEFAULT E2E đủ sáu loại, multi-step, self-review deny, Admin-only actions; compare stock/finance effects theo domain trước/sau, giữ mode isolation.
- [ ] Fault after acknowledged commit, history source outage, mode change during mutation, same target dual-role concurrency, cancel/final approval race. Mọi transaction có zero duplicate/partial effects.
- [ ] `npm run verify`, related contract/relational/E2E lanes; log tổng và outcome từng target. Verify source readback/cleanup, screenshots provenance và secrets hygiene.
- [ ] Release waves gồm foundation+DEFAULT parity, scattered owner parity, MRX source review, supplemental domain/hub integration. Publish target chỉ sau acceptance của wave đó; UI cho biết mode/type hỗ trợ thực tế trong rollout.
- [ ] Rollback dùng feature availability/route registration theo release đã review, preserve approved records/audit và không drop schema đang có dữ liệu. Production migration/deploy theo authorization cụ thể khi có candidate kiểm tra được.

## Mapping coverage

OC-AC01/04/13 → Task1/4. OC-AC02/03/07 → Task2/6. OC-AC08/09/12 → Task3/8. OC-AC05/06/17 → Task5/8 và supplemental plan. OC-AC10/11 → Task4/6/8. OC-AC14/15 → Task6/7. OC-AC16 → Task6. OC-AC18 → Task8.

## Trạng thái

Research và plan proposal. Người dùng đã chọn trung tâm chung hai mode. Thiết kế detailed queue/routing/rollout đang chờ duyệt trước triển khai. Không có code runtime thay đổi trong worktree này.
