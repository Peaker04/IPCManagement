# Complete MRX Production Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver every connected `MATERIAL_RECONCILIATION` workflow from source authoring through Warehouse, Manager, Chef, supplier preparation, reports, dashboard, audit, compatibility, and production acceptance.

**Architecture:** One persisted lineage connects customer/menu/servings/BOM to batch/daily line, source revisions/deltas, separate inventory issues/returns/movements, daily decisions, and completion. Actor-specific Backend projections feed operational screens and reports; multi-customer preparation aggregates reads while preserving separate customer/batch transactions.

**Tech Stack:** ASP.NET Core, EF Core/MySQL, xUnit, React/TypeScript, existing UI/workbench primitives, Vitest, Playwright, OpenAPI-generated contracts.

**Spec:** `docs/superpowers/specs/2026-10-18-mrx-production-vertical-slice-design.md`

## Plan Authority

This master plan supersedes the execution order—not the completed evidence—of:

- `docs/superpowers/plans/2026-10-18-mrx-production-vertical-slice-plan.md`
- `docs/superpowers/plans/2026-10-18-mrx-source-revision-multi-customer-plan.md`

Completed earlier Tasks 1–3 remain valid only at their recorded boundaries. All remaining work and final readiness are governed here.

## Global Constraints

- `DEFAULT != MATERIAL_RECONCILIATION` for command, query, lineage, audit, navigation, and cache.
- Every write uses canonical identity, operation-mode/version protection, aggregate expected version, idempotency, transaction, and real actor audit.
- Historical frozen facts, issues, returns, movements, dispositions, and audit are immutable.
- Chef is cooking read/export only.
- Warehouse is the sole physical stock mutation owner.
- Multi-customer preparation never merges durable issue or batch lineage.
- Reports reuse operational projections; no second calculation authority.
- No synthetic evidence, direct stock write, fake supplier assignment, negative issue, or client-computed completion authority.
- No migration apply, seed/import, production mode switch, deploy, package installation, commit, or push without separate authorization.

## Review Focus

1. A source edit after partial issuing must produce exact per-daily-line deltas without rewriting prior evidence.
2. A coordinated multi-customer command must be atomic while persisting separate issues and versions.
3. Wrong actor/mode/source family must fail before repository or durable writes, including deep links and shared Inventory endpoints.
4. Legacy/no-lineage records must remain readable but never become mutation or completion evidence.
5. Dashboard, reports, Excel, and operational pages must reconcile to the same batch/ledger/delta projections after reload.

---

### Task 1: Authorization, Permission Vocabulary, and Mode Isolation

**Owners:** `AuthorizationPolicies.cs`, `Program.cs`, Reconciliation controllers, InventoryIssues controller/service, FE route/action guards.

- [ ] RED: actor×mode tests for six emitted MRX permissions; categories/report/issue-confirmation access; unknown/wrong source family; source-family-aware Location.
- [ ] GREEN: emit and consume `reconciliation.read|source.read|warehouse.read|kitchen.read|disposition|complete`.
- [ ] Restrict decision reports/categories, preserve DEFAULT issue confirmation, and forbid Chef MRX confirmation.
- [ ] Regenerate OpenAPI/action/permission contracts and run focused/full security gates.

### Task 2: Canonical Paged Batch Summary and Exact Work Identity

**Owners:** `ReconciliationContracts.cs`, `ReconciliationBatchesController.cs`, `ReconciliationBatchService.cs`, `mrxApi.ts`, all MRX selectors.

- [ ] RED: deterministic customer/week/status paging and two-same-scope-batch deep-link tests.
- [ ] GREEN: summary DTO/page endpoint with no decision lines.
- [ ] Migrate Coordinator/Warehouse/Manager/Chef selectors to exact `batchId`; keep detail projections separate.
- [ ] Verify paging, reload, actor scope, and no first-match selection.

### Task 3: Source Authoring, Serving Changes, and Approval

**Owners:** existing Weekly Menu, MealQuantityPlan, MenuAmendment contracts/services/controllers; MRX Coordinator workbench.

- [ ] RED: Admin preview/confirm, specialist pending review, Admin approve/reject, stale source, missing BOM, and zero-effect rejection.
- [ ] Extend impact preview across customer/date/shift/dish/BOM/servings and affected MRX batches.
- [ ] Apply Admin direct or approved specialist changes with one versioned source revision and audit.
- [ ] Keep current source unchanged until approval and remove no historical source facts.

### Task 4: Frozen Batch Revision and Delta Projection

**Owners:** Reconciliation entities/configurations/contracts/services/completion.

- [ ] RED: before-first-issue replacement, post-issue positive/negative delta, changed ingredient, duplicate approval, affected disposition invalidation, completion blocking.
- [ ] Persist source revision and exact `batch × dailyLine` delta owner.
- [ ] Before first issue, replace/supersede the unissued batch revision without rewriting it.
- [ ] After issue, auto-enqueue positive supplemental or negative return-required work atomically with source approval.

### Task 5: Warehouse Initial Issue Workbench

**Owners:** InventoryIssue service/controller, MRX daily projection, `MrxDailyIssueWorkbench.tsx`.

- [ ] RED: all positive daily lines exactly once, requested quantity immutable, under/exact/over, reason, wrong date/batch/ingredient, legacy, stale and duplicate command.
- [ ] Render weekly read-only and concrete-date mutation surfaces.
- [ ] Confirm one initial issue per eligible customer/batch/date through canonical stock transaction.
- [ ] Preserve rows during refresh and show append-only result/history after reload.

