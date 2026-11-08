# IPCManagement — Đối chứng `IPCManagement_POST_REMEDIATION_REVIEW.md`

- **Tài liệu được đối chứng:** `IPCManagement_POST_REMEDIATION_REVIEW.md` (bản review do owner cung cấp; không phụ thuộc đường dẫn máy cá nhân)
- **Nhánh hiện tại:** `chore/systemic-ui-performance-artifact-retention-20260915`
- **Reviewed HEAD / published checkpoint:** `d5e0ae5260002ae1edf3519084aa24495deb432c`
- **Uncommitted snapshot fingerprint:** SHA-256 của `git status --porcelain=v1` tại lần chốt báo cáo: `d1213787ffbb2b96b21fa5341c4a39391d11e980e9d6c4bfa9a1e34efea58756`
- **Phạm vi đối chứng:** codebase và working tree chưa commit sau các remediation RA-07–RA-19
- **Ngày đối chứng:** 2026-09-15

## 1. Kết luận điều hành

Bản review ban đầu là một **đánh giá hợp lý tại checkpoint `d5e0ae52`**, đặc biệt khi không chấp nhận các tuyên bố “hết lag”, “hết layout shift” hoặc “performance complete” chỉ từ source/tests. Các finding có căn cứ trong bản review đã được đưa vào ledger RA-07–RA-19, kiểm tra lại từ codebase, rồi xử lý tuần tự.

Kết quả hiện tại:

- Không còn finding **source-actionable** nào từ bản review đang `OPEN`.
- RA-07, RA-09, RA-11, RA-12, RA-13 và RA-18 đã được sửa, kiểm thử và review độc lập.
- RA-08 đã được đo payload thật và đóng là `MEASURED_NOT_ACTIONABLE`, không tạo thêm DTO theo suy đoán.
- RA-16 đã tìm được một outlier thật tại Warehouse exceptions và sửa đúng owner thay vì thay global KeepAlive policy.
- RA-17 và RA-19 đã có browser measurement; không chứng minh được defect như giả thuyết ban đầu.
- RA-14/H14 vẫn bị chặn bởi quyền telemetry/deployment/database; đây không phải source work còn bỏ dở.
- RA-15/H10 và H16 không được nâng thành PASS tuyệt đối: thiếu React-specific attribution hoặc không tái hiện được trạng thái modal business tự nhiên.

Vì vậy kết luận đúng là:

> **Các bottleneck có evidence trong phạm vi review đã được xử lý hoặc phân loại cuối. Không còn package sửa code đã xác nhận đang mở. Điều này không phải whole-system, field-CWV, database hay production-performance PASS.**

## 2. Bảng đối chứng các finding chính

