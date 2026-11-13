# MRX UI Verdict Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans. Execution is native in the current checkout. No subagents, worktrees or commits. Progress is recorded only in `.planning/WORK.md`; checkboxes below define the execution checklist.

**Goal:** Resolve five concrete MRX UI findings with behavior and rendered evidence appropriate to each finding.

**Architecture:** Repair existing header/subbar, query-feedback and input owners. Scope responsive changes to MRX; shared accessibility changes must preserve DEFAULT consumers. Keep canonical quantity drafts and API contracts stable.

**Tech Stack:** React, TypeScript, Tailwind/index.css, Vitest/Testing Library, existing Playwright, ASP.NET Core/MySQL contracts.

**Spec:** `docs/superpowers/specs/2026-11-12-mrx-ui-verdicts-design.md`

## Global constraints

- Preserve inherited dirty tree and sole state owner WORK. Preserve `DEFAULT != MATERIAL_RECONCILIATION`.
- No install, commit, reset, clean, stash, worktree, subagent, external AI CLI, source DB mutation, main restart, deploy, endurance or campaign rerun.
- Preserve D6/D7/T7/T8/M1.2/N6, quantity precision, RBAC, UUID recovery and assertions. No baseline padding.
- Historical screenshots prove baseline only; visual acceptance requires post-change captures. Missing runtime access is NEEDS_EVIDENCE.

## Review focus

1. Long Vietnamese labels and status changes at 960px: primary tools remain reachable in their assigned region (Task 1).
2. Retry failure and 403/409 while old data exists: feedback and security precedence remain correct (Task 2).
3. Copy inside a selectable row and clipboard rejection: no accidental row action or false success (Task 3).
4. Transfer followed by a source conflict: deduplication does not suppress a recovery warning (Task 4).
5. Legacy drafts, six decimals, mixed separator paste and filter-hidden edits: exact payload and draft retention (Task 5).

## Task 1 — Responsive MRX regions

Files: `frontend/src/components/workbench/WorkspaceHeader.tsx`, `TelemetrySubbar.tsx`, `frontend/src/styles/index.css`; MRX callers in weekly-menu, warehouse, reconciliation and chef. Tests: existing operational layout/browser owners discovered before editing.

Interfaces: preserve existing component props; use the existing MRX class hooks to scope layout. If an explicit layout prop is necessary, add an opt-in `layout?: 'mrx'` with existing behavior as default.

- [ ] Read all affected callers and existing geometry tests; compare baseline screenshots and enumerate control groups by route.
- [ ] Add a bounded browser regression at the existing layout-test owner asserting group order, reachable action bounds and page overflow <=1px at all six specified widths. Use only existing authorized fixtures; otherwise retain this check as blocked, not mocked runtime PASS.
- [ ] Replace nested uncontrolled wrapping/fixed empty slots with explicit MRX regions in the shared owners and CSS authority. Preserve frozen table scrolling.
- [ ] Compare before/after images at the six widths and verify both short/long status labels; check a DEFAULT consumer for shared regressions.

## Task 2 — Retry feedback stability

Files: `frontend/src/hooks/useWorkbenchQuery.ts`, `frontend/src/components/workbench/StateBoundary.tsx`. Tests: `frontend/src/__tests__/useWorkbenchQuery.test.ts` and the existing StateBoundary tests located through references.

Interfaces: retain `refetch(force?: boolean): Promise<void>` and `stateProps`; expose existing `isFetching` to the feedback renderer instead of inventing another request state.

- [ ] Add failing deferred-request tests: cached data + failed refresh + pending retry preserves error/data; success clears error; failed retry replaces message without removing the region. Check 403/409 precedence and stale-scope locks.
- [ ] Run the focused tests and retain the pre-fix failure.
- [ ] Stop clearing error at retry start where it causes the observed transition; clear on successful resolution. Render pending retry within the same feedback region and prevent duplicate retry actions.
- [ ] Run focused tests; record actual frame/DOM evidence for the reproduced sequence. Keep other flash reports open until reproduced.

## Task 3 — Keyboard-accessible identifier copy

Files: `frontend/src/components/ui/identifier-text.tsx`; tests `frontend/src/__tests__/Primitives.test.tsx`.

Interfaces: retain `value`, `copyable`, styling and HTML attributes; adapt element-specific typings if required by real callers.

- [ ] Add failing user-event tests for Tab/Enter/Space, correct clipboard text, parent-row isolation, rejected clipboard and non-copyable text.
- [ ] Replace the clickable span with a semantic button for copyable values; preserve focus styles and announce confirmed copy only.
- [ ] Run primitive tests and inspect affected MRX cells and one DEFAULT table for layout/accessibility regressions.

## Task 4 — Transfer feedback deduplication

File: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`; tests at the existing MRX weekly-menu feedback owner.

Interfaces: preserve existing success/error/source-edit state and dismissal callbacks.

- [ ] Trace transfer feedback conditions, including persisted TRANSFERRED reload and transient success.
- [ ] Consolidate the two simultaneous transfer banners into one next-step message. Retain separate conflict/error/reload-required messages and meaningful footer guidance.
- [ ] Verify transfer success, reload, dismissal and concurrent warning cases using existing tests; compare baseline and post-change screenshots.

## Task 5 — Localized quantity entry without payload changes

Files: `frontend/src/features/warehouse/branches/MrxDailyLinesBranch.tsx`, `frontend/src/features/warehouse/mrxQuantity.ts`; add a focused MRX quantity input component only if local text editing state cannot stay cleanly within the existing owner. Tests: focused quantity tests and `frontend/src/__tests__/Warehouse.test.tsx` existing draft/API cases.

Interfaces: add pure `parseMrxQuantityText(text: string): string | null` returning canonical ungrouped dot text or null, and `formatMrxQuantityText(canonical: string): string` for comma-decimal presentation. Preserve canonical `quantities: Record<string,string>` consumed by the existing hook. Empty/incomplete/invalid text stays locally editable but must invalidate that row's canonical submission value; no stale valid value may remain submittable.

- [ ] Verify C# issue-request decimal fields, six-decimal policy, frontend submit validation and stored draft restoration. Reuse existing fixtures without manufacturing runtime business records.
- [ ] Add failing behavior tests for spec examples, invalid/grouped text, blur normalization, clearing an existing valid value, search hide/show and legacy draft restoration. Assert the actual request body's `issuedQty`.
- [ ] Implement localized text editing with `inputMode="decimal"`, explicit validation, canonical state adapter and accessible labels. Remove the previous dot-decimal hint.
- [ ] Run focused tests and Warehouse suite. Verify the real rendered entry and focus behavior before visual PASS.

## Task 6 — Integration and native review

- [ ] Review only task-owned deltas against inherited changes; inspect affected shared callers. Do not attribute the entire git diff to this task.
- [ ] Run frontend lint/build, relevant primitive/query/Warehouse/weekly-menu tests and applicable existing operational/contract test owners. Resolve new failures; preserve unrelated baseline failures.
- [ ] Perform one bounded post-change screenshot round and, if needed, one correction round. Record exact runtime/build/actor/mode/viewport provenance; no qualification campaign.
- [ ] Record per-verdict PASS/FAIL/NEEDS_EVIDENCE in WORK, including uncovered flash sequences and BE verification limits. Keep whole-plan `OPERATIONAL_QUALIFICATION_BLOCKED`.

## Plan self-review

V1–V5 map to Tasks 1–5; integration and evidence limits map to Task 6. No BE repair is justified without reproduction. User approved native execution with “Duyệt native”. Execution results and remaining evidence gaps are recorded only in .planning/WORK.md.
