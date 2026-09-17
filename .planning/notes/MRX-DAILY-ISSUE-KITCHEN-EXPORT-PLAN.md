---
title: MRX daily warehouse issue and kitchen cooking export
status: planned-checklist
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

- [ ] Add backend tests proving two dates using the same ingredient remain separate daily requirements while weekly total equals their sum.
- [ ] Add tests proving issue for Tuesday cannot consume, satisfy or change Monday status.
- [ ] Add status truth-table tests for untouched/partial/under/exact/over/returned/disposed daily rows and weekly aggregation.
- [ ] Add wrong-date, outside-week, mixed-date request, duplicate daily line, stale version and wrong-mode rejection tests.
- [ ] Add frontend model tests proving `day` filter never changes weekly status and `ALL` cannot submit an issue.
- [ ] Add export projection/CSV tests for stable row grain, Vietnamese headers, quantity precision and no technical/price fields.
- [ ] Lock compatibility disposition for pre-change batches before migration implementation.

## 3. Backend and persistence

### Wave A — lineage design and migration

- [ ] Inventory current `ReconciliationBatchLine`, contributor, issue-line and stock movement relations and produce an additive migration design.
- [ ] Add durable daily frozen lineage at the lowest owner (preferred: frozen daily allocation/contributor record referenced by issue line; do not infer date from free-text notes).
- [ ] Define compatibility for existing batches:
  - protected/completed batches remain readable;
  - no silent rewrite;
  - daily issuing for legacy batches is blocked with a clear compatibility reason unless daily lineage can be deterministically reconstructed from retained contributors in an explicitly reviewed migration.
- [ ] Add uniqueness and foreign-key constraints preventing cross-batch/date/ingredient linkage and duplicate daily source rows.
- [ ] Update OpenAPI/generated contracts only through the project generation path.

### Wave B — projections and commands

- [ ] Extend preview/commit so daily frozen requirements and dish contributors are transactionally persisted with source fingerprint/version authority.
- [ ] Add daily warehouse projection returning dates, daily lines, daily totals, daily statuses and weekly status in one bounded read model.
- [ ] Change initial issue validation to one concrete service date and all positive daily lines for that date.
- [ ] Attach supplemental issue lines to the same daily lineage; fail closed when dish/BOM mapping is ambiguous.
- [ ] Derive issued quantity from linked issue lines minus confirmed returns at daily grain, then aggregate weekly totals from daily results.
- [ ] Reconcile lifecycle rules: batch becomes `IN_PROGRESS` after the first daily issue; completion requires every applicable date terminal plus existing disposition rules.
- [ ] Preserve stock ledger, idempotency, expected-version, audit, lifecycle sequence and MRX sufficient-stock provisioning invariants.
- [ ] Add Kitchen export endpoint/read model under `ReconciliationOnly` + appropriate read policy; stream UTF-8 CSV from frozen facts.

## 4. Frontend

### Wave C — daily Warehouse workbench

- [ ] Add URL-owned weekday filter with `Tất cả` and only applicable dates enabled/count-labelled.
- [ ] Present a weekly summary independent of active filter and a daily status for every date.
- [ ] Under `Tất cả`, group rows by date and keep issue action unavailable with guidance to select a date.
- [ ] Under a concrete date, show only that date’s frozen materials, required/issued/remaining quantities and per-line status.
- [ ] Scope draft quantities, over-issue reasons, validation IDs and command identity by `batchId + serviceDate + batchDailyLineId`.
- [ ] `Điền đủ ngày` fills only the selected date; never fills the week.
- [ ] Refresh daily and weekly projections after initial issue, supplemental issue, return and disposition.
- [ ] Preserve movement/history detail with service date visible and deep links retaining `batchId`, `view` and `day`.

### Wave D — Kitchen export

- [ ] Add a bounded `Xuất phiếu nấu` action in MRX Weekly Menu and/or Warehouse handoff surface, reusing one canonical export owner.
- [ ] Provide an on-screen preview grouped by date → shift → dish before download.
- [ ] Export the minimal columns in §1.4 using frozen values and shared quantity/date/shift formatters.
- [ ] Empty/error/stale/legacy-incompatible states provide clear diagnostics and never generate a misleading empty file.
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

## 8. New-session entry point

1. Read `AGENTS.md`, `MEMORY.md`, this checklist and `docs/domain/material-reconciliation.md`.
2. Verify branch `feature/mrx-daily-issue-kitchen-export-20260917`, clean status and HEAD.
3. Start with Wave A red tests and the daily-lineage persistence decision. Do not begin with page filtering.