| Finding trong review ban đầu | Đánh giá tại `d5e0ae52` | Codebase hiện tại | Trạng thái cuối | Evidence chính |
|---|---|---|---|---|
| ServiceRun status filter load/enrich toàn bộ trước pagination | Đúng | Canonical status-only phase xác định membership/count/order; chỉ hydrate current page | `PASS_FOCUSED/REVIEW_OK` | `ServiceRunService.cs`, `ServiceRunService.Projection.cs`, `ServiceRunLifecycleTests.cs` |
| Warehouse dùng `limit: -1` để tải toàn bộ stock | Đúng | Endpoint allocation bắt buộc `warehouseId + materialRequestId`; query exact ingredient/unit pairs | `PASS_FOCUSED/REVIEW_OK` | `StockMovementReportService.cs`, `WarehousePage.tsx`, `WorkflowReportPaginationTests.cs` |
| Demand/kitchen issue dùng hard `limit: 500` | Đúng, là completeness risk | Hai read được scope chính xác theo `materialRequestId`; không còn ceiling trong allocation path | `PASS_FOCUSED/REVIEW_OK` | `DemandReportService.cs`, `InventoryOperationsReportService.cs`, hai test 501-row |
| `OpenAsync` query source lines trong vòng lặp request | Đúng | Một translated correlated batch query; 1 và 20 requests đều một SELECT | `PASS_FOCUSED/REVIEW_OK` | `ServiceRunService.SelectPlanSourceLines`, `PlanSourceLineQuery_SelectCount_Should_NotGrowFromOneToTwentyRequests` |
| Runtime browser acceptance chưa hoàn tất | Đúng tại checkpoint | Đã chạy owned current-source Chrome matrix trên `3001/8001`, 14 cells, không có console/page/request/API/mutation error | `BOUNDED_RUNTIME_PASS` | `final-current-source-retry/manifest.json` |
| Observability performance còn thiếu | Đúng một phần | Correlation middleware/header/log scope đã tồn tại; field metrics/retention/privacy vẫn cần owner | `CONFIRMED_BUT_AUTHORITY_BLOCKED` | `CorrelationIdMiddleware.cs`; không thêm SDK khi chưa có authority |
| Hidden stable shell có thể tốn render | Candidate hợp lý | Representative routes không có boundary long task; không có React commit/effect attribution | `MEASURED_NOT_REPRODUCED; NO_EDIT` | Runtime matrix + source boundary tests |
| KeepAlive có thể giữ subtree nặng | Candidate hợp lý | Global policy không bị chứng minh lỗi; một outlier Warehouse được sửa tại table owner | `MEASURED_OWNER_FIX; GLOBAL_POLICY_INTENTIONAL` | 592→22 rows; 10,368→718 DOM nodes; 381ms→0 long task |
| Generic Warehouse fallback 260px có thể gây CLS | Cần đo, không thể kết luận từ source | Demand CLS <= 0.000604; exception shift không được attribution cho fallback | `MEASURED_NO_FALLBACK_DEFECT` | Browser geometry/CLS manifests |
| `isViewPending = false` là dead contract | Đúng | Dead wrapper, broad `aria-live`, `aria-busy` và `RefreshStatus` đã xóa; child owners giữ pending/error state | `PASS_FOCUSED/REVIEW_OK` | `WarehousePage.tsx`, performance contract test |
| Dashboard `useWorkflowOverview` có thể là bottleneck | Candidate, không phải defect đã chứng minh | Chỉ còn ở Dashboard; cold load đo được 352 DOM nodes, no long task/error, max CLS 0.000067 | `MEASURED_INTENTIONAL` | Runtime manifest |
| ServiceRun list DTO có thể over-fetch | Candidate hợp lý | 15 populated rows = 55,554 uncompressed bytes, 82ms local; không đủ evidence tạo versioned DTO mới | `MEASURED_NOT_ACTIONABLE` | `ra08-payload-20260915-sol/metrics.json` |
| Reports data keys dùng page/index | Finding bổ sung trong re-audit | Tất cả report rows dùng backend ID/complete grain; receipt line dùng primary key mới | `PASS_FOCUSED/REVIEW_OK` | `ReceiptLineId`, report mappers/components, generated OpenAPI |

## 3. Đối chứng theo từng mục của review ban đầu

### 3.1. Những phần review đánh giá là đã sửa đúng

Các đánh giá tích cực trong phần 1 của review vẫn được giữ:

- Shared async boundaries tiếp tục giữ stable shell và DOM identity.
- `queryView.ts` vẫn là model async canonical; không tạo framework song song.
- Coordination cache tags đã tách theo resource với explicit cross-resource dependencies.
- Warehouse query ownership theo active view được giữ và siết chặt thêm.
- ServiceRun page projection tiếp tục dùng fixed-count batched loader.

Không có remediation sau review nào đảo ngược các kiến trúc này.

### 3.2. ServiceRun status filtering — đã xử lý

Review mô tả đúng flow cũ: materialize candidates, hydrate lifecycle cho tất cả, filter status và paginate trong RAM.

Flow hiện tại:

1. Load candidate fields cần thiết cho canonical lifecycle status.
2. Batch load status dependencies.
3. Dùng cùng `MapLifecycleStatus` seam với full projection.
4. Giữ order `UpdatedAt DESC, ServiceRunId`.
5. Tính exact filtered count và page membership.
6. Chỉ hydrate operational projection cho current-page IDs.

Regression coverage khóa:

- mixed canonical/stored statuses;
- exact membership/count/order;
- page 2;
- CLOSED snapshot status;
- không hydrate off-page purchase/receipt data;
- SELECT count không tăng giữa một và nhiều candidates.

Không dùng persisted `ServiceRun.Status` thay canonical business lifecycle.

### 3.3. Warehouse full-stock allocation — đã xử lý

Pattern `useGetCurrentStockQuery({ warehouseId, limit: -1 })` đã bị loại khỏi allocation path.

Contract mới:

```text
GET /api/workflow-reports/current-stock/allocation
  warehouseId (required)
  materialRequestId (required)
```

Backend chỉ trả stock rows trong kho có exact `ingredientId + unitId` xuất hiện trong material request. Frontend tiếp tục giữ business allocation hiện có, bao gồm source-line identity và pending issue subtraction.

Relational tests khóa:

- loại stock của warehouse khác;
- duplicate request lines không duplicate stock row;
- exact ingredient/unit semantics;
- hơn 500 relevant rows vẫn đầy đủ.

Không tạo mega endpoint và không tăng limit.

### 3.4. Hard `limit: 500` — đã xử lý bằng scope, không tăng limit

Hai consumer allocation giờ gửi `materialRequestId`:

- `GetIngredientDemandAsync` lọc exact request và trả complete scoped rows;
- `GetKitchenIssuesAsync` lọc exact material request lineage và trả complete scoped rows.

Behavior tests tạo 501 relevant rows và gọi với `Limit = 1`; kết quả vẫn đủ 501 rows và không lẫn request khác. Frontend contracts cấm quay lại `limit: 500` trong path này.

### 3.5. `OpenAsync` N+1 — đã xử lý

Vòng lặp query từng `requestId` được thay bằng một correlated query:

```text
MaterialRequestLine
WHERE EXISTS MaterialRequest
  matching PlanId and RequestId
```

Customer/date/shift/tier/source-line decision semantics vẫn được giữ. SQLite interceptor chứng minh một và hai mươi requests đều dùng một SELECT cho source lines.

### 3.6. Browser CLS/performance acceptance — đã có bounded evidence

Owned runtime:

- Frontend/backend ports: `3001/8001`.
- Authenticated actor: Admin.
- Database lane: `ipc_lane7`, read-only audit behavior.
- Viewports: `1366×768`, `1440×900`.
- Representative routes: Dashboard, Chef production, Warehouse demand/exceptions, Reports price/demand, Admin audit.
- 14 route/viewport cells.

Kết quả:

- zero console errors;
- zero page errors;
- zero request failures;
- zero API errors;
- zero escaped/protected mutation attempts;
- Dashboard/Chef/Reports/Admin/Warehouse demand CLS gần 0;
- no representative long task sau owner-level Warehouse fix.

Giới hạn của evidence:

- Không phải field CWV.
- Không phải toàn bộ role/mode/state matrix.
- Không chứng minh production p75.
- Không thay thế React Profiler hay deployment telemetry.

### 3.7. Hidden stable shell — giữ nguyên có chủ đích

Review đúng khi nói `invisible` không đồng nghĩa “không render”. Tuy nhiên candidate này cần profiler evidence trước khi thay architecture.

Current-source browser matrix không cho thấy boundary long task. Không có exact React commit reason/effect/subscription attribution. Vì vậy không tách lightweight shell hoặc mass-unmount child subtree theo suy đoán.

Disposition: `MEASURED_NOT_REPRODUCED; NO_EDIT`.

### 3.8. KeepAlive — không thay global policy; đã sửa outlier thật

Global `KeepAliveTabPanel` vẫn giữ state và tránh refetch/remount. Runtime tìm thấy một outlier cụ thể tại Warehouse exceptions:

| Metric | Trước | Sau owner fix |
|---|---:|---:|
| Mounted table rows | 592 | 22 |
| DOM nodes | 10,368 | 693 ở immediate dev-served rerun; 718 ở final production-preview matrix |
| Cold long task | 381ms | 0ms |

