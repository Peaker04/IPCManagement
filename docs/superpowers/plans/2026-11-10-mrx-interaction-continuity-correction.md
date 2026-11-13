# MRX interaction continuity correction Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. No delegated workers authorized.

**Goal:** Repair the seven re-audit findings without hiding loading or weakening scope guards.
**Architecture:** Keep existing query owners and stable workspaces; separate batch authority from day pending. Retained source never drives dependent foreign-scope requests.
**Tech Stack:** React/TypeScript, Vitest/Testing Library, existing Playwright, canonical CSS.
**Spec:** docs/superpowers/specs/2026-11-10-mrx-interaction-continuity-correction.md

## Global constraints
No dependency/install/DB/process/mode/commit changes. Existing workspace preserved. Cold skeleton immediate; no timers/fades. WORK sole execution ledger.

## Review focus
- Pending A→B→C must not enable A writes in C.
- Same batch/day refresh preserves proven batch metadata but not stale day counts.
- Empty day retains query; permission/mode/lineage still blocks.
- Dependent source failure settles error instead of spinning or querying old menu version.
- 390px metadata wraps within available width; actual layout requires browser evidence.

## T1 Shared pending (R1,R7)
- Extend existing Primitives identity/inert regression to reject dimming; replace obsolete dim/delay assertions with stable brightness/inert checks.
- Run focused RED, remove only whole-content opacity transition (retain inert and pending indicator), run GREEN.
Files: StateBoundary.tsx, Primitives.test.tsx.

## T2 Granular metadata and warehouse shell (R2,R3)
- Extend existing HTTP MonthScope day test with retained lifecycle current-step; extend Warehouse day-isolation owner with search identity across empty day.
- RED, derive batch pending from batch identity not day previous-data/catalog fetch. Keep day counts separate. Warehouse retain line/search shell with empty DataGrid message while guarding missing/blocked scope.
- GREEN focused ReconciliationMonthScope/Warehouse/Chef.
Files: ReconciliationPage.tsx, MrxDailyIssueWorkbench.tsx, useMrxDailyWorkspace.ts, relevant existing tests.

## T3 Exact-source dependency (R4)
- Existing quantity inspection HTTP owner: defer next source; assert no old-menu inspection query under target scope and visible previous-source notice. RED then gate dependent query on exactSource; retain presentation data only and truthful error/empty outcomes.
Files: useMrxQuantityInspection.ts, MrxQuantityInspectionPage.tsx, WeeklyMenu.test.tsx.

## T4 Responsive/dashboard/browser evidence (R5,R6,R7)
- Bound metadata widths to available viewport in index.css; stable dashboard action placeholder and previous-count label, preserving permissions.
- Extend existing dashboard pending owner assertion. Browser observer collects header height plus work-surface/toolbar anchors; assert finite observed frames and <=1px stable same-workspace anchors for refresh. Do not execute authenticated runs without prerequisites.
Files: index.css, ReconciliationDashboardPage.tsx, existing dashboard test, loading-ux-async-consistency.spec.ts.

## T5 Verification
- Run npm run test:unit -w frontend; npm run lint -w frontend; npm run build -w frontend; git diff --check.
- Direct scoped UI/code/test review, document residuals and exact PASS/FAIL/BLOCKED in WORK, return IDLE. No automatic commit.
