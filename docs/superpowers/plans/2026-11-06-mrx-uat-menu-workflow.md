# MRX UAT Menu Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, directly in the existing checkout. WORK is the sole live checklist; the task steps below are static instructions, not a second state owner. No subagents, commits or worktree creation are authorized.

**Goal:** Recover the correct draft week and fix the reported menu/servings/frozen-BOM/preparation/cooking usability without changing business facts or bypassing guards.

**Architecture:** Reuse the existing upload hook/modal, filtered paged history, preview tickets and MRX source-change owner. Refine existing workbench/Modal/SplitView surfaces; do not build another import wizard or global store. Backend owns draft eligibility, the hook owns asynchronous input identity, and field-local presentation owns recovery feedback.

**Tech Stack:** .NET/EF Core, React/TypeScript, existing Vitest/Testing Library, xUnit, existing workbench/UI primitives; native Web Crypto SHA-256.

**Spec:** `docs/superpowers/specs/2026-11-06-mrx-uat-menu-workflow-design.md`.

## Global Constraints

- `DEFAULT != MATERIAL_RECONCILIATION`; preserve operation guards, permissions, actor approvals, locked days, completed batches, frozen facts and audit reasons.
- Supported tiers: exactly 25000/30000/34000 VND through MenuPriceTierPolicy/metadata; no silent fallback.
- Existing index and inherited dirty files are preserved. No staging/commit/install/schema/data mutation, process restart, relay change or delegation.
- WORK is the sole live ledger. Design/plan documents contain contracts, not execution status.
- All styling authority remains `frontend/src/styles/index.css`; reuse current token-backed utilities/primitives. D6 >=12px, D7 one primary, T7 sticky/frozen table identification, T8 36–40px ordinary/44px editable rows, M1.2 safe single blocking interaction, N6 unchanged.
- Backend commands: Release, `--no-restore -m:1 -p:UseSharedCompilation=false`. Measure resources and running-build locks before heavy commands; do not terminate owner processes to make a build pass.
- Source/self-review, mechanical detection and jsdom do not certify rendered geometry or authenticated persisted acceptance.

## Review Focus

1. Same filename with different bytes, renamed identical file, unsupported/legacy checksum: checksum/customer/tier identity, not a name or first history page (Task 1).
2. Old hash/history response after file/customer/tier change or manual week selection: cannot overwrite the new scope (Task 2).
3. Several matching weeks, paged history, read failure and cancel/reopen: no arbitrary selection, false empty or stale ticket (Tasks 1–2).
4. Explicit zero versus missing servings and a day locked during review: correct early admission without weakened apply-time guard (Task 4; retain server lock owner).
5. Daily frozen ingredient facts or variants with the same dish name: no destructive deduplication, cross-date rate sum or export-scope drift (Tasks 5–7).

## File map and boundaries

- Backend history: `backend/src/IPCManagement.Api/Features/SampleData/{Contracts/SampleDataImportDto.cs,Services/WeeklyMenuServiceContracts.cs,Services/WeeklyMenuImportHistoryService.cs,Controllers/WeeklyMenuImportsController.Queries.cs}`. Adds a filtered read to the existing GET, not a new action.
- Upload: `frontend/src/api/weeklyMenuApi.ts`, `frontend/src/features/weekly-menu/{hooks/useWeeklyMenuImportItems.ts,WeeklyMenuImportModal.tsx,WeeklyMenuImportPreview.tsx}`.
- Source/servings: `frontend/src/features/weekly-menu/{MrxBatchWorkbench.tsx,MrxSourceChangePanel.tsx,MrxSourceEditGrid.tsx,mrxSourceMatrixModel.ts,hooks/useMrxSourceEdit.ts}` and existing batch workspace action labels.
- Frozen read: `frontend/src/components/workbench/MrxBatchDishesModal.tsx`; keep `ReconciliationBatchQueryProjector.ListDishesAsync` semantics unchanged unless a demonstrated DTO defect requires a separately reviewed fix.
- Preparation: `frontend/src/features/warehouse/{MrxMultiCustomerPreparationWorkbench.tsx,branches/MrxPrepAllocationsBranch.tsx}`.
- Cooking: `frontend/src/features/chef/{MrxCookingWorkbench.tsx,branches/MrxCookingDishListBranch.tsx}`.
- Test owners: `frontend/src/__tests__/{MrxSourceEdit,WeeklyMenu,Warehouse,Chef,Reconciliation,ApiContracts}.test.tsx` (ApiContracts is `.test.ts`), `MrxSourceEditFoundation.test.ts`, and `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.ContractsAndProduction.cs`. Read complete affected cases before editing; no mock of the hook/component being tested.