Fix là client pagination 20 rows tại allocation table owner. Full allocation dataset vẫn còn cho business destination selection; không đổi permission, decision token, source/destination line identity hoặc mutation payload. Immediate dev-served rerun và final production-preview matrix khác 25 total DOM nodes; artifacts không quy thuộc chênh lệch đó cho subtree cụ thể. Cả hai cùng chứng minh 22 table rows và zero long task.

Không có evidence để thay toàn bộ KeepAlive policy.

### 3.9. Dead `isViewPending` — đã cleanup

Đã xóa:

- `const isViewPending = false`;
- dead page-level `aria-busy`;
- broad page-level `aria-live`;
- unreachable page-level `RefreshStatus`.

Receiving, movement, demand, lifecycle, exceptions và Suspense paths vẫn có local query/loading/error ownership. Independent review xác nhận không mất pending announcement và tránh duplicate live-region semantics.

### 3.10. Warehouse fallback 260px — đã đo, không tìm thấy fallback defect

Bản review đúng khi không kết luận từ source. Runtime hiện tại cho thấy:

- Warehouse demand CLS tối đa `0.000604`.
- Warehouse exceptions có shift attribution ở third section rời viewport khi composition thay đổi, không quy về generic fallback.
- Sau pagination, long task biến mất nhưng raw layout-shift entry của section vẫn xuất hiện; vì vậy không che bằng animation/min-height hoặc thay placeholder theo cảm tính.

Disposition: `MEASURED_NO_FALLBACK_DEFECT`.

### 3.11. Dashboard `useWorkflowOverview` — intentional sau measurement

Hook composite chỉ còn ở `DefaultDashboardPage`. Warehouse đã không còn dùng hook này.

Authenticated cold-load sample:

- 352 DOM nodes;
- zero long task;
- zero request/page/API error;
- max CLS `0.000067`.

Không có evidence cho dedicated mega/lightweight endpoint. Disposition: `MEASURED_INTENTIONAL`.

### 3.12. Observability — review cần hiệu chỉnh

Review nói observability “còn thiếu” là đúng đối với field telemetry, nhưng correlation không vắng mặt. Codebase đã có:

- `CorrelationIdMiddleware`;
- `X-Correlation-ID` response header;
- trace identifier;
- correlated logging scope/context.

Những phần còn lại cần owner authority:

- frontend Web Vitals/RUM SDK;
- route/API sampling;
- retention/privacy contract;
- deployment dashboard/alerts;
- DB duration/query-count field telemetry.

Không thêm SDK hoặc log payload/PII khi chưa có deployment/privacy authority.

### 3.13. Operational documentation — đã chuẩn hóa

Canonical execution ledger cho §10/§10A là:

`.planning/notes/WHOLE-PAGE-BUSINESS-COMPOSITION-PLAN.md`.

Final H01–H17 reconciliation là:

`.artifacts/goal-ui-ux/reaudit-async-performance-20260915-sol/synthesis.md`.

Các checkbox R4/R5–R6 còn mở trong ledger là **broader acceptance gates chưa hoàn tất** (production/Release identity, React Profiler, DB SQL/rows/duration và full transition matrix). Chúng không bị diễn giải thành PASS và là lý do báo cáo chỉ dùng `BOUNDED_RUNTIME_PASS`, `NEEDS_PROFILER_EVIDENCE` hoặc authority-blocked. Chúng không đồng nghĩa còn một source defect đã xác nhận cần sửa.

`MEMORY.md` là pointer vận hành; nếu narrative cũ mâu thuẫn, bảng RA-01–RA-19 trong §10A và source/runtime hiện tại thắng.

Không dùng supplied review làm state owner; nó chỉ là hypothesis source.

### 3.14. Commit lớn — vẫn là review/bisect risk, không phải application defect

Nhận xét commit `d5e0ae52` lớn và khó review/bisect là hợp lý. Tuy nhiên commit đã được publish lên dedicated branch trước các remediation sau review. Không rewrite/split published history khi chưa có explicit authorization.

Các remediation sau đó được tổ chức và review theo package RA riêng. Khi commit tiếp theo được owner cho phép, chỉ task-owned tracked files sẽ được stage và cached diff sẽ được kiểm tra trước commit/push.

## 4. Đối chứng acceptance criteria của review

### Frontend

