# Subagent run b3fba5e1-ca39-4c6e-9f5d-37a253d1a04d

- **Mode:** single
- **CWD:** D:\Kì 7\PRN222 Doanh Nghiệp\IPCManagement
- **Started:** 2026-09-15T10:10:01.234Z
- **Ended:** 2026-09-15T10:16:04.654Z
- **Duration:** 6m3s
- **Session:** C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\2026-09-15T04-53-45-769Z_01a0a369-f6a8-7370-ba7d-0f6a77ac3ec8\6eaa8d89-ec44-480d-8be4-0443d8e56cd8\run-0\session.jsonl
- **Artifacts:** C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\subagent-artifacts

## Steps
| Step | Agent | Status | Duration |
| --- | --- | --- | --- |
| 1 | oracle | complete | 6m3s |

## Summary
oracle:
# Authority review — `AGENT_REAUDIT_AND_REMEDIATE.md`

## Inherited decisions

- `AGENTS.md` is the startup and safety authority; `MEMORY.md` owns current state/runtime pointers; `docs/README.md` selects canonical contracts.
- Pi is the sole runtime. GSD remains the only process/checklist/verdict owner.
- The only active checklist is `.planning/notes/WHOLE-PAGE-BUSINESS-COMPOSITION-PLAN.md` §10. This re-audit must be added there as one continuation, not started as another plan or campaign.
- The downloaded brief is an untrusted hypothesis list, not an accepted defect report. Project contracts and current source/runtime take precedence.
- Current branch is `main`, ahead of `origin/main` by one commit, with an extensively dirty inherited worktree. Every inherited tracked/untracked file must be preserved.
- No reset, restore, checkout, clean, stash, stage, commit, push, deploy, schema change, seed, database mutation, credential creation, operation-mode switch, or destructive cleanup is authorized.
- User runtimes `5173/5262` must not be used or stopped. Future browser work must use owned `3001/8001`, an owned PID manifest, and exact teardown.
- No GitNexus work is authorized.
- DEFAULT/MATERIAL_RECONCILIATION separation, permissions, URL/deep-link behavior, query scope, data grain, immutable history, validation, data-loss protection, and accessibility must be preserved.
- Source/runtime wins over stale narrative. Historical evidence is lineage, not automatic certification of the current dirty tree.
- Whole-FE acceptance remains unverified. The completed 385-rule disposition is coverage accounting, not a whole-app compliance PASS.
- The current task is read-only authority/process review. It does not authorize remediation or browser/database execution.

## Diagnosis

The downloaded brief is directionally compatible with the project: it treats its claims as hypotheses, requires evidence before optimization, rejects speculative memoization/caching/indexing, distinguishes initial loading from refreshing, and prefers fixes at existing shared owners.

The principal problem is not its technical intent; it is that it defines a second, broad execution process and uses “whole codebase/every hypothesis/fix everything” language without the project’s denominator, state-matrix, runtime-identity, evidence, authorization, and single-checklist controls. Executed literally, it would repeat substantial completed work, open an unbounded audit, and encourage unsupported whole-system conclusions.

The right interpretation is:

1. Convert the brief into exactly 17 hypothesis families.
2. Freeze source denominators before inspecting implementations deeply.
3. Reconcile each family with current source gates and historical lineage.
4. Run runtime profiling only for source-supported hot-path candidates.
5. Remediate only confirmed findings, serially, under the existing §10 ledger.
6. Keep every unmeasured or unauthorized cell as `NEEDS_EVIDENCE` or `BLOCKED`.

### Authority precedence for this objective

1. `AGENTS.md` — permissions, startup, runtime and destructive-action boundaries.
2. `MEMORY.md` — active checklist, current dirty baseline, ports/lane, current residuals.
3. `docs/README.md` — canonical-document selection and lifecycle.
4. `docs/harness/DELIVERY.md` — L0/L1/L2, red-capable seam, one ledger/checklist.
5. `docs/UI-UX-EXECUTION-HARNESS.md` — claim envelope, state matrix, browser identity and evidence.
6. `docs/UI-UX-MEASUREMENT-PROTOCOL.md` — repeatable geometry/performance oracles.
7. `docs/DASHBOARD-UI-RULES.md` — adopted UI/performance rules, especially C1–C12 and F1–F24.
8. `docs/DESIGN.md` — geometry roles and lowest-owner hierarchy.
9. `docs/FRONT-END-CHECKLIST-INTEGRATION.md` — external checklist adapter only.
10. Current source/tests/runtime.
11. Historical evidence and dated audits.
12. Downloaded re-audit brief.

