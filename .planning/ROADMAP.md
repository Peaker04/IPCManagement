# Roadmap: v1.4 Evidence-first UI Contract Migration

## Phase overview

- [x] **Phase 27: Warehouse Data Workspace contract pilot** — complete; fresh Warehouse verification and reviewer reconciliation pass.
- [x] **Phase 27.1: Non-Warehouse visual reconciliation** — complete; all 21 identities and the repeated broad-suite gate pass.
- [x] **Phase 28: Project-wide UI/UX contract rollout and single-warehouse presentation** — research, measure and remediate the complete web UI through shared seams and bounded route rollout.
- [x] **Phase 29: System operation mode, material reconciliation and project-wide clarity cleanup** — add one Admin-controlled global mode, a frozen-batch reconciliation branch and evidence-backed removal of redundant/technical UI content in both modes.
- [ ] **Phase 30: Closed-loop menu issue reconciliation** — simplify reconciliation mode to Menu import → material demand → real Warehouse issue → required-versus-issued reconciliation with minimal mode-specific work surfaces.

Kỳ explicitly promoted the follow-on on 23/08/2026. Phase 28 may audit every route and implement evidence-backed UI corrections, including Admin Data and Purchasing presentation, while preserving their business/API/permission boundaries.

## Phase 27: Warehouse Data Workspace contract pilot

**Status:** COMPLETE — implementation, Phase 27.1 reconciliation and fresh final verification pass

**Goal:** Prove that IPCManagement can express, collect, evaluate and remediate a Data Workspace UI contract without introducing a broad UI framework or changing business behavior.

**Requirements:** UIC-01, UIC-02, UIC-03, UIC-04, UIC-05, WHP-01, WHP-02, WHP-03, WHP-04

### Required sequence

1. Inventory Warehouse work object, state, actor, permission, current component ownership and five current desktop viewports.
2. Declare the smallest Warehouse Data Workspace contract needed to test semantic/IA, layout/responsive, component ownership and interaction/accessibility rules.
3. Extend the current Playwright measurement harness to collect screenshot, `ariaSnapshot({ mode: "ai", boxes: true })`, geometry, approved computed styles, viewport and console evidence.
4. Run deterministic rules before AI review. Findings without a reproducible oracle remain `NEEDS_EVIDENCE` or `UNRESOLVED` and cannot authorize production edits.
5. Run read-only AI review only for hierarchy, grouping, balance and information architecture; reject findings that fail the finding schema.
6. Refactor one Warehouse vertical slice at the lowest demonstrated owner.
7. Verify build → structural contract → accessibility → screenshot evidence → responsive contract → AI review, then compare fresh before/after evidence.

### Success criteria

1. Warehouse has one explicit Data Workspace contract and a reproducible evidence manifest for every selected state/actor/viewport.
2. Deterministic rules identify machine-decidable failures before AI and produce selector/box/metric-backed findings.
3. Every accepted AI finding includes evidence, expected, actual, severity and component owner.
4. No production change is justified by screenshot appearance alone.
5. No new component stack, generic page renderer, archetype DSL or speculative framework is introduced.
6. Existing shadcn/Base UI foundation, route/API/cache/permission behavior and database semantics remain unchanged.
7. The phase ends with a bounded contract package suitable for validation on Admin Data, not automatic project-wide rollout.

### Stop conditions

- Stop implementation if Warehouse requires an undeclared Workflow archetype contract.
- Stop promotion if a proposed shared abstraction has only one route consumer.
- Stop closeout on any `FAIL`, `GAP`, `NEEDS_EVIDENCE` or `UNRESOLVED` item inside declared pilot scope.
- Do not update snapshots, baselines or thresholds to convert a failure into PASS.
- Phase 27 cannot close while Phase 27.1 contains any unexplained or unresolved broad visual failure.

## Follow-on promotion decision

The prior Admin Data/Purchasing governance locks were released by Kỳ’s explicit whole-web promotion on 23/08/2026. Phase 28 may audit both routes and implement presentation corrections only when the whole-web baseline identifies an exact owner and acceptance oracle. This does not authorize business workflow, API, permission, cache, schema or data-grain changes.

## Phase 27.1: Non-Warehouse visual reconciliation

**Status:** COMPLETE — all 16 plans and final repeated broad-suite verification pass

**Goal:** Explain, classify and resolve all 21 non-Warehouse failures in `frontend/tests/visual-routes.spec.ts` without laundering production regressions, weakening the visual oracle or broad-updating baselines.

