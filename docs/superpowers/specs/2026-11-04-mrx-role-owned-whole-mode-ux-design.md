# MRX — Whole-mode role-owned UX and FE/BE repair design

**Status:** DESIGN APPROVED BY OWNER — latest explicit “Duyệt” approves the whole-mode design; concrete implementation plan is next. This does not lift the standing test/build/browser/campaign/DB pause or authorize deployment.
**Evidence:** supplied screenshot + read-only source inspection. No new browser, test, build, lint, campaign, DB or detector run. No independent reviewer/delegation certification.
**State owner:** `.planning/WORK.md` only. This document is a design deliverable, not a parallel task ledger.

## 1. Intent and approved scope

Find and repair product defects so each real MRX role can complete its own work, understand handoffs and recover safely. Existing FE/BE behavior and passing tests are not the requirements. The supplied approval-modal image is an example, not the scope boundary.

Cover `/` in MRX; `/weekly-menu?view=mrx-batch` including import, BOM prerequisites and source decisions; `/warehouse?view=mrx-daily|mrx-preparation|mrx-issues`; `/chef?view=mrx-cooking`; `/reconciliation` and its reports/history; MRX-relevant shared master-data/configuration entry points. Include all forms, grids, selectors, banners, modal/dialogs and state boundaries used by these flows.

Canonical owners: `docs/domain/material-reconciliation.md` (FR-RECON/BR-MRX-EDIT-1..9/BR-MRX-SERV-1..2), `docs/FLOWS.md` F7, `docs/DESIGN.md` UXR-02/NFR-UI-02..04/D7/M1/N1..6; `docs/ARCHITECTURE.md`; live source and generated contracts. Related FR-MENU/FR-CAT/FR-WH/FR-CHEF/FR-DASH/FR-AUTH/FR-SYS apply only at MRX boundaries. `frontend/PRODUCT.md` supplies usage context, not authority to override the bounded MRX contract.

## 2. Direction and alternatives

**Selected scope:** Owner explicitly requested all MRX, not one slice. **Implementation direction approved:** design the whole mode coherently, then repair existing owners in dependency order. Do not create another app shell or generic workflow engine.

Alternatives considered:
- Cosmetic/modal-only repair: rejected; leaves incorrect KPIs, cross-role navigation, precision and recovery defects.
- Whole-mode role-owned design with incremental owner-level implementation: recommended; exposes all handoff requirements before edits, preserves existing routes/transactions and yields reviewable changes.
- Replace all MRX screens with one universal workspace/task inbox: not recommended; larger migration, unnecessary framework and risk of treating Admin visibility as operational authority.

The Owner approved this whole-mode direction and composition in the subsequent “Duyệt”. Concrete interfaces and delivery steps belong to the implementation plan; newly discovered business-policy changes still require an explicit ruling.

## 3. Operating model — no dead ends without crossing responsibilities

A valid next step can be an allowed action, a truthful wait or a clear prerequisite. It need not be a link. Separate command ownership from permission to read shared source facts.

| Actor | Own work and allowed outcomes | Handoff/wait | Forbidden shortcut |
|---|---|---|---|
| Coordinator | Prepare menu/split servings, investigate prerequisites, preview/create/ready/transfer using existing authority; submit source changes | See submitted/rejected/correction/applied status; after transfer understand Warehouse is next | Open Warehouse to issue, open Manager decision station or use Admin master-data mutation as a required step |
| Warehouse | Select date/batch, prepare single/coordinated issue, record actuals/reasons, supplement, inspect own issue history and recover unknown outcomes | See eligible transferred work and what remains; know when Manager review is next | Edit source, decide variances, complete batch or view Chef-only cooking data |
| Chef | Find the correct customer/week/date/shift, view and export cooking instructions | Truthful unavailable/source-not-ready status, select another eligible scope or refresh | Issue/acknowledge stock or mutate reconciliation; no new Chef acknowledgement workflow |
| Manager | Existing source review/direct-edit authority; inspect daily discrepancies, correct decisions, complete an eligible whole week and read history | Identify exact outstanding dates/conditions and responsible role without operating their station | Enter Warehouse quantities or use Chef-only view; a role link is not a remedy |
| Admin | Existing oversight/master/configuration permissions and explicitly permitted operational actions | See accountable role and actual actor on audit | Treat Admin success as proof that the four operational journeys work, or add impersonation/role-switching controls |

