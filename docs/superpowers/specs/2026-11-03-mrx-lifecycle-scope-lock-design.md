# MRX Lifecycle Acceptance — Scope Lock Design

**Date:** 2026-11-03  
**Status:** Owner approved this spec/plan and execution (“duyệt thực thi”). Live progress and pause/resume authority reside only in `.planning/WORK.md`.  
**State owner:** `.planning/WORK.md` only. This document defines contracts, not a second progress ledger.

## 1. Intent and authority

Finish one bounded MRX business acceptance package before expanding quantitative qualification. Existing G1/G3 terminal successes are valid evidence, but do not close uncovered branches. A single package means related scenarios on one identified candidate with explicit lineage, not one giant Playwright test.

Authority: latest Owner correction > this scope lock > earlier combined/qualification plans where their execution order or Chef/return assumptions conflict. Preserve other valid requirements and historical evidence. This document does not authorize deployment or claim production readiness.

Relevant contracts: FR-MENU, FR-CAT/FR-ADMIN (shared customers), FR-WH, FR-CHEF, FR-RECON/FR-REP, FR-AUTH; BR-MRX-EDIT-1..9, BR-MRX-SERV-1..2, BR-MRX-TRUTH-1..2, BR-MRX-HIST-1; DOM-MODE-1. Canonical source: `docs/DOMAIN.md`, `docs/domain/material-reconciliation.md`; UI authority remains `docs/DESIGN.md`.

## 2. Approach already selected

- **Selected by the approved review direction:** close a finite lifecycle matrix using existing owners; hold extended investigations in WORK. Minimal integration, no new test framework or workflow engine.
- Rejected: keep adding diagnostic recipes and chase whichever fails next. This repeats setup while business gaps remain.
- Rejected: put all cases in one huge end-to-end test. It obscures the failing contract and makes unrelated cases dependent.

## 3. Frozen business boundary

- Coordinator prepares menu/split servings and submits changes; Admin/Manager review/apply according to BR-MRX-EDIT-1. Resolve current Manager source-policy conflict at its existing owners; do not substitute Admin as Manager proof or grant unrelated permissions.
- Warehouse performs initial/supplemental/coordinated issuance. MRX assumes sufficient materials; no Purchasing, DEFAULT receiving, user stock top-up or fabricated inventory prerequisites.
- **Chef only views and exports the menu. No operational mutation, receipt acknowledgment, return, source edit, issuance, disposition or completion.** Export is output, not stock issuance. Current CSV/Excel controls must be checked as actual downloads, not just button visibility; do not invent a kitchen approval step.
- Manager records/corrects allowed overage decisions and completes the week. Shortage must be supplied, not waived. Accepted nonzero variance stays visible after completion.
- Shared customer create/list/select remains shared master data, not permission to import DEFAULT operational workflows. New-customer BOM onboarding is not silently added to this package; source lifecycle can use an existing authorized customer contract.
- Same dish ID counts BOM once per customer/date/shift/variant. Visual adjacency is not arithmetic. Servings are independent of rowSpan/colSpan. Preserve six-decimal quantities, immutable revisions and historical decisions.

## 4. Finite mandatory acceptance matrix

All rows require a verdict on the final candidate. Historical PASS may guide setup but is not relabeled final-candidate proof. Rows may share an owner and fixture. No exhaustive input permutations are implied.

