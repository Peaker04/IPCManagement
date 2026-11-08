# MRX Five-User Production Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Native sequential execution in the current workspace is already selected; no subagents or new worktree. Steps use checkbox syntax for planning; `.planning/WORK.md` remains the only task-status owner.

**Goal:** Produce reproducible real-browser, persisted-lifecycle, five-user performance/endurance and desktop ERP evidence for the existing MRX release candidate, repairing only demonstrated defects.

**Architecture:** Extend the existing disposable-MySQL runner and prepared Playwright lifecycle rather than create a parallel framework. Keep database/process ownership in the outer runner, scenario preparation in public business workflows, independent stock/history oracles in test support and metrics in bounded browser diagnostics. Run five-user browser work and a separate five-VU authenticated HTTP probe, never ten simultaneous users disguised as five.

**Tech Stack:** Existing .NET 9/EF/Pomelo/MySQL, React/Vite/shadcn/Base UI, Playwright headed Chrome/CDP, axe, PowerShell and installed k6. No new dependencies or implicit tool installation.

**Spec:** `docs/superpowers/specs/2026-11-02-mrx-five-user-production-qualification-design.md` — Owner approved with `duyệt` after confirming five simultaneous users.

## Approved execution amendment — gói con trong plan này

Owner duyệt [thiết kế một clone/kiểm kê/sửa BE-FE-admin](../specs/2026-11-03-mrx-single-clone-audit-repair-design.md) và yêu cầu không rẽ khỏi plan tổng. [Implementation work package](2026-11-03-mrx-single-clone-audit-repair.md) nằm dưới [Lifecycle Scope Lock](2026-11-03-mrx-lifecycle-scope-lock.md), thực hiện các phần còn lại của Tasks1–4/7 rồi trả về GateC của scope lock. Không thay G1–G6/LC-01..12 bằng bộ kiểm thử khác; Tasks5/6 và release obligations vẫn giữ, quantitative cần admission riêng.

Với campaign mới, amendment này thay **resource lifetime** và thứ tự inventory/repair của các chỉ dẫn cũ: Start một lần, Run nhiều lần trên đúng một DB, lỗi/pause chỉ dừng owned processes, không DB `_integration`; Finish chỉ tại Task8 sau required parent gates hoặc Abort theo Owner. Gói con/LC hoàn tất vẫn giữ clone. Không dùng lại `-Mode Execute` để resume campaign vì sẽ tạo clone mới. Legacy commands không đổi cho phạm vi legacy riêng, không phải fallback cho campaign đang hoạt động. WORK là nơi ghi tiến độ và campaign identity; đây không phải plan độc lập.

## Global Constraints

- MRX only (`MATERIAL_RECONCILIATION`), not DEFAULT; no mobile/mobile-web qualification.
- Five simultaneously active users; four desktop viewports: 1280×720, 1366×768, 1440×900, 1920×1080. Actual Chrome zoom: 125%, 150%, 200%.
- Source `ipcmanagement` stays read-only. At campaign Start, clone must be absent exact `ipc_mrx_evidence_<campaign-id>`; subsequent Run requires that exact existing owned target. New campaign has one DB, no subordinate; ownership/cleanup failures remain BLOCKED. Legacy isolated-run rules stay confined to legacy execution.
- Preserve cloned business history. No fixed-week DELETE, FK-check disabling, timestamp backdating, inferred historical lineage or fake success evidence.
- Use real credential sources and verified server mode/version/permissions; no Admin substitution for Manager, role weakening, hardcoded new credentials or production auth/rate-limit bypass.
- Scope is five-user web endurance for 60 minutes, with declared 2–5 second think time; HTTP diagnostics run separately at at most five VUs. No co-host stress/saturation, server-global diagnostics or MySQL restart/config change.
- Release FE/API identity includes inherited working-tree changes, not HEAD alone. No DEV-to-production performance equivalence.
- Minimum 20 measured observations per compared representative action/class; explicitly flag sparse/unsupported metrics. Memory diagnostics: at least 30 repeated cycles, settled post-GC checkpoints at 0/10/20/30.
- Existing DESIGN owns style: tokens only in `frontend/src/styles/index.css`, minimum 12px type, 36–40px compact rows/44px inline edits, one primary work object/action and canonical sidebar. Impeccable Operate/refine; no broad redesign.
- No module expansion, production-only testing seams, new framework, installation, commit/push/PR/deployment or main mutation. No independent reviewer delegation is authorized; parent self-review is the project ruling.

