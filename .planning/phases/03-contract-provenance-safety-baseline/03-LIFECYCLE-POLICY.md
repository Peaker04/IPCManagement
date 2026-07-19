# BOM v1.1 lifecycle and retention policy

`PolicyVersion: BOM-LIFECYCLE-v1.1.0`

Status: locked for Phase 3 Gate A. Later manifests, previews, apply commands, rollback checks, and Admin review screens must record this exact `PolicyVersion`. This policy describes conservative migration behavior; it does not authorize a state transition in an operational workflow.

## Mandatory boundary

**D-03-07: Chứng từ approved/locked/completed, audit, approval history và stock ledger là immutable boundary.**

Consequently:

- `REGENERATE` means replace only a specifically owned draft/open derivative after Phase 5 has locked its exact scope. It never means deleting its history.
- `RETAIN` means preserve the row and all links. A later migration may only append provenance or reconciliation evidence.
- `BLOCK` means stop preview/apply for the affected scope and route it to Admin review. No fallback status, unit, effective date, or ownership may be inferred.
- Audit logs, approval histories, inventory receipts/issues/returns after operational posting, and stock movements are append-only evidence. Corrections are new compensating records or explicit review decisions, never cleanup deletion.
- D-03-03 collision rules and D-03-07 history rules override cleanup convenience in every conflict.

## Exact code-to-policy matrix

The source identifiers below are the current code evidence. Comparisons are case-insensitive in existing services, but persisted status output remains the exact uppercase code shown here.

### Menu schedule and menu version

| Aggregate | Observed code/state | Policy action | Reason and source identifier |
|---|---|---:|---|
| Menu version | `DRAFT` | `REGENERATE` only inside the Phase 5 owned draft scope; otherwise `RETAIN` | Custom import creates `DRAFT`, supersedes prior drafts, and permits rollback only from draft: `SampleDataImportService.CustomMenu.cs` (`CreateMenuVersionAsync`, `RollbackCustomMenuImportAsync`). |
| Menu version | `PUBLISHED` | `RETAIN` | Published menu is operational evidence: `CoordinationService.PublishMenuVersionAsync`. |
| Menu version | `SUPERSEDED` | `RETAIN` | Historical version retained when a new version becomes active/published: `CoordinationService.PublishMenuVersionAsync`; `SampleDataImportService.CustomMenu.cs`. |
| Menu version | `ROLLED_BACK` | `RETAIN` | Rollback result is history, not a reusable draft: `SampleDataImportService.CustomMenu.cs` (`RollbackCustomMenuImportAsync`). |
| Menu schedule | `DRAFT` | `REGENERATE` only inside the Phase 5 owned draft scope; otherwise `RETAIN` | Import may remove/replace stale draft schedules only: `SampleDataImportService.CustomMenu.cs`. |
| Menu schedule | `ACTIVE` | `RETAIN` | Activated by publish and consumed downstream: `CoordinationService.PublishMenuVersionAsync`. |
| Menu schedule | `LOCKED` | `RETAIN` | Explicit lock check: `CoordinationService.IsScheduleLocked`. |
| Menu schedule | `SUPERSEDED` | `RETAIN` | Normalized historical state: `CoordinationService.NormalizeMenuScheduleStatus`. |
| Either | any other/null state | `BLOCK` | Unknown/unmapped menu state has no safe regeneration semantics. |

### Meal quantity plan and production plan

| Aggregate | Observed code/state | Policy action | Reason and source identifier |
|---|---|---:|---|
| Meal quantity plan | `DRAFT`, `FORECASTED` | `REGENERATE` only inside Phase 5 owned draft/open scope | Editable forecast states: `OrderStatus.CanEditForecast` in `Models/DTOs/Coordination/SignoffDto.cs`. |
| Meal quantity plan | `CONFIRMED`, `ADJUSTED` | `RETAIN` | Locked operational quantities: `OrderStatus.IsLocked`; consumed by `MaterialDemandService`. |
| Meal quantity plan | `COMPLETED`, `ARCHIVED` | `RETAIN` | Completed/history boundary: `OrderStatus`; `MaterialDemandService.LoadMealLinesAsync`. |
| Meal quantity plan | `CANCELLED` | `RETAIN` | Cancellation is business history, not a draft reset: `OrderStatus.Cancelled`. |
| Production plan | `CREATED` | `REGENERATE` only inside Phase 5 owned open scope and only when no immutable downstream dependency exists | Generated/preserved by `MaterialDemandService.EnsureProductionPlanAsync`. |
| Production plan | `SENTTOKITCHEN` or non-null `SentToKitchenAt` | `RETAIN` | Send action adds actor/time and audit evidence: `ProductionPlanService.SendDailyToKitchenAsync`. |
| Either | any other/null state | `BLOCK` | Unknown production state cannot be classified safely. |

