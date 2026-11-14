# MRX menu and BOM session retest implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to perform this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan authorizes no database mutation by itself.

**Goal:** Retest the MRX menu import lifecycle, missing-BOM recovery, ingredient identity and BOM preview UI on one frozen candidate, then issue a case-by-case verdict backed by reproducible evidence.

**Architecture:** Run cheap source and contract gates first, isolated browser layout checks second, then scoped API/MySQL workflows only on a specifically authorized disposable target. Keep fixture, functional and operational evidence separate. Review artifacts against source/build hashes, HTTP results, database before/after facts and cleanup receipts.

**Tech Stack:** .NET 10/C#, EF Core 9/MySQL, React/TypeScript, Vitest, Playwright, PowerShell evidence runner.

**Spec:** [MRX menu lifecycle](../specs/2026-11-14-mrx-menu-import-lifecycle-design.md), [BOM and ingredient recovery](../specs/2026-11-14-mrx-menu-bom-ingredient-recovery-design.md), [identity and scope hardening](2026-11-14-bom-identity-scope-hardening.md), `docs/domain/material-reconciliation.md` BR-MRX-EDIT-1..9, `docs/DOMAIN.md` BR-GLOBAL-01..04 and NFR-PERF-02.

## Global constraints

- Preserve the inherited dirty tree and empty index; fingerprint **all** candidate files, including untracked files, so HEAD alone is never treated as the tested source.
- `DEFAULT != MATERIAL_RECONCILIATION` (`DOM-MODE-1`). Shared catalog data does not authorize cross-mode workflow, stock or audit writes.
- No source-database mutation, package installation, deployment, test weakening, fabricated production evidence or deletion of existing evidence. A future MySQL run needs its own current scope and disposable target authorization.
- `.planning/WORK.md` remains the only task-state owner. Evidence under ignored `.artifacts/` is a run receipt, not a second task tracker.
- The existing `npm run verify` excludes MySQL integration/evidence-owned tests. A green core suite cannot qualify persistence or concurrency.

## Review focus

1. A clean DRAFT batch whose status changes to READY between preview and commit, or between coordinator request and approval: reject the whole import atomically, with unchanged menu and revision checksums (Task 2 and Task 4).
2. A DRAFT batch already linked to an issue despite inconsistent status: reject whole-file import; permit edits only on unissued dates (Task 2 and Task 4).
3. Many missing BOMs, including a dish outside the selected MRX week: MRX template covers only the selected source dates; general catalog template still permits the out-of-scope dish (Task 3 and Task 4).
4. Two concurrent blank-code rows or API creates for the same case-folded name and unit: never silently create two active ingredients; report a failing database race as FAIL, not as a qualified PASS (Task 3 and Task 4).
5. An Excel preview with >50 rows and late warnings/errors at 1024 px and high zoom: row number, dish code and header stay visible, and every diagnostic remains reachable (Task 3).

## Existing evidence audit, 2026-11-14

| Claim | Evidence found | Current verdict and limit |
| --- | --- | --- |
| Core build, lint and tests before final T7 UI repair | `.planning/WORK.md`: `npm run verify` passed 49 Application, 1550 API and 693 frontend tests | **PASS for that earlier source state**; rerun on frozen final candidate. It excludes live MySQL. |
| T7 BOM Excel preview repair | `.artifacts/bom-t7-sticky-final/.last-run.json` passed; 1440 and 1024 screenshots below; browser geometry and `elementFromPoint` checks; focused tests 25/25, FE build/lint and diff check recorded in `WORK.md` | **PASS fixture/UI level**. HTTP is mocked; no database or live-role proof. |
| MRX current-week reimport at DRAFT and closure at READY | `.artifacts/mrx-evidence/20261113t202208z_b018ab/qualification-phases.json` functional PASS and `playwright-functional/.last-run.json` passed; `@G6-Menu-Reimport` asserts REIMPORT revision, 409 `MRX_REIMPORT_CLOSED`, unchanged checksum after READY | **PASS bounded functional slice**. No aggregate `status.json` or `cleanup.json` in this run; not operational qualification. This single test does not cover all lifecycle cells. |
| Earlier MRX evidence attempt | `.artifacts/mrx-evidence/20261113t201526z_62f2f3/status.json`: FAIL, `cleanupCompleted: false` | **FAIL historical attempt**. Its images cannot be promoted to PASS. |
| BOM scope, DRAFT/PUBLISHED identity and ingredient case-folding | Owner tests and full core suite recorded in `.planning/WORK.md` | **PASS automated/source level**; live API/MySQL write and reload remain **NEEDS_EVIDENCE**. |
| Concurrent ingredient identity | No audited MySQL unique key or concurrent-create receipt | **NEEDS_EVIDENCE / known design gap**. A new race test may establish **FAIL** and require a separate fix before acceptance. |

Visual evidence with checked SHA-256:

