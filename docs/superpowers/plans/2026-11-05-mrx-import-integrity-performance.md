# MRX Import Integrity and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Native direct-parent execution only; no delegation is authorized. WORK is the sole live task-state owner; checkboxes below are planning instructions, not a second execution ledger.

**Goal:** Produce and execute a bounded, disposable-clone verification of four-menu import/edit coverage, end-to-end MRX data integrity and declared performance budgets.

**Architecture:** Extend the existing canonical workbook scenario generator, G6 source-change owner, shared evidence recorder and metric collector. Author independent expected source/decimal facts before executing real HTTP/UI/DB operations; reuse Golden/recovery/ledger owners for distinct risks. Add one narrowly selected runner diagnostic rather than invoking the broad historical qualification campaign.

**Tech Stack:** Installed TypeScript/Vitest/Playwright, PowerShell, .NET/C# test owners, MySQL and existing XLSX ZIP/XML facilities. No package installation.

**Spec:** `docs/superpowers/specs/2026-11-05-mrx-import-integrity-performance-design.md`

## Global Constraints

- Written spec/plan reviewed; owner approved native execution (`Duyệt native`).
- `DEFAULT != MATERIAL_RECONCILIATION`; main DB is read/snapshot only.
- Fresh absent `ipc_mrx_evidence_<run-id>` target, owned actor/principal/ports/browser; subordinate target only via existing ownership checks.
- No product repair/redesign, migrations, new swap feature, dependency, delegation, worktree, stage/commit/push/deploy, existing-service replacement or historical campaign resumption.
- Follow-up scope: the owner's subsequent `kiểm tra xử lý điểm chặn sau đó tiếp tục plan` authorizes demonstrated blocker investigation/minimal owner repair, not a redesign or security-policy change. This covered harness traffic pacing and preservation of menu names in immutable amendment snapshots; it does not authorize retaining drafts across401 against current session cleanup. WORK and the static execution report hold actual evidence/outcomes.
- Test-only workbook generation/import and clone business mutations are authorized by the owner; additional master-data provisioning is not silently assumed.
- Never weaken assertions/permissions, add skip/allowlist padding, mock product owners or fabricate business evidence.
- Independent expected data must not call production parser/calculator or copy response output; missing prerequisites are BLOCKED.
- At most six decimals for final quantities; preserve high-precision rates and contract-specific conversion/rounding.
- No default G8 endurance/load; no whole-ERP or production-capacity claim.
- Do not edit while a relevant runner is active; one writer in the inherited dirty cwd.

## Review Focus

1. Same-looking merge cells can duplicate or omit normalized source contributions: Task 1 pins exact slot membership and multiplicity.
2. Existing `createTransferredBatch` edits source and overwrites servings: Task 2 must prove the new scenario survives setup and restore existing callers' behavior.
3. Workbook dish names may resolve ambiguously or select the wrong tier/BOM: Task 1 uses stable codes and explicit unique resolution; no first-match fallback.
4. Lost-response retries and two actors can pass UI checks while duplicating persisted evidence: Task 3 asserts source/ledger counts, identities and protected snapshots at the real owner.
5. Slow evidence capture or unsupported observers can manufacture a false performance PASS/FAIL: Task 4 separates timing and functional runs, and checks counts/nulls/route readiness.

## Ownership map

