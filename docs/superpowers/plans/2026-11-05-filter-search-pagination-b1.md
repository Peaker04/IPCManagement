# Filter/search/pagination B1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline to implement task-by-task. Track live state only in WORK. No delegation/worktree/commit recipes without owner authority.

**Goal:** Ship the catalogue search/paging and Warehouse in-document finding slice of approved B, with reusable numbered pagination consumed by catalogue and Reports.
**Architecture:** Keep current URL owner and both existing query engines. Catalogue uses canonical URL input, a300ms debounced query-enable gate, real AbortSignal I/O and exact query snapshots; query generation guards remain. Small PaginationBar composes current Button/Select/Num; no filter registry/mega-toolbar. MRX local finding stays at the document branch.
**Tech Stack:** Existing React19/TypeScript/React Router, native AbortController, Vitest/Playwright, existing primitives/CSS.
**Spec:** docs/superpowers/specs/2026-11-05-filter-search-pagination-b1.md

## Global Constraints
- Preserve dirty tree, same cwd, empty staging, no install/delegation/worktree/commit/deploy/DB/real credentials. Existing previews remain running.
- Debounce300ms; page default1, size default25 and maximum100 per PagedRequestDto. Preserve view/business IDs on clear. Never infer global totals from current page.
- DEFAULT != MATERIAL_RECONCILIATION; permissions, source IDs, precision/frozen lineage and draft protection unchanged.
- Tokens only index.css; existing primitives; one primary per context. No invented backend filter/sort support.

## Review Focus
- Invalid URL numbers must never reach API as NaN/fractions/unsafe values: Task1 parser cases.
- Rapid input and IME must not send intermediate server search: Task2 owner regression.
- New criteria while old request resolves must neither publish stale rows nor flash empty: Task2 gate/abort and retained-row regression.
- Back/Forward, page-size change and clearing must preserve correct URL/context: Task1/2 real-router regression.
- Hidden editable rows must keep their quantity/reason drafts and submission scope: Task4 local finding/clear regression.

### Task1 — Canonical URL paging
Files: hooks/useUrlWorkbenchState.ts; existing __tests__/Primitives.test.tsx.
Interfaces: preserve existing getters/setters; add setPageSize(size:number), default page size bounded1..100; optional replace flag to setPage for correction; page changes push, typing replaces. No global clearing of business IDs.
- [ ] Extend existing URL owner case/table with invalid numeric input, atomic query reset, size reset and browser history assertions.
- [ ] Run Primitives; intended pre-fix failures, not absent-fixture errors.
- [ ] Normalize finite positive integers against Int32 wire range, clamp page size100, add setter; keep unrelated filters intact.
- [ ] Rerun owner suite.

### Task2 — Catalogue server search end-to-end
Files: hooks/useDebouncedValue.ts (new, value/delay→settled value); hooks/useWorkbenchQuery.ts (existing); api/adminApi.ts; features/admin/AdminDataPage.tsx and branches/AdminCatalogBranch.tsx; existing AdminData/useWorkbenchQuery tests.
Interfaces: useWorkbenchQuery enabled?:boolean defaults true; queryFn(params?,signal?:AbortSignal). Expose isPreviousData in stateProps. adminApi getIngredients/getDishes(params?,signal?) pass RequestInit.signal. Existing zero-argument producers remain valid. No engine migration.
- [ ] Extend existing AdminData cases: rapid typing from page2→one settled query/page1, URL navigation updates input, retained rows while pending, honest unknown counters. Engine owner tests pin disabled/no I/O and obsolete signal abort/race.
- [ ] Prove RED with original code.
- [ ] Implement debounce hook; remove Catalogue one-time local q mirror and duplicate URL setter. Gate query while debouncing/composing; query uses current normalized q/pageSize. Initial URL and page-only requests remain immediate.
- [ ] Scope exact snapshots to actor/mode/view/q/page/size. Key catalogue subtree by actor/mode/view to prevent cross-dataset retention. Keep previous same-partition rows pending/inert; settled error/manual retry remains.
- [ ] Add AbortController lifecycle to existing query owner, forwarding optional signal to catalogue network. Invalidate generation before abort; cleanup handles manual refresh too. Current-criterion loading/error must settle correctly after a failed previous criterion.
- [ ] Run actual owner suites and API/session boundary checks; no owner mocks or API fake fallbacks.

### Task3 — Reused numbered pagination
Files: components/workbench/PaginationBar.tsx (new); catalogue and ReportsPage.tsx consumers; existing AdminData/Reports cases.
Interface: aria label, authoritative page/pageSize/totalCount/totalPages/hasPrev/hasNext, pending flag, onPageChange; optional onPageSizeChange. Unknown totals are undefined, not0; no fictitious total for cursor results. Size options25/50/100 plus a valid current URL size.
- [ ] Extend actual consumer cases for size reset and disabled pending boundaries, rather than duplicate source/markup tests.
- [ ] Implement using Button/Select/Num. Always show known totals, including one/zero-page result; don't hide useful footer solely because totalPages<=1. Keep server metadata paired with displayed rows during revalidation.
- [ ] Migrate catalogue and Reports only; preserve Reports query/snapshot logic and fixed size25.
- [ ] Verify both consumers, no page-metadata fabrication.

### Task4 — Scoped MRX finding
Files: features/warehouse/branches/MrxDailyLinesBranch.tsx; existing Warehouse.test.tsx owner case.
- [ ] Extend one credible local filtering/draft case: Vietnamese unaccented query matches existing ingredient; clear restores hidden row and quantity/reason values, no API submission.
- [ ] Prove RED, then normalize case/diacritics/đ at this owner, reuse one day/week toolbar with explicit scope, Num result count and accessible clear. Explain finding changes visible rows only, not document scope. No client paging/quantity transformations.
- [ ] Run Warehouse and related MRX behavioral owners.

### Task5 — Verification/close
- [ ] Scoped code/UI/test audit; no synthetic business-evidence claims.
- [ ] Run changed-owner suites plus relevant navigation/state contracts, scoped ESLint, tsc+Vite and diffcheck.
- [ ] Isolated headed production browser with intercepted test DTOs: rapid search/deep-link/back/paging/size/pending/error/reset and narrow controls. No real backend writes/login/DB, no new business seeds.
- [ ] Record exact results/artifacts and remaining queue/history/report-filter rollout in WORK; close B1 IDLE without claiming whole-B or release completion. No commit.