### Material demand

| Aggregate | Observed code/state | Policy action | Reason and source identifier |
|---|---|---:|---|
| Material request / demand | `DRAFT` | `REGENERATE` only inside Phase 5 owned draft scope | Generator resets only non-approved existing records to draft: `MaterialDemandService.EnsureMaterialRequestAsync`. |
| Material request / demand | `MANAGERAPPROVED`, `APPROVED` | `RETAIN` | Approved boundary; approved demand is preserved and can be issued: `MaterialDemandService.DemandApprovedStatus`; `InventoryIssueService.IssuableDemandStatuses`. |
| Material request / demand | `SENTTOWAREHOUSE` | `RETAIN` | Downstream handoff boundary accepted for inventory issue: `InventoryIssueService.IssuableDemandStatuses`. |
| Material request / demand | `EXPORTED` | `RETAIN` | Set only after full inventory issue: `InventoryIssueService.UpdateMaterialRequestStatusIfCompleted`. |
| Material request / demand | `CANCELLED` | `RETAIN` | Cancellation is preserved by generation: `MaterialDemandService.GenerateAsync`. |
| Material request / demand | any other/null state | `BLOCK` | Unknown/unmapped material demand state cannot be regenerated or deleted. |

### Purchase request

| Observed code/state | Policy action | Reason and source identifier |
|---|---:|---|
| `DRAFT` | `REGENERATE` only inside Phase 5 owned draft scope | Supplier/line edits are limited to draft: `PurchaseRequestWorkflowService`. |
| `SENTTOSUPPLIER` | `RETAIN` | Submission records audit and enters approval/receipt workflows: `PurchaseRequestWorkflowService.SubmitAsync`; `ApprovalInboxService.BuildPurchaseRequestItemsAsync`. |
| `APPROVED`, `REJECTED` | `RETAIN` | Approval decision boundary: `PurchaseRequestApprovalHandler.HandleCoreAsync`. |
| `PARTIALRECEIVED`, `RECEIVED` | `RETAIN` | Receipt-derived operational states: `InventoryReceiptService.ResolvePurchaseReceiptStatus`. |
| `SENTTOWAREHOUSE` | `RETAIN` | Approval-handler downstream handoff state: `InventoryReceiptApprovalHandler.HandleCoreAsync`. |
| `CANCELLED` | `RETAIN` | Cancellation is retained business history. |
| any other/null state | `BLOCK` | Never translate an unrecognized purchase-request state. In particular, do not confuse `PARTIALRECEIVED` with purchase-order `PARTIALLY_RECEIVED`. |

### Purchase order

| Observed code/state | Policy action | Reason and source identifier |
|---|---:|---|
| `ORDERED` | `RETAIN` | Created only from an approved purchase request: `PurchaseOrderService.CreateAsync`. |
| `PARTIALLY_RECEIVED`, `RECEIVED` | `RETAIN` | Operational receipt states: `PurchaseOrderService.StatusPartiallyReceived`, `StatusReceived`. |
| `CANCELLED` | `RETAIN` | Cancellation is retained; cancellation after receipt is rejected: `PurchaseOrderService.CancelAsync`. |
| any other/null state | `BLOCK` | Unknown/unmapped purchase order state is not mutable migration scope. |

### Inventory receipt

| Observed state | Policy action | Reason and source identifier |
|---|---:|---|
| Receipt row and lines exist | `RETAIN` | Creation immediately appends `RECEIPT` stock movements and updates purchase state in one transaction: `InventoryReceiptService.CreateFromPurchaseRequestAsync`. |
| Receipt does not exist | no action | Absence is not a draft receipt. |
| Any malformed/unlinked receipt | `BLOCK` | Admin review must resolve provenance; no delete/rebuild. |