| File | Intended responsibility |
|---|---|
| `frontend/tests/e2e-mrx/fixtures/menuCoverage.ts` (new) | Test-only authored four-section workbook transformations, manifest, independent decimal expected facts; no product import |
| `frontend/tests/e2e-mrx/fixtures/__tests__/menuCoverage.test.ts` (new) | Small behavioral checks for authored source/merge expansion and independent arithmetic |
| `frontend/tests/e2e-mrx/fixtures/mrxWorkflow.ts` | Preserve baseline setup; allow coverage scenario to use its own edit/serving sequence without baseline rewriting it |
| `frontend/tests/e2e-mrx/fixtures/__tests__/mrxWorkflow.test.ts` | Existing scope/template ownership behavior, extended only if interface changes |
| `frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts` | Primary new coverage case, edits/swaps, revision/day-lock/terminal chain assertions |
| `frontend/tests/e2e-mrx/specs/g1-golden-path.spec.ts`, `g4-concurrency-rollback.spec.ts`, `g5-async-timeout.spec.ts`, `g6-merged-customer.spec.ts` | Existing ledger/race/recovery/customer owners; change only when their distinct assertion is insufficient |
| `frontend/tests/e2e-mrx/specs/g7-data-path-performance.spec.ts` (new) | Bounded cold/warm data-path observations, no endurance |
| `frontend/tests/e2e-mrx/core/qualificationMetrics.ts` and `core/__tests__/qualificationMetrics.test.ts` | Existing quantiles/observer support semantics; extend only for missing route/API measurements |
| `frontend/tests/e2e-mrx/fixtures/actionEvidence.ts`, `core/mysqlVerifier.ts` | Existing sanitized evidence and scoped DB oracle; extend existing owner only if required |
| `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`, `MrxEvidenceSafety.ps1` | Narrow diagnostic admission/phase selection using existing ownership/cleanup |
| `backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs` | Existing runner admission/safety regression owner |
| `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportParserTests.cs`, `WeeklyMenuImportBatchTests.cs`, `MrxSourceChangeApplierTests.cs` | Source-backed import/reimport/applier proof; add only independently valuable gaps |

All other product files are read-only for this verification scope. New files are test infrastructure, not test-only production exports.

## Task 1: Author coverage workbook and independent expected facts

**Interfaces:** Consumes the canonical XLSX and `MrxScenarioScope` (`mrxWorkflow.ts`). Produces `writeMenuCoverage(scope: MrxScenarioScope): MenuCoverageManifest` in `fixtures/menuCoverage.ts`; writes run-owned workbook variants plus manifest beside `scope.workbook`, returns their paths/hashes and explicit before/after source/serving/material expectations. It must not query or mutate the main DB. Clone prerequisite resolution is explicit and must fail on missing/ambiguous codes. Keep manifest type local/exported only to test consumers.

- [ ] Read test-audit/ipc-test-audit, complete parser/reimport/applier tests and relevant production parsing rules, canonical template ZIP/merge structure, BOM selection/conversion and quantity rounding owners. Resolve supported combined merges and slot multiplicity; record exact supported/rejected behavior in the spec/manifest before writing expected totals.
- [ ] Inventory a bounded clone prerequisite set (dish/BOM/unit codes and tier/scope) without dumping business rows publicly. If unavailable from approved clone import, record BLOCKED; do not seed speculative BOMs or choose an unrelated recipe.
- [ ] Author IMP-01..04, EDT-01..02, SWP-01..03, SRV-01..02, RIM-01..02 and NEG-01..02 expected facts. Pin non-equivalent A/B BOMs, unequal section servings and named unchanged control scope. No seventh-day/template-layout assumption.
- [ ] Add `menuCoverage.test.ts` cases named `writes_four_sections_without_overwriting_template`, `expands_horizontal_and_vertical_members_without_cross_section_leak`, and `computes_changed_servings_from_authored_decimal_rates`. Assertions check all four section keys, exact member tuples, original template hash, deliberate A/B change and exact decimal totals from hand-authored constants. Combined merge success/rejection follows the resolved contract, not a guessed parser expectation.
- [ ] Run from frontend: `npx --no-install vitest run tests/e2e-mrx/fixtures/__tests__/menuCoverage.test.ts`; observe intended RED for absent generator/behavior, not a missing dependency or unrelated config failure.
- [ ] Implement only test-side workbook/manifest support using installed ZIP/XML facilities. Keep source bytes/hashes traceable, correct XML escaping and canonical file immutable. Existing generated XLSX helper patterns are preferred to a dependency.
- [ ] Re-run the same focused command to GREEN. Independently inspect generated ZIP section/date/merge contents, using another reader/assertion rather than trusting the generator output alone.
- [ ] Only if a distinct parser/reimport gap was found, extend the existing C# owner and run `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~WeeklyMenuImportParserTests|FullyQualifiedName~WeeklyMenuImportBatchTests|FullyQualifiedName~MrxSourceChangeApplierTests"`. Product failure remains a finding, not permission to repair it.

