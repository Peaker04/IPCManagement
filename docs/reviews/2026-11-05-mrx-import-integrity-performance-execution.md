# MRX import integrity/performance — bounded native execution report

Date: 2026-11-05. This is a static evidence snapshot, not a second task ledger. Live state belongs to `.planning/WORK.md`.

## Fresh verification — 2026-11-06, approved input-serving addition

**Input-serving addition: PASS in the exercised scenario. Parent plan: still incomplete; no whole-chain/NFR sign-off.** Fresh run `20261106t040902z_2d0f86` completed the existing ordered diagnostic and repository gates, then verified exact cleanup. The current result supersedes earlier NOT_RUN/full-unit-failure statements for this addition, not the historical evidence or remaining parent requirements.

| Boundary | Actual new evidence |
|---|---|
| Authored input → request/raw persistence/read DTO/DOM | G6 PASS8.7min;22checkpoints,12raw input records and24split cells each,21accepted versions. No duplicated/missing/misplaced serving count observed in this scenario. |
| Independent input/material audit | Retained-artifact Python audit reconstructs day formulas and declared +17/-3 changes without importing app/test helpers; checks every raw key/value/identity and DTO, stable schedule/line identities, then independently recalculates108material lines using Decimal80/half-up6. |
| Source and terminal chain |120source tuples,20revisions, six-day issues, weekly COMPLETED; Chef CSV/XLSX cross-format equality remains narrower than independent source→Chef export certification. |
| Adversarial |5/5PASS: race, committed initial/supplemental response loss, current session purge/fresh-entry case, direct source-edit/race owner. |
| G5 business caveat | Actual session artifact says `draftPurgedOn401=true`, `restoredAfter401=false`, `freshQuantity=1.5`. This does **not** satisfy or approve the original post-expiry draft-preservation requirement. |
| Measurements |100route observations (four routes×20warm+5fresh) and5fresh mutation series.8additional records are group summaries, not extra observations. First-correct-frame and authoritative-ready remain null/NEEDS_EVIDENCE. |
| Performance limit | Observed import-commit nearest-rank P75 request→response444.8969ms exceeds300ms target. Preview77.9862ms; apply178.0589ms has click→response origin, so it is not comparable server latency. Successful collection is not PERF acceptance. |
| Repository verification | Full unchanged `npm run verify`:49Application/1488API/429FE49filesPASS; architecture/conformance/lint/dependency/BE+FEbuildPASS; separate evidence/recovery48/48PASS. Existing large-chunk warning retained. |
| Safety | Main rowcounts/checksums/schema/migrations equal, no concurrent source change, candidate unchanged during run, exact clone/subordinate/principal/temp removed; cleanup completed=true/errors=[]. Run ports absent. |

The two earlier unit failures were fixture defects, repaired without changing their behavioral assertions: AdvancedSettings must seed a token for the real AuthProvider to load its backend reason/version snapshot; Admin first-render cache must seed the actual actor/role/mode/query key and requestKey envelope. Focused15/15 then full429/429PASS. No production behavior/auth policy/permissions/timeouts/limiter or data expected table was changed. Chrome resource stall did not recur; the retained successful functional trace contains no ERR_INSUFFICIENT_RESOURCES, which is not a root-cause repair claim.

Evidence: `.artifacts/mrx-evidence/20261106t040902z_2d0f86/`, including `runtime/menu-coverage-input-checkpoints.json`, `runtime/menu-coverage-{revisions,latest-readback,terminal}.json`, `runtime/menu-data-path-performance.json`, `runtime/session-recovery-result.json`, `input-integrity-independent-audit.json`, phase/source/build/candidate/cleanup receipts. Candidate425B3914A7DA988463DE72514A2E08A15D1DCDD445BEE35A776CEAC9139E13A0; API07DD015B9286581591730F4FE06C6DF3980AE85C7DF64EEBF52ACEDD48B8625A; FEindexC29A34C4716D936643B9792365E94D74C45C9CE96915522184484B957332CC0A; buildtree5934286C76EED9C6724231291C3D89C20B332E86EE7DDBF1CFC6496F48CB31C4. Logs `D:/Temp/ipc-input-continuation-*`. No retained run reuse, main write, install, delegate, user-process kill, stage/commit/deploy.

