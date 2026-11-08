# MRX — Import coverage, end-to-end data integrity and performance specification

Date: 2026-11-05
Status: APPROVED_FOR_NATIVE_EXECUTION — owner reviewed the written spec/plan and approved `Duyệt native`; no product repair authority.
Plan: `docs/superpowers/plans/2026-11-05-mrx-import-integrity-performance.md`

## 1. Intent and authorization

Prove that routine ERP changes survive the entire MRX flow without data drift: import, replace/swap dishes, increase/decrease servings, approve/reject, warehouse issue, kitchen readback, reconciliation, completion, reload and export. Measure performance separately from correctness.

The owner approved a fresh disposable DB clone, test-only actors, scenario workbooks, isolated browsers, business mutations on that clone, and cleanup of only run-owned resources. They additionally requested horizontal/vertical merge and replacement coverage, all four savory/vegetarian morning/afternoon menus, and inclusion of horizontal/vertical swaps. After creation of these documents the owner approved native execution (`Duyệt native`).

Execution remains native/direct parent; no delegation, installation, worktree, stage/commit/push, deploy, main DB write, existing-service replacement, old campaign resumption or credential/profile reuse. Product defect repair is not authorized by this verification plan. Test/harness changes are bounded to proving these contracts; they must not relax product guards.

## 2. Approaches and decision

1. Reuse the canonical workbook unchanged and run Golden: cheapest, but cannot establish the requested import/edit matrix. Rejected as sufficient evidence.
2. Extend existing canonical-template scenario generation and G6/Golden/recovery owners with a coverage workbook, independent expected facts and traceable assertions: selected proposal adopted by the owner; least new infrastructure.
3. Build a new ERP-wide framework and load campaign: unnecessary scope and duplicated ownership. Rejected.

One coherent MRX slice first; do not claim all ERP modules or production readiness. No UI redesign, new swap command, business-rule change, DB migration, guessed index or cache rewrite.

## 3. Canonical contracts and present implementation

- `docs/domain/material-reconciliation.md`: BR-MRX-EDIT-1..9; BR-MRX-SERV-1..2; source fingerprint, issue/ledger, completion and isolation contracts.
- `docs/DOMAIN.md`: FR-MENU/COORD/WH/CHEF/RECON and NFR-PERF-01.
- `docs/ENGINEERING.md`: declared build/runtime/data conditions and evidence hierarchy.
- `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxSourceChangeApplier.cs`: single source-change transaction authority.
- `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportParserTests.cs`, `WeeklyMenuImportBatchTests.cs`, `MrxSourceChangeApplierTests.cs`: parser/reimport/transaction behavioral owners.
- `frontend/tests/e2e-mrx/fixtures/mrxWorkflow.ts`: `scenarioScope(verifier, ordinal)` currently copies the canonical workbook with a shifted week; `createTransferredBatch` currently makes a deliberate vertical edit and fills uniform servings. That setup is not proof of comprehensive import coverage and must not overwrite the new scenario silently.
- `scripts/mrx-evidence/MrxEvidenceSafety.ps1`: `New-MrxScenarioWorkbook` preserves canonical template, rejects overwriting it and requires a Monday.
- `frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts`: real source decisions, day lock/race and terminal tail already have an owner.
- Existing `g1`, `g4`, `g5`, `g6-merged-customer`, metrics helpers and safety tests are reused for distinct contracts, not copied.

## 4. Workbook and independent oracle

### 4.1 Deliverables

One valid weekly XLSX, derived from the existing canonical template, with **savory morning, vegetarian morning, savory afternoon, vegetarian afternoon** sections. Preserve the template's supported day count/date layout; no invented seventh-day assumption. Maintain the original template unchanged.

Create labeled reimport/error variants from the same authored scenario only where necessary. A deliberately invalid workbook is separate so it cannot prevent the valid scenario reaching downstream stages.

An adjacent test-only manifest records:
- case ID, template/source SHA-256, workbook SHA-256, relative day offsets, section, shift, variant, slot and source cell/merge range;
- stable dish code, selected BOM/tier/scope, ingredient code, conversion/unit and exact decimal per-serving quantity;
- expected normalized source tuples and before/after changes, excluded/unchanged scope and expected rejection;
- serving values and independently calculated per-day/per-week ingredient totals.

Resolve codes to real clone identities once and require unique matches; do not match only names or take the first BOM. Missing/ambiguous dish/BOM/unit is BLOCKED, not permission to fabricate production facts. Any extra provisioning needed beyond approved actors/scenario import must be identified before use. Do not publish workbook business rows or secrets into the public report.

### 4.2 Coverage matrix

Each of the four sections contains distinguishable inputs, so swapped shifts/variants cannot accidentally pass. Place separate non-overlapping regions within the supported week/slots; use later revisions of the same workbook where geometry cannot hold every state at once.

