---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: — UI Completeness & Conformance
status: Awaiting next milestone
stopped_at: Phase 21 complete; Phase 22 P5 matrix ready
last_updated: "2026-08-02T04:01:23.956Z"
last_activity: 2026-08-02 — Milestone v1.3 completed and archived
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 27
  completed_plans: 27
  percent: 100
current_phase: 25
current_phase_name: p8-pf-permanent-gate
---

# Project State

## Project Reference

See `.planning/PROJECT.md` (updated 2026-08-02).

**Core value:** Every permitted operational action is reachable and equivalent declared
business state produces an equivalent, predictable UI.

**Current focus:** Initialize the approved v1.4 SAP Fiori Visual Conformance milestone.

## Current Position

Phase: Milestone v1.3 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-08-02 — Milestone v1.3 completed and archived

## Verified Baseline

- Phase 18 is complete through `87e92fe` plus documentation/GSD closeout. Goal-backward verification
  passed 8/8 must-haves and milestone v1.2 audit passed 12/12 requirements, 8/8 phases, 7/7
  integrations and 4/4 end-to-end flows. No gap, undispositioned process or Deferred item remains.

- Quick task `260730-wbx` closed at `fbb489e`: unintended WeeklyMenu lifecycle panel removed, two verified
  FE permission gates aligned, PA-2B corrected and operational E2E passed on a disposable clone with
  source lane unchanged. Current gate/evidence pointers are authoritative in `MEMORY.md` and
  `docs/EVIDENCE-INDEX.md`.

- Quick task `260731-15j` records D-01 / Option A: WeeklyMenu DRAFT `Publish` remains intentionally
  **Admin-only**; Manager/Coordinator absence is accepted FE-chặt-hơn-BE, and `OPEN-11`/`DEC-08` are
  closed. This documentation-only closeout changed no production behavior, test, evidence, database or runtime.

- Quick task `260731-27u` closed PA-4 at `8b87470`: all eight frontend literals now belong to the
  backend-generated vocabulary, the checker and root verify pass, and `OPEN-10`/`DEC-03` are closed.
  Backend policy, guard implementation and rendered UI behavior remain unchanged.

- Quick task `260731-3hj` approves DEC-06 as a format-only contract for future
  `CoordinationOrderScopeLifecycle` rows and calibrates the gitignored local `AGENTS.md` GitNexus
  raw/effective risk handling from PA-4
  evidence. No second registry, production/test/evidence code, runtime or database behavior was opened.

- Guarded `ipc_lane1` evidence for week `2026-07-27` is preserved: exact ANV workbook hash, rollback
  backup/mirror, protected lineage, 15 screenshots, 112 successful API responses and five desktop
  viewports. Do not rerun sanitizer/import/reset/seed for closeout.

- Current source gate is authoritative in `MEMORY.md`; strict growth/dependency/lint/build gates remain
  green and PA-4 no longer intentionally stops the root verify pipeline.

- Phase 18 Plan 06 non-mutating checkpoint is green. Root verify passed at Application 49/49,
  API 680 + 1 intentional skip and frontend 80 files/433 tests; contracts are deterministic,
  EF snapshot and five migration contract tests pass, secret/whitespace scans are clean. Final PDG
  compare is LOW at 365 symbols/39 files/0 process; Deferred empty. Guarded E2E is authorized only
  after `ipc_lane1` backup/checksum/lineage checks.

- Phase 18 Plan 05 is complete at `e4ce7fc`. The strict growth gate records exactly ten
  production-only findings, rejects any test debt/new debt/worsening/stale improvement and compares
  the JSON ceiling with the CI base ref. Its six black-box comparator cases, current-tree gate,
  lint and dependency gates pass; staged GitNexus was LOW with 48 symbols and zero affected process.

- Phase 18 Plans 01–04 are complete at `3a787a5`, `8fc7463`, `86ac57d` and `4bee50d`.
  Three backend monoliths and the route-smoke Playwright monolith are decomposed. Route-smoke discovery is
  17/17 with stable title/body fingerprints; focused Chromium, lint and production build pass. Final staged
  GitNexus for Plan 18-04 was LOW with 15 symbols, zero affected process and Deferred empty.

- Branch `feature/workflow-b17-b18`; current Phase 17 implementation baseline is
  `1ca2bbb fix(17-08): close full-gate regressions`. Không push trong phiên này.

- Plans 17-01 through 17-08 are complete. Coordination transport/types/actions and all workflow endpoints
  now have explicit lower/feature owners, Projects has zero Coordination feature imports, and the dependency
  baseline reduced 54 → 44 → 16 → 0 without weakening R1-R6.