Remaining parent coverage is still the terminal artifact's explicit list: rectangular runtime import, whole vertical/group edits/swaps, reimport, mixed-day rejection and independent Chef numeric export mapping, plus disputed G5 recovery and NFR targets. The approved input-serving addition is complete; that is not a declaration that all parent-plan work is complete.

## Historical input-serving implementation close — runtime not yet run at that point

Owner approved [input design](../superpowers/specs/2026-11-05-mrx-input-serving-integrity-design.md) and [implementation plan](../superpowers/plans/2026-11-05-mrx-input-serving-integrity.md). Four test-side owners now add a raw serving comparator, nine in-memory controls, one optional pre-quantity-preview workflow checkpoint and stronger incumbent G6 checks. This is harness implementation, not a demonstrated product repair or proof of correct real input data.

- G6 compares authored splits against actual command fields, raw schedule/quantity-line cardinality and values, complete read DTO and visible customer/week/cells after reload; validates final=sum, exact applied-version lineage, unchanged unrelated scopes, predecessor snapshots/old menus and replacement rather than accumulation across existing revisions. No DISTINCT/SUM/latest-row selection hides input duplication. Workbook menus and UI-entered servings remain separate input authorities.
- Intended gate RED9FAIL/3PASS → GREEN12/12; final focused two suites14/14PASS, touched ESLint and strict E2E consumers/helper testPASS. Production FE buildPASS with existing large-chunk warning. Local logs at `D:/Temp/ipc-input-serving-*`.
- Full canonical FE unit suite **FAIL:427PASS/2FAIL**. Separate execution reproduces the AdvancedSettings reason/confirmation disabled-state and Render1CacheHitVerification Admin cache/skeleton assertions (2FAIL/13PASS). Those files are outside this patch; no baseline attribution, test weakening or unrelated repair was attempted. Full repository/backend gates were not run.
- **New browser/DB checks NOT_RUN.** No fresh clone/actor/profile/campaign was launched, no current input checkpoint artifact exists, and historical20revision evidence cannot satisfy the new checks. No production source, G5 policy, timeout, limiter or business expected table changed. The earlier Chrome resource blocker and unfinished G5/export/performance acceptance remain open.

## G5 reassessment after owner correction

The owner subsequently challenged changing tests to fit cleanup and requested returning to G5's bug-finding/business-workflow purpose. **The revised purge/fresh-entry case is not accepted as business sign-off.** Prior A approvals and local test results below are historical facts, not evidence that discarding unfinished work is correct. No product/test edits or fresh campaign were performed during this reassessment.

Read-only extraction of the latest failure trace's Admin `1-trace.trace` now identifies three top-level console errors: **`net::ERR_INSUFFICIENT_RESOURCES`**, at trace times90720.005/90737.226/90740.258ms for inbox/batches/weekly-menu respectively. Corresponding network entries have status-1 and unfinished timings; -1 is not an HTTP response. This directly establishes a browser resource failure at the failed navigation, unlike the earlier missing-completion observation alone. It does not identify the exhausted resource or prove host memory, a Chromium leak, proxy/CDP failure, rate limiting or server failure. Raw failed evidence remains unchanged.

Separately, the original G5 before-copy expects the same actor to recover2.75 after401/re-login. Current `apiClient` clears all drafts before redirect. `AuthProvider` already listens for `ipc:session-expired` and `SessionExpiredModal` promises preservation, but no producer for that event was found. That is an inconsistent source path, not sufficient justification to enable the modal or retain all drafts without defining logout/account-switch and stale-version boundaries. Product repair and original-workflow runtime verification remain outstanding; the consumed fresh-run allowance was not reused.

## Historical verdict before the fresh 2026-11-06 input run

**Overall: BLOCKED / incomplete acceptance.** The owner previously approved approach A (401 purges drafts) and its bounded native implementation plan, then reopened its business acceptance as described above. The two existing test owners were updated without production auth changes; focused local checks pass. Latest fresh run `20261105t172554z_1e855e` passed all20 four-menu revisions/terminal chain and G4 race, but timed out in the unchanged G5 initial-loss setup before the modified session case could run. G5 session runtime and performance therefore remain BLOCKED/NOT_RUN. No automatic retry, timeout increase, auth weakening or whole-MRX/NFR PASS.

Scope authority: [approved spec](../superpowers/specs/2026-11-05-mrx-import-integrity-performance-design.md), [plan](../superpowers/plans/2026-11-05-mrx-import-integrity-performance.md); native/direct-parent execution only. No subagents, installs, commits, deploys, migrations, extra BOM/unit fixtures, or existing-service replacement.