## Task 1 — Authoritative, paged draft matching

**Interfaces:** Introduce `WeeklyMenuImportHistoryQueryDto` with nullable `CustomerId`, `FromDate`, `ToDate`, `SourceChecksum`, `PriceTierAmount`. Change the existing history service method to `GetWeeklyMenuImportHistoryAsync(WeeklyMenuImportHistoryQueryDto query, PagedRequestDto request, CancellationToken cancellationToken = default)`. Controller binds the same existing query keys plus optional `sourceChecksum` and `priceTierAmount`; existing ordinary history requests remain compatible.

When checksum is present, require a valid customer, 64-character hex checksum and supported tier. Normalize checksum to the persisted uppercase SHA-256 representation. Filter versions by exact customer/checksum, DRAFT status and actual nonempty draft schedules at the selected tier before Count/Skip/Take. Never hydrate all history to match in the browser. Return existing `WeeklyMenuImportHistoryItemDto` with truthful totalCount/CreatedAt/WeekStartDate; do not add a schema column or invent a mode discriminator absent from persisted data.

- [ ] Extend existing WorkflowGenerationTests history fixture with independently saved candidate and distractors: another customer, different checksum/same filename, superseded/published version and another tier. Assert only eligible draft weeks and exact totalCount across pages; read leaves persisted versions unchanged. Add focused invalid-filter request coverage at the controller boundary if service validation cannot prove HTTP rejection.
- [ ] Run `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj -c Release --no-restore -m:1 -p:UseSharedCompilation=false --filter 'FullyQualifiedName~WeeklyMenuImportHistory'`; observe intended pre-fix failure, not a setup failure.
- [ ] Implement at existing query owner; migrate the controller/interface and all three existing history test calls. Preserve ordinary date windows, batched rollback eligibility and paging query budgets.
- [ ] Repeat that command, then existing `WeeklyMenuImportsControllerContractTests`. Update installed-tool-generated OpenAPI/types only where public contract changes; no restore/npx download. Existing GET action/RBAC stay unchanged.

## Task 2 — Recover draft week within the existing field group

**Interfaces:** Extend `weeklyMenuApi.getImportHistory(customerId?, pageNumber=1, pageSize=20, draftMatch?: { sourceChecksum: string; priceTierAmount: number })` to send the new filters. The existing item hook exposes per-item match status/candidates/totalCount plus `chooseDraft(id, versionId)` and `enableWeekChange(id)`. Keep existing preview/commit API signatures and ordered multipart payloads.

Native `crypto.subtle.digest('SHA-256', await file.arrayBuffer())` identifies bytes. Resolution is triggered only with a file/customer/supported tier and automatic-week intent; an explicitly supplied existing reimport week must not be silently changed. Record request identity including item/revision and invalidate stale results. One match adopts its actual saved week; several require selection; none enables manual date entry. Recovery is read-only, never an automatic commit or rollback. Manual intent takes precedence over late responses.

