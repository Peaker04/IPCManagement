# Requirements-to-Runtime Foundation A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a machine-checked requirements/capability/Frontend-surface inventory that selects the first bounded remediation slice without changing business behavior, Backend persistence, or production UI.

**Architecture:** Add one canonical conformance contract under `docs/` and one repository checker under `scripts/`. The contract links requirement IDs, Backend owners, Frontend routes/surfaces, evidence obligations, and delivery classification; canonical Markdown remains the prose authority while the JSON contract provides completeness and uniqueness checks. Foundation A ends by reconciling canonical documents only where the inventory provides evidence and by recording the next exact slice in `.planning/WORK.md`.

**Tech Stack:** Markdown, JSON, Node.js built-in test runner, existing npm scripts, C#/.NET source inspection, TypeScript/React source inspection.

**Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

## Global Constraints

- `.planning/WORK.md` is the only live task-state owner; this plan and the conformance contract are not progress ledgers.
- Preserve `DEFAULT != MATERIAL_RECONCILIATION`; no shared command, query, lineage, audit, or state semantics may merge them.
- No fake business data, fake success, inferred lifecycle, synthetic identifiers, test-only production seams, or exemption padding.
- No package installation, destructive Git operation, commit, push, deployment, schema/data mutation, seed, or migration application without separate authorization.
- Backend changes require an evidence-backed Owner Decision in `.planning/WORK.md`; semantic changes require an explicit decision before code.
- Migration source requires approved migration design; applying a migration requires separate environment/database authorization.
- Keep the current 3-Zone Workbench as the visual foundation, but do not preserve incorrect IA, unsupported actions, misleading states, or incomplete flows.
- Tests must mock the network boundary rather than the business adapter whose contract they claim to prove.
- A green unit suite is not runtime acceptance; browser, persistence, actor, and mode evidence remain explicit gates.
- Foundation A changes contracts/checkers/docs only; it must not modify Backend behavior or production Frontend behavior.

## Review Focus

- A requirement ID appears in multiple canonical documents with contradictory wording: checker must report `CONFLICT`, not silently choose one statement.
- A canonical route has no conformance surface entry: checker must fail and name the missing route.
- A capability names a Backend owner file that does not exist: checker must fail instead of accepting a documentary claim.
- A write capability lacks actor, mode, request DTO, authorization owner, or persistence effect: classification must be `PARTIAL`, `BLOCKED`, or `INVALID`, never `READY`.
- A requirement has only a unit-test evidence claim where the spec requires browser/persistence evidence: contract must retain the unmet evidence obligation.

---

## File ownership map

| File | Responsibility |
|---|---|
| `docs/conformance-contracts.json` | Canonical machine-readable index of requirements, capabilities, Frontend surfaces, evidence obligations, classifications, and conflicts. It contains no execution status or timestamps. |
| `scripts/check-conformance-contracts.mjs` | Pure checker for schema shape, unique IDs, references, source-path existence, route coverage, classification completeness, mode isolation, and evidence declarations. |
| `scripts/check-conformance-contracts.test.mjs` | Node tests for checker failure modes and repository contract acceptance. |
| `package.json` | Exposes `test:conformance-contracts` and `check:conformance-contracts`; includes the check in `verify`. |
| `docs/DOMAIN.md` | Reconciled BR/FR/NFR statements and capability ownership where Foundation A finds evidence-backed errors or omissions. |
| `docs/FLOWS.md` | Reconciled prerequisite, lineage, and state-transition statements discovered by inventory. |
| `docs/DESIGN.md` | Reconciled UXR/state/skeleton/navigation obligations; no route-specific implementation claims without evidence. |
| `docs/ENGINEERING.md` | Reconciled contract/evidence/error/concurrency rules surfaced by inventory. |
| `docs/UI-KIT.md` | Loading/skeleton and create/edit/detail primitive usage contract, only if current catalog is incomplete. |
| `docs/table-contracts.json` | Route table grain/pagination/sticky corrections supported by the inventory. |
| `frontend/src/routes/routeRegistry.ts` | Read-only evidence source in Foundation A; production changes are deferred to the owning vertical slice. |
| `.planning/WORK.md` | Intake evidence, Owner Decisions, active Foundation A status, completion evidence, and next exact plan/slice. |

## Contract interfaces

`docs/conformance-contracts.json` must expose this top-level shape:

```ts
interface ConformanceContracts {
  version: 1;
  requirements: RequirementContract[];
  capabilities: CapabilityContract[];
  surfaces: SurfaceContract[];
  conflicts: ConflictContract[];
}
```