**Requirements:** VREC-01, VREC-02, VREC-03, VREC-04

**Depends on:** Phase 27 implementation and evidence through Plan 27-04; this phase gates Phase 27 final approval rather than Admin Data promotion.

### Success criteria

1. Every one of the 21 failures has expected/actual/diff, deterministic route/state/viewport identity and an owner-level disposition.
2. Production defects are fixed at the lowest demonstrated owner; stale baselines are updated only after semantic/DOM/geometry evidence proves current behavior is intended.
3. No screenshot threshold, viewport, assertion, route fixture or comparison logic is weakened to manufacture PASS.
4. The complete unchanged broad visual suite passes twice consecutively, followed by full frontend unit, lint, dependency-cruiser, production build and hygiene gates.
5. Phase 27 final verification is rerun only after Phase 27.1 closes with zero unresolved item.

**Plans:** 16 plans

Plans:

- [x] 27.1-01-PLAN.md — Immutable original source root and deterministic inventory of all 21 failures (wave 1).
- [x] 27.1-01C-PLAN.md — Immutable historical correction provenance, explicitly `SUPERSEDED_PROTOCOL_INVALID` and non-authoritative (wave 2).
- [x] 27.1-01R-PLAN.md — Additive authoritative reseal with seven byte/blob pins and exact adjacent payload/marker commits (wave 3; depends on 01C).
- [x] 27.1-01F-PLAN.md — Additive executable focused-only browser adapter with child-launch trace and sealed direct-CLI/config bytes (wave 4; depends on 01R).
- [x] 27.1-01V-PLAN.md — Immutable historical marker commit `8502ce701a4070f7be449681ffecbffc36b20056`, classified `SUPERSEDED_PROTOCOL_INVALID`; its plan/evidence bytes are frozen and it grants no authority (wave 5; depends on 01F).
- [x] 27.1-01W-PLAN.md — Sole historical topology-validator authority sealed at marker `47d13805196fd9ab51d0f08c5de44db7fa26a71b` (wave 6; depends on immutable invalid 01V).
- [x] 27.1-02R-PLAN.md — Additive recovery prerequisite sealed downstream-readiness validator authority (wave 7; depends on 01W).
- [x] 27.1-02-PLAN.md — Chef/Purchasing readiness closed from COMPLETE 02R authority (wave 8; depends on 02R).
- [x] 27.1-03R-PLAN.md — Generalize both validators for arbitrary allowlisted Plans 02–07, every downstream identity/class union and exact cumulative/wave accounting; seal immediate marker-only authority without browser/production/snapshot work (wave 9; depends on completed 02).
- [x] 27.1-03S-PLAN.md — Recover partial Plan 03 by making Git accounting class-aware, pinning commits `141da95a`/`3f284626`/`319ae158`, and sealing the ninth root without browser/production/snapshot changes (wave 11; depends on 03R).
- [x] 27.1-03T-PLAN.md — Repair the pre-work-entry closed schema for exact 03S class-aware authority and seal the validator as a marker-only tenth root without browser/source/snapshot/production changes (wave 12; depends on 03S).
- [x] 27.1-03-PLAN.md — Resume Login/Dashboard closeout after COMPLETE 03T, consuming 03T pre-work pins/tenth root while retaining 03S class-aware downstream authority (wave 13; depends on 03T).
- [x] 27.1-04-PLAN.md — Reconcile Meal Orders and Weekly Menu, then aggregate seven core rows under 03T pre-work and 03S class-aware authority (wave 14).
- [x] 27.1-05-PLAN.md — Reconcile Reports, Approvals and locked Admin Data baselines under 03T pre-work and 03S class-aware authority (wave 15).
- [x] 27.1-06-PLAN.md — Reconcile four Purchasing Phase-09 baselines under the research lock and sealed pre-work/class-aware authorities (wave 16).
- [x] 27.1-07-PLAN.md — Two original-harness broad visual passes, fresh Phase 27 review, full gates and WHP-04 closeout under ten-root pre-work authority (wave 17).

## Phase 28: Project-wide UI/UX contract rollout and single-warehouse presentation

**Status:** COMPLETE — all 16 plans closed; full frontend aggregate 186 files / 1,209 tests passes with historical LOST_NO_BACKUP truth preserved