| ID | Contract / smallest credible case | Primary existing owner | Required endpoint of proof |
|---|---|---|---|
| LC-01 | Readiness: empty/missing split blocks; invalid workbook rejected without source writes; missing BOM blocks and covered-dish selection recovers | `fixtures/mrxWorkflow.ts`, `g6-merged-customer.spec.ts` | Actual FE rejection/recovery, correct reason, no unintended writes |
| LC-02 | Source edit: four equal slots, whole-group replacement, four individual dishes, partial merge; savory/vegetarian servings; BOM once | `g6-merged-customer.spec.ts` | Slot IDs/servings/revision + independent required quantities; preserve same batch/revision linkage into LC-04/08/09 |
| LC-03 | Coordinator submits; Admin/Manager allowed decision paths, required reason, reject then correct/resubmit; shared customer create/list/select | `g2-multi-role-handoff.spec.ts`, `g6-merged-customer.spec.ts`, workflow fixture | Each real actor's allowed/denied action; correct transition and persisted reason; no Admin substitution |
| LC-04 | Draft → READY → transfer → manual actual issue, reload and repeated submission protection | `g1-golden-path.spec.ts` / integrated LC-02 owner | Actual issue consumes latest accepted source; exact issue lineage/stock/lots/movements/version |
| LC-05 | Shortage1 → cannot waive → supplemental1; next date overage2 → reason/decision → correction | `g3-alternative-flows.spec.ts` | FE work plus intended negative rejection, shortage0, append-only old/new decisions; variance remains2 |
| LC-06 | Two actual customers, shared ingredient; coordinated success + replay; one genuinely stale member rejects the whole attempted group | `g5-async-timeout.spec.ts` coordinated owner | Every child's issue/version/stock matches; rejected command creates no extra group/child/stock/decision/audit effects (relative to baseline after legitimate competing write) |
| LC-07 | Issue-date/completed locks; source-apply vs first-issue race; two valid supplemental clients | `g6-direct-source-edit.spec.ts`, `g4-concurrency-rollback.spec.ts` | Exact winning branch, intended loser conflict, no partial writes; retained draft/reload |
| LC-08 | Chef views and downloads CSV + Excel for the LC-02 edited source | Extend LC-02 lifecycle in `g6-merged-customer.spec.ts` | Real file bytes parsed: customer/week/date/shift/dish/servings and available material details match accepted lineage; no Chef business-state/stock change |
| LC-09 | All applicable dates → Manager complete/reload → history/completed register and FE report/export | `g3-alternative-flows.spec.ts`, integrated LC-02 owner | COMPLETED; exact document identities and real nonzero variance; no cross-batch leakage; actual report UI/file agrees with read-only oracle |
| LC-10 | Initial/supplemental/coordinated committed response lost → honest recovery and exact-key replay; pre-commit transport failure → no effects | `g5-async-timeout.spec.ts` | Distinguish committed vs uncommitted; zero duplicate effects, explicit recovery/reload; no synthetic success |
| LC-11 | Session/draft: same actor reauth restores scoped draft; stale/cross-actor draft not silently applied | `g5-async-timeout.spec.ts` session owner | Actual FE draft and persistence checks. Missing token stays labeled missing token, not JWT expiry. Natural expiry/revocation is EX-04 unless Owner promotes it |
| LC-12 | Quantity edges already supported by MRX: retained zero line; valid unit conversion, invalid conversion rejected | Existing G3/G5 owner + backend quantity owner tests | Real supported FE action and independent six-decimal base-unit delta. If no supported UI/real prerequisite exists: BLOCKED with evidence, not N/A/PASS or invented master data |

RBAC applies across the rows: permitted navigation/action plus intended direct API denial/no effects for unauthorized mutations. Chef export/read is positive coverage; Chef operational mutation denial is negative coverage, never a request to implement that operation.

Full UI-state permutations belong only where the change puts that state at risk: preserve existing loading/empty/error/denied/partial/write-reconciliation owners. Do not manufacture a route×role×state combinatorial matrix.

## 5. Evidence and gate rules

For each row record in WORK: case ID, actor, candidate/build hashes, run ID, batch/source revision/date/customer, actual FE action, expected independent result, verdict, artifact path and limitation. Each mutation chain is control → real request → durable outcome → reload. HTTP/SQL corroborate; they do not replace claimed user actions. Parse exported data with installed libraries; file existence alone is insufficient.

Gate A — matrix/role contract reviewed. Gate B — short missing-case repairs and owner regressions. Gate C — integrated functional run on one final candidate covering LC-01..12, plus build/lint/relevant tests and cleanup/source readback. Gate D — separate quantitative qualification, **not admitted until all mandatory rows PASS**. A blocked row means business acceptance BLOCKED, not permission to enter D.

Safety failure stops immediately and triggers exact cleanup. Functional failure stops the current run; keep its evidence and repair only the implicated owner. A candidate edit invalidates affected final-candidate rows; rerun affected owners and final integrated acceptance, not automatically every historical diagnostic.

## 6. Scope firewall and extension handling

Every new finding first enters WORK's extension register, not the active task list. Classify:

1. **Direct blocker:** reproducibly prevents a mandatory LC row, violates its security/data integrity, or breaks governed safety. Record linked LC ID + evidence + smallest allowed repair, fix at owner, verify RED→GREEN, return immediately to that row. No new project/abstraction.
2. **Deferred extension:** relevant but not needed for LC-01..12. Record severity, evidence, impacted owner, promotion condition and next bounded verification. Do not execute it now.
3. **Requirement/permission conflict:** stop that row and obtain Owner ruling if canonical requirements do not settle it. Never widen rights or remove the acceptance expectation to get green.

