# Lifecycle contract — cung cấp suất ăn

**Status:** Phase 1 baseline; transition behavior is documented before refactor.  
**Source of truth:** implementation and tests; this document defines the target vocabulary and the baseline evidence.

## Work objects and grain

| Work object | Grain | Owner |
|---|---|---|
| MenuVersion/Schedule | customer + week + tier + effective range | Coordination/Admin |
| Demand / MaterialRequest | service date + shift + customer + ingredient + unit + source line | Planning |
| PurchaseRequest/Order | purchase request/order line + supplier + unit | Purchasing |
| Receipt | receipt line + purchase request line + lot/unit | Warehouse |
| Issue | issue line + material request line + date + shift + unit | Warehouse |
| Kitchen acknowledgement | issue line + actor + discrepancy | Chef |
| Return/Supplemental | origin issue line + unit + disposition | Warehouse/Chef/Purchasing |
| ServiceRun | production plan + shift | Planning/Chef |

Names are labels only; mutations use IDs and unit IDs. Weekly or grouped UI rows must drill back to source lines.

## Lifecycle classification

Feature-specific states remain intact. The shared projection classification is:

| Classification | Meaning |
|---|---|
| `MUTABLE` | Draft can still be edited/replaced within cutoff. |
| `AWAITING_APPROVAL` | A required actor must decide; creator cannot self-decide. |
| `POSTABLE` | Preconditions and approvals are complete; posting is an explicit command. |
| `POSTED` | Physical/financial effect is committed exactly once. |
| `RECONCILIATION_REQUIRED` | Physical evidence differs or a correction is needed; no silent regeneration. |
| `TERMINAL` | Closed/rejected/cancelled/fulfilled and no in-place mutation remains. |

## Transition catalogue (baseline → target)

| Work object | Baseline observed | Target command path | Terminal/compensation |
|---|---|---|---|
| Menu | DRAFT/FORECASTED/CONFIRMED/ADJUSTED/COMPLETED/CANCELLED | import preview → commit → publish → amendment/reconcile | supersede or append-only correction |
| Demand | DRAFT → MANAGERAPPROVED/SENTTOWAREHOUSE/CANCELLED | generate → approve → release → cancel/reopen with fingerprint | cancel/reopen only before physical evidence |
| Purchase | DRAFT/SENTTOSUPPLIER/APPROVED/REJECTED/... | generate → supplier decision → submit → approve → order | reject/cancel; no silent repricing |
| Receipt | **No receipt state; create currently writes ledger immediately** | create DRAFT → quality accept/reject → Manager approve → Admin POSTED | pre-post reject/rework; post correction/return only |
| Issue | created against material request; `ReceivedAt` marks kitchen handoff | allocate → issue → acknowledge/discrepancy | return/supplement/adjustment append-only |
| Return | PENDING_RECEIPT → received | create → warehouse receive → reconcile | discrepancy adjustment; never rewrite issue |
| Supplemental | DRAFT/PARTIALLY_FULFILLED/FULFILLED/REJECTED | request → allocate/procure → fulfill → chef acknowledge | reject/remaining balance |
| ServiceRun | derived `PLANNED/BLOCKED/.../CLOSED` | open → start → actual servings → resolve → confirm/waive → close | post-close adjustment |

## Command envelope (target)

Every transition command must carry `commandId`, aggregate/document ID, `expectedVersion`, actor/permission, timestamp, reason for exception, source-line IDs and correlation/causation IDs. Handler order is authorize → load/version check → domain preconditions → atomic state + audit + outbox → projection response.

## Refactor implementation note — DEFAULT lifecycle surfaces

- Weekly-menu preview distinguishes a valid new dish from a malformed workbook: an unmatched dish is warning-only and the existing transactional commit path creates its catalog identity with import provenance. If one normalized workbook name could refer to multiple catalog dishes and there is no single exact name match, preview fails closed instead of creating a duplicate. Missing BOM does not block saving a DRAFT menu; it remains a readiness/remediation requirement before complete material demand or kitchen handoff.
- BOM remediation preserves the originating dish, tier, customer scope and first affected service date in the Admin BOM URL. BOM quantities must still come from an authorized source and are never inferred from the menu import. Material-demand generation fails closed before persistence when any target menu line lacks an effective published BOM, so a partial demand cannot be mistaken for a complete plan.
- Weekly Menu owns customer/week source authoring. Its primary views are schedule, demand and production plan; purchase summary, weekly cost and dish materials remain secondary analytical details with compatible URLs.
- Coordination owns the explicit `send-to-kitchen` command for the selected service date/shift. Chef reads that handoff and does not send or “receive” the plan. After lock, the Coordination table presents the frozen servings baseline, the adjusted servings value and the signed increase/decrease; a non-zero change is explicitly marked as requiring material-demand recalculation.
- Purchasing works by week → service date → stage. Grouped ingredient totals always open the exact purchase-request source lines, and purchase-request deep links resolve the owning service date.
- Receipt ownership is Coordinator draft → Warehouse quality check → Manager approval → Admin posting. Rework and void are pre-post commands; post corrections create compensating documents and never rewrite the posted receipt or stock ledger.
- Chef ingredient counting is local interaction progress. Persisted kitchen acknowledgement remains atomic at whole-issue grain and requires all issue lines to be checked.
- Normal menu amendments appear in the Approval queue with separation of duties: Manager reviews `PENDING_REVIEW`; Admin executes `APPROVED`. Creating an amendment before any MaterialRequest exists is valid and must not issue an empty-list SQL query. Physical-evidence cases remain in the separate reconciliation workbench. Break-glass stays an audited API exception, not a primary action.
- Return/supplemental/disposition paths preserve origin issue/source-line identity. Cross-customer return disposition is Admin-only, matching the backend policy.
- Reports use short noun-phrase tab labels; each view answers its operational question in the heading/content while retaining per-view filters, export scope, permission checks and source-line lineage.

## Baseline evidence

- `InventoryReceiptServiceTests.CreateAsync_Should_CreateReceipt_UpdateCurrentStock_And_CommitTransaction` proves generic receipt creation currently calls `AddStockAsync` immediately.
- `InventoryReceiptServiceTests.CreateFromPurchaseRequestAsync_Should_CreateReceipt_UpdateStock_And_ChangeStatus` proves purchase receipt creation immediately creates movement and changes PurchaseRequest progress.
- `ApprovalHandlers.InventoryReceiptApprovalHandler` currently writes `PurchaseRequest.Status` and an approval history; `InventoryReceipt` itself has no status field. This is an orphan transition to replace in Phase 3.
- `ServiceRunLifecycleTests` already characterize blockers, idempotent open, variance, confirmation exclusivity, close and append-only correction.

## Decisions locked

- Receipt approval is **Coordinator create → Manager approve → Admin post**.
- Quality acceptance is a Receipt sub-state with partial acceptance.
- Posted Receipt is immutable; corrections are compensating documents/events.
- State/audit/outbox persistence is transactional; delivery relay is later.