Required records:

```ts
type RequirementKind = 'BR' | 'FR' | 'NFR' | 'UXR' | 'D' | 'T' | 'M' | 'N' | 'AC';
type Assessment = 'PASS' | 'FAIL' | 'PARTIAL' | 'GAP' | 'CONFLICT';
type DeliveryClass = 'READY' | 'PARTIAL' | 'BLOCKED' | 'INVALID' | 'READ_ONLY_BY_CONTRACT';
type OperationalMode = 'DEFAULT' | 'MATERIAL_RECONCILIATION' | 'SHARED_MASTER_DATA';
type EvidenceKind = 'static' | 'unit' | 'contract' | 'backend-test' | 'openapi' | 'browser' | 'persistence' | 'actor-mode';

interface RequirementContract {
  id: string;
  kind: RequirementKind;
  source: string;
  title: string;
  sourceAnchor: string;
  statementDigest: string;
  assessment: Assessment;
  capabilityIds: string[];
  evidenceRequired: EvidenceKind[];
}

interface BackendOwner {
  controller?: string;
  requestDto?: string;
  responseDto?: string;
  validator?: string;
  policy?: string;
  lifecycle?: string;
  concurrency?: string;
  persistence?: string;
}

interface CapabilityContract {
  id: string;
  frCode: string;
  name: string;
  operation: 'read' | 'create' | 'update' | 'terminal';
  mode: OperationalMode;
  actors: string[];
  permissionTokens: string[];
  grain: string;
  prerequisites: string[];
  sourceLineage: string[];
  actionIds: string[];
  backend: BackendOwner;
  deliveryClass: DeliveryClass;
  requirementIds: string[];
  surfaceIds: string[];
  gaps: string[];
}

interface SurfaceContract {
  id: string;
  route: string;
  view?: string;
  workObject: 'OperationalFrame' | 'SplitWorkbench';
  capabilityIds: string[];
  actions: Array<{ id: string; label: string; capabilityId: string }>;
  states: Array<'loading' | 'empty' | 'error' | 'permission-denied' | 'partial' | 'write-reconciliation'>;
  skeleton: {
    kind: 'table' | 'cards' | 'matrix' | 'form' | 'none';
    owner: string;
    geometryContract: string;
  };
  tableContractId?: string;
  gaps: string[];
  owner: string;
  evidenceRequired: EvidenceKind[];
}

interface ConflictContract {
  id: string;
  requirementIds: string[];
  description: string;
  evidence: string[];
  decision: 'OWNER_DECISION_REQUIRED' | 'RESOLVED';
  resolution?: string;
}
```

The JSON file uses these field names exactly. Canonical prose remains in its Markdown owner; `statementDigest` is the SHA-256 digest of the normalized source table row identified by `sourceAnchor`, so documentary changes cannot bypass reconciliation. Optional Backend owner paths are permitted only when `deliveryClass` is not `READY` and `gaps` names the missing owner.

---

### Task 1: Conformance checker core