- `.artifacts/bom-t7-sticky-final/browser-mrx-menu-remediati-51313-ion-and-six-day-preparation-chromium/BROWSER_FIXTURE-bom-preview-scrolled-1440.png` — `E7EC0F01A96DDF8DC854FCF5A90189E7B07AC7DD3398C71BACB6BCE228E083E9`.
- `.artifacts/bom-t7-sticky-final/browser-mrx-menu-remediati-51313-ion-and-six-day-preparation-chromium/BROWSER_FIXTURE-bom-preview-scrolled-1024.png` — `FE95067B2E0F7EBAA42007D97D4851D1E014AFEA923D17AE10C812283C7AF571`.

## Case matrix and acceptance oracle

| ID | Scenario | Required result and proof |
| --- | --- | --- |
| M1 | New customer/week with no menu | Import preview and commit succeed; correct week/customer/version; no fabricated servings. |
| M2 | Existing menu, no batch | Same-scope reimport supersedes permissible draft/projection; downstream/irreversible guards still reject unsafe replacement. |
| M3 | DRAFT batch, no issue | Same-scope import creates one REIMPORT source revision, recomputes permitted projections; identical file is idempotent; coordinator request needs approval. |
| M4 | READY, TRANSFERRED, IN_PROGRESS, or any linked issue | Preview, commit, and delayed approval reject with `MRX_REIMPORT_CLOSED`; no menu/amendment/revision/batch delta; open-day direct edit remains available, issued day locked. |
| M5 | COMPLETED | Current-week import and edit rejected; history intact; another new week may be selected. |
| M6 | Cross-cutting | Group file rejects unsafe member atomically; role and mode gates hold; preview token/state race rejects; DEFAULT workflow and physical stock unaffected. |
| B1 | Menu contains one or many missing BOMs | Source diagnostic names actual dishes; batch creation blocked; manual editor or contextual Excel route available; source refresh after BOM save clears only resolved gaps. |
| B2 | Contextual versus catalog template | MRX template uses selected customer, week, version, tier and real service dates; catalog template can include unrelated dishes and global fallback. |
| B3 | Excel preview, correction, reupload, commit | Invalid preview writes nothing; late row warnings/errors reachable; one valid commit creates the intended BOM/ingredient only; reload matches; repeat is idempotent. |
| B4 | BOM identity and frozen facts | Same-start DRAFT updates one row; PUBLISHED exact repeat skips, changed same-start rejects; ambiguous legacy rows block; frozen MRX contributor/history stays unchanged. |
| I1 | Ingredient identity | Blank code auto-generates; same name+unit across case variants reuses one active ingredient; ambiguous matches and duplicate API create/rename block; inactive codes stay reserved. |
| I2 | Concurrent ingredient creation | Two independent connections for the same normalized name+unit yield at most one active row; prove by DB query. This is currently unqualified and may expose a defect. |
| U1 | BOM preview UI | At 60+ rows and 1440/1024 px, two-axis scrolling preserves header, row number and dish code; warnings/errors, keyboard focus and primary action remain usable; inspect high zoom separately. |

## Task 1: Freeze candidate and rerun source gates

**Files:** Read `docs/DOMAIN.md`, `docs/domain/{weekly-menu,material-reconciliation}.md`, the three linked specs/plans, changed owners and tests. Write a run-owned manifest only under `.artifacts/`; update `.planning/WORK.md` at close.

- [ ] Record `git status --short --branch`, `git rev-parse HEAD`, `git diff --cached --name-only`; hash tracked modifications **and untracked candidate files** plus build outputs. Record mode, actor/role, UTC time and test tool versions without secrets.
- [ ] Run `npm run verify` on the frozen source. Expected: all quick gates, BE/FE builds, lint, dependency/architecture checks, 49 Application/API/frontend suites PASS; record actual counts, not the historical counts above.
- [ ] Run `git diff --check`, review relevant source diff, and check test fixtures against actual C# DTOs. Do not pad allowlists or mock the component under test; record coverage by M/B/I/U ID.
- [ ] If a gate fails, retain the failure receipt, identify source ownership and repair under a separate authorized implementation step before a new frozen run.

## Task 2: Menu lifecycle and mode boundary

**Files:** `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportBatchTests.cs`, `backend/tests/IPCManagement.Api.Tests/MrxSourceChangeApplierTests.cs`, `frontend/src/__tests__/WeeklyMenuMrxScope.test.tsx`, `frontend/tests/e2e-mrx/specs/mrx-menu-reimport-lifecycle.spec.ts`.

- [ ] Map M1–M6 to named owner tests; add a regression only for an uncovered contract, with a failing assertion first. Especially pin READY between preview/commit, pending approval after READY, DRAFT-with-issue, group atomicity, actor differences and DEFAULT isolation.
- [ ] Run focused backend tests: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~WeeklyMenuImportBatchTests|FullyQualifiedName~MrxSourceChangeApplierTests"`. Expected: all selected cases PASS and the test count is recorded.
- [ ] Run focused frontend tests with the locally installed Vitest: `npm exec -w frontend -- vitest run src/__tests__/WeeklyMenuMrxScope.test.tsx src/__tests__/WeeklyMenu.test.tsx`. Expected: current-week versus new-week actions, guards and error states PASS.
- [ ] For live qualification, capture M1–M6 HTTP status/body plus before/after row counts or checksums for menu, amendment, source revision/delta, batch and issue tables. A screenshot or 409 alone does not prove atomicity.