## Review Focus

1. **False stock proof:** a missing ingredient or finite ending quantity must not pass a stock equation whose opening balance was calculated backwards from its own result; Task 2 pins this.
2. **Wrong runtime/identity:** localhost/default proxy, stale artifact, forged local mode or Admin-as-Manager must fail before mutation; Tasks 1–3 pin this.
3. **Weak concurrency/retry:** stale-version HTTP alone does not prove two valid clients race or response-loss replay preserves a single stock effect; Task 4 pins this.
4. **Measurement changes the outcome:** unbounded observer buffers, heap snapshots/forced GC during latency measurement and five extra k6 VUs invalidate the comparison; Tasks 5–6 pin this.
5. **Failed cleanup/changed source:** a failure before normal teardown must still attempt every owned cleanup, without killing reused PIDs or relabeling main drift as PASS; Tasks 1 and 8 pin this.

## File and responsibility map

Modify existing owners:
- `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`: add an explicit qualification profile, artifact/source preservation, ordered phases, resource samples and final cleanup; retain default G1 compatibility.
- `frontend/tests/e2e-mrx/core/{globalSetup.ts,globalTeardown.ts,dbGuardrail.ts,mysqlVerifier.ts}`: prepared-only qualification admission, Release runtime ownership, history-preserving setup and independent read-only oracles.
- `frontend/tests/e2e-mrx/fixtures/{authHelpers.ts,mrxTest.ts}` and existing G1–G6 specs: five genuine role sessions, dynamic non-colliding scope, deterministic assertions and backend-grounded DTOs.
- `frontend/tests/e2e-mrx/config/playwright.mrx.config.ts`: headed qualification configuration, owned output, actual context viewport and phase selection.
- `backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs` and `frontend/tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts`: preserve/extend the strongest existing safety owner.
- `package.json`, `docs/OPERATIONS.md`, `tools/perf/RUNBOOK.md`: minimal invocation and operational procedure. No generated API change unless a separately evidenced DTO fix requires `npm run gen:api`.

Create only these bounded test/measurement consumers:
- `frontend/tests/e2e-mrx/fixtures/mrxWorkflow.ts`: shared real-UI preparation extracted from G1/G6, not a business simulator.
- `frontend/tests/e2e-mrx/core/qualificationMetrics.ts` and `core/__tests__/qualificationMetrics.test.ts`: bounded metric collection/summarization used by actual browser specs.
- `frontend/tests/e2e-mrx/specs/g7-desktop-memory.spec.ts`: real layout/focus/zoom and separate retained-heap diagnostics.
- `frontend/tests/e2e-mrx/specs/g8-five-user-endurance.spec.ts`: five active real role sessions and 60-minute Release endurance.
- `tools/perf/k6/mrx-five-user.js`: bounded authenticated MRX HTTP read diagnostic, not the old mixed-mode 20–50 VU workload.

Production FE/BE files are **conditional**: identify the reproduced defect, existing owner/callers and smallest regression before editing. Do not pre-authorize a redesign inventory or speculative abstraction. If an existing file exceeds its architecture budget, split along one real responsibility without baseline growth/exemption padding.

---

### Task 1: Safe qualification profile and Release runtime

**Files:** runner, dbGuardrail/globalSetup/globalTeardown, Playwright config, package.json and existing safety tests listed above.

**Interfaces:** runner gains `[ValidateSet('G1','Qualification')][string]$Profile='G1'`, preserving `-Mode Preflight|Execute`. Qualification requires prepared mode, exact existing run variables and `MRX_E2E_PROFILE=qualification`; no sandbox fallback. Runtime uses ports 5174/5263 only after proving free and resolves process ownership by run ID, PID plus creation identity. Add `MRX_E2E_PHASE=functional|desktop|memory|endurance|http-host`; one phase at a time owns the same prepared target. `MRX_E2E_ARTIFACT_DIRECTORY` names a private run-owned directory outside Playwright-cleaned output. No credential values in metadata.