`docs/ARCHITECTURE-AUDIT-2026-07-26.md` contains useful historical NFR measurements and rationale, but it is a dated audit, not the current process owner. Current performance requirements come primarily from the adopted `DASHBOARD-UI-RULES.md`; old measurements can establish lineage only after source/build identity is reconciled.

## Drift / contradiction check

### 1. Second process owner

**Brief trajectory:** “READ RULES → re-audit every hypothesis → fix → profile → report” as a standalone campaign.

**Conflict:** GSD and Lean Delivery already own the process. One sequential objective must use one plan, checklist, and finding ledger.

**Resolution:** Translate the brief into a new phased subsection of the existing §10 checklist. Do not create another `.planning` plan, root-doc audit, or parallel state system.

---

### 2. Unbounded “whole codebase” wording

**Brief trajectory:** inspect all frontend fetching, pages, lists, overlays, backend paths, repositories, database access, and every hypothesis.

**Conflict:** The user explicitly says not to inspect every implementation. The harness requires a declared claim envelope and denominator rather than an exhaustive source crawl.

**Resolution:** Inventory exact owners first, then trace only:
- discovered shared owners;
- source-supported same-pattern occurrences;
- selected hot paths;
- endpoints reached by those hot paths;
- mutations/invalidation families attached to confirmed candidates.

“Not inspected” must be `NOT_CLAIMED`, not PASS.

---

### 3. Severity is assigned before evidence

**Brief trajectory:** labels layout shift, refetch replacement, waterfall, invalidation, and render blast radius as default P0 priorities.

**Conflict:** Project delivery requires source/runtime evidence before severity and prioritization. A candidate category is not automatically a P0 defect.

**Resolution:** Keep the ordering as a triage preference only. Assign `P0/P1/P2/P3` after evidence demonstrates impact, breadth, and reproducibility.

---

### 4. Missing denominator and cell reconciliation

**Brief gap:** no formula ensures every hypothesis, route/state, endpoint, or finding is accounted for.

**Project requirement:** every required cell must appear exactly once in:

`PASS | FAIL/OPEN | NEEDS_EVIDENCE | NOT_APPLICABLE | BLOCKED`

**Resolution:** Use the denominators and equality gates proposed below.

---

### 5. Runtime performance evidence is underspecified

**Brief trajectory:** use Network, React Profiler, backend logs, database plans “if the project can run.”

**Conflict:** Performance claims require:
- production build, not Vite development;
- aligned FE/BE identity;
- owned PID/ports;
- authenticated operation mode/version/capabilities;
- database target/readiness;
- exact action and owner attribution;
- immutable evidence;
- long-task/CLS/INP traces where claimed.

**Resolution:** A dev runtime, fixture-only run, screenshot, elapsed wait, or route-load success cannot certify production performance.

---

### 6. Lab metrics versus field p75

**Brief trajectory:** collect LCP/INP/CLS and report before/after.

**Conflict:** `DASHBOARD-UI-RULES.md` F1 defines p75 Core Web Vitals. A bounded local run does not establish field p75.

**Resolution:** Namespace results:
- `PASS_LAB_BOUNDED` for controlled production-build samples;
- `NEEDS_EVIDENCE_FIELD` for real-user p75/RUM;
- never call local maximum/median “p75” unless the approved sampling method actually supports it.

Production monitoring/RUM remains an open deployment-owned requirement.

---

### 7. Blanket skeleton/footprint guidance is too broad

**Brief trajectory:** retain table headers/pagination shell and consider skeleton rows for stable layout.

**Conflict:** Project rules forbid synthetic rows, `rowCapacity`, page-size-derived `min-height`, and large reserved blank surfaces. Geometry must follow `compact | section | table | workspace`, and paginated tables use real content height with focus/scroll preservation.

