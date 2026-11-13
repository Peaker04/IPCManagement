# MRX Worst-Case Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native task-by-task execution. The operator's native Pi/no-delegation contract overrides the generic subagent-driven recommendation. Checkboxes describe future execution steps; live progress belongs only in `.planning/WORK.md`. This plan is NOT permission to run those steps.

**Goal:** Qualify MRX against all M01–M30 and C01–C07 requirements, including real customer creation, concurrent customers, uppercase/new dishes and missing-BOM recovery, with independently verifiable bounded evidence.

**Architecture:** Reuse the existing disposable MySQL lifecycle runner and current public command/read owners. Use one primary owner test per contract, real authenticated browser contexts for user effects, deterministic competing schedules for database races and independent persisted/file oracles. No new provider harness, production test seam or blanket full-suite duplication.

**Tech Stack:** Existing .NET/EF Core/MySQL, React/TypeScript/Vitest, Playwright/Chrome, PowerShell runner, installed CSV/XLSX tools. No dependencies added.

**Spec:** [2026-11-11-mrx-worst-case-testing-design.md](../specs/2026-11-11-mrx-worst-case-testing-design.md).

## Global Constraints

- Documentation approval is not execution, code-edit, fixture-creation or fault-injection authorization.
- Native Pi parent only; no delegation, external agent CLI, package installation, commit/push or destructive git operations.
- No source DB writes or main-service restart. Only explicitly approved run-owned targets and processes may be mutated or stopped.
- Existing `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` is the sole MRX rehearsal lifecycle owner; no parallel clone/provider harness.
- Do not weaken assertions, permissions, skips, allowlists, thresholds or architecture baselines to manufacture PASS.
- DEFAULT != MATERIAL_RECONCILIATION; MRX never checks, decrements or provisions DEFAULT physical stock.
- No bearer tokens, cookies, passwords, dumps or credential-bearing traces in shared evidence. Qualification traces remain off.
- Preserve inherited workspace changes. `.planning/WORK.md` is the sole task-state owner; evidence receipts are not a second task ledger.

## Review Focus

1. New customer selected in the UI must actually be the one used by source/batch/issue; existing G6 creates then switches to an inherited customer. Pin C01 at T1 and C02 at T3 with ID-bound DB assertions.
2. Uppercase/diacritic/portion normalization can collapse distinct dishes whose BOM differs. Pin C04–C06 at T2 using public import and persisted dish IDs, not helper output as expected value.
3. An ingredient without physical stock must not fail MRX just because the existing stock snapshot helper requires one row. Pin M20 at T6 with absence-aware DB assertions and no provisioning.
4. HTTP dispatch overlap is not proof of internal export/source read overlap. Pin M21/M22 at T7 with transaction/writer timing and independent workbook oracle.
5. Response-loss replay and completion can appear green when a permission/stale guard rejects before the intended boundary. Pin valid preconditions/commit observation at T5 and separate policy denials at T8.

## 1. File and ownership map

Only the spec, this plan and WORK are edited under the current authorization. Paths below are existing owners or explicitly marked proposed future test files, not permission to modify product code.

### Lifecycle/test support

- Existing: `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`, `scripts/mrx-evidence/MrxEvidenceSafety.ps1`.
- Existing: `frontend/tests/e2e-mrx/config/playwright.mrx.config.ts`.
- Existing: `frontend/tests/e2e-mrx/fixtures/mrxTest.ts`, `authHelpers.ts`, `mrxWorkflow.ts`.
- Existing: `frontend/tests/e2e-mrx/core/mysqlVerifier.ts`, `dbGuardrail.ts`, `globalSetup.ts`, `globalTeardown.ts`, `ownedProcesses.ts`, `qualificationMetrics.ts`.
- Future edits only if approved and needed: extend current fixture/oracle for a distinct boundary; keep one writer, guards, exact cleanup, trace off. Do not invoke verifier.execute with mutations as a shortcut to real business commands.

### Catalogue/customer boundary

