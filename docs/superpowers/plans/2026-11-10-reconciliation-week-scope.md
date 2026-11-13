# Reconciliation Week Scope Implementation Plan

> Use superpowers:executing-plans inline; no delegation/commits authorized. WORK.md is the execution ledger.

**Goal:** Semantic status filters plus scalable, safe customer/week scope instead of history dropdown paging.
**Architecture:** Existing workspace hook resolves exact-week catalog and batch detail; new real-consumer week-batch chooser owns its own paginated selection list. Existing header/page orchestrate scope and feedback; index.css owns all colors.
**Tech:** React/TypeScript/Vitest, existing Modal/DataGrid/PaginationBar and API filters.
**Spec:** ../specs/2026-11-10-reconciliation-week-scope-design.md

## Global constraints
DEFAULT != MATERIAL_RECONCILIATION; current RBAC/quantities/lineage unchanged. No all-history loading or first100 truncation; no arbitrary choice on ambiguous week; no empty-week fallback. Canonical styling only, >=12px, compact frozen tables, one primary work object and one blocking modal. Preserve inherited changes. No data/schema/install/deploy/commit/delegation.

## Review focus
- Old unfiltered cache or response cannot replace requested week/customer.
- Old success/error after a rapid change cannot reset chosen scope or authorize stale writes.
- Direct batch link and browser history remain authoritative across all report views.
- Multiple batches in one week, including >100, must remain accessible without auto-selecting the first.
- Empty/error and unavailable modes must not look like a valid zero or another week's data.

## Task 1: Owner-boundary regression evidence
Files: frontend/src/__tests__/Reconciliation.test.tsx; existing backend batch query owner tests only if existing filter contract lacks evidence.
- [ ] Extend real route/network boundary cases for exact old week, empty week, ambiguity, chooser page changes and late responses/errors. Assert actual query scope, rendered data, URL and disabled mutation/export, not implementation strings.
- [ ] Run focused Vitest from frontend; record intended RED reasons.

## Task 2: Scope implementation
Files: frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts; branches/ReconciliationHeaderBranch.tsx; ReconciliationPage.tsx; new ReconciliationWeekBatchPicker.tsx.
- [ ] Add requested-week authority to hook and cache key. getBatchPage({customerId,weekStartDate,pageNumber:1,pageSize:2}) detects uniqueness. Preserve request cleanup/prefetch/error guards; authoritative deep-link metadata aligns customer/week. Handle no/one/multiple matches distinctly.
- [ ] Replace header history dropdown/pager with labelled week input; day belongs to selected week. Only ambiguous scope exposes choice dialog.
- [ ] Chooser queries exact customer/week in pages25; use real Modal/DataGrid/footer PaginationBar, retry, pending protection and explicit row choice. Cancel/page browsing cannot switch active batch.
- [ ] Migrate affected existing dropdown tests to week/picker controls, preserving their independent contract; run focused GREEN.

## Task 3: Semantic filters
Files: ReconciliationLinesFilterToolbar.tsx; frontend/src/styles/index.css; existing Reconciliation.test.tsx filter case.
- [ ] Add aria-pressed and token-backed semantic classes for all four filters. Keep labels/counts/actions; no global Button changes.
- [ ] Verify all selected/unselected/zero-count cases and contrast pairs; no color-only state.

## Task 4: Verification and closure
- [ ] Full FE unit suite (includes UI contracts), lint/build, relevant backend batch filter tests and diff check.
- [ ] One bounded source/DOM review plus browser desktop/tablet only if an existing safe, authorized browser fixture is available. Do not invent credentials/data or install tooling.
- [ ] Record failures, limitations and skill impact; close WORK to IDLE. No whole-product or production certification claim.