## Approved session-policy implementation — historical bounded attempt

Design: [session boundary](../superpowers/specs/2026-11-05-mrx-session-draft-boundary-design.md); [native plan](../superpowers/plans/2026-11-05-mrx-session-draft-boundary.md). Owner approved both and exactly one fresh diagnostic attempt. This supersedes the historical unresolved policy decision below, not its failed evidence.

- Extended the incumbent API401 test with real draft/queue seeding and nonempty prerequisites followed by actual cleanup assertions.32/32focused API/Auth/auth-helper tests PASS; no cleanup/helper mock and no production modification.
- Reordered the existing `@G5-Session` case: valid-session cross-actor/stale-version/reload recovery before401; actual purge/no-write after401; same-actor login with no old restore/automatic submit; distinguishable fresh1.5 instead of old2.75; exact durable lines/receipt/version/stock/known-lot and postreload checks. These new browser/DB assertions are **NOT_RUNTIME_VERIFIED** because their case never started. Other G5 committed-response/coordinated bodies and four auth/draft production owners are byte/hash unchanged against task intake.
- Touched ESLint and full strict harness typecheck PASS. The default TypeScript process first failed with native Zone Allocation OOM, not a reported type error; the same strict check passed with installed root compiler/Node max-old-space-size512. A wrong initial frontend-local compiler path was corrected to the root installation. Failed local logs retained; no user process killed or production resource setting changed.

| Latest run `20261105t172554z_1e855e` | Actual verdict |
|---|---|
| Functional four-menu G6 | PASS,8.0min case/8.3min phase;120source tuples,108positive expected/persisted material lines,20revisions, six-day issue/Chef CSV-XLSX cross-format equality/weekly COMPLETED. |
| G4 real race | PASS41.7s, existing mathematical stock/concurrency owner. |
| G5 initial committed-response-loss | FAIL during prerequisite setup, before fault/replay: Admin `Yêu cầu chờ duyệt` click waited until240s test cap; Admin-context teardown then consumed another240s. |
| G5 supplemental, revised G5 session, G6 direct | NOT_RUN (three dependent cases). Historical passing response-loss cases are not recertified by this attempt. |
| Data-path performance / full repository gates | NOT_RUN after failed adversarial dependency; no qualifying timing sample groups. |
| Source/candidate/cleanup | PASS: main rows/table checksums/schema/migrations unchanged, concurrentDataChangeObserved=false, candidate unchanged during run, cleanup completed=true/errors=[]. Run5174/5263 absent; user5173 PID23104/5262 PID26300 unchanged. |

Failure boundary: `fixtures/mrxWorkflow.ts:183`, called by the unchanged G5 initial case at line27. Coordinator source submit returned200. Admin trace then lacks completed responses for inbox/batches/weekly-menu, but API log records inbox200/5.8814ms and weekly-menu200/8.1448ms at that navigation. Trace missing-completion markers are not real HTTP status codes. This is **not evidence that the server inbox failed**, nor enough to repeat the old rate-limit diagnosis. The generated error-context snapshot is the Thủ kho page, not the blocked Admin page; it cannot establish Admin's rendered state. A prior transient DB deadlock occurs inside the passing G4 race; no causal link to this later stall is established. Browser resource failure is directly observed in the subsequent console extraction above; its exact resource/root cause still needs evidence. Stop at the one-attempt limit; no candidate edit or automatic retry during/after execution.

Latest evidence root `.artifacts/mrx-evidence/20261105t172554z_1e855e/`: `qualification-phases.json`, `cleanup.json`, source/candidate/build manifests; `runtime/menu-coverage-{revisions,latest-readback,terminal}.json`; `runtime/adversarial-api.log`; failure trace `playwright-adversarial/g5-async-timeout--G5-Async-bbe89-tock-effect-reload-recovers-mrx-chromium/trace.zip`. No new `session-recovery-result.json` exists. Candidate SHA256 `1A4C8DF3E08746283E80AF77611F2A7BEFD0C9F21E97F57494F35E81E9C4C16E`; API `07DD015B9286581591730F4FE06C6DF3980AE85C7DF64EEBF52ACEDD48B8625A`; FE index `C29A34C4716D936643B9792365E94D74C45C9CE96915522184484B957332CC0A`; build tree `5934286C76EED9C6724231291C3D89C20B332E86EE7DDBF1CFC6496F48CB31C4`; workbook `d60800ed15131a4196bafdcf5919a7ea72bde99ad7461c74ec1aff0b22a17cd3`.