- Product read owners: `frontend/src/features/admin/CreateCustomerModal.tsx`, `frontend/src/features/admin/branches/AdminCustomersBranch.tsx`, `frontend/src/features/admin/branches/AdminCatalogBranch.tsx`, `frontend/src/features/admin/branches/AdminBomBranch.tsx`; `frontend/src/api/adminApi.ts`.
- Product read owners: `backend/src/IPCManagement.Api/Features/Coordination/Controllers/CustomerContractsController.cs`, `Services/CustomerContractService.cs`, `Services/CustomerContractPolicy.cs` under the same Coordination feature.
- Product read owners: `backend/src/IPCManagement.Api/Features/Catalog/Controllers/DishesController.cs`, `Services/DishCatalogService.cs`, `Services/DishBomPolicy.cs`, `Services/DishBomImportService.cs` under Catalog.
- Existing test keepers: `backend/tests/IPCManagement.Api.Tests/CustomerContractPolicyTests.cs`, `CustomerWeekMenuTierIntegrityTests.cs`, `DishCatalogServiceTests.cs`, `DishCatalogTests.cs`, `DishBomPolicyTests.cs`, `DishBomImportServiceTests.cs`; `frontend/src/__tests__/AdminCustomersBranch.test.tsx`.
- Existing runtime keeper: `frontend/tests/e2e-mrx/specs/g6-merged-customer.spec.ts`; extend only the distinct create-then-use/uppercase/BOM risks missing from it. It already has missing-BOM and conversion tests; do not duplicate them blindly.
- Proposed only if a separate concurrent boundary is absent: `frontend/tests/e2e-mrx/specs/mrx-two-customer-concurrency.spec.ts` for C02/C03 and J1.

### Source/commands/ledger/output

- Source owners: `backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportSupport.cs`, `WeeklyMenuImportService.cs`, `WeeklyMenuImportPreviewTicketStore.cs`; `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxSourceChangeApplier.cs`, `MrxEditScopeQuery.cs`.
- Command/transaction owners: `backend/src/IPCManagement.Api/Features/Inventory/Services/ReconciliationInventoryIssueCreator.cs`; `backend/src/IPCManagement.Api/Data/Transactions/EfTransactionRunner.cs`; `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`, `ReconciliationCompletionService.cs`, `ReconciliationNetIssueProjection.cs`.
- Read/file owners: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationPreparationWorkbookExporter.cs`, `ReconciliationKitchenExportService.cs`, `MrxAuditScopeQuery.cs`, `MrxTransactionHistoryQuery.cs`.
- Existing keepers: `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportParserTests.cs`, `WeeklyMenuImportBatchTests.cs`, `MrxSourceChangeApplierTests.cs`, `ReconciliationWarehouseIssueApplicationPathTests.cs`, `ReconciliationWarehouseIssueApplicationPathTests.History.cs`, `ReconciliationServiceTests.cs`, `ReconciliationVariantServingsTests.cs`, `ReconciliationDailyLineagePolicyTests.cs`, `ReconciliationPreparationWorkbookTests.cs`, `ReconciliationKitchenExportTests.cs`, `EfTransactionRunnerTests.cs`, `LifecycleOutboxProcessorTests.cs`.
- Provider existing: `backend/tests/IPCManagement.Api.Tests/Integration/WeeklyMenuImportMySqlConcurrencyTests.cs` (not an export race substitute).
- Runtime existing: `frontend/tests/e2e-mrx/specs/g1-golden-path.spec.ts`, `g2-multi-role-handoff.spec.ts`, `g3-alternative-flows.spec.ts`, `g4-concurrency-rollback.spec.ts`, `g5-async-timeout.spec.ts`, `g6-direct-source-edit.spec.ts`.
- Proposed if no stronger keeper exists: `frontend/tests/e2e-mrx/specs/mrx-export-source-concurrency.spec.ts` for M21/M22. Support changes to prove internal schedules require explicit approval, not a production test-only export or alternate lifecycle runner.

### FE authority/temporal/performance/recovery

- Existing FE keepers: `frontend/src/__tests__/MrxBatchScopeAuthority.test.tsx`, `MrxSourceEdit.test.tsx`, `MrxSourceEditFoundation.test.ts`; existing broader WeeklyMenu/Warehouse/Reconciliation suites remain but are not automatically expanded beyond growth limits.
- Existing browser owner: `frontend/tests/browser/loading-ux-async-consistency.spec.ts` and `docs/superpowers/plans/2026-11-10-mrx-end-to-end-render-continuity.md`.
- Existing runtime performance files: `frontend/tests/e2e-mrx/specs/g7-data-path-performance.spec.ts`, `g7-desktop-memory.spec.ts`, `g8-five-user-endurance.spec.ts`. Read complete declarations before reuse; filenames are not evidence of required coverage.
- Existing recovery owners: `scripts/database-recovery/Invoke-DatabaseRecovery.ps1`, `RestoreOracle.ps1` under that directory, and `docs/OPERATIONS.md`.

## 2. Execution admission and command policy

T0 must produce an owner-approved packet before any mutating test/fixture run. The packet names: cases, exact target/source identity, fresh candidate, actor scopes, diagnostic selector, expected setup writes, clone-only catalogue creation, isolated processes/ports, bounds, permitted faults, data protection, cleanup and stop conditions. Preflight, execute, restart, load and restore are separate permission classes.

Read complete runner/safety/global setup/teardown before any runner invocation. Current diagnostic options are finite; Race only selects @G4-Race. Do not call unsupported diagnostic names or run raw Playwright against main. If required selectors/support are missing, first request bounded test-support editing permission and then re-review exact lifecycle admission. Existing Start/Run/Finish campaign modes do not automatically authorize a long-lived campaign.

Command recipes below are future references, not commands executed by this plan:

```text
# Read-only workspace intake
 git status --short --branch
 git rev-parse HEAD
 git diff --cached --name-only