### Task 6: Delta Queue, Supplemental Issue, and Physical Return

**Owners:** persisted delta service/endpoints, InventoryIssue and InventoryReturn owners, Warehouse MRX queue/workbench.

- [ ] RED: positive queue confirmation, negative return, mixed delta, stale revision, repeated confirmation, resolved status and audit correlation.
- [ ] Warehouse confirms every positive supplemental issue; approval alone never changes stock.
- [ ] Negative delta links to a physical return and changes stock only when canonical return receipt completes.
- [ ] Refresh ledger-derived issued/net quantities and invalidate only affected dispositions.

### Task 7: Atomic Multi-Customer Preparation

**Owners:** bounded Reconciliation/Inventory preparation DTO/service/controller; Warehouse selection UI.

- [ ] RED: same date/warehouse eligibility, customer separation, stale last batch, duplicate command, partial failure zero effects.
- [ ] Aggregate preparation by ingredient/unit while retaining allocations by customer/batch/daily line.
- [ ] Persist optional preparation group plus separate issue per batch in one protected transaction.
- [ ] Return group and issue identities; history links group without treating it as reconciliation authority.

### Task 8: Supplier Classification and Workbook

**Owners:** supplier quotation/assignment read authority, MRX preparation projection/export controller, Warehouse filters/export UI.

- [ ] RED: one/missing/ambiguous supplier, multi-customer/date filters, initial/supplemental filter, summary/detail total parity.
- [ ] Define deterministic canonical supplier selection; unresolved values remain `Chưa xác định nhà cung cấp`.
- [ ] Generate XLSX preparation-summary and allocation-detail sheets from one projection.
- [ ] Exclude prices, credentials, technical versions/fingerprints, and unauthorized customer/batch detail.

### Task 9: Manager Daily Decision and Completion

**Owners:** `ReconciliationPage.tsx`, disposition drawer, Actual/DailyLine controllers/services, Completion service.

- [ ] RED: exact daily identity, categories, create/correct disposition, stale conflict, issue notes, unresolved delta, under-issued day, all-date readiness, completed reload.
- [ ] Use full decision detail only for Manager/Admin.
- [ ] Complete only from Backend weekly authority when all issues/returns/deltas/dispositions resolve.
- [ ] Preserve completed history as read-only.

### Task 10: Chef Cooking-Only Surface

**Owners:** Kitchen export service/controller and `MrxCookingWorkbench.tsx`.

- [ ] RED: allowed frozen fields and forbidden issue/stock/variance/price/purchasing/technical fields.
- [ ] Deliver preview, CSV and XLSX with compatibility failures surfaced neutrally.
- [ ] Prove Chef cannot access Warehouse, decision detail, issue history, receipt confirmation, or mutations.

### Task 11: Dashboard, Queues, Notifications, Reports, and Audit

**Owners:** Backend MRX projection/report services; Dashboard/Reconciliation/Warehouse workbenches; audit presentation.

- [ ] RED: counts link to exact work objects and reconcile to list results after reload.
- [ ] Deliver queues for pending approval, awaiting Warehouse, pending delta/return, unresolved variance, completion-ready.
- [ ] Deliver operational reports: batch statement, issue/supplemental/return history, supplier workbook, variance register, completed register, audit trail.
- [ ] Add notification/acknowledgement only where persisted owner exists; do not infer unread state locally.
- [ ] Verify role/customer/mode scope and CSV/XLSX parity with visible projections.

### Task 12: Legacy Compatibility and Migration Readiness

**Owners:** Reconciliation compatibility policy, persistence model/migrations, migration tests/runbook.

- [ ] Inventory retained batch shapes and classify readable, daily-write-compatible, or legacy-blocked.
- [ ] RED: no implicit backfill/rewrite, legacy read, daily mutation denial, completed read-only, explicit migration idempotency.
- [ ] Author additive migration only if required; do not apply without separate authorization.
- [ ] Document rollback, backup, validation queries, and no-data-loss proof.

### Task 13: Full Production Verification and Closure

- [ ] Run full Backend, Frontend, generated-contract, conformance, architecture, lint, dependency, build, and diff gates.
- [ ] Run isolated public lifecycle across Admin, Coordinator, Warehouse, Manager, Chef, and denied Purchasing actors.
- [ ] Cover source import/edit/approval, batch lifecycle, initial/supplemental/return, multi-customer atomic issue, supplier workbook, disposition/completion, dashboard/report/audit, and reload.
- [ ] Correlate browser, HTTP, aggregate, DB lineage, stock movement, audit actor, export cells, idempotency, and concurrency.
- [ ] Run mandatory `ipc-test-audit`, `ipc-ui-review`, and `ipc-code-review`; fix Critical/Important findings once via RED→GREEN.
- [ ] Update `.planning/WORK.md` and conformance evidence with PASS/FAIL/NEEDS_EVIDENCE/BLOCKED; no production claim without runtime/persistence proof.

## Completed Evidence Carried Forward

- Backend readiness/source-family unknown validation: focused 315/315 PASS at prior checkpoint.
- Canonical route/API foundation: focused AppShell/API 23/23 PASS at prior checkpoint.
- Coordinator MRX preview/commit/READY/transfer workbench: focused Weekly Menu/API 24/24 and Backend policy 4/4 PASS at prior checkpoint.

These results reduce repeated work but do not satisfy Tasks 1–13 beyond their exact recorded boundaries.
