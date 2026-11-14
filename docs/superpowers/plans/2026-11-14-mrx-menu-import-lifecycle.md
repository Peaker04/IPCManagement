# MRX Menu Import Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This repository currently forbids unprompted subagents. Steps use checkbox (`- [ ]`) syntax for tracking; `.planning/WORK.md` is the only mutable task-state owner.

**Goal:** Admit new and pre-READY MRX menu imports by customer/week, and route finalized batches to source editing without allowing a file reimport to mutate them.

**Architecture:** Keep `WeeklyMenuImportService` as the import admission owner and `MrxSourceChangeApplier` as the transactional mutation owner. The MRX workbench reflects the same lifecycle but backend checks remain authoritative. Reuse the current source-edit grid, role approval, preview token and day-lock facilities.

**Tech Stack:** ASP.NET Core/.NET 10, EF Core, xUnit, React/TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-mrx-menu-import-lifecycle-design.md`

## Global constraints

- Preserve inherited dirty files and DEFAULT/MRX mode isolation. No source DB writes, package install, deployment, new styling tokens or new production fixtures.
- Do not commit automatically: this checkout contains unrelated inherited work. Record progress in `.planning/WORK.md` only.
- Before changing `.tsx`, emit the AGENTS scoped UI gate block. Load project test-audit, UI-review, code-review and verification skills at their respective gates.
- `READY` closes file reimport; direct edit continues on open dates; any linked issue closes file reimport even if the batch status is inconsistent.

## Review focus

- A coordinator submits a DRAFT reimport, then the batch becomes READY before approval: approval rejects with no mutation (Task 1).
- A file preview succeeds in DRAFT, then the batch becomes READY or gets an issue before commit: commit rejects with no mutation (Task 1).
- An identical file after READY is still refused as an import; no-op does not bypass lifecycle admission (Task 1).
- A direct `?action=import` URL or an already-open modal on a closed current week cannot submit that week; another week remains selectable (Task 2).
- A stale or temporarily missing batch response does not display an enabled current-week import action (Task 2).

---

### Task 1: Backend import admission and atomic boundary

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxSourceChangeApplier.cs`
- Modify: `backend/src/IPCManagement.Api/Exceptions/MrxSourceChangeException.cs` only if a distinct stable conflict code is needed; reuse the existing exception response shape.
- Test: `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportBatchTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/MrxSourceChangeApplierTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/MrxSourceChangeErrorContractTests.cs` if a new code is added.

**Interfaces:** `PreviewPreparedAsync(WeeklyMenuImportPlan, Customer, decimal, CancellationToken)` and `CommitPreparedSingleAsync(PreparedWeeklyMenuImport, string?, IReadOnlyCollection<string>, CancellationToken)` retain their signatures. `MrxSourceChangeApplier.ApplyAsync(..., string applyMode, long? expectedBatchVersion, ...)` remains the approval/commit transaction entry. The admission result is an existing structured HTTP 409 with clear Vietnamese guidance to use source editing.

- [ ] Add failing tests with a realistic DRAFT batch and no linked issue: Admin/Manager reimport applies, Coordinator submits for review, batch recomputes and audit lineage is retained. Use an explicit test-fixture option instead of repurposing the current `IN_PROGRESS` + issued-day scenario.
- [ ] Run `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter FullyQualifiedName~WeeklyMenuImportBatchTests` and confirm the new positive tests fail for the intended behavior.
- [ ] Add failing tests for READY, TRANSFERRED, IN_PROGRESS, COMPLETED and inconsistent DRAFT+issue at preview and commit, including an identical file. Assert zero new menu versions, amendments, revisions and deltas on rejection. Replace old `IN_PROGRESS` reimport-success expectations with rejection tests; keep day-lock behavior tests under direct edits.
- [ ] Add a failing transition test: preview in DRAFT, advance to READY or add a linked issue, then commit. Add another: Coordinator submits in DRAFT, advance to READY, then approval. Assert no persistence and stable conflict response.
- [ ] At `WeeklyMenuImportService.AnalyzeMrxReimportAsync`, read the scoped batch and issue authority before diff classification, reject closed scopes even for identical files, and keep the existing tier/catalog/structure checks for admitted DRAFT imports. Recheck in commit after ticket validation.
- [ ] Inside `MrxSourceChangeApplier.ApplyCoreAsync`, under its serializable transaction, reject `applyMode == REIMPORT` when the loaded batch is no longer DRAFT or has any linked issue. Leave DIRECT and APPROVED_REQUEST day-level rules unchanged. Preserve stale-version behavior and rollback of pending coordinator requests.
- [ ] Run focused backend tests GREEN, plus `MrxSourceChangeApplierTests`, `MrxSourceChangeErrorContractTests` and the existing import controller contract tests. Confirm no skipped test was counted as proof.

