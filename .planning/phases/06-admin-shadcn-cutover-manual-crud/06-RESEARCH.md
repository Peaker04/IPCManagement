# Phase 6 Research: Admin shadcn cutover & manual CRUD

## Design read

Reading this as a targeted redesign of a dense industrial-kitchen admin workbench for operational administrators, with a compact trust-first language, leaning on the existing IPC tokens and shadcn-style accessible primitives.

- `DESIGN_VARIANCE: 3`: predictable geometry matters more than novelty.
- `MOTION_INTENSITY: 2`: only focus, hover, pressed and state transitions.
- `VISUAL_DENSITY: 8`: this is a high-density operational table, not a marketing surface.

The taste skill explicitly excludes dashboards and data tables. Its applicable guidance here is limited to audit-first preservation, one design system, stable controls, full UI states, button no-wrap, accessibility and copy review. Product-UI decisions come from the existing shadcn/Base UI/Tailwind stack and IPC component patterns.

## Repository evidence

GitNexus index is current at commit `a342945` on `feature/production-plan`. Concept queries for planned names returned no indexed flow because these Phase 6 components do not exist yet, so source inspection followed the required graph-first attempt.

### Existing stack

- `frontend/package.json`: React 19, Vite 8, Tailwind 4, `shadcn`, `@base-ui/react`, CVA, `tailwind-merge`, Lucide, Playwright and Vitest are already installed.
- `frontend/src/styles/index.css`: IPC semantic tokens, compact 2-4px radii, 32-36px controls, focus rings and the blue/slate light theme already define the design language.
- `frontend/src/components/ui/dialog.tsx`: visually shadcn-like but currently hand-rolled around a portal. It does not implement a focus trap, automatic initial focus, Escape behavior or reliable focus restoration.
- `frontend/src/components/common/DataTableShell.tsx`: provides an accessible focusable region and horizontal overflow, but global CSS leaves vertical overflow visible.
- `frontend/src/features/workflow/pages/AdminDataPage.tsx`: owns import, current/preview modes, search, manual CRUD dialogs and several unrelated admin tabs in one large component.
- `frontend/src/features/projects/dishCatalogApi.ts`: existing RTK Query surface for current import and manual CRUD. Phase 6 must add the Phase 4/5 canonical preview/apply contract without reusing client-derived candidate authority.
- `frontend/tests/ui-audit.spec.ts` and `frontend/tests/visual-routes.spec.ts`: current layout and route baselines can be extended instead of introducing another test harness.

## Current-state audit

### Preserve

- `/admin-data` route and `BOM theo đơn giá` tab.
- Two-column workbench at desktop, compact form controls, context strip and table-local toolbar.
- Explicit current/preview modes.
- Existing `table-fixed`, `colgroup`, `min-w-[1038px]`, search padding and nowrap action-row fixes already present in the dirty worktree.
- Manual add/edit-by-version/stop intent and reason field.

### Gaps to close

1. **Unsafe scope derivation:** current context count uses `currentBomRows.length`; the canonical UI needs a server-supplied dataset total independent of search.
2. **Old operation contract:** handlers expose `preview` then `commit` and report created/updated/archived rows. Phase 6 needs Phase 4/5 manifest, freshness and gated apply semantics.
3. **Dialog semantics:** `aria-label` alone does not establish title/description relationships, and the current primitive lacks robust keyboard/focus behavior.
4. **Viewport stability:** `max-h-[520px]` combined with `overflow-y: visible` is not a reliable fixed scroll viewport. Loading/empty rows also need geometry reservation.
5. **Monolith risk:** `AdminDataPage.tsx` mixes BOM behavior with contracts, cleanup, inventory, statistics, audit and employee admin. Extract BOM-specific workbench/dialogs without changing route ownership.
6. **Safety visibility:** no canonical destructive summary with hash, effective date, blockers, backup marker, Gate C evidence and stale status.

## Recommended component boundary

- `BomMigrationWorkbench`: owns tier/scope/file selection and receives server manifest state.
- `BomScopeSummary`: renders immutable dataset-wide totals and safety prerequisites.
- `BomTableViewport`: one fixed shell for current/preview loading/error/empty/success states, explicit columns and contained scrolling.
- `BomTableToolbar`: current/preview switch, search and add-line action; search state never feeds manifest totals.
- `BomLineDialog`: add/version form using the shared accessible dialog primitive and Phase 5 actor/reason contract.
- `BomStopDialog`: history-preserving stop confirmation with required reason when applicable.
- `BomApplyDialog`: destructive manifest summary and gated confirmation; cannot infer or submit candidate IDs from filtered rows.
- `useBomMigrationWorkbench`: adapter between Phase 4/5 RTK endpoints and view state, including preview staleness reset on source/scope/effective-date changes.

## Layout contract candidates for UI-SPEC

- Desktop workbench: left setup rail with bounded width, right content `minmax(0, 1fr)`.
- Table shell: fixed block size around current 520px viewport, `overflow: auto`, stable scrollbar gutter where supported, focusable named region.
- Current table: retain explicit 1038px minimum and eight-column `colgroup`; action column remains wide enough for both buttons.
- Preview table: define its own fixed `colgroup` instead of content-driven widths.
- Search: icon at 10px inset, input left padding at least 36px, control min width 220px at desktop.
- Action group: `inline-flex`, `flex-nowrap`, `white-space: nowrap`, child `flex: none`; table scroll handles pressure.
- Loading/empty/error: one fixed-height table body presentation with column structure retained; no swapping the whole shell for a differently sized card.

## Accessibility and state contract candidates

- Use one shadcn-compatible dialog implementation backed by the already installed accessible primitive rather than custom portal behavior.
- `DialogTitle` and `DialogDescription` generate IDs wired to content; destructive dialog sets initial focus on Cancel.
- Disable closing during apply or require explicit cancellation semantics; never dismiss through backdrop while mutation is running.
- Return focus to the exact trigger row after edit/stop closes, including after a refreshed row version replaces the record.
- Announce preview/apply results through contextual status/live-region text; retain visible labels and do not rely on color.
- Preserve keyboard access to the table region and toolbar without adding custom arrow-key grids.

## Verification strategy

- Vitest/Testing Library: reducer/adapter proves filter cannot change manifest totals or apply payload; stale inputs invalidate preview; dialogs expose names/descriptions and disabled CTA reasons.
- Playwright control surface: keyboard open/cancel/return focus, reason validation, gated apply and safe loading behavior.
- Playwright UI audit: compare table shell bounding box and every column header width across full/search/loading/empty/error fixtures; assert no global overflow.
- Playwright visual: targeted `/admin-data?view=bom-import` desktop snapshots at 1365x900 and 1280px plus mobile contained-overflow evidence.
- Existing build/lint/unit/smoke/visual commands remain the quality gates; no new UI dependency is necessary.

## Planning implications

- Phase 6 depends on executed Phase 5 API contracts and Gate C evidence. The UI can be planned now but cannot invent endpoint DTOs independently.
- Separate API/state adapter, accessible primitives, workbench extraction, table stability, dialogs/manual CRUD and E2E/visual gates into small serialized plans.
- Phase 7 may remove the old import/template hooks only after the compatibility suite proves canonical preview/apply and manual CRUD are complete.

