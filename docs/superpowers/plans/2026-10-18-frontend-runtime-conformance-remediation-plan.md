# Frontend Runtime Conformance Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make navigation, mode isolation, query/loading behavior, accessibility, responsive workbenches, styling ownership, and conformance evidence match the approved frontend runtime contract.

**Architecture:** Extend the existing canonical route and workbench owners rather than adding parallel registries. Repair the zero-dependency scoped query engine at its public hook boundary, prove it on Reports, then reuse route-resolved geometry and shared dialog lifecycle. Unsupported support screens fail closed instead of inflating coverage.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Vitest, Testing Library, Playwright, Tailwind CSS 4, existing zero-dependency `scopedQuery`.

**Spec:** `docs/superpowers/specs/2026-10-18-frontend-runtime-conformance-remediation-design.md`

## Global Constraints

- `DEFAULT != MATERIAL_RECONCILIATION`; no shared workflow query, command, lineage, audit, or navigation leaf.
- No fake API/data/success, placeholder business screen, test allowlist, or weakened assertion.
- No package installation, migration, seed, import, deploy, DB mutation, or live mode mutation.
- Backend C# DTOs and policies remain authoritative.
- Existing UI primitives/workbench owners are reused; no `ModalV2`, `DataGridNew`, or second query store.
- `frontend/src/styles/index.css` remains the only color-token authority.
- Product code follows TDD. Commit steps run only when the Owner authorizes commits.
- Each UI task declares the project Scoped Pre-Code UI Gate Block in `.planning/WORK.md` before `.tsx`/`.css` edits.

## Review Focus

1. **Unresolved server mode at startup:** render a neutral authority-loading shell; do not render DEFAULT leaves before the server snapshot resolves. Covered in Task 2.
2. **Rapid filter/page/tab changes:** old requests cannot replace the latest scope; prior rows are visibly transitional, not final. Covered in Tasks 4–5.
3. **Refresh failure with prior data:** preserve rows and show inline retry; cold failure still replaces the work object. Covered in Tasks 4–5.
4. **Deep links into wrong mode/permission:** deny or relocate before the feature API runs. Covered in Task 2.
5. **Keyboard and tablet exits:** dialogs trap/restore focus; single-pane detail always has a Back path. Covered in Tasks 7–8.

---

### Task 1: Correct the conformance denominator and audit owners

**Files:**
- Modify: `docs/conformance-contracts.json`
- Modify: `.planning/audit/route-screen-coverage.md`
- Modify: `.planning/audit/requirements-traceability.md`
- Modify: `.planning/audit/defect-register.md`
- Modify: `scripts/check-conformance-contracts.test.mjs`
- Test: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: existing requirements, capabilities, surfaces, action index.
- Produces: explicit `NO_SURFACE | PARTIAL | BLOCKED | BACKEND_CAPABILITY_GAP` reporting and four non-inflated coverage metrics.

- [ ] **Step 1: Write failing conformance tests**

Add tests named:

- `reports capability-to-surface gaps without counting undeclared screens as covered`
- `rejects surfaces whose rendered local actions are absent from the surface contract`
- `does not classify admin cache or diagnostics as delivered business capabilities`

Assert that no test computes product completeness only from `surfaces.length`, and that no unrelated capability owns diagnostics/cache.

- [ ] **Step 2: Run RED**

Run: `npm run test:conformance-contracts`  
Expected: FAIL on current 25/25 claims and cache/diagnostics mappings.

- [ ] **Step 3: Update canonical contracts and audit documents**

Record all no-surface capabilities without creating placeholder pages. Reclassify the two support views and reopen the audit findings identified by the spec.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:conformance-contracts && npm run check:conformance-contracts`  
Expected: PASS with gaps still explicit.

- [ ] **Step 5: Commit only if authorized**

Suggested message: `docs(conformance): report capability and actor-mode gaps`

---

### Task 2: Make route and leaf eligibility the navigation authority

**Files:**
- Modify: `frontend/src/routes/routeRegistry.ts`
- Create: `frontend/src/routes/navigationEligibility.ts`
- Modify: `frontend/src/components/workbench/AppShell.tsx`
- Modify: `frontend/src/routes/RoleGuard.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/store/authContext.tsx`
- Test: `frontend/src/__tests__/AppShell.test.tsx`
- Test: `frontend/src/__tests__/Auth.test.tsx`
- Test: `frontend/tests/browser/conformance-runtime.spec.ts`

**Interfaces:**
- Produces: `resolveEligibleNavigation(routes, actor, mode): EligibleNavigationEntry[]` and a server-mode resolution state exposed by AuthContext.
- Consumes: canonical roles, permissions, mode, surface/capability IDs.

- [ ] **Step 1: Write failing resolver/component tests**

Cover:

- DEFAULT excludes MRX workflow leaves except the Admin mode-settings entry.
- MRX excludes Purchasing, DEFAULT MaterialDemand/KHSX, DEFAULT Chef and DEFAULT reports.
- shared catalog/settings require their existing role/permission rules.
- unresolved server mode renders no mode-owned leaf.
- wrong-mode deep link redirects to an explained safe destination before feature API invocation.

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -w frontend -- src/__tests__/AppShell.test.tsx src/__tests__/Auth.test.tsx`  
Expected: FAIL because AppShell currently filters only by role.