## Historical actual runs

| Fresh Execute run | Result | First divergence / useful evidence |
|---|---|---|
| `20261105t145300z_0fc8de` | FAIL — harness | G4 setup completed real import, approval, freeze and transfer, then a legacy locator expected `Món ăn trong lô`; the actual control is `Món & BOM đã đóng băng`. Corrected the fixture label without changing its viewport/click assertions. |
| `20261105t150119z_0fd63f` | FAIL — harness | G4 race PASS: independent browser actors, one201/one409, winner-only receipt, preserved predecessor/loser draft and exact stock/lot delta. G5 committed-response-loss reached commit/replay/DB checks, then failed on accessible-name whitespace: actual `Lịch sử phiếu ( 1 )`, expected `(1)`. Anchored count-preserving whitespace patterns now cover the five affected G1/G5 locators; their full recovery behavior is not re-certified. |
| `20261105t151200z_6d66b5` | FAIL — runtime loading gate | Ordered primary coverage first. Imported 120 exact source tuples, 30 per menu section, across six days. Independent decimal oracle matched 108 positive daily projection lines. Three successful revisions: `SWP-01 MORNING savory`, `SWP-02 MORNING savory`, `EDT-01 MORNING savory`. All three retained exact source/projection equality after reload. Next navigation never exposed the customer selector; DOM remained `Đang tải không gian làm việc…`. Later phases were denied. |

Each Execute had its own successful Preflight; no historical clone/credential/profile was resumed. Evidence roots are `.artifacts/mrx-evidence/<run-id>/`. All failed runs remain failed; passing prerequisite statements are not promoted to passing whole tests.

## Historical first boundary — resolved in follow-up

Primary-run trace: `playwright-functional/g6-direct-source-edit--G6--727c9-e-through-terminal-readback-mrx-chromium/trace.zip` beneath the final run root.

- Failure: `g6-direct-source-edit.spec.ts`, `apply`, waiting for nonempty `Chọn khách hàng MRX` after `adminPage.goto(sourceUrl)`.
- Expected: authenticated, correct customer/week source editor becomes available before the next serving change.
- Actual: loading-only DOM persisted throughout the 15-second assertion budget; no next source mutation was submitted.
- Trace network tail includes pending `/api/system-operation-mode` with no completed response and several aborted prior-route requests. Runtime API log also contains a cancellation-related weekly-menu 500 during an earlier navigation; this alone does not identify the cause of the later loading gate.
- No page-error message was found in the extracted trace events; one console409 was recorded. Absence of a captured exception is not proof of error-free UI.
- Attribution remains **NEEDS_EVIDENCE**: browser/proxy/bootstrap/server timing must be separated before proposing a product fix. Do not infer database corruption or solve this by an arbitrary larger timeout.

Historical next action was to reproduce the repeated source reload before assigning blame. The owner's follow-up authorized that bounded investigation/repair; results below supersede this original unresolved attribution.

## Owner-authorized blocker repair and continuation

| Fresh Execute | Actual outcome |
|---|---|
| `20261105t153142z_7daa9b` | Recorder-side transport stall after real import, before source mutation. Failure-only probes added; generic abort/preview transport probe separately passed12/12 reloads. |
| `20261105t154754z_dc849c` | Loading reproduced after3revisions. Direct API, preview proxy and browser probes all exceeded3seconds; visible/foreground page did not recover. Trace showed105Admin API requests in60seconds against production's100/min sliding-window limit and10-request queue. |
| `20261105t155834z_ccc283` | Harness pacing passed original boundary and9revisions. Actual10th apply returned500: MySQL `menuName` exceeds200characters because each immutable version recursively appended a new version label. |
| `20261105t161253z_749dd7` | One-line materializer repair passed18exact-readback revisions, including formerly failing10th. Whole-case10min cap reached; redundant before-edit navigation removed, required after-edit reload retained. |
| `20261105t162646z_25a666` | Core G6 PASS:20revisions and terminal chain. Next named phase rejected before execution because the guard's phase enum had not been updated alongside runner selection. |
| `20261105t164115z_fb3873` | Core G6 PASS again (8.0min), G4 race PASS, G5 committed initial and supplemental loss/replay PASS. Session recovery FAIL after real401/no-write checks and successful same-actor reauthentication: expected local draft no longer exists. G6 direct adversarial case NOT_RUN; timing phase NOT_RUN. |

