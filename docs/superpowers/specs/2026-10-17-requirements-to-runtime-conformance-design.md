# Requirements-to-Runtime Conformance Design

**Date:** 2026-10-17  
**Status:** Proposed for Owner approval  
**Scope:** IPCManagement requirements reconciliation, Backend capability completion, Frontend workflow reconstruction, UI completeness, and runtime verification  
**State owner:** `.planning/WORK.md`

## 1. Intent

IPCManagement currently contains a partially rebuilt Frontend whose screens, create flows, navigation, API adapters, state labels, loading surfaces, and tests do not consistently originate from the same business and Backend contracts. Some existing UI was implemented before prerequisite, lineage, authorization, lifecycle, or persistence behavior was established. Other required capabilities have Backend support but no complete UI. Local fixes therefore risk making an individual control appear functional while preserving contradictions elsewhere.

This program restores a traceable chain from requirements to rendered and persisted behavior:

```text
Requirements
  → business capability
  → Backend contract and persistence
  → application workflow
  → Frontend data boundary
  → UX architecture
  → UI implementation
  → verification and runtime evidence
```

The 3-Zone Workbench remains the visual foundation. It is not a reason to retain an incorrect information architecture, unsupported action, false status, incomplete flow, or misleading state surface.

## 2. Goals

1. Reconcile every in-scope `BR`, `FR`, `NFR`, `UXR`, design, table, modal, navigation, and acceptance requirement with source and runtime evidence.
2. Restore create/edit/detail/terminal workflows from authoritative prerequisites, DTOs, policies, lifecycle transitions, concurrency contracts, and persisted results.
3. Inventory Backend capabilities that lack UI and implement them only when the contract is sufficient.
4. Repair or complete Backend contracts when a verified requirement cannot be fulfilled safely by the current Backend.
5. Make loading, skeleton, empty, error, permission, partial, conflict, and success surfaces accurately describe the underlying state.
6. Preserve `DEFAULT != MATERIAL_RECONCILIATION` across commands, queries, navigation, lineage, persistence, and audit behavior.
7. Produce requirements-to-test traceability and runtime evidence strong enough for Owner acceptance.
8. Keep implementation bounded by an approved spec and task plan so context compaction cannot silently alter scope.

## 3. Non-goals

- Replacing the established 3-Zone Workbench solely for visual novelty.
- Adding speculative flexibility, generic workflow engines, new UI libraries, or duplicate primitives.
- Making every entity writable merely because a read endpoint exists.
- Creating compatibility wrappers for incorrect historical Frontend payloads.
- Applying database migrations, seeding data, changing production data, deploying, committing, or pushing without separate authorization.
- Treating unit-test success as runtime acceptance.

## 4. Anti-goals

The following outcomes are failures even if the application builds:

- A form submits a payload not grounded in the Backend request DTO.
- A create action omits required source-document lineage.
- A control reports success before authoritative persistence is confirmed.
- A status, count, price, identity, date, quantity, or health fact is fabricated or inferred from insufficient facts.
- A skeleton has different geometry from the resulting work object and causes avoidable layout shift.
- A route exposes an action the actor, permission, mode, or lifecycle cannot perform.
- A test mocks the business adapter under test and therefore cannot detect a broken endpoint, mapper, or request.
- A capability is marked complete without required browser, reload, persistence, actor, and mode evidence.
- A Backend change is made only to preserve an incorrect Frontend design.

## 5. Authority and decision hierarchy

When artifacts disagree, decisions follow this hierarchy:

1. Persisted safety and data-integrity invariants.
2. Approved business Owner decisions recorded in `.planning/WORK.md`.
3. Reconciled domain requirements and workflow documentation.
4. Backend controllers, DTOs, validators, policies, lifecycle projections, persistence behavior, and generated OpenAPI.
5. Frontend application contracts and route metadata.
6. UI implementation.
7. Tests and fixtures.

Existing Backend source is authoritative for current behavior, but not automatically authoritative for intended business behavior. A verified mismatch between requirement and Backend becomes `CONTRACT_CONFLICT` or `BACKEND_CAPABILITY_GAP`, not an invitation for the Frontend to invent semantics.

## 6. Requirement classification

Every requirement or capability receives one status:

| Status | Meaning |
|---|---|
| `PASS` | Requirement, source, UI, tests, and required evidence agree. |
| `FAIL` | Implemented behavior contradicts an authoritative requirement. |
| `PARTIAL` | Some required behavior exists, but one or more required contracts or states are absent. |
| `GAP` | Requirement exists but no implementation owner currently provides it. |
| `CONFLICT` | Canonical artifacts disagree and an Owner decision is required. |

