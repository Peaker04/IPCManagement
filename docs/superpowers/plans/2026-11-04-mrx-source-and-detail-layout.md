# MRX Source and Detail Layout Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for direct-parent implementation, task by task. No delegation, isolated worktree, installation or commits are authorized. Steps below are the static plan; `.planning/WORK.md` is the sole live execution checklist/evidence owner.

**Goal:** Remove repeated completed-state noise, clarify group editing, retain read-only frozen BOM lookup, and repair clipped warehouse issue details.

**Architecture:** Repair existing React owners and preserve their current callers and API contracts. Three independently testable tasks share no new state/service abstraction. One plan is appropriate because this is one approved UI refinement, not independent new subsystems.

**Tech Stack:** React/TypeScript, existing UI primitives/Tailwind tokens, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-04-mrx-source-and-detail-layout-design.md`

## Global Constraints
- FR-MENU/FR-WH/FR-RECON; BR-MRX-EDIT role/day locks and DEFAULT/MRX isolation unchanged. Never weaken frozen-lineage checks, mutate/backfill DB data or fabricate current BOM as frozen evidence.
- Keep weekly matrix topology, all source date × shift × slot identities, grouped/individual editing, review/apply/submission, both frozen-lookup callers and both issue-detail callers.
- Typography at least12px; exact six-decimal quantities; preserve null/unknown facts rather than converting them to zero; frozen identity/header with horizontal tables; one vertical scroll region per detail dialog; existing focus/Escape/return-focus semantics.
- Reuse existing components. No new dependency, primitive family, route, token, speculative wrapper or test-only seam. Catalog editor remains intact outside frozen lookup.
- No automatic full FE/BE suite. Author regressions with test-audit/ipc-test-audit; match C# DTOs, mock only the network boundary for new/changed request cases, never the component/hooks under test. No skip/allowlist padding.
- Before TSX edits emit scoped UI gate and read Impeccable craft-floor; before completion load ipc-code-review/ipc-ui-review and verification-before-completion. Preserve inherited dirty changes and preview processes.
- Native renderer/browser/auth/DB campaigns are not authorized by this plan. Unperformed rendered checks remain NEEDS_EVIDENCE. The inherited issued-below-requested `Tiết kiệm` wording is outside this approved scope.

## Review Focus
1. An editing-capable role viewing COMPLETED must not see edit controls or repeated completion badges; existing lifecycle remains the state owner (Task1 route regression).
2. A partially locked week must retain its open-day editors and exact group/individual target identities; headings must not imply the whole week is locked (Task1 existing interaction cases).
3. Opening/reopening either detail for a different identity must never show previous facts or accept a late old response (Tasks2/3 deferred-response regressions).
4. Missing frozen lineage, HTTP403/500 and a genuine empty successful response must remain distinct; retry must actually fetch again without invoking catalog writes (Task2 state regression).
5. Long names, narrow/short viewports and six-decimal numbers must not hide `Thực xuất` or close controls; focus/Escape must retain existing behavior (Task3 numerical/lifecycle tests; actual geometry requires browser evidence).

## Task 1 — Source matrix: readonly state and group-edit scope
**Modify:** `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`, `frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx`.
**Tests:** `frontend/src/__tests__/WeeklyMenu.test.tsx`, `frontend/src/__tests__/MrxSourceEdit.test.tsx`.
**Interfaces:** Keep `MrxSourceEditGridProps` unchanged: consumes `MrxEditScope` including `batchStatus` and per-day locks, `MrxSourceDraft`, `mode`, `readOnly`, and current slot/serving callbacks; produces the same callback identities. Keep `buildMrxSourceMatrix` and hook contracts unchanged.
- [ ] Extend existing grid cases `renders four canonical sections…`, `replaces every slot in a four-row dish…`, and `disables locked-day inputs…`: readonly facts remain visible with no combobox/spinbutton/edit affordances; editable groups show `Đổi món cho nhóm · 4 dòng`; `Tách để sửa riêng` preserves the existing four-slot change/split/regroup behavior; mixed-day locks appear once per date and open-day edits remain enabled. Update obsolete disabled-only assertions, not mutation safety assertions.
- [ ] Add one completed-week public-route regression using the existing WeeklyMenu render helper and real hooks/providers: matching COMPLETED batch/edit scope; lifecycle completion visible; no source-edit toggle, inputs, per-cell completion badges or source mutation. This is distinct from grid callback coverage.
- [ ] Run from root: `npm run test:fe:unit -- --run src/__tests__/MrxSourceEdit.test.tsx src/__tests__/WeeklyMenu.test.tsx --maxWorkers=1`; record intended pre-fix failures, not failures caused only by renamed copy.
- [ ] Derive readonly behavior from current completed scope plus existing role authority. Render numeric/text facts for readonly servings/dishes and text for individually locked dishes; keep allowed-day editors. Move per-date lock reason to date headings, suppress per-cell/global duplicate completion messages, and keep existing header lifecycle as whole-lot status owner. Hide the completed source-edit toggle; retain callback guards. Show group scope from actual constituent slots and the secondary split action only when editable.
- [ ] Rerun the focused command; require PASS. No BE/schema changes or new matrix-model exports.

## Task 2 — Frozen dish/BOM lookup: readonly and identity-safe states
**Modify:** `frontend/src/components/workbench/MrxBatchDishesModal.tsx`, `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`, `frontend/src/features/reconciliation/ReconciliationPage.tsx`.
**Test:** `frontend/src/__tests__/Reconciliation.test.tsx`; existing source-route case only as necessary for the renamed entry.
**Interfaces:** Preserve `{ isOpen, onClose, batchId, customerName? }`, `mrxApi.getBatchDishes(batchId)` and response DTO shape. Ground request fixtures in `ReconciliationBatchDishSummaryDto/MaterialDto/ScopeDto` in `backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs`.
- [ ] Extend `keeps Manager review in its own station while waiting for Warehouse`: open the renamed entry, assert actual frozen date/shift/servings/BOM facts, existing `0,002586` precision/unknown-unit behavior, and absence of catalog-edit controls/nested dialogs. Keep role-safe station links unchanged.
- [ ] Add one owner-level deferred-response lifecycle case and one compact state/recovery case in the same test file: A→B/reopen clears A while B loads and ignores late A; missing-lineage is one unavailable state without `0 món`/empty-success claim; generic500 has a functioning retry;403 is denied; successful `[]` is genuine empty. Use transport mocks, not modal/hook mocks; do not duplicate existing precision tests or test source-import strings.
- [ ] Run: `npm run test:fe:unit -- --run src/__tests__/Reconciliation.test.tsx --maxWorkers=1`; require intended state/readonly regression failures pre-fix.
- [ ] Rename both public entries and the detail heading to `Món & BOM đã đóng băng`. Remove only the frozen modal's catalog editor import/state/trigger/nested mount. Reset/request-scope loading/error/data/selection on open, retry and batch change, ignore obsolete completions, and render one mutually exclusive loading/unavailable/error/empty/success branch. Hide stale counts while loading/unavailable; use existing retry/permission feedback conventions. Retain valid shift/search filters and frozen facts; keep the current list/detail presentation but remove fixed-height/nested vertical pane/material scrollers so the existing Modal body owns vertical scrolling, and bring any sub12px copy to12px. Do not fetch live BOM as fallback or alter shared catalog APIs.
- [ ] Rerun focused Reconciliation tests plus Task1 WeeklyMenu tests for the renamed caller; require PASS.

## Task 3 — Warehouse issue detail: complete table and bounded scrolling
**Modify:** `frontend/src/components/workbench/ReconciliationIssueDetailModal.tsx`.
**Narrow shared support:** `frontend/src/components/ui/modal.tsx`: add optional `bodyClassName?: string` to existing `ModalProps`, merged with existing body classes using existing `twMerge`; default behavior unchanged. This real production consumer needs to choose a single table-scroll owner without brittle child selectors or a shared modal redesign.
**Tests:** `frontend/src/__tests__/Warehouse.test.tsx`; run existing `frontend/src/__tests__/Primitives.test.tsx` and Reconciliation caller coverage for the additive modal change.
**Interfaces:** Preserve issue detail `{ isOpen, onClose, issueId }` and `mrxApi.getIssueById(issueId, sourceFamily?)` with default MRX scope; existing Warehouse/Reconciliation caller props unchanged. Use actual Inventory issue detail/line/provision DTO contracts and existing fixtures.
- [ ] Extend existing `renders variance badges…in ReconciliationIssueDetailModal` to assert all five business headers and exact requested/issued quantities remain available; preserve provision filtering and existing variance behavior. Do not assert Tailwind class inventories as geometry proof.
- [ ] Add one deferred transport lifecycle/retry regression: pending initial/reopened request shows loading, changing issue identity masks old facts and ignores late responses, failed fetch exposes retry, retry loads the requested issue, close/Escape invokes the current callback and restores focus to its opener. Reuse existing primitive focus coverage instead of cloning generic modal tests.
- [ ] Run: `npm run test:fe:unit -- --run src/__tests__/Warehouse.test.tsx src/__tests__/Primitives.test.tsx --maxWorkers=1`; require intended loading/recovery failures before fixing.
- [ ] Use `maxWidth="max-w-4xl"` and the additive body class override to prevent outer-body vertical scrolling. Keep metadata above a flex/min-height-zero, single `overflow-auto` table viewport; remove the competing fixed max-h80 scroll region. Keep sticky column headings and ingredient identity for horizontal movement, all five columns, full Vietnamese names and six-decimal Num output. Retain fixed dialog header/footer, viewport bounds and existing modal close behavior. Make request states identity-safe with real loading/error/retry; leave stock/provision/receipt facts unchanged.
- [ ] Rerun the focused command and Reconciliation tests; require PASS. Do not claim viewport/focus geometry from jsdom.

## Final scoped verification and handoff
- [ ] Run the four affected feature suites plus primitive coverage together once: `npm run test:fe:unit -- --run src/__tests__/MrxSourceEdit.test.tsx src/__tests__/WeeklyMenu.test.tsx src/__tests__/Reconciliation.test.tsx src/__tests__/Warehouse.test.tsx src/__tests__/Primitives.test.tsx --maxWorkers=1`.
- [ ] From frontend, scoped ESLint on changed TSX owners/tests and `node ../node_modules/typescript/bin/tsc -b --pretty false`. Run installed Impeccable detector on changed UI owners and `git diff --check`. Record exact exit codes/failures; do not weaken unrelated inherited tests.
- [ ] Self-review source callers, role/day-lock semantics, no catalog mutation path, request identity and unchanged default Modal behavior. Self-review this plan against the spec: all four areas map to Tasks1–3; no new business state/API/BE work.
- [ ] Record PASS/FAIL/NEEDS_EVIDENCE per criterion in WORK. Rendered desktop/narrow/short viewport, horizontal scroll, sticky identity/header, focus and zoom remain NEEDS_EVIDENCE unless separately authorized and actually observed. No full FE/BE suite, business writes, login, commits, deploy or preview shutdown.