- Plan 17-04 full gates passed at 428/428 frontend tests plus lint, dependency-cruiser, production build
  and deterministic API-contract generation. The application has one RTK Query slice with exactly 75
  workflow endpoint keys and 75 hooks.

- GitNexus Plan 17-04 final staged audit reported HIGH risk, 8 changed symbols and 8 expected
  Dashboard/Warehouse overview processes. All were enumerated and handled by the full frontend gates;
  exact Cypher found 38 compatibility-barrel importers and Deferred is empty.

- Plan 17-05 full frontend gates passed at 428/428 tests plus lint, strict dependency-cruiser and build.
  Its HIGH staged audit named six Chef/Coordination/Weekly Menu processes; all six traces were verified at
  confidence 0.85. Final Cypher found zero feature→app/routes edges and zero cycles; Deferred is empty.

- Plan 17-06 split the Admin model into seven panel-owned hooks behind the unchanged compatibility facade.
  Admin tests pass at 12/12 plus lint, zero-violation dependency-cruiser and production build. Its final
  staged audit named five expected Admin processes; Cypher found one facade caller, no moved helper left in
  the facade and no deferred node/process.

- Plan 17-07 split the Reports model into five view-owned hooks behind the unchanged compatibility facade.
  Reports tests pass at 22/22 and the full frontend suite at 433/433 plus lint, zero-violation dependency-
  cruiser and production build. Its staged audit named four expected Reports processes; Cypher found no
  direct endpoint call left in the facade and no deferred node/process.

- Plan 17-08 full gate passed: Application 49/49, API 680 pass + 1 intentional skip, frontend 433/433,
  lint/build/strict dependency/contract determinism and secret/whitespace scans green. Three-viewport headed
  evidence records 30 app routes, 3 Shipyard captures, 96 tab interactions, 48 warm revisits and 64 2xx API
  responses with zero new warm request/error/overflow/CLS/long task. Goal-backward verification passed 7/7.

- No database reset, seed, import or lane mutation occurred during Phase 17 execution.

- OpenAPI remained 152 paths / 396 schemas.
- Step 15 and the Step 16 refactor sequence did not call import endpoints, seed/reset/import a database or access `ipc_lane1`.

## Completed Scope — Step 16

1. **Done (`7e94eb3`):** 53 EF mappings live in 11 feature-owned `IEntityTypeConfiguration<T>` files;
   `IpcManagementContext` is the assembly registration root.

2. **Done (`b37606b`):** execution-strategy transaction runner, duplicate-side-effect regression,
   mapped domain/application exceptions, canonical migration lineage and disposable restore rehearsal.

3. **Done (`f3e7bcd`):** runner adopted across Coordination, Purchasing, Inventory, SampleData, Catalog,
   Reports, Approvals and Admin. Mutable loads occur inside runner operations and every operation has a
   stable database verifier.

4. **Done (`59add79`):** removed unused `IUnitOfWork.BeginTransactionAsync`/`UnitOfWork.BeginTransactionAsync`,
   enabled `EnableRetryOnFailure` and added convention coverage that permits only the runner transaction opener.

5. **Done:** full Step 16 gates and synchronized closeout of ARCH-16A–E.

Restore/hash evidence is valid, but C:/D: matching mirrors are not proof of physically independent/off-site
storage. A NAS/cloud/external-media target remains a non-blocking operational gap.

## Intervening Production Incident and BOM Verification

- User-authorized production synchronization completed at 61/61 tables and 53,404/53,404 rows with zero
  missing table, row-count mismatch or checksum mismatch. Production health and migration checks are Healthy.

- Commit `7e79106` makes the two temporary-key data migrations collation-safe; rerun was idempotent and the
  full source gate above passed.

- Workbook `weekly-menu-template-ANV-default.xlsx` was checked through preview only: 114/114 existing-dish
  rows, 0 new dishes, valid with 0 errors/warnings. The committed ANV menu has 90/90 display dishes with BOM,
  0 matched-without-BOM and 0 unmatched. No repeat import or database mutation occurred during diagnosis.

- The earlier `0/90` display was stale cache after direct restore: backend catalog cache lasts 30 minutes and
  frontend RTK Query cache 5 minutes; direct restore bypasses cache invalidation. Production restore runbook
  must include restart/cache clear. Evidence is in `.artifacts/shipyard-live/production-bom-debug.json` and
  `.artifacts/shipyard-live/production-weekly-menu-bom-debug.png`.

## Gate 16

