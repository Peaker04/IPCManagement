---
title: MRX daily warehouse issue and kitchen cooking export
status: implementation-green
owner: GSD
scope: MATERIAL_RECONCILIATION
branch: feature/mrx-daily-issue-kitchen-export-20260917
baseline_head: e2937bd5
---

# MRX daily issue and kitchen export — execution checklist

## 0. Owner decision and claim envelope

Business change authorized by Kỳ:

1. Warehouse issues reconciliation materials **per service date**, with filters `Tất cả | Thứ 2 … Chủ nhật`.
2. Daily and whole-week issue statuses must be derived from the same ledger facts and must not be misclassified by filtering.
3. Users can export a minimal cooking sheet for Kitchen containing servings, dishes and frozen BOM quantities needed to cook.

This is an L2 controlled domain/public-contract change. It may require additive schema/API changes because the current frozen batch line grain is weekly ingredient while daily issue authority needs durable date lineage. Do not fake daily status by filtering weekly totals.

Out of scope: DEFAULT material demand/purchasing, changing frozen source after READY, procurement, recipes/instructions, prices/cost, direct stock writes, schema/data cleanup, seed/reset, or automatic mutation of existing protected batches.

## 1. Canonical business grain

### 1.1 Daily issue grain

- Batch remains `customer × week`.
- Frozen source facts remain immutable after `READY`.
- Daily requirement grain is `batch × serviceDate × ingredient × canonicalUnit`; contributions retain `dish × shift × servings × BOM` lineage.
- An issue transaction has exactly one `serviceDate`; every line must belong to that date and the selected batch.
- Initial issue is no longer “all weekly lines once”. It is the first issue **for a date** and must include every positive frozen daily line for that date exactly once.
- Supplemental issues remain append-only and are attached to one service date and frozen daily line.
- Existing weekly frozen ingredient totals remain an aggregate projection, not the authority for daily allocation.

### 1.2 Status authority

Daily line status compares daily frozen required quantity with ledger-derived issued quantity minus confirmed returns for the same daily lineage:

- no linked issue: `Chưa xuất`
- issued < required: `Đã xuất thiếu`
- issued = required within quantity precision: `Đã xuất đủ`
- issued > required: `Đã xuất vượt`
- resolved variance keeps the factual quantity status and adds disposition presentation; it does not rewrite quantities.

Daily summary status is derived from all lines for that date with precedence:

1. `Chưa xuất` when every positive line has no issue.
2. `Xuất một phần` when some lines are untouched or any line is under-issued.
3. `Có xuất vượt` when no line is under/untouched and at least one line is over-issued without a valid resolution.
4. `Đã xuất đủ` when every line is exact or any overage has the required valid disposition according to completion policy.

Weekly status is derived from the seven daily summaries, never from the currently selected UI filter:

- `Chưa xuất tuần`: every applicable date is untouched.
- `Đang xuất theo ngày`: at least one applicable date is not terminal.
- `Cần xử lý chênh lệch`: all applicable dates were issued but unresolved variance remains.
- `Đã xuất đủ tuần`: every applicable date is terminal under completion policy.

Dates with no planned dish/servings/positive material requirement are `Không phát sinh` and excluded from weekly completion denominator.

### 1.3 Day filter

- URL owns `day=ALL|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY`.
- UI labels use `Tất cả`, `Thứ 2` … `Chủ nhật`; date is shown beside the weekday.
- Filter changes presentation and issue target only. It must not alter batch lifecycle or weekly status calculation.
- `Tất cả` is read-only overview for daily groups; creating an issue requires selecting one concrete date.
- Back/Forward, refresh and deep links restore batch/date/filter state.

### 1.4 Kitchen cooking export

Export is sourced from the frozen batch, not current mutable BOM/menu and not issue totals. One row per `serviceDate × shift × dish × ingredient`.

Minimal columns:

- Ngày
- Thứ
- Ca
- Món
- Số suất
- Nguyên liệu
- Đơn vị
- Định lượng BOM / suất
- Hao hụt (%) when frozen authority retains it; otherwise omit rather than recompute from mutable BOM
- Tổng lượng cần cho món
- Ghi chú frozen contributor when available

The export excludes IDs, fingerprints, versions, prices, supplier/purchasing data and reconciliation diagnostics. CSV and UI preview must use the same projection/order/formatters. UTF-8 BOM is required for Vietnamese spreadsheet compatibility.

## 2. Red-capable contract gates