| ID | Input/action | Required observation |
|---|---|---|
| IMP-01 | Unmerged, distinct dishes | Exact source identity/order per date/shift/variant/slot |
| IMP-02 | Horizontal merge over adjacent dates | Every covered date maps correctly; unrelated dates unchanged |
| IMP-03 | Vertical merge across slots | Exact slot membership and contribution multiplicity, per actual contract; no blanket dedup by dish name |
| IMP-04 | Combined row/column merge | Prove supported semantics or explicit atomic rejection; unsupported is not reported as successful import |
| EDT-01 | Replace one member of horizontal group, then whole group | Intended members change; remaining members and other sections preserved |
| EDT-02 | Replace one member of vertical group, then whole group | Correct split/regroup and normalized source after reload |
| SWP-01 | A at date D1 swapped with B at D2 in same shift/variant | Both identities correct after one atomic submission; no lost member |
| SWP-02 | A at slot S1 swapped with B at S2 in same date/shift/variant | Exact slot identities and BOM contributions after apply |
| SWP-03 | Swaps involving merged membership | Use supported per-member/group edits; unchanged members remain unchanged |
| SRV-01 | Increase/decrease savory/vegetarian separately in each shift | Only target serving field changes; FinalServings equals their sum |
| SRV-02 | Missing versus explicit zero | Import invents no default; enforce current validation, never treat missing as zero |
| RIM-01 | Identical reimport | No duplicate active source/projection; preserve legitimate version/audit semantics rather than assuming no history row |
| RIM-02 | Changed reimport | Correct new snapshot; old snapshot immutable; correct open-day delta |
| NEG-01 | Validly formed change touches issued and open dates | Entire change rejected; no partial source/projection/history writes |
| NEG-02 | Missing BOM or malformed supported-template variant | Explicit diagnostic/rejection; no silent dropping or fake demand completeness |

No claim that all combinations of all rows were tested. Each case has its own evidence; rectangular merge support is resolved from parser and behavior before the manifest is frozen. Horizontal/vertical swaps use existing source editing, not a new UI feature. Cross-variant/cross-shift swaps are not silently added to the requested within-section swap cases.

### 4.3 Oracle rules

Authored normalized tuples and arithmetic are independent of import preview, application parser, source applier, demand service and renderer. Never generate expected facts by calling the production function under test or copying the observed response.

Use decimal-safe arithmetic (integer scaling/rational representation) and the production contract's specified conversion/rounding boundary; retain high-precision rates and round final quantities to at most six decimals. Establish merged-slot multiplicity from source-backed contract and pin it explicitly; never assume merge means either one contribution or N contributions without checking.

Use different servings by section/day (for example morning savory 1000, morning vegetarian 51, afternoon savory 803, afternoon vegetarian 37 at a designated day, then savory +17 and vegetarian -3 in separate revisions). Exact values are authored before execution; they are test data, not inferred business defaults. An A→B change must have non-equivalent BOM contribution to expose stale downstream data.

## 5. End-to-end contracts

At checkpoints compare manifest → submitted payload → response → persisted source/version/servings → daily/weekly projection/contributors → visible DOM → exported parsed content. Row counts/screenshots/HTTP 200 alone do not pass.

- COR-01: customer × week scope, exact date/shift/variant/slot; a second customer/week remains unchanged. DEFAULT workflow records are not added or rewritten.
- COR-02: import preview is non-mutating; commit has authoritative identities; old version snapshots remain immutable after amendments/reimport.
- COR-03: approval submission/rejection leaves applied source unchanged; accepted/direct change applies once with actor/reason/revision/delta evidence.
- COR-04: source change updates open-day menu, split servings, material projections and cooking contributors atomically through the existing applier. Check daily values and weekly sum, including removed/zero-contribution lines according to contract.
- COR-05: initial issue includes each positive frozen daily line once; actual issued and linked ISSUE/ADJUSTMENT ledger reflect the contract, not assumed required=issued. MRX shortage is not an accepted business fallback.
- COR-06: kitchen reads correct persisted frozen contributors, not current BOM guesses; CSV/XLSX and screen agree numerically and by identity.
- COR-07: reconciliation aggregates actual linked initial/supplemental issue evidence; completion, accepted variance, history, reload and export preserve actual values and lineage. Do not fabricate returned quantities or use legacy actual write endpoints.
- COR-08: selection/filter/supplier scope has existing semantics: local search must not silently narrow a whole-batch export; compare actual expected export scope, including pagination beyond page one when present.
- COR-09: stale responses/cache, route/date/customer switching and reload cannot show/submit another scope or silently discard drafts. Reuse scope-isolation owners.

## 6. Adversarial and access evidence

Five separate authorized test actors: Coordinator, Warehouse, Chef, Manager, Admin. Verify both allowed operation and forbidden direct API operation with correct actors. Do not force every role into unauthorized routes for happy-path convenience.

