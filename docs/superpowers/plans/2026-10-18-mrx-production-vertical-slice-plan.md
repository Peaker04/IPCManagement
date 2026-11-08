# MRX Production Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-operable `MATERIAL_RECONCILIATION` lifecycle through public UI/API from source preparation to completed batch, including Warehouse and Chef handoffs.

**Architecture:** Keep the existing top-level routes, but add explicit MRX leaves whose query and command owners are separate from DEFAULT workflows. Use `batchId` as the URL-owned work object, Backend projections as state/readiness authority, and Backend optimistic concurrency for every write; never infer lifecycle or stock truth in Frontend.

**Tech Stack:** ASP.NET Core 8, EF Core/MySQL, xUnit, React 19, TypeScript, React Router, Vitest/Testing Library, Playwright, existing IPC UI/workbench primitives.

**Spec:** `docs/superpowers/specs/2026-10-18-mrx-production-vertical-slice-design.md`

## Global Constraints

- `DEFAULT != MATERIAL_RECONCILIATION`; never share workflow commands, queries, lineage, or audit records.
- Use only public production seams; no direct database writes, fake stock, sample reset, or fabricated batch evidence.
- No migration apply, seed/import, production mode switch, deployment, package installation, or credential use without separate authorization.
- Reuse existing primitives and semantic tokens; `frontend/src/styles/index.css` remains the only styling authority.
- Every write carries the Backend-required command identity and `expectedVersion`; a stale or duplicate request must fail safely or return its canonical prior result.
- Actor ownership is Coordinator → source/lifecycle, Warehouse → issue transactions, Manager → disposition/completion, Chef → cooking read/export.
- Preserve the unrelated uncommitted UnitsController and Frontend conformance changes already present in the checkout.
- No commit or push unless the Owner separately authorizes it.
- Before changing tests, load `test-audit` and `ipc-test-audit`; before any `.tsx`/`.css` edit, emit the mandatory Scoped Pre-Code UI Gate Block.

## Review Focus

1. Two batches for the same customer/week must never make reload select a different batch; batch detail and mutations are ID-addressed.
2. A stale tab or double submit must not duplicate reconciliation batches, inventory issues, stock movements, dispositions, or audit entries.
3. A legacy batch without daily lineage remains readable but cannot open initial/supplemental daily writes.
4. Wrong actor or wrong operational mode must be rejected before durable writes even when a user deep-links or crafts an API request.
5. Initial issue omission/duplication, over-issue without Vietnamese reason, or supplemental ingredient outside the frozen batch must fail atomically.

---

## File Structure

### Existing owners to modify

- `backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/*.cs` — MRX endpoint policy/mode boundaries.
- `backend/src/IPCManagement.Api/Features/Reconciliation/Services/*.cs` — lifecycle, quantity projection, disposition, completion, and stock transaction owners.
- `backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs` — request/response contracts only where an existing endpoint lacks a required production field.
- `frontend/src/routes/routeRegistry.ts` — actor/mode-qualified MRX leaves.
- `frontend/src/routes/workbenchSurfaceRegistry.ts` — loading geometry for each delivered MRX work object.
- `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx` — compose the Coordinator MRX workbench without importing DEFAULT demand owners.
- `frontend/src/features/warehouse/WarehousePage.tsx` — compose Warehouse MRX workbenches without reusing DEFAULT request workflow.
- `frontend/src/features/chef/ChefDashboardPage.tsx` — compose Chef MRX cooking surface.
- `frontend/src/features/reconciliation/ReconciliationPage.tsx` — batch-ID manager review/disposition/completion.
- `docs/conformance-contracts.json` — capability/surface/readiness evidence after each reachable slice.

### Focused Frontend owners to create

- `frontend/src/api/mrxApi.ts` — exact MRX DTO mappings and lifecycle commands.
- `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx` — source preview/commit/create/READY/transfer.
- `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx` — date-scoped initial issue.
- `frontend/src/features/warehouse/MrxSupplementalIssueWorkbench.tsx` — supplemental issue/history.
- `frontend/src/features/chef/MrxCookingWorkbench.tsx` — cooking preview/export.
- `frontend/src/features/reconciliation/ReconciliationDispositionDrawer.tsx` — daily-line decision editor.

Do not create a generic workflow engine, second query store, duplicate grid/modal, or test-only API wrapper.

---

### Task 1: Prove Backend Production Readiness Boundaries