### Task 2: MRX workbench action and recovery

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Modify: `frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx` only if its existing action props cannot express the chosen label and destination.
- Modify: `frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx` or `frontend/src/features/weekly-menu/hooks/useWeeklyMenuImportItems.ts` only for modal state/recovery required by a reproduced test.
- Test: `frontend/src/__tests__/WeeklyMenuMrxScope.test.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx` for the existing import dialog behavior.

**Interfaces:** Use existing `batch.status`, `source`, `isPending`, `currentWeekStartDate` and `?action=import` semantics. Current-week import is offered only for no batch or clean DRAFT; when closed, the import entry targets a new week and the existing source-edit control remains visible for open days. Do not add a duplicate editor or styling authority.

- [ ] Emit the Scoped Pre-Code UI Gate Block for `/weekly-menu?view=mrx-batch`: work object `OperationalFrame`, mode `MATERIAL_RECONCILIATION`, `ActionGuard` permissions, six UI states and project D6/D7/T7/T8/M1.2/N6 pledges.
- [ ] Add failing render/interaction tests for no source, no batch with source, DRAFT, READY, TRANSFERRED, IN_PROGRESS and COMPLETED. Assert current-week import availability, new-week entry and visible “Chỉnh sửa món” or read-only state as applicable.
- [ ] Add failing tests for direct `?action=import`, stale/loading scope, a status refresh while the modal is open, and HTTP 409 from the import API. The closed current week must not submit; the file/draft remains available for choosing another week where safe.
- [ ] Update the MRX workbench action routing and modal scope input at their existing owners. Distinguish current-week import from new-week import without relying on a disabled button alone. Keep backend 409 as the final race guard.
- [ ] Run the focused WeeklyMenu suites GREEN and run `operationalPageContracts.test.ts`/`*.contract.test.tsx` if present; if absent, record that fact and run the nearest available route/interaction contracts. Review focus, keyboard access, pending/denied/error states and text density against `.pi/skills/ipc-ui-review/SKILL.md`.

### Task 3: Contract alignment and final verification

**Files:**
- Modify: `docs/domain/weekly-menu.md`
- Modify: `docs/domain/material-reconciliation.md`
- Modify: `.planning/WORK.md` for actual evidence and final IDLE state.

**Interfaces:** Document READY as the whole-file import boundary and the first issue as the day-level direct-edit lock. Keep `DOM-MODE-1`, role ownership, snapshot immutability, group import and completed read-only rules explicit.

- [ ] Update the two bounded domain contracts. Remove wording that still permits REIMPORT in READY/TRANSFERRED/IN_PROGRESS; retain direct/approved source-edit rights on open dates.
- [ ] Run backend build and relevant tests, frontend lint/build and WeeklyMenu/contract tests. Run `git diff --check`. Do not launch local database campaigns or assume MySQL/live-browser proof from unit tests.
- [ ] Review the whole diff for all callers of import admission and `REIMPORT` apply mode, errors, authorization, no-op/retry, and preview-to-commit races. Verify inherited changes are not attributed to this task.
- [ ] Report PASS/FAIL/NEEDS_EVIDENCE/BLOCKED per approved state, update `.planning/WORK.md` and return its task status to IDLE. Report any MySQL/browser gate that could not be run separately from local test success.

## Self-review

All approved states map to Task 1 admission and Task 2 action tests; Task 3 aligns both contracts. The five review-focus risks are assigned to an owning task. No new component family, endpoint, database migration or test-only production seam is required. Execution remains separate from this plan handoff.