**Acceptance:** a valid workbook and labeled variants cover the requested cases with independent expected facts, or a named prerequisite is BLOCKED. Helper unit tests are not import/E2E acceptance.

## Task 2: Integrate coverage into real import and source editing

**Interfaces:** Consumes Task 1 manifest and existing `scenarioScope`. Produces persisted checkpoints and sanitized evidence under the runner artifact directory. Extend `createTransferredBatch` with an optional test-only `sourceScenario` callback on its existing `pages` options, invoked at the current source-edit/servings stage; when absent, retain the complete baseline flow. Callback signature: `(coordinator: Page, scope: MrxScenarioScope) => Promise<void>`. It replaces baseline source authoring only, never import/approval/transfer guards. If extraction without an option is smaller, use a named existing-stage helper with real baseline and coverage callers; do not duplicate the entire workflow.

- [ ] Load ipc-code-review and inspect every caller of `createTransferredBatch` before editing. Ensure timing tests can opt out of evidence overhead without changing user business behavior.
- [ ] Extend G6 with `@G6-Menu-Coverage four sections preserve import merge members and changed source through terminal readback`. Assert preview non-mutation, exact authored tuples for all four sections after actual UI import, no import-default servings, and a unique unchanged customer/week control.
- [ ] Add the source scenario through existing UI controls: per-member/group replacement, horizontal/date swap and vertical/slot swap. Submit both sides of a swap together through the existing command; if the UI cannot express that atomic edit, record the gap instead of quietly simulating it with two independent writes or adding a new feature.
- [ ] Give source mutations unequal serving values and separate increase/decrease revisions. Verify payload's exact identities/fields and fresh DB/DOM reads against the manifest, not just labels and counts.
- [ ] Check identical/changed reimport and old version snapshots. Use fresh scope only where the contract makes replay against the same state invalid; keep edit→downstream evidence connected to the actual changed source.
- [ ] Implement minimal fixture integration while preserving baseline callers. Validate fixture-only regressions with `cd frontend && npx --no-install vitest run tests/e2e-mrx/fixtures/__tests__/mrxWorkflow.test.ts tests/e2e-mrx/fixtures/__tests__/menuCoverage.test.ts`.
- [ ] Keep E2E runtime execution deferred until Task 5 admits the fresh clone. Do not launch Playwright against existing FE/BE to manufacture RED. During execution, missing coverage assertions must expose the intended stale/cross-scope/missing-source condition or pass on correct product; tests of correct existing behavior do not require intentionally breaking product code.

**Acceptance:** no setup step silently rewrites the workbook scenario; all four section facts and edits are checked through real import and current source-command boundaries.

## Task 3: Bind downstream integrity, roles, concurrency and recovery

**Interfaces:** Consumes persisted changed source from Task 2 and independent ingredient/serving totals. Produces checkpoint evidence mapping each coverage ID to request, normalized source, projection, ledger, DOM and parsed export artifacts. Extend existing DB/evidence owner only where absent; no independent parallel truth service.

- [ ] In the G6 coverage case assert menu/servings + daily/weekly projection + cooking contributors for open days, and exact before/after immutability for locked days.
- [ ] Use existing Golden/stock oracle for initial/supplemental issues, canonical MRX provisioning movement identity and quantities, audit/version/idempotency and reconciliation actuals. Bind expected quantities to changed source rather than replacing the scenario with a simpler batch.
- [ ] Parse Chef CSV/XLSX, reconciliation/history exports and actual UI values; compare identities/units/quantities and expected scope. If actual rows exceed one page, follow server metadata and prove exports include the documented whole scope. Do not provision a separate large dataset without recording the need.
- [ ] Extend existing G6 decision/race owner for one mixed open/locked-date rejection and stale editor, with relevant protected row snapshots before/after. Assert no partial revision/projection writes; forbidden actors' API calls remain separate permission tests.
- [ ] Reuse G4/G5 assertions for duplicate command, committed-but-lost-response and failed readback; add only missing independent source/ledger proof. Never broaden interception to replace the real mutation; response fault injection must leave real clone persistence observable.
- [ ] Exercise route/customer/date switch and reload with two distinguishable scopes; drafts and query scope must survive according to current contracts. Wrong mode/session failures must show no unauthorized writes.
- [ ] For any failure, record first divergent boundary and stop unsafe dependent steps. Do not repair product, relax precision, infer missing facts, suppress a failed case or upgrade existing historical evidence.