**Goal:** Use the Phase 27 evidence architecture to audit and remediate the whole web application’s information hierarchy, typography, spacing, cards/data containers, tables, responsive behavior and accessibility. Present the real single operational warehouse without false choices or repeated scope while preserving warehouse identity in API, authorization, audit and data-integrity contracts.

**Requirements:** PUX-01, PUX-02, PUX-03, PUX-04, PUX-05, PUX-06, SWH-01, SWH-02, SWH-03

**Depends on:** Phase 27 and Phase 27.1 COMPLETE

### Required sequence

1. Inventory every protected/public route, visible state, table, modal, card/container and shared primitive.
2. Convert authoritative guidance into IPCManagement-local, machine-readable expected values; keep non-deterministic hierarchy/grouping findings in fresh read-only review.
3. Extend the existing measurement harness instead of creating a second audit system.
4. Run a read-only whole-web baseline and classify every finding by exact route/state/viewport and lowest owner.
5. Implement at most three UI remediation waves: foundation/tokens, shared UI seams, then route rollout and verification.
6. Verify focused contracts, full unit/static/build gates, two separately preserved headed browser runs and fresh independent review.
7. Only after UI closeout, implement the separate one-active-warehouse invariant wave with retained IDs/FKs/stock/audit/API authorization/cache contracts and fail-closed zero/multiple behavior.

### Success criteria

1. Every application route has a declared work object, information order, heading/region contract and responsive behavior.
2. Typography and spacing use a finite local token scale; arbitrary route-local recipes are eliminated or explicitly justified.
3. Every card/data container has one purpose and accessible name; nested/decorative containers are removed where evidence identifies them.
4. Every operational table has semantic labeling, type-correct alignment, bounded overflow, deliberate column priority and complete loading/empty/error/stale behavior.
5. The single operational warehouse is shown once as passive context; no false warehouse choice remains in routine UI, while IDs and server enforcement remain intact.
6. No public API, permission, cache identity, database grain or business transition changes as a side effect of presentation rollout.
7. PUX-06 closes with zero `UNRESOLVED` and zero owner-bearing/actionable `FAIL` after remediation of exactly 1,453 owner-bearing baseline `FAIL` findings. The exact 770 identities / 47,208 findings dispositioned `NEEDS_EVIDENCE` remain honest terminal non-`PASS` results unless a separately authorized evidence-capture plan supplies new production measurement provenance; blind review cannot override deterministic rows, and PUX-06 does not require or claim zero `NEEDS_EVIDENCE`.

### Stop conditions

- Do not treat a screenshot or AI taste judgment as an implementation oracle.
- Do not remove warehouse IDs or selectors unless runtime evidence proves exactly one authorized option and the server remains authoritative.
- Do not mix Fiori/Carbon component libraries into the existing shadcn/Base UI stack.
- Do not broaden visual baselines or weaken thresholds to manufacture PASS.

**Plans:** 16 plans

Plans:

- [x] 28-01-PLAN.md — seal the immutable read-only whole-web baseline and canonical reconciliation artifact (wave 1; historical tracked authority remains byte-exact).
- [x] 28-01R-PLAN.md — preserve the lost old hashes as LOST_NO_BACKUP, regenerate through production-route GET/HEAD-only measurement outside Playwright cleanup, and pin a new immutable recovery authority (wave 2; PUX recovery prerequisite).
- [x] 28-02-PLAN.md — consume only the pinned recovery authority, reconcile the existing RED commit without treating it as complete, group exact FAIL findings, remediate Login/Dashboard/shared seams, and freeze bounded attribution (wave 3; PUX only).
- [x] 28-03-PLAN.md — execute the Purchasing tracer and emit an exact residual-key handoff (wave 4; PUX only).
- [x] 28-04-PLAN.md — close non-admin route-owner families and emit the exact admin residual handoff (wave 5; PUX only).
- [x] 28-05-PLAN.md — close Admin Data overflow plus Approval Rules/Advanced Settings exact owners (wave 6; PUX only).
- [x] 28-06-PLAN.md — produce immutable two-run headed remediation evidence outside Playwright cleanup and exact reconciliation (wave 7; PUX only).
- [x] 28-07-PLAN.md — enforce hash-pinned exact-bijection fresh blind review outside Playwright cleanup (wave 8; PUX only; blocking review checkpoint).
- [x] 28-08-PLAN.md — add the observation-only configured exact-cardinality resolver and startup gate (wave 9; SWH-02/SWH-03).
- [x] 28-09-PLAN.md — add the MySQL nullable singleton discriminator unique index and separately authorized activation runbook (wave 10; SWH-02/SWH-03).
- [x] 28-10-PLAN.md — freeze one exact trust-surface inventory and convert DTO/validator/filter compatibility (wave 11; SWH-02/SWH-03).
- [x] 28-11-PLAN.md — convert inventory writes, source lineage, supplemental policy, and filters (wave 12; SWH-02/SWH-03).
- [x] 28-12-PLAN.md — convert purchasing, imports, singleton selector, and authorization compatibility (wave 13; SWH-02/SWH-03).
- [x] 28-13-PLAN.md — regenerate contracts and require exact one-disposition impact-map closure (wave 14; SWH-02/SWH-03).
- [x] 28-14-PLAN.md — replace frontend selection with passive exact-cardinality context and fail-closed commands (wave 15; SWH-01/SWH-02/SWH-03).
- [x] 28-15-PLAN.md — execute exact-three regression plus full static/build/docs closeout (wave 16; SWH-01/SWH-02/SWH-03).