Do not revoke Manager's existing authorized source-workspace operations. Multiple roles use effective existing permissions; do not assume one exclusive role string. No new customer restriction is inferred: current intentional-global permitted reads remain subject to existing policy. No new permission is granted just to make a CTA work.

### Handoff sketch

```text
Coordinator: source ready → transfer succeeds → “Đã bàn giao · Chờ Kho xuất”
Warehouse:   eligible date → actual issue → “Đã ghi phiếu” + own history
Chef:        correct cooking scope → view/download (parallel read branch)
Manager:     all-date evidence → decide eligible overage → complete whole week
```

Use persisted scope/status for handoffs. Do not claim staff notification, receipt or realtime delivery from lifecycle events. No new notification service, recipient assignment or messaging workflow.

## 4. Source-backed findings

All rows below are source-level findings/risk, NOT newly reproduced browser/DB failures. The screenshot directly supports the approval-modal visual observation only. Prior R6 evidence remains candidate-bound.

| ID / priority | Evidence owner | Observation and consequence | Proposed repair |
|---|---|---|---|
| UX01 / P1 | `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx:139–142,275–301` | Pending-source KPI uses total loaded batches; variance-lines KPI uses count of IN_PROGRESS batches; ready-to-complete KPI uses COMPLETED count. These quantities are different business facts. | Use correctly scoped authoritative counts or explicitly label a bounded recent list; never manufacture a KPI from unrelated lifecycle counts. |
| UX02 / P1 | Same dashboard `:80–118,122–137`; backend `ReconciliationReportsService.GetOperationalSummaryAsync` | Dashboard filters only a page of 20 batches; fetched summary is cached but not rendered. Existing BE summary has no selected-customer/period inputs. Binding unfiltered summary to filtered UI would still be wrong. | Define filter semantics, server filter/count/page contract and matching summary scope. Separate recent sample from full totals. |
| UX03 / P1 | Dashboard pipeline/actions; `useMrxBatchWorkspace.ts:263–288`; `MrxBatchWorkbench.tsx:273–281`; `ReconciliationPage.tsx:170–180,279–290`; Warehouse legacy boundary | Broad read capability is used for links into other-role stations; several links have no target-action role check. Route/API rejection does not make the invitation usable. | Role-appropriate destination or noninteractive handoff/wait; reuse route eligibility and action guards, preserve BE authorization. |
| UX04 / P1 | Supplied image; `MrxPendingRequestsPanel.tsx:79–87` | Flat raw impact paragraphs, shift enums, missing old/new dish and Mặn/Chay context. Dish-only change can render equal servings, including 0→0. | Structured review by date/shift and change kind, Vietnamese labels, semantic before/after; rejection reason shown when choosing rejection. |
| UX05 / P1 | `MenuAmendmentDto.cs`; `MrxMenuAmendmentCoordinator.MapMrxInboxItem`; `MrxSourceChangeApplier.PreviewAsync` | Preview has locked dates/material impact, but review inbox omits them. Snapshot at submit is not current applicability; old/new dish IDs do not supply human-readable identity. | Decision-oriented authorized read with submitted facts, exact dish identity/display, current applicability/version and bounded affected scope. Keep transaction rechecks at apply. |
| UX06 / P1 | `MrxSupplementalIssueModal.tsx:195,215,276` | By-dish quantity is rounded to 3 decimals and direct input advertises min 0.001 although MRX precision is 6. Positive small quantities can disappear from package submission. | Preserve rate precision, normalize final quantity at 6 decimals through existing quantity owner; preview/submission agree; explicit rejection of unmappable lines, not silently partial package. |
| UX07 / P1 | Same supplemental modal `:55–77`; `MrxCookingWorkbench.tsx:48–79`; `useMrxDailyWorkspace.ts` catalog load | Catalog failures are swallowed; successful-empty, unavailable and failed are not distinct. Supplemental data/selection can remain from a previous batch until replacement arrives. | Scope-keyed pending/error/empty data with retry; no stale choices. Direct frozen-ingredient supplemental entry remains usable when by-dish projection fails. |
| UX08 / P1 | `ReconciliationDispositionModal.tsx:41–52` | API category failure is replaced with a local fabricated successful category list. A user can decide without knowing authoritative options failed. | Show error/retry and block category-dependent save until authorized categories load; preserve draft and already committed per-line results. |
| UX09 / P1 | `MrxCookingWorkbench.tsx:82–116,187–192` | Groups are per dish/date/shift/variant, then servings are summed across groups. Multiple dishes in the same serving scope repeat meal counts. | Count authoritative serving grain once, not dishes; if response cannot establish that grain, correct the DTO or remove/rename the aggregate rather than infer it. |
| UX10 / P2 | Same Chef `isCompatibilityBlocked` | Every API409 is classified as legacy compatibility. Other conflicts can appear to be missing lineage. | Branch on actual machine error code; retain distinct conflict/retry, permission and legacy-unavailable states. |
| UX11 / P1 | `useReconciliationReports.ts:26–44,96–149` | Report states initialize once; a cache hit for a new scope returns without hydrating its state, and current getters prefer old non-null state. Scope change can display prior batch/page rows, including after an error. | Bind each result/error/loading state to batch/week/page; retain old data only for same-key refresh, never under a different scope header. |
| UX12 / P1 | `useMrxDailyWorkspace.ts:198–209`; supplemental modal `:222,226` | Unknown units fall back to kg; weekly values coerce missing issued data to zero and group by ingredient alone. This can give a false unit or erase unavailable semantics. | Never invent a unit or issued fact; unit-aware aggregation with explicit missing/unavailable state, preserve null versus zero. |
| UX13 / P1 | `MrxSourceDeltaWorkbench.tsx` and bounded contract/FLOWS F7 | Current UI offers supplemental/physical-return execution from source deltas, although new MRX changes must not create return work after issued-day locks. Historical persisted deltas may still exist. | Separate historical/compatibility evidence from new workflow. Inspect reachable BE guards/read semantics before defining remediation; do not restore an obsolete return workflow or delete records. |
| UX14 / P2 | `MrxMultiCustomerPreparationWorkbench.tsx`; `MrxPrepHeaderBranch.tsx` | Date can change during issue, while selected IDs/success/error are not keyed to date. A captured-date request may finish after the visible date changes. | Freeze scope during mutation or render result against captured scope; reset/key selections safely and preserve unknown-outcome protection. |