- [ ] Record baseline source/working-tree identity, in-scope test declarations/results/LOC and existing owners in WORK/evidence. Load test-audit campaign and inspect complete declarations before R/F/C/D changes. Confirm required named `operationalPageContracts.test.ts`/`*.contract.test.tsx` gates: they were not found in intake; locate their actual semantic owners or report the governance gap, never create vacuous placeholder files.
- [ ] Extend admission tests with `qualification_rejects_legacy_or_mismatched_target`: qualification + absent prepared flag rejects before any process/SQL mutation; wrong run/name/port rejects; current exact prepared tuple accepts. Extend existing cleanup proof with an injected child-start/cleanup failure, asserting all independent cleanup attempts, no unrelated PID termination and non-PASS final status.
- [ ] Run RED: `npm run test:unit -w frontend -- tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts --maxWorkers=1` and focused `dotnet test ... --filter FullyQualifiedName~MrxDisposableEvidenceContractTests` (use the full API test csproj path below). Record intended failures, not missing-tool errors.
- [ ] Implement profile admission and remove fixed-week deletion/mode rewriting from qualification. Fail if server state is not MRX. Build `npm run build:fe` and `dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj -c Release --no-restore`; launch that Release artifact, not debug `dotnet run --no-build`. Run Vite `preview --host 127.0.0.1 --port 5174 --strictPort` with private `VITE_PROXY_TARGET=http://127.0.0.1:5263`; existing preview proxy already supports this, so do not edit Vite config unnecessarily. Health/readiness and an authenticated API read must succeed, HTML must lack DEV client markers and artifact hashes must match before cases run.
- [ ] Require full before/after schema/business-source fingerprints, extending existing manifest checks beyond their bounded-table coverage for qualification. Any unexpected data drift is a STOP/NEEDS_EVIDENCE even if schema/head match; never restore source. Capture effective settings privately; preserve security controls and do not use Swagger availability as a Release readiness check.
- [ ] Re-run safety tests GREEN and `-Mode Preflight -Profile Qualification` using the existing private operator environment pattern. Confirm no DB creation and independent temp cleanup. Do not execute old default runner profiles that mutate/reset golden-week data during this campaign.

**Deliverable:** qualification cannot silently run DEV, a legacy/reset target, a stale artifact or the wrong API/database; failed setup still cleans safely.

### Task 2: Non-colliding scenario scopes and truthful business oracle

**Files:** `mrxWorkflow.ts`, mrxTest, mysqlVerifier, G1/G6 and strongest existing helper tests.

**Interfaces:** test fixture `scenarioScope: MrxScenarioScope`, where `type MrxScenarioScope = { runId: string; weekStartDate: string; reason: string }`, allocates a Monday absent from cloned menu/batch scope. `createTransferredBatch(pages: {coordinator: Page; admin: Page}, scope: MrxScenarioScope): Promise<{batchId: string; menuVersionId: string}>` uses public controls extracted from G1/G6. Capture import identity from the actual successful response; never guess one. Every test gets a distinct scope, so G3/G4/G5 do not depend on G1 leaving an unfinished batch.

**Oracle interface:** replace misleading `assertStockInvariant` with `captureStockSnapshot(ingredientId: string): StockSnapshot` and `assertStockDelta(before: StockSnapshot, after: StockSnapshot, expected: {issuedBaseQty: string; receivedReturnBaseQty: string}): void`, both consumed by real specs. Define `StockSnapshot` in mysqlVerifier as `{ingredientId:string; unitId:string; warehouseId:string; currentQty:string; lots:ReadonlyArray<{lotId:string; quantity:string}>; movementIds:readonly string[]}`; use current entity/SQL column names to populate these logical fields and assert warehouse/ingredient/unit/lot scope equality before comparing. Snapshot includes exact ingredient/unit/warehouse/lot quantities and movement identities. Use declared decimal quantities/provider precision, not floating equality or an opening balance inferred from the ending result. SQL is parameter-safe for validated IDs and read-only at this boundary.