**Resolution:** Skeleton parity applies only where the real content geometry is known and useful. Empty/prerequisite states must collapse to one purposeful state surface rather than reserve fake table height.

---

### 8. Alert placement needs the stronger project constraint

**Brief trajectory:** use a stable warning region when suitable.

**Conflict:** C6 and the measurement protocol prohibit mounting a new refresh/banner block that shifts header/toolbar/table geometry.

**Resolution:** Use an already-owned header/toolbar/state slot, overlay, or geometry-free live region. Do not reserve a large blank warning area for rare alerts.

---

### 9. Modal requirements cannot be applied mechanically

**Brief trajectory:** audit click-outside, Escape, focus trap, scroll lock, nested modal, and related behavior.

**Conflict:** Whether outside-click or Escape closes a particular destructive/in-flight dialog depends on the existing canonical dialog and workflow contract. A generic checklist cannot override data-loss prevention.

**Resolution:** Audit all listed dimensions, but expected behavior comes from shared Dialog/Drawer rules and the workflow’s safety contract. Drawer and blocking dialog behavior must remain distinct.

---

### 10. Responsive scope is broader than current support

**Brief trajectory:** regression checklist includes responsive behavior without a support envelope.

**Conflict:** The current supported default is the canonical desktop matrix. Mobile/tablet is not automatically claimed. The full D06 support denominator is much larger and requires OS/browser-version/zoom/motion/NVDA evidence.

**Resolution:** Default browser denominator is `1366×768`, `1440×900`, `1920×1080`. Add mobile/tablet only by explicit owner request or when reproducing a supplied out-of-matrix screenshot.

---

### 11. Mutation and invalidation evidence may require forbidden writes

**Brief trajectory:** validate mutation → invalidation → refetch behavior and complete mutation success/failure regression flows.

**Conflict:** No business mutation is currently authorized, and protected data cannot be changed merely to obtain evidence.

**Resolution:**
- use store/component integration tests or intercepted fixture evidence for source-level invalidation/deduplication;
- retain real mutation runtime cells as `BLOCKED_AUTHORIZATION` unless the owner separately approves an isolated/disposable lane;
- if later authorized, require FE control → request/response → DB transition → reload render.

---

### 12. Database profiling needs a narrower gate

**Brief trajectory:** inspect execution plans and add indexes only with evidence.

**Compatible but incomplete:** the project also requires preserving lanes, reading relevant evidence/lineage first, and reading `LESSONS.md` before database/browser measurement work.

**Resolution:** No index/schema change without:
- source-supported hot query;
- repeated timing/query-count evidence;
- production-like MySQL `EXPLAIN`/actual plan evidence;
- row/selectivity/frequency context;
- focused regression;
- separate schema/migration authorization and backup gates.

A `WHERE`, `JOIN`, or `ORDER BY` occurrence alone is not a finding.

---

### 13. Full-project quality PASS may be impossible on the inherited tree

**Brief trajectory:** work completes only when lint, type-check, tests, and build pass.

**Conflict:** The worktree contains extensive inherited changes and known broad-suite drift. Lean Delivery forbids calling a failure pre-existing without a baseline, but also forbids unrelated cleanup.

**Resolution:** Require:
- focused red→green seam;
- affected feature suites;
- changed-file lint;
- relevant build/API parity;
- before/after comparison for broader failures;
- exact inherited residuals.

Do not require opportunistic repair of unrelated failures, and do not turn focused PASS into whole-project PASS.

---

### 14. Documentation maintenance is omitted

**Brief gap:** it does not mention the project requirement that code changes update relevant canonical docs in the same task.

**Resolution:** Any confirmed reusable invariant or changed contract must be classified as:
- `EXISTING_RULE`;
- `RULE_AMBIGUITY`;
- `RULE_GAP`;
- `ENFORCEMENT_GAP`;

and update the smallest canonical owner plus a red-capable regression. Do not create a dated root-doc report as another authority.

---

### 15. Git and runtime safety are omitted

The brief does not protect:
- inherited dirty files;
- task/user port separation;
- exact owned teardown;
- operation-mode preservation;
- secret redaction;
- one writer per cwd;
- immutable failed evidence.

All project boundaries remain mandatory.

## Already-completed coverage that must not be repeated as if absent