**Not proven defects:** affected-batch count zero may be correct before batch creation; request reason is stored content, not proven component hardcode; current physical stock/DB history correctness was not rechecked. Do not rewrite historical test reasons or use stale screenshots as proof of a new build.

## 5. Whole-mode interaction and layout contract

Retain Quiet Operational visual identity and existing primitives. This is not a new palette/app shell. All styling authority stays `frontend/src/styles/index.css`; no inline styles/ad-hoc colors/new token families. Follow D6≥12px, D7 one primary action per work context, T7 frozen table headers/identity, T8 compact 36–40px density, M1 single blocking overlay and N6 sidebar leaves.

Each surface has three layers:
1. **Scope:** human customer/week or date/shift, truthful status, refresh.
2. **Work:** the primary table/editor or a short actionable explanation, not a stack of banners and counters.
3. **Decision:** one permitted primary action; secondary details/history only when relevant.

Long review belongs in existing SplitWorkbench/page work area. Modals are for short input/confirmation, not the entire impact report. Keep scope visible, independent content scroll, sensible focus, Escape/cancel and pending-close policy. Technical IDs/version/fingerprint belong in collapsed details/copy affordances, not the main decision text.

### Per-surface proposed composition

| Surface | Main work object | Primary content/action | Secondary or progressive disclosure |
|---|---|---|---|
| MRX dashboard | Role-specific work list within existing frame | Actual own pending work with scope; allowed own-station link | Quiet handoff summary; global overview only if authorized, not four universal clickable pipeline cards |
| Source workspace | Existing source matrix | Customer/week, missing prerequisites, Mặn/Chay and slot edits; clear prepare versus send-review actions | BOM diagnostics and exact recovery owner; no unauthorized admin jump |
| Import/BOM | Existing import/editor owners | File/template, real preview errors, understandable row/column fixes, correct commit scope | History/snapshots in separate detail view; long error lists bounded, not piled into confirm dialog |
| Source review | Existing work area expanded for review | Who/when/reason if available, changed dates/ca, dish before/after, split-serving changes and apply eligibility | Material impact with unit, submitted snapshot vs current conflict details, metadata; short final confirm/reject input |
| Daily Warehouse | Existing daily grid | Customer/week/date, required/input/unit/status and overage reason only when needed | Own issue detail/history, canonical provision evidence; week summary is read-only |
| Coordinated preparation | Existing allocation grid | Date/selected customers, unit-consistent allocations; confirm scope/count before durable write | Supplier filter/export scope, included/excluded batches and no-partial-commit explanation |
| Supplemental | Short direct input or focused calculation work area | Direct ingredient vs by-dish are distinct modes, exact 6-decimal result and clear reason | Computation detail/lineage explanation; no competing package and direct primary submit, no hidden fallback source |
| Source-delta legacy | Existing history/compatibility view | Explain historical scope and permitted read/official remediation | No new source-change-driven returns; records retained |
| Chef | Existing cooking list | Customer/week + date/ca/variant context, correct meal grain and download | Ingredient detail, explicit full-batch versus filtered export scope, metadata secondary |
| Manager | Existing daily review grid | Whole-week readiness + date-level blockers, eligible overage decisions | Own read-only issue evidence without entering Warehouse; prior decisions/reasons remain append-only |
| Completion | Short confirmation | Customer/week, exact eligible all-date status, irreversible consequence | Details remain on review page; no selected-day count presented as week total |
| Registers/history/exports | Existing report tables | Exact scope, server page/total, truthful null/mixed-unit data | Export full same declared scope; legacy unavailable explanation; no prior-key rows during scope switch |
| Shared master/config | Existing authorized owners | Real prerequisite repair under existing read/write guards | Other roles see what is missing and responsible role, not a forbidden edit CTA; no mode switch as recovery |

