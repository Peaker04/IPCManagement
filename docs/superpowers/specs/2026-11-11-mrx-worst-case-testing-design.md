# MRX worst-case qualification — specification

Date: 2026-11-11
Scope approval: operator approved writing this spec and its plan, including the 30 MRX scenarios and seven customer/catalogue/BOM additions discussed in chat. This is not authorization to implement or execute the campaign.
Plan: [MRX worst-case test plan](../plans/2026-11-11-mrx-worst-case-testing.md).
Task state: `.planning/WORK.md` only. This document defines requirements, not run progress.

## 1. Intent and boundaries

Prove that MRX preserves customer/scope/version authority, quantitative lineage, immutable evidence and safe recovery when inputs, actors and network/database timing are adverse. Cover actual customer onboarding and catalogue preparation, not only already-prepared batches. No finite suite proves absence of every defect; acceptance is bounded by the cases, schedules, dataset, artifact and environment actually verified.

Included: MRX dashboard; weekly menu import/source/batch/materials/plans/review/history; warehouse daily/preparation/issues/supplemental/details; reconciliation lines/variance/transactions/audits/completed/disposition/completion and Chef cooking read branch; shared customer/contract, dish, ingredient/unit/BOM operations only as prerequisites or boundaries of MRX. The actual route registry and current mode guards determine navigation; do not substitute DEFAULT Chef workflows.

Excluded: DEFAULT purchase/receipt/physical-issue/ServiceRun campaigns, repository architecture remediation, product fixes, new deployment/replica topology, arbitrary seed data, load or recovery execution without separate approval. Stock tables are observed to prove no MRX effect, never provisioned to make MRX pass.

### Authority and safety (copied by the plan)

- Documentation approval is not execution, code-edit, fixture-creation or fault-injection authorization.
- Native Pi parent only; no delegation, external agent CLI, package installation, commit/push or destructive git operations.
- No source DB writes or main-service restart. Only explicitly approved run-owned targets and processes may be mutated or stopped.
- Existing `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` is the sole MRX rehearsal lifecycle owner; no parallel clone/provider harness.
- Do not weaken assertions, permissions, skips, allowlists, thresholds or architecture baselines to manufacture PASS.
- DEFAULT != MATERIAL_RECONCILIATION; MRX never checks, decrements or provisions DEFAULT physical stock.
- No bearer tokens, cookies, passwords, dumps or credential-bearing traces in shared evidence. Qualification traces remain off.
- Preserve inherited workspace changes. `.planning/WORK.md` is the sole task-state owner; evidence receipts are not a second task ledger.

## 2. Alternatives and selected approach

1. Exhaustive Cartesian combinations of every role/view/failure/dataset: impractical, duplicate-heavy and still not exhaustive in timings.
2. One long end-to-end chaos scenario: realistic-looking but difficult to attribute; one fixture failure prevents reaching later risks.
3. Selected: risk-based owner tests plus bounded real-MySQL/browser scenarios, deterministic competing schedules, independent DB/file oracles, then two composed MRX journeys. Reuse existing G1–G8 and source tests; extend one owner per contract. Add a separate test file only for a distinct missing boundary, not to mirror a scenario list.

The operator approved producing the full MRX plan after this risk-based approach and the seven onboarding/BOM additions were proposed. Detailed task sequencing and evidence shapes below are design decisions, not new mutation permission.

## 3. Source-backed baseline and uncertainty

Intake: main...origin/main; HEAD `bbd55009a77a6e83f79027a7784deb4b7f323928`; staged index empty; dirty tree retained. A HEAD alone does not identify the candidate. Historical run `20261111t070606z_def992` has functional PASS for supplemental-vs-supplemental, overall FAIL at seven architecture-growth issues and authoritative cleanup completed=true. It is not proof for another candidate, schedule or scenario.

