# MRX Cold Layout Stability Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Owner prohibits delegation/new worktrees/commits. WORK.md is the sole live checklist; no separate ledger.

**Goal:** Prevent wrong-mode first paint and stabilize MRX cold loading without replacing the nested shell.
**Architecture:** Existing AuthProvider/ProtectedRoute own mode readiness. Existing loading primitives and feature owners own their geometry. AppShell stays unchanged.
**Tech Stack:** React, TypeScript, React Router, existing Vitest/Playwright/Vite.
**Spec:** docs/superpowers/specs/2026-11-05-mrx-cold-layout-stability.md

## Global Constraints
No installs, delegation, commits, new caches, real credentials/backend/DB probes or workflow changes. Keep canonical CSS authority and existing primitives. Preserve dirty work, running previews, DEFAULT/MRX isolation and frozen lineage.

## Review Focus
- Missing/stale mode on authenticated entry must never mount the wrong route branch.
- Bootstrap failure/retry cannot loop, silently fall back, or block unauthenticated login.
- Login's authoritative snapshot and a late startup request must not race into the replacement session.
- Skeleton-to-data geometry and headers remain stable without fabricating values or leaking foreign scope.
- Font preload must resolve real installed assets in both DEV and production; forced slow font swap remains measurable, not concealed.

## Task 1 — Authoritative mode bootstrap
Files: store/authContext.tsx, store/useAuth.ts, routes/ProtectedRoute.tsx; existing Auth.test.tsx and typed Primitives fixture.
- [ ] Extend Auth owner integration tests with a deferred mode response: assert real ProtectedRoute hides mode content until MRX resolves; rejection shows error and explicit retry recovers.
- [ ] Run Auth tests; record intended RED.
- [ ] Add readiness/error to context, populate from actual mode requests and login; guard protected Outlet and render existing pending/error/retry presentation. No polling/timers or stored-mode fallback.
- [ ] Run Auth/AppShell/route/cache adjacent tests; inspect other context producers and reload callers.

## Task 2 — Stable MRX loading geometry
Files: LocalizedBoundary.tsx, ReconciliationReportTables.tsx, existing MRX workbench owners, dashboard, Chef header; WorkspaceFrame.test.tsx/Primitives.test.tsx.
- [ ] Extend existing boundary/header behavior test to require accessible loading status and declared columns without unmounting header; record RED.
- [ ] Reuse WorkbenchSkeleton in LocalizedBoundary and declare per-report geometry; retain error/retry/empty behavior.
- [ ] Supply existing geometry/customSkeleton slots for MRX source, daily, cooking and dashboard; reserve Chef badge slot before data. No new primitive or shared registry migration.
- [ ] Run focused component and actual MRX owner suites, including existing state machine/smoke contracts.

## Task 4 — Owner-approved residual completion
Files: canonical styles/index.css, existing MRX dashboard owner/test and tests/browser/reload-presentation.spec.ts.
- [x] Require a late cold font not to resize the real MRX header in an intercepted production browser regression; pre-fix12.51245px change reproduced, post-fix browser PASS and requested fonts verified loaded.
- [x] Extend the pending-dashboard owner case across its three distinct report-visibility shapes, not a combinatorial route matrix; warehouse/chef RED, then GREEN with pipeline DOM/focus retention.
- [x] Preserve all installed font subsets/ranges/weights in index.css and use native optional display; descriptor/emitted-binary audit7/7 PASS. No preload plugin, altered font metrics or rendering deadline.
- [x] Keep static pipeline content mounted through loading/ready, reserve existing async command/telemetry space, and predict placeholder count only; actual metrics/actions still use server results/current guards. KPI structure is immediate, dashboard gutter stable, unknown/known totals use the same Num.
- [x] Repair the reproduced45.6px mobile context-select collapse at shared WorkspaceHeader's responsive title/context basis; fixed/nonresponsive and desktop behavior unchanged.
- [x] Final9suites83tests, scoped lint/build,3headed browser regressions and production Admin1366/Warehouse960/Chef390 confirmation PASS. Cold/warm/font/mode-bootstrap recheck done; tiny cold-BOM residual retained, no field/full-matrix certification. Evidence and IDLE close in WORK.

## Task 3 — Production confirmation / close
Files: frontend/index.html if font preload warranted; WORK.md. Diagnostic harness stays D:/Temp.
- [ ] Resolve installed Inter Latin/Vietnamese normal font paths, add only critical preloads; build must verify real hashed assets.
- [ ] Scoped ESLint, frontend build and diff check. Review only this task's delta against saved intake copies.
- [ ] Adapt prior audit to corrected expectations: fresh vs warm completed/BOM, mode pending/error/retry, stable sidebar identity; one batched render inspection and at most one repair confirmation. All API intercepted, no real writes.
- [ ] Record actual numbers, failures/residuals/skills in WORK and close IDLE. Leave previews and uncommitted work intact.