Every business capability also receives one delivery classification:

| Classification | Delivery rule |
|---|---|
| `READY` | Backend contract is sufficient; implement the complete authorized UI flow. |
| `PARTIAL` | Expose only proven behavior; unavailable behavior remains explicitly blocked. |
| `BLOCKED` | Do not build an operational form or action until the missing authority is resolved. |
| `INVALID` | Remove or redesign UI based on nonexistent or contradictory semantics. |
| `READ_ONLY_BY_CONTRACT` | Provide read/detail UX only; do not imply create/edit support. |

## 7. Requirement reconciliation matrix

Each route and capability must map:

- Requirement identifier, short title, canonical source/anchor, and normalized-statement digest: `BR-*`, `FR-*`, `NFR-*`, `UXR-*`, `D*`, `T*`, `M*`, `N*`, or acceptance criterion.
- Actor and exact role/permission policy.
- Operational mode.
- Business object and data grain.
- Preconditions and source lineage.
- Backend owner and source-derived action-index IDs: controller, DTO, validator, service, entity, policy, lifecycle projection.
- Frontend owner: route, page, API adapter, application state, primitive/composite.
- Observable success and failure behavior.
- Verification owner and required evidence type.
- Current classification and residual decision.

A requirement may not be declared obsolete solely because the current implementation omitted it. A proposed requirement change must include:

1. Previous statement.
2. Evidence that it is wrong, incomplete, ambiguous, or outdated.
3. Proposed statement.
4. Affected callers, persisted meanings, policies, routes, tests, and documents.
5. Migration or compatibility impact.
6. Owner decision when business semantics change.

## 8. Mandatory eight-layer workflow

Each vertical capability is processed through all layers before the next capability begins.

### Layer 0 — Requirements reconciliation

- Load only canonical documents relevant to the active capability.
- Build the bounded matrix described above.
- Identify missing, duplicated, contradictory, or untestable requirements.
- Reconcile `docs/DOMAIN.md`, `docs/FLOWS.md`, `docs/DESIGN.md`, `docs/ENGINEERING.md`, `docs/UI-KIT.md`, `docs/table-contracts.json`, and route metadata when evidence supports the change.
- Record unresolved semantic decisions as `OWNER_DECISION_REQUIRED`.

**Exit gate:** intended behavior and evidence obligations are explicit.

### Layer 1 — Business capability

Define:

- User and operational objective.
- Actor, role, permission, and mode.
- Input scope and business grain.
- Preconditions and source document.
- Allowed actions and terminal outcomes.
- Invariants, duplicate behavior, cancellation behavior, and audit expectations.

**Exit gate:** no action depends on an unnamed prerequisite or inferred identity.

### Layer 2 — Backend authority

Inspect real callers and owners:

- Controller route and HTTP method.
- Request and response DTOs.
- Validation rules.
- Authorization policy.
- Lifecycle/state transition guard.
- Concurrency/version requirement.
- Transaction and persistence effect.
- Idempotency/duplicate handling.
- Error contract.
- OpenAPI representation.

Backend findings are classified as:

- **Contract repair:** current implementation violates an already-approved requirement.
- **Capability completion:** approved requirement exists but Backend support is absent.
- **Semantic change:** lifecycle, authorization, invariant, or persisted meaning changes.

A semantic change requires a recorded Owner Decision before implementation.

**Exit gate:** the Backend can express the capability without synthetic Frontend fields.

### Layer 3 — Application workflow

Specify the end-to-end state machine:

- Entry point and prerequisite check.
- Draft ownership.
- Source-document lineage.
- Validation boundary.
- Mutation command.
- Pending/duplicate-submit behavior.
- 403, 409, validation, network, and partial-success recovery.
- Persisted result reload.
- Terminal transition and follow-on route.

**Exit gate:** normal, denied, stale, duplicate, and interrupted paths have deterministic behavior.

### Layer 4 — Frontend data boundary

Implement or repair:

- API endpoint and query parameters.
- Exact request DTO.
- Exact response/page wrapper.
- Mapper without business defaults.
- `ApiError` preservation.
- Stale-response protection.
- Server pagination and total metadata.
- Cancellation where appropriate.
- Cache invalidation/reload behavior.

No adapter may manufacture IDs, dates, quantities, prices, status, lineage, authorization, readiness, success, or health.

**Exit gate:** a network-boundary contract test can detect a broken route, method, payload, mapper, or page contract.

### Layer 5 — UX architecture

For each route:

- Define the single primary work object: `OperationalFrame` or `SplitWorkbench`.
- Place route-level work objects in N6 navigation.
- Keep only filter/status/detail scope as tabs.
- Define create/edit/detail ownership: page, drawer, or blocking modal.
- Define focus entry, focus return, keyboard flow, dirty behavior, and scope-change behavior.
- Define the six required UI states:
  - loading;
  - empty;
  - error;
  - permission denied;
  - partial data;
  - write reconciliation/conflict.
- Define responsive behavior at desktop, tablet, narrow width, and 200% zoom.

**Exit gate:** the user flow does not expose an impossible action or hide the authoritative scope.

### Layer 6 — UI implementation

Use existing design authority and primitives. Required considerations include:

- Compact density and one primary action.
- No inline styles, ad-hoc colors, external tokens, or duplicate primitives.
- Accessible names, error association, keyboard operation, focus visibility, focus return, and announcements.
- Dirty-navigation registration for any editable draft.
- Loading surfaces with geometry matching their resolved work object.
- Data tables with authoritative pagination, sticky behavior, overflow, and row interaction.
- Vietnamese operational copy based on persisted facts.

#### Skeleton contract

A skeleton must be specified and tested as part of the work object, not as generic decoration:

- Same outer frame and retained context header as the resolved screen.
- Same column/card/matrix topology.
- Widths approximate the actual content columns.
- Row density follows `T8` compact height.
- Sticky header/column behavior does not change on resolution.
- No misleading buttons, values, or fake records.
- Appropriate `aria-busy`/status behavior without noisy repeated announcements.
- No avoidable content-layout shift.
- Loading must terminate into success, empty, permission, partial, conflict, or error; it must not mask swallowed failures.

**Exit gate:** implementation satisfies the reconciled design and state matrix.

### Layer 7 — Verification and runtime evidence

Verification is layered:

1. Static contract and source ownership checks.
2. Network-boundary API tests using Backend-grounded DTO fixtures.
3. Component behavior tests at the strongest observable boundary.
4. Relevant contract tests and anti-tautology audit.
5. Full Frontend unit, lint, build, dependency, and diff checks.
6. Backend build/tests when Backend changed.
7. OpenAPI regeneration and contract diff when API changed.
8. Browser checks for focus, keyboard, geometry, overflow, zoom, and responsive behavior.
9. Authorized actor/mode matrix.
10. Authorized persistence/reload and concurrency evidence.

**Exit gate:** all required evidence is present or the capability remains `NEEDS_EVIDENCE`/`BLOCKED`.

## 9. Vertical delivery order

The order follows business dependency rather than visual convenience.

### Foundation A — Capability and requirement inventory

- Inventory Backend endpoints, DTOs, policies, lifecycle transitions, reports, and system operations.
- Inventory 14 canonical routes and all current controls/actions.
- Produce the first reconciled matrix and identify missing UI capabilities.
- Establish capability classifications and decision backlog in `.planning/WORK.md`.

### Foundation B — Shared cross-cutting contracts

- Auth and canonical role/permission mapping.
- Operational mode eligibility and isolation.
- Shared 403/409/error handling.
- Dirty navigation, including a decision on browser history blocking.
- Server pagination.
- Loading/skeleton contracts.
- Create/edit/detail interaction contract.
- Accessibility and responsive evidence protocol.

### Slice 1 — `FR-AUTH / FR-SYS`

Actor/session authority, forbidden behavior, system mode, diagnostics, and authorized system operations.

### Slice 2 — `FR-CAT / FR-ADMIN`

Ingredients, dishes, units, warehouses, customers, suppliers, employees, approval rules, and other master data required by operational workflows. Each write capability must be checked for required identifiers and policy.

### Slice 3 — `FR-MENU / FR-COORD`

Weekly menu, quantity planning, meal orders, production-plan generation, material-demand calculation, publication/locking, and coordination adjustments where supported.

### Slice 4 — `FR-PUR / FR-APPR`

Shortage aggregation, purchase request, approval, quote/supplier selection where supported, purchase-order generation, decision concurrency, and document lineage.

### Slice 5 — `FR-WH`

Warehouse receipt, issue, source request, current stock, confirmation, returns where supported, and immutable stock lineage.

### Slice 6 — `FR-CHEF`

Persisted production plan, material handoff, receipt confirmation, discrepancy handling, and supported completion actions without synthetic cooking telemetry.

### Slice 7 — `FR-RECON`

MRX batch scope, daily review, trigger/disposition workflow, weekly completion, concurrency, and strict mode isolation.

### Slice 8 — `FR-REP / FR-DASH`