Existing evidence/support relevant to design:
- `frontend/tests/e2e-mrx/specs/g4-concurrency-rollback.spec.ts`: two real authenticated contexts, held HTTP POSTs, same expectedVersion/distinct commandIds, winner-only receipt and stock snapshot equality.
- `frontend/tests/e2e-mrx/specs/g6-merged-customer.spec.ts`: source contains shared-customer creation/reload, missing-BOM block and quantitative/conversion checks. It subsequently selects an existing customer; this is NOT proof that the new customer completed MRX, nor two-customer concurrent proof. This corrects any impression from the chat that no such source scenarios exist. They were not executed in this documentation turn.
- `ReconciliationPreparationWorkbookExporter`: Serializable read transaction; `GetWorkbookAsync` finishes before `PreparationWorkbookBuilder.BuildXlsx`. Actual MySQL contention and lock duration remain unqualified.
- `EfTransactionRunner`: retry clears tracked state; uncertain commit verifies via caller-specific persisted predicate. No universal exactly-once claim follows from this helper.
- `ReconciliationInventoryIssueCreator`: protected Serializable command, replay lookup, daily identity checks, version fence, issue/disposition/lifecycle writes. Test real entry path, not a manual imitation of its writes.
- `WeeklyMenuImportSupport.NormalizeDishMatchKey`: removes diacritics, handles Đ/đ, trims, uppercases, removes numeric G/GRAM suffixes and collapses whitespace. `SelectPreferredImportedDish` ranks published BOM, portion suffix and name length. This is observed behavior, not approval that all ambiguous mappings are safe.
- `DishesController`: POST `api/Dishes` uses CatalogAccess. Customer creation is POST `api/coordination/customers/contract` under CoordinationAccess; do not infer roles from labels alone.
- Runner currently has diagnostics including Race, Recovery, SupplementalRecovery, SourceCustomer, Quantitative, LifecycleAcceptance, MenuIntegrityPerformance. Race selects @G4-Race, not arbitrary export/initial/completion tests. A scenario is runnable only after its exact selector, setup and guards are reviewed.
- Main/isolated build identity, numerical load envelope, export lock budget, matching ambiguity policy and live recovery provider are not established by this spec.

## 4. Requirements and acceptance criteria

Canonical owners: `docs/DOMAIN.md`, `docs/domain/material-reconciliation.md`, `docs/FLOWS.md`, `docs/OPERATIONS.md`, `docs/DESIGN.md`, `docs/table-contracts.json`, actual C# DTO/policies and frontend route registry.

| AC | Required property | Requirement anchors | Cases |
|---|---|---|---|
| AC1 | Correct customer/week/batch/date/ingredient/unit identity across create, import, issue and outputs | FR-ADMIN/FR-CAT/FR-MENU/FR-WH/FR-RECON; DOM-GRAIN-1 | M02,M11,M17,M23,C01–C04 |
| AC2 | Atomic source changes, correct per-day locking and immutable freeze | BR-MRX-EDIT-2–9; BR-GLOBAL-03 | M03–M05,M08,C05–C07 |
| AC3 | Conflicts/replay cannot duplicate or lose effects | NFR-REL-01; BR-MRX-EDIT-9 | M06–M10,M26 |
| AC4 | Canonical quantity, net-issued and active/history decision truth | BR-GLOBAL-02; BR-MRX-TRUTH-1/2; BR-MRX-HIST-1; BR-MRX-SERV-1/2 | M01,M11–M15,M24,C05–C07 |
| AC5 | Actual API role/mode guards and no physical-stock effects | DOM-MODE-1; BR-GLOBAL-01; BR-MRX-EDIT-1; NFR-SEC-01 | M16,M18–M20,C01,C03 |
| AC6 | Consistent reports and safe bounded resource use | FR-REP within MRX; NFR-PERF-01/02 | M21–M25,M30,C02 |
| AC7 | Safe errors, session transitions, draft/focus preservation and correct UI states | docs/DESIGN.md six states, D6/D7/T7/T8/M1.2/N6; continuity AC8 ledger in WORK | M17,M18,M27,M29,M30,C01–C07 |
| AC8 | Recoverable committed state, outbox truth, queryable MRX history and scoped restore proof | NFR-REL-01; BR-MRX-HIST-2; OPERATIONS recovery targets | M26–M28 |
| AC9 | Honest, independently reproducible qualification and exact cleanup | AGENTS verification; OPERATIONS | All cases and tasks |

AC8 here is this spec's recovery criterion; the earlier continuity document's AC8 is a separate per-view temporal acceptance ledger, not automatically closed by this spec.

## 5. Common setup, evidence and oracle contracts

### 5.1 Dataset and actors