No new mandatory row, subsystem, diagnostic family, dependency, duration increase or security authority without explicit Owner scope change. A scope change states what enters, what is displaced, why, and acceptance impact before execution. After two failed repairs of the same root symptom, checkpoint with evidence and a bounded diagnosis; no third speculative patch or unrelated lane switch.

Mandatory closure statuses: PASS / FAIL / NEEDS_EVIDENCE / BLOCKED; unrun is NEEDS_EVIDENCE. Deferred issues remain visible and cannot be described as fixed. Business acceptance PASS is not overall production GO.

## 7. Explicit deferred work

Live register entries/status reside only in WORK, initially EX-01..EX-07: repeated catalog-load latency; role-inappropriate customer reads; native desktop zoom/a11y remainder; five-user/endurance/HTTP and real JWT-expiry evidence; broader memory/export-cancel/managed allocation; new-customer BOM onboarding; off-host/deployment recovery. These retain the original broader qualification obligations; they are postponed, not canceled.

Catalog latency or forbidden reads may be promoted narrowly if they block an LC row. Do not use the prior five-user smoke failure as automatic authorization for a general cache/RBAC redesign.

## 8. Proposed bounded continuation — coordinated customers through weekly closure

Owner selected approach A and approved this short design ("Duyệt", followed by explicit document approval). Finish each missing business branch before another aggregate acceptance attempt.

**Intent:** complete the missing tail of LC-06 into LC-08/09 for BOTH actual customers, not merely produce more passing tests. Existing coordinated owner stops after each member's first-date issue history; it explicitly does not establish weekly closure.

**Approaches:** A — extend the existing coordinated owner through each customer's remaining dates, Chef output and Manager completion (Owner selected; reuses exact group members and independent oracles). B — survey more UI actions before completing branches (not selected; broadens discovery while leaving terminal proof missing). No new suite/framework or alternative qualification program.

**Flow and success:** retain both real batch/customer IDs after the existing stale-member rollback, successful coordinated issue and exact replay. For each same batch, Warehouse issues only remaining applicable positive requirements through current FE controls; never issue the already supplied date twice. Chef views and downloads CSV/XLSX for that customer's exact batch; parse actual bytes and customer/week/content, assert no stock/state effects. Manager completes that same batch through FE, reloads and checks COMPLETED; history/report/export must agree with independently persisted issue identities and quantities and exclude the other customer. Both members must independently reach the terminal endpoint; one member's success never stands in for the other. Preserve any supported shortage/overage blockers rather than bypassing them.

**Implementation boundary:** existing `g5-async-timeout.spec.ts` coordinated case owns this continuation; reuse existing workflow, stock and export-reading patterns. Keep existing public helper signatures. Product edits are conditional on an actual failing user operation, at its existing owner, with a regression. Test/harness corrections require evidence that the expectation or completion boundary was wrong; do not weaken assertions. No speculative production changes or test-only exports.

**Constraints/non-goals:** same campaign `20261103t101725z_407a6d`, same retained database, real actors and headed browser, one worker/maxFailures1, existing case/global/login budgets unchanged. No extra master/stock/BOM fixtures, main writes, installs, delegation, commit, deployment, quantitative phase, Finish/Abort or automatic full acceptance retry. Preflight ownership/storage before runtime; unknown usage or resource mismatch stops. Existing proof artifacts remain immutable. General continuation does not authorize arbitrary trace retirement.

**Builder calls:** serialize the two member tails for clear attribution, not as a five-user throughput claim. Use actual applicable dates/line IDs from each batch rather than assumed counts; report terminal and file evidence per member. First review the existing420000ms case budget against the added work; if it cannot fit, ask for the exact bounded case-budget/partition decision rather than raising it or silently doubling workflows. Implementation plan follows approval of this short design, within the existing R5/parent Task4; WORK remains the sole progress owner.

## 9. Safety and non-goals

One native writer, inherited dirty feature workspace; no implicit delegation/worktree/install/stage/commit/push/deploy. Main read-only, completed migrations never repeated. Only governed exact-run disposable clones/principals and private artifacts; no fixture stock/receipts, FK bypass or timestamp manipulation. Separate headed browser. No secrets in docs/logs. Source/candidate/cleanup readback mandatory.

No UI redesign, purchasing/returns/kitchen-ack implementation, global refactor, whole-repo test purge, new state tracker or automatic quantitative continuation. Docs creation alone makes no new runtime claim.