- [x] Add backend policy tests proving two dates using the same ingredient remain separate daily requirements while weekly total equals their sum.
- [x] Add persistence-level coverage proving a Tuesday-linked issue leaves Monday untouched.
- [x] Add status truth-table tests for untouched/partial/under/exact/over/returned/disposed daily rows and weekly aggregation.
- [x] Add wrong-date, outside-week, mixed-date request, duplicate daily line, stale version and wrong-mode rejection tests.
- [x] Add frontend model/build coverage proving URL-owned `day` selection uses backend weekly status and `ALL` cannot submit an issue (production build/typecheck gate; focused behavior test remains follow-up).
- [x] Add export projection/CSV tests for stable row grain, Vietnamese headers, quantity precision and no technical/price fields.
- [x] Lock compatibility policy for pre-change batches before migration implementation: readable, daily issue blocked with `LEGACY_DAILY_LINEAGE_MISSING`, no rewrite.

## 3. Backend and persistence

### Wave A — lineage design and migration

#### Additive persistence decision · 17/09/2026

Wave A uses new durable daily rows; it does not add `ServiceDate` to the existing weekly aggregate row and does not reconstruct protected batches in place.

- Add `ReconciliationBatchDailyLine` as the frozen authority at `batch × serviceDate × ingredient × canonicalUnit`, with `DailyLineId`, `BatchLineId`, repeated batch/ingredient/unit keys, `ServiceDate`, `RequiredQuantity`, `Version` and a composite FK back to the exact weekly aggregate line. Unique `(BatchLineId, ServiceDate)` prevents duplicate daily source rows while the composite FK prevents cross-batch/ingredient/unit attachment.
- Add nullable `DailyLineId` to `ReconciliationBatchContributor`; new commits must populate it. Existing contributors remain unchanged with `NULL`, preserving historical reads while making legacy compatibility explicit.
- Add nullable daily lineage fields to `InventoryIssueLine` and enforce a composite FK to the exact daily line using daily-line ID, batch, service date, ingredient and unit. New MRX daily issues must populate them; legacy/default issue rows remain unchanged.
- Weekly `ReconciliationBatchLine.RequiredQuantity` stays as the aggregate projection and must equal the normalized sum of its daily lines for new batches. It is not used to allocate one date.
- Compatibility is fail-closed: a batch without complete daily lineage remains readable/export-diagnostic, but date issue commands return `LEGACY_DAILY_LINEAGE_MISSING`. `COMPLETED` remains read-only. No migration backfill is authorized in this wave.
- The migration must be additive only: create the daily table, nullable linkage columns, indexes/FKs/checks, and no `UPDATE` of retained business rows.

- [x] Inventory current `ReconciliationBatchLine`, contributor, issue-line and stock movement relations and produce the additive migration design above.
- [x] Add durable daily frozen lineage at the lowest owner: `ReconciliationBatchDailyLine`; contributors and MRX issue lines retain nullable references for legacy compatibility.
- [x] Define compatibility for existing batches:
  - protected/completed batches remain readable;
  - no silent rewrite;
  - daily issuing for legacy batches is blocked with a clear compatibility reason unless daily lineage can be deterministically reconstructed from retained contributors in an explicitly reviewed migration.
- [x] Add uniqueness and composite foreign-key constraints preventing duplicate daily source rows and cross-line/date/ingredient/unit linkage.
- [ ] Update OpenAPI/generated contracts only through the project generation path.

### Wave B — projections and commands

- [x] Extend preview/commit so daily frozen requirements and dish contributors are transactionally persisted with source fingerprint/version authority, including frozen date/shift/dish/servings/BOM-per-serving/waste facts needed by Kitchen export.
- [x] Add daily warehouse projection returning seven dates, daily lines/totals, ledger-minus-confirmed-return quantities, daily statuses and filter-independent weekly status in one bounded read model.
- [x] Change initial issue validation to one concrete service date and all positive daily lines for that date.
- [ ] Attach supplemental issue lines to the same daily lineage; **direct daily-line custom and remaining-quantity supplemental issue UI/API are complete**. Dish/serving projection remains intentionally disabled until its dedicated contributor ambiguity gate is implemented.
- [x] Derive issued quantity from linked issue lines minus confirmed returns at daily grain, then aggregate weekly totals from daily results.
- [x] Reconcile lifecycle rules: batch becomes `IN_PROGRESS` after the first daily issue; completion requires every applicable date terminal plus valid daily overage dispositions. Legacy in-progress batches retain the prior compatibility path.
- [ ] Preserve stock ledger, idempotency, expected-version, audit, lifecycle sequence and MRX sufficient-stock provisioning invariants.
- [x] Add Kitchen export endpoint/read model under `ReconciliationOnly` + read policy; stream UTF-8 CSV from frozen facts.

## 4. Frontend

### Wave C — daily Warehouse workbench

