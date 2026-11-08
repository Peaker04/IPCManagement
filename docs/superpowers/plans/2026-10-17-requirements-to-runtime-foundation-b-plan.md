# Requirements-to-Runtime Foundation B Implementation Plan

> **Execution:** Use `superpowers:executing-plans` for native inline execution. Apply `test-driven-development`, `ipc-test-audit`, `ipc-codebase-design`, `ipc-ui-review`, and `ipc-code-review` at their required gates. Do not delegate unless the Owner separately authorizes delegation.

**Goal:** Replace generic route loading and role-only mutation exposure with one route-resolved loading/state contract and fail-closed action eligibility for the three currently rendered Backend mutation surfaces, without adding business actions or changing Backend semantics.

**Architecture:** Keep `routeRegistry.ts` as the route authorization owner and `docs/conformance-contracts.json` as the requirements-to-runtime inventory. Add a small Frontend workbench-surface registry that projects only runtime presentation fields (`route`, optional `view`, skeleton geometry) and a resolver consumed by the application Suspense fallback. Extend the existing `ActionGuard` rather than adding a parallel guard; current mutation call sites must provide exact capability ID, allowed operational mode, and permission/role evidence available from the reconciled contract. Contract tests compare the runtime projection to the conformance inventory so the duplicate projection cannot silently drift.

**Scope:** Foundation B shared owners plus the existing Approval decision, Reconciliation completion, and System Operation mode-change surfaces. No Catalog, Coordination, Purchasing, Warehouse, Chef, Report, SampleData, migration, database, or new write workflow is introduced.

**Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

## Safety and completion rules

- Preserve `DEFAULT != MATERIAL_RECONCILIATION`; a mode mismatch must hide or explain an action and must never issue a request.
- Do not infer permission tokens. If the Backend policy/capability record does not provide an exact permission token, retain the reconciled role/policy boundary and record the remaining gap; do not classify it `READY`.
- Skeletons may represent geometry only. They must not contain business labels, counts, identifiers, dates, statuses, rows, or success claims.
- Loading must resolve into data or one explicit state (`empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`).
- Preserve loaded read context on mutation 403/409.
- No package install, destructive Git operation, commit, push, deployment, seed/import, migration, schema/data mutation, or live Backend mutation.
- `.planning/WORK.md` remains the only live status owner.
- Browser, persistence/reload, actor/mode and responsive geometry remain `NEEDS_EVIDENCE` until an isolated authorized runtime exists.

## File ownership map

| File | Responsibility |
|---|---|
| `frontend/src/routes/workbenchSurfaceRegistry.ts` | Runtime route/view → skeleton geometry projection and resolver. No business data. |
| `frontend/src/components/workbench/WorkbenchSkeleton.tsx` | Single geometry-only skeleton primitive for table, matrix, split and form work objects. |
| `frontend/src/components/workbench/StateBoundary.tsx` | Delegates loading rendering to `WorkbenchSkeleton`; owns six-state precedence. |
| `frontend/src/components/ui/action-guard.tsx` | Existing action eligibility owner; adds capability/mode-aware fail-closed behavior and accessible reason. |
| `frontend/src/App.tsx` | Uses route-resolved skeleton for lazy-route Suspense; no generic fallback rows. |
| `frontend/src/features/approvals/ApprovalPage.tsx` | Existing `APPR.DECISION` action call sites only. |
| `frontend/src/features/reconciliation/ReconciliationPage.tsx` | Existing `RECON.BATCH.LIFECYCLE` completion action only. |
| `frontend/src/features/admin/AdvancedSettingsPage.tsx` | Existing `SYS.MODE.WRITE` transition only. |
| `frontend/src/__tests__/Primitives.test.tsx` | State/skeleton and ActionGuard behavior owner. |
| `frontend/src/__tests__/AppShell.test.tsx` or a focused route-loading test | Route/view resolver and lazy fallback behavior. |
| `scripts/check-conformance-contracts.test.mjs` | Runtime-projection parity with conformance surfaces and action IDs. |
| `docs/conformance-contracts.json` | Replaces generic geometry text with bounded, source-backed geometry; records unresolved action gaps. |
| `docs/table-contracts.json` | Add only table contracts proven by current rendered columns; otherwise retain explicit gaps. |
| `.planning/WORK.md` | Scoped UI gate, RED/GREEN evidence, decisions, residual risks and closure. |

---

### Task 1: Lock runtime surface and geometry interfaces

**Files:**
- Create: `frontend/src/routes/workbenchSurfaceRegistry.ts`
- Modify: `scripts/check-conformance-contracts.test.mjs`
- Modify: `docs/conformance-contracts.json`

- [ ] Add a repository test that requires every N6 destination to resolve to exactly one runtime surface and requires each runtime surface ID/route/view/kind to match its conformance surface.
- [ ] Add a test that rejects business-looking skeleton fields (`rows`, `values`, `counts`, `status`, `date`, `identifier`) and duplicate route/view keys.
- [ ] Run `npm run test:conformance-contracts`; verify RED because no runtime registry exists.
- [ ] Define the smallest runtime types:

```ts
export type SkeletonKind = 'table' | 'matrix' | 'split' | 'form';
export interface SkeletonGeometry {
  kind: SkeletonKind;
  columns?: number;
  rows?: number; // geometry count only; never row content
  splitRatio?: '60/40' | '65/35';
  toolbar?: boolean;
}
export interface WorkbenchSurfaceDefinition {
  id: string;
  route: string;
  view?: string;
  geometry: SkeletonGeometry;
}
export function resolveWorkbenchSurface(pathname: string, search: string): WorkbenchSurfaceDefinition;
```

