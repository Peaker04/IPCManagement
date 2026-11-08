# MRX Session/Draft Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans, natively in the parent session. No delegation is authorized. Checkboxes are planning instructions; `.planning/WORK.md` is the sole live task ledger.

**Goal:** Align G5 with the approved401 purge policy while preserving valid-session draft isolation, real no-write denial and exactly-once fresh submission, then resume the existing bounded MRX diagnostic.

**Architecture:** Extend the existing transport cleanup owner test and reorder the existing G5 session workflow. Production auth/draft code stays unchanged. Reuse the current clone runner, API pacing, stock oracle and ordered dependency gates.

**Tech Stack:** Installed TypeScript/Vitest/Playwright, PowerShell, Release .NET API and disposable MySQL targets; no new dependency.

**Spec:** `docs/superpowers/specs/2026-11-05-mrx-session-draft-boundary-design.md` (owner-approved). Parent coverage plan: `docs/superpowers/plans/2026-11-05-mrx-import-integrity-performance.md`.

## Global Constraints

- Native/direct-parent execution only. No delegation, worktree, stage/commit/deploy, installs, main DB writes, migrations, extra master provisioning, user-service replacement or historical clone/credential/profile reuse.
- Preserve DEFAULT != MATERIAL_RECONCILIATION and the inherited dirty tree. Only the two test owners below and existing evidence/WORK documents change.
- Preserve production `api/client.ts`, `store/clearSessionState.ts`, `hooks/useClientDraftPersistence.ts` and warehouse draft hooks. An apparent need to modify these requires reassessment, not silent scope expansion.
- No timeout/rate-limit weakening, mocked real commits, fabricated post401 drafts, skips/exemptions, replacement test-only exports or dependency-gate bypass.
- Approval to execute this plan admits one fresh Qualification/MenuIntegrityPerformance Preflight→Execute: main read/snapshot only, fresh absent run-owned clone/subordinate, declared five actors/workbooks/business transactions only there, dedicated browser/ports, and exact owned cleanup. Stop on failure; no automatic campaign retry.
- No whole-MRX/NFR acceptance from selected PASS. Rectangular/group/reimport/negative/independent numeric-export gaps remain obligations of the parent plan.

## Review Focus

1. Pre-forward abort is not committed-response loss: preserve separate real no-write vs exact replay owners (Tasks2–3).
2. Copying an actual draft must not offer it to another actor (Task2, before401).
3. A source-version mismatch must block restore without manufacturing a server write (Task2, before401).
4.401 must erase draft storage, not merely hide its button; late old-session response protection remains covered (Task1 and distinct browser flow in Task2).
5. Re-login must not replay the old2.75 draft or submit automatically; require a distinguishable fresh1.5 input and exactly one durable command (Task2).

## Ownership

| Owner | Change |
|---|---|
| `frontend/src/__tests__/ApiContracts.test.ts` | Extend existing `purges session-owned caches when the transport expires authentication` case; no duplicate cleanup test. |
| `frontend/tests/e2e-mrx/specs/g5-async-timeout.spec.ts` | Correct existing `@G5-Session` case ordering/assertions/evidence; retain its tag and240000ms cap. Other G5 cases remain unchanged. |
| `docs/reviews/2026-11-05-mrx-import-integrity-performance-execution.md`, `.planning/WORK.md` | Record approved policy, fresh evidence/verdicts, cleanup and remaining gaps. |

### Task1: Protect draft purge at the real transport boundary

**Interface:** Consume existing `getDraftStorageKey(formKey: string, userId?: string | null): string` from `frontend/src/hooks/useClientDraftPersistence.ts` and real `apiClient<T>` plus `offlineMutationQueue` from `frontend/src/store/offlineMutationQueue.ts`; produce stronger assertions in the incumbent case, no new production interface.

- [ ] In the existing401 case, seed `ipc_v3_token='expired-session'` and an MRX-shaped local draft using `getDraftStorageKey('mrx_initial_batch_day', 'actor')` and `{ version:1, quantities:{ line:'2.75' }, reasons:{} }`. Assert it exists before transport; the existing HTTP401 stub is the only mocked boundary. Do not mock cleanup or draft helpers.
- [ ] In that same case, enqueue one bodyless logout command through existing `offlineMutationQueue.enqueue` and assert it is present before transport; never flush/execute the queue. After the real `apiClient` rejects with401, add `expect(localStorage.getItem(draftKey)).toBeNull()` and `expect(offlineMutationQueue.getAll()).toEqual([])` alongside existing token/server-cache/query-cache purge assertions. Retain the existing old-session response case unchanged.
- [ ] Run from `frontend`: `npx --no-install vitest run src/__tests__/ApiContracts.test.ts src/__tests__/Auth.test.tsx tests/e2e-mrx/fixtures/__tests__/authHelpers.test.ts`. Require all selected tests PASS, no added skips. This is coverage of already-correct production behavior: expected GREEN on unchanged production, not a claim of a new product regression fix. Do not damage production to manufacture RED; preserve the historical G5 failing run as the old-contract baseline.

### Task2: Separate recovery within a session from fresh entry after401

**Interface:** Consume Task1's approved cleanup contract; existing `createTransferredBatch`, `respectApiBudget`, `respectLoginBudget`, `MySQLVerifier.captureStockSnapshot` and `assertStockDelta` remain real owners. Produce the same `@G5-Session` selection and existing evidence paths with unambiguous phase fields.