Repairs and proof:
- Test harness counts actual browser API traffic per actor across contexts and admits new operations with burst headroom below the unchanged production limit. Pacing is outside performance windows. No endpoint exemption, API stub, auth/rate-limit override or larger request/case timeout.
- `MenuAmendmentVersionMaterializer` now preserves the original business name; existing menuCode/versionNo/audit still identify versions. Both DEFAULT and MRX callers use this owner without merging workflows. Existing real applier case extended with a valid200-character Unicode name and unchanged predecessor: exact suffix-growth RED → focused backend88/88GREEN. No schema migration or destructive name truncation.
- Named `adversarial`/`data-path-performance` phase admission was added at the existing protocol enum, not a failing-test exemption. Two intended admission REDs →guard/teardown/auth26/26GREEN; exact prepared target/run/main-denial protections unchanged. Adversarial phase uses the original functional owners'15min outer budget, not accidental generic7min; individual case/assertion budgets unchanged.
- Dedicated runner EF read-only checks/tests use Release outputs; an attempted Debug build hit the existing user's apphost lock, and that process was not killed/restarted.

### Historical blocking contract decision — resolved by approved A

`g5-async-timeout.spec.ts:209` requires a saved `mrx_initial_<batch>_<date>` draft after a real401 and re-login. Product source is explicit: `api/client.ts`401 →`clearSessionState()` →`clearAllClientDrafts()`. The existing API contract owner also requires purging session-owned caches on401. The trace reaches the actual denied POST and no issue/receipt/version/stock mutation assertions, then successful same-actor login; it fails before any resumed submit or cross-user/stale-draft assertions. Missing draft is therefore **a session-policy/test expectation conflict**, not proof of unauthorized writes or a transport failure.

The historical stop required a policy decision rather than auth/privacy weakening or deletion of the failed assertion. The owner subsequently approved401purge (A); the revised tests above now distinguish recovery within a valid session from fresh entry after reauthentication. This does not retroactively turn the old run green or prove the revised browser case, which is blocked earlier in the latest attempt.

Latest immutable evidence root: `.artifacts/mrx-evidence/20261105t164115z_fb3873/`:
- `runtime/menu-coverage-revisions.json`:20successful operations; `menu-coverage-latest-readback.json`:120source tuples,12split-serving records,108 independently expected/persisted positive daily material lines.
- `runtime/menu-coverage-terminal.json`: batch `eec03f19-a4ec-44f8-8d6d-7306319b3f96`, week2027-02-08, COMPLETED; Chef CSV/XLSX files parsed and cross-format compared. This is not independent source→Chef numeric mapping certification.
- `runtime/precommit-transport-no-write.json`, `response-loss-result.json`, `response-loss-result-supplemental.json` and actual Playwright adversarial trace retain distinct fault/commit/replay outcomes.
- Build manifest API SHA256 `07DD015B9286581591730F4FE06C6DF3980AE85C7DF64EEBF52ACEDD48B8625A`; FE index `C29A34C4716D936643B9792365E94D74C45C9CE96915522184484B957332CC0A`; candidate `30DB80BAB842233C0D08A6F185A83658219EB02966C0DCD9CB2B3715823B08FD`; workbook `23059b8e7596288f99cd3f38242b9af7bd727d9510157006f27179d9515f7aff`.
- All six follow-up Execute cleanup receipts completed=true/errors=[]; source row counts/table checksums/schema/migrations unchanged, no concurrent main-data change; candidates unchanged during each run. Dedicated5174/5263 gone; user5173 PID23104 /5262 PID26300 preserved. These were fresh clones, never historical-target resumes.

## Coverage against the spec

“Partial” below is **NEEDS_EVIDENCE** for the whole requirement, even where the listed slice passed.