| Area from downloaded brief | Existing coverage | Current interpretation |
|---|---|---|
| Semantic query state | Typed `QueryView<T>`/`QueryViewBoundary` and state tests cover uninitialized, loading, ready-empty, ready, refreshing, partial, forbidden and error | Reconcile current owners and residual occurrences; do not invent another async-state abstraction |
| Initial versus refreshing | Major Purchasing, Approval, Reports, Admin, Chef, Coordination, Dashboard and Warehouse seams historically migrated; refreshing retains stale data | Existing source/tests are evidence at bounded seams; current browser certification still needs exact-current runtime |
| Broad invalidation | Historical exact-tag remediation reduced a representative mutation from 10/10 refetches to 2/10 | Revalidate current tag owners before declaring H05 confirmed; do not restart from the assumption all invalidation is broad |
| Duplicate requests | Request ownership/deduplication and exact-mutation single-flight were previously implemented and tested | New claims require a current source/runtime reproducer |
| Route code splitting | Route loaders, intent preload, loader cache and route gzip budgets already exist | Build/budget enforcement is not runtime LCP/INP certification |
| Async visual stability | Historical controlled browser runs recorded stale-content refresh, zero/low CLS and no long tasks for bounded states | Historical evidence is lineage only because current source/worktree has changed |
| Page/query ownership | Prior composition and QueryView work split several oversized page/query owners | File length alone remains invalid evidence; measure actual state/render/query blast radius |
| Backend N+1/over-fetch | Historical fixes include Approval inbox batching and server-side report projections | Trace only selected hot endpoints; do not reopen all repositories by default |
| API payload/read DTO | Existing server-side projections and generated OpenAPI contract gates exist | Payload optimization requires measured unused bytes/consumer trace and compatibility review |
| Database performance | Historical k6 and query-plan work exists, including price variance aggregation moved to SQL | No current DB bottleneck or index need is established |
| Table/empty geometry | Canonical table, geometry-role, empty/prerequisite and pagination rules already exist | Audit current consumers against them; do not create a second table abstraction |
| Dialog/Drawer | Shared dialog/drawer primitives and M2.12 geometry/focus contracts exist; G1 dialog spacing was completed | Audit consumer exceptions and runtime behavior, not another modal system |
| Scroll/resize layout work | G6 dish picker rAF coalescing is `PASS_FOCUSED/REVIEW_OK` | Real browser timing/geometry remains `NEEDS_EVIDENCE`; do not reimplement the fix |
| App render/chunk recovery | G7 error boundary is `PASS_FOCUSED/REVIEW_OK` | Monitoring/RUM/release correlation remains OPEN; do not report “no error boundary” from the older corpus ledger |
| Front-End Checklist | All 385 upstream rules are dispositioned with no missing or duplicate slug | Corpus accounting is complete; the new re-audit should consume the ledger, not re-run or dump all rules |
| JS/performance/testing corpus | Original ledger totals: 81 = 20 enforced + 18 open + 24 needs-evidence + 18 contextual N/A + 1 conflict-blocked | Several rows are now superseded by G6/G7/G12–G14; reconcile statuses rather than copying the old totals as current |
| Whole-page composition | Current checklist records bounded `18/18 PASS_COMPOSITION` for six DEFAULT family/view groups | This does not prove async performance, populated states, backend/DB efficiency, or whole-FE compliance |

Important stale-ledger corrections:

- `SearchableDishPicker` unthrottled layout work is no longer OPEN at source level; G6 closed it, browser evidence remains open.
- Missing app error boundary is no longer OPEN at source level; G7 closed it, monitoring remains open.
- Production console enforcement and preference-storage gaps have also received focused remediation.
- Historical browser and performance records cannot be promoted to current-source PASS without build/runtime identity reconciliation.

## Evidence requirements

### Source/test evidence can establish

- existence and callsites of shared async/table/dialog owners;
- whether stale data is retained during `isFetching`;
- query skip/activation ownership;
- RTK Query tag/key/invalidation topology;
- conditional request dependencies;
- obvious frontend/backend loop-query patterns;
- paging/filtering/projection location;
- DTO field consumption;
- stable keys and expensive calculations visible in source;
- focused component/store behavior under deterministic fixtures;
- regression seam correctness.