- [ ] Extend the real importer owner in MrxSourceEdit.test.tsx using network-boundary responses shaped by the C# DTO: discard/reopen/reselect returns saved week; renamed equal bytes resolve identically; another customer does not; multiple matches require choice. Extend the existing stale-preview case to stale draft lookup and explicit “Đổi tuần”; prove no stale token or unintended commit.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/MrxSourceEdit.test.tsx --maxWorkers=1`; capture intended RED. Do not replace Web Crypto with a fake hash algorithm that implements the matching behavior being asserted; use independently known bytes/checksum.
- [ ] Announce and record the scoped pre-code UI gate in WORK. Implement hook/API state and the field-local composition in Spec §3. Reuse VietnameseDateInput helper/error association; readonly recovery value plus secondary “Đổi tuần”, not a banner, new card, second primary or extra dialog. Use existing file-input trigger/queue pattern; preserve real File and replace action without contradictory native “No file chosen”.
- [ ] Repeat importer and WeeklyMenu owners. Verify pending close/result guards, failure retry, history/rollback, group ordering/atomicity, no autoselection from a cancelled preview, and no browser-persisted new session store.

## Task 3 — Menu-oriented preview and coherent main composition

**Interfaces:** Keep `WeeklyMenuImportPreview` input as the real import result. Default view groups normalized rows by exact service date/shift/variant, preserving slot occurrences. Secondary “Chi tiết nguồn” exposes existing source coordinates and issues. Page complete date groups through the existing PaginationBar, not arbitrary slices that break a day's menu.

- [ ] Extend the current large-preview/duplicate-slot case to select a complete menu date group and reach its final dish. Assert actual duplicate occurrences and source diagnostics remain available; no test of exact classes or spacing.
- [ ] Run the focused importer owner RED; implement existing preview layout only. Reuse source-matrix model only if its real input contract fits; do not create dummy edit scope/servings to reuse a renderer.
- [ ] Refine MrxBatchWorkbench composition to Spec §4: scope, source readiness/batch lifecycle, source controls, matrix, next action. Do not add another lifecycle strip or duplicate menu under impact. Keep blockers and actions discoverable outside the grid.
- [ ] Verify WeeklyMenu and MrxSourceEditFoundation owners. For merge changes, add one semantic regression only if the changed algorithm puts merge/slot/locked boundaries at risk; preserve row/column spans rather than testing CSS alignment.

## Task 4 — Complete servings before the real impact transition

**Interfaces:** Existing `useMrxSourceEdit` exposes `missingServingsCount` and `firstMissingServing: { serviceDate: string; shiftName: string; variant: 'savory' | 'vegetarian' } | null` derived from applicable unlocked draft cells. `preview(): Promise<boolean>` refuses incomplete values, returns true only with an accepted impact result. The workbench awaits it before opening review. Reuse existing grid's real inputs for focus through matching data attributes/ref; no test-only export.

- [ ] Extend WeeklyMenu's existing persistent-source-matrix case: fill all but one cell, click continuation, stay in entry with missing cell identified/focused and no preview request; explicit zero is accepted. Fill the last cell and assert one actual preview request opens populated review. API failure keeps the draft with retry and no false review success.
- [ ] Run WeeklyMenu owner for intended RED; implement the shared draft completeness calculation, field error association, pending transition and preview guard. Remove duplicated calculations at the workbench if superseded.
- [ ] Refine initial-versus-adjustment wording in MrxSourceChangePanel using authoritative saved values; keep null distinct from zero, reason mandatory where the current source API requires it, and role-specific apply/submit actions. Return keeps draft/focus; edits invalidate previous result.
- [ ] Repeat WeeklyMenu and MrxSourceEdit. Retain existing locked-day/completed/role/409 tests and source-change backend owners. Change only the user-facing action label to “Lập lô đối soát”, not lifecycle status or backend semantics; copy alone needs no new test.

## Task 5 — Truthful frozen BOM grouping and Vietnamese schedules

**Interfaces:** Keep the current batch dish DTO. Its materials carry serviceDate/dailyLineId; scopes carry shiftName. Group material display by actual date and distinguish ingredient/unit identities; never reconstruct a material's shift from its date or collapse differing daily rates.

