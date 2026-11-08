# MRX Lifecycle Scope Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans, native sequential execution. Steps use checkbox syntax. Project/Owner restrictions override generic skill commit, worktree and delegation recipes.

**Goal:** Close LC-01..LC-12 as one candidate-bound business acceptance package without letting extension work replace the main lifecycle.

**Architecture:** Extend existing G1–G6 owners and governed runner. Connect the edited source to actual downstream issues, Chef read/export and Manager closure; independent cases cover failure branches. WORK alone owns progress and extension status.

**Tech Stack:** Existing React/TypeScript, ASP.NET Core/EF/MySQL, Vitest, headed Playwright, installed CSV/XLSX readers. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-03-mrx-lifecycle-scope-lock-design.md`.

**Status:** Owner approved execution (“duyệt thực thi”). `.planning/WORK.md` alone records live progress and any later pause/resume instructions. Preserve the selected native method; do not ask again about delegation.

## Approved work package — không mở hướng kiểm thử khác

[MRX Single-Clone Audit/Repair](2026-11-03-mrx-single-clone-audit-repair.md) là **gói triển khai bên trong plan này**, nối tiếp [plan tổng Five-User Production Qualification](2026-11-02-mrx-five-user-production-qualification.md). Owner đã duyệt thiết kế và yêu cầu giữ plan tổng. Gói R1–R2 thay cơ chế clone-per-attempt của Task6; R3–R4 kiểm kê/sửa BE-FE và admin MRX trong scope Owner bổ sung; R5 hoàn tất owner còn thiếu của Tasks2–5; R6 trả về đúng GateC này. LC-01..12, G1–G6 và business oracles không được thay bằng suite khác.

Đối với campaign mới, phần dưới được đọc cùng amendment: Start một clone cho plan tổng, Run giữ DB khi fail/pause, không DEFAULT integration subordinate, full verify chỉ tại điểm cần thiết. GateC xác minh business/admin findings và dừng processes với `RETAINED_AUTHORIZED`; không drop DB hoặc tuyên bố overall qualification PASS. Finish/cleanup DB thuộc Task8 của plan tổng, sau các parent gates được admitted riêng. Legacy Execute trong checklist cũ không phải lệnh resume campaign. Scope/quyền/lineage và giới hạn budget không được nới ngầm.

## Global Constraints

- LC-01..12 is the finite mandatory scope; extension findings enter WORK first.
- Chef only views/exports menu; no operational mutation or kitchen acknowledgment/returns.
- DOM-MODE-1; shared customers do not admit DEFAULT operations. BOM once per customer/date/shift/variant, six-decimal quantities, immutable lineage/history.
- Actual FE actions for workflow claims; read-only HTTP/SQL corroboration only. No invented stock/BOM/receipts or success mocks.
- Main read-only, completed migrations never repeated; exact clone ownership/safety/readbacks remain mandatory. Active campaign retains one owned DB until parent Task8/explicit Owner Abort; per-attempt teardown stops processes, not the DB.
- One native writer in inherited dirty workspace; no install/delegation/worktree/stage/commit/push/deploy.
- No memory/zoom/endurance/HTTP expansion until mandatory business acceptance PASS; even then quantitative continuation is a separate explicit step, not automatic runner fall-through.
- Reproduced direct blocker → linked LC row → minimal owner repair → regression → return to that row. Two failed repairs of one symptom require a diagnosis checkpoint, not another speculative patch.

## Review Focus

1. Edited/merged source is correct locally but warehouse/Chef/report still reads an older revision — Task 3.
2. Group command fails after another member changed; assertions accidentally include the legitimate competing write in the rejected command baseline — Task 4.
3. Chef download responds with login/error HTML or an empty workbook — Task 3 parses actual output.
4. Manager policy mismatch gets hidden by Admin substitution; Coordinator read permission mistaken for decision permission — Task 2.
5. Zero, conversion, session or unsupported prerequisites receive fake PASS/N/A or require DEFAULT setup — Task 5 stops with BLOCKED and preserves criterion.

## Existing owner map

| Files | Responsibility / allowed change |
|---|---|
| `.planning/WORK.md` | Sole current LC verdicts, next task, blockers, extension register and scope-change decisions |
| `frontend/tests/e2e-mrx/specs/g1-golden-path.spec.ts`, `fixtures/mrxWorkflow.ts` | Existing real import/split/submit/approve/create/ready/transfer and terminal Golden; retain public `createTransferredBatch(pages, scope): Promise<{batchId:string;menuVersionId:string}>` |
| `g2-multi-role-handoff.spec.ts`, `AuthorizationPoliciesTests.cs`, `Security/AuthorizationPolicies.cs`, actual source controllers | Actor contracts; no global role broadening |
| `g6-merged-customer.spec.ts`, source model/grid/hooks | Existing grouped edit/customer/BOM proof; extend downstream lineage chain here instead of duplicating edit setup |
| `g3-alternative-flows.spec.ts`, reconciliation/warehouse services | Existing shortage/overage/supplement/modal/correction/completion owner |
| `g4-concurrency-rollback.spec.ts`, `g6-direct-source-edit.spec.ts` | Existing valid-client race and issued-day source lock owners |
| `g5-async-timeout.spec.ts`, `ReconciliationPreparationTests.cs`, preparation service | Existing response-loss/session/two-customer group and atomicity owners |
| `features/chef/MrxCookingWorkbench.tsx`, `api/mrxApi.ts`, backend kitchen export service | Existing Chef CSV/Excel view/export; production repair only after concrete failing boundary |
| `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` and evidence-contract tests | One functional-only acceptance selection and existing exact safety/readbacks; no new orchestration framework |

Product paths above are conditional repair owners, not authorization to edit all of them. Preserve actual signatures and existing helpers; introduce no test-only production seams.

## Task 1: Freeze acceptance and extension routing (Gate A)

**Files:** WORK; review spec and earlier combined/qualification plans.

**Interfaces:** consumes approved scope-lock spec; produces WORK rows LC-01..12 with one primary owner each. Live status is not copied into this plan.

- [ ] Read current git status/HEAD/staged paths, WORK and applicable skills. Preserve inherited modifications.
- [ ] Initialize each LC row with actual latest evidence and missing final-candidate proof. Historical terminal PASS is not a final matrix PASS. Every row names expected result, actor, batch/revision linkage and artifact.
- [ ] Confirm Manager source expectation using BR-MRX-EDIT-1 and actual controller/permission/action guards. Any unresolved conflict marks LC-03 BLOCKED; do not substitute Admin or silently change business policy.
- [ ] Record extension promotion rule and EX-01..07 in WORK. Keep five-user smoke FAIL and native zoom BLOCKED visible but outside this execution path unless linked to a mandatory row.
- [ ] Parent self-review: every acceptance row has an owner and checkable expected result; no return/ack operation or quantitative task. Ask only for a genuinely unresolved business/security ruling.

**Expected:** finite scope and explicit blockers; no browser/DB work yet. No new planning branch.

## Task 2: Repair role-contract coverage, not actor identity

**Files:** G2, existing AuthorizationPoliciesTests; conditional source policy/permission/action owners and existing role tests.

**Interfaces:** consumes LC-03 actor table; produces distinct real-actor admission/action results for later scenarios. Manager remains Manager.

- [ ] Load test-audit and inspect relevant DTO/policies and all source action callers. Classify existing G2 cases: retain admission, fix outdated Coordinator read-denial expectation and misleading Admin-only Manager title/coverage.
- [ ] Write/extend the smallest existing boundary regression for intended Manager source access and continued forbidden Warehouse/Chef operational rights; observe intended RED before any policy fix. Do not test just constant membership when request delivery can be exercised.
- [ ] Apply only the canonical-role alignment proven by that RED. If requirements do not settle the permission, stop LC-03 for Owner ruling.
- [ ] Verify Coordinator allowed reads do not imply disposition/completion rights; Chef positive view/export and negative mutations; Warehouse cannot edit source. Direct API denial checks require the intended authorization reason and unchanged state.
- [ ] Run focused G2/policy suites, then relevant lint/build. Record exact commands/results and no actor substitution.

**Expected:** LC-03 assertions agree with canonical role authority; no test title claims an actor it never uses. No general permissions redesign.

## Task 3: Connect edited source to terminal output (LC-01/02/04/05/08/09)

**Files:** G6 merged/customer primary owner; existing G1/G3/helper; conditional source/warehouse/Chef/export/reconciliation owners.

**Interfaces:** keep `createTransferredBatch` return type and `MrxScenarioScope`; carry actual `batchId`, `menuVersionId`, customer, date, accepted source revision and declared dish/serving IDs into downstream assertions. Reuse existing decimal/stock oracle.

- [ ] Retain current customer-create/list/select and merged edit/BOM assertions. Add invalid-file no-write recovery at the actual import modal; preserve missing-split and missing-BOM cases, no duplicate source-owner test.
- [ ] Extend the edited-source scenario after final accepted edit: real Warehouse action issues from its current revision, independent base quantities and per-line lineage match the accepted edit. Verify next customer/date/variant is unchanged; nonadjacent same-ID counts once, same-name different-ID does not merge where real catalog permits the case (otherwise report the specific prerequisite gap).
- [ ] Chef opens that exact batch and service scope. Click current `Tải CSV` and `Tải Excel` through actual FE; capture real downloads/popup responses as implemented. Parse bytes with installed libraries, reject HTML/login/error/empty output, compare customer/week/date/shift/dish/servings and material fields against accepted source/frozen values. Check no operational state/stock changes.
- [ ] Continue that same edited batch through all applicable service dates, Manager decision if needed, completion/reload and FE history/completed-report/export. Compare exact issue identities and total required/issued/variance to independent persisted evidence. Do not use another untouched Golden batch as the result of this scenario.
- [ ] Keep G3 as owner of shortage1/supplement1/overage2/decision correction. Extend only its missing report UI/export proof, preserving nonzero variance and predecessor history; do not duplicate its complete exception sequence in G6.
- [ ] If any product defect appears: smallest regression RED → owner repair → GREEN; rerun affected source-to-output chain. No redesign/export framework.

**Expected:** edited-source lifecycle reaches terminal evidence; Chef is strictly read/export. File buttons alone or API-only report reads are not sufficient.

## Task 4: Group atomicity and valid-client conflicts (LC-06/07)

**Files:** G5 coordinated owner, G4/G6 race owners; existing ReconciliationPreparationTests and service only for demonstrated defects.

**Interfaces:** uses two real customers/date with shared ingredient and actual expected versions. Rejected-command baseline is captured after a legitimate competing operation.

- [ ] Extend existing coordinated case, not a second cloned workflow: two valid contexts prepare members; a legitimate UI operation advances one member's version; submit the stale prepared group through actual FE.
- [ ] Assert intended 409/version conflict. Baseline every member after the competing write, before rejected submission: issue/group IDs, stock/lots/movements, versions and relevant audit/decision/contributor identities. Compare unchanged after rejection; do not undo the legitimate competing write.
- [ ] Reload, reprepare and execute a valid group; preserve current exact child/aggregate stock and committed-response-loss/replay proof. Complete downstream views/report checks for the group members without claiming one member's terminal status proves the other.
- [ ] Run existing source-vs-first-issue and supplemental valid-client races on this candidate. Assert actual one-winner/no-partial-effects, issued/completed source locks, draft retention and recovery.
- [ ] If a durable partial-write defect is reproduced, lock regression at existing transaction owner before minimum repair. Unit rollback test alone does not replace FE/MySQL proof.

**Expected:** both successful idempotency and failed all-or-nothing group behavior are proven; no fabricated stale SQL updates.

## Task 5: Close bounded quantity/recovery branches (LC-10/11/12)

**Files:** G5 session/transport owners, G3 quantity owner; existing unit/conversion policies, daily workbench/hooks only if implicated.

**Interfaces:** consumes existing real issue command/key and stock oracle. No new customer/stock/BOM factory.

- [ ] Preserve current genuine post-commit initial/supplemental/group response-loss cases. Extend existing owner with transport abort before upstream commit; require zero durable effects, honest UI and a later explicit successful action. Do not fabricate server success.
- [ ] Extend scoped session case to prevent stale/cross-actor draft application. Same actor login remains actual UI; missing-token case must not be renamed JWT expiry. No credentials in draft storage.
- [ ] Inspect currently supported MRX unit/zero controls and real catalog prerequisites. Exercise retained-zero and valid alternate unit → exact base-unit delta; invalid conversion must reject without writes. Do not switch DEFAULT, add test-only controls or synthesize unit/stock evidence.
- [ ] If the required control/prerequisite is absent, record LC-12 BLOCKED with concrete owner/DOM/API evidence and seek the smallest scope ruling. Do not mark N/A or open a conversion feature project automatically.
- [ ] Run focused owner regressions and actual short clone cases; stop after failed safety or twice-failed root repair as specified.

**Expected:** required edge/recovery verdicts, including honest BLOCKED when applicable. No JWT/provider/storage campaign beyond this row.

## Task 6: One functional acceptance entry and final package (Gate C)

**Files:** existing runner, evidence-contract tests, WORK. Reuse current G1–G6 selectors; add at most one `LifecycleAcceptance` diagnostic value, no helper workflow engine.

**Interfaces:** consumes final candidate plus required LC/admin findings; produces functional-only receipt/WORK matrix and retained-resource proof. Use the approved work-package R6 for campaign invocation; no quantitative phase or DB Finish at GateC.

- [ ] Test runner selection at its existing evidence boundary: `LifecycleAcceptance` includes mandatory owner cases and cannot select G7/G8/k6. Preserve existing exact-run, build/source identity and cleanup tests; no source-grep padding.
- [ ] Implement that single selection in current runner. Retain old diagnostic artifacts/entry compatibility, but do not create more campaign variants. Run PowerShell parse and existing evidence-contract suite.
- [ ] Run short prerequisite checks, then R6's `-Mode Run -Profile Qualification -CampaignId $campaignId -Diagnostic LifecycleAcceptance` on the retained clone/final candidate, headed/single-worker/fail-fast. Existing `-Mode Execute` is legacy standalone only, not campaign resume. Declare selection/total finite budget before start; do not raise or multiply900000ms to conceal failures.
- [ ] Run `npm run verify`; `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter 'FullyQualifiedName~RecoveryScriptContractTests|FullyQualifiedName~MrxDisposableEvidenceContractTests'`; root `node node_modules/vitest/vitest.mjs run frontend/tests/e2e-mrx/core/__tests__ frontend/tests/e2e-mrx/fixtures/__tests__ --environment node`; standalone harness typecheck for changed specs and `git diff --check`. No packages installed. Use actual semantic FE suites if named operational contract files remain absent; disclose absence.
- [ ] Parent code/UI/test audit; read exact candidate/source/build and owned process/listener shutdown receipts. Verify DB/principal ownership and `RETAINED_AUTHORIZED` rather than claiming DB cleanup. Candidate mutation during a run invalidates attribution; Finish remains parent Task8.
- [ ] For each LC row and frozen in-scope BE/FE/admin finding record PASS/FAIL/NEEDS_EVIDENCE/BLOCKED plus artifact. BUSINESS_ACCEPTANCE_PASS requires all required rows PASS on the final candidate, repository gates/source proof and process shutdown, with DB explicitly retained. Overall qualification/DB cleanup is not complete; never replace gaps with a broad test PASS count.
- [ ] Return WORK to IDLE; keep extensions open. No automatic G7/G8/HTTP continuation. Any subsequent quantitative phase is explicitly admitted as the next task after review of this package.

## Self-review / handoff

- Spec coverage: boundary/roles → Task2; source-through-output → Task3; group/locks/races → Task4; quantity/session/transport → Task5; evidence/gates → Task6; scope firewall/register → Task1 and every blocker rule.
- Interfaces retain existing helpers/DTOs; no exports or production seams solely for tests. One candidate can have several independently scoped cases; one case need not carry every branch.
- Task steps are Owner-approved; live completion and remaining evidence are recorded only in WORK. Approval grants no commit/delegation authority.
- The original qualification plan remains the parent of this scope-lock/work-package sequence. Prior automatic memory-first continuation and Chef/return assumptions stay superseded; remaining desktop/performance/memory/operational obligations are not canceled and require their admission gates. Live statuses remain in WORK.