| Tiêu chí | Kết quả |
|---|---|
| Background refresh không thay shell bằng spinner không cần thiết | `PASS_FOCUSED` tại shared boundaries/reports |
| Blocking không remount major subtree | `PASS_FOCUSED`; DOM identity tests |
| Không broad Coordination invalidation | `PASS_FOCUSED`; exact store fanout tests |
| Không duplicated ServiceRun adjustment request theo row | `PASS_FOCUSED` |
| Tab/query ownership Warehouse | `PASS_FOCUSED`; runtime bounded evidence |

### Visual stability

| Tiêu chí | Kết quả |
|---|---|
| Headed browser measurement | `BOUNDED_RUNTIME_PASS` |
| Significant CLS trên hot paths đã chọn | Không thấy trên Dashboard/Chef/Reports/Admin/Warehouse demand; Warehouse exception shift được attribution riêng |
| Generic fallback 260px là defect | `NOT_REPRODUCED` |
| Field/production CWV | `NOT_CLAIMED` |

### Backend

| Tiêu chí | Kết quả |
|---|---|
| Status filter không full operational-hydrate toàn candidates | `PASS_FOCUSED/REVIEW_OK` |
| ServiceRun page query count bounded | `PASS_FOCUSED/REVIEW_OK` |
| `OpenAsync` không per-request query | `PASS_FOCUSED/REVIEW_OK` |
| Payload DTO mới cần thiết | `MEASURED_NOT_ACTIONABLE` |

### Warehouse

| Tiêu chí | Kết quả |
|---|---|
| Không full-stock `limit: -1` cho một issue | `PASS_FOCUSED/REVIEW_OK` |
| Allocation demand/issues complete và scoped | 501-row relational behavior tests PASS |
| Exception allocation table bounded render | 592→22 rows; long task 381ms→0 |

### Database/observability

| Tiêu chí | Kết quả |
|---|---|
| Speculative index/schema | Không thực hiện |
| Execution plans / p95 / p99 | `AUTHORITY/EVIDENCE_BLOCKED` |
| Field telemetry/retention/privacy | `AUTHORITY_BLOCKED` |
| Existing correlation | Đã xác nhận và giữ nguyên |

## 5. Validation và residual risk

### Focused validation đã chạy

- ServiceRun/warehouse/backend focused package: PASS.
- Reports focused package: PASS.
- Warehouse focused package: PASS.
- Frontend production build: PASS.
- Backend solution build: PASS.
- Changed-file ESLint: PASS.
- Full frontend lint: zero errors, ba inherited hook warnings.
- Generated OpenAPI/schema: regenerated and type/build consumers pass.
- Independent package reviews: `REVIEW_OK` cho RA-07, RA-09, RA-11, RA-12, RA-13, RA-18 và Warehouse allocation pagination.

### Broad-suite baseline không được che giấu

Broad suites vẫn có inherited failures ngoài package này, bao gồm sealed evidence hashes, stale instrumentation/state baselines, migration/evidence counters, semantic discovery registry và một demand fixture. Các failure này không được sửa hoặc nới expectation chỉ để tạo “all green”.

Do đó báo cáo này không tuyên bố:

- whole-repository test PASS;
- whole-FE accessibility PASS;
- production performance PASS;
- field CWV PASS;
- database scalability PASS;
- deployment security PASS.

## 6. Final status map

| Nhóm | Final disposition |
|---|---|
| RA-01–RA-07 | `PASS_FOCUSED/REVIEW_OK` với bounded browser evidence ở các route được chọn |
| RA-08 | `MEASURED_NOT_ACTIONABLE` |
| RA-09–RA-13 | `PASS_FOCUSED/REVIEW_OK` |
| RA-14/H14 | `CONFIRMED_BUT_AUTHORITY_BLOCKED` |
| RA-15/H10 | `MEASURED_NOT_REPRODUCED; NO_EDIT` |
| RA-16 | `MEASURED_OWNER_FIX; GLOBAL_POLICY_INTENTIONAL` |
| RA-17 | `MEASURED_NO_FALLBACK_DEFECT` |
| RA-18 | `PASS_FOCUSED/REVIEW_OK` |
| RA-19 | `MEASURED_INTENTIONAL` |
| H16 modal overlap | `CONFLICT_BLOCKED / NOT_REPRODUCED` |