- Retry cannot duplicate side effects.
- Fresh-install and upgrade lineage are both explained and tested.
- Restore rehearsal meets the documented RPO/RTO target and preserves protected lineage/checksums.
- No production/lane database reset, seed or import.
- Full backend/frontend/contract/dependency/migration gates and staged GitNexus change audit are green.

## Remaining Workflow

- Execute Phases 22 → 25 as a direct addendum mapping: P5; P6; P7; P8 + PF.

- Off-site backup remains an unrelated non-blocking operational follow-up outside milestone v1.3.

## Decisions Made

| Phase | Decision | Rationale |
|---|---|---|
| 16 | Load mutable EF entities inside the transaction-runner operation and require a stable database verifier. | Retry and commit verification clear tracking; external tracked entities could detach or silently skip writes. |
| 16 | Enable `EnableRetryOnFailure` only after retiring the legacy UnitOfWork transaction API and proving one transaction owner with retry regression. | A single execution-strategy-aware owner prevents user-initiated transaction failures and duplicate side effects. |
| 16 | Do not call the C:/D: mirror proven off-site storage. | Logical drive letters do not prove different physical devices or sites. |
| Incident | Do not repeat the production restore/import; direct restore procedures must restart or clear catalog/application caches. | Production is already synchronized, and direct database restore bypasses application cache invalidation. |

- [Phase 17]: Keep exactly one coordination injector and use feature API/type modules only as compatibility re-exports. — Preserves endpoint, hook, cache and existing import contracts without duplicate RTK Query registration.
- [Phase 17]: Move only cross-feature weekly-menu actions to lib while Coordination retains reducer and presentation ownership. — Removes Projects-to-Coordination imports without broadening shared state ownership or changing Redux action types.
- [Phase 17]: Keep workflowApi as a deterministic compatibility barrel over one apiSlice and seven enumerated owner injectors. — Preserves all 75 endpoint and hook contracts while assigning implementation ownership.
- [Phase 17]: Keep employee administration endpoints outside workflow registration and expose approval-rule hooks through adminWorkflowApi plus adminApi re-exports. — Prevents five unrelated employee endpoints from expanding the exact 75-key workflow surface.
- [Phase 17]: Permit only exact compatibility-barrel-to-owner imports through a milestone-v1.3 dependency rule. — Supports the stable barrel without expanding the known dependency violation baseline.
- [Phase 17]: Keep app/routes on the exact store-typed dispatch hook while feature callers use a lower thunk-capable dispatch primitive. — Feature modules no longer depend on app, while logout orchestration retains the configured store dispatch contract.
- [Phase 17]: Keep full Coordination state typing feature-owned and expose only the cross-feature read projection needed by Chef and Projects. — Removes reverse imports without making presentation state a shared contract.
- [Phase 17]: Keep useAdminDataPageModel as the sole AdminDataPage API while seven unconditional panel hooks own query, state and mutation behavior. — Preserves all panel props and UI behavior while removing the 784-line ownership monolith.
- [Phase 17]: Keep cross-panel customer-contract and current-stock queries in Contracts and Inventory owners. — Avoids duplicate endpoints/cache subscriptions while preserving the BOM/Statistics skip contracts.
- [Phase 17]: Keep Reports URL/permission/reset orchestration facade-owned and place query transforms plus CSV columns in five view owners. — Preserves cross-view navigation and export behavior without recreating a page-model monolith.
- [Phase 17]: Close Gate 17 only when one-api-slice, public/cache, dependency, full regression, headed browser, GitNexus and documentation evidence agree. — Risk controls rigor rather than scope; every caller and affected process must be handled with no Deferred item.
- [Phase 18]: Use five desktop browser-gate viewports: 1920x1080, 1440x900, 1366x768, 1365x900 and 1280x900; remove 768x1024. — User explicitly replaced the tablet viewport on 2026-07-29; tablet/mobile remain out of the default gate.
- [Quick 260731-3hj]: Approve DEC-06 format-only: `CoordinationOrderScopeLifecycle` uses
  `scenario × operation`, adds `scope`, and separates `entityState` from `projectionState`. — The schema is
  durable without opening a CoordinationOrder registry or implementation.

- [Quick 260731-3hj]: Keep GitNexus raw risk as evidence while deriving effective rigor from verified
  directed production/control/data-flow impact. — PA-4 demonstrated that import-only transitive closure can
  falsely escalate docs/literal work; unresolved edges retain raw risk and full scope.