- [ ] Add URL-owned weekday filter with `Tất cả` and only applicable dates enabled/count-labelled.
- [ ] Present a weekly summary independent of active filter and a daily status for every date.
- [ ] Under `Tất cả`, group rows by date and keep issue action unavailable with guidance to select a date.
- [ ] Under a concrete date, show only that date’s frozen materials, required/issued/remaining quantities and per-line status.
- [ ] Scope draft quantities, over-issue reasons, validation IDs and command identity by `batchId + serviceDate + batchDailyLineId`.
- [ ] `Điền đủ ngày` fills only the selected date; never fills the week.
- [x] Refresh daily and weekly projections after initial issue and supplemental issue through RTK tag invalidation plus focused refetch. Return and disposition retain their existing reconciliation invalidation paths.
- [ ] Preserve movement/history detail with service date visible and deep links retaining `batchId`, `view` and `day`.

### Wave D — Kitchen export

- [ ] Add a bounded `Xuất phiếu nấu` action in MRX Weekly Menu and/or Warehouse handoff surface, reusing one canonical export owner.
- [ ] Provide an on-screen preview grouped by date → shift → dish before download.
- [ ] Export the minimal columns in §1.4 using frozen values and shared quantity/date/shift formatters.
- [x] Empty/error/stale/legacy-incompatible states provide clear diagnostics; Kitchen is lazy-loaded by action and Warehouse remains readable when daily/Kitchen capability is unavailable.
- [ ] Verify keyboard, accessible names, focus, horizontal overflow containment and 200% reflow.

## 5. Same-pattern/systemic checks

- [ ] Search every MRX consumer for weekly `requiredQuantity/issuedQuantity/status` assumptions and disposition each occurrence.
- [ ] Ensure Dashboard, Warehouse, Reconciliation, lifecycle strip and completion use the same backend status projection, not duplicated FE status logic.
- [ ] Ensure all issue/export routes are `ReconciliationOnly`; excluded DEFAULT routes neither fetch nor mutate MRX daily owners.
- [ ] Ensure filters are URL-owned and no current-page filtering is labelled as full-dataset search.
- [ ] Ensure CSV and rendered preview share one projection and vocabulary.
- [ ] Update `docs/domain/material-reconciliation.md`, API docs, UI rules and evidence index in the same delivery.

## 6. Verification matrix

- [ ] Source/unit: daily projection, quantity precision, status truth table, compatibility, CSV and permission/mode guards.
- [ ] Backend integration: preview → commit → READY → transfer → issue Monday → issue Wednesday → supplemental → return → disposition → complete.
- [ ] Database: daily lineage FK/uniqueness, exact issue/stock movement linkage, append-only history, no cross-date consumption.
- [ ] Headed Chrome in `MATERIAL_RECONCILIATION`: Admin read-only matrix plus Warehouse mutation actor when credentials are available.
- [ ] Browser cells: `ALL`, each applicable weekday, untouched, partial, exact, under, over, returned, error, stale, completed, legacy incompatible.
- [ ] URL: refresh, Back/Forward and deep link preserve batch/view/day.
- [ ] Export: preview and downloaded CSV match API/frozen DB facts; Vietnamese opens correctly; no IDs/secrets/price fields.
- [ ] Run focused suites, backend build/tests, frontend lint/build, OpenAPI parity, migration gate, diff/secret/stub scans.
- [ ] Restore original operation mode, teardown owned runtime, publish compact evidence/hashes, independent review.

## 7. Completion criteria

- [ ] Every applicable date can be issued independently without changing another date’s quantities or status.
- [ ] Daily and weekly statuses are deterministic from one backend projection and remain correct under every filter.
- [ ] `Tất cả` never accidentally submits a weekly issue.
- [ ] Kitchen receives a minimal frozen cooking export with servings and BOM quantities sufficient for preparation.
- [ ] Existing valid history remains readable; no protected data is rewritten or fabricated.
- [ ] No unresolved blocker remains in declared scope; authority-bounded residuals are explicit.
- [ ] Local checkpoint commit only; no push without separate approval.

## 8. Wave A checkpoint · 17/09/2026