Use two created customers A/B with unique run-owned codes, the same test week, different savory/vegetarian servings and deliberately shared dishes/ingredients. Do not assume customer data isolation means users cannot see other customers: verify legitimate operational scope and actor permissions, not invented tenancy.

Include a second week, empty valid date/scope, locked date, missing-BOM dish, valid published BOM, customer-specific/global precedence, price tier and effective dates, alternate compatible unit and incompatible unit, boundary quantities and name-collision candidates. Prefer existing authorized data. Any new prerequisites require a clone-only creation packet naming entities, relationships, bounds and cleanup ownership. No fixture may fabricate committed receipts, locks or lineage instead of invoking its owner.

Actors: Coordinator, Manager/Admin with actual permissions, two independent Warehouse contexts, Chef cooking reader, authenticated insufficient-permission actor and expired/invalid session. Do not replace everyone with Admin. Record scope and roles, never credentials.

C01–C03 require newly created customers to actually proceed through MRX, not create one then switch to an inherited default. Distinct codes/IDs with equal display names are useful only if the catalogue permits them; otherwise retain the duplicate rejection and use a near-name pair.

### 5.2 Per-case immutable evidence shape (design, not a new production DTO)

Store a bounded JSON result under the existing runner evidence root for each executed case, using fields:
`caseId`, `subcaseId`, `runId`, `attemptId`, `candidateIdentity`, `targetIdentity`, `actorRoles`, `scopeIds`, `preStateReference`, `scheduleReference`, `requestReferences`, `oracleReferences`, `verdict`, `reason`, `durationMs`, `cleanupReference`.

Use PASS / FAIL / BLOCKED / NOT_RUN. Add acceptance NEEDS_EVIDENCE where measurements or policy decisions are incomplete; never encode that as PASS. Record coverage gaps in WORK, not a parallel status file. Retain earlier failed attempts. A fixture failure before contention is setup failure, not a reproduced business race. Evidence JSON must contain observed values; never hardcode true fields before their assertions run.

### 5.3 Independent checks

- Read persisted facts via a new DB connection after completion. API response plus UI success alone is insufficient.
- Assert exact rows/IDs/versions, initial and supplemental counts, receipt ownership, unchanged predecessor payloads and no orphan FK/lineage records. Failed commands create no successful command receipt or business mutation; legitimate rejection/security logs are not forbidden.
- Compute quantity from approved frozen inputs with decimal arithmetic (6 fractional digits), independently of production projection. Compare by ingredient/canonical unit/date/customer, not mixed-unit grand totals. Mirror neither SQL implementation nor expected values blindly; review BOM precedence and distinct-dish/variant grain independently.
- Net issued = linked issued quantities minus confirmed received returns according to canonical policy; unavailable evidence remains unavailable. No change to issue history to make a balance agree.
- Snapshot all affected physical stock/lot/movement rows; check no new effects and preserved old evidence. `captureStockSnapshot` requires an existing row and fails if absent. MRX sufficient-stock behavior must also be exercised for an ingredient without stock: use absence-aware read-only DB comparisons, never seed physical stock solely to satisfy the helper.
- Multi-customer writes on disjoint scopes may both succeed; conflicts on a coarse version fence may require reload. No spillover is acceptable. A baseline shared catalogue creation is separated from the period asserting customer A/B business-state independence.
- For files parse actual downloaded CSV/XLSX; compare all relevant sheets, filter scope and row quantities. Escape injection safely without breaking legitimate negative numbers.

### 5.4 Deterministic race protocol

Two independent authenticated contexts/connections; both reach the intended valid precondition; record start, barrier entry, release, response and commit observation. HTTP holding before dispatch proves simultaneous submission only, not an internal export/source overlap. For read/write consistency prove the read transaction actually overlaps the writer via existing instrumentation or provider observation. No production-only-for-tests seams, global settings changes or parallel provider harness. If current tooling cannot prove the schedule, mark BLOCKED and request narrowly scoped support changes.

Exercise writer-first and reader-first/command-first schedules where outcome differs; retain loser draft/reload evidence. Use bounded deadlines and finally release gates. Serial Playwright workers remain 1; concurrency is inside each case. Separate same-aggregate conflict from disjoint-customer concurrency. Repetition does not replace schedule control; no arbitrary rule of three successful runs.