- [ ] Capture RED in G4: a syntactically valid missing ingredient must fail admission (current defaults produce finite zero); a controlled wrong expected delta after a real issue must fail the equality, not pass `Number.isFinite`. Do not corrupt business rows to create a negative control.
- [ ] Extract the real UI import/servings/approval/preview/create/ready/transfer steps once; parameterize dates/customer/source identities and remove fixed-week assumptions in G1/G6. Template content must really match the chosen scope; use the supported template/import contract, not only a renamed date input.
- [ ] Capture genuine before snapshots, derive expected base quantities from declared inputs/conversion and assert exact post-issue stock/lot/movement changes. Received-return expectations are independent of the net projection under test; pending returns contribute zero.
- [ ] Extend G1 to prove terminal reload, exact issue/provision/note identity and full retained business chain. Keep source-edit/day-lock proof in G6 rather than duplicate it into every test.
- [ ] Run focused G1/G6 through the qualification profile; inspect persisted identities and retained-history counts. A missing UI/stock/BOM prerequisite blocks the case, never becomes a conditional early success.

**Deliverable:** scenario preparation preserves history, each test is independently repeatable and an incorrect/missing ledger effect cannot pass its oracle.

### Task 3: Five real identities and MRX RBAC/state feedback

**Files:** authHelpers, mrxTest, G2; actual affected UI-state owner tests only if a product defect is reproduced.

**Interfaces:** extend test-role union with `manager`; add `managerPage: Page`. Qualification credential map comes only from private `MRX_E2E_CREDENTIALS_FILE`, ACL-restricted and consumed by Node/Playwright, containing exact records for admin/dieuphoi/thukho/beptruong/manager with username/password. Resolve once per role context, never emit credentials/token/body. Verify `/api/Auth/me` and `/api/system-operation-mode` against actual DTOs; use server-returned mode/version and the current client header contract. Never write a guessed mode version into localStorage to make a gate pass.

- [ ] Record RED for actual Manager: reconciliation permitted while Warehouse/kitchen denied by navigation/deep-link/API; existing Admin-only “Admin/Manager everywhere” is not a substitute. Missing Manager credentials must produce BLOCKED, not Admin fallback.
- [ ] Implement five separate contexts whose viewport consumes configured desktop dimensions instead of hardcoded 1440×900. Respect real login rate limits: five-role login reaches the documented five/minute budget, so space retries/refresh correctly and record any 429 without altering limits.
- [ ] Replace G2 fixed sleeps with expected URL/DOM/network outcomes. Assert no forbidden body fields/data are exposed, and direct unauthorized mutations leave versions/stock/history unchanged. Keep Admin and Manager expectations separate and use bounded relevant negative controls rather than all endpoint combinations.
- [ ] Exercise actual loading/empty/error/permission-denied/partial/write-reconciliation surfaces and dirty draft boundaries in relevant existing rendered owners; browser cases verify geometry/recovery, not a duplicate DTO matrix. Do not turn 403 into an empty result.
- [ ] Run focused G2 and affected real component owners, requiring executed counts and no hidden conditional path. Preserve confirmed credential source privately; unavailable role/state evidence remains explicit.

**Deliverable:** five-user qualification means five authenticated identities, with current server MRX authority and distinct owner permissions.

### Task 4: Complete alternative, race and recovery workflows

**Files:** G3/G4/G5, shared mrxWorkflow; minimal actual production owner only after a reproduced defect and debugging gate.

**Interfaces:** consumes Task 2 scope/preparation/snapshots and Task 3 five role contexts. Existing public service/API/DTOs remain unchanged unless a proven bug requires repair. Store per-scenario exact created IDs in private evidence, not a new persistent task ledger.