- Branch/HEAD preflight: `feature/mrx-daily-issue-kitchen-export-20260917` at `00e45b46`; worktree/index were clean before task-owned edits.
- Red gate was observed as compile failure before the daily policy owner existed.
- Added policy-level frozen daily separation, quantity/status truth table, return/disposition, weekly aggregation and legacy compatibility coverage in `ReconciliationDailyLineagePolicyTests`.
- Added EF model/migration and persistence coverage in `ReconciliationDailyPersistenceModelTests`: nullable legacy links, composite restricted FKs, unique daily source grain, additive/no-data-rewrite migration operations, and Tuesday issue lineage leaving Monday untouched.
- Added `ReconciliationBatchDailyLine`, contributor/issue-line links, frozen daily materialization during batch creation, READY validation, and migration `20260917094732_AddReconciliationDailyFrozenLineage`. The migration was generated/scripted only and was not applied to a database.
- Added the shared backend status/compatibility owner in `ReconciliationDailyIssuePolicy`.
- Added command-level daily issue ownership: requests now carry `ReconciliationBatchDailyLineId`; the service loads one concrete `IssueDate`, rejects legacy/outside-date/mixed-date/duplicate/stale/wrong-mode input, persists daily ID + service date, and permits independent first issues for later dates while the batch is `IN_PROGRESS`.
- Supplemental issue eligibility is now evaluated per service date rather than “any issue in the week”; existing reason, stock, audit, idempotency and mode fences remain.
- Verification after command wiring: focused daily/issue/validator/request-fixture gates 80/80 PASS; command application-path suite 30/30 PASS including relational concurrency and mode-race coverage; backend build PASS with 0 warnings/errors; EF pending-model gate clean; `git diff --check` PASS.
- Broader `Phase30InactiveReconciliationOwnerTests.AbsentCleanupAndBackgroundMutationOwners_AreNotRegistered_AndLifecycleProcessorIsDeliveryOnly` remains `NEEDS_TRIAGE`: its exact mutation-surface list differs at index 42 although no controller action/signature was changed. Do not label the whole backend suite PASS until that independent oracle is reconciled.
- Added `GET /api/reconciliation/batches/{id}/warehouse-daily` under `ReconciliationOnly` + `InventoryIssueAccess`. Its response always contains the seven service dates, applicability, daily lines/totals, net issued after confirmed returns, remaining quantities, daily status, weekly status and explicit legacy compatibility.
- Weekly status is calculated from all applicable dates in the backend projection; the endpoint accepts no day filter, so presentation filtering cannot change lifecycle truth.
- Completion now consults the daily projection for new-lineage batches and rejects completion while any applicable date is untouched/partial or has unresolved overage. Legacy in-progress batches retain the existing weekly compatibility path.
- Added additive `ReconciliationDailyDisposition` persistence and migration `20260917124554_AddReconciliationDailyDispositions`; one versioned disposition belongs to one frozen daily line. No backfill or database apply occurred.
- Added `PUT /api/reconciliation/daily-lines/{dailyLineId}/disposition` under `ReconciliationOnly` + reconciliation disposition authority. Only current daily over-issue with linked ledger facts is eligible; exact/under/untouched lines fail closed.
- The Warehouse projection now marks only the exact disposed daily line as resolved. A Tuesday disposition cannot change Monday status. Completion succeeds when every applicable date is exact or has valid daily overage resolution, without re-aggregating away cross-date variance.
- Supplemental issue and confirmed return paths invalidate affected daily dispositions with immutable audit records.
- Verification after daily disposition/completion truth: focused backend set 114/114 PASS; backend build PASS with 0 warnings/errors; EF pending-model gate clean; both additive migrations contain no business-row rewrite; `git diff --check` PASS.
- Added frozen Kitchen contributor facts during batch creation: shift, dish identity/name, servings, BOM quantity per serving and retained waste rate. Mutable dish/BOM edits after READY do not alter export output.
- Added additive migration `20260920120854_AddReconciliationFrozenKitchenCookingFacts`; all new contributor fields are nullable for legacy readability and the migration performs no backfill/business-row rewrite. It is generated but not applied to a live database in this wave.
- Added canonical preview/export owner `ReconciliationKitchenExportService` and `GET /api/reconciliation/batches/{id}/kitchen-cooking` plus `/csv`, guarded by `ReconciliationOnly` and `ReportAccess`.
- Projection grain is exactly `serviceDate × shift × dish × ingredient`; duplicate contributors at the same grain aggregate total quantity, while inconsistent frozen servings/BOM/waste/dish facts fail closed. Legacy/incomplete batches return explicit compatibility diagnostics rather than mutable or misleading output.
- CSV uses the same ordered projection, Vietnamese minimal headers, invariant six-decimal formatting, CSV quoting and UTF-8 BOM; IDs, versions, fingerprints, prices, suppliers and purchasing facts are excluded.
- Verification: Kitchen export 5/5 PASS; focused reconciliation set 74/74 PASS; backend build PASS 0 warnings/errors; EF pending-model gate clean; `git diff --check` PASS.
- Exact next step: apply the new additive migration only with explicit runtime/database authority, then implement the bounded frontend preview/download owner and URL-owned Warehouse day filter. Existing protected batches will remain export-incompatible because no silent backfill is allowed.