- [Phase 19]: Materialize `CoordinationOrderScopeLifecycle` as a test-owned executable registry with
  `scenario × operation` rows, row-level `scope`, separate `entityState`/`projectionState`, and shared FE/BE
  family coverage. — The registry projects importable code and guards the remaining source-linked debt without
  entering production.

- [Quick 260731-8me]: Classify intended diffs as graph-free, lightweight graph or full analysis before any
  GitNexus call. — Semantic risk now selects rigor; docs/leaf assertions avoid graph ceremony, behavior-bearing
  test/config contracts keep source-aware closure, and production/API/auth/migration work retains full impact.

- [Milestone v1.3]: Skip external design research and derive canon from the approved PB ballot/live code. —
  The addendum explicitly warns that agent-authored canon would create another variant.

- [Milestone v1.3]: Use delegated brainstorm authority only to resolve a choice inside an authorized
  addendum block; record alternatives and evidence, but do not derive new scope from the choice.

- [Milestone v1.3]: Map Phase 21–25 directly to PE, P5, P6, P7 and P8+PF. — GSD may split execution
  inside a named block, but may not create unsourced phase goals, finding quotas, golden-screen quotas,
  DOM-instrumentation programs or acceptance criteria.

- [Phase 20]: Visible frontend controls do not resolve canonical UNKNOWN dimensions; KHỚP requires known operation, actor, backend permission and frontend permission.
- [Phase 20]: Plan 20-02 evidence is FE-fixture-read-only; canonical operations with controls are exercised through intercepted requests and post-action evidence, without backend/DB mutation.
- [Phase 20]: Aggregate control evidence uses truthful accessible role/name or label selectors guarded against production source drift.
- [Phase 20]: Defer all production PD candidates: THIẾU/MỒ CÔI/IM LẶNG are zero, 15 LỆCH VỊ TRÍ are downstream route denials with explicit disposition, and visible controls do not resolve canonical UNKNOWN debt.

## Deferred Items

Items acknowledged at milestone v1.3 close on 2026-08-02:

| Category | Item | Status |
|----------|------|--------|
| todo | \`weekly-menu-browser-uat.md\` | Carry forward into milestone v1.4 SAP Fiori visual conformance and evidence verification |
| todo | \`customer-weekly-menu-template-workbench.md\` | Deferred product feature outside milestone v1.4; remains pending without being treated as completed |

## Blockers

- Non-blocking operational gap: configure and verify a genuinely off-site production backup target; the current C:/D: mirror proves copy integrity and disposable restore only.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260730-jc9 | PE ConfirmDialog: inventory contracts and migrate the low-risk Admin BOM caller | 2026-07-30 | 37c04a1 | [260730-jc9-pe-confirmdialog-inventory-confirmation-](./quick/260730-jc9-pe-confirmdialog-inventory-confirmation-/) |
| 260730-jvq | PE ConfirmDialog: migrate ApprovalRulesPage deletion confirmation | 2026-07-30 | bdbfa5b | [260730-jvq-pe-confirmdialog-migrate-approvalrulespa](./quick/260730-jvq-pe-confirmdialog-migrate-approvalrulespa/) |
| 260730-k8i | PE ConfirmDialog: replace MaterialDemandSection window.confirm | 2026-07-30 | 3d0caee | [260730-k8i-pe-confirmdialog-replace-the-remaining-m](./quick/260730-k8i-pe-confirmdialog-replace-the-remaining-m/) |
| 260730-la8 | PE Feedback: canonicalize feedback by context across continuous slices | 2026-07-30 | d61a96a | [260730-la8-canonicalize-pe-feedback-continuously-ac](./quick/260730-la8-canonicalize-pe-feedback-continuously-ac/) |
| 260730-rfr | PA closeout: architecture-clean registry guards and durable permission evidence | 2026-07-30 | d26a452 | [260730-rfr-pa-closeout-make-registry-source-guards-](./quick/260730-rfr-pa-closeout-make-registry-source-guards-/) |
| 260730-rws | PB inventory: discover every recurring UI concept, count variants and prepare canon ballot without changing production code | 2026-07-30 | 51b99db | [260730-rws-pb-inventory-discover-every-recurring-ui](./quick/260730-rws-pb-inventory-discover-every-recurring-ui/) |
| 260730-tx0 | Read-only P3 to P4 to PC audit: map WeeklyMenu DOM controls to source, capture headed Chrome interaction points across required viewports and compare against the approved one-object PA registry without changing behavior | 2026-07-30 | 8635ce4 | [260730-tx0-read-only-p3-to-p4-to-pc-audit-map-weekl](./quick/260730-tx0-read-only-p3-to-p4-to-pc-audit-map-weekl/) |
| 260730-uno | PA-2B WeeklyMenuLifecycle: add actor/downstream registry, terminal-none contract, read-only fixture and PC rerun without opening PD | 2026-07-30 | 4e9ee5b | [260730-uno-pa-2b-weeklymenulifecycle-extend-the-exe](./quick/260730-uno-pa-2b-weeklymenulifecycle-extend-the-exe/) |
| 260730-wbx | Remove unintended WeeklyMenuLifecyclePanel, align two verified FE gates and run real operational lifecycle E2E without mutating the source lane | 2026-07-31 | fbb489e | [260730-wbx-remove-unintended-weeklymenulifecyclepan](./quick/260730-wbx-remove-unintended-weeklymenulifecyclepan/) |
| 260731-15j | Record Option A for WeeklyMenu DRAFT Publish and close OPEN-11/DEC-08 without behavior change | 2026-07-31 | 3e364a2 | [260731-15j-record-option-a-for-weeklymenu-draft-pub](./quick/260731-15j-record-option-a-for-weeklymenu-draft-pub/) |
| 260731-27u | Resolve PA-4 by canonicalizing all eight frontend permission literal callsites without changing authorization behavior | 2026-07-31 | 8b87470 | [260731-27u-resolve-pa-4-by-canonicalizing-all-eight](./quick/260731-27u-resolve-pa-4-by-canonicalizing-all-eight/) |
| 260731-3hj | Approve DEC-06 format-only and calibrate local branch-aware GitNexus raw/effective risk policy | 2026-07-31 | 94cf3c4 | [260731-3hj-approve-dec-06-format-and-calibrate-gitn](./quick/260731-3hj-approve-dec-06-format-and-calibrate-gitn/) |
| 260731-8me | Calibrate GitNexus into graph-free, lightweight-graph and full-analysis lanes | 2026-07-31 | 7e55f6c | [260731-8me-calibrate-gitnexus-rules-with-explicit-g](./quick/260731-8me-calibrate-gitnexus-rules-with-explicit-g/) |

## Session

**Last Date:** 2026-07-31T03:27:03.259Z

**Stopped At:** Phase 21 complete; Phase 22 P5 matrix ready

Last activity: 2026-08-02 - Phase 21 verified 27/27; root gate and 28-process disposition pass

**Resume File:** .planning/ROADMAP.md

## Constraints

- Do not push or reset.
- Do not seed/import/reset or further mutate `ipc_lane1`; preserve the completed Phase 18 week/evidence.
- Do not rewrite, delete or move applied migrations.
- Follow the calibrated `AGENTS.md` classifier: graph-free uses no GitNexus call; lightweight uses
  source-aware closure plus one final detect; full-analysis production changes use two-way impact and
  raw/effective-risk disposition.

- Browser evidence is required only for frontend/route/UI behavior changes until the final workflow closeout.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 17 P01 | 8 min | 2 tasks | 4 files |
| Phase 17 P02 | 30min | 2 tasks | 16 files |
| Phase 17 P03 | 25min | 2 tasks | 39 files |
| Phase 17 P04 | 39min | 4 tasks | 14 files |
| Phase 17 P05 | 15min | 2 tasks | 24 files |
| Phase 17 P06 | 26min | 1 tasks | 11 files |
| Phase 17 P07 | 16min | 1 tasks | 10 files |
| Phase 17 P08 | 77min | 3 tasks | 16 files |
| Phase 18 P04 | 46min | 1 tasks | 10 files |
| Phase 18 P05 | 18min | 1 tasks | 7 files |
| Phase 18 P06 | 13min | 2 tasks | 2 files |
| Phase 18 P07 | 73min | 2 tasks | guarded DB/E2E + 4 atomic commits |
| Phase 18 P08 | 35min | 2 tasks | documentation/verifier/audit |
| Phase 19 P01 | 16 min | 1 task | protected-family inventory and source guards |
| Phase 19 P02 | 10 min | 1 task | Coordination lifecycle scenarios and format |
| Phase 19 P03 | 17 min | 1 task | executable family registry and FE/BE parity |
| Phase 19 P04 | 7m 40s | 1 task | exact debt ranges and drift probes |
| Phase 20 P02 | 1h 58m | 3 tasks | 3 files |
| Phase 20 P03 | 18 min | 3 tasks | 2 files |
| Phase 20 P04 | 25 min | 3 tasks | verification and closeout |
| Phase 21 P01 | 14 min | 2 tasks | date-only formatter canon slice |
| Phase 21 P02 | 12 min | 2 tasks | Admin BOM table boundary canon slice |

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