## 6. Scenario catalogue

Each row gives precondition/action, independent acceptance and evidence emphasis. Common section 5 applies to every row. All cases are planned, not newly passed. Task ownership is in section 9.

### A. Source/import/freeze

| ID / priority | Preconditions and adverse action | Acceptance / oracle |
|---|---|---|
| M01 / P0 | Draft source with savory/vegetarian slots; omit split, submit negative/out-of-range/zero variants separately | Missing is not default100; invalid rejected; legitimate zero distinguished from missing; correct variant multiplier; no fake readiness or partial write |
| M02 / P0 | Preview A/week1; change customer/week/menuVersion/body, expire ticket, or change source before commit; separately upload malformed/non-workbook, missing required sheet/column, duplicate conflicting rows and configured-size-limit inputs | Exact authority or explicit conflict; no wrong-scope commit, stale fingerprint reuse or partial persistence. Invalid-file validation may return a validation DTO rather than HTTP failure: assert actual error severity/commit disabled and DB no-write, not a blanket status code. Size/decompression limits require approved bounded inputs, no uncontrolled resource bomb |
| M03 / P0 | One source-change payload touches an open and an issued/locked date | Entire operation rejected with locked-date evidence; source, servings, projection, contributor/revision/delta unchanged |
| M04 / P0 | Change applicable master BOM/conversion/name after issue; also exercise an open date | Locked snapshot/provenance unchanged; open-date changes only through authorized applier; no silent historical recomputation |
| M05 / P0 | Import then amendment/reimport/rollback; Coordinator submits source change, Manager rejects with reason then separately handles a valid new request; inspect old normalized snapshot and attempt reuse | History remains inspectable; rolled-back version not active; verify snapshot provenance not reconstructed from current menu. Submit/reject is not apply; required decision reasons/actor authority/version and concurrent repeated decisions are enforced, no duplicate revisions from approval replay |

### B. Concurrency/replay

| ID / priority | Preconditions and adverse action | Acceptance / oracle |
|---|---|---|
| M06 / P0 | Transferred batch, no issue on date; two initial commands from same version | One initial and one explicit conflict; winner-only successful receipt/version effect; no orphan; predecessor unaffected |
| M07 / P0 | Initial exists; two supplemental commands same version with different quantity | One201/one409 per current public contract; version+1, winner quantity only, immutable initial, loser draft retained; fresh evidence not historical reuse |
| M08 / P0 | Open date; Manager applies source while Warehouse first-issues date | Issue-first apply MRX_DAY_LOCKED; apply-first stale issue rejected; one coherent result, no post-issue rewrite; invoke both real command owners |
| M09 / P0 | Eligible completion candidate; completion competes with supplemental | No successful post-completion issue; if supplemental wins, stale completion rejected/re-evaluated and stale decisions invalidated |
| M10 / P0 | Drop response after a verified commit; replay same command, concurrent identical command; reuse command with different body | One persisted effect; canonical result/explicit mismatch according to reviewed replay contract; altered payload never creates second effect; use new connection receipt oracle |

### C. Quantity/lineage/decisions

| ID / priority | Preconditions and adverse action | Acceptance / oracle |
|---|---|---|
| M11 / P0 | Tamper daily/weekly line, date, ingredient, unit or batch; duplicate/omit initial lines | Reject at intended identity guard with valid actor/version; whole business state unchanged; no successful receipt |
| M12 / P0 | Under/over initial, repeated supplemental; unreceived then received returns through supported MRX path; boundary decimals | Exact canonical net ledger, reason checks and six-decimal rounding; no subtraction before return acceptance; no physical-stock effects. Unsupported return path is a policy gap, not invented endpoint |
| M13 / P0 | Two daily dispositions compete; later accepted issue/return/actual change | At most one active owner decision; invalidated rows retain ID/actor/time/reason; readers use active only; audits include history |
| M14 / P0 | One date ready but another under-issued/missing linkage/stale decision; request complete | Backend rejects with actionable blockers; all-date WEEK_COMPLETE requirement honored; no invented under-issue waiver |
| M15 / P0 | Complete with legitimate accepted nonzero variance; legacy missing daily lineage; mutate completed batch | Truthful completed report/CSV; unavailable not zero; immutable completion and correct history |