- [ ] **Step 3: Extend `RouteDef`/leaf metadata and implement the pure resolver**

Use the exact types from the spec. Keep lazy component mapping in `App.tsx`; do not add another route inventory.

- [ ] **Step 4: Gate initial mode authority**

AuthContext distinguishes unresolved from confirmed mode. Local storage is a hint only and cannot authorize a workflow tree.

- [ ] **Step 5: Wire AppShell and RoleGuard to the same eligibility result**

Preserve dirty navigation behavior and modified-click semantics.

- [ ] **Step 6: Run GREEN and browser matrix**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/AppShell.test.tsx src/__tests__/Auth.test.tsx
cd frontend && npx playwright test tests/browser/conformance-runtime.spec.ts --grep "mode|navigation"
```

Expected: unit PASS; browser PASS without mutations.

- [ ] **Step 7: Commit only if authorized**

Suggested message: `fix(navigation): isolate default and mrx workflow trees`

---

### Task 3: Remove unsupported cache and diagnostics business leaves

**Files:**
- Modify: `frontend/src/features/admin/AdvancedSettingsPage.tsx`
- Modify: `frontend/src/routes/routeRegistry.ts`
- Modify: `frontend/src/routes/workbenchSurfaceRegistry.ts`
- Modify: `docs/conformance-contracts.json`
- Modify: `frontend/src/__tests__/AdvancedSettings.test.tsx`
- Modify: `frontend/src/__tests__/AppShell.test.tsx`

**Interfaces:**
- Consumes: Task 2 route leaf model.
- Produces: mode settings as the only delivered Advanced Settings business surface; no hardcoded runtime facts.

- [ ] **Step 1: Write failing tests**

Assert:

- navigation has no Cache/Diagnostics business leaves;
- `/settings/advanced?view=cache|diagnostics` resolves fail-closed to mode settings or an explicit unsupported state;
- no rendered text claims MySQL/server/health facts without a network response;
- no local cache action silently removes the server-mode hint.

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -w frontend -- src/__tests__/AdvancedSettings.test.tsx src/__tests__/AppShell.test.tsx`

- [ ] **Step 3: Remove unsupported branches and stale surface mappings**

Do not replace them with placeholder cards. Keep the mode-change workflow and its conflict/reason handling intact.

- [ ] **Step 4: Run GREEN and conformance**

Run: focused unit tests plus `npm run test:conformance-contracts`.

- [ ] **Step 5: Commit only if authorized**

Suggested message: `fix(system-ui): remove unsupported cache and diagnostics surfaces`

---

### Task 4: Complete the scoped query public contract

**Files:**
- Modify: `frontend/src/lib/scopedQuery.ts`
- Rewrite: `frontend/src/__tests__/ScopedQuery.test.ts`

**Interfaces:**
- Produces: `useScopedQuery(options): ScopedQueryResult` with cold fetch, stale-time refresh, exact-key dedupe, key-transition previous data, AbortSignal, and refresh-error retention.
- Consumes: `OperationalMode`, actor/role, scope, stable query keys.

- [ ] **Step 1: Replace store-only tests with hook-owner RED tests**

Use `renderHook` and network-boundary promises. Add tests:

- `enabled cold query fetches once and exposes cold loading`
- `disabled query remains idle`
- `fresh cache renders immediately without a request`
- `stale cache renders immediately while refreshing`
- `key change retains prior data and marks previous data`
- `refresh failure retains cached data and exposes error`
- `mode partition never returns the other mode payload`
- `unmounted or superseded request is aborted/ignored`