## 8A. Emergency GET API remediation · 18/09/2026

- MRX/Kitchen feature execution is paused at the daily lifecycle checkpoint by owner request.
- Screenshots across Warehouse, Chef, Reports, Reconciliation and Admin shared the same failure class. Runtime red loop: `GET http://localhost:5262/health/ready` returned `503` with both task migrations pending while the running binary already mapped their new columns/relations.
- Root cause was schema/model drift, not eight independent frontend/query bugs. The two additive migrations were applied to the database actually configured behind user API `5262` (`ipcmanagement`), and the exact API parent process was restarted. Postflight readiness is HTTP 200 with database/migrations Healthy; lifecycle outbox remains expected Degraded-disabled.
- Authenticated DEFAULT GET sweep after restart: inventory issue history, Kitchen issue list/page, issue-vs-return list/page, supply-line reconciliation, audit list/page, data-quality list/page all returned 200. No post-restart GET 5xx, unknown-column or missing-table entry exists in the owned restart log. Reconciliation endpoints correctly return mode-unavailable in DEFAULT. Allocation requires its normal warehouse/request scope and returned expected 400 when deliberately called without those required parameters.
- Data preservation on the configured runtime database: retained reconciliation batch count stayed unchanged; new daily tables contain zero rows because existing protected batches were not backfilled. No seed/reset or business-row rewrite occurred.
- Operational disclosure: the same additive migrations were first applied to `ipc_lane7` while identifying which configured database backed `5262`; that lane also preserved its two existing batches and received no daily/backfill rows. Do not remove that schema without separate destructive cleanup authority.
- User runtime `5262` is now owned by restarted `dotnet run` parent PID `10144`, child listener PID observed `2380`; frontend `5173` was not stopped or modified.

## 9. Current checkpoint — 2026-09-21

- Daily issue and supplemental commands use exact service date and daily-line identity; `ALL` is read-only.
- Dish supplemental and Kitchen export use frozen contributor facts and fail closed on missing or ambiguous lineage.
- Replacement-batch functionality was removed as out of scope. Cleanup migration `20260921023839_RemoveReconciliationBatchSupersession` is applied to `ipcmanagement` and `ipc_lane7`.
- Legacy batches show one short warning and no empty daily table or technical status code.
- Live mutation PASS on a temporary DAV week (`2026-10-05`): import/publish, 12 completed serving plans, frozen batch commit, READY, transfer, Monday issue 37/37, daily reload, history and Kitchen CSV (292 rows, UTF-8 BOM) all succeeded.
- Authorized cleanup restored stock and removed all temporary week, issue and reconciliation records. Post-cleanup: original 5 batches, zero temporary schedules, temporary issue 404, readiness 200.
- Kitchen modal uses concise user copy, hides compatibility retry/download actions, and does not expose backend error codes.
- Verification: backend 67/67, Warehouse UI 29/29, frontend build/lint, EF model and diff checks pass.

## 11. Systemic MRX feedback, async continuity, and overlay remediation · 22/09/2026

### Contract and design brief

- **Problem/outcome:** Điều phối and Warehouse users must see one concise source of truth, retain issued rows through refresh/completion, and inspect a transaction without the underlying page scrolling or competing for focus.
- **Exact scope:** `MATERIAL_RECONCILIATION`; Weekly Menu `Định lượng xuất kho`, Warehouse demand/history, reconciliation issue detail; Admin/Thủ kho/Điều phối surfaces that consume these owners.
- **Authority unchanged:** backend lifecycle, role visibility, daily ledger facts, frozen lineage, append-only history and retained fixture are unchanged. No schema/data/mode mutation.
- **Composition:** lifecycle owns ordinary batch state; `InlineAlert` owns actionable anomalies only; `EmptyState` owns legacy/unavailable and ready-empty states; the demand table remains visible read-only after issue; canonical `Dialog` owns blocking transaction detail.
- **Red seams:** mounted component behavior tests for false-positive warning, post-issue refresh continuity, legacy empty state, modal semantics/scroll lock, and business-first issue detail.
- **Out of scope:** changing MRX business policy, inferring new serving-change facts, deleting technical lineage, redesigning unrelated DEFAULT workflows, mobile/tablet certification.

### Finding ledger / execution checklist