### D. Security/scope/mode

| ID / priority | Preconditions and adverse action | Acceptance / oracle |
|---|---|---|
| M16 / P0 | Valid tokens: Coordinator attempts direct-apply; Warehouse/Chef edit; insufficient actor issue/decide/complete | API policy denies as actually configured; read/submit/approve distinctions tested; UI visibility is additional not sole proof |
| M17 / P0 | A→B→A with delayed old source/batch/preview/mutation receipt and freshly loaded newer A | No version rewind/foreign rows/foreign write; drafts belong to scope; exact request generation and DB lineage |
| M18 / P0 | Warm cached reads then403, logout/login as another actor; retry/back-forward; concurrent expiry refresh | Denied data cannot reappear from cache; no actor residue/refresh loop; token behavior follows actual auth contract |
| M19 / P0 | Client has stale server mode/version; call DEFAULT workflow or mix source families in MRX | Correct backend guard and protected-transaction fence; no DEFAULT commands/records. Real mode switching requires separate isolated drill approval |
| M20 / P0 | Observe every mutation/replay/source apply/complete across stocked and no-stock ingredients | No physical-stock checks/provisioning/effects; equality or continued absence of exact stock/lot/movement evidence, including no unrelated movement added |

### E. Reads/exports/cooking

| ID / priority | Preconditions and adverse action | Acceptance / oracle |
|---|---|---|
| M21 / P0 | Workbook export overlaps source revision, issue or accepted return on selected scope | One legal consistent view across dependent detail/summary/menu/net projections; no mixed revision; actual workbook parsed and DB schedules bound |
| M22 / P1 | Large authorized selection; same-scope writer and unrelated-customer writer during read and serialization | Read locks released before serialization; measure transaction and wait durations separately; writer budget pre-approved, not invented after run |
| M23 / P0 | Multiple pages/customer/date/supplier filters; change selection then download | File contains entire matching set, not current page; scoped counts, unique identities and sums per unit match independent rows |
| M24 / P0 | Shared ingredients, repeated dish slots, savory/vegetarian split, invalidated/missing contributors | Correct frozen active cooking grain and serving amounts; repeated slots do not accidentally multiply same source dish; missing provenance explicit |
| M25 / P1 | Long Unicode, HTML, formula-like names/reasons; week/month/year/leap-date/HCM midnight boundaries | Safe DOM/file cells, preserved intended content; no client/server date drift; correct service-day rejection and file schema |

### F. Failure/operational UX

| ID / priority | Preconditions and adverse action | Acceptance / oracle |
|---|---|---|
| M26 / P0 | Inject approved failure between document and receipt/outbox persistence and around commit; deadlock/connection loss | All rollback or durable replayable commit; no orphan or duplicated effects; exact failure point reached, tracked state clean on retry |
| M27 / P1 | Isolated API restart between Excel preview and commit; quantity token expiry/signature/purpose mismatch | Lost process ticket handled by safe re-preview, not bypass; signed quantity tokens enforce purpose/expiry/source/mode; no multi-replica claim |
| M28a / P1 | Existing outbox enabled; worker loss around ack, retries, poison | Persisted ordering/lease/consumer receipt/retry truth; no invented email delivery; active configuration and health checked |
| M28b / P1 | Approved MRX archive restore to absent target, bad hash/key/object-version negative controls | Fail closed, independent schema/ledger/lineage/history and provider proof; timed recovery targets; local clone not off-host certification |
| M29 / P1 | Loading/empty/error403/400/500+retry/partial/unknown outcome; rapid tab/page/filter, close/reopen dialogs | Correct authority, preserved same-scope draft where safe, no false0/foreign schema, safe retry identity and clear blocker; no blanket retry500 UI assertion where action isn't retryable |
| M30a / P1 | Owner-approved representative data and mixed actors; step load/burst/recovery | Correct state under load; p75/p95/p99/errors/timeouts/429/resource/DB pool/lock wait observed, no security-limit changes; recover after burst |
| M30b / P2 | Desktop/mobile, normal/reduced-motion, keyboard, zoom, long content; cold/warm/error journeys | Accessible controls/focus/scroll/usable dialogs, CLS<=0.1 by agreed measurement; no hidden draft loss or clipped primary action |

