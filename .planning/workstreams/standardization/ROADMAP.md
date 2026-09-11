# Roadmap: FE–BE–Database Standardization Closure

## Milestone v1.0

**Goal:** Close the remaining standardization contract across frontend query state, import diagnostics/provenance/atomicity, effective-range audit, customer-week tier integrity and workbook E2E evidence.

**Execution rule:** Complete Phases 1–7 in order. Each phase must preserve `ipc_lane1`, add regression coverage at the affected layer and synchronize code-facing documentation in the same change.

## Phase overview

- [x] **Phase 1: Frontend Query Boundary Closure** — inventory every remaining production query boundary and migrate or explicitly disposition legacy state handling. (completed 2026-08-03)
- [x] **Phase 2: Import Diagnostics and Provenance** — close `OPEN-02` and `OPEN-07` with friendly scoped diagnostics, preview integrity and imported-dish provenance. (completed 2026-08-03)
- [x] **Phase 3: Import Atomicity and Recovery** — close `OPEN-08` with tested all-or-nothing behavior or an explicit recovery protocol. (completed 2026-08-03)
- [x] **Phase 4: Effective-Range Audit Coverage** — close `OPEN-05` for contract and menu-schedule transitions. (completed 2026-08-03)
- [x] **Phase 5: Customer-Week Tier Integrity** — close `OPEN-06` with service and database enforcement plus safe migration coverage. (completed 2026-08-03)
- [x] **Phase 6: Workbook Author and Browser Verification** — close `OPEN-09` with a case matrix and headed five-viewport E2E evidence without changing the source workbook. (completed 2026-08-03)
- [x] **Phase 7: Cross-Stack Closure** — run complete gates, reconcile evidence and close the standardization workstream. (completed 2026-08-03)

### Phase 1: Frontend Query Boundary Closure

**Goal:** Remove undispositioned legacy query-state handling from production frontend boundaries.

**Requirements:** FEQS-01, FEQS-02, FEQS-03, FEQS-04

**Success criteria:**

1. A source-aware inventory has exact coverage of query owners and identifies no unexplained boundary.
2. Migrated boundaries distinguish loading, refreshing, actionable error, forbidden, ready and authoritative empty.
3. Targeted rendered tests fail on false-empty/false-zero or ownerless retry regressions.

### Phase 2: Import Diagnostics and Provenance

**Goal:** Make preview/commit a trustworthy, diagnosable contract from workbook bytes through persisted dish provenance.

**Requirements:** IMPD-01, IMPD-02, IMPD-03, IMPD-04, IMPD-05

**Success criteria:**

1. Malformed BOM input maps to stable domain responses with sheet/row/field scope where available.
2. Commit rejects stale, altered or cross-scope preview tokens/checksums.
3. Imported dishes retain provenance and API regressions prove both failure and success paths.

### Phase 3: Import Atomicity and Recovery

**Goal:** Prevent silent partial persistence across a two-customer import batch.

**Requirements:** IMPA-01, IMPA-02, IMPA-03

**Success criteria:**

1. Failure at the second customer leaves no undisclosed first-customer commit, or exposes a complete tested recovery state.
2. Forced-failure tests prove transaction/recovery semantics and actionable response details.
3. Retrying the same intent cannot duplicate authoritative records.

### Phase 4: Effective-Range Audit Coverage

**Goal:** Join effective-range mutations to persisted, actor-attributed audit evidence.

**Requirements:** AUDT-01, AUDT-02, AUDT-03

**Success criteria:**

1. Contract and menu-schedule range changes record before/after facts, actor and correlation context.
2. API tests verify the business transition and audit record in the same scenario.
3. Existing authorization, concurrency and response contracts remain unchanged.

### Phase 5: Customer-Week Tier Integrity

**Goal:** Make one-tier-per-customer/week a database-backed invariant rather than a UI convention.

**Requirements:** TIER-01, TIER-02, TIER-03, TIER-04

**Success criteria:**

1. Conflicting tier assignments are rejected consistently by the service and database.
2. Migration tests prove forward enforcement against representative existing data without destructive reset.
3. Conflict responses and rollback guidance are clear and regression-tested.

### Phase 6: Workbook Author and Browser Verification

**Goal:** Prove the authored workbook contract and user import flow without mutating the source template.

**Requirements:** WBQA-01, WBQA-02, WBQA-03, WBQA-04

**Success criteria:**

1. A deterministic matrix covers valid, malformed, stale-token and two-customer cases.
2. A before/after hash proves the original workbook remains byte-identical.
3. Headed Chrome evidence at all five approved viewports joins UI action, API, DB transition/recovery and rendered reload, with telemetry and errors captured.

### Phase 7: Cross-Stack Closure

**Goal:** Demonstrate that every scoped requirement is complete and make all state/document sources agree.

**Requirements:** CLOSE-01, CLOSE-02, CLOSE-03

**Success criteria:**

1. Application, API, frontend, UI completeness, lint, dependency and both production builds pass without count reduction.
2. Hygiene checks pass and protected data/workbook lineage is reconciled.
3. `OPEN-02/05/06/07/08/09` and FE migration follow-up are removed from current memory and recorded in append-only history with evidence pointers.

## Scope boundaries

- Do not execute SAP Fiori Phases 27–30 as part of this milestone.
- Do not resolve external infrastructure or product-permission decisions.
- Do not use GitNexus unless Kỳ explicitly opts in.
- Do not reset, seed, import into or restore `ipc_lane1` merely to make a test pass.