### Runtime evidence is mandatory for

- actual request waterfall and concurrency;
- request count, TTFB, transfer and decoded payload;
- actual duplicated requests;
- CLS and layout-shift attribution;
- LCP/INP/long-task claims;
- React render count, commit duration, and render reasons;
- scrollbar/scroll-anchor/focus behavior through transitions;
- modal open/close timing and focus return;
- real API/backend/DB timing decomposition;
- N+1 query count per request;
- execution-plan/index claims;
- before/after performance improvement.

### Browser evidence contract

Each future run must record:

- branch and exact source/build identity;
- FE/BE owned PID, port, and artifact paths;
- Release/production-build status;
- database lane/readiness/migration health;
- authenticated operation mode, version, and capabilities;
- route/view/state/actor/viewport/action cell;
- request/response ledger and prohibited writes;
- console/page/request errors;
- before/during/after DOM geometry;
- focus and scroll owner where applicable;
- PerformanceObserver/trace records for claimed metrics;
- final screenshot for review only;
- `verdict`, `failures[]`, and `needsEvidence[]`;
- exact owned teardown.

### React profiling contract

For each render finding:

- exact interaction;
- component/subtree owner;
- baseline render count and commit duration;
- render reason or changed prop/context/selector;
- representative data size;
- production build/profile mode;
- before/after result.

A new object/function literal is not automatically a defect. Memoization requires measured impact or a contract-specific large-list violation.

### Backend/database evidence contract

For each selected endpoint:

- route/view/action that calls it;
- controller → service → repository/query owner;
- request count and correlation identity;
- total endpoint duration;
- DB query count and DB duration;
- rows read/returned;
- projection/paging/filtering location;
- payload compressed/uncompressed size where measurable;
- plan evidence only when a database change is proposed.

No DB index, schema, or repository architecture change is authorized by static suspicion.

## Recommendation

Append one new subsection to the existing §10 checklist, using the following phased checklist. Do not create another mission, plan, or dated canonical document.

# Proposed comprehensive phased checklist

## R0 — Authority, baseline, and claim lock

- [ ] Record branch, HEAD, index state, full dirty-status count, current active §10 pointer, current runtime listeners, and protected user ports.
- [ ] Record the read-only reconnaissance boundary: no production edits, runtime, backend writes, database writes, mode switch, credentials, Git actions, or GitNexus.
- [ ] Freeze the canonical authority list used for this objective.
- [ ] State that the downloaded document is a hypothesis source only.
- [ ] Freeze the supported default browser matrix as three desktop viewports; mark D06 cross-browser/current-previous/zoom/motion/NVDA as outside the initial claim unless separately selected.
- [ ] Read `LESSONS.md` before any later browser measurement or database profiling phase.
- [ ] Establish one finding ledger in §10:

`ID | hypothesis | severity | area | claim cell | source/runtime evidence | root owner | same-pattern denominator | result | validation | verdict`

### R0 denominator

`D_authority = 1 active checklist + 1 finding ledger + 17 hypothesis records`

### R0 acceptance gate

- `activeChecklists = 1`
- `findingLedgers = 1`
- `hypothesisRecords = 17`
- zero production/runtime/database/Git changes
- verdict: `PASS_AUTHORITY` or `BLOCKED`

---

## R1 — Exact denominator and historical reconciliation, no code

Create these 17 hypothesis records:

| ID | Hypothesis family |
|---|---|
| H01 | Async content footprint and late large-block insertion |
| H02 | Initial loading versus background refreshing |
| H03 | Independent multi-query resolution and semantic section readiness |
| H04 | Page orchestration and render blast radius |
| H05 | Query cache keys, invalidation breadth and duplicate requests |
| H06 | Unnecessary frontend/backend request waterfall |
| H07 | Async alert/warning/banner insertion |
| H08 | Empty-state semantic variants and geometry |
| H09 | Table loading/refresh/empty/error/paging/filter/sort contract |
| H10 | React rerender/context/derived-data hotspots |
| H11 | Frontend list size, keys, calculations and virtualization applicability |
| H12 | Backend read path, projection, tracking, paging, filtering and sorting |
| H13 | Frontend and backend N+1 |
| H14 | Database bottleneck and index evidence |
| H15 | API payload/unused-field/duplicate-metadata cost |
| H16 | Dialog/drawer/overlay async, focus and geometry behavior |
| H17 | Visual stability: CLS, content resize, fonts, modal scrollbar and async transitions |