M28 and M30 retain original IDs with explicit independent subcases; one passing subcase does not pass the parent. The catalogue therefore contains 37 parent IDs (30 M + 7 C) and 39 named leaf rows; the input/schedule variants inside each row must also be reported individually when executed.

### G. Added onboarding/catalogue/BOM scenarios (explicitly approved scope)

| ID / priority | Preconditions and adverse action | Acceptance / oracle |
|---|---|---|
| C01 / P0 | Actual UI creates customer+contract via POST /api/coordination/customers/contract; reload, select NEW ID, enter MRX source; duplicate code/invalid contract/denied actor controls | Persisted customer and required contract/tier truth, one valid identity, selectable after refetch; no inherited menu/batch/servings; rejected attempt no partial customer/contract; actual new customer reaches MRX, not switch to existing default |
| C02 / P0 | Two NEW customers A/B same week, shared dishes/ingredients but different servings; independent browser contexts concurrently import/preview/commit/freeze/transfer/issue/read/export | Capture overlap per boundary, disjoint IDs/tickets/versions/lineage/receipts; both may succeed; A never changes B's business state; separate files correct and aggregate assigns correct columns by ID; record global catalogue effects outside scoped snapshot interval |
| C03 / P0 | A already IN_PROGRESS with locked date; create B and operate same week/shared dish | B inherits no A lock/status/draft; A persisted evidence unchanged; selectors update; no hidden global batch lookup |
| C04 / P0 | Create new uppercase dish through UI/catalogue API; choose/import variants THỊT KHO / Thịt kho / thịt kho, whitespace, Đ/đ, composed/decomposed accents, numeric portion suffix; same normalized name but distinct IDs/BOMs | Preserve catalogue identity; import matching behavior characterized against reviewed policy, never silently approve wrong-ID selection. Explicit picker by ID remains distinct; unknown dish creation path documented. If ambiguity policy unresolved, flag BLOCKED_POLICY and seek owner decision, not hardcode desired merge/rejection |
| C05 / P0 | Newly created dish has NO BOM; save/select it in MRX; enter real split servings then preview/create/freeze/apply as applicable | Saving dish/draft is not forbidden merely for missing BOM; quantity-authority boundary blocks with exact dish/date cause; no zero-demand success/fallback to another dish, no partial batch/contributors |
| C06 / P0 | BOM variants: no applicable published row, expired/future, wrong customer/tier, missing/incompatible conversion, one invalid dish among valid dishes | Correct precedence/applicability and diagnostic; no silent omission/partial quantity commit. Test boundary first with valid unrelated guards; do not claim every incomplete recipe detectable absent completeness metadata |
| C07 / P0 | After C05/C06 block, authorized actor supplies valid BOM through real owner; re-preview same new dish, then continue MRX | Fresh cache/preview uses correct BOM; independent variant x gross x conversion at canonical precision; no duplicate prior attempt; unrelated/locked A history unchanged. Repair means input prerequisite correction, not product-code fix |

## 7. Composed journeys and UI acceptance inventory

J1: C01 A/B creation → C04 new uppercase dish → C05/C06 missing/invalid BOM rejection → C07 valid BOM recovery → C02 concurrent source-to-issue → M23 per-customer and aggregate export → M20 no stock effects. This is not the first test: constituent cases must reach their own oracles first. Use same-week different quantities to reveal cross-customer leakage.

J2: M08 source-vs-initial → M07/M10 supplemental and lost-response replay → M13 decision invalidation → M09/M14 completion contention/blockers → M15 completed truth + M24 cooking. Freeze known pre-state per stage; a setup failure blocks later stages, not passes them.

Temporal inventory for M29/M30b (no route-level shortcut):
- MRX dashboard filters/queues/batch navigation.
- Weekly source editor, impact/review/inbox, materials, plans + dish dialog, import + history + snapshot.
- Warehouse daily, preparation selections/export, issue/history/source-delta surfaces, supplemental + issue-detail dialogs.
- Reconciliation lines, variances, transactions + detail, audit warehouse and source/BOM, completed register, batch picker, disposition and completion.
- Chef frozen cooking selection/master-detail/download.
- Shared admin customers/contracts, dishes, BOM and ingredient/unit prerequisites; login/denial/expiry overlay; mode settings read only, unauthorized DEFAULT-route denial.