# Focused provider-independent owner test example, only after test-execution approval
 dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationPreparationWorkbookTests" -c Release -p:UseAppHost=false --no-restore

# Owner FE scope test example, after approval
 npm run test:unit -w frontend -- src/__tests__/MrxBatchScopeAuthority.test.tsx --maxWorkers=1

# Existing provider runner preflight, separately admitted after full source review
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 -Mode Preflight -Profile Qualification

# Full repository gate; not concurrency qualification and may stop on inherited debt
 npm run verify

# Documentation/scoped whitespace check
 git diff --check -- .planning/WORK.md docs/superpowers/specs/2026-11-11-mrx-worst-case-testing-design.md docs/superpowers/plans/2026-11-11-mrx-worst-case-testing.md
```

Before copying a focused dotnet command, classify its test setup: provider-independent vs DB-mutating vs evidence-owned. Do not set a generic IPC_TEST_CONNECTION_STRING to main. `--no-restore` requires installed/restored packages; missing assets is BLOCKED, not permission to install. If main Debug apphost lock reappears, use approved isolated Release output from existing runner; do not kill main or infer intended RED from MSB3027. FE lint/build/test gates follow actual package scripts; browser typecheck uses installed TypeScript/Node types and current config, not auto-downloading npx.

When extending tests: name observable contract, credible regression, unique keeper and why existing case cannot prove it. For a discovered defect, record intended pre-fix failure and stop for fix authorization. Do not repair product code because plan says tests should pass. No deliberate temporary production mutation to manufacture RED without its own authorization.

## 3. Tasks

### T0 — Reconcile coverage and admit the first bounded run

**Files:** Read AGENTS, WORK, spec, handoff, DOMAIN/MRX/OPERATIONS/DESIGN owners, complete applicable test declarations and runner/safety. Update WORK only for task status.

**Interfaces:** Consumes M/C case catalogue and actual current checkout. Produces reviewed case-to-keeper map, policy decisions and one signed execution packet; no new production interface.

- [ ] Recheck git/index, listeners, artifact identity and actual DB/tooling access using read-only approved paths. Missing process env alone is not missing infrastructure.
- [ ] Read each keeper and production entry/callers relevant to the admitted task. Record R retain/F weak/C duplicate/D no-value only for tests actually read; do not claim a whole-suite pruning audit or delete anything.
- [ ] Resolve matching semantics, roles, contract/tier readiness, MRX return/actual path and replay mismatch behavior from canonical owners. Request owner decision only for real conflicts.
- [ ] Compare existing G6/G7/G8 declarations with C01–C07/M30; record presence separately from executed evidence. Preserve historical failures and results.
- [ ] Check current diagnostic selectors against required cases and evidence fields. Draft any minimal missing support change as a separate approval request.
- [ ] Obtain the explicit first execution packet. If not granted, stop at PLAN_READY. Do not run the recipe commands merely because they appear above.

**Acceptance:** Every admitted case has a real keeper/entry, intended oracle, supported selector and owned cleanup; any unadmitted case remains NOT_RUN/BLOCKED. Performance/fault/recovery remain independently gated.

### T1 — Created customer is usable in MRX (C01,C03)

**Files:** Existing G6, customer modal/branch/controller/service and customer tests in section 1; no product edits. Only extend G6/fixtures after code-edit approval.

**Interfaces:** Consumes approved customer/contract input fields from C# DTO and actual current permission policy. Produces persisted A/B customer IDs, code/contract/tier facts and newly selected MRX source/batch IDs for T3; not a hardcoded inherited label.

- [ ] Read complete CreateCustomerContractRequest, CreateCustomerModal and service transaction/uniqueness policy. Validate fixture body against DTO, not inferred field names.
- [ ] Reuse existing G6 create/reload assertions; add missing create-then-use assertions at browser/API/DB boundary if authorized. Record POST201, returned ID, persisted rows, reload and selector value.
- [ ] Enter NEW A into MRX through real source path; prove all source/batch rows reference A. Do not select AMANN or another inherited customer after creation as a substitute.
- [ ] Try duplicate code, invalid contract prerequisite and valid insufficient actor at their actual guards; compare customer/contract/tier state after rejection.
- [ ] Bring A to IN_PROGRESS/locked date; create B and enter same week; snapshot A before and after B operations. Check no inherited B locks/draft/status.
- [ ] Capture M20 stock isolation for these operations and exact cleanup receipts through existing lifecycle owner.

**Acceptance:** C01/C03 pass only when the new identity is used end-to-end; creation alone passes only the creation substep. Rerun related customer keeper and gate only after approval.

### T2 — New uppercase dish, missing BOM and recovery (C04–C07,M01,M04,M25)

**Files:** Existing G6, catalogue/BOM/import keepers and `WeeklyMenuImportSupport.cs` read-only owners; schema-shaped test inputs. Extend keeper tables rather than duplicate helper tests.

**Interfaces:** Consumes T1 IDs and actual dish/BOM DTOs, applicable dates/price tiers and unit conversion policy. Produces ID-bound new dish, blocked preview evidence and corrected valid BOM/source values for T3.

- [ ] Read actual import caller of NormalizeDishMatchKey/SelectPreferredImportedDish and catalogue create/uniqueness behavior. Pin the expected policy before assertions; do not equate observed normalization with business approval of arbitrary collision winners.
- [ ] Create a genuinely new uppercase dish via UI/POST api/Dishes, reload and use returned ID. Exercise case, whitespace, composed/decomposed accent, Đ and numeric G/GRAM variants through public import. For collisions, use distinct persisted IDs/BOMs and compare final chosen ID; unresolved policy is BLOCKED_POLICY.
- [ ] Exercise C05 no-BOM at exact readiness boundary: allow supported catalogue/draft save, then verify quantity preview/freeze/apply rejection and no partial projection. Use valid actor/scope/servings to avoid unrelated rejection.
- [ ] Extend existing BOM applicability cases for C06: published/effective/customer/tier precedence, compatible/incompatible/missing conversion; one failing dish among valid dishes. Do not assert detection of omitted recipe ingredients without a recipe-completeness contract.
- [ ] Exercise missing/zero/negative/out-of-range split servings, distinct savory/vegetarian multipliers and repeated dish slots. Oracle uses exact decimals and source grain, not projection output.
- [ ] C07: correct prerequisite BOM through actual approved UI/API owner, re-preview same new dish, prove changed cache authority and correct independent quantity; no duplicates from failed attempt.
- [ ] M04: change master facts after freeze/issue in clone, compare locked contributor snapshot; M25: file/DOM injection and service-calendar/date boundaries at relevant existing keeper.

**Acceptance:** New dish identity, missing-BOM rejection and same-dish recovery have separate evidence. Missing fixture or ambiguity is not a silent conditional pass. Product mismatch triggers report/stop, not auto-fix.

### T3 — Two customers truly coexist concurrently (C02,J1)

**Files:** Existing G6/fixtures/verifier first; proposed `frontend/tests/e2e-mrx/specs/mrx-two-customer-concurrency.spec.ts` only for distinct missing runtime boundary, plus minimal approved runner selector integration.

**Interfaces:** Consumes new A/B IDs, separate source data/tickets/batches, shared approved dish and different serving quantities from T1/T2. Produces per-customer and aggregate immutable observations with overlap timestamps and new-connection DB checks.

- [ ] Read `MrxScenarioScope` and `createTransferredBatch` completely; supply actual customer object and separate scenario IDs/weeks as designed, never rely on default customer fallback.
- [ ] Use two real Coordinator contexts and independent Warehouse contexts. Keep Playwright workers1. Record both clients arriving at import/commit boundaries and run distinct scope operations concurrently.
- [ ] For each source/preview/commit/freeze/transfer/issue phase record A/B IDs, versions, ticket/command identities and outcome. Different customers may both succeed; no forced one-winner assertion.
- [ ] Compare A business rows immediately around B-only work and vice versa; exclude intentional shared catalogue preparation from this interval. Check scope authority, receipts, quantity and per-day locks.
- [ ] Download A-only, B-only and combined outputs; parse actual files and compare customer-column IDs, exact rows and per-unit sums against DB.
- [ ] Compose J1 only after C01–C07 independent checkpoints work. Any upstream fixture failure blocks downstream assertions rather than marking the journey complete.

**Acceptance:** Overlap is demonstrated at named phases; no cross-customer mutation, wrong receipt or output column assignment; M20 passes. One browser switching customers sequentially does not satisfy C02.

### T4 — Source atomicity and apply-vs-issue (M02,M03,M05,M08)

**Files:** Existing `g6-direct-source-edit.spec.ts`, source/import tests, `MrxSourceChangeApplierTests.cs`, existing integration test as reference; real public issue owner read-only.

**Interfaces:** Consumes valid open/locked scope and source preview. Produces locked-date/rollback/revision evidence and both apply-vs-issue schedule outcomes.

- [ ] Inventory existing intended source cases and keep their independent assertions; extend one owner table for preview tampering/expiry and mixed locked/open payload if absent.
- [ ] M02 file subcases: send existing non-workbook/malformed workbook, missing required sheet/column, duplicate conflicting rows and bounded configured-limit input. Assert real validation error/commit disabled and no persisted writes; a preview validation DTO may legitimately be HTTP200. Review parser/size limits first; do not generate unbounded zip/decompression payloads.
- [ ] Capture menu/servings/batch/contributor/revision/delta pre-state; reject mixed-date payload; assert business-state equality and exact locked-date diagnostic.
- [ ] Exercise import/amendment/reimport/rollback and inspect old normalized snapshot, actor/reason/revision; verify rolled-back source cannot reactivate. Exercise Coordinator submit → Manager rejection with mandatory reason and a separate valid approval/apply; prove submit/reject has no apply effects, stale/duplicate decisions do not append duplicate revisions and history remains readable.
- [ ] Execute M08 both schedules using actual source apply and actual issue entry. Do not use the existing manual imitation of issue writes as public-command MySQL proof.
- [ ] Assert issue-first MRX_DAY_LOCKED and apply-first stale issue conflict with no post-issue rewrite; inspect independent DB history and reload relevant MRX readers.

**Acceptance:** Atomicity and immutable history proven separately from HTTP status; valid preconditions reach the intended guard.

### T5 — Competing issue/completion, replay and uncertain commit (M06,M07,M09,M10,M26)

**Files:** Existing G4/G5, `ReconciliationWarehouseIssueApplicationPathTests.cs`, `EfTransactionRunnerTests.cs`; command/completion/transaction owners read-only. No test-only production seams.

**Interfaces:** Consumes transferred/initial/complete-eligible fixtures and approved fault packet. Produces bounded race schedules, committed-result identity and persisted effect counts for T6/T11.

- [ ] Retain the existing @G4-Race oracle unchanged in strength; fresh run must still assert both valid POSTs, initial immutability, winner-only receipt/version and loser draft/reload.
- [ ] Add/reuse initial-vs-initial and completion-vs-supplement public-command cases at existing keeper; name supported selector via reviewed runner admission before running.
- [ ] Exercise writer schedules with preconditions verified on DB, not only button enabled. Inspect issue counts, line IDs, batch version/status and active decision validity.
- [ ] Reuse G5 real committed-response-loss path where applicable; prove original commit by persisted receipt before retrying same command. Add concurrent same-command and altered-body replay assertions consistent with reviewed contract.
- [ ] If fault permission granted, reach approved between-save/around-commit/deadlock boundaries using existing safe infrastructure; observe actual rollback or canonical commit. Lack of safe injection capability is BLOCKED, not permission for new product hook or killing MySQL/main API.
- [ ] Verify no tracked-state retry loss/duplication at transaction keeper and real MySQL boundary; distinguish infrastructure setup errors from intended failure evidence.

**Acceptance:** Exact once-per-command effect at tested owners, no orphan, no post-completion issue, all required schedules reached. Do not infer a universal exactly-once guarantee.

### T6 — Quantities, decisions, completion and cooking (M11–M15,M20,M24,J2)

**Files:** Existing lineage/variant/service/history/kitchen tests; existing G1/G3/G6 runtime keepers; verifier read-only SQL additions only when approved.

**Interfaces:** Consumes actual frozen/issued IDs and source/BOM facts. Produces independently computed per-grain quantity/net-ledger/history and completed/cooking outputs; never fabricates receipt/disposition rows as proof.

- [ ] Use table-driven wrong identity/duplicate/omitted line cases; valid permission/version ensures rejection reason is intended. Snapshot business state before each negative control.
- [ ] Review supported MRX return/actual command path; admit it explicitly or record policy/capability gap. Compare accepted vs pending return effects at exact linked daily line.
- [ ] Compute expected six-decimal required/net quantities from approved inputs; include equal display names/different IDs, repeated slots, variant and unit conversion risks without cross-unit totals.
- [ ] Compete daily decisions; cause legitimate subsequent invalidation, inspect active and historical evidence. Reject incomplete all-date completion and confirm accepted nonzero completed variance.
- [ ] Test legacy unavailable evidence separately from genuine zero. Parse JSON/CSV/XLSX cooking/completed output as supported.
- [ ] M20: compare all affected physical stock/lot/movement facts and continued absence for no-stock ingredient. Never seed stock merely to make `captureStockSnapshot` work.
- [ ] Compose J2 with stage-level checkpoints after independent cases have proved their boundaries.

**Acceptance:** Canonical quantitative oracle, unchanged locked history and physical-stock isolation; completion label alone never substitutes for balance evidence.

### T7 — Consistent export and lock-duration (M21–M23)

**Files:** Existing `ReconciliationPreparationWorkbookTests.cs`, G7 data-path tests and workbook/kitchen product owners read-only; proposed `mrx-export-source-concurrency.spec.ts` only if missing boundary merits it.

**Interfaces:** Consumes selected batches, independently characterized old/new revision datasets and approved timing budget. Produces parsed-workbook consistent-view proof plus separate transaction, serialization and writer-wait observations.

- [ ] Review exporter, nested cooking/net projection reads, transaction runner and current MySQL setup fully. Keep storage transaction regression; do not count it as actual read/write race.
- [ ] Review supported DB observation/barrier capabilities. Submit minimal support change for approval if the read transaction's overlap cannot be evidenced; never infer overlap from simultaneous button clicks.
- [ ] Execute writer-before-read, writer-during-read and writer-during-serialization schedules. Writer must reach valid source/issue/return boundary; scope-specific prerequisites cannot be bypassed.
- [ ] Parse all relevant workbook sheets and DTO/file evidence. Match one legal old or new view per dependent source; no mix. Expected rows derive independently from captured inputs/DB schedule.
- [ ] Measure DB transaction end, writer wait and file generation separately; test unrelated-customer writer for excessive blocking. Compare to pre-approved budget; if no budget, consistency may PASS but latency remains NEEDS_EVIDENCE.
- [ ] M23 filtered pagination/export: compare full matching set and per-customer/unit totals, including selections changed while prior export/read pending.

**Acceptance:** Real provider consistency and timing evidence with exact candidate; no assumption that Serializable performance is acceptable just because values match.

### T8 — API security, session and scope authority (M16–M19,M27)

**Files:** Existing G2/G5, `MrxBatchScopeAuthority.test.tsx`, relevant source FE tests, actual auth/mode controllers/policies and token ticket owners read before changes.

**Interfaces:** Consumes real policy inventory, eligible/ineligible actors and exact source/mode versions. Produces API denial and safe UI/cache/session observations; never logs credentials.

- [ ] Map each source/read/submit/approve/issue/disposition/complete action to actual backend policy and eligible actor. Check direct HTTP in addition to route/action visibility.
- [ ] Use existing API-boundary delayed A→B→A, old receipt/new version and foreign response cases as keepers; runtime scope journey adds only real actor/cache/reload risk not duplicate helper coverage.
- [ ] Exercise warm403/retry, actor switch, back-forward and valid token expiry/refresh behavior. Denied data must not reappear from cached payload.
- [ ] Test stale mode/version and source-family mismatch without changing main mode. If real mode transition is essential, obtain isolated transition packet first.
- [ ] M27 restart ONLY run-owned API if separately approved; verify safe Excel re-preview and signed quantity token purpose/signature/expiry. No deployment or multiple-replica launch.

**Acceptance:** Denials reach intended policy, no data residue, no wrong-scope writes; replica readiness remains unqualified.

### T9 — Outbox and recovery subcampaigns (M28a,M28b)

**Files:** Existing `LifecycleOutboxProcessorTests.cs`, `scripts/database-recovery/Invoke-DatabaseRecovery.ps1`, `scripts/database-recovery/RestoreOracle.ps1`, OPERATIONS; actual configured worker/consumer owners must be read before execution.

**Interfaces:** Consumes separately signed fault/recovery/provider packet and permitted MRX archive. Produces distinct outbox and restore verdicts, exact target/provider/timing/source-preservation/cleanup receipts.

- [ ] Outbox: inspect actual enabled settings and consumer behavior; run approved isolated lease/retry/ack-loss/poison schedule with persisted ordering and receipt oracle. Payload validator is not notification delivery.
- [ ] Recovery: confirm external provider adapter, secret handling, archive version/hash/retention/key access and absent permitted restore target; no local fallback for off-host claims.
- [ ] Restore only with explicit target creation and cleanup permission. Independently compare full relevant schema semantics and MRX lineage/ledger/history beyond current comparator limitations.
- [ ] Measure RPO<=4h/RTO<=30min under agreed start/end definition; verify five-calendar-year retention metadata and operational queryability evidence without claiming five elapsed years from a fresh file.
- [ ] Record M28a and M28b independently; missing provider/fault approval is BLOCKED with concrete prerequisite, not PASS from unit tests.

**Acceptance:** Source and business evidence preserved, actual recovery proof bounded to verified fields; no blanket disaster-recovery certification.

### T10 — Temporal UI and representative load (M29,M30a,M30b)

**Files:** Existing loading consistency browser owner/continuity plan; G7/G8 and qualificationMetrics. No UI/code/style change authorized by this plan.

**Interfaces:** Consumes case scopes and eligible actors, candidate/build-specific URLs and approved load/viewport/budget packet. Produces per-view interaction observations and numerical resource/latency/lock statistics.

- [ ] Translate spec section7 inventory into exact eligible view/interaction cases at existing keepers. Retain distinction between cold/new-key/denial blocking and same-key recoverable error.
- [ ] Verify loading/empty/error/permission/partial/write-reconciliation, unknown command outcome and retry command identity; no generic expectation that every error offers retry.
- [ ] Measure header/table anchors, scroll, focus, cumulative opacity and modal bounds without input/credential capture. Run representative desktop/mobile x normal/reduced x DEV/identified preview; unexecuted combinations remain open.
- [ ] Obtain actor/data/operation mix, ramp/duration/ceilings, stop limits and lock-wait budget before any load. Read full G7/G8 declarations and settings; do not run endurance simply because filename exists.
- [ ] Separate functional slowMo/browser timings from performance measurement; measure p75 target<=300ms, frame<100ms, data<1s and CLS<=0.1 using agreed boundary, plus p95/p99/errors/429/pool/locks/memory.
- [ ] Check business invariants under and after burst; no disabled rate limits or increased timeouts to relabel overloaded behavior. Cleanup remains exact even after abort.

**Acceptance:** View-level evidence closes only observed interactions; performance result names workload and candidate. No invented capacity target or whole-ERP/no-flash claim.

### T11 — Qualification synthesis and truthful close

**Files:** WORK, existing runner status/phase/build/source/cleanup receipts and per-case evidence. Spec/plan may change only to record approved stable design corrections, not as duplicate progress ledgers.

**Interfaces:** Consumes actual evidence for every M/C case/subcase and current repository gate outputs. Produces user-facing separate verdicts, residual risk and next scoped decision.

- [ ] Review every required case/subcase against spec AC1–AC9. Missing evidence, unsupported policy or unreached race remains BLOCKED/NOT_RUN; never infer coverage from route discovery or test count.
- [ ] For authorized test/support edits, run applicable focused tests, lint/build/browser types and required review skills/gates; invoke ipc-code-review for all code and ipc-ui-review for UI work. Load debugging skills before investigating failures. No product fixes without new permission.
- [ ] Run approved repository follow-up command; preserve first deterministic failure and later NOT_RUN stages. Architecture growth remains a separate failing gate; do not split/refactor unrelated owners or pad baseline just to pass.
- [ ] Verify exact clone/subordinate/principal/temp/listener cleanup plus source/candidate preservation; cleanup error blocks qualification regardless of functional PASS.
- [ ] Report business correctness / concurrency / security / reports / temporal UX / performance / recovery / repository / cleanup separately; retain prior failure attempts and exact artifact paths.
- [ ] Update WORK to IDLE with actual remaining evidence and the mandated skill report format. No commit/push by default; no branch integration workflow from finishing documentation.

**Acceptance:** Reproducible bounded verdict, no hidden missing cases or unauthorized actions. Required P0 evidence and cleanup must be complete before overall business qualification; complete operational qualification additionally requires remaining required P1/P2 and repository gates or explicitly narrowed acceptance, never silent exemption.

## 4. Dependencies and sequencing

- T0 before all execution. T1→T2→T3 covers the user-prioritized new customer/new dish/missing BOM journey.
- T4/T5 require valid fixtures; T6 consumes their actual ledger state but must also have independent cases so a failing long journey cannot hide gaps.
- T7 is the first recommended bounded runtime diagnostic from the earlier handoff once admission/support are approved; it may precede T1 where existing approved data suffices. This does not close onboarding cases.
- T8 security authority gates apply to all tasks; its dedicated cases are not a reason to postpone safe auth.
- T9/T10 require their own operational packet; they are not automatic next commands after core tests pass.
- T11 closes whatever authorized slice was actually executed. Never keep a clone alive for later tasks unless campaign lifetime/ownership is explicitly approved.

## 5. Design/plan self-review (documentation only)

- All 30 base IDs M01–M30 and C01–C07 are mapped to tasks and independent oracles; M28/M30 subcases are explicit.
- New-customer create-then-use and two-new-customer concurrency are distinct from existing G6 customer creation.
- Matching observation versus approved ambiguity policy separated; missing BOM blocks quantity authority, not indiscriminately catalogue/draft save.
- No runtime/executable code created in the documentation phase, no new production signature/seam, no extra dependency/provider runner.
- Existing runner recipes/selectors are references with admission barriers, not promised support for arbitrary new scenarios.
- Historical supplemental race/owner-suite results remain historical; qualification FAIL and operational gaps remain visible.

## 6. Execution handoff

Current authorized deliverable: this spec/plan and WORK documentation update. Ask the operator to review them and approve a specific next task/packet before test authoring, mutation or fault/load/recovery execution. Preserve native Pi/no-delegation method; do not ask to launch external reviewers or switch runtime. A future implementation authorization does not automatically include source DB writes, main restart or product fixes.