- [ ] Rewrite G3 supplemental/overage cases to actually submit, assert persisted quantities/notes/decision IDs, reload and compare stock. Add shortage-to-supplement-to-completion and retained-zero/convertible-unit/coordinated-shared-stock cases at the strongest real boundary. Keep shortage disposition rejection explicit. Missing BOM recovery must actually import/apply valid declared data, not just assert download buttons.
- [ ] Rewrite G4 with two valid clients reading the same expected version before submission, then racing actual UI decisions. Assert exactly one successful durable winner, intended conflict on the other, retained predecessor, unchanged loser effects and safe draft/reload. A fabricated `expectedVersion=99999` HTTP request is not this proof.
- [ ] Extend the existing G6 source-apply-versus-first-issue test with intended loser reason and unchanged frozen/locked-date facts. Keep this as the primary source/issue race owner.
- [ ] Rewrite G5 offline/session cases to fill a genuine dirty draft and verify exact retained values plus allowed recovery. For response-loss replay, let the actual server commit and drop only its response; reconcile by real command identity and retry, asserting exactly one issue/movement/decision. Do not fake a success payload.
- [ ] Audit the alleged overdue auto-closure case against actual source requirements. Remove the fabricated timestamp/COUNT-as-closure proof; if no automatic-closing contract exists, mark D with retained true completion/history owner proof rather than invent a scheduler feature.
- [ ] Run meaningful REDs, apply smallest proven owner repair, then GREEN through real MySQL/browser. Capture exact physical stock/lot/net returned/history invariants and full reload. Do not weaken the product to satisfy an old invalid test expectation.

**Deliverable:** browser evidence demonstrates durable success, recoverable operational failures and concurrency, not just dialogs or arbitrary HTTP errors.

### Task 5: Desktop/zoom/a11y baseline and bounded memory diagnostics

**Files:** g7-desktop-memory, qualificationMetrics and its focused tests; extend G6 for its existing source-grid ownership rather than copy its flow.

**Interfaces:** metrics module exposes `summarizeSamples(values: readonly number[]): {count:number; median:number|null; p75:number|null; p95:number|null; p99:number|null}` and `installInteractionProbe(page: Page): Promise<void>` / `collectInteractionSamples(page: Page): Promise<InteractionSamples>` consumed by g7/g8. Define `InteractionSamples` as `{eventTimingSupported:boolean; loafSupported:boolean; interactionDurationsMs:number[]; longTaskDurationsMs:number[]; loafDurationsMs:number[]; cls:number|null; lcpMs:number|null}`; action identity, timestamps and network-class records are attached by each spec, not guessed inside the collector. Buffers are capped at 2000 observations per metric, aggregate/write per checkpoint, retain descriptors not DOM nodes and are reset between actions. Unsupported entries return unavailable, not zero. Actual heap snapshots go to ACL-private run storage, never Git/Playwright-cleaned business evidence paths.

- [ ] Unit RED: empty samples return count=0/null percentiles; `[1,2,3,4]` nearest-rank p75=3; overflow keeps at most 2000 entries; unsupported observer produces unavailable; descriptors never retain DOM node references. Test real helper behavior, not copied manifests.
- [ ] Capture the desktop baseline on all four approved dimensions with actual role contexts, dense read/edit/error/dialog states and keyboard paths. Use axe plus manual focus/keyboard evidence; no source-only a11y PASS. Verify actual browser zoom with outer/inner geometry/DPR, not viewport shrink/CSS transform. If native zoom control cannot be verified, mark its gate NEEDS_EVIDENCE.
- [ ] In a separate diagnostics phase run at least 30 equivalent route/filter/dialog/cancel/Escape/export-cancel cycles and post-GC checkpoints 0/10/20/30. Inspect retained-object chains/detached DOM, outstanding requests, listeners, context/portal cleanup and bounded caches. Include an idle/control checkpoint to separate probe overhead; no heap snapshots or forced GC inside latency runs.
- [ ] Sample API process private bytes/working set/handles/threads and available read-only DB connection observations; lack of managed allocation tools limits the conclusion. A suspect trend requiring root analysis is NEEDS_EVIDENCE pending explicit tool permission, not a fabricated leak-free PASS.
- [ ] Run metric unit tests and headed g7; record findings by route/state/viewport/actor with the smallest owner remedy. Source-grid behavior stays owned by G6, while g7 owns cross-surface geometry/resource evidence.

**Deliverable:** reproducible desktop/memory diagnostics with bounded instrumentation and honest unavailable/retention limits.

### Task 6: Five-user measured endurance and separate HTTP diagnostic

**Files:** g8-five-user-endurance, metrics, runner sampling, `tools/perf/k6/mrx-five-user.js`, root invocation and performance runbook.