**Acceptance:** every COR-01..09 and adversarial requirement has a named owner/evidence mapping, or an explicit uncovered BLOCKED/NEEDS_EVIDENCE row. Happy path and negative controls cannot substitute for each other.

## Task 4: Add bounded performance measurement and safe diagnostic admission

**Interfaces:** Reuse `summarizeSamples`, `installInteractionProbe`, `collectInteractionSamples`. New G7 data-path case consumes the same coverage manifest and fresh owned scopes; emits raw samples and metadata under the current run, separate from functional screenshots. Add `MenuIntegrityPerformance` to existing diagnostic validation and phase selection; functional selects `@G6-Menu-Coverage` plus named existing race/recovery/customer cases needed by Task 3; performance selects only `@G7-Data-Path`. Never let this diagnostic fall through to G8/default phases.

- [ ] Add metric owner tests to `core/__tests__/qualificationMetrics.test.ts` for exact P75 on a known list, unsupported metrics retained as null, and insufficient/empty samples not passing a budget. Reuse existing tests where already covered.
- [ ] Implement route/API timing only where existing helpers lack it. Declare exact timing origin, route-correct first frame and authoritative data-ready marker; if no defensible first-frame marker exists, output NEEDS_EVIDENCE for that target rather than instrument product code just for tests.
- [ ] Add `g7-data-path-performance.spec.ts`: per selected source/warehouse/Chef/reconciliation route, 20 warm observations and 5 fresh-context cold observations. Separate samples by route/condition/build; measure at least 5 equivalent fresh-scope import/preview/apply interactions, excluding setup from timed windows. Preserve final correctness readback.
- [ ] Keep measurement bounded to 30 minutes total performance phase. If raw observation minimum cannot fit, stop and report incomplete samples, not PASS; request a larger time budget rather than silently expanding into endurance.
- [ ] Record request counts/latency, transfer sizes and supported browser observers; do not install slow-motion/evidence capture inside timed windows. Match PERF-01..05 thresholds and caveats exactly.
- [ ] Extend `MrxDisposableEvidenceContractTests.cs` to prove the new diagnostic is admitted only under existing valid invocation rules and selects no G8/endurance/HTTP-load phase. Prove target/credential/cleanup invariants are unchanged. Update existing invocation enumeration only for this legitimate named diagnostic, not an exemption.
- [ ] Run `cd frontend && npx --no-install vitest run tests/e2e-mrx/core/__tests__/qualificationMetrics.test.ts tests/e2e-mrx/core/__tests__/connectionGuard.test.ts tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts tests/e2e-mrx/core/__tests__/globalTeardown.test.ts` and `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter FullyQualifiedName~MrxDisposableEvidenceContractTests`.
- [ ] Verify relevant lint, harness consumer checks and installed runner discovery after source review; no browser/globalSetup invocation during planning or unadmitted runtime. Existing source-owned gates are not bypassed to shorten the campaign.

**Acceptance:** finite new diagnostic selects only intended cases, preserves all ownership gates, and cannot manufacture NFR PASS from observer absence or insufficient samples.

## Task 5: Admit and execute one fresh disposable run

**Files:** Existing runner and its receipt/artifact mapping; `.planning/WORK.md` for live progress. No production file changes.