### Example review skeleton (content hierarchy, not final visual mockup)

```text
Yêu cầu thay đổi · <khách hàng> · <tuần>
Lý do / người gửi / thời điểm (only if supplied by authority)
<changed dates and shifts> · <dish changes> · <split-serving changes>

Ngày / Ca    Món: trước → sau    Mặn: trước → sau    Chay: trước → sau
[Chi tiết ảnh hưởng nguyên liệu theo đơn vị]
[Ngày bị khóa / nguồn đã đổi: actual evidence and allowed recovery]

Quay lại                    Từ chối…    Phê duyệt thay đổi
```

Do not fabricate count examples, sender identities, material totals or an applicable verdict when data is missing. Unknown remains unknown.

## 6. Required FE/BE ownership changes

### Dashboard and navigation
- FE owners: `ReconciliationDashboardPage.tsx`, `routeRegistry.ts`, `navigationEligibility.ts`, existing action guards and source/Warehouse/Manager boundary consumers.
- BE owners: `ReconciliationReportsController.cs`, `ReconciliationReportsService.cs`, `ReconciliationContracts.cs`, existing auth/mode policy owners.
- Define exact customer/week/date/period scope once; summary and work rows must share it. Query/page/count on server, not a bounded browser sample.
- Return/render only role-appropriate business data; Chef must not receive stock/variance detail just because dashboard is shared. Reuse existing policies; if a dashboard projection needs a different policy, review a narrowly scoped read contract, never weaken report/decision policies globally.
- Separate pending own work, waiting-other-role and complete; READY is not yet transferred to Warehouse. Include only actual pending statuses (existing inbox includes PENDING_REVIEW and RECONCILIATION_REQUIRED; current summary only checks the first).