## Phase 29: System operation mode, material reconciliation and project-wide clarity cleanup

**Status:** COMPLETE — protected Retry 16 and independent Plan 29-22 closeout passed

**Goal:** Introduce one server-authoritative, Admin-controlled operation mode with `DEFAULT` and `MATERIAL_RECONCILIATION`; deliver an immutable reconciliation-batch workflow comparing required, purchased and issued material quantities; and apply concise user-language, table-density, empty-state and visual-hierarchy rules across the current default project and the new branch.

**Requirements:** OPM-01, OPM-02, OPM-03, OPM-04, MRC-01, MRC-02, MRC-03, MRC-04, CLR-01, CLR-02, CLR-03

**Depends on:** Phase 28 COMPLETE

**Locked scope:**

- `DEFAULT` preserves the complete current golden path.
- `MATERIAL_RECONCILIATION` retains Dashboard, Weekly Menu, Purchasing, Warehouse, Reports, Admin Data and Admin-only Advanced Settings.
- Coordination, Approvals, Chef Dashboard and Approval Rules are unavailable in reconciliation mode for every role, including Admin.
- Existing permissions remain authoritative within mode-eligible routes.
- Each import creates a frozen reconciliation batch at grain `batch × ingredient identity × canonical unit`.
- Exact required/purchased/issued differences remain visible; warning verdicts use the tolerance frozen with the batch.
- Project-wide clarity rules apply to both modes: remove redundant notes, implementation-language copy, meaningless full-code display, inconsistent spacing/alignment, uncontrolled truncation and weak visual hierarchy without erasing audit identity or business meaning.

**Discovery authority:**

- `.planning/notes/system-operation-mode-and-material-reconciliation.md`
- `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-SPEC-SEED.md`

**Plans:** 24/24 plans executed

Plans:

- [x] 29-23-PLAN.md
- [x] 29-24-PLAN.md
- [x] 29-01-PLAN.md — register the complete operation-mode and reconciliation EF model.
- [x] 29-02-PLAN.md — enforce runtime mode eligibility for every protected MVC query and command before permission.
- [x] 29-03-PLAN.md — add the mutation pre-commit fence and exact direct-save owner manifest.
- [x] 29-04-PLAN.md — fence Approvals and Coordination mutation owners.
- [x] 29-05-PLAN.md — fence Admin and Catalog mutation owners.
- [x] 29-06-PLAN.md — fence Inventory and Planning mutation owners.
- [x] 29-07-PLAN.md — fence Purchasing mutation owners.
- [x] 29-08-PLAN.md — fence Reports and SampleData mutation owners.
- [x] 29-09-PLAN.md — verify neutral owners and close mutation-owner coverage.
- [x] 29-10-PLAN.md — generate/rehearse schema plus deterministic idempotent DEFAULT initialization.
- [x] 29-11-PLAN.md — deliver startup validation, mode API and generated client contracts.
- [x] 29-12-PLAN.md — create immutable draft batches and freeze readiness.
- [x] 29-13-PLAN.md — implement actuals, comparison, disposition, completion and stock isolation.
- [x] 29-14-PLAN.md — implement frontend mode propagation, route/action/preload gates and relocation.
- [x] 29-15-PLAN.md — materialize exact CLR rows from the authoritative evidence harness.
- [x] 29-16-PLAN.md — prove the first bounded route-owner evidence slice.
- [x] 29-17-PLAN.md — prove the remaining bounded route-owner evidence slice.
- [x] 29-18-PLAN.md — close CLR authority at zero actionable production findings without speculative edits.
- [x] 29-19-PLAN.md — deliver reconciliation feature primitives and cross-work-area tracer.
- [x] 29-20-PLAN.md — integrate retained pages and finalize generated contract parity.
- [x] 29-21-PLAN.md — execute exhaustive headed/browser/API/DB evidence and two-session relocation.
- [x] 29-22-PLAN.md — perform multi-source verification, state closeout and baseline-clean hygiene.