Do not mock `useScopedQuery` or reproduce its cache logic in test fixtures.

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -w frontend -- src/__tests__/ScopedQuery.test.ts`  
Expected: current hook fails auto-fetch, stale-time, transition and abort tests.

- [ ] **Step 3: Implement minimal engine repair**

Honor existing public option names. Use `useEffect` for query lifecycle, a per-key `AbortController`, and observer-owned previous data. Keep cache in memory only.

- [ ] **Step 4: Run GREEN**

Run focused tests; expected all ScopedQuery tests PASS without timer/listener warnings.

- [ ] **Step 5: Commit only if authorized**

Suggested message: `fix(query): implement cold warm and transition states`

---

### Task 5: Prove the loading matrix on Reports

**Files:**
- Modify: `frontend/src/features/reports/ReportsPage.tsx`
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Modify: `frontend/src/__tests__/Reports.test.tsx`
- Modify: `frontend/tests/browser/loading-ux-async-consistency.spec.ts`

**Interfaces:**
- Consumes: Task 4 `useScopedQuery` and existing report API DTOs.
- Produces: one production vertical slice that owns tab/filter/page cache and truthful loading UX.

- [ ] **Step 1: Add failing Reports behavior tests**

Cover the matrix:

- cold route → skeleton;
- warm return → immediate cached table;
- unopened tab → content-only skeleton;
- reopened tab → cached rows;
- page change → prior rows plus “Đang tải trang N”;
- filter change → prior rows plus scope-updating notice;
- Refresh → rows remain and refresh control is pending;
- refresh error → rows remain plus inline retry;
- resolved empty → Empty State;
- rapid key changes → latest response owns the DOM.

Fixtures must match C# paged DTOs exactly.

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -w frontend -- src/__tests__/Reports.test.tsx`.

- [ ] **Step 3: Migrate Reports to `useScopedQuery`**

Use query keys containing view, period, customer, page and page size; scope by actor and mode. Remove duplicated request sequence/reload logic only after tests are green.

- [ ] **Step 4: Separate cold, refresh and transition presentation**

StateBoundary receives explicit state; Refresh button uses `aria-busy`; successful empty never renders skeleton.

