# BOM Editor and Tier Repair Implementation Plan

> Use executing-plans inline under established project workflow. No delegation, worktree, commit or additional state owner. WORK.md owns progress.

**Goal:** Edit existing BOM quantities safely and restore honest overview tier coverage.
**Architecture:** Optional existing coverage query, tier-keyed workbench cache, existing versioned PUT from reused modal form.
**Tech Stack:** EF Core/C#, React/TypeScript, Vitest, existing Playwright.
**Spec:** ../specs/2026-11-07-bom-editor-tier-repair-design.md

## Global Constraints
One modal, existing primitives/tokens, six decimals, no published history overwrite, DEFAULT/MRX isolation, readOnly inspection, backend Catalog guards. No new endpoints/schema/dependencies, install/real writes/login/restart/commit.

## Review Focus
- Tier transition must not show previous-tier counts or ignore chosen tier in opened modal.
- Same ingredient in multiple tiers/scopes: exact bomId PUT with only quantity/effectiveFrom/reason.
- Published date <=old start must not send write; fractional six-decimal values must survive.
- Dirty/cancel/pending/error must preserve identity and block draft loss or duplicate mutation.
- Successful write plus failed reload must not suggest resubmitting; Catalog denied/readOnly paths cannot mutate.

## T1 Tier-specific coverage
Files: Catalog/Controllers/DishCatalogDiagnosticsController.cs; Services/{IDishCatalogDiagnosticsService,DishCatalogDiagnosticsService}.cs; backend/tests/IPCManagement.Api.Tests/DishCatalogTests.cs; frontend/src/api/bomApi.ts; features/admin/branches/AdminBomBranch.tsx; __tests__/AdminBomBranch.test.tsx.
Interface: GetBomCoverageAsync(decimal? priceTier=null), validate via MenuPriceTierPolicy/DishBomPolicy; optional query priceTier; frontend getBomCoverage(priceTier?,signal?) returning unchanged BomCoverageReport.
1. Extend primary persisted coverage regression through controller with requested25k/30k/34k, legacy unsupported, expired/draft exclusion. Intended RED ignored requested tier before signature implementation.
2. Add optional query parameter, supported-tier validation, predicate on active lines. Default remains all. Controller/service no data write.
3. Extend existing frontend filter owner to request tier30k, show server-scoped counts/status, carry tier to modal; switch empty/error/retry without stale-tier grid. Existing plain-all fixtures remain valid.
4. Add tier selector using supported-tier authority, URL filter, tier-specific snapshot/cache. Pass initialPriceTier to actual modal. No per-dish fanout.

## T2 Existing-line editing
Files: components/workbench/DishBomEditorModal.tsx; __tests__/DishBomEditorModal.test.tsx; same AdminBomBranch owner for entry and RBAC.
Interface: initialPriceTier?:number; existing bomApi.updateDishBomLine(dishId,bomId,{grossQtyPerServing,effectiveFrom,reason}).
1. Replace weak renders-existing-lines test with full real apiClient-boundary regression. Fail missing Chỉnh sửa button, then exercise six decimals, strict effective date, reason, error retains draft, pending duplicate exclusion, returned version row without original overwrite. Existing readOnly and add/dirty contracts retained.
2. Reuse current form in edit mode, immutable ingredient/tier/scope, VietnameseDateInput, required reason max500, date validation; single pending ref across writes. Dirty guards for switch/cancel/Escape. Successful write update/reload without accepting duplicate retry after reload error. Remove visible Global only.
3. Existing backend published-version test proves historical persistence; no second redundant storage test unless uncovered risk.

## T3 Verification and close
Existing browser mrx-menu-remediation owner: GET-only fixture render overview filters + edit form/dirty cancel and exact inherited tier, desktop1440/tablet1024; no real mutation. Extend once, inspect captures once, at most one correction confirmation.
Run focused FE/BE; FE build/lint/full; isolated Release core filter with bin-bom-editor; depcruise/conformance; browser typecheck; Impeccable detector/diff-check. Parent code/UI review. Report source/build/live mismatch; no live backend restart without new authority.
