# Reconciliation Month Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver approved customer/batch/month/year/status header and quiet status chips without losing historical scope.
**Architecture:** Existing workspace hook owns scope and HTTP queries; server projector orders filtered batches; existing picker handles full-month history. Header presents scope; page places day buttons at table boundary. No new state owner.
**Tech Stack:** React/TypeScript, existing UI primitives, Vitest, C#/EF projector tests.
**Spec:** docs/superpowers/specs/2026-11-10-reconciliation-month-scope-design.md

## Global Constraints
- Preserve inherited work, MRX isolation, RBAC and quantities. No install/delegation/commit/schema/data/deploy. WORK sole execution ledger.
- Maximum5 selectable recent batches; full-month modal page25. Business WeekStartDate determines month. CSS index.css only.

## Review Focus
- November/December crossing week retains November month while choosing December service day.
- Older explicit batch outside five remains selected, not auto-replaced.
- Same-week duplicate imports distinguishable without treating concurrency Version as import ordinal.
- Late customer/month reads, failed catalogue and stale snapshots never enable wrong-scope writes/exports.
- Empty month, leap February, year changes, history and chooser cancellation retain truthful scope.

### Task1: Month catalogue and selection
Files: hooks/useReconciliationWorkspace.ts, ReconciliationWeekBatchPicker.tsx (rename to ReconciliationBatchPicker.tsx), ReconciliationPage.tsx, branches/ReconciliationHeaderBranch.tsx under frontend/src/features/reconciliation; backend Features/Reconciliation/Services/ReconciliationBatchQueryProjector.cs; existing ReconciliationServiceTests.cs.
Interfaces: hook selectedMonth:string (yyyy-MM), handleSelectMonth(month:string), handleSelectBatch(MrxBatchSummary), selectedWeek:string retained for day-strip; getBatchPage({customerId,weekFrom,weekTo,pageSize:5,pageNumber:1}); picker receives month:string, customerId, selectedBatchId, onSelect/onClose.
- Extend owner HTTP tests for five/ranges, empty month, late success/error, outside-five explicit links, month/year boundaries, chooser page101/cancel; run RED.
- Add server-order assertion to existing page-summary owner case and observe RED (newer business week vs later creation).
- Implement month URL/cache isolation and safe first-match selection, month header and chooser; preserve regression prefetch/cleanup.
- Run owner tests GREEN; migrate obsolete intentional week-input tests to month/day-strip interactions without dropping contracts.

### Task2: Quiet colors and day strip
Files: ReconciliationLinesFilterToolbar.tsx, ReconciliationPage.tsx, styles/index.css; geometry/owner tests.
- Assert no duplicate calendar, six T2–T7 pressed controls, no rejected redundant text; preserve aria-pressed filter tests.
- Use existing Button/Select and semantic tokens. Stronger selected same-hue background, no hover underline/decorative outline; focus-visible retained.
- Check focused tests; no new style dependency or token authority.

### Task3: Verification and close
- Run npm run test:unit -w frontend; npm run lint -w frontend; npm run build -w frontend; focused compiled dotnet test for batch catalogue; git diff --check.
- Review changed owners/callers using ipc-code-review/ipc-ui-review/test-audit. Browser only if available with safe dedicated instance; otherwise NEEDS_EVIDENCE.
- WORK verdicts/limits and lifecycle IDLE; no branch integration/commit.
