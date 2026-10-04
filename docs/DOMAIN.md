# Domain — shared business contract

IPCManagement coordinates meals from customer menus/servings through materials, purchasing, physical stock and kitchen handoff. Current source, behavior tests and machine contracts determine implemented truth. This owner defines shared language, identity, grain and cross-domain invariants; bounded rules belong to [weekly menu](domain/weekly-menu.md), [warehouse](domain/warehouse-contract.md) and [MRX](domain/material-reconciliation.md).

## Modes and roles

`DEFAULT != MATERIAL_RECONCILIATION`. They share master data and physical stock, never workflow records, lineage, query/mutation authority or audit families. Mode is server authority and does not grant permission. Backend actor/mode/version checks remain final; hidden controls are not security boundaries.

| Role / canonical UI label | DEFAULT responsibility |
|---|---|
| Điều phối | Customer/week/tier, menu/servings, demand readiness and selected date/shift kitchen handoff |
| Thu mua | Authorized shortage/proposal, supplier quotation, approval and purchase order |
| Kho | Receipt quality, stock movements/current snapshot, issue and supplemental source lines |
| Bếp | Production plan, check all issue lines, whole-issue acknowledgement, shortage/surplus/return |
| Quản lý | Approval/review with separation of duties |
| Quản trị viên | Master/permission administration and explicitly allowed execution |

MRX has a different role matrix: Coordination owns source/freeze/transfer, Warehouse daily issues, Manager discrepancy/completion, Chef cooking export; Purchasing is not part of that mode. Use its bounded contract, not the DEFAULT responsibility table as permission evidence.

DEFAULT flow: menu + locked servings → daily demand → Warehouse supply → authorized shortage/purchasing → PO → quality/approval/posted receipt → remaining issue → whole-issue kitchen acknowledgement → ServiceRun reconciliation/close or compensating supplemental/return. Projections do not prove physical handoff.

## Language and status ownership

Use Vietnamese work vocabulary in UI; enum/table/column names, UUID/hash and technical identity are detail/copy data, not primary headings. One concept has one label and contextual semantic tone. Human name precedes code. Units accompany quantities; source formatters/status dictionaries implement these projections.

| Term | Meaning |
|---|---|
| Thực đơn tuần | Customer/week planning work object |
| Nhu cầu nguyên liệu | Requirements by service date/shift and serving scope |
| Đề xuất mua hàng | Authorized shortage proposal, not a stock snapshot |
| Đơn mua | Purchase commitment; receipt progress is a separate lifecycle |
| Phiếu nhập / Phiếu xuất | Actual source documents; posting/issue owns physical stock effect |
| Cấp bổ sung | New supply loop retaining origin issue/source-line/unit |
| Dòng nguồn / Source-line | Exact document-line mutation identity, never ingredient name or UI group ID |
| Bút toán tồn kho / Movement | Immutable stock event with type, quantity, source and actor |
| Grain | Detail represented by a row: day/shift, week aggregate, snapshot, source-line or movement |
| Lane | Isolated test/environment target; not disposable without explicit authorization |
| Legacy lineage disposition | Admin proposal → different Manager approval → approved Admin apply with exact source/unit compatibility |
| Signoff | Identified/audited acknowledgement at an owned transition |
| Quick-completion | Only when business preconditions prove no remaining required physical/document steps |

Each entity has one primary lifecycle/status column; secondary approval/delivery/readiness facts use distinct fields/progress, not competing primary statuses. Missing metadata uses `—`, but loading/denial/errors and `Chưa xuất` never become a dash. Routine states are quiet neutral; danger/warning highlight exceptions. MRX retains its approved info/success mapping, not a forced DEFAULT palette.

| Entity | Primary lifecycle / labels | Secondary dimension |
|---|---|---|
| WeeklyMenu | CREATION: Bản nháp / Sẵn sàng / Hoàn tất (neutral) | Header approval: Chờ duyệt / Đã duyệt / Bị từ chối |
| PurchaseRequest | APPROVAL: Chờ duyệt (warning) / Đã duyệt (neutral) / Bị từ chối (danger) | Document cancellation |
| PurchaseOrder | PO: Bản nháp / Đã đặt hàng / Hoàn tất (neutral) | Partial receipt progress |
| WarehouseReceipt | RECEIPT: Nhận một phần (warning) / Hoàn tất (neutral) | Cancellation |
| WarehouseIssue | ISSUE: Chờ vật tư (warning) / Đã xuất kho (neutral) | Cancellation |
| MaterialDemandItem | PROCUREMENT: Chờ vật tư (warning) / Sẵn sàng / Hoàn tất (neutral) | Quantitative shortage/stock chip |
| ServiceRun | RUN: Bản nháp / Sẵn sàng (neutral), Đang mở (warning), Bị chặn (danger), Hoàn tất (neutral) | Four readiness tracks |
| MealOrderCoordination | COORDINATION: Bản nháp / Đã xác nhận / Hoàn tất (neutral) | Serving variance |
| SupplierQuotation | APPROVAL: Chờ duyệt (warning) / Đã duyệt (neutral) / Bị từ chối (danger) | Effective dates |
| InventoryMovement | FULFILLMENT: Hoàn tất (neutral) | Movement type |
| ReconciliationBatch | MRX: Đang chuẩn bị / Chờ Kho xuất (warning), Đã khóa / Đang đối chiếu (info), Hoàn tất (success) | Same labels in lifecycle/actions/audit |

