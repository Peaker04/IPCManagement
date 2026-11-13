# MRX Multiyear ERP UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax. Project AGENTS.md and user native/no-commit constraints take priority over worktree, subagent and commit suggestions.

**Goal:** Close the expanded MRX audit verdicts with correct historical scope, explicit import outcomes and understandable operational output.

**Architecture:** Reuse the existing workspace session, paged batch API, MRX header/modal primitives and existing report services. Add only owner-specific query parameters and presentation transforms where necessary. BE remains the source of truth for locked days, versions, quantities and audit records.

**Tech Stack:** React/TypeScript, Vitest, Playwright, .NET 9/C#, MySQL, OpenXML ZIP builder.

**Spec:** `docs/superpowers/specs/2026-11-13-mrx-erp-multiyear-ux.md`

## Global constraints

- MRX mode/RBAC and source DB isolation unchanged. WORK is sole state owner.
- Preserve inherited edits. No reset/clean/stash/install/commit, endurance, main restart or source DB mutation.
- Write one meaningful failing owner test before each product change. No gate padding or relaxed assertions.
- Existing UI tokens/primitives only. Keep loading, empty, error, denial, partial and write reconciliation distinct.

## Review focus

### Approved correction execution order (2026-11-13)

1. Add shared historical year/range controls and validated scope, wire Dashboard requests and completed rows/exports, preserve old URL presets.
2. Initialize source history from explicit URL then workspace, with clear scope and retained server paging.
3. Add server search and paging for both audit families, migrate real FE consumers, preserve authorized legacy/export callers.
4. Separate Dashboard summary scope cache from batch paging, bound summary projection memory, add real paged work-queue retrieval with totals.
5. Add owner regressions for the corrected acceptance cases, build/lint/contracts, relevant BE Release tests and bounded fixture browser verification. Record actual runtime limits in WORK.

- A customer with 21+ imports can access page two and see the true total.
- A batch with 51+ source changes has reachable page two, and search applies to the correct scope.
- Completed customer/year/range filters must bind rows, totals, pages and exports, including 2024 and a 2023–2025 interval.
- Group import, reimport of locked days and stale preview remain blocked by existing BE rules.
- Workbook numerical totals and per-customer/day allocations reconcile exactly with source DTOs.

---

### Task 1: Correct misleading history and completed scope

**Files:** `frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx`, `frontend/src/features/reconciliation/branches/ReconciliationAuditBranch.tsx`, `frontend/src/features/reconciliation/ReconciliationPage.tsx`, adjacent tests.

- [ ] Write and run failing tests for import history page 2, source audit 51 rows, and Completed header filter semantics.
- [ ] Add true import paging; make source audit paging honest or implement a paged endpoint; apply completed customer/year/range filters on the server with identical export scope.
- [ ] Run focused FE tests and inspect accessibility labels.

### Task 2: Historical batch and source delta search

**Files:** `frontend/src/features/reconciliation/ReconciliationBatchPicker.tsx`, Chef/Warehouse header and workbenches, `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx`, `frontend/src/api/mrxApi.ts`, corresponding backend query owners and tests.

- [ ] Add failing multi-year/customer/code lookup tests at API and UI boundaries.
- [ ] Reuse the batch picker/query with server paging for Chef/Warehouse; add date/customer/batch filters for source delta history.
- [ ] Verify deep link, URL precedence, session continuity, RBAC and empty/error/retry behavior.

### Task 3: Clarify import intent and remove redundant week unlock

**Files:** `frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx`, `frontend/src/features/weekly-menu/hooks/useWeeklyMenuImportItems.ts`, relevant import tests.

- [ ] Add failing test: choose another week, Monday field becomes editable immediately; changing scope invalidates preview.
- [ ] Simplify week mode; render action outcome and locked-day summary from existing response, with explicit draft resume.
- [ ] Test new, draft, reimport, completed, group and failed-preview cases.

### Task 4: Workbook contract

**Files:** `backend/src/IPCManagement.Api/Features/Reconciliation/Services/PreparationWorkbookBuilder.cs`, `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs`.

- [ ] Add failing XML/workbook test for three normal sheets, frozen/filter headers and exact totals.
- [ ] Build summary, allocation and menu sheets from current DTO without changing numeric meaning.
- [ ] Run focused BE tests and inspect generated XLSX.

### Task 5: Chef, audit language and dialogs

**Files:** Chef dish list, `frontend/src/utils/formatters.ts`, reconciliation audit branch, import/modal owners and their tests.

- [ ] Add failing UI tests for dish servings, known audit entity/field values and keyboard discard behavior.
- [ ] Render business labels with technical detail available; simplify prompts and focus return without altering mutation guards.
- [ ] Run focused FE suites and keyboard browser checks.

### Task 6: Native integrated verification

**Files:** existing `frontend/tests/e2e-mrx` specs and `.planning/WORK.md` only for state/evidence.

- [ ] Run focused build/lint/unit and selected BE tests; run architecture gate unchanged.
- [ ] Run native disposable UiAcceptance/appropriate bounded diagnostics on a fresh clone; inspect workbook, screenshots, source/candidate and cleanup receipts.
- [ ] Record scoped PASS/FAIL/NEEDS_EVIDENCE and preserve OPERATIONAL_QUALIFICATION_BLOCKED if unrelated gates still fail.