- [ ] Extend the existing Reconciliation/MRX frozen-dish modal case with the same ingredient on two service dates at different rates; assert separate date context and intact rates, truthful distinct ingredient count, and Vietnamese scope labels. No doubled per-serving rate or current master BOM fallback.
- [ ] Observe intended RED in `npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx --maxWorkers=1`, then implement at MrxBatchDishesModal using existing shift constants and a flat list/detail composition.
- [ ] Repeat the owner plus WeeklyMenu; retain permission/loading/lineage error/retry/empty behavior. Run existing ReconciliationKitchenExportTests only if any DTO/query change proves necessary; otherwise no backend projection change.

## Task 6 — Compact multi-customer preparation

- [ ] Read Warehouse's actual coordinated-issue tests in full. Preserve selected hidden batches, applicability, existing-issue disabled state, stock/outcome-unknown guard and export-only supplier filtering. Extend a selection/search case only if layout movement changes this interaction; pure spacing does not need a new test.
- [ ] Declare the warehouse UI gate, refine the existing compact selector/filter area and main grid/allocation detail using installed workbench primitives. Keep the existing command, confirmation and date scope; do not redesign stock transaction logic.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx --maxWorkers=1`. Check actual header/selection/grid space and empty/error state placement in the bounded rendered review; automated geometry claims are prohibited.

## Task 7 — Cooking master/detail without export or lineage drift

**Interfaces:** Preserve current DishGroup identity `(date, shift, variant, dishCode)` and whole-batch export URLs. Existing MrxCookingDishListBranch renders a selectable master and selected ingredient detail with SplitView; local selected key follows actual filtered groups. Totals remain based on unique meal scopes, not summed per dish.

- [ ] Extend Chef's existing variant/group/filter owner to select two real dish groups and see their respective exact ingredients/rates. Search/filter empty state cannot keep an unrelated old detail; whole-batch export remains unchanged. Update old all-dishes-at-once assertions only where the approved presentation intentionally changes that contract; retain their independent lineage/variant assertions.
- [ ] Observe intended RED, then implement the selection/detail presentation at existing cooking owners, with Vietnamese date/shift/variant context, Num/IdentifierText and no guessed 'kg' unit.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Chef.test.tsx --maxWorkers=1`; keep foreign-cache/batch paging/conflict/export-denial owners passing.

## Task 8 — Review, bounded verification and handoff

- [ ] Load ipc-code-review, ipc-ui-review and verification-before-completion; inspect the final diff against the spec, especially helper geometry, ambiguous matches, manual intent, complete-date preview paging, early validation and frozen daily provenance. No independent-review claim without an authorized independent reviewer.
- [ ] Run sequentially: focused changed owners, full FE `npm run test:unit -w frontend -- --maxWorkers=1`, `npm run lint -w frontend`, `npm run build -w frontend`, `npm run depcruise -w frontend`, root conformance/strict growth and `git diff --check`. Run BE core solution under existing exclusions if backend changes: `dotnet test backend/IPCManagement.slnx -c Release --no-restore -m:1 -p:UseSharedCompilation=false --filter 'FullyQualifiedName!~IPCManagement.Api.Tests.Integration&Category!=EvidenceOwned&FullyQualifiedName!~RecoveryScriptContractTests'`.
- [ ] Locate/run applicable operationalPageContracts/contract owners if present; report exact absence rather than inventing replacement proof. Never modify exemption/baseline lists to pass.
- [ ] Run the installed Impeccable detector once on changed UI targets after implementation; preserve source-only evidence limits.
- [ ] Render review, if an authorized isolated browser target/actor is available: one batched pass at Spec §3 viewports/zoom, all affected surfaces plus long/ambiguous/error states. Fix findings in one batch, at most one confirmation pass. Otherwise hand the exact owner UAT checklist over as NEEDS_EVIDENCE; do not log in or write business data without permission.
- [ ] Record pass/fail/needs-evidence per criterion and required skill report in WORK, return IDLE, disclose unchanged background-relay/runtime and rendered/business acceptance limits. No commit or silent restart.