- [ ] Reconcile each of the 23 current surface geometry strings to explicit structure supported by the rendered page. Do not fabricate missing table contracts; keep `TABLE_CONTRACT_GAP` where column grain is not yet canonical.
- [ ] Run conformance tests/checker; expected GREEN.

**Completion:** Every current route/view has one deterministic, geometry-only runtime surface; no production rendering changes yet.

---

### Task 2: Build the shared geometry-only skeleton

**Files:**
- Create: `frontend/src/components/workbench/WorkbenchSkeleton.tsx`
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Modify: `frontend/src/__tests__/Primitives.test.tsx`

- [ ] Add rendered tests for table, matrix and split geometry, accessible busy state, stable toolbar/grid regions, and absence of business text/data.
- [ ] Add a precedence regression: loading renders only the skeleton; after loading, a 403/409/error/empty/partial state is selected without retaining skeleton DOM.
- [ ] Run the focused primitive tests; verify RED against the generic hard-coded skeleton.
- [ ] Implement `WorkbenchSkeleton` with existing tokens/classes only. It accepts `SkeletonGeometry`, renders `aria-busy="true"`, uses hidden/presentational geometry, and adds no new styling token or dependency.
- [ ] Replace `StateBoundary.loadingVariant` internals with the shared component while retaining `customSkeleton` only for an owner-proven exceptional geometry. Do not add a second state boundary.
- [ ] Run focused tests, lint and dependency cruise; expected GREEN.

**Completion:** StateBoundary loading is geometry-driven and contains no synthetic business evidence.

---

### Task 3: Resolve lazy-route loading from URL-owned surface state

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/routes/workbenchSurfaceRegistry.ts`
- Modify/Create: focused application loading test under `frontend/src/__tests__/`

- [ ] Add tests for `/weekly-menu?view=demand`, `/warehouse?view=receipts`, `/settings/advanced?view=mode`, and unknown/missing `view` fallback. Assert the resolved work-object geometry, not CSS snapshots.
- [ ] Verify RED because `WorkbenchLoadingFallback` is currently a generic table skeleton.
- [ ] Make the fallback read `useLocation()` and `resolveWorkbenchSurface(location.pathname, location.search)`, then render `WorkbenchSkeleton`.
- [ ] Unknown view keys must fail closed to the route's canonical/default surface, not a different route or invented view.
- [ ] Preserve lazy route boundaries and existing N6 URL ownership.
- [ ] Run focused application tests, build and dependency cruise; expected GREEN.

**Completion:** Suspense loading preserves route/view geometry across reload and lazy chunk boundaries.

---

### Task 4: Make existing mutation exposure capability- and mode-aware

**Files:**
- Modify: `frontend/src/components/ui/action-guard.tsx`
- Modify: `frontend/src/__tests__/Primitives.test.tsx`
- Modify: `frontend/src/features/approvals/ApprovalPage.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/admin/AdvancedSettingsPage.tsx`
- Modify: relevant focused page tests

- [ ] Add ActionGuard tests for allowed role/permission/mode, missing permission, wrong mode, unauthenticated actor, and accessible disabled explanation. Verify no child click/request occurs while blocked.
- [ ] Add page-level RED tests proving:
  - `APPR.DECISION` is not actionable outside its reconciled actor/policy boundary;
  - `RECON.BATCH.LIFECYCLE` is not actionable outside `MATERIAL_RECONCILIATION`;
  - `SYS.MODE.WRITE` remains Admin-only and cannot be submitted without the existing confirmation.
- [ ] Extend the existing guard with required `capabilityId` and optional exact `allowedModes`; use current auth/mode authority. Keep `hide` for routes where revealing an action is itself unauthorized; use accessible `disable` with a reason for prerequisite/mode blockers.
- [ ] Update only the existing three mutation surfaces. Do not expose endpoints currently absent from UI.
- [ ] If exact permission tokens remain absent in the Backend policy/capability inventory, do not invent them: keep role/policy evidence, leave capability `PARTIAL`, and record `OWNER_DECISION_REQUIRED` for a later semantic slice.
- [ ] Run focused tests, full Frontend unit, lint, dependency cruise and build; expected GREEN.

**Completion:** Existing writes fail closed by capability/actor/mode and blocked controls explain why; no new business action exists.

---

### Task 5: Contract parity and non-mutating closure

**Files:**
- Modify: `scripts/check-conformance-contracts.test.mjs`
- Modify: `docs/conformance-contracts.json`
- Modify: `.planning/WORK.md`

- [ ] Add parity tests ensuring each rendered Backend mutation action maps to exactly one writable capability and one guarded surface action; read-only/local controls are not misclassified as Backend writes.
- [ ] Run:

```bash
npm run test:conformance-contracts
npm run check:conformance-contracts
npm run test:architecture-growth
npm run check:architecture-growth
npm run lint:fe
npm run depcruise:fe
npm run build:fe
npm run test:fe:unit
git diff --check
```

- [ ] Load and apply `ipc-test-audit`, `ipc-ui-review`, and `ipc-code-review`; report each as:
  `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact`.
- [ ] Record PASS/FAIL/NEEDS_EVIDENCE/BLOCKED per acceptance criterion in `.planning/WORK.md`.
- [ ] Keep browser geometry/focus/zoom/tablet, actor/mode runtime, and persistence/reload as `NEEDS_EVIDENCE`; do not use screenshots or jsdom as substitutes.
- [ ] Rank the remaining vertical capability gaps and select exactly one dependency-safe next slice. Use `writing-plans` only after Foundation B closure.

**Completion:** Shared loading/state/action contracts are machine-checked and non-mutating verification is green; runtime evidence remains explicitly unclaimed.