Reuse existing owners for:
- source apply versus first issue: exactly one admissible winner, expected conflict, unchanged locked facts;
- two stale editors: stale version cannot overwrite accepted data;
- duplicate submit/retry: command-specific identity and aggregate semantics, no duplicate issue/movement;
- committed-write/lost-response or failed-readback: no fake failure-driven replay duplication, correct unknown-result/reload feedback;
- expired session/wrong mode: no unauthorized persistence, draft/recovery contract retained.

Rejection checks compare relevant protected row identities/values, version/revision counts and ledger; do not use an unrelated 403 as proof of a day-lock or race guard.

## 7. Performance protocol

PERF-01: production FE bundle and actual BE build, candidate working-tree/source hashes, browser/host, viewport, actor/mode, DB identity, dataset cardinalities and probe conditions recorded. Existing user dev servers are not measurement targets. Use existing owned runtime admission; if it only serves DEV, mark measurements diagnostic until production preview is admitted safely.

PERF-02: separate correctness evidence from timing runs. Disable per-step screenshots/slow motion/video overhead where appropriate for timing, declare instrumentation and preserve correctness readback outside timed windows. Do not compare DEV cold compilation to warm production navigation.

PERF-03: for source/warehouse/kitchen/reconciliation route reads collect at least 20 comparable warm observations and 5 fresh-context cold observations per selected route; report cold/warm separately, count, median, P75, P95 and raw samples. Cold means fresh browser context/cache, not forced OS/DB cache clearing. Repeat state-changing timing on at least 5 equivalent fresh run-owned scopes; no repeated destructive action on the same completed batch. These are bounded diagnostics, not a statistically qualified capacity claim.

PERF-04: NFR-PERF-01 targets: P75 API latency <=300 ms; first FE frame <100 ms; screen data ready <1.0 s. Define first frame as navigation/interaction start to first route-correct shell frame, not generic login/blank paint; data ready means scope-correct authoritative data settled. If reliable markers are absent, report NEEDS_EVIDENCE rather than substituting LCP or an arbitrary timeout. API browser latency is end-to-end; distinguish server timing when available.

PERF-05: record request count/duplicates, transfer sizes, long tasks, supported Event Timing/LoAF, CLS, and import/preview/apply-to-readback timings. Missing browser metrics are null/unsupported, never zero. Attribution BE/DB requires actual measurements, not guessed bottlenecks. No new duration budget is invented for large import/apply; report observed values.

No default 60-minute endurance, ten-minute HTTP load or max-five-VU G8 execution in this first campaign. These require a separately agreed load size/time budget. The coverage workbook is not a scale benchmark. Existing load scripts are inspected, not run blindly.

## 8. Runtime safety and lifecycle

Use `Invoke-MrxDisposableEvidence.ps1` and `MrxEvidenceSafety.ps1`, never ad-hoc clone/drop shell commands. Main source `ipcmanagement` is read/snapshot only; target `ipc_mrx_evidence_<fresh-run-id>` must be absent; subordinate target only under the existing proven ownership model. Prepared Playwright does not own DB create/drop.

Before mutation verify full script admission, current source identity, fresh target, run-owned runtime principal, dedicated ports/browser, candidate/source manifests, cleanup ownership and available evidence disk. Do not print connection strings, tokens or personal workbook data. No automatic application of migrations; schema mismatch is BLOCKED pending separate approval.

Maintain one run receipt with exact targets/processes/attempt/build/data/evidence, distinct from WORK task state. Finish/Abort only touches confirmed run-owned resources. Cleanup failure is BLOCKED_CLEANUP, even if business cases pass. Source checksums/manifests before/after detect drift but cannot alone prove absence of all transient writes; also require least-privilege target binding and command/process evidence. Report external concurrent source drift honestly.

## 9. Acceptance and reporting

- PASS only for cases with independent expected facts, observed authoritative values and named evidence artifacts.
- FAIL for demonstrated behavioral/data/performance violation; BLOCKED for unavailable prerequisites; NEEDS_EVIDENCE for unmeasured claims. Unsupported input acceptance is separate from correct rejection.
- Harness/unit success never upgrades browser/DB evidence. Browser success never hides runner/lint failure.
- Evidence retained under the owned `.artifacts/mrx-evidence/<run-id>/` output or its established runner mapping: workbook/manifest hashes, sanitized step records, requests, normalized DB readbacks, parsed exports, traces/screenshots, raw timing samples, terminal verdict and cleanup receipt. Do not create a second live task ledger.
- Product defects are reported with first divergent boundary, expected/actual, reproducible case, affected downstream data and proposed smallest owner repair. Stop unsafe dependent steps; independent safe cases may continue after recording the failure.
- Whole ERP, production performance/capacity, old legacy data repair and release readiness remain unclaimed.

## 10. Document gate

Review this spec and its plan before execution. Apply test-audit and ipc-test-audit before test changes; ipc-code-review for harness code; ipc-ui-review if UI interaction/geometry is evaluated. No product TSX/CSS edit belongs to this plan. No unprompted subagents; self-review is single-context and is not called independent review.
