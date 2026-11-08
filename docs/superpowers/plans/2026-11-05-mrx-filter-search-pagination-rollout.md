# MRX-wide Filter/Search/Pagination Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Live execution/checklists belong only to .planning/WORK.md; no subagents/worktree/commit or second ledger.

**Goal:** Complete approved B across MRX-visible surfaces, without extending DEFAULT workflows.
**Architecture:** Existing endpoint/query owners, one numbered PaginationBar, feature-local criteria and document finding. Preserve selected scope and draft/export authority separately from visible matches. No new query engine, giant toolbar or backend contract invention.
**Tech Stack:** Existing React/TypeScript, React Router, Vitest/Playwright and primitives.
**Spec:** docs/superpowers/specs/2026-11-05-filter-search-pagination-b1.md, MRX-wide continuation section.

## Global Constraints
- MATERIAL_RECONCILIATION only; shared master data has one owner. DEFAULT routes/branches excluded, earlier B1 preserved.
- No delegation/worktree/commit/install/DB/real credentials/service replacement; preserve dirty tree.
- Existing permission guards, day locks, quantities/plain6, frozen lineage and dirty drafts untouched.
- Numeric max Int32/page size100; no total inferred from one page. Initial/final states honest; previous data never relabeled as current criteria.
- Existing tokens/primitives, D6/D7/T7/T8/M1.2/N6. Unit/mock browser evidence never certifies live business persistence.

## Review Focus
1. Audit page2 and older selector pages must be reachable, not only first50/100.
2. Paging selectors must not silently switch the active batch or reset quantities/reasons.
3. Pending/error/403 must not become empty success or expose stale rows as current.
4. Accent-insensitive local finding must preserve the unfiltered business object/export scope.
5. Mobile wrap, keyboard focus and empty-filter clear must work without Shell rewrite.

## Task1 — MRX inventory and existing numbered paging
Owners: dashboard/ReconciliationDashboardPage; warehouse/MrxSourceDeltaWorkbench, MrxDailyIssueWorkbench; reconciliation/branches/ReconciliationTransactionsBranch, ReconciliationCompletedBranch; workbench/PaginationBar.
Interface: preserve current pager props; optional placement='footer'|'toolbar' only for actual top-of-workbench consumers. Counts/flags from server metadata; audit/completed fixed-size counts derive pages legitimately.
- Extend existing consumer boundary assertions only where behavior changes; run selected owner cases (expected PASS for pure pager composition; independent new count/boundary cases RED when useful).
- Reuse pager, keep0/1 page counts visible, pending controls disabled and unknown count='—'. No DTO/search/sort fiction.

## Task2 — Full audit history access
Owners: useReconciliationReports; ReconciliationReportTables; ReconciliationAuditBranch. Existing Reconciliation.test.tsx at network boundary.
Interface: auditPage scoped by batch, setAuditPage; include page in report cache identity, call getAuditTrail(batchId,page,50), forward pager state; source-change array remains separate nonpaged data.
- Regression: backend total51, page1 one identified audit row, Next sends page2 and renders different row; select another batch resets audit page1. Strict apiClient/fetch responses, no hook/component mocks.
- Run targeted case RED for absent audit pager; implement, rerun GREEN and report-owner regressions.

## Task3 — Batch selectors beyond first page
Owners: Chef MrxCookingWorkbench/header; useReconciliationWorkspace/header/page; Warehouse useMrxDailyWorkspace/current batch toolbar.
Interface: local catalog page plus exact metadata, fixed50 Chef/Warehouse and100 reconciliation; controls change catalogue page only. Selected batch remains authoritative even outside current page; changing customer resets catalogue page1.
- Network-owner regression: page2 exposes older option; selected cooking/review scope stays unchanged until explicit option selection. Pending/failed catalog read has retry and no fake total. Warehouse dirty scope lock also disables catalogue paging.
- Implement existing owners, no all-pages preloading. Run Chef/Reconciliation/Warehouse owners.

## Task4 — Local finding and feature-appropriate filters
Owners: utils/search.ts if multiple real callers; Warehouse local finding, Reconciliation lines/toolbar, Chef cooking, shared BOM/customers, preparation allocations and variance/source-audit displays as appropriate after endpoint inspection.
Interface: normalizeSearchText(value:string):string; normalize accents/đ/case/whitespace. No generic toolbar/hook registry. Match count and explicit clear; show local loaded-document scope when server filtering unsupported.
- Extend existing strongest local-filter owner case to unaccented query+clear; verify scope IDs, quantity/reason drafts and whole-batch exports unchanged. RED before owner repair.
- Wrap toolbar controls on narrow widths and use existing Input/Button/Select/Num. Do not create UI filters whose endpoint ignores them or silently narrow a bulk write/export.

## Task5 — MRX coverage review and production browser
- WORK coverage table enumerates each MRX leaf plus shared/auth/settings exits: source status, component evidence, browser evidence, residual gap. N/A only with an actual no-list/no-filter or permission reason.
- Relevant existing component/API/auth/mode/navigation/state tests, scoped lint, frontend build and diffcheck; no repeated whole-project suites between trivial edits.
- Isolated headed production browser across MRX route/leaf owners at1366/390, strict DTO-grounded interceptions/no writes: actual paging, filtering/reset, pending/error/retry, focus and scope/draft retention. Reuse existing browser fixtures/runner where possible.
- Record real counts/artifact identity. Parent self-review only (delegation not authorized). Close IDLE only when scoped work done; incomplete surfaces stay NEEDS_EVIDENCE/IN_PROGRESS. No whole-MRX release/real DB/field-performance certification.
