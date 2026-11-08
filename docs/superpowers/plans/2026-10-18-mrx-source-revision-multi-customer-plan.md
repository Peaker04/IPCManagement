# MRX Source Revision and Multi-Customer Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Backend authorization and source-family boundaries, then synchronize approved dish/serving changes into Warehouse delta work and multi-customer preparation without merging customer batch or issue lineage.

**Architecture:** Extend existing Reconciliation, Coordination/MenuAmendment, and Inventory owners rather than creating a second workflow engine. Approved source changes create immutable revisions and pending deltas; Warehouse may prepare several eligible batches together but Backend persists separate customer/batch issues in one protected all-or-nothing coordinated command.

**Tech Stack:** ASP.NET Core 8, EF Core/MySQL, xUnit, React 19, TypeScript, Vitest, Playwright, existing OpenAPI generation.

**Spec:** `docs/superpowers/specs/2026-10-18-mrx-production-vertical-slice-design.md`

## Global Constraints

- Chef reads/exports only the sanitized cooking projection and never participates in MRX inventory or decision mutations.
- Approved source changes never rewrite frozen batch facts, historical issues, movements, dispositions, or audit.
- Positive deltas enqueue Warehouse work automatically; negative deltas use physical return/reconciliation, never negative issues.
- Multi-customer preparation may aggregate display/export quantities but persists one issue per customer/batch/date.
- Any batch validation/concurrency failure aborts the entire coordinated issue command before durable writes.
- Supplier assignment comes from canonical persisted authority; missing/ambiguous classification remains explicit.
- No migration apply, seed/import, database mutation, mode switch, deploy, commit, or push without separate authorization.

## Review Focus

1. Auth payload permission tokens must match Frontend guards for every MRX actor.
2. Chef or Purchasing must not retrieve MRX issue/decision data through shared report or inventory endpoints.
3. An approved edit after first issue must create one delta and never rewrite or duplicate the original issue.
4. Multi-customer failure on the final selected batch must leave zero issues, movements, receipts, and group records for every batch.
5. Supplier ambiguity must remain visible and must not be resolved by arbitrary ordering.

---

### Task 1: Reconciliation Permission Vocabulary and API Boundaries