- [ ] **Step 5: Run GREEN and browser loading suite**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/Reports.test.tsx src/__tests__/ScopedQuery.test.ts
cd frontend && npx playwright test tests/browser/loading-ux-async-consistency.spec.ts
```

- [ ] **Step 6: Commit only if authorized**

Suggested message: `feat(reports): apply cache-aware loading state matrix`

---

### Task 6: Unify Suspense and API skeleton geometry

**Files:**
- Create: `frontend/src/routes/useWorkbenchSurface.ts`
- Modify: `frontend/src/routes/RouteWorkbenchLoadingFallback.tsx`
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Modify: applicable feature pages under `frontend/src/features/`
- Modify: `frontend/src/__tests__/Primitives.test.tsx`
- Modify: `frontend/tests/browser/loading-ux-async-consistency.spec.ts`

**Interfaces:**
- Produces: `useWorkbenchSurface(): WorkbenchSurfaceDefinition`.
- Consumes: existing `resolveWorkbenchSurface(pathname, search)`.

- [ ] **Step 1: Write a failing continuity test**

Assert an approvals split route and weekly matrix route retain identical `data-skeleton-kind`, columns, rows and split ratio from Suspense through API cold loading.

- [ ] **Step 2: Run RED**

Expected: API StateBoundary falls back to generic table geometry.

- [ ] **Step 3: Implement the shared resolver hook and wire StateBoundary callers**

Do not duplicate geometry literals in features.

- [ ] **Step 4: Run GREEN**

Run focused primitives/page tests and loading Playwright.

- [ ] **Step 5: Commit only if authorized**

Suggested message: `fix(loading): preserve route geometry through api cold load`

---

### Task 7: Complete dialog and dirty-navigation focus lifecycle

**Files:**
- Create: `frontend/src/components/ui/dialog-focus.ts`
- Modify: `frontend/src/components/ui/modal.tsx`
- Modify: `frontend/src/components/workbench/DirtyNavigation.tsx`
- Modify: `frontend/src/__tests__/Primitives.test.tsx`
- Modify: `frontend/tests/browser/responsive-design-system-audit.spec.ts`

**Interfaces:**
- Produces: one internal dialog focus owner used by both blocking dialog implementations.
- Consumes: existing Modal API and pending-navigation state.

- [ ] **Step 1: Write failing keyboard tests**

Assert initial focus, forward/backward containment, Escape behavior, background inertness, focus restoration, nested dirty decision, and cleanup after unmount.

- [ ] **Step 2: Run RED**

Run focused Primitives tests; current implementation must fail containment/restore assertions.

- [ ] **Step 3: Implement the smallest shared focus lifecycle**

Do not change Modal callers or add a new public primitive.

- [ ] **Step 4: Run GREEN and headed keyboard audit**

Use a separate browser profile and no mutations.

- [ ] **Step 5: Commit only if authorized**

Suggested message: `fix(a11y): trap and restore blocking dialog focus`

---

### Task 8: Adapt SplitView for supported tablet workstations

**Files:**
- Modify: `frontend/src/components/workbench/SplitView.tsx`
- Modify: `frontend/src/features/approvals/ApprovalPage.tsx`
- Modify: `frontend/src/features/purchasing/PurchasingPage.tsx`
- Modify: `frontend/src/__tests__/Approvals.test.tsx`
- Modify: `frontend/src/__tests__/Purchasing.test.tsx`
- Modify: `frontend/tests/browser/responsive-design-system-audit.spec.ts`

**Interfaces:**
- Produces: desktop split plus tablet single-pane master/detail with an explicit Back action.
- Consumes: existing selection state and detail content.

- [ ] **Step 1: Write failing tablet interaction tests**

At the supported tablet viewport assert list-first, row selection opens detail, Back restores list and focus, tables remain horizontally scrollable, and desktop remains split.

- [ ] **Step 2: Run RED**

Expected: both panes remain compressed at tablet width.

- [ ] **Step 3: Add controlled pane state to SplitView callers**

Keep one work object; do not introduce a modal detail view.

- [ ] **Step 4: Run GREEN and 200% zoom checks**

Run focused unit and responsive browser suites.

- [ ] **Step 5: Commit only if authorized**

Suggested message: `fix(workbench): add tablet master detail navigation`

---

### Task 9: Make semantic tokens the shared-component authority

**Files:**
- Modify: `frontend/src/styles/index.css`
- Modify: shared files under `frontend/src/components/ui/`
- Modify: shared files under `frontend/src/components/workbench/`
- Modify: `frontend/src/__tests__/Primitives.test.tsx`
- Modify: `frontend/src/__tests__/AppShell.test.tsx`

**Interfaces:**
- Produces: semantic token-backed shared classes/utilities.
- Consumes: existing Quiet Operational palette; no new visual language.

- [ ] **Step 1: Write failing source/behavior contract tests**

Reject physical color authority in shared components while allowing documented state variants mapped in `index.css`. Retain contrast/focus behavior assertions.

- [ ] **Step 2: Run RED**

Expected: shared components contain direct slate/blue/amber/rose utilities.

- [ ] **Step 3: Add semantic mappings and migrate shared owners**

Start with AppShell, StateBoundary, Modal, DataGrid and ActionGuard. Avoid feature-wide churn in this task.

- [ ] **Step 4: Run detector, lint, unit and build**

Run once after the batch:

```bash
C:/Users/Administrator/.pi/agent/skills/impeccable/scripts/impeccable.cmd detect --json frontend/src/components frontend/src/styles/index.css
npm run lint:fe
npm run test:fe:unit
npm run build:fe
```

- [ ] **Step 5: Commit only if authorized**

Suggested message: `refactor(ui): enforce semantic tokens in shared owners`

---

### Task 10: Synchronize governance and close with truthful evidence

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/DESIGN.md`
- Modify: `docs/UI-KIT.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `.planning/WORK.md`
- Modify: audit documents from Task 1

**Interfaces:**
- Consumes: verified implementation from Tasks 2–9.
- Produces: accurate owners, dimensions, component locations, coverage and residual gaps.

- [ ] **Step 1: Update docs from source truth**

Correct `components/common` vs `components/workbench`, actual primitive/workbench counts, 56/44 geometry, query owner, navigation eligibility, and non-100% capability coverage.

- [ ] **Step 2: Run complete non-mutating verification**

```bash
npm run test:conformance-contracts
npm run check:conformance-contracts
npm run test:fe:unit
npm run lint:fe
npm run depcruise:fe
npm run build:fe
git diff --check
```

Run focused Playwright suites only against an authorized isolated browser/runtime:

```bash
cd frontend
npx playwright test tests/browser/conformance-runtime.spec.ts tests/browser/loading-ux-async-consistency.spec.ts tests/browser/responsive-design-system-audit.spec.ts
```

- [ ] **Step 3: Perform mandatory review gates**

Report in project format:

- `ipc-test-audit; ...`
- `ipc-ui-review; ...`
- `ipc-code-review; ...`

Classify each acceptance criterion PASS, FAIL, NEEDS_EVIDENCE or BLOCKED. Do not call the program complete while no-surface or Backend gaps remain.

- [ ] **Step 4: Update WORK and return lifecycle to IDLE**

Record exact commands/results and inherited failures. No synthetic runtime claim.

- [ ] **Step 5: Commit only if authorized**

Suggested message: `docs(frontend): close runtime conformance remediation`

## Self-review result

- **Spec coverage:** Every spec section maps to Tasks 1–10. Missing MRX business surfaces remain explicitly deferred rather than silently omitted.
- **Step scan:** Each task has a RED owner test, minimal implementation boundary, GREEN verification and optional authorized commit.
- **Type consistency:** Task 2 owns navigation eligibility; Task 4 owns query state; Task 6 owns geometry; later tasks consume those exact owners.
- **Review Focus:** unresolved mode, rapid scope changes, refresh failure, wrong-mode deep link and keyboard/tablet exits each have named tests.
- **Proportion:** The plan is large because the audit spans six coupled architecture concerns; it avoids implementation bodies and keeps adoption bounded to Reports before wider migration.