**Interfaces:** g8 consumes five role sessions, Task 2 workflow/scopes and Task 5 collectors. `MRX_E2E_SOAK_SECONDS=3600` is required for a qualification verdict; shorter explicit smoke duration is labeled diagnostic and cannot pass the endurance gate. HTTP file uses `constant-vus`, `vus:5`, `duration:'10m'`, never arrival-rate auto-scaling. It requires private credential-file reference, exact owned target/run/base URL and current MRX mode/version; nothing defaults to production or generic mixed-mode ENDPOINTS.

- [ ] Add a bounded smoke control showing five unique authenticated identities actually execute role-allowed work, with active timestamps/action counts, not just five idle pages. Full run maintains this maximum; source edit/terminal workflow iterations use fresh scopes while controlled collisions are labeled separately.
- [ ] Measure cold and warm flows separately after warm-up; gather at least 20 observations per compared representative action/class. Emit per-class count/p75/p95/p99, API/network/render breakdown, request rate/bytes, unexpected 5xx/timeouts, expected conflicts/denials and all 429s. Assert spec budgets without turning missing metrics into success.
- [ ] Run a short browser smoke before the 60-minute pass. During the full pass sample resources per minute, health before/through/after, early/middle/late action timings and recovery idle. Stop on failing health, resource exhaustion or shared-server contention; do not silently reduce five-user activity and keep the full-load label.
- [ ] Implement the separate k6 probe using exact MRX GET routes from current controllers: batches, warehouse-daily for the Storekeeper scope, and authorized operational-summary/transactions-history/completed-register for actual permitted roles. Login five identities separately with the real rate limit, assign one per VU and verify server mode using current DTO/header contracts. No generic lib login-body logging or DEFAULT purchasing/report routes.
- [ ] Run HTTP diagnostics only after browser contexts stop, using an `http-host` phase that keeps the same Release stack/owned target alive until k6 finishes. Require all scenarios cleanly stopped between phases. Record achieved five VUs and valid per-role requests, label this read-only evidence distinct from browser write correctness.
- [ ] Compare resource/timing checkpoints and execute stock/history oracles after endurance. A 60-minute local pass is not full-shift/five-year-volume/deployment-host certification. Instrumentation failures or low sample counts remain NEEDS_EVIDENCE.

**Deliverable:** actual five-user Release workload evidence, with separate HTTP diagnostics and no hidden overload.

### Task 7: Minimal ERP FE and measured defect fixes

**Files:** only actual owners named by Task 3–6 findings; existing components/ui, components/workbench/common and MRX feature files; `styles/index.css` only for styling authority. No preselected new widget family.

**Interfaces:** preserves current routes/DTOs/permissions and keeper tests. Each fix consumes a reproduced finding and produces that same scenario passing without unrelated behavior changes.

- [ ] Load applicable debugging/code-review skills for defects and Impeccable craft-floor plus distill/harden/optimize references for actual refinements. Declare the exact scoped pre-code UI gate in WORK before any TSX/CSS edit.
- [ ] Lock a behavioral RED at the strongest boundary: e.g. clipped primary action/frozen identity, lost dirty draft, trapped focus, retained stream/portal or repeated request. Do not add tests for copy-only/reversible layout edits without independent behavioral risk.
- [ ] Apply one coherent owner-level batch: quieter hierarchy/redundancy removal, compact actionable layout, visible blockers and preserved evidence/permissions. Reuse existing installed shadcn/Base UI primitives. Do not hide validation or shrink below D6/T8; do not install taste/shadcn generators or add ad-hoc colors.
- [ ] Run affected keeper tests and confirm the selected desktop/zoom states once; run Impeccable detector once on final changed UI targets. Report false positives and real violations, not detector score as usability proof. Functional regressions are fixed explicitly; no endless cosmetic loop.
- [ ] Re-measure any claimed performance/memory improvement under identical source-data/actor/viewport/conditions, with the same sample/cycle requirements and probe overhead separation.

**Deliverable:** only evidence-backed operational improvements, with preserved ERP behavior and before/after proof.

### Task 8: Full execution, independent cleanup and release packet

**Files:** runner, OPERATIONS, perf runbook and WORK; runtime evidence under unique ignored/private run directories, not another status owner.