**Files:**
- Modify: `backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs`
- Modify: `backend/src/IPCManagement.Api/Program.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationActualsController.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationReportsController.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryIssuesController.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs`
- Modify: `frontend/src/routes/routeRegistry.ts`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: existing Backend authorization and InventoryIssue test owners
- Test: `frontend/src/__tests__/AppShell.test.tsx`, `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Produces:** emitted tokens `reconciliation.read`, `reconciliation.source.read`, `reconciliation.warehouse.read`, `reconciliation.kitchen.read`, `reconciliation.disposition`, `reconciliation.complete` with actor parity.

- [ ] Write failing Backend tests for emitted token mapping, MRX-only disposition categories, decision-only reports, Chef denial on MRX issue confirmation, DEFAULT confirmation preservation, and source-family-aware `CreatedAtAction`.
- [ ] Run focused tests and confirm each fails at the intended authorization/source-family boundary.
- [ ] Add tokens and narrow policies/controllers; make issue confirmation load and validate source family before mutation.
- [ ] Replace Frontend policy-name strings with emitted permission tokens and update DTO-grounded actor fixtures.
- [ ] Run focused Backend/Frontend tests, conformance, generated permission vocabulary, lint, dependency cruise, and build.

### Task 2: Paged Batch Summary Query

**Files:**
- Modify: `ReconciliationContracts.cs`, `ReconciliationBatchesController.cs`, `ReconciliationBatchService.cs`
- Modify: `frontend/src/api/mrxApi.ts`
- Test: `ReconciliationServiceTests.cs`, `ApiContracts.test.ts`

**Produces:** `GET /api/reconciliation/batches` filters by customer/week/status and returns canonical paging metadata without decision lines.

- [ ] Write failing tests for exact filters, deterministic ordering, paging, actor visibility, and no line/detail payload.
- [ ] Add `ReconciliationBatchPageQuery` and `ReconciliationBatchSummaryDto` using existing `PagedResponseDto<T>` conventions.
- [ ] Keep `GET /{id}`, `/warehouse-daily`, and `/kitchen-cooking` as separate projection owners.
- [ ] Migrate Frontend list consumers and verify deep-linked `batchId` remains stable.

### Task 3: Approved Source Revision and Delta Owner

**Files:**
- Modify existing MenuAmendment and MealQuantityPlan services/contracts/controllers.
- Create Reconciliation delta entity/configuration/service only if no existing persisted owner can represent the approved source-to-batch delta.
- Test: focused MenuAmendment, quantity-plan, Reconciliation, and persistence tests.

**Produces:** versioned approved source revision and one pending delta per affected `batch × serviceDate × dailyLine`.

- [ ] Write failing tests for Admin confirm/apply, specialist pending approval, rejection zero effects, before-issue replacement revision, after-issue positive delta, negative return-required delta, and affected-disposition invalidation.
- [ ] Extend impact preview to show affected batches/dates/ingredients before confirmation or approval.
- [ ] Apply approved revision and enqueue deltas inside one protected transaction with mode/version recheck.
- [ ] Keep old batch/issue facts immutable and block completion while unresolved deltas exist.

### Task 4: Warehouse Delta Queue and Supplemental Issue

**Files:**
- Add/read delta endpoints under existing Reconciliation/Inventory owners.
- Modify `frontend/src/api/mrxApi.ts` and Warehouse MRX workbenches.
- Test Backend application path and `Warehouse.test.tsx`.

**Produces:** Warehouse queue where a positive delta becomes a separately confirmed supplemental issue and negative delta links to return workflow.

- [ ] Test queue scope, exact daily identity, stale revision, duplicate confirmation, positive issue, negative return-required behavior, and resolved status.
- [ ] Expose pending deltas with business reason, old/new requirement, quantity difference, source actor, and approving actor.
- [ ] Confirm positive delta through canonical `InventoryIssueService`; never auto-create stock movement on approval.
- [ ] Refresh batch daily projection/history and invalidate only affected decision conclusions.

### Task 5: Multi-Customer Preparation and Atomic Separate Issues

**Files:**
- Create bounded request/result DTO and orchestration service under Inventory/Reconciliation.
- Add one controller command and Frontend selection workbench.
- Test relational all-or-nothing behavior and actor/mode boundaries.

**Produces:** one coordinated preparation command with optional `preparationGroupId`, separate issue/lineage per batch, and atomic failure.

- [ ] Test eligibility: same operational warehouse/date, issueable status, unresolved-source exclusion, distinct customer batches.
- [ ] Test aggregation projection by ingredient/unit while retaining per-batch allocation.
- [ ] Test a late stale/invalid batch causes zero durable writes for all selections.
- [ ] Persist separate issues using existing issue owner in one protected transaction; never merge issue lines across batches.
- [ ] Return per-batch issue IDs plus preparation group identity for UI/history.

### Task 6: Supplier-Classified Preparation Workbook

**Files:**
- Add Backend read/export projection under Reconciliation Warehouse scope.
- Reuse persisted supplier quotation/assignment authority; do not import Purchasing workflow records into MRX lineage.
- Add Frontend filters/export action and focused tests.

**Produces:** UTF-8/XLSX workbook with preparation summary and allocation detail sheets.

- [ ] Test customer/date/batch/supplier/initial-supplemental filters and actor/mode isolation.
- [ ] Test deterministic supplier resolution and explicit `Chưa xác định nhà cung cấp` for zero/multiple authoritative candidates.
- [ ] Test summary totals equal allocation detail totals while customer/batch identities remain separate.
- [ ] Generate both sheets from one projection and verify workbook cells, ordering, and no technical/security fields.

### Task 7: End-to-End Acceptance and Governance

- [ ] Run full Backend, Frontend, conformance, architecture, lint, build, and diff gates.
- [ ] In an authorized isolated runtime, execute Admin direct edit, specialist approval, positive/negative delta, single and multi-customer issue, supplier export, manager reconciliation, Chef cooking-only access, and reload.
- [ ] Verify persistence, stock ledger, issue isolation, audit actors, completion blockers, wrong actor/mode, stale version, and duplicate submit.
- [ ] Update conformance capabilities/surfaces and `.planning/WORK.md`; mark runtime status honestly.

## Execution Order with the Existing MRX Plan

1. Execute this plan Task 1 before existing MRX Task 4.
2. Existing MRX Tasks 4–6 deliver the basic Warehouse/Manager/Chef surfaces against repaired permissions.
3. Execute this plan Tasks 2–6 to add production-scale listing, source revisions, delta queue, multi-customer preparation, and supplier workbook.
4. Combine both plans in final runtime acceptance; neither plan alone authorizes a production-ready claim.