**Files:**
- Create: `scripts/check-conformance-contracts.mjs`
- Create: `scripts/check-conformance-contracts.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository root and a `ConformanceContracts` JSON document using the interfaces above.
- Produces: `validateConformanceContracts(contract, { repoRoot }): string[]`; CLI exits `0` with `Conformance contracts: PASS` when no errors, otherwise exits `1` and prints one error per line.

- [ ] **Step 1: Write failing checker tests**

Add Node tests named:

- `rejects duplicate requirement, capability, surface, and conflict IDs`.
- `rejects dangling requirement/capability/surface references`.
- `rejects missing source and owner paths`.
- `requires every canonical route except login and forbidden to have a surface`.
- `rejects READY write capability without actor, mode, DTO, policy, persistence, and full six-state surface`.
- `rejects a capability that mixes DEFAULT and MATERIAL_RECONCILIATION lineage`.
- `retains browser and persistence evidence obligations when only unit evidence exists`.

Each test constructs the smallest in-memory contract and asserts the exact diagnostic substring. Production files are not used as test fixtures except the final repository acceptance test.

- [ ] **Step 2: Run checker tests to verify RED**

Run: `node --test scripts/check-conformance-contracts.test.mjs`  
Expected: FAIL because `check-conformance-contracts.mjs` or `validateConformanceContracts` does not exist.

- [ ] **Step 3: Implement the checker**

Implement `validateConformanceContracts(contract, { repoRoot, canonicalRoutes? })` with Node standard library only. Validate:

- exact top-level `version: 1` and four arrays;
- required enums and fields;
- uniqueness and referential integrity;
- repository-relative source/owner path existence;
- route coverage using canonical routes parsed from `frontend/src/routes/routeRegistry.ts` when `canonicalRoutes` is omitted;
- `READY` create/update/terminal capability completeness;
- six-state surface declaration for writable capabilities;
- strict mode value per capability and rejection of opposite-mode lineage names;
- explicit unmet evidence declarations rather than inferred completion.

Do not add a JSON Schema dependency.

- [ ] **Step 4: Add npm commands**

Add:

```json
"test:conformance-contracts": "node --test scripts/check-conformance-contracts.test.mjs",
"check:conformance-contracts": "node scripts/check-conformance-contracts.mjs docs/conformance-contracts.json"
```

Do not add the checker to root `verify` until Task 4 has completed the repository contract.

- [ ] **Step 5: Run checker tests to verify GREEN**

Run: `npm run test:conformance-contracts`  
Expected: all checker tests PASS.

- [ ] **Step 6: Verify no unrelated behavior changed**

Run: `git diff --check`  
Expected: PASS; line-ending warnings may be reported but no whitespace errors.

**Completion contract:** checker unit tests pass; no conformance data or product behavior is claimed yet.

---

### Task 2: Canonical requirements inventory

**Files:**
- Create: `docs/conformance-contracts.json`
- Modify: `scripts/check-conformance-contracts.test.mjs`
- Evidence sources: `docs/DOMAIN.md`, `docs/FLOWS.md`, `docs/DESIGN.md`, `docs/ENGINEERING.md`, `docs/UI-KIT.md`, `docs/table-contracts.json`, domain documents under `docs/domain/`

**Interfaces:**
- Consumes: checker from Task 1 and requirement tables in canonical documents.
- Produces: complete `requirements[]` and initial `conflicts[]`; later tasks attach capabilities and surfaces through IDs.

- [ ] **Step 1: Add repository acceptance test for requirement coverage**

Add `covers every canonical requirement ID exactly once or records a conflict`. The test extracts IDs matching the approved prefixes from canonical Markdown/JSON, excluding historical specs/plans, and asserts each ID exists in `requirements[]`. If the same ID has materially different source statements, require a `CONFLICT` assessment and referenced `ConflictContract`.

- [ ] **Step 2: Run test to verify RED**

Run: `npm run test:conformance-contracts`  
Expected: FAIL because `docs/conformance-contracts.json` is absent or missing canonical IDs.

- [ ] **Step 3: Populate requirements and conflicts**

Create version `1` contract. For every current canonical ID:

- copy the canonical statement without silently rewriting it;
- record its source file;
- assign kind and evidence obligations;
- set initial assessment from source-backed evidence;
- use empty `capabilityIds` only until Task 3;
- create `ConflictContract` entries for contradictory statements instead of choosing a winner.

Do not include progress, assignee, dates, or implementation status fields.

- [ ] **Step 4: Run requirement coverage tests**

Run: `npm run test:conformance-contracts`  
Expected: requirement coverage tests PASS. Full repository validation is intentionally deferred until capabilities and surfaces exist; do not weaken the contract or add an allowlist for staged construction.

**Completion contract:** every canonical requirement has one machine entry or explicit conflict; no requirement wording has been altered yet.

---

### Task 3: Backend capability inventory

**Files:**
- Create: `scripts/extract-backend-action-index.mjs`
- Create: `scripts/extract-backend-action-index.test.mjs`
- Create: `docs/backend-action-index.json`
- Modify: `docs/conformance-contracts.json`
- Modify: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: `requirements[]` IDs from Task 2.
- Produces: `capabilities[]` with exact Backend owners, mode, actors, permission tokens, grain, prerequisites, lineage, classification, and gaps.

- [ ] **Step 1: Add Backend action-index and owner regression tests**

Create extractor tests with multiline C# attributes/signatures that assert controller route, action route, HTTP method, authorization policy, request type, response type, and source method are captured. Add repository tests that assert:

- every controller action with an HTTP attribute has exactly one action-index record;
- generated action index is byte-stable when rerun;

- every `READY` capability points to existing controller and response DTO paths;
- every writable `READY` capability points to request DTO, policy, and persistence owner paths;
- every capability references at least one requirement;
- every `FR-*` requirement references at least one capability or has `GAP`/`CONFLICT` assessment;
- no capability contains both DEFAULT inventory lineage and MRX reconciliation lineage.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test:conformance-contracts`  
Expected: FAIL with missing capability/FR ownership diagnostics.