Query language is distinct: Đang tải, Đang cập nhật, Chưa có dữ liệu, Không tìm thấy kết quả, Không tải được dữ liệu, Không có quyền. Refresh retains only allowed scoped data; [DESIGN](DESIGN.md) owns interaction surfaces and bounded contracts control denial/readiness.

## Identity and canonical grains

Customer is the served organization; tier selects scoped menu/BOM/cost and cannot be mixed within customer/week; week is a planning object, not the mutation grain of every physical transaction. BOM is per serving, never current stock/receipt authority. Ingredient, SKU, brand, specification/package, supplier and unit are distinct identities. Do not merge names or round fractional BOM quantities to integers. Unknown date/unit/conversion or ambiguous mapping is HOLD_IMPORT; conversion needs reviewed unit/provenance evidence, not guesses.

| Data | Required key / grain | Meaning |
|---|---|---|
| Daily operational demand | serviceDate + customerId + priceTierAmount + ingredientId + unitId | Multiple dish/BOM contributors may sum; sources remain inspectable |
| Weekly projected BOM | weekStartDate + customerId + priceTierAmount + ingredientId + unitId | Explicitly “tổng BOM cả tuần”; never daily shortage/current stock |
| Current stock | warehouseId + ingredientId; unitId stored on snapshot | One present snapshot; never add movements again |
| Period stock snapshot | period + warehouseId + ingredientId + unitId | Keep snapshot period separate from current stock |
| Document | documentId + sourceLineId | Grouped ingredient/unit rows must drill into original lines for commands |
| Stock movement | movementId | Preserve every receipt/issue/return/adjustment event |
| Dish BOM | dishId + customer scope + priceTierAmount + effective range + bomLineId | Per-serving effective requirement; names cannot merge IDs |
| Ingredient catalog | ingredientId | Duplicate names require approved data-quality disposition |

Cross-screen projections:
- Planning schedule: day + shift + dish slot, customer/tier context. Demand: selected day; source KHSX shows date/shift. Weekly purchase summary: daily customer/tier/ingredient/unit rows, with date and full grain caption; pre-stock fallback explicitly projected weekly BOM.
- Cost: scoped weekly dish lines, not stock. Dish materials: dish/serving/effective BOM date (“một khay”).
- Purchasing worklist: day mandatory; ingredient/unit grouping is presentation, actions use purchaseRequestLineId. Quotation: ingredient/supplier/unit/effective range, not demand.
- Warehouse current stock: warehouse/ingredient snapshot. Requests/issues/PO receipts: original request/issue/purchaseOrderLineId and document. Movements: time/type/source/warehouse.
- Chef: date/shift plan and issue lines; grouped checklist drilldown acknowledges the correct whole issue. Return/supplemental retains issue/ingredient/unit.
- Reports: demand date grain; supplier prices ingredient/supplier/unit, monthly prices ingredient/unit/calendar month. Both price tables include unit metadata, current-page CSV and unitId in row keys. Purchase plan declares day/week and period control. Stock is current snapshot, movement is audit event, kitchen use is date/shift/issue/ingredient/unit.
- Admin ingredients use ingredient IDs; BOM search/filter never changes dish/scope/tier/effective-range/line grain.

Never add a repeated stock snapshot on every BOM row. Allocation sums only when the backend contract gives allocations; repeated snapshots need contract normalization, not guessed FE `Max`. Duplicate means same source-line/owned unique key, not a similar name. Multi-day rows expose dates; grouped mutation uses original line IDs, never aggregate IDs.

## Operational warehouse identity

A passive one-warehouse UI does not remove warehouseId from FK, lots/snapshots, stock, purchasing fingerprints, authorization/audit/lineage, reports/cache/deep links/exports. Historical/inactive rows and IDs remain; no merge/reassign/delete. Zero/multiple operational rows block commands; no fallback by name/code/index/order/activity.

MySQL-generated nullable `OperationalSingletonKey` enforces **at-most-one**, not exactly-one readiness. Application/API never writes it. Activation is separately authorized; startup observes and fails closed, never repairs. [OPERATIONS](OPERATIONS.md) owns activation pre/post checks and recovery.

## DEFAULT demand versus physical handoff