- [ ] Rename the incumbent case to `@G5-Session Valid-session draft recovery is scoped; 401 purges it and reauthentication requires fresh entry`; keep its240000ms budget. Keep real setup, pre-forward abort, disabled resubmit and zero issue/receipt/version/stock-change assertions.
- [ ] Move the existing saved-draft lookup, cross-actor denial, stale-version denial and original-snapshot explicit restore **before** token removal. Use the actual pre-submit snapshot; retain repeated reload→explicit restore of2.75. Require the selected ingredient editor visible and the intended batch/date URL loaded before each negative restore assertion, so loading/denial cannot masquerade as isolation. Reuse `respectApiBudget` before added navigation/recovery clusters; never inject a saved snapshot after401.
- [ ] Submit with the genuinely removed browser token to the unmodified server. Require actual401 and login redirect; assert saved draft key absent and existing issue/receipt/version/stock invariants unchanged. Retain precommit-command receipt absence as well as denied-command receipt absence.
- [ ] Reauthenticate using the current run's Thủ kho credentials and existing login budget. Navigate/reload the same scope; require absent draft storage and zero restore offers, no issue/receipt/version/stock change and no successful automatic issue submit.
- [ ] Use `Điền đủ toàn bộ`, then explicitly fill the selected ingredient with fresh quantity `1.5` (distinct from the old2.75). Declare expected quantities from the pre-action frozen daily lines, replacing only the selected quantity with1.5; do not derive expected values from the create response. Submit once through UI; require201, a command ID distinct from aborted/denied commands, one matching durable receipt/issue, version increased once and exact persisted issue-line quantities, including selected1.5.
- [ ] For all issued ingredients require canonical unit identity and `assertStockDelta(opening, closing, { issuedBaseQty, receivedReturnBaseQty:'0', provisionedBaseQty })`. Reuse the existing G5 micros calculation for independently required provision `max(issued-openingStock,0)`; preserve known-lot consumption/retained movements. Reload; require history1/committed readonly UI and no additional command or stock/version change. Leave duplicate replay proof to the two existing G5 recovery cases.
- [ ] Emit `precommit-transport-no-write.json` and `session-recovery-result.json` only after their assertions pass. Distinguish `draftRestoredBefore401`, `draftPurgedOn401`, `restoredAfter401:false`, `freshQuantity:'1.5'`, observed command/issue IDs and no-write/exactly-once proof. Rename the misleading post-session-restored screenshot to reflect purge/fresh entry; keep private evidence local.
- [ ] Run from `frontend`: `npx --no-install eslint src/__tests__/ApiContracts.test.ts tests/e2e-mrx/specs/g5-async-timeout.spec.ts` and `npx --no-install tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --types node --esModuleInterop --skipLibCheck --strict tests/e2e-mrx/specs/g5-async-timeout.spec.ts`. Require exit0, then rerun Task1's focused tests. Source-review that production owners and existing G4/G5 recovery assertions were not changed; static checks alone do not certify G5.

### Task3: Fresh diagnostic and evidence-based handoff to parent plan

**Interface:** Consume Task2's unchanged `@G5-Session` tag and current `Get-MrxMenuIntegrityPerformancePhases`; produce actual phase results, manifests and cleanup receipts through the existing runner, not a new campaign format.

- [ ] Verify current HEAD/staging/inherited changes, prior cleanup and free owned5174/5263; preserve user5173/5262. Load ipc-code-review/ipc-ui-review and verification-before-completion; perform native author review, not an independent-review claim. No TSX/CSS edits or UI redesign are admitted.
- [ ] From repo root run `powershell.exe -NoProfile -NonInteractive -File scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 -Mode Preflight -Profile Qualification -Diagnostic MenuIntegrityPerformance`. Require READY and no missing migration/master prerequisite; never repair prerequisites by update/provisioning.
- [ ] Run the same command with `-Mode Execute`. Freeze the candidate for the entire run. Require ordered core four-menu functional gate → adversarial G4/both G5 response-loss/G5 session/G6 direct gate → data-path-performance. The runner owns dedicated Release API/production FE and fail-fast cleanup; do not invoke legacy `Session` diagnostic (its migration policy is outside this scope).
- [ ] If a phase fails, preserve exact first divergence/trace/status and stop dependent phases. Do not edit while running, increase budgets or automatically retry. A new product/auth-policy requirement must be reported for scope reassessment.
- [ ] Read status plus the later authoritative `cleanup.json`, source-before/after rows/checksums/schema/migrations, candidate-before/after and listener ownership. Require completed owned cleanup/no errors, unchanged main/candidate and preserved user processes. Report any inconsistency without rewriting failed status.
- [ ] Update the existing report and WORK with per-phase/case PASS/FAIL/BLOCKED/NEEDS_EVIDENCE, actual timing sample counts/null readiness markers and remaining parent-plan gaps. No NFR PASS without comparable samples/authoritative markers; no independent numeric Chef export claim from CSV/XLSX equality alone. Verify scoped `git diff --check`, paths and empty staging; close IDLE.

## Plan self-review and execution handoff

Spec contracts map to Task1's transport boundary, Task2's browser/DB workflow and Task3's unchanged committed-replay/dependency/safety owners. No production fix is presumed, no second owner suite or draft feature added. Fresh1.5 is a builder choice to distinguish manual entry from the previous2.75 draft. This plan only unblocks/resumes the selected diagnostic; it does not implement all outstanding parent coverage. Review the plan before native execution; do not commit or launch a fresh campaign during planning.
