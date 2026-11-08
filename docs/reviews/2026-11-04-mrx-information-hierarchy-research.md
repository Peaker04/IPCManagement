# MRX — Information hierarchy and task-appropriate overlays

## Scope and evidence

Research supplement to the approved `2026-11-04-mrx-role-owned-whole-mode-ux-design.md` and its implementation plan. This does not replace that plan, close unfinished tasks, authorize runtime operations, or establish another task-state owner. Implementation progress remains in `.planning/WORK.md`.

Method: Impeccable Distill/Clarify/Operate, current source inspection, and direct retrieval of the references below. This is **not a rendered visual/accessibility audit or independent Critique**. No browser, detector, database, test campaign, installation, or delegation was used. The detector is deferred until changed UI exists; running it now would not validate a proposed layout.

## Research translated into product decisions

1. [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): defer advanced/rarely needed features, not frequently needed decision facts. In MRX, old versions and technical provenance may be secondary; current scope, changed quantities, blocking conditions, and consequences may not.
2. [NN/g — Modal & Nonmodal Dialogs](https://www.nngroup.com/articles/modal-nonmodal-dialog/): modals interrupt work and need task-relevant justification. A short irreversible-action confirmation earns a modal; a long source comparison, import history, or investigation does not merely because a modal already exists.
3. [NN/g — Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/): make errors recognizable, place them near their source, explain recovery, and respect effort. Do not collapse actual errors, discard typed reasons, or replace an uncertain committed result with a casual retry.
4. [W3C APG — Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): focus enters the dialog, Tab/Shift+Tab stay inside, Escape closes under the applicable safe-close contract, and focus normally returns to the invoking element. For long structured content, initial focus and description strategy need deliberate handling; a long table should not become one flattened accessible description. APG is interaction guidance, not proof that this implementation conforms to WCAG.

These sources support the direction, not new product permissions, stock rules, arbitrary pixel measurements, or measured performance claims. Existing `docs/DESIGN.md` remains authoritative for D6/D7/T7/T8/M1/N6.

## Approaches

- **A — Copy-only cleanup:** smallest diff, but leaves long reviews in modals and incorrect dashboard facts. Insufficient as the whole solution; suitable only as an incidental substep.
- **B — Task-first distillation (recommended):** keep current routes/primitives, separate short confirmations from long work, put decision facts first, disclose secondary evidence on demand, and complete the already-approved FE/BE truth repairs.
- **C — Wizard everywhere / new UI framework:** more clicks, draft transitions, maintenance and migration risk. Not justified; do not add.

## Information-placement rule

| Placement | Content | MRX examples |
|---|---|---|
| Always visible | Identity/scope, decision facts, blockers, consequences, current command state | Customer/week/date; old vs new servings/dishes; unresolved overage; immutable completion; unknown issue result |
| On demand, with a specific label | Evidence useful for investigation but unnecessary for most decisions | Historical submitted source, movement/lot lineage, version identifiers, import format explanation |
| Remove or consolidate | Repetition and implementation narration | Restating the title; a second explanation of the same blocker; technical jargon such as “BOM Tier” where “Mức giá suất ăn” suffices |

Do not move required facts behind a hover tooltip, hide warnings in closed details, turn unknown into zero, or hide whole capabilities to make the screen look simpler. A disabled command needs one nearby explanation and an allowed recovery/waiting state. An error and its recovery belong at one owner surface, not duplicated in header, body and toast.

## Source-backed findings and concrete composition

### 1. Manager source review — long work, not a bigger modal

Owner: `frontend/src/features/weekly-menu/MrxPendingRequestsPanel.tsx`.

Observed: the modal combines request switching, reason, all impact rows, affected-batch count, a permanently displayed rejection field, and two decisions. Impact rows show date/shift/servings but do not provide the approved submitted-versus-current applicability contract. Affected-batch count alone is not sufficient decision evidence.

Recommended composition, within the existing weekly-menu work object:

- Header: customer, week, request state; a visible return to the request list.
- Main review: submitted changes with clearly labelled before/after servings and dish identities, plus authoritative current applicability/locked-date evidence when the planned BE read exists.
- Secondary detail: submitted evidence/version history, on demand. Never relabel current data as the historical submitted snapshot.
- Decision area: one primary “Phê duyệt thay đổi”; secondary “Từ chối…”. Reveal a labelled rejection reason when choosing rejection, then the final rejection confirmation. Retain the reason on failure and prevent writes/scope switches while pending.
- Do not implement a fake complete review using inferred dish names or only the currently available impact rows. The planned review/submission DTO/read work remains necessary.

### 2. Completion — a short confirmation with a truthful blocker

Owner: `frontend/src/features/reconciliation/ReconciliationCompletionModal.tsx`.

Observed: relevant customer/week/status and irreversible consequence already exist. The blocked variant repeats its explanation and uses a long action label. The broad phrase “toàn bộ các dòng có sai lệch xuất - nhu cầu” risks implying that shortages can be explained away, contrary to the approved overage-only review rule.

Recommended visible content:

- Customer and week once; authoritative week status.
- Consequence: “Sau khi chốt, bạn không thể sửa nguồn hoặc xuất bổ sung vào lô này.”
- When blocked: “Còn N dòng cần xử lý trước khi chốt.” with “Xem dòng cần xử lý”; route the actual shortage/overage condition to its legitimate owner, not a blanket waiver instruction.
- Keep a concise explicit completion command and a neutral back action. Keep server validation, pending close guards, and unknown status; do not remove a confirmation to save one click.
- No expanded history, tutorial, repeated rule paragraph, or decorative summary-card stack in this modal.

### 3. BOM import — select scope first, inspect results second

Owner: `frontend/src/components/workbench/DishBomBatchImportModal.tsx`.

Observed: two template downloads compete in the footer with close/preview/commit; four colored metric cards repeat some preview context; metric labels use `text-[11px]`; the preview table has a nested vertical scroll; the quantity cell displays four decimals. Customer-list errors are swallowed and a delayed preview is not guarded against a changed scope. These correctness issues cannot be solved by typography alone.

Recommended composition:

- Scope group: price tier, customer/global scope, file. Use plain Vietnamese labels without “BOM Tier”/“Global” duplication.
- Place template download(s) beside file preparation, secondary rather than competing with the final command. Keep both missing-dish and full-template capabilities findable.
- Primary preview summary: valid/error counts and readiness; put the actual errors directly below, not in a closed disclosure.
- Row evidence remains available; avoid an additional vertical scroller inside the dialog body. Long review belongs in the existing work area rather than expanding the popup indefinitely.
- No text smaller than the existing 12px floor. Do not round decision-critical rate evidence to make it fit; rate precision must follow the actual contract, not an arbitrary four/six-decimal display assumption.
- Complete the approved delayed-preview/scope/error protections before treating a preview as safe to commit. Preserve meaningful warning severity.

### 4. Weekly-menu import/history — separate intake from investigation

Owner: `frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx`.

Observed: upload and import history/snapshot/rollback are tabbed inside the same modal; history has its own nested scroll and multiple 11px labels/actions.

Recommended:

- Intake remains focused on customer/week/file → preview → explicit import.
- Import history and retained-source inspection use the same route's work area, not a new workflow or parallel navigation system.
- Historical version/file/time is secondary metadata but must remain accessible and readable. Rollback eligibility, consequences and confirmation stay explicit.
- Remove mixed vocabulary such as “Lịch sử import & Khôi phục” in favor of a single domain-consistent label. Preserve append-only evidence and legitimate compatibility APIs.

### 5. Supplemental issue — one active mode, one committed scope

Owner: `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx`.

Observed: direct and by-dish modes now avoid simultaneous primary commands, and catalog/error/unknown-outcome handling already exists. Header context still emphasizes a truncated batch identifier. By-dish mode adds an explanatory blue panel and another internally scrolling material list.

Recommended:

- Human-readable customer/batch context and service date first, supplied from authoritative existing data; identifiers secondary, never invent a label.
- Keep direct entry and by-dish calculation; show only the active mode's fields/primary command.
- The complete package's ingredient/quantity/unit evidence must be inspectable before confirming; do not collapse missing mapping or invalid-quantity blockers.
- Use one body scroller where a modal still suits the task. If package review is long, use the existing work area rather than hiding quantities or shrinking text.
- Preserve final quantity precision, frozen daily mapping, whole-package validation, and explicit uncertain-result recovery. Existing completed fixes need not be rewritten merely for stylistic consistency.

### 6. Dashboard — remove competition only after correcting meaning

Owner: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`.

Observed: four large KPI cards, four pipeline cards and the active-batch table compete vertically. `totalBatches` is displayed as pending source changes and `inProgress` as discrepancy-line count. These are different business grains, not wording preferences.

Recommended:

- First: the approved role-projected operational summary with matching scope and nullable unavailable/unauthorized facts.
- Main: the actor's actual work queue, with the next allowed action or truthful waiting owner.
- Secondary: process orientation/help, on demand instead of four always-prominent navigable cards.
- Do not just rename cards, hide a permission error, or count the downloaded sample as an authoritative total. Task2 BE/FE remains open.

### 7. Daily/coordinated Warehouse, Chef, Manager disposition, reports/history

Retain the approved owners rather than restyling every surface:

- Warehouse: customer/batch/date/selection and write outcome are primary. Stock/movement audit is secondary but retained. Scope may not change during an unresolved command.
- Chef: date/shift, reliable meal counts, dishes/materials and whole-batch export scope are primary; version/lineage is secondary. No issue/edit/acknowledge action is added to this read/export-only role.
- Manager disposition: ingredient/date, overage, category, reason and partial-save progress are primary. Historical decisions are on demand/read-only. Category errors and committed-row counts must not be hidden.
- Reports: scope, pagination, result freshness and load/error state are primary. Technical provenance is secondary. Never show previous-scope rows as the new scope or aggregate incompatible units to shorten a summary.
- Legacy delta/history: move obsolete commands out of the active workflow as already planned, but keep legitimate historical reads and pagination. Deleting history is not distillation.

## Order and acceptance

Use the existing approved Tasks2–5/10/11, not a new implementation program. Preserve completed navigation, report-scope, Chef-grain, Manager-category and coordinated-command repairs.

1. Repair facts/applicability/scope at their existing FE/BE owners.
2. Recompose long review/history in the current work area and keep only short protected decisions in dialogs.
3. Reduce repeated copy and competing secondary actions; keep accessible labels and required evidence.
4. Use focused existing owner regressions for changed behavior. Copy-only changes do not earn a duplicate test. Run installed local gates under the existing authorization; no install or implicit browser admission.
5. After implementation, run the installed detector once on changed UI; actual readability, focus return, Escape/dirty draft, button visibility, single scroll and normal responsive behavior still require separately admitted rendered evidence. Native Windows200% stays WAIVED_BY_OWNER, not PASS.

The target is not “everything fits without scrolling.” The target is that a role can identify its object, understand the decision, inspect necessary evidence and act safely without unrelated content competing for attention.