## Task 3: BOM, ingredient and preview contracts

**Files:** `backend/tests/IPCManagement.Api.Tests/{DishCatalogTests,DishBomImportServiceTests,IngredientIdentityTests}.cs`, `frontend/src/__tests__/{DishBomBatchImportPreview.contract.test,DishBomBatchImportModal.test,DishBomEditorModal.test,AdminData.test}.tsx`, `frontend/tests/browser/mrx-menu-remediation.spec.ts`.

- [ ] Map B1–B4 and I1–I2 to named tests. Pin both MRX contextual and general catalog template exports, case variants, ambiguous matches, blank-code reuse, DRAFT/PUBLISHED same-start behavior and frozen-history preservation. Record any absent test as NEEDS_EVIDENCE.
- [ ] Run focused backend tests with `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~DishCatalogTests|FullyQualifiedName~DishBomImportServiceTests|FullyQualifiedName~IngredientIdentityTests"`; record selected/passed counts.
- [ ] Run focused frontend contracts with `npm exec -w frontend -- vitest run src/__tests__/DishBomBatchImportPreview.contract.test.tsx src/__tests__/DishBomBatchImportModal.test.tsx src/__tests__/DishBomEditorModal.test.tsx src/__tests__/AdminData.test.tsx`. Confirm error/retry, permission denied, loading/empty/partial, focus return and no accidental BOM write.
- [ ] Run the isolated `frontend/tests/browser/mrx-menu-remediation.spec.ts` preview case with the project's Playwright config and an ignored run-owned video-off override if the installed ffmpeg is still absent. Capture 1440×900, 1024×768 and 200% zoom; assert `elementFromPoint`, table geometry, no clipped diagnostic, keyboard access, and inspect each image visually. Mark mocked HTTP images `BROWSER_FIXTURE`.
- [ ] On an approved disposable MySQL target only, submit two concurrent same-name/unit create requests through separate API connections, then query active rows. Expected I2 oracle: count ≤1. A duplicate count is a **FAIL requiring a database/transaction fix**, even if sequential unit tests pass.

## Task 4: Scoped live API/MySQL workflow and evidence integrity

**Files:** `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`, `frontend/tests/e2e-mrx/specs/mrx-menu-reimport-lifecycle.spec.ts`, any new scoped E2E cases under `frontend/tests/e2e-mrx/specs/`; no source or production DB writes.

- [ ] Confirm current authorization for an exclusively disposable target and the exact database/credential file; inspect the runner's clone/drop behavior. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 -Mode Preflight -Profile Qualification -Diagnostic MenuReimport` only after those preconditions are met. Expected: `READY` without mutation.
- [ ] Run the scoped `MenuReimport` diagnostic on that target; include the added M/B/I cases in a bounded diagnostic or separately identified run. A generic `@G6-Menu-Reimport` PASS only certifies its one existing test; it cannot certify BOM or all five menu states.
- [ ] For each accepted write, pair HTTP response with database state and a fresh page reload. For each rejection or invalid preview, prove zero unintended rows/revisions and unchanged stock/source facts. Check role tokens and `X-Operational-Mode` at the API boundary.
- [ ] Require `candidate-source-manifest.json`, `build-manifest.json`, source-before/after manifests, per-test result, final `status.json` and cleanup receipt. Confirm disposable DB and helper processes are absent after the run. A functional phase PASS without final status/cleanup remains bounded evidence only.

## Task 5: Review and publish verdicts

**Files:** `.planning/WORK.md` only for task state; run receipts under `.artifacts/`.

- [ ] Build an evidence index by M/B/I/U ID: source hash, test command/result, request/response, DB oracle, actor/mode, viewport, screenshot SHA-256, cleanup status. Preserve failed and RED artifacts with their true labels.
- [ ] Review against `.pi/skills/ipc-test-audit/SKILL.md`, `.pi/skills/ipc-ui-review/SKILL.md`, `.pi/skills/ipc-code-review/SKILL.md` and impeccable for FE. Report `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact`.
- [ ] Report **PASS / FAIL / NEEDS_EVIDENCE / BLOCKED per case**. Do not report whole-session or MRX operational PASS while I2 or final cleanup/source manifests remain open. Update `.planning/WORK.md` and return its current task to IDLE.

## Self-review

M1–M6 cover the approved five-state import matrix and role/mode/race behavior; B1–B4 cover manual and bulk BOM recovery across MRX and catalog scope; I1–I2 cover sequential and concurrent identity; U1 covers the final visual fix. The current evidence cannot establish live BOM writes, ingredient concurrency or full operational qualification; those are explicit execution gates, not inferred successes.