Freeze inventories from current source owners rather than historical counts:

- `D_routes`: actual route/mode/view rows from current registry.
- `D_queryOwners`: import-resolved mounted query-owning boundaries.
- `D_mutations`: mutation definitions with exact invalidation/key behavior.
- `D_sharedAsync`: shared QueryView/async-state boundary owners.
- `D_tables`: import-resolved shared and raw table occurrences.
- `D_overlays`: shared Dialog/Drawer consumers plus distinct local overlay declarations.
- `D_largeLists`: list/table owners that can exceed project thresholds or have representative large fixtures.
- `D_candidateEndpoints`: endpoints reached by selected hot route/view interactions.
- `D_historicalClaims`: relevant existing evidence claims, each marked current, stale, superseded, or lineage-only.

For every H01–H17, record:

`CONFIRMED_CURRENT | PARTIAL_CURRENT | NOT_FOUND_CURRENT | INTENTIONAL | NEEDS_RUNTIME | BLOCKED | NOT_APPLICABLE`

No hypothesis may receive current PASS solely from history.

### R1 denominator equations

- `17 = confirmed + partial + notFound + intentional + needsRuntime + blocked + notApplicable`
- `D_routes = reconciledRouteRows`
- `D_queryOwners = classifiedQueryOwners`
- `D_mutations = classifiedMutationOwners`
- `D_tables = classifiedTables`
- `D_overlays = classifiedOverlays`
- `D_historicalClaims = current + stale + superseded + lineageOnly`

No missing or duplicate owner identity is allowed.

### R1 acceptance gate

- every denominator has a reproducible discovery command or current registry pointer;
- every occurrence has exactly one owner and disposition;
- historical G6/G7 and other completed work is not reopened as an unfixed defect;
- no performance PASS is inferred;
- verdict: `PASS_DENOMINATORS`, otherwise `FAIL_REPORT`.

---

## R2 — Bounded source and test trace, no remediation

For each H01–H17:

- [ ] Inspect only the shared owner, representative consumers, same-pattern occurrences, and selected hot route owners.
- [ ] Reuse existing `QueryView`, table, Dialog/Drawer, route loader, API slice, repository, and projection patterns.
- [ ] Trace mutation → invalidated keys/tags → subscribed queries for candidate invalidation findings.
- [ ] Trace request dependency edges and mark each as `required dependency` or `parallel candidate`.
- [ ] Trace selected endpoint paths only through controller → service → repository/query.
- [ ] Record already-existing focused regressions and whether they still compile/run on the current tree.
- [ ] Reject file length, `.map()`, `isFetching`, `Include`, missing `AsNoTracking`, or index absence as standalone proof.
- [ ] Produce a ranked candidate list, but do not assign P0 merely from category.

### R2 finding acceptance

Every source-supported finding must include:

- exact symptom or risk;
- route/mode/actor/state/grain;
- owner and callsites;
- root-cause hypothesis;
- observed same-pattern count;
- red-capable seam;
- runtime evidence still required;
- business/security/accessibility invariants;
- explicit out-of-scope boundary.

### R2 gate

`D_sourceCandidates = CONFIRMED_SOURCE + NEEDS_RUNTIME + REJECTED + INTENTIONAL + BLOCKED`

Only `CONFIRMED_SOURCE` and `NEEDS_RUNTIME` may enter runtime planning.
Verdict: `PASS_SOURCE_TRIAGE`, not a product-performance PASS.

---

## R3 — Runtime matrix and measurement design

Select only source-supported hot-path candidates. Freeze rows in an explicit matrix:

`candidate × route/view × mode × actor × state transition × viewport × action`

Required transitions where applicable:

- cold initial load;
- ready → background refresh → ready;
- populated → filter/sort/page;
- full page → short page → full page;
- cold route navigation;
- warm route revisit;
- modal/drawer open → async state → close;
- tab hidden → visible;
- one mutation and post-invalidation refresh only if separately authorized.