`GET /api/workflow-reports/ingredient-demand/aggregate/page` keeps daily customer/tier/ingredient/unit grain. `CurrentStockQty` is historical allocation at generation, not current stock; `SuggestedPurchaseQty` is a generation-time suggestion, not current purchasing entitlement.

Physical fields `IssuedQty`, `ReceivedByKitchenQty`, `RemainingToIssueQty` count exact DEFAULT MaterialRequestLineId/header issue lineage, excluding reconciliation. Kitchen received means issue `ReceivedAt`; remaining is the sum of each line's positive required-minus-issued. These are **gross handoff history**: confirmed returns compensate separately and do not reopen original issue allowance. MRX instead nets confirmed returns under its own contract.

Compatibility fields `FulfilledQty`, `PendingKitchenReceiptQty`, `UnissuedQty`, `OutstandingQty`, `FulfillmentStatus`, `ShortageCount` retain historical formulas; before EXPORTED they may derive from allocation/purchase suggestion. Do not relabel them physical stock or purchasing authority, or silently change ShortageCount.

Frontend aggregate discriminator `projection: physical-handoff` carries explicit issued/received/remaining and historicalAllocatedQty. Aggregate alias `available` means gross issued, unissuedQty remaining, pendingKitchenReceiptQty issued-not-received. Generic DemandLine retains its own allocation meaning. Operational tables/exports use Đã xuất / Chưa xuất / Bếp đã nhận / Chờ Bếp nhận.

Whole-filter, pre-page `RemainingToIssueCount` and `PendingKitchenReceiptCount` sets overlap. Issued-complete is total minus remaining count, not kitchen-complete; never subtract both sets to invent completion. Weekly counters use server scope, not page-local rows. Empty filtered daily results do not become weekly BOM; fallback without physical projection remains analytical only. Purchase reports/readiness keep their own eligibility authority.

Aggregate rows lack exact command source identity/current purchase eligibility. Preserve read customer/date/tier/ingredient/unit/source; use text handoff hints, not inferred purchasing/kitchen commands. Permission does not enter the response mapper. Existing generation/issue candidate workbenches choose documents and enforce commands.

## Lifecycle and immutable corrections

Shared vocabulary describes, not replaces feature enums: MUTABLE draft/cutoff; AWAITING_APPROVAL actor decision; POSTABLE complete prerequisites but explicit post still needed; POSTED exactly-once physical/financial effect; RECONCILIATION_REQUIRED differing physical evidence; TERMINAL immutable with compensation.

- Menu preview distinguishes unmatched valid dishes from malformed/ambiguous names. Commit is transactional and retains provenance. Missing BOM allows source drafts, not complete demand; generation fails closed before persistence for any missing effective published BOM.
- Coordination sends the selected date/shift. Locked baseline, adjusted servings and signed variance are different; changed servings need demand review. Chef reads handoff, not a fabricated sending action.
- Purchasing reads week/date/stage but decisions/receipts retain exact lines; no silent repricing or entitlement from allocation.
- Receipt: Coordinator draft → Warehouse quality accept/reject → Manager approval → Admin posting. Only post changes stock. Partial quality acceptance/rework/pre-post void retains provenance; posted ledger is immutable.
- Chef counting is local; persisted acknowledgement is atomic whole-issue after every line is checked, not ServiceRun close.
- Locked-menu amendment: Coordinator creates impact snapshot → different Manager reviews → different Admin executes; all three identities distinct. Physical PO/receipt/issue cases require append-only reconciliation, not regeneration. Admin break-glass before physical documents needs reason and BreakGlassExecute audit.
- Returns/supplemental/dispositions retain original issue/unit; cross-customer return disposition is Admin-only. Confirmed return affects stock through its owner, not rewritten issue.
- ServiceRun planning/material/service/reconciliation tracks stay distinct. Source handoff precedes open; open/retry is idempotent. CONFIRMED and WAIVED actual-serving variance decisions are exclusive; re-recording invalidates prior confirmation. Close resolves all blockers and freezes ClosedAt/cost/servings; later corrections are deltas. Behavioral owner: ServiceRunLifecycleTests.
- Commands bind actor/permission, command ID, expected version, exact sources and exception reason: authorize → load/version → preconditions → atomic state/audit/outbox/idempotency → projection. Outbox delivery is separate; [ARCHITECTURE](ARCHITECTURE.md) owns retry mechanics.
- Nullable legacy provenance requires reviewed proposal → different-actor approval → approved apply, rechecking exact source/unit at create/apply. No name/header/first-candidate backfill, quantity rewrite or destructive history repair.

Private source rows/workbooks remain local. Fixture/distribution boundaries are in [ENGINEERING](ENGINEERING.md#private-inputs-and-fixtures); operational restore/migration authority is in [OPERATIONS](OPERATIONS.md).