Final equality:

```text
17 hypothesis families
= 12 PASS / NOT_FOUND / MEASURED_NOT_REPRODUCED
+ 1 MEASURED_NOT_ACTIONABLE
+ 1 NEEDS_PROFILER_EVIDENCE
+ 1 CONFIRMED_BUT_AUTHORITY_BLOCKED
+ 1 CONFLICT_BLOCKED / NOT_REPRODUCED
+ 1 BOUNDED_RUNTIME_PASS
```

## 7. Kết luận gửi lại reviewer/chat

Bản review `IPCManagement_POST_REMEDIATION_REVIEW.md` đã làm đúng vai trò tại checkpoint `d5e0ae52`: nó không chấp nhận source-only optimism và chỉ ra năm defect source thật cùng các candidate cần runtime evidence.

Sau đối chứng và remediation từ codebase hiện tại:

1. ServiceRun status paging đã được sửa theo canonical two-phase read model.
2. Warehouse full-stock allocation đã được thay bằng scoped server read.
3. Hard 500 allocation reads đã được thay bằng complete `materialRequestId` scope.
4. `OpenAsync` N+1 đã được batch thành một translated query.
5. Dead Warehouse pending contract đã được xóa.
6. Reports row identity đã dùng backend primary/business grains.
7. Runtime matrix đã tìm và sửa một outlier thật tại Warehouse exceptions.
8. Payload, KeepAlive, fallback và dashboard candidates đã được đo thay vì tối ưu theo cảm tính.
9. Telemetry/database/modal residuals đã được phân loại theo authority và reproduction evidence.

Vì vậy không còn remediation package có evidence đang mở trong phạm vi review này. Phần chưa thể tuyên bố PASS là field/deployment/database/whole-system acceptance, và báo cáo này chủ động giữ nguyên giới hạn đó.

## 8. Evidence references

- Evidence hashes and authority scope: `docs/EVIDENCE-INDEX.md` (the sole hash registry).
- Canonical ledger: `.planning/notes/WHOLE-PAGE-BUSINESS-COMPOSITION-PLAN.md` §10/§10A.
- Final H01–H17 synthesis: `.artifacts/goal-ui-ux/reaudit-async-performance-20260915-sol/synthesis.md`.
- Browser matrix: `.artifacts/shipyard-live/goal-ui-ux/runtime-r3-r4-20260915-sol/final-current-source-retry/manifest.json`.
- Runtime teardown: `.artifacts/goal-ui-ux/runtime-r3-r4-20260915-sol/teardown-final.json`.
- Warehouse before: `.artifacts/shipyard-live/goal-ui-ux/runtime-r3-r4-20260915-sol/browser/manifest.json`.
- Warehouse after paging: `.artifacts/shipyard-live/goal-ui-ux/runtime-r3-r4-20260915-sol/warehouse-exceptions-after-pagination/manifest.json`.
- RA-08 payload and teardown: `.artifacts/goal-ui-ux/ra08-payload-20260915-sol/metrics.json`, `.artifacts/goal-ui-ux/ra08-payload-20260915-sol/teardown.json`.
- Published checkpoint/HEAD: `d5e0ae5260002ae1edf3519084aa24495deb432c`.

Các `.artifacts/` là local evidence và có thể không đi theo Git. Chat/reviewer nhận báo cáo phải dùng hash trong `docs/EVIDENCE-INDEX.md`; nếu artifact không được chuyển cùng workspace thì chỉ có thể kiểm tra source/test claims, không thể tự xác minh runtime payload/geometry.

---

**Review interpretation rule:** `PASS_FOCUSED` chứng minh package và invariant được nêu; `BOUNDED_RUNTIME_PASS` chỉ chứng minh matrix đã chạy; `AUTHORITY_BLOCKED` và `NOT_REPRODUCED` không được diễn giải thành PASS; không có nhãn nào trong tài liệu này tương đương “toàn hệ thống production đã hoàn hảo”.