Reports and dashboard are completed only after their source workflows have authoritative grain, status, and aggregation semantics.

## 10. Backend and migration governance

Backend work is allowed only after requirement reconciliation identifies the need and `.planning/WORK.md` records the decision.

For a proposed Backend change, the active slice must document:

- Requirement and business reason.
- Existing behavior and evidence.
- Proposed endpoint/DTO/validator/policy/lifecycle/persistence change.
- Security and mode-isolation impact.
- Existing callers and migration impact.
- OpenAPI and Frontend migration.
- Tests and runtime evidence.

### Migration rule

Schema or data migration work has a separate gate:

1. Propose the migration and impact.
2. Obtain explicit Owner approval.
3. Create migration source only within that approved scope.
4. Do not apply it to any database without a second explicit authorization naming the environment/database.

No command in this program implicitly authorizes schema or data mutation.

## 11. Scope control and context recovery

### Spec authority

This document defines intent, boundaries, order, and completion conditions. The implementation plan may decompose this design but may not expand it.

### State authority

`.planning/WORK.md` remains the only live state owner. It records:

- Current lifecycle phase.
- Active foundation/slice/capability.
- Exact requirements in scope.
- Owner decisions and rulings.
- Current evidence.
- Blockers and next exact task.

The spec and plan are not parallel state ledgers.

### Task fence

Every implementation task must name:

- Capability and requirement IDs.
- Allowed owner files.
- Explicit exclusions.
- Inputs and canonical contracts.
- Expected observable behavior.
- RED→GREEN regression.
- Verification commands.
- Completion and stop conditions.

### Stop conditions

Execution stops only for:

- Irreversible/destructive operation.
- Security-sensitive action requiring approval.
- Schema/data migration execution without explicit authorization.
- Business semantic conflict with no approved resolution.
- Missing actor/runtime/database authority required for evidence.
- A plan defect that makes all available paths speculative.

Missing browser/runtime evidence blocks acceptance, not safe source/test progress.

## 12. Testing policy

Tests must follow `ipc-test-audit` and project `test-audit` rules:

- Protect observable behavior, contract, or credible regression.
- Use Backend-grounded fixtures matching C# DTOs.
- Mock the network boundary, not the business adapter under test, for contract ownership.
- Do not mock the component under test.
- Do not add allowlist/exemption padding.
- Do not create production exports or seams used only by tests.
- Bug-fix tests must fail before the repair for the intended reason.
- Each contract has one strongest owner test; extend tables/cases instead of duplicating suites.

A required test matrix is selected per capability, not applied combinatorially without value.

## 13. Documentation change policy

Canonical documents may be updated when evidence supports the change:

- `docs/DOMAIN.md`: business rules, lifecycle, FR/BR/NFR matrix.
- `docs/FLOWS.md`: prerequisites, handoff, lineage, workflow.
- `docs/DESIGN.md`: IA, UXR, state, responsive, accessibility, skeleton behavior.
- `docs/ENGINEERING.md`: API, security, concurrency, performance, verification.
- `docs/UI-KIT.md`: primitive/composite contracts.
- `docs/table-contracts.json`: grain, columns, pagination, sticky behavior.
- `frontend/src/routes/routeRegistry.ts`: canonical route metadata after policy reconciliation.

Documentation must describe verified contracts, not desired appearance unsupported by implementation or Backend capability.

## 14. Completion criteria

A capability is complete only when:

- Requirement matrix is reconciled.
- All semantic decisions are approved.
- Backend contract and persistence behavior satisfy the approved requirement.
- Frontend data boundary contains no synthetic business claims.
- UX flow and all applicable states are implemented.
- Skeleton/loading geometry matches the resolved work object.
- Role, permission, mode, validation, concurrency, pagination, and dirty behavior are covered where applicable.
- Required static, unit, contract, Backend, OpenAPI, browser, actor/mode, and persistence evidence passes.
- Canonical documentation is current.
- Residual gaps are explicit.

Overall program closure is `READY_FOR_OWNER_ACCEPTANCE` or `BLOCKED_WITH_EVIDENCE`; it is never inferred from a green unit suite.

## 15. Open decisions deferred to active slices

The following are intentionally not guessed globally:

- Exact permission token for each route and action.
- Which currently read-only Backend resources require write capabilities.
- Business semantics of missing lifecycle transitions.
- Exact migration design for capability gaps requiring persistence changes.
- Browser history strategy for dirty drafts under the current declarative router.
- Runtime actor credentials, database, and operational mode used for acceptance evidence.

Each decision is resolved only when its capability becomes active and its real contracts are available.