**Completion:** Retry 16 passed fresh protected MySQL/API/headed-browser evidence at commit `9e0805cc`; exact `ipc_lane7` is intentionally retained at migration 75 with one completed authority, final mode `DEFAULT`, zero inventory/procurement action and closed owned listeners.

## Phase 30: Closed-loop menu issue reconciliation

**Status:** IN PROGRESS — base closed loop and backend authority boundary complete; bounded local data-isolation slices remain in conceptual waves 4 and 5

**Goal:** Refine `MATERIAL_RECONCILIATION` into one closed workflow: import/select Weekly Menu source, calculate exact material quantities, transfer one frozen issue list to Warehouse, create real source-linked inventory issue documents, then compare required versus warehouse-issued quantities on one compact reconciliation page.

**Requirements:** MRX-01, MRX-02, MRX-03, MRX-04, MRX-05, MRX-06L, MRX-06P

**Depends on:** Phase 29 COMPLETE and backend/FE capability commits through `40619485`

**Locked scope:**

- `DEFAULT` remains unchanged.
- Reconciliation-mode primary navigation is exactly Dashboard, Weekly Menu, Warehouse, Reconciliation and Admin Data.
- Purchasing and Reports are absent from navigation, direct-route eligibility, preload, controls and requests in this mode.
- Weekly Menu retains only Kế hoạch tuần and Định lượng xuất kho.
- Warehouse retains only Danh sách cần xuất and Lịch sử xuất kho for the selected reconciliation source.
- Reconciliation is one top-level no-tab page comparing only frozen required quantity with real Warehouse issued quantity.
- Warehouse issue is the sole stock mutation authority; reconciliation never asks the user to re-enter issued quantity.
- Retained pages remove unrelated default-mode content and hidden owners produce zero requests.
- Historical completed Phase 29 batches remain immutable/readable; no guessed legacy lineage or destructive rewrite.

**Plans:** 3/9 plans executed / 5 conceptual waves

Plans:

- [x] 30-01-PLAN.md — authority tracer: capability, exact Warehouse issue lineage, transfer and required-versus-issued projection (wave 1).
- [x] 30-02-PLAN.md — focused work surfaces: new route, trimmed Weekly Menu/Warehouse/Admin content and zero hidden query ownership (wave 2).
- [x] 30-03-PLAN.md — exact-one backend issue authority and retained endpoint permission matrix (wave 3; complete at `722175f2`).
- [ ] 30-04-PLAN.md — backend Wave 4 slice A: dual-family canonical return/correction, DEFAULT-only supplemental/legacy exception and inactive freeze/resume (depends on 30-03).
- [ ] 30-05-PLAN.md — backend Wave 4 slice B: exact discovered-owner bijection for data-quality, diagnostics, planning, service-run and menu/import persistence (depends on 30-04).
- [ ] 30-06-PLAN.md — backend Wave 4 slice C: exact-family approvals/documents/reports/KPI and labelled shared audit/export (depends on 30-05).
- [ ] 30-07-PLAN.md — backend Wave 4 slice D: frozen facts, stale transaction rollback and exactly-once family-specific stock projection (depends on 30-06).
- [ ] 30-08-PLAN.md — frontend Wave 5 slice A: production two-tab authority channel and sharply bounded inactive-owner cleanup (depends on 30-07).
- [ ] 30-09-PLAN.md — frontend Wave 5 slice B: deterministic RTK request fixture bridge, backend reader and local MRX-06L closeout (depends on 30-08).

**MRX-06 disposition:** Plans 30-03..05 may complete only `MRX-06L` using local deterministic tests and source-aware closure. `MRX-06P` remains **BLOCKED — fresh operator authorization required** for backup-first protected `ipc_lane7` MySQL/API/five-viewport headed evidence and final restoration to `DEFAULT`; these local plans must not access the protected lane and cannot mark MRX-06 or MRX-06P complete.