For each eligible leaf observe cold, warm return, back-forward, scope/filter/page, valid empty, recoverable error/retry, permission denial, dialog close/focus and unknown write outcome where applicable. Pair representative desktop 1440x900/mobile 390x844 and normal/reduced-motion across DEV and identified preview; these viewports are proposed campaign defaults, not discovered live acceptance. Permissions/non-applicable interactions need a stated contract reason, not skip padding. Reuse earlier continuity plan and WORK ledger; no assertion that all matrix rows are already authored or executed.

## 8. Performance, recovery and acceptance decisions

Canonical targets: DOMAIN NFR-PERF-01 p75 API<=300ms, FE initial frame<100ms, data load<1s; NFR-PERF-02 CLS<=0.1. Bind units, warm/cold boundary, instrumentation and workload before running. Existing slowMo qualification functional runs do not qualify latency.

Required owner-signed execution packet before load: actor count and mix, customers/weeks/rows/history sizes, read/write/export proportions, duration/ramp, request/connection ceilings, same-scope contention share, resource/latency/lock-wait stop budgets and target limits. Measure p95/p99 even if no approved numerical limit; report NEEDS_EVIDENCE rather than invent one. No stress/soak from generic "run tests" approval. Existing five-user/endurance scripts are references, not approved capacity requirements.

Recovery targets from OPERATIONS: operational backup interval<=4h, RPO<=4h, RTO<=30min; MRX operational history queryable at least five calendar years and independent encrypted immutable off-host archive retained through archiveCreatedAtUtc.AddYears(5). Restore comparator limitations require independent semantic and full schema checks; local receipts alone cannot certify provider retention or actual passage of five years.

Policy decisions to resolve by read-only source/contract comparison before executing affected assertions: duplicate name/code semantics; normalized ambiguous import winner and portion-suffix handling; actor grants; MRX supported return/actual paths; non-default price tier/contract readiness; token replay payload mismatch; accepted missing-BOM boundary; exact performance/load budgets. Resolve from existing canonical policy when possible; if expected policy genuinely conflicts with source, stop and ask owner. Do not silently change policy or weaken tests.

## 9. Owner mapping and test boundaries

See plan file map for exact paths. Primary task mapping:
- T0 admission/coverage review and permissions; T1 C01,C03; T2 C04–C07,M01,M04,M25; T3 C02,J1.
- T4 M02,M03,M05,M08; T5 M06,M07,M09,M10,M26; T6 M11–M15,M20,M24,J2.
- T7 M21–M23; T8 M16–M19,M27; T9 M28a/M28b; T10 M29,M30a/M30b; T11 final qualification.
Shared IDs in task references mean distinct risks only: e.g. T2 master-BOM freeze vs T4 source-apply freeze; T5 DB conflict vs T8 actor denial; do not duplicate the same assertion at every layer.

## 10. Exit and stop criteria

A case PASS requires reached intended path, valid setup/actor/version, actual outputs and independent persisted oracle where applicable, candidate-bound evidence and source preservation/cleanup. Deterministic writer-first/loser-first controls must not fail at an unrelated permission or readiness guard.

Separate verdicts: business correctness, concurrency, security, output fidelity, temporal UX, performance, recovery, repository gate, cleanup. A blocked case is not coverage completion; required unresolved P0 or failed cleanup blocks overall qualification. Existing seven architecture issues remain FAIL until independently authorized remediation and fresh gate evidence; no baseline padding. Source code/tests present or authored do not mean live PASS.

Stop on ambiguous target identity, source mutation/drift, secret exposure, lost ownership, invalid fixture prerequisites, unsupported runner selector, unbounded locking/resource pressure, cleanup error or unexpected business mutation. Release owned barriers and perform exact authorized cleanup; never stop someone else's service or delete inherited files. Retain failure receipts and request a bounded next decision. No production fixes or temporary product mutation to prove test sensitivity without separate authorization.

## 11. Documentation acceptance

This spec is complete as a design when all M01–M30 and C01–C07 have actionable setup/action/oracle, explicit task/owner mapping and admission/evidence/exit rules. Its companion plan must retain native execution, permission barriers and reuse of current owners. This acceptance says nothing about campaign results.
