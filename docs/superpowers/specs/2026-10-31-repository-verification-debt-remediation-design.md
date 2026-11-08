# Repository Verification Debt Remediation Design

**Date:** 2026-10-31  
**Status:** Proposed — awaiting Owner approval  
**Scope owner:** `.planning/WORK.md`

## Intent

Make the repository verification path truthfully green after the MRX direct-source and four-station work. Resolve the changed-scope architecture regression, every currently reported Frontend ESLint diagnostic, and all three dependency-cruiser violations without weakening rules, adding allowlists, changing business behavior, or fabricating browser evidence.

## Goals

1. Restore `check:architecture-growth` by moving Warehouse revision read/projection out of `ReconciliationBatchService` while preserving `GetWarehouseDailyAsync` output and provider compatibility.
2. Reduce full Frontend ESLint from 94 errors / 24 warnings to zero.
3. Reduce dependency-cruiser from three violations to zero and shrink, never expand, its known baseline.
4. Preserve MRX API, DTO, RBAC, audit lineage, transaction behavior, database schema and `DOM-MODE-1`.
5. Keep all existing behavior tests green and rerun the permanent G6 sandbox flow.
6. Make one bounded actual-Chrome 200% evidence attempt; certify it only with real Chrome zoom/DPR evidence.

## Non-goals and anti-goals

- No feature redesign, new business capability, route expansion or API/schema change.
- No dependency installation, rule disablement, architecture-baseline increase, exemption/allowlist padding, fake API fallback or test-only production seam.
- No broad file renaming beyond moves required to restore existing dependency ownership.
- No mutation of `ipcmanagement`; browser/database mutation remains confined to `ipc_mrx_e2e_sandbox`.
- No promise that Windows foreground isolation can be defeated. A blocked real-zoom attempt remains BLOCKED rather than being relabeled with emulation.
- No commit or push without separate Owner authorization.

## Current evidence and root causes

### Architecture growth

`ReconciliationBatchService` grew from the tracked 715-line baseline to 770 lines. The MRX diff adds 67 lines that query source revisions/deltas/users, map the latest revision by service date and probe SQLite table availability. This is a coherent Warehouse read projection, not batch lifecycle coordination, and is the only changed-scope strict-growth failure.

### Dependency boundaries

1. `MrxBatchPreviewSection` and `MrxShiftDishesModal` form a cycle only because the modal imports two data types from the rendering component.
2. `MrxBatchWorkbench` imports `features/admin/DishBomBatchImportModal`, violating feature-to-feature direction.
3. Shared `components/workbench/MrxBatchDishesModal` imports `features/admin/DishBomEditorModal`, violating shared-to-feature direction.

The two BOM modals are cross-feature composites already backed by shared API modules. Their current `features/admin` location is narrower than their real callers. The preview cycle has no runtime dependency and needs only a neutral sibling type owner.

### ESLint

Fresh JSON output contains 118 diagnostics across 51 files:

- 27 `no-explicit-any`
- 19 `set-state-in-effect`
- 19 `exhaustive-deps`
- 14 `no-empty`
- 7 ref access during render
- 7 `no-console`
- 6 unused symbols
- 5 swallowed query errors
- 5 Playwright fixture calls misidentified as React hooks
- 3 Fast Refresh mixed-export findings
- 2 immutability and 2 static-component findings
- 1 purity and 1 empty-pattern finding

The causes are code-local: untyped fixtures, synchronous state/reset/fetch ownership inside effects, mutable refs written during render, silent storage catches, debug logging, unhandled query error presentation, and Playwright fixture callback parameter naming. They do not require relaxing ESLint.

## Approaches considered

### A. Root-owner sequential repair — selected

Move one coherent responsibility at a time, use the failing architecture/lint/dependency gates as RED, preserve behavior with existing strongest-boundary tests, and run the relevant gate after each group.

**Trade-off:** more verification cycles, but small attributable diffs and lower regression risk in the current dirty workspace.

### B. One broad React/architecture rewrite

Rewrite hooks and module layout together, then verify once. This is faster only if every assumption is right; it produces an unauditable diff and couples unrelated failures. Rejected.

### C. Baseline/rule suppression

Raise growth baselines, add dependency allowlists, or disable lint rules. This hides debt and violates project anti-padding constraints. Rejected.

## Chosen design

### 1. Warehouse source-revision read owner

Create `Features/Reconciliation/Services/ReconciliationWarehouseRevisionQuery.cs` with one production contract:

```csharp
internal sealed class ReconciliationWarehouseRevisionQuery(IpcManagementContext context)
{
    Task<IReadOnlyDictionary<DateOnly, ReconciliationWarehouseRevisionStamp>>
        GetLatestByDateAsync(byte[] batchId, CancellationToken token);
}

internal sealed record ReconciliationWarehouseRevisionStamp(
    DateTime AppliedAt,
    string? AppliedByName,
    string? AppliedByRole);
```

It owns:

- Provider-bounded source-revision table availability probing.
- Applied revision/delta/user reads for InMemory, SQLite and relational providers.
- Latest-per-service-date ordering by `AppliedAt`, then `RevisionNumber`.
- Actor display-name projection.

`ReconciliationBatchService.GetWarehouseDailyAsync` constructs/uses this internal query and only maps returned stamps into the existing DTO. No DI/public API is added because there is one real caller and no independent lifecycle. This removes the 67-line responsibility from the oversized service without creating a speculative interface.

Existing `ReconciliationServiceTests.Warehouse_daily_exposes_last_revision_for_changed_day` remains the behavioral owner. The architecture-growth gate is the RED regression owner for the extraction itself.