### Inventory issue

| Observed state | Policy action | Reason and source identifier |
|---|---:|---|
| Issue row/lines exist, `ReceivedAt` is null | `RETAIN` | Posting the issue already creates `ISSUE` stock movements; kitchen receipt is a later acknowledgement: `InventoryIssueService.CreateAsync`. |
| `ReceivedAt` is non-null | `RETAIN` | Confirmation is one-way and audited: `InventoryIssueService.ConfirmReceiptAsync`. |
| Discrepancy audit exists | `RETAIN` | Discrepancy is append-only audit evidence. |
| Any malformed/unlinked issue | `BLOCK` | Never regenerate/delete an issued stock document. |

### Inventory return

| Observed state | Policy action | Reason and source identifier |
|---|---:|---|
| Return row/lines exist, `ReceivedAt` is null | `RETAIN` | Submitted return/waste record is operational evidence even before warehouse confirmation: `InventoryReturnService.CreateAsync`. |
| `ReceivedAt` is non-null, type `RETURN` | `RETAIN` | Confirmation is one-way and appends `RETURN` stock movements: `InventoryReturnService.ConfirmReceiptAsync`. |
| `ReceivedAt` is non-null, type `WASTE` | `RETAIN` | Confirmation appends waste audit evidence: `InventoryReturnService.ConfirmReceiptAsync`. |
| Any unknown return type or malformed link | `BLOCK` | Unknown semantics cannot be mapped to stock behavior. |

### Stock ledger, approvals, and audit history

| Aggregate/state | Policy action | Reason and source identifier |
|---|---:|---|
| Stock movement of any recognized type, including `RECEIPT`, `ISSUE`, `RETURN` | `RETAIN` | Stock ledger is an immutable boundary; services append through `StockLedgerService.AddStockAsync`/issue operation. |
| Unknown stock movement type | `BLOCK` and `RETAIN` the row | Unknown type cannot be deleted or rewritten; Admin must classify it. |
| Approval history, approved/rejected decision | `RETAIN` | Approval evidence is immutable: `ApprovalHandlerBase` and concrete handlers. |
| Audit log, including status, receipt, discrepancy, rollback, or cleanup audit | `RETAIN` | Audit evidence is immutable and append-only. |

## Later-phase ownership and fail-closed rules

1. **Effective date:** Phase 4 preview presents the proposed effective date and its affected rows. Phase 5 apply revalidates and records the operator-confirmed date. The parser never infers it from workbook timestamps, row order, existing BOM dates, or current time. Until confirmed, action is `BLOCK`.
2. **Draft regeneration scope:** Phase 5 owns and locks the exact IDs, statuses, customer scope, date range, and baseline checksum before mutation. A changed status, checksum, or newly attached immutable dependency causes `BLOCK`; broad status-only deletion is forbidden.
3. **Rollback window:** Phase 5 owns the rollback manifest and deadline. The window ends no later than creation of the first new immutable downstream dependency (approval, lock/completion, purchase/stock document, audit-dependent handoff, or stock movement). After that boundary, rollback means compensating/reconciliation workflow, never deletion.
4. **Customer overrides outside canonical coverage:** Preserve them. Phase 5 routes each unmatched ingredient/unit/date override to Admin review; Phase 6 exposes the review and resolution surface. No global row may silently overwrite it.
5. **Collision precedence:** D-03-03 collision handling and D-03-07 immutable history always override deduplication, cleanup, convenience, or import throughput.
6. **Unknown states:** Every state not explicitly listed above, including null/blank status where a status is expected, maps to `BLOCK`. The migration must emit aggregate, identifier, observed value, and source checksum for review.

## Version-change rule

Any addition/removal/reclassification of a status, action, immutable boundary, later-phase owner, or collision rule requires:

1. a new monotonically increasing `PolicyVersion`;
2. source-identifier evidence and characterization tests for the changed behavior;
3. a new Phase 4 preview produced against that version;
4. invalidation of every un-applied manifest created with an older version; and
5. explicit Admin re-approval before Phase 5 apply.

Already applied manifests retain their original policy version permanently for audit. A policy update never retroactively rewrites their evidence.