For each matrix row, declare required instruments:

- browser Network/trace;
- PerformanceObserver;
- React Profiler;
- server correlation/query logging;
- MySQL plan;
- DOM/focus/scroll geometry;
- fixture/store integration only.

### R3 denominator

`D_runtimeCells = PASS + FAIL + NEEDS_EVIDENCE + NOT_APPLICABLE + BLOCKED`

Every required row must occur exactly once. Route/view cells outside the selected envelope are `NOT_CLAIMED`, not PASS.

### R3 gate

- production-build and aligned-runtime procedure specified;
- no business mutation cell scheduled without separate authorization;
- no database plan scheduled without a source-supported hot query;
- no p75 field claim scheduled from a local lab;
- verdict: `READY_FOR_RUNTIME` or `BLOCKED_RUNTIME_DESIGN`.

---

## R4 — Read-only production-build evidence collection

Preflight:

- [ ] Revalidate branch/HEAD/status/index.
- [ ] Verify `3001/8001` are free before use.
- [ ] Start only owned current-source FE/BE processes.
- [ ] Confirm production/Release identity.
- [ ] Confirm exact database lane and readiness.
- [ ] Authenticate without persisting or printing credentials.
- [ ] Capture operation mode/version/capabilities without switching mode.
- [ ] Install unexpected-write guard.

Collect per selected cell:

- request start/end/dependency chain;
- request count, status, TTFB, transfer size;
- cold/warm cache behavior;
- skeleton count during refetch;
- container delta before/during/after;
- CLS entries and shifted-node attribution;
- long tasks and action attribution;
- INP/event timing where feasible;
- React render count/commit/reason for rerender candidates;
- modal/drawer focus/scroll/geometry;
- console/page/request failures.

Backend/database profiling remains read-only and bounded. If required query timing or plan access is unavailable, record `NEEDS_EVIDENCE`, not an inferred defect.

Teardown only owned processes and verify `3001/8001` clear.

### R4 gate

- immutable run directory and manifest;
- `requiredCells = pass + fail + needsEvidence + notApplicable + blocked`;
- zero unexpected business writes;
- zero use or teardown of `5173/5262`;
- zero fabricated data or mode switch;
- current build/runtime identity recorded;
- verdicts namespace source, browser health, lab performance, and field performance separately.

---

## R5 — Finding confirmation and remediation go/no-go

For every candidate, classify:

- `CONFIRMED_ACTIONABLE`;
- `CONFIRMED_BUT_BLOCKED`;
- `NOT_REPRODUCED`;
- `INTENTIONAL`;
- `INSUFFICIENT_EVIDENCE`;
- `ALREADY_COVERED`;
- `EXTERNAL_TELEMETRY_REQUIRED`.

Severity is assigned only now.

A finding may enter remediation only when it has:

1. repeatable evidence;
2. attributed root owner;
3. affected denominator;
4. expected invariant;
5. red-capable regression;
6. safe scope;
7. validation plan;
8. no unresolved product/permission/data decision.

### R5 gate

`D_candidates = actionable + blocked + notReproduced + intentional + insufficient + alreadyCovered + externalTelemetry`

No “recommendation” may bypass this accounting.

---

## R6 — Serial remediation packages

Execute one root-owner package at a time. Do not group unrelated optimizations merely because they are all “performance.”

For each package:

- [ ] Save task-file baseline against the inherited dirty tree.
- [ ] Lock symptom/scope/red loop/owner/success/out-of-scope.
- [ ] Prove the red seam before production edit.
- [ ] Fix at the lowest current owner.
- [ ] Preserve API, permissions, modes, URL, data grain, history, validation, focus, and accessibility.
- [ ] Do not add dependencies, cache, memoization, virtualization, endpoint, or index without measured need.
- [ ] Recheck all affected consumers in the frozen denominator.
- [ ] Run focused regression, affected feature suite, changed-file lint, relevant type/build/API parity.
- [ ] Re-run the exact runtime cells used to confirm the defect.
- [ ] Record before/after using the same build, data state, actor, mode, viewport, and action.
- [ ] Update the relevant canonical rule/oracle only for a confirmed reusable invariant.
- [ ] Run `git diff --check`, secret/stub scan, and declared-scope diff.
- [ ] Review only after the focused loop is green.