| ID | Severity | Finding / root owner | Checklist | Verdict |
|---|---|---|---|---|
| MRX-UI-01 | P1 | `ClosedLoopTransferPanel` shows a serving-change warning from lifecycle status alone and duplicates lifecycle/action copy. | [x] Red test [x] Remove false-positive/duplicate surface [x] Focused test | FIXED |
| MRX-UI-02 | P1 | Warehouse demand panel has a conditional render hole while daily projection refreshes or resolves unavailable. | [x] Red test [x] Retain current projection [x] Explicit loading/error/empty states [x] Mutation reload test | FIXED |
| MRX-UI-03 | P1 | Issue detail uses a non-modal drawer although the task requires isolated transaction inspection. | [x] Red test [x] Move to canonical modal contract [x] Scroll/focus/return/Escape gate | FIXED |
| MRX-UI-04 | P2 | Issue detail prioritizes UUID/unknown role and mixes batch-related notes with issue facts. | [x] Red test [x] Business summary first [x] Technical disclosure collapsed [x] Scope related notes honestly | FIXED |
| MRX-UI-05 | P2 | Legacy daily incompatibility is rendered as a high-salience warning rather than a purposeful unavailable state. | [x] Red test [x] Neutral empty state with history next action | FIXED |
| MRX-UI-06 | P2 | Shared warning alert color/title/icon use the stronger status palette and create excessive visual salience. | [x] Token-level alert palette [x] Shared primitive/build gate [x] Same-pattern review | FIXED |
| MRX-UI-07 | P2 | Async/overlay invariants were not locked by the existing regression suite. | [x] Add behavior/contract gates [x] Focused suites [x] Build/lint/diff [x] Headed Chrome evidence | PASS_FOCUSED |

### State matrix claimed

- Warehouse demand: initial loading, ready untouched, mutation refreshing with retained rows, issued read-only, legacy unavailable, query error.
- Issue detail: loading, ready, error; keyboard focus, Escape/close, internal scroll and locked background.
- Weekly Menu quantity panel: transferred/in-progress without proven serving change; lifecycle remains visible without a false warning.
- Desktop evidence: retained fixture at `1440×900`; canonical `1366×768` and `1920×1080` remain `NEEDS_EVIDENCE` unless this wave runs them.

### Follow-up composition correction · 22/09/2026

- [x] Move the legacy unavailable state into `warehouse-demand-panel` immediately after the `Danh sách cần xuất` tab instead of rendering it above lifecycle/tabs.
- [x] Recompose the BOM edit modal: ingredient search owns one full-width row; dish and ingredient selectors share one aligned two-column row; required markers remain inline with labels; quantity/status and effective-date groups retain their own balanced rows.
- [x] Add DOM-order/alignment regressions: Warehouse unavailable state follows its owning tab and is contained by the tabpanel; BOM search precedes an equal-parent dish/ingredient selector row.
- [x] Focused tests: 3 files / 41 PASS; production build PASS; ESLint quiet PASS; `git diff --check` PASS.
- Browser follow-up is `BLOCKED_NATURAL_STATE` on the current MRX runtime: authenticated batch scope exposed no legacy batch and MRX Admin exposed no naturally editable BOM row. Failed evidence attempt retained at `.artifacts/shipyard-live/mrx-ui-followup-2026-09-22T06-58-12-503Z/result.json`; no mode switch, seed or mutation was used to manufacture the state.

- [x] Retire the redundant Warehouse card `Xuất kho theo định lượng đã chốt / Kho vận hành`; move initial/supplemental issue actions into the owning demand `SectionPanel.actions` and keep denied-role guidance inside the same tabpanel. Focused 2 files/39 tests, build/lint/diff PASS; headed `1440×900` PASS at `.artifacts/shipyard-live/mrx-warehouse-header-retirement-2026-09-22T07-10-13-354Z/`.

### Verification receipt

- Red loop: 7 focused assertions failed before production edits across false warning, refresh continuity, legacy state and modal/detail contracts.
- Green loop: 5 files / 68 tests PASS; final modal/warehouse loop 4 files / 61 tests PASS.
- Production build PASS; ESLint quiet PASS (full lint remains 0 errors / 3 inherited warnings); `git diff --check` PASS; readiness HTTP 200.
- Headed Chrome `1440×900` PASS on retained batch `6c7d0f9a-df79-4446-82e7-8c660826e749`: issued rows remain visible, modal has `aria-modal=true`, body scroll lock, inert background, collapsed technical disclosure and no prominent unknown role. Evidence: `.artifacts/shipyard-live/mrx-ui-systemic-2026-09-22T06-42-57-969Z/`.
- `1366×768`, `1920×1080`, 200% reflow and natural legacy runtime remain `NEEDS_EVIDENCE`; mounted behavior tests cover their state contracts without manufacturing data.

### Select rapid-switch freeze correction · 22/09/2026