**Interfaces:** active campaign uses `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 -Mode Run -Profile Qualification -CampaignId $campaignId -Diagnostic <existing-admitted-selection>` for the explicitly admitted phase manifest, then `-Mode Finish -Profile Qualification -CampaignId $campaignId` only after required parent gates/final packet. No new clone at Task8; no secret arguments/logs. `LifecycleAcceptance` alone is business proof, not the full qualification packet. Expected duration includes admitted60-minute endurance/diagnostics/gates; no automatic admission from the work package.

- [ ] Run focused helper/safety/changed-owner gates, Release builds and actual available UI contract owners. Run `npm run verify`; record counts/skips and inherited failures. Do not run API generation twice by default: no DTO change means no generation needed; a real API change requires authorized `npm run gen:api` and reviewed diff.
- [ ] Execute the explicitly admitted qualification phases in order on the retained campaign clone: functional G1–G6/LC; desktop; separate memory diagnostics; fresh uninstrumented/same-build five-user endurance; HTTP host/k6; final stock/history/source comparisons. Retain DB between phases/attempts; global teardown stops its owned stack. No subordinate DB; only parent Finish drops the clone.
- [ ] A failed case/residual assertion must still attempt owned process/plaintext cleanup, but retain the DB for diagnosis/resume. No automatic Finish/Abort or history deletion to satisfy the old `TC_` assertion. Once required parent gates pass, Finish performs independent final resource cleanup; Owner cancellation uses explicit Abort.
- [ ] Recheck process creation identity, both listeners, exact campaign clone absence after Finish and private credential/dump/temp removal. There must never have been a subordinate in the new campaign. Independently read final receipts/source fingerprints; source discrepancy or cleanup error prevents overall PASS, with no blind retry/source restore.
- [ ] Publish the reproducible command/prerequisites, dataset/build/actor identities without secrets, keeper coverage and actual scenario results, raw metric sample locations/summary and unresolved risks. Report test/support versus production LOC changes, not just test counts.
- [ ] Return WORK to IDLE at safe close and report separate lifecycle/security/desktop/performance/memory/source-cleanup/production-host/provider verdicts. No unconditional production GO while required gates are missing or P0/P1 defects remain. Deployment, monitoring/on-call/rollback and immutable off-host recovery certification remain explicit operational prerequisites, not inferred from schema cutover/local tests.

**Deliverable:** a repeatable MRX five-user qualification procedure and a truthful scoped release decision, not a new product module.

## Verification command notes

API test project in every focused command above: `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`. Pass the actual named filter, private target environment and existing build/restore prerequisites; never broad-run MySQL/recovery-owning tests against main.

Metrics/helper tests: `npm run test:unit -w frontend -- tests/e2e-mrx/core/__tests__/qualificationMetrics.test.ts tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts --maxWorkers=1`.

Browser phases are launched by the approved runner environment, not bare default `npm run test:e2e:mrx`, whose legacy setup currently resets a static sandbox. `npm run test:e2e:mrx:g1` alone is not whole-campaign evidence. No command listed in this plan is a claimed execution result.

## Parent self-review and execution handoff

- Spec coverage: scope/safety/runtime → Task 1; real business/stock/history → Tasks 2/4; five-role authorization → Task 3; desktop/zoom/heap → Task 5; workload/endurance/metrics → Task 6; bounded UI fixes → Task 7; reproducible release/source/cleanup/provider distinctions → Task 8.
- Review Focus negative controls mapped to owning tasks; no parallel framework, absent-role fallback, fabricated stock baseline, hidden ten-user workload, managed-leak certificate or missing-contract placeholder.
- Interfaces are test-support runtime consumers, not production seams; phase/profile names, roles, caps and source identities are consistent. Test examples define observable assertions, not fake business mocks.
- Existing missing named UI-contract files and missing managed diagnostics remain visible gates to resolve/report, not permission for synthetic green coverage or implicit installation.
- Plan reviewed by parent only, per Native/no-delegation ruling. Live task status is solely in WORK; do not infer unexecuted/completed from this template. Apply the approved work-package amendment and its review gate, preserve native sequential execution, and never infer commit authority from generic skill defaults.