- [ ] **Step 3: Inventory capabilities feature by feature**

Inspect the 12 Backend feature owners and record capabilities at operation grain, not entity-name grain. For each read/create/update/terminal operation record exact owners and facts. Classify unsupported or contradictory operations; do not infer a write capability from an entity or read DTO.

Required feature coverage:

- Auth;
- Admin/SystemOperation/SampleData;
- Catalog;
- Planning;
- Coordination;
- Purchasing;
- Approvals;
- Inventory;
- Reconciliation;
- Reports;
- Dashboard aggregation sources.

For every Backend gap, add a concrete `gaps[]` statement. For semantic conflicts, create a `ConflictContract` with `OWNER_DECISION_REQUIRED`; do not edit Backend.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm run test:conformance-contracts`  
Expected: Backend ownership and FR-capability tests PASS. Full repository CLI validation remains deferred to Task 4 because Frontend surface inventory is not yet complete.

**Completion contract:** Backend capability inventory is source-backed; no Backend behavior, migration, OpenAPI, or database is changed.

---

### Task 4: Frontend route, action, state, and skeleton inventory

**Files:**
- Modify: `docs/conformance-contracts.json`
- Modify: `scripts/check-conformance-contracts.test.mjs`
- Evidence sources: `frontend/src/App.tsx`, `frontend/src/routes/routeRegistry.ts`, `frontend/src/components/workbench/**`, `frontend/src/components/ui/**`, `frontend/src/features/**`, `frontend/src/api/**`, `docs/table-contracts.json`

**Interfaces:**
- Consumes: `capabilities[]` from Task 3.
- Produces: `surfaces[]`, bidirectional capability/surface references, and route-level gaps/classifications.

- [ ] **Step 1: Add surface completeness tests**

Add repository tests that assert:

- all canonical protected routes have at least one surface;
- every N6 `?view=` leaf in AppShell has a matching surface entry;
- every rendered mutation action maps to exactly one writable capability;
- every surface declares all six state names, with non-applicable states retained and explained through capability classification rather than omitted;
- every loading surface declares a skeleton owner and non-empty geometry contract, or uses `kind: none` with a requirement-backed reason;
- every table surface links to an entry in `docs/table-contracts.json` or records a `GAP`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test:conformance-contracts`  
Expected: FAIL with route/view/action/state/skeleton coverage diagnostics.

- [ ] **Step 3: Inventory all Frontend surfaces**

For each canonical route and URL-owned view record:

- work object;
- mapped capability IDs;
- actual rendered actions;
- current state handling;
- actual loading/skeleton owner and geometry;
- table contract linkage;
- required browser/persistence evidence;
- unsupported actions and missing UI capabilities as gaps.

Do not mark an absent UI as implemented merely because Backend capability exists. Do not add UI code in this task.

- [ ] **Step 4: Classify mismatches and select the first slice**

Set requirement assessments and capability delivery classes based on the joined inventory. Rank findings by:

1. data integrity/security/mode isolation;
2. incorrect write contract or fake success;
3. missing prerequisite/lineage/concurrency;
4. misleading state/loading/skeleton behavior;
5. missing but Backend-ready UI;
6. presentation polish.

The selected next slice must be the highest-ranked dependency-safe capability, not the visually easiest route.

- [ ] **Step 5: Add the completed checker to root verification**

Append `npm run check:conformance-contracts` to the root `verify` script before build/test commands.

- [ ] **Step 6: Run tests and checker to verify GREEN**

Run:

```bash
npm run test:conformance-contracts
npm run check:conformance-contracts
```

Expected: all contract tests PASS and CLI prints `Conformance contracts: PASS`.

**Completion contract:** every protected route/view and rendered action is mapped; missing UI and misleading skeleton/state behavior are explicit rather than silently accepted.

---

### Task 5: Reconcile cross-cutting loading, write-readiness, and evidence contracts

**Files:**
- Modify: `docs/DESIGN.md`
- Modify: `docs/ENGINEERING.md`
- Modify: `docs/UI-KIT.md`
- Modify: `docs/conformance-contracts.json`
- Test: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: conflicts and gaps proven by Tasks 2–4.
- Produces: reconciled canonical statements and updated source links/assessments; unresolved semantics remain Owner decisions.

- [ ] **Step 1: Write failing tests for the approved cross-cutting corrections**

Add or extend contract tests with these exact invariants:

- `loading geometry belongs to its resolved work object and retains route context`;
- `loading terminates into one of the six states and cannot represent a swallowed failure`;
- `a writable READY capability declares source lineage, actor, permission, mode, and concurrency gap or owner`;
- `browser and persistence obligations remain unmet when only unit evidence is declared`.

Any additional inventory finding that would change business semantics is not corrected in this task; record `OWNER_DECISION_REQUIRED` and defer it to the owning slice.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test:conformance-contracts`  
Expected: FAIL on the stale canonical statement or missing invariant.

- [ ] **Step 3: Apply minimum canonical document corrections**

Update these exact owners:

- `docs/DESIGN.md`: add the skeleton geometry and six-state termination rules under UI state/loading requirements;
- `docs/ENGINEERING.md`: add write-readiness and evidence-kind rules under API/verification requirements;
- `docs/UI-KIT.md`: add usage guidance that binds each skeleton to its resolved work object and forbids generic misleading records;
- `docs/conformance-contracts.json`: update source statements and assessments for these cross-cutting contracts.

Do not change unresolved domain semantics, flows, or table grains in Foundation A; retain them as explicit conflicts/gaps for the owning slice.

- [ ] **Step 4: Run contract and documentation checks**

Run:

```bash
npm run test:conformance-contracts
npm run check:conformance-contracts
npm run test:ignore-policy
npm run test:architecture-growth
npm run check:architecture-growth
```

Expected: all commands PASS.

**Completion contract:** canonical docs and machine contract agree; unresolved semantic conflicts remain explicit and do not leak into implementation.

---

### Task 6: Foundation A closure and next-slice handoff

**Files:**
- Modify: `.planning/WORK.md`
- Create after Owner approval: `docs/superpowers/plans/2026-10-17-<selected-slice>-implementation-plan.md`

**Interfaces:**
- Consumes: passing conformance contract and ranked findings from Tasks 1–5.
- Produces: Foundation A evidence in the state owner and one exact next-plan target; it does not implement that slice.

- [ ] **Step 1: Run full non-mutating verification**

Run:

```bash
npm run test:conformance-contracts
npm run check:conformance-contracts
npm run lint -w frontend
npm run build -w frontend
npm run test:unit -w frontend
npm run build:be
git diff --check
```

Expected: all commands PASS. Any inherited failure is named exactly and Foundation A remains `NEEDS_EVIDENCE` rather than being declared complete.

- [ ] **Step 2: Review the final diff for scope**

Confirm the diff contains only:

- the conformance contract;
- checker/tests/scripts;
- evidence-backed canonical documentation corrections;
- `.planning/WORK.md` state update;
- this approved plan/spec.

Expected: no production Backend or Frontend behavior changes and no generated/build artifacts added.

- [ ] **Step 3: Update `.planning/WORK.md`**

Record:

- Foundation A requirement IDs and result;
- checker commands/results;
- contract path;
- resolved conflicts and Owner Decisions;
- unresolved blockers;
- selected next slice and exact capability IDs;
- required evidence and migration decision, if any;
- lifecycle returns to `PLAN` pending approval of the next slice plan.

Do not mark the overall conformance program `COMPLETED`.

- [ ] **Step 4: Draft the selected slice plan**

Invoke `superpowers:writing-plans` against the selected capability and this spec. The slice plan must contain exact production files, DTO signatures, RED→GREEN tests, browser evidence, and stop conditions discovered by Foundation A.

Expected: one bounded plan; do not pre-write plans for later slices whose contracts may change.

**Completion contract:** Foundation A is independently reviewable and the next slice is exact; no context-dependent unwritten decision is required to start its plan.

---

## Plan sequence after Foundation A

The remaining program is intentionally not expanded into one stale mega-plan. After each accepted plan, create only the next dependency-safe plan:

1. Foundation B — shared auth/mode/error/dirty/pagination/loading/skeleton contracts.
2. `FR-AUTH / FR-SYS`.
3. `FR-CAT / FR-ADMIN`.
4. `FR-MENU / FR-COORD`.
5. `FR-PUR / FR-APPR`.
6. `FR-WH`.
7. `FR-CHEF`.
8. `FR-RECON`.
9. `FR-REP / FR-DASH`.

A later plan may reorder only through an Owner Decision backed by the current conformance contract.