### Review and decision
- FE owners: `MrxPendingRequestsPanel.tsx`, `MrxSourceChangePanel.tsx`, `MrxBatchWorkbench.tsx`, `useMrxSourceEdit.ts`, `useMrxBatchWorkspace.ts`, `mrxApi.ts`.
- BE owners: `MenuAmendmentDto.cs`, `MrxMenuAmendmentCoordinator.cs`, `MrxSourceChangeApplier.cs` and existing gateway/controllers.
- Review read must retain exact dish identity plus understandable display, submitted split facts and scope, current lock/stale applicability separately from original snapshot. Avoid recomputing current facts and presenting them as the original request.
- Approval still rechecks role/mode/version/day locks in the protected transaction. A UI preview never guarantees a future write. Rejected/correction-required status must be understandable to the submitting actor through an authorized existing-owner read; do not reuse Manager-only inbox for everyone.

### Quantity, issue and Chef
- FE owners: `MrxSupplementalIssueModal.tsx`, `useMrxDailyWorkspace.ts`, `MrxMultiCustomerPreparationWorkbench.tsx`, `MrxCookingWorkbench.tsx` and their existing branches.
- BE owners if DTO repair is necessary: existing batch-dish projection, cooking query/export service and reconciliation contracts. Resolve caller needs before adding fields/endpoints.
- Preserve rate precision; final quantity normalized to 6 decimals once. Reject ambiguous mapping rather than choose the first material line. No partial package issue because a line rounded away or failed mapping.
- Canonical issue/provision/stock/lot/movement/idempotency remains at existing Inventory owner. No stock seed/direct writes, new stock ledger or procurement flow.
- Cooking total counts customer/date/shift/variant servings once; several dishes do not imply several meals. If no authoritative unique count is available, omit misleading total until DTO is sufficient.

### Reports, categories, legacy and shared prerequisites
- FE owners: `useReconciliationReports.ts`, report branches, `ReconciliationDispositionModal.tsx`, `MrxSourceDeltaWorkbench.tsx`, shared import/BOM/modal owners.
- Key results/errors/loading/drafts to actual actor/mode/batch/date/page. Keep known rows only during same-scope refresh; a different-scope header cannot cover old data.
- No successful API fallback data, unit kg default or null-to-zero business claims. Existing convenience reason presets are not automatically defects; distinguish user-invoked suggestions from fabricated persisted facts.
- No new return path or deletion of historical records. Inventory/catalog mutations remain under existing permissions. Backend contracts/types must be regenerated through the existing documented toolchain when implementation is authorized, not hand-maintained contradictory schemas.

## 7. State and recovery matrix (applies to every surface)