| ID | Evidence / verdict |
|---|---|
| IMP-01 | PASS for exact 120 persisted date/shift/variant/slot/dish identities in the authored workbook. |
| IMP-02 | PASS for authored horizontal merges across all four sections in the actual import and normalized source readback. |
| IMP-03 | PASS for authored vertical merge memberships across all four sections; material oracle matched actual daily quantities under the source-backed per-day/shift/variant/dish multiplicity rule. |
| IMP-04 | Parser theory PASS for rectangular semantics; generated labeled variant exists. Runtime import/rejection NOT_RUN. |
| EDT-01 | PASS scoped: member replacement in each of four menus, exact reload/source/material equality. Whole-group coverage remains absent. |
| EDT-02 | NOT_RUN as a distinct per-member/whole-vertical-group replacement contract. |
| SWP-01 | PASS scoped: two-date swap in each menu, atomically submitted and read back. |
| SWP-02 | PASS scoped: two-slot swap in each menu, atomically submitted and read back. |
| SWP-03 | Partial merged-member splitting across four sections occurred in the above operations; distinct whole-group swap coverage remains absent. |
| SRV-01 | PASS scoped: unequal split servings plus increase/decrease in each of all four menus, exact source and independent daily projection after every revision. |
| SRV-02 | Imported blank-serving path was exercised before authoring counts; explicit-zero/validation contrast NOT_RUN. |
| RIM-01, RIM-02 | Existing focused backend owners PASS; new scenario's actual UI identical/changed reimport and historical snapshot chain NOT_RUN. |
| NEG-01 | Mixed locked/open-date atomic rejection on the new batch NOT_RUN. |
| NEG-02 | Missing-BOM/malformed variant runtime negative control NOT_RUN. No speculative master provisioning was used to hide prerequisite gaps. |
| COR-01 | Partial exact intended customer/week/source tuple identity. Separate unchanged customer/week and DEFAULT-control assertions remain incomplete. Main DB preservation is separately evidenced below. |
| COR-02 | Preview business-table checksum non-mutation and commit identities exercised; old snapshot immutability across reimport remains incomplete. |
| COR-03 | Approval/freeze/transfer and20direct revisions succeeded with artifacts. Separate G4 and both G5 committed-response-loss paths PASS; session recovery FAIL, remaining full adversarial chain blocked. |
| COR-04 |108positive daily lines independently matched at baseline and all20revisions. Weekly/zero/removed-line and persisted cooking-contributor assertions remain incomplete. |
| COR-05 | Six-day issue on the changed-source batch plus separate exact stock/race owner PASS; full changed-source stock/lot oracle remains partial. |
| COR-06, COR-07, COR-08 | Chef CSV/XLSX parsed and cross-format equality verified; weekly reconciliation COMPLETED with required actual/reason/accept flow. Independent source→Chef numeric mapping, all history/whole-scope exports remain NEEDS_EVIDENCE. |
| COR-09 | Post-apply reload/source readback PASS20times. Historical G5 showed valid-session offline recovery and401no-write, then failed the now-superseded cross-session retention expectation. Approved purge/fresh-entry unit boundary PASS; revised G5 browser/DB flow NOT_RUN in latest attempt, blocked by earlier setup. Full scope isolation incomplete. |
| PERF-01 | PASS for hashed Release API/production FE serving and candidate/run/actor/mode/data identity in retained manifests. User development listeners were not measurement targets. |
| PERF-02 | Measurement phase separates trace/slow-motion from functional evidence in code; actual measurement phase NOT_RUN. |
| PERF-03 | NOT_RUN: zero qualifying 20-warm/5-cold route groups and zero qualifying five-fresh-scope timing series. |
| PERF-04 | NEEDS_EVIDENCE: no NFR budget accepted. First-correct-frame and authoritative first-ready markers intentionally remain null, not FCP/networkidle substitutes. |
| PERF-05 | Three exploratory server apply durations exist below; complete request/transfer/browser observer and import/apply-to-readback series NOT_RUN. |

Exploratory server-only elapsed times from the final functional run: three successful source applies, **315.1912 ms, 176.6063 ms, 181.4571 ms**. These are neither browser end-to-end latencies nor the required comparable timing sample set; no P75 budget conclusion is made.

## Initial campaign provenance (historical)

All three runs built the same product artifact tree; harness candidates differed as documented. Final primary run:

| Artifact | SHA-256 |
|---|---|
| Product build tree | `C5979FB2E727EE6470F563BA997C45B309E29706CE933FBD045B8D698867F927` |
| Release API | `D1505962F7F3C97744E79E3839B6817ECF2F253302570F92BCBD937475790208` |
| Production frontend index | `C29A34C4716D936643B9792365E94D74C45C9CE96915522184484B957332CC0A` |
| Candidate working tree at run | `78496764B6EE1131F7E21D1810CD507EC288C005DA8977CE45B2165AAB8692C0` |
| Canonical template | `124ff95ef96612e46ccbc8d40bf2b5205b3dd8748c1fb1fe7fc116c2205a1bff` |
| Actual coverage workbook | `34fd41f2c8bc03af96740fc50b9b1b225af7b4c7ccfe0dc3e0179ed8b3642a58` |
| Authored manifest | `79608e37414d97e23a1b36f2a8b340f4292ebc56b410d49cc3fe96faeb7c477b` |
| Independent oracle test-support source | `22999c3152df272d1a49019ba9ff91cf9fa26afb4d86322e9ba167b925be5295` |

Git HEAD: `b2adf6ef05cf9ddf8227d7786965efbba6801521`. The large inherited dirty tree is not attributed to this task. No staging/commit. Hashes bind the run candidate, not the later report/WORK close.

Primary data files, beneath the final run's `runtime/`:

- `scope-20261105t151200z_6d66b5_12-2027-02-08-coverage.json` and corresponding workbook/rectangular/changed variants.
- `menu-coverage-revisions.json`: three completed operations with actual command payloads and independently updated expected facts.
- `menu-coverage-latest-readback.json`: 120 expected normalized source tuples and equal expected/persisted 108-line daily projections.
- `functional-api.log`, `functional-frontend.log`; the trace retains actual browser interactions and network evidence.

These are private local business/test artifacts, not public fixtures or credentials to copy into future runs.

## Safety and cleanup

For **each** of the three Execute roots:

- `cleanup.json`: `completed=true`, `errors=[]`, owned target/subordinate created and removed, runtime principal attempted and removed, private temporary directory absent.
- `source-after-manifest.json.manifest` matches original source table checksums/row counts; migration/schema identity unchanged; `concurrentDataChangeObserved=false`.
- `candidate-source-after.json`: `unchanged=true` during the run.
- Run-owned ports5174/5263 absent after cleanup. Existing user FE5173 PID23104 and BE5262 PID26300 remained in place.
- The diagnostic checks required existing migration IDs and does not call database update. Bootstrap behavioral coverage rejects any undeclared master query; only declared actor/principal boundaries are admitted.

An older `status.json.cleanupCompleted=false` reflects the failure status written **before** finally-cleanup; the later cleanup receipt is the completed cleanup authority. This reporting inconsistency is disclosed, not rewritten into a passing diagnostic status.

## Local verification and review limits

- Focused backend parser/import/applier/runner suite: 80/80 PASS, zero skips; latest subsequent runner selection suite 30/30 PASS after the phase-order RED→GREEN. One inherited CS1998 warning remains.
- Frontend fixture/metrics/connection/database/teardown suites: 33/33 PASS, zero skips; fixture recheck after first locator repair 5/5 PASS.
- Touched harness ESLint and strict TypeScript consumer checks PASS; new G6/G7 discovery confirmed. Full product builds were performed by each runner before browser evidence.
- Follow-up close: backend88/88PASS (Release), frontend11files/80testsPASS (including actual API/session contract owners), zero skips; touched ESLint/strict harness types/scoped diff-checkPASS. Latest fresh Release/production frontend builds passed before browser execution. Full `npm run verify` was not reached after the failed adversarial dependency gate; no repository-wide certification.
- Real REDs: missing generator/date title, forbidden migration invocation, unsafe G1 diagnostic admission, primary-phase ordering, and the two runtime legacy locator mismatches. No assertions were relaxed to tolerate wrong identities/quantities/counts.
- Native author self-review only, not independent review. New tests/support exercise actual import/source/persistence and independent arithmetic; no production exports/components/fixtures were invented to make tests pass.
- Code/UI/anti-tautology review does not certify all-role/six-state/a11y/layout/export behavior. Missing named `operationalPageContracts.test.ts`/`*.contract.test.tsx` are not reported as passing tests; no TSX/CSS product change was made in this verification scope.

**Next work:** diagnose the newly retained Admin approval navigation/response-completion stall before another separately admitted fresh clone. Then verify revised G5 and dependent measurement; finish remaining rectangular/group/reimport/negative/independent export cases from the parent plan. The401purge decision is already approved, not an open question. Never reuse cleaned targets/actors or bypass dependency gates.