### 2. Dependency ownership repair

- Create `features/weekly-menu/mrxBatchPreviewTypes.ts` and move `PlanSummaryItem` / `ShiftDishDetail` there. Both preview and modal import the sibling types, breaking the cycle without a runtime wrapper.
- Move `DishBomEditorModal.tsx` and `DishBomBatchImportModal.tsx` from `features/admin/` to the existing shared composite owner `components/workbench/`. Update Admin, Weekly Menu, `MrxBatchDishesModal`, and tests to use the shared composite owners. Do not leave compatibility re-export wrappers: all local callers are migrated in the same change.
- Keep their network behavior in existing `bomApi`, `adminApi` and `weeklyMenuApi`; no new API owner or duplicated component is introduced.

Existing BOM modal and Weekly Menu tests own behavior. `depcruise:fe` is the RED/GREEN boundary for module direction.

### 3. ESLint repair batches

#### 3.1 Mechanical type and dead-code cleanup

Replace `any` with generated/API-shaped types, `unknown`, `MockInstance` or narrow structural test types. Remove truly unused symbols and empty destructuring. Rename Playwright fixture callback parameter `use` to `fixtureUse`, so React Hooks lint no longer misclassifies non-React code.

#### 3.2 Silent catches and logging

- Empty storage/teardown catches receive a concise reason comment when best-effort failure is intentional; otherwise errors are propagated to the existing UI/test owner.
- Remove debug `console` calls where no product signal consumes them. Preserve required failure behavior through existing state/error channels rather than adding a logger abstraction.

#### 3.3 Query error ownership

For the five `ipc/no-swallowed-query-error` findings, retain each query result’s `isError/error` and render the existing error boundary/banner at the operational owner. Do not satisfy the rule by destructuring and ignoring the value.

#### 3.4 Effects, refs and purity

Classify before editing:

- **Initial remote load:** keep effects as external synchronization, but move synchronous loading/reset work to initialization or user-event owners; state updates occur in resolved/rejected async callbacks with cancellation guards.
- **Prop-driven reset:** use an existing modal key/remount boundary or derive initial state from the active identity rather than synchronously resetting multiple states in an effect.
- **Cache hydration:** initialize state from cache in `useState` or key state by query identity; effects perform only network synchronization.
- **Latest callback/value refs:** update refs in an effect or replace with React 19 `useEffectEvent` only where already supported and behavior-preserving; never mutate refs during render.
- **Filter/page reset:** perform resets in the same event that changes the filter, or derive the effective page from scope identity.
- **Time purity:** defer `Date.now()` to an effect/event callback rather than render-time initialization.

No `setTimeout`, microtask or wrapper is added merely to evade lint.

#### 3.5 Stable module/component exports

Move non-component exports or hooks out of `button.tsx`, `WorkspaceFrame.tsx`, and `workspaceScopeContext.tsx` only where Fast Refresh requires it. Move render-created components in `StateBoundary` to stable top-level owners. Preserve public imports by migrating all real callers; do not add test-only barrels.

Each batch reruns its affected existing tests before full lint. Tests are added only where a refactor changes a currently unowned observable state/error transition.

### 4. Verification and evidence

Order:

1. Focused behavioral tests for each changed owner.
2. `check:architecture-growth` and architecture-growth tests.
3. Full Frontend ESLint and dependency-cruiser until both report zero.
4. Backend Release build and full backend solution.
5. Full Frontend unit and production build.
6. `npm run verify` as the aggregate acceptance gate.
7. Permanent headed G6 against `ipc_mrx_e2e_sandbox`; verify residual customers, ports and schema cleanup.
8. One dedicated-profile actual Chrome 200% attempt using OS/browser zoom, checking physical/effective viewport and `devicePixelRatio`. Remove temporary instrumentation afterward. If Windows foreground isolation still prevents zoom, report `BLOCKED`; do not use device emulation as substitute.
9. Mandatory `ipc-test-audit`, `ipc-code-review`, and `ipc-ui-review` for affected scopes; return `.planning/WORK.md` to `IDLE` only when all code gates pass. The external evidence limitation may remain explicitly `NEEDS_EVIDENCE` without falsifying code completion.

## Risks and safeguards

- **React effect fixes can alter loading or stale-data behavior:** preserve existing rendered owner tests and add only missing transition assertions before code changes.
- **Moving BOM composites can break imports or test mocks:** migrate all `rg`-identified callers together; TypeScript build and dependency-cruiser catch missed edges.
- **Provider compatibility can regress during extraction:** retain InMemory/SQLite/relational branches byte-for-byte in the new query and run existing backend provider-bounded tests.
- **Global cleanup can expand indefinitely:** diagnostics are frozen at the fresh 118-item inventory; new findings caused by a correction belong to that correction, while unrelated feature polish remains excluded.
- **Dirty workspace attribution:** do not stage, reset, restore or delete inherited changes. Every edit is surgical and recorded in `.planning/WORK.md`.

## Acceptance

- `check:architecture-growth` exits 0 with no worsened MRX service debt.
- `npm run lint:fe` exits 0 with zero errors and zero warnings.
- `npm run depcruise:fe` exits 0 with zero current violations; baseline is not expanded.
- Backend and Frontend full tests/builds pass.
- `npm run verify` exits 0.
- Permanent G6 passes and sandbox/process hygiene is zero.
- No business/API/database/RBAC behavior changes and no weakened guardrail.
- Actual zoom result is either real DPR/viewport PASS evidence or an explicit environment BLOCKED result.
