# MRX Combined FE Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver approved merged-dish editing and shared customer administration, then prove outstanding MRX behavior through real FE actions with durable readback.

**Architecture:** Preserve existing source slots and source-change review. Deduplicate BOM in its existing backend owner; derive visual groups from dish IDs. Reuse customer page/API and the governed disposable-clone runner. One native writer in the existing dirty workspace.

**Tech Stack:** React/TypeScript, existing UI kit, ASP.NET Core/EF/MySQL, Vitest and headed Playwright.

**Spec:** `docs/superpowers/specs/2026-11-02-mrx-merged-dish-editing-shared-customers-design.md`; prior `2026-11-02-mrx-five-user-production-qualification.md` remains owner of quantitative gates.

## Global Constraints
- Owner approved design and explicitly requests combined execution, not another separate approval loop. Preserve native sequential execution; no delegation/worktree/install/stage/commit/deploy.
- No main DB mutation/migration, return or kitchen receipt workflow. Only exact-run disposable identities/targets under existing authorization.
- One BOM calculation per dish ID per source date/shift/variant/customer; never per merged row. Servings remain date × shift × variant.
- Real FE actions for claimed user workflows; HTTP/SQL only admission, observation and independent outcome oracles. No mocks or fake evidence.
- First phase failure stops later lanes; short visible progress; runtime cleanup/source readback required.

## Review Focus
- Same label with different ID must not merge; repeated IDs must not double BOM.
- Individual editing must retain all slots/focus and never mutate another date; whole-group replacement includes every covered slot.
- Locks/read-only apply to every group action; source errors preserve draft.
- Shared customers must not expose DEFAULT workflows or weaken server role restrictions.
- Missing BOM/zero/conversion and late response/session outcomes cannot receive fake success or be silently skipped.

### Task 1: Shared customer list/create
**Files:** `frontend/src/routes/routeRegistry.ts`, `frontend/src/features/admin/CreateCustomerModal.tsx`; existing `AppShell.test.tsx`/customer tests; inspect `CustomerContractsController.cs` and customer service before deciding backend change.
**Interfaces:** retain `/admin-data?view=customers`, existing `customerApi` request/DTO and server authorization.
- [ ] Extend existing navigation owner to require shared customers in DEFAULT/MRX, while purchasing/reports remain isolated; observe pre-fix failure.
- [ ] Remove unjustified mode-only create prohibition and expose existing leaf as SHARED; preserve actual server permission checks.
- [ ] Extend actual customer modal boundary test for MRX submit, valid DTO/error behavior; run focused Vitest.
- [ ] Real FE create/reload/select customer on clone, prove persisted record and unauthorized-role boundary; attach to Task3 campaign.

### Task 2: Grouped source editing
**Files:** `mrxSourceMatrixModel.ts`, `MrxSourceEditGrid.tsx`, existing `MrxSourceEdit.test.tsx` under `frontend/src/features/weekly-menu/` / `frontend/src/__tests__/`.
**Interfaces:** preserve `onDishChange(date,shift,dishSlot,dishId)` and `onServingsChange` signatures and existing hook/review/apply API. Add no arithmetic owner.
- [ ] Extend current model/component cases to require vertical grouping in edit mode, group replacement callbacks for all covered slots, explicit per-slot edit with stable controls, regroup after finishing and read-only lock. Observe RED.
- [ ] Keep vertical grouping in edit mode but retain horizontal merging only in completion mode. Use local group-expansion state in existing grid; expose each original slot within a grouped editor until explicitly finished. Reuse UI Button/combobox; unique accessible labels, no new style tokens or modal.
- [ ] Run focused source tests; inspect all callback callers and backend source projection for nontrivial BOM regressions.
- [ ] Live source changes: repeat same dish four slots, replacement, distinct/partial split, serving change, review/apply/reload and independent frozen/material quantity oracle.

### Task 3: Short real-FE business campaign
**Files:** existing `frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts`, `g3-alternative-flows.spec.ts`, `g5-async-timeout.spec.ts`, workflow fixtures; `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` diagnostic mapping if needed.
**Interfaces:** existing role pages, `dbVerifier`, real public UI/source workflows, private artifacts and safety receipts. No fabricated catalog/stock fixtures; customer created through approved UI is exact-run business data.
- [ ] Compose one focused customer/source diagnostic, reuse fresh scenario scope and existing import/transfer helper; preserve race owner.
- [ ] Move accepted-variance/correction in current no-return G3 from direct HTTP to actual Manager modal, keeping durable decision/history/stock assertions.
- [ ] Expand existing coordinated owner to multiple actual customer batches/shared ingredients using FE selection, independently checking per-member/group persisted issue/contributor/stock effects.
- [ ] Inspect real catalog for missing-BOM/conversion path. Exercise UI blocking/recovery only using permitted real master-data workflow; stop/report if prerequisites cannot be authorized instead of inventing stock or receipt evidence.
- [ ] Execute bounded focused diagnostics one at a time; RED→owner repair→GREEN only for independently reproduced defects. Keep failed attempts and coverage limitations.

### Task 4: Remaining quantitative and resilience gates
**Files:** existing `g7-desktop-memory.spec.ts`, `g8-five-user-endurance.spec.ts`, `tools/perf/k6/mrx-five-user.js`, native zoom owner as needed; retain existing recovery/session owners.
- [ ] Audit runtime consumers/sample counts and real workload coverage before admitting runs. Preserve missing-token versus actual-expiry distinction and storage-scope checks.
- [ ] Run memory30cycles and five-distinct-user2min smoke independently of known native-zoom blocker after short business prerequisites pass.
- [ ] Only after smoke passes admit60min and separate ≤5VU HTTP with visible heartbeat. Record workload as navigation/read unless actual writes are implemented/proven.
- [ ] Resolve legitimate dedicated-window foreground admission or keep native125/150/200% BLOCKED; never weaken ownership guard or use CSS emulation.

### Task 5: Integrated verification and close
- [ ] Load ipc-code-review/ipc-ui-review and verify approved UI contract; actual semantic owner suites where named contract files do not exist.
- [ ] Run final scoped typecheck, `npm run verify`, evidence-owner tests, `git diff --check` and final affected short diagnostic on integrated candidate as appropriate.
- [ ] Read receipts/candidate/source-after and independent listener absence; preserve inherited Git work.
- [ ] Update `.planning/WORK.md` with criterion-level PASS/FAIL/NEEDS_EVIDENCE/BLOCKED and skill report. No overall production GO without complete required evidence.

## Self-review
All approved spec sections map to Tasks1–3; prior unverified requirements remain explicitly Tasks3–4, not silently certified by product changes. No new signature breaks, dependencies, arithmetic wrappers or test-only seams planned. Runtime-dependent steps intentionally have admission/stop criteria, not unconditional PASS promises.