- [x] Reproduced rapid customer/batch switching against the retained fixture and traced the interaction owner to the shared Base UI Select contract, not route disablement or warehouse data authorization.
- [x] Make shared selects non-modal so a closing popup cannot retain page-wide pointer isolation while the operator moves to the next filter.
- [x] Remove the SelectContent close animation so the outgoing popup is removed immediately; remove the unproven page-local `key` remount workaround.
- [x] Add a shared rapid-switch regression and refresh stale completion-dialog accessible-name assertions.
- [x] Verification: 5 headed runs × 100 switches, maximum one visible popup, zero failures; 4 files / 51 tests PASS; production build and `git diff --check` PASS. Evidence: `.artifacts/shipyard-live/select-freeze-fix/result.json`.

### Comparison row action density correction · 22/09/2026

- [x] Screenshot triage confirmed `broken-adjacency` and `excessive-blank-surface`: the two row actions wrapped vertically and doubled affected row height.
- [x] Keep both actions on one line, use the existing compact `xs` button size, and preserve the table at `w-full table-fixed`; no horizontal-scroll requirement or new scroll owner was added.
- [x] Follow-up after UI/UX option review: replace variable row actions with one consistent `Thao tác` button that opens the canonical ingredient-detail modal. The modal conditionally exposes `Xử lý chênh lệch` / `Cập nhật xử lý` only when the line state and actor authority permit it; no business guard or mutation behavior changed.
- [x] Bound the action column to `7rem`; every populated row renders exactly one trigger. At `1920×1080`, the column remains 112px, row heights remain stable, and the table has no horizontal overflow.
- [x] Fix recurring select/overlay collision at the shared overlay owner: canonical Dialog closes every currently open Select through its native Escape path before applying modal lock, while Selects inside the dialog remain usable. This removes the stale background listbox without replacing Base UI's selection lifecycle.
- [x] Rename the final column from `Thao tác` to `Chi tiết` while retaining the row button label `Thao tác`, removing duplicate header/control wording.
- [x] Focused regression covers one action trigger, conditional modal action, rapid adjacent selects, modal-triggered Select closure, and Select use inside a modal. Four files / 31 tests PASS; production build PASS. Headed evidence: `.artifacts/shipyard-live/mrx-action-column-debug/final/`.
- [x] Balance Warehouse status columns across desktop widths: daily `Trạng thái` is fixed at `11rem`; weekly `Tiến độ theo ngày` is fixed at `13rem`; labels remain single-line and remaining width flows to business-data columns. At `1366`, `1440`, and `1920`, daily/weekly tables report no horizontal overflow and status ratios decrease naturally as the viewport grows instead of expanding into blank space. Warehouse focused suite: 32/32 PASS. Evidence: `.artifacts/shipyard-live/mrx-status-column-balanced/result.json`.
- [x] Align the `Nguyên liệu` projection between weekly and daily views: both columns are fixed at `20rem`, both render business name plus ingredient code, and neither table overflows at `1366`, `1549`, or `1920`. Evidence: `.artifacts/shipyard-live/mrx-ingredient-column-aligned/`.
- [x] Eliminate week/day section-header layout shift locally without changing shared `SectionPanel`: the read-only weekly header reserves the same `h-9` action geometry as the daily action slot. At `1549px`, both header boxes measure exactly 53px. Warehouse suite: 32/32 PASS. Evidence: `.artifacts/shipyard-live/mrx-section-header-aligned/`.
- [x] Eliminate table-grid shift between `Cả tuần` and daily filters: both five-column tables now share the same geometry (`320px / flexible / flexible / flexible / 176px`). At `1916px`, both tables have identical column left edges `[267, 587, 958, 1330, 1702]`, identical widths `[320, 372, 372, 372, 176]`, identical table top `542px`, and no horizontal overflow. Evidence: `.artifacts/shipyard-live/mrx-table-geometry-aligned/`.

### Weekly workflow modal restoration and reconciliation hierarchy · 22/09/2026

- [x] Restore `Nhập Excel` and `Chỉnh sửa lịch tuần` to their existing canonical Dialog path instead of forcing `surface="page"`; URL-owned `workflow=import|editor`, close behavior and draft guards remain unchanged.
- [x] Keep reconciliation mutations in the SectionPanel command area, preserve `Xem toàn bộ` there because it must remain available when the table is replaced by the matched empty state, soften the active `Cần kiểm tra` filter, and remove full-row warning tint so status/value accents carry anomaly meaning.
- [x] Focused tests: 4 files / 31 PASS. Headed `1920×1080`: both Weekly workflows have `aria-modal=true`, body lock and inert background; reconciliation review rows have transparent background. Evidence: `.artifacts/shipyard-live/weekly-modals-reconciliation-aligned/`.

## 13. Two-customer same-week mutation and FR/NFR audit · ACTIVE 23/09/2026