**Files:**
- Modify only if a failing contract is found: `backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/*.cs`
- Modify only if a failing invariant is found: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/*.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationDailyLineagePolicyTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationDuplicateHandlerTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationKitchenExportTests.cs`

**Interfaces:**
- Consumes: canonical MRX lifecycle and daily-line contract in `docs/domain/material-reconciliation.md`.
- Produces: source-backed verdict for each command: mode gate, policy, transaction owner, version check, idempotency, stock movement, lineage, and audit behavior.

- [ ] **Step 1: Add/extend table-driven Backend tests for the five Review Focus failures**

Assert wrong mode/actor has no durable write; duplicate command creates one canonical aggregate; legacy missing lineage rejects daily issue; invalid initial/supplemental lines leave issue/stock/audit counts unchanged; kitchen projection excludes restricted fields.

- [ ] **Step 2: Run the focused tests and record genuine failures**

Run:

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~Reconciliation" --no-restore
```

Expected: existing tests pass; every new assertion either passes against the current owner or fails for one precise missing invariant. Do not change production code for a test-fixture mismatch.

- [ ] **Step 3: Repair only proven owner-level gaps**

Keep version/mode rechecks and issue/stock/audit writes inside the existing protected transaction. Stock provisioning may use only canonical `StockLedgerService.AddStockAsync`, `ADJUSTMENT`, reason/note `MRX provision`, and batch lineage; do not create a movement enum or direct stock mutation.

- [ ] **Step 4: Re-run focused Backend tests and conformance**

Run the focused command above, then:

```bash
node --test scripts/check-conformance-contracts.test.mjs
node scripts/check-conformance-contracts.mjs
```

Expected: PASS; no capability is promoted based only on controller existence.

- [ ] **Step 5: Stop if any critical command remains transactionally unsafe**

Record `BLOCKED` in `.planning/WORK.md` with exact endpoint/service/test evidence. Do not expose its Frontend action.

---

### Task 2: Establish Canonical MRX Navigation and API Contracts

**Files:**
- Create: `frontend/src/api/mrxApi.ts`
- Modify: `frontend/src/routes/routeRegistry.ts`
- Modify: `frontend/src/routes/workbenchSurfaceRegistry.ts`
- Modify: `frontend/src/components/workbench/AppShell.tsx` only if existing injected eligibility cannot render the new leaves
- Test: `frontend/src/__tests__/ApiContracts.test.ts`
- Test: `frontend/src/__tests__/AppShell.test.tsx`
- Test: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: generated OpenAPI DTO field names and Task 1 readiness verdicts.
- Produces: typed `mrxApi` methods and canonical URLs for Coordinator, Warehouse, Manager, and Chef workbenches.

- [ ] **Step 1: Write failing navigation tests**

Assert MRX Coordinator sees `mrx-batch`; Warehouse sees `mrx-daily` and `mrx-issues`; Manager sees reconciliation; Chef sees `mrx-cooking`; Purchasing sees none; DEFAULT sees no MRX leaf.

- [ ] **Step 2: Write failing network-boundary tests for `mrxApi`**

Cover exact paths/bodies for preview, commit, create, ready, transfer, batch detail, warehouse daily, initial issue, supplemental issue/history, disposition categories, daily disposition, complete, and cooking read/export. Use C# DTO-shaped fixtures; do not invent optional defaults.

- [ ] **Step 3: Run tests to verify RED**

```bash
cd frontend && npm test -- --run src/__tests__/AppShell.test.tsx src/__tests__/ApiContracts.test.ts
```

Expected: FAIL because MRX leaves and `mrxApi` do not exist.

- [ ] **Step 4: Add the smallest typed API and route metadata**

Each write signature must include its real request DTO, command identity where required, and expected version. Keep download transport in the same API owner; do not expose raw endpoint assembly to pages.

- [ ] **Step 5: Run focused tests, lint, and dependency cruise**

```bash
cd frontend && npm test -- --run src/__tests__/AppShell.test.tsx src/__tests__/ApiContracts.test.ts
npm run lint:fe
npm run depcruise:fe
```

Expected: PASS with no shared/workbench → routes reverse dependency.

---

### Task 3: Deliver Coordinator Batch Preparation and Transfer

**Files:**
- Create: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Modify: `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx`
- Modify: `docs/conformance-contracts.json`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: add focused cases to `frontend/src/__tests__/ApiContracts.test.ts`

**Interfaces:**
- Consumes: `mrxApi` source/preview/commit/create/ready/transfer methods from Task 2.
- Produces: a transferred `batchId` and navigation to `/warehouse?view=mrx-daily&batchId=<id>&date=<first-applicable-date>`.

- [ ] **Step 1: Write failing Coordinator workflow tests**

Cover source loading, missing-BOM diagnostic, preview detail, stale preview disabling commit, canonical commit/create, READY, transfer, 409 retained-data recovery, and hidden actions for wrong actor/mode.

- [ ] **Step 2: Run the focused test to verify RED**

```bash
cd frontend && npm test -- --run src/__tests__/WeeklyMenu.test.tsx
```

- [ ] **Step 3: Implement the MRX batch workbench**

Use existing `WorkspaceHeader`, `TelemetrySubbar`, `StateBoundary`, `DataGrid`, `Button`, `Badge`, `Num`, `IdentifierText`, `Modal`, and `ActionGuard`. Render one lifecycle primary action at a time; keep missing dishes/BOMs visible and direct recovery only to canonical Admin/BOM authority.

- [ ] **Step 4: Make `batchId` the handoff identity**

After transfer, navigate using the Backend-returned batch ID and applicable date. Never hand off customer/date alone and never open DEFAULT material demand or Purchasing.

- [ ] **Step 5: Verify component, lint, build, and conformance**

```bash
cd frontend && npm test -- --run src/__tests__/WeeklyMenu.test.tsx src/__tests__/ApiContracts.test.ts
npm run lint:fe
npm run build:fe
cd .. && node --test scripts/check-conformance-contracts.test.mjs && node scripts/check-conformance-contracts.mjs
```

Expected: Coordinator can produce `TRANSFERRED` through mocked public contracts; runtime persistence remains unclaimed until Task 7.

---

### Task 4: Deliver Warehouse Daily and Supplemental Issue Workbenches

**Files:**
- Create: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Create: `frontend/src/features/warehouse/MrxSupplementalIssueWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/WarehousePage.tsx`
- Modify: `docs/conformance-contracts.json`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`
- Test: `frontend/src/__tests__/ApiContracts.test.ts`

**Interfaces:**
- Consumes: `batchId`, `date`, warehouse daily projection, initial/supplemental commands from Task 2.
- Produces: ledger-backed `IN_PROGRESS` batch and append-only issue history for Manager review.

- [ ] **Step 1: Write failing daily-issue tests**

Assert weekly summary is read-only; concrete date displays every positive frozen daily line once; requested quantity cannot be edited; fill-all changes draft only; normalized overage requires Vietnamese reason; omission/duplicate/outside line cannot submit; legacy missing lineage shows neutral unavailable state.

- [ ] **Step 2: Write failing supplemental tests**

Assert only frozen ingredients can be selected, positive quantity and reason are required, failed dish projection still permits direct frozen-ingredient entry, repeated supplemental issues remain separate history records, and completed batches are read-only.

- [ ] **Step 3: Run focused tests to verify RED**

```bash
cd frontend && npm test -- --run src/__tests__/Warehouse.test.tsx src/__tests__/ApiContracts.test.ts
```

- [ ] **Step 4: Implement distinct MRX Warehouse owners**

Do not branch the DEFAULT approved-request mutation into MRX. Preserve Backend quantity strings/numbers to six-decimal semantics through existing `Num`; send only authoritative IDs and entered quantities/reasons.

- [ ] **Step 5: Verify focused behavior and mode isolation**

Run focused tests, lint, build, dependency cruise, and conformance. Add assertions that MRX mount issues no DEFAULT request/purchasing API calls and DEFAULT mount issues no MRX calls.

---

### Task 5: Deliver Manager Disposition and Completion

**Files:**
- Create: `frontend/src/features/reconciliation/ReconciliationDispositionDrawer.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/api/reconciliationApi.ts` to delegate/remove superseded list-and-match behavior without maintaining two owners
- Modify: `docs/conformance-contracts.json`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`
- Test: `frontend/src/__tests__/ApiContracts.test.ts`

**Interfaces:**
- Consumes: exact `batchId`, optional `date`, batch daily review, disposition categories, daily disposition command, completion command.
- Produces: versioned daily dispositions and Backend-authorized `COMPLETED` batch.

- [ ] **Step 1: Write failing stable-identity tests**

With two same-customer/week batches in fixtures, assert URL `batchId` selects the exact batch and reload does not change it. Assert row/detail identity is `dailyLineId`.

- [ ] **Step 2: Write failing disposition/completion tests**

Cover category load, Vietnamese reason, expected disposition version, 409 retention/reload, exact line update, all-date readiness, under-issued completion denial, successful complete, and completed read-only reload.

- [ ] **Step 3: Run focused tests to verify RED**

```bash
cd frontend && npm test -- --run src/__tests__/Reconciliation.test.tsx src/__tests__/ApiContracts.test.ts
```

- [ ] **Step 4: Replace client-side list-and-match with batch-ID reads**

List is only a selector. Detail and every mutation use the selected batch ID. Preserve known rows during refresh and stale-write recovery; do not compute `WEEK_COMPLETE` in Frontend.

- [ ] **Step 5: Implement the daily disposition drawer**

Use the existing detail/drawer pattern and Modal focus owner. Put business facts first; keep UUID/version/fingerprint in closed technical disclosure if displayed at all.

- [ ] **Step 6: Verify tests, accessibility semantics, lint, build, and conformance**

Expected: Manager can complete exact or validly-disposed batches only; Warehouse/Coordinator actors have no manager mutations.

---

### Task 6: Deliver Chef Cooking Read and Export

**Files:**
- Create: `frontend/src/features/chef/MrxCookingWorkbench.tsx`
- Modify: `frontend/src/features/chef/ChefDashboardPage.tsx`
- Modify: `docs/conformance-contracts.json`
- Test: `frontend/src/__tests__/Chef.test.tsx`
- Test: `frontend/src/__tests__/ApiContracts.test.ts`

**Interfaces:**
- Consumes: exact `batchId`, cooking projection, CSV/XLSX download methods.
- Produces: read-only cooking workbench with exports from frozen facts.

- [ ] **Step 1: Write failing actor/scope tests**

Assert Chef sees service date, shift, dish, servings, ingredient, BOM-per-serving, and total quantity; does not see issue quantity, variance, disposition, price, purchasing, technical IDs, or manager/warehouse actions.

- [ ] **Step 2: Write failing export tests**

Assert CSV/XLSX actions call the exact batch-scoped endpoints, handle server failure visibly, and never fabricate a download success.

- [ ] **Step 3: Implement the read-only workbench with existing primitives**

Use Backend ordering/quantities. Missing or ambiguous frozen contributor facts render an error/partial state rather than a guessed cooking sheet.

- [ ] **Step 4: Verify focused tests, lint, build, and conformance**

Promote `RECON.KITCHEN_REPORT.READ` only after the authorized surface and actor guard are present.

---

### Task 7: Full Verification and Production Acceptance

**Files:**
- Modify: `frontend/tests/browser/` with one MRX lifecycle spec at the strongest public boundary
- Modify: `.planning/WORK.md`
- Modify if evidence changes status: `.planning/audit/route-screen-coverage.md`, `.planning/audit/requirements-traceability.md`, `.planning/audit/defect-register.md`
- Modify: `docs/conformance-contracts.json`

**Interfaces:**
- Consumes: completed Tasks 1–6 and an Owner-authorized isolated runtime/fixture/credential scope.
- Produces: PASS/FAIL/NEEDS_EVIDENCE/BLOCKED verdict for every production acceptance criterion.

- [ ] **Step 1: Run all static and automated gates**

```bash
dotnet test backend/tests/IPCManagement.Application.Tests/IPCManagement.Application.Tests.csproj --no-restore
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore
cd frontend && npm test -- --run
npm run lint:fe
npm run depcruise:fe
npm run build:fe
cd .. && node --test scripts/check-conformance-contracts.test.mjs && node scripts/check-conformance-contracts.mjs
git diff --check
```

Expected: PASS except explicitly inherited, source-proven failures recorded separately; do not relabel inherited failures as MRX PASS.

- [ ] **Step 2: Execute the public lifecycle in an isolated authorized runtime**

Assert mode before each actor sequence. Use public source/import, preview, commit, create, READY, transfer, initial issue, supplemental issue, disposition, complete, reload, and cooking export paths. Do not switch mode mid-verdict.

- [ ] **Step 3: Verify persistence and negative scenarios**

Correlate request IDs/command IDs, batch/version, daily line IDs, issue lines, stock movements, dispositions, lifecycle transitions, and audit actor. Exercise wrong actor/mode, stale version, duplicate submit, missing BOM, legacy lineage, invalid initial issue, and invalid supplemental ingredient.

- [ ] **Step 4: Run mandatory review gates**

Report each as:

`Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact`

Use `ipc-test-audit`, `ipc-ui-review`, and `ipc-code-review`. Browser review includes keyboard/focus, 200% zoom, tablet overflow, loading/refresh, empty/error/403/409/legacy states, and single-primary-action hierarchy.

- [ ] **Step 5: Close the ledger honestly**

Update `.planning/WORK.md` and capability evidence. Mark production readiness PASS only when the public lifecycle and persistence evidence pass. Otherwise record exact `NEEDS_EVIDENCE` or `BLOCKED` items and return lifecycle to `IDLE` without a success claim.

---

## Self-Review Result

- **Spec coverage:** source, batch lifecycle, Warehouse initial/supplemental issue, Manager disposition/completion, Chef export, actor/mode isolation, concurrency, persistence, and runtime evidence each have one owning task.
- **Deliberate exclusions:** dashboards, new analytics/report framework, DEFAULT workflow redesign, migration apply, deployment, and production mode switch.
- **Type consistency:** every downstream surface consumes `batchId`; daily mutations consume `dailyLineId`; every lifecycle write consumes Backend-required version/command identity.
- **Review Focus ownership:** stable identity Task 5; duplicate/stale Task 1 plus Tasks 3–5; legacy lineage Task 4; actor/mode Tasks 1–6; atomic issue validation Tasks 1 and 4.
- **Execution boundary:** Task 7 requires separate runtime/credential/mutation authorization; Tasks 1–6 can proceed at source and automated-test boundaries without production operations.