| State | Required presentation | Permitted behavior |
|---|---|---|
| Loading | Stable geometry and declared scope; no invented zero KPI | Wait/cancel/navigation where safe; mutation unavailable |
| Empty | Successful query with no eligible work, distinguish filter-empty from prerequisites | Adjust own filters/select scope; explain responsible prerequisite owner |
| Error | Actual failed request distinct from empty, retain entered draft where safe | Retry authorized read; never replace categories/data with a fake successful set |
| Permission denied | Clear boundary, no leaking restricted business data | Return to own station; do not offer role switch or broaden permissions |
| Partial/legacy | State exactly which facts unavailable and which reads remain valid | Read history or select eligible scope; no guessed lineage/zero totals |
| Write/reconciliation | Pending, committed, conflict and outcome-unknown are separate | Prevent double writes; preserve exact captured scope/command; reconcile before retry; no silent success |
| Waiting other role | Truthful scope/status and next responsible role | Refresh/read permitted progress; no foreign-station CTA required |
| Completed/read-only | Persisted final facts, not assumed zero variance | Authorized history/export only; no source/issue mutation |

## 8. Delivery and evidence boundaries

Whole-mode design precedes production edits. Suggested implementation order: (1) truthful role-aware dashboard/navigation/scope; (2) source/import/BOM/review contracts and layouts; (3) Warehouse quantity/recovery/coordinated scope; (4) Chef grain/export states; (5) Manager/category/completion and report scope; (6) shared UI consistency and bounded rendered evidence. This is dependency order, not permission to narrow research to one modal.

Design approval is recorded. Before implementation, review the concrete owner-level implementation plan produced with writing-plans. Before TSX/CSS changes emit the scoped UI gate. No automatic dependency install, subagent, worktree, stage, commit or deployment.

Before any test authoring/review use test-audit and ipc-test-audit. For each real defect, extend the existing strongest owner regression and prove the intended pre-fix failure/post-fix behavior when execution is authorized. Do not add one duplicate test per UI wrapper or bless current wrong behavior. Browser permission and candidate/runtime admission remain separately required under the standing pause.

Future rendered evidence must identify actual build/mode/actor/scope and show ordinary users' work plus blocked/waiting/error/long-content states, not only Admin happy-path screenshots. Reuse retained valid business evidence where applicable; do not replay the full expensive qualification campaign by default. Screenshot evidence proves visual behavior only; durable outcome needs request/transition/reload proof. Native Windows200% remains WAIVED_BY_OWNER, not PASS. Historical R6/43refs remain immutable and do not certify new UX.

## 9. Acceptance for this redesign (future, not claimed)

- Every MRX surface has an explicit actual actor/scope/state/action contract, including cross-role handoffs and shared prerequisite boundaries.
- No CTA invites an unauthorized station action; no permission widening to make navigation pass.
- Dashboard labels correspond to their real counted entities, selected scope and server totals; no sample-derived global KPI.
- Review can distinguish dish changes, Mặn/Chay changes and actual applicability; long review is not forced into a modal.
- Supplemental calculations preserve six-decimal quantities and exact mappings; failed projection cannot silently supply cached other-batch choices or partial package lines.
- Chef meal totals count the meal grain once; export scope is explicit; conflicts/errors do not masquerade as legacy empty data.
- Manager decisions use authoritative categories, preserve partial committed results and append-only history, and cannot waive daily under-issue.
- Changing scope never displays or submits prior-scope data; null, zero, unknown unit and mixed-unit totals remain honest.
- Modal focus, Escape/cancel, background isolation and mutation-close behavior are verified at their real primitives/consumers; density/readability and long Vietnamese content work on supported desktop/tablet.
- Product requirements drive regressions and evidence, not the reverse. No new all-MRX acceptance or release claim without corresponding evidence.

## 10. Research limits and implementation gates

This is a whole-mode initial source inventory and design, not an exhaustive line-by-line audit or fresh rendered certification. Primary MRX workbenches/services were inspected; shared master-data forms, every import state, backend catalog/cooking projection details and legacy command reachability still need deeper owner-level investigation during the implementation plan. No external web research, detector, runtime performance or new DB evidence is claimed.

The Owner approved the role-owned composition, decision-oriented review contract, truthful KPI scope, no-fallback/null semantics and legacy read-only direction. The implementation plan must resolve concrete caller/DTO details before code. Any newly discovered business-policy conflict must return to the Owner rather than be silently normalized to current code.