- [ ] Confirm owner reviewed spec/plan; load executing-plans, test-audit/ipc-test-audit, ipc-code-review, ipc-ui-review and verification-before-completion at their applicable gates. Record git status/HEAD/staging and preserve inherited changes.
- [ ] Read the complete current runner/safety/setup/teardown code and scoped instructions; verify no historical environment variable (`MRX_COORDINATED_TAIL_RECEIPT`, campaign ID or credentials override) redirects selection/ownership. Reject unexpected inherited values; do not reuse their targets.
- [ ] Confirm source identity/config without printing secrets; fresh run/clone absent, official test actors, run-owned ports/runtime/profile, cleanup and disk admission. Do not replace user listeners; existing runtime ownership contract determines dedicated ports. Block if no safe production bundle serving is available.
- [ ] From repo root run `powershell.exe -NoProfile -File scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 -Mode Preflight -Profile Qualification -Diagnostic MenuIntegrityPerformance`. Verify current admission accepts this newly implemented selection and no DB clone/mutation occurs in preflight. Capture receipt and admitted targets before Execute.
- [ ] Execute only after all prior gates pass: `powershell.exe -NoProfile -File scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 -Mode Execute -Profile Qualification -Diagnostic MenuIntegrityPerformance`. The runner, not a handwritten SQL command, creates and owns the fresh clone/principal and starts/stops its isolated runtime. Do not set CampaignId or reuse an old run directory.
- [ ] Consume actual runner/Playwright outcomes and per-case artifacts at each phase barrier. A business PASS with repository gate failure is not overall PASS. The runner may be fail-fast; do not restart failed scenarios on a retained clone under historical permissions.
- [ ] Verify final Finish/Abort cleanup receipt: only owned clone/subordinate/principal/process/temp resources removed; evidence retained. If interrupted, use exact run identity and existing runner recovery admission; uncertain ownership is BLOCKED_CLEANUP, never ad-hoc drop/kill.
- [ ] Verify source manifest/checksum drift and least-privilege bindings. If a user concurrently changed source, report attribution uncertainty rather than calling the run a main-write violation or claiming a clean main without proof.

**Acceptance:** fresh scoped runtime evidence exists, no main writes by the campaign are demonstrated through target binding/least privilege/receipts, and cleanup is verified or BLOCKED_CLEANUP is explicit.

## Task 6: Synthesize verdict and close

- [ ] Cross-map every spec coverage ID and COR/PERF requirement to observed result and artifact. Distinguish valid merge import, correctly rejected unsupported input, product failure, harness failure and not-run case.
- [ ] Report exact build/source/workbook/oracle hashes, actor/mode/dataset, row/lineage/decimal comparisons, raw timing sample counts and percentile targets. Flag unsupported/uncertain first-frame metrics honestly.
- [ ] Rank defects by data/security impact before latency; name first divergent boundary, expected/actual and smallest proposed owner repair. Do not perform repair without a new authorized scope.
- [ ] Run `git diff --check --` with only this task's changed files and relevant installed lint/tests for actual harness changes. No whole dirtytree attribution or fabricated named-contract-test PASS. Record applicable skill reports in `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact` format.
- [ ] Update WORK to CLOSE → IDLE with per-criterion PASS/FAIL/BLOCKED/NEEDS_EVIDENCE and cleanup result; no commit/push. Keep artifacts as evidence, not another live task tracker.

## Spec-to-task review

| Spec | Task |
|---|---|
| Authorization/non-goals, current owners | Global constraints, 5, 6 |
| Workbook IMP/EDT/SWP/SRV/RIM/NEG and independent oracle | 1, 2 |
| COR-01..09 downstream/exports/scope | 2, 3 |
| Roles/races/retry/recovery | 3 |
| PERF-01..05 and bounded samples | 4, 5 |
| Clone safety, no main mutation, cleanup | 4, 5 |
| Findings/evidence/status and no implicit repair | 3, 6 |

Self-review is native single-context, not independent reviewer evidence. No commits or subagents are required by this plan. Actual execution starts only after review; no test, clone or browser result is asserted by these documents.