Possible package order, only where actionable evidence exists:

1. stale-content/refetch/state honesty;
2. layout-shift/alert/table geometry;
3. request dependency and invalidation;
4. attributed React render hotspot;
5. backend query count/projection/paging;
6. payload reduction;
7. database/index change under separate L2 authorization;
8. overlay/focus/async-submit regression.

### R6 package gate

A package is `PASS_FOCUSED` only if:

- red seam failed before and passes after;
- same-pattern denominator is fully dispositioned;
- focused suite passes;
- no affected consumer is unaccounted;
- runtime before/after passes where the finding was runtime-confirmed;
- broader failures are reconciled against a real baseline;
- no forbidden action occurred.

---

## R7 — Final reconciliation and closeout

Required summary tables:

### Hypotheses

`H01–H17 | result | current evidence | change package | residual`

### Findings

`ID | severity | area | owner | before | after | verdict | evidence`

### Claims

`claimId | required | pass | open | needsEvidence | notApplicable | blocked | notClaimed | verdict`

### Intentionally unchanged

Include:

- behavior found intentional;
- source suspicion not reproduced at runtime;
- optimization lacking measurable benefit;
- DB index lacking plan/frequency evidence;
- product/permission/data decision required;
- field p75 requiring production telemetry;
- unauthorized mutation/state;
- unsupported browser/mobile cells.

### Quality and scope

- task-focused tests/lint/build/API parity;
- exact broader inherited failures and before evidence;
- owned process teardown;
- final branch/HEAD/status/index;
- task-owned diff versus inherited dirt;
- updated §10 checkpoint;
- no whole-FE or field-performance PASS while residual cells remain.

### Final equality gate

For every claim:

`required = pass + open + needsEvidence + notApplicable + blocked`

For the finding ledger:

`totalFindings = fixed + open + needsEvidence + notApplicable + blocked + rejected + intentional`

For hypotheses:

`17 = finalDispositionCount`

Any mismatch is `FAIL_REPORT`, regardless of test success.

## Risks

- The old JS/performance ledger contains source findings superseded by later G6/G7/G12–G14 work. Copying it verbatim would reopen completed findings and corrupt the denominator.
- The dirty tree is so broad that cumulative `git diff` cannot be called task-owned. Per-file/hunk baselines are mandatory before any future edit.
- Historical browser performance results may no longer match current source. Treating them as current would overclaim.
- Production observability/RUM remains absent. Local controlled evidence cannot close field p75 LCP/INP/CLS.
- Real invalidation and mutation behavior may be impossible to prove through the UI without separate authorization and an isolated/disposable lane.
- Database plan access, representative cardinality, or query timing may be unavailable. That blocks index recommendations; it does not justify speculative indexing.
- Browser state may lack naturally populated PO/receipt, overlay, error, or large-list states. Do not seed or manufacture them.
- Broad lint/test failures may arise from inherited work. Without a pre-edit baseline they cannot be labelled inherited.
- The brief’s broad “P0” framing could bias reviewers toward large refactors before attribution. Severity must remain evidence-driven.
- Existing project rules such as F4/F5/F16/F19–F22 may themselves expose broad compliance questions. Those should be ledgered, not silently “fixed system-wide” without a bounded owner and approved scope.

## Need from main agent

No decision is required to complete this read-only consistency review.

Before execution, the main agent should:

1. add this phased checklist as the single performance/async continuation under the existing §10 ledger;
2. preserve the current no-edit/no-runtime boundary until R0–R3 are frozen;
3. seek separate authorization before any real business mutation, database/schema/index work, operation-mode change, or production telemetry integration.

## Suggested execution prompt

No immediate worker handoff is warranted. The next step is a GSD-parent checklist integration and denominator-freeze step, not implementation. Only after R0–R5 identifies a `CONFIRMED_ACTIONABLE` finding should a narrowly scoped executor receive one root-owner package.

Output saved to: C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\subagent-artifacts\outputs\d8af2668-f032-4d08-8902-f1e13f88d7db\.artifacts\goal-ui-ux\reaudit-async-performance-20260915-sol\authority.md (34.1 KB, 736 lines). Read this file if needed.
