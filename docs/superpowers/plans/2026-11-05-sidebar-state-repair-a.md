# Sidebar and page-state repair A Implementation Plan

> **For agentic workers:** use executing-plans inline. No delegation or commits authorized.

**Goal:** Repair the seven audited navigation/state defects without changing the sidebar or business rules.
**Architecture:** Surgical changes in existing query, page, modal and session owners; no new framework/cache. WORK remains the sole execution-state ledger.
**Tech Stack:** React/TypeScript, Vitest/Testing Library, existing Vite and intercepted Playwright Chrome.
**Spec:** docs/superpowers/specs/2026-11-05-sidebar-state-repair-a.md

## Global Constraints
Preserve inherited work, RBAC, DOM-MODE-1, authoritative quantities, existing styling authority, immutable evidence and running previews. No installs, live auth/DB, commits or subagents.

## Review Focus
- A pending response arriving after session clear must not republish data.
- Previous-page rows must not cross customer/view/mode boundaries.
- Initial error must terminate loading without automatic retry storms.
- Canceling discard must preserve input; successful writes must not prompt.
- Cached report reads must not extend freshness; refresh failure must retain same-scope rows.

## Tasks (execution tracked only in WORK)
1. Reports/query: extend Reports.test.tsx for stock→demand navigation, initial error/retry, pending page and filter isolation; RED, fix ReportsPage/scopedQuery, GREEN. Existing ScopedQuery tests cover store behavior; add late-clear coverage only at a boundary the page test cannot reach.
2. MRX reports: extend existing Reconciliation tests for expired completed-register hydration/revalidation and unchanged fresh timestamps; RED, fix useReconciliationReports cache read/write ownership, GREEN.
3. Drafts: extend DishBomEditorModal and AdminCustomers cases for Escape/footer discard/cancel. RED, connect existing Modal dirty guard and safe footer close; reset discarded inputs, preserve submit semantics; GREEN.
4. Session: extend existing auth/API contract cases for401/logout clearing and pending-query isolation. RED, share real teardown at authContext/client owners, GREEN.
5. BOM: extend AdminBomBranch test with warm remount and refresh failure preserving data; RED, adopt existing scoped workbench hydration, GREEN.
6. Verify scoped suites, available operational contracts, lint and build. Re-run original bounded browser reproductions against rebuilt dist; inspect actual rendering and own diff. Self-review, record remaining route/state gaps and close WORK to IDLE. No commit or full release claim.