- **Owner request:** cleanup retained MRX mutation, then execute two customers in one week from happy path through worst-case states while auditing performance, UI/UX, FR and NFR gaps.
- **Cleanup PASS:** exact retained fixture `2026-10-26`, batch `6c7d0f9a-df79-4446-82e7-8c660826e749`, was on `ipcmanagement` rather than `ipc_lane7`. Backup created at `D:/IPCManagement-backups/mrx-two-customer-20261026-cleanup/ipcmanagement-20260922-235752.zip`. Preconditions proved one 37-line Monday issue, no returns/dispositions/lots/later movements, and current stock equal to each issue movement's `afterQty`. Cleanup restored `792.887300`, removed exact issue/movements/lifecycle/audit, batch daily/weekly lineage, quantity import, 12 plans, 12 schedules, 120 menu items, 12 menus, menu version and the unreferenced DAV week tier. Postflight: all fixture identities and week rows zero; canonical reconciliation batch count returned to 5; migration count remained 82.
- **Baseline attempt 1:** disposable `ipc_mrx_full_e2e_phase34_20260923000438_s`; failed on stale ambiguous `Chế độ vận hành` text locator before business mutation. Database dropped and owned runtime torn down. Harness locator corrected to the semantic tab.
- **Baseline attempt 2:** disposable `ipc_mrx_full_e2e_phase34_20260923000758_s`; source import, missing-BOM diagnostic/recovery, stale preview rejection, double-commit idempotency, READY immutability and transfer all passed. It then failed because the historical harness expected a weekly issue button, while the current contract correctly requires a concrete URL-owned day and renders `Cả tuần` read-only. Database dropped and owned runtime torn down.
- **Finding:** the historical full-E2E harness is stale at the daily-issue public contract and cannot certify current MRX. It also models stock shortage as an expected branch, conflicting with the canonical MRX sufficient-stock invariant. This is a harness/acceptance gap, not a production failure.
- **Exact next step:** replace the stale weekly/shortage segment with a current two-customer same-week runner: customer A exact issues across every applicable date → complete; customer B stale preview + under/over + supplemental + return + disposition invalidation/recovery → complete. Add DEV/preview interaction phase metrics, request timing, CLS/long-task/frame evidence, three desktop viewports, 200% reflow proxy, keyboard/focus/overflow/data-presentation checks, DB lineage/isolation assertions and automatic disposable teardown.

- **Current two-customer harness PASS · 23/09/2026:** replaced stale weekly/shortage assumptions with current daily-line authority and added a dedicated disposable runner under `.artifacts/shipyard-live/material-reconciliation-two-customer/`. Runtime uses built backend plus Vite production preview; source preparation can exclude the deliberate missing-BOM fixture without rewriting UTF-8 fixture JSON; login limiter is respected rather than bypassed. Final authoritative run `.artifacts/shipyard-live/material-reconciliation-two-customer/runs/20260923-072738/two-customer-result.json` is PASS: same week `2027-01-25`, ANV exact happy path 6 daily issues → `COMPLETED/WEEK_COMPLETE`, DAV stale replay + under/over + supplemental + disposition + confirmed return + re-disposition + remaining daily issues → `COMPLETED/WEEK_COMPLETE`; each frozen Kitchen projection has 514 rows. Browser completed-state evidence uses the Manager-owned Reconciliation surface rather than the Warehouse active-work surface, across 6 cells (`1366×768`, `1440×900`, `1920×1080` × ANV/DAV): zero overflow, console/page/request failure or raw lifecycle token; max CLS `0.04519`, max observed long task `0ms`, navigation `1139–1721ms`. API max observed duration `1617ms`, with no unexpected non-2xx response. Failure handling now writes final URL, headings, bounded DOM text, API responses and screenshot. Disposable DB was dropped and owned `3050/8050` listeners were torn down.
- **Residual evidence:** this run certifies production-preview completed-state Reconciliation composition/performance, not Warehouse `TRANSFERRED/IN_PROGRESS` headed composition, real 200% Chrome zoom, mobile/tablet, field CWV/p75 or user-usability timing. Those remain separate cells, not implied PASS.
- **Exact next step:** cleanup accepted MRX evidence/build artifacts per retention policy, then open the separately requested DEFAULT feature-by-feature happy→worst mutation campaign with its own checklist/ledger; do not mix DEFAULT state into this MRX runner.

## 12. New-session entry point

1. Read `AGENTS.md`, `MEMORY.md`, this checklist and `docs/domain/material-reconciliation.md`.
2. Verify branch, status, index, runtime database and listeners.
3. Continue only with mutation evidence from a naturally created new-lineage batch.
