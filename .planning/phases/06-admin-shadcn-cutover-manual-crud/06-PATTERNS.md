# Phase 6 Pattern Map: Admin shadcn cutover & manual CRUD

**Mapped:** 2026-07-16  
**Scope:** planning evidence only; no source implementation or commit  
**Requirements:** CRUD-01, UI-01, UI-02, UI-03, UI-04, UI-05

## 1. Graph-first evidence and risk boundary

`node .gitnexus/run.cjs status` reports the `IPCManagement` index current at commit `a342945` on `feature/production-plan`. Concept queries for the future Phase 6 component names do not find a flow because those symbols do not exist yet. The useful current graph route is:

```text
AppRouter
  -> /admin-data
  -> AdminDataPage
      -> DataTableShell and common IPC primitives
      -> dishCatalogApi RTK hooks
      -> /dishes/catalog and /dishes/{dishId}/bom/*
```

The index describes committed code, not the large dirty-worktree expansion of `AdminDataPage.tsx`. Its indexed symbol ends at line 223 while the current file extends beyond line 2100, so `AdminDataPage` LOW/zero-caller output is a lower bound and must not be treated as evidence of low implementation risk.

Read-only upstream impact results that matter to planning:

| Target | Result | Planning consequence |
|---|---:|---|
| `DataTableShell` | **CRITICAL**, 16 impacted symbols, 10 direct consumers, 12 processes | Do not change the generic shell for Phase 6. Add a BOM-specific wrapper/class with stronger local overflow rules. |
| `DialogContent` | **HIGH**, 7 impacted symbols, 4 direct consumers, 3 processes | A global Base UI conversion needs a dedicated plan, regression coverage for every dialog consumer and a HIGH-risk warning before edit. |
| `AdminDataPage` | LOW in graph, but committed symbol is stale relative to the dirty file | Treat as HIGH ownership/merge risk; hash-gate and make a surgical extraction. |
| `dishCatalogApi` / `buildBomImportFormData` | not indexed | Use exact file ownership, TypeScript tests, `rg` consumer inventory and final `detect_changes`; do not infer safety from UNKNOWN graph output. |

Before implementation, run exact upstream impact again for every existing symbol being changed. Before every commit run `node .gitnexus/run.cjs detect_changes -r IPCManagement --scope all`; HIGH/CRITICAL or unexpected flows block the wave.

## 2. Existing source map

### Route and page owner

- `frontend/src/routes/AppRouter.tsx` keeps `/admin-data` routed to `AdminDataPage`; Phase 6 must not alter route ownership or main navigation.
- `frontend/src/features/workflow/pages/AdminDataPage.tsx` currently owns every admin tab plus all BOM state, handlers, current/preview tables and dialogs. BOM-specific implementation begins around the state at lines 223-263, handlers around lines 381-557, workbench around lines 881-1165 and dialogs around lines 2026-2136.
- Keep `AdminDataPage` as the route/tab orchestrator and extract only the `bom-import` surface. Do not move contracts, cleanup, inventory, statistics, audit or employees into the BOM feature.

### Current RTK/API surface

`frontend/src/features/projects/dishCatalogApi.ts` already owns:

- `CatalogDish`, `CatalogIngredient`, `IngredientLookup`, `UpsertDishBomLineRequest`;
- `getAdminDishCatalog`, `getIngredients`;
- `addDishBomLine`, `updateDishBomLine`, `closeDishBomLine`;
- the old `downloadBomTemplate`, `previewBomImport`, `commitBomImport` compatibility endpoints;
- invalidation tags `DishCatalog` and `WorkflowReports`.

Phase 6 must preserve the old hooks until Phase 7. Add canonical preview/status/apply in a separate `frontend/src/features/projects/bomReconciliationApi.ts` so canonical server authority is not mixed with legacy `canCommit`/created-updated-archived types. The only surgical changes required in dirty `dishCatalogApi.ts` are Phase 5 manual reason payload compatibility and exported request types needed by the new dialogs. Do not rename or remove old hooks here.

The executed Phase 4/5 DTOs are authoritative. The frontend adapter must be derived from the actual `BomCanonicalPreviewDto` and `BomCanonicalApplyDto` or generated OpenAPI at execution time, not invented from the UI. Planned HTTP authority is:

- preview/status under `/api/admin/bom-reconciliation`, Admin-only and actor-bound;
- preview yields an immutable manifest with preview ID, source SHA-256, contract/policy versions, effective date, DB fingerprint/TTL/freshness, source trace, separate canonical `Unchanged/Create/Version` counts, separate legacy `keep/archive/deactivate/regenerate/delete/block` counts, blockers, history-kept, backup marker and Gate C evidence;
- apply accepts only the actual Phase 5 bounded server contract (planned: preview ID, workbook, effective date and reason); never send actor, local path, filtered candidate IDs or client-computed counts;
- manual published add/update/close derives actor on the server, requires a trimmed reason of 1-500 characters where Phase 5 applies, versions/closes without hard-delete and invalidates current catalog/report data after success.

### Reusable shadcn-style and IPC primitives

- `frontend/package.json` already has React 19, Tailwind 4, `shadcn`, `@base-ui/react` 1.5, CVA, `tailwind-merge`, Lucide, Vitest/Testing Library and Playwright. No dependency or registry fetch is needed.
- `frontend/src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `alert.tsx`, `table.tsx` and `badge.tsx` already wrap Base UI or shadcn-style token classes.
- `@base-ui/react/dialog` provides Root, Trigger, Portal, Backdrop, Popup, Title, Description, Close and Viewport; `@base-ui/react/alert-dialog` is also installed. Use these existing packages for focus trap, Escape, title/description association and focus return.
- `frontend/src/components/ui/dialog.tsx` is currently a hand-rolled `createPortal` implementation. It has no focus trap, robust Escape behavior, reliable initial focus or trigger restoration. It is the correct shared primitive to harden, but its HIGH blast radius requires backward-compatible props and regression tests across all consumers.
- Add `frontend/src/components/ui/alert-dialog.tsx` as the destructive Base UI wrapper used by stop/apply. This is part of the same Base UI/shadcn system, not a second modal stack.
- Reuse `InlineAlert`, `StatusBadge`, `ContextStrip`, `SectionPanel` and `ViewSwitcher`. `InlineAlert` must receive role/live-region semantics at call sites because the component currently renders a plain `aside`.
- Reuse `DataTableShell` as the accessible `role="region"`/`tabIndex=0` outer primitive but do not edit it. `frontend/src/styles/index.css` globally sets `.ipc-table-shell { overflow-y: visible; }`, so the BOM feature must apply a more specific local class and fixed block size.
- Keep existing IPC tokens in `frontend/src/styles/index.css`: blue/slate primary, semantic success/warning/danger, 4/8/12/16px spacing, 2-4px radius and `--ipc-focus-ring`. No gradients, glass, font or dark-mode work.

## 3. Recommended Phase 6 file boundary

Create the following feature-owned files (names are stable planning targets; the planner may combine only tests, not responsibilities):

```text
frontend/src/features/projects/
  bomReconciliationApi.ts
  bomReconciliationApi.test.ts

frontend/src/features/workflow/components/bom/
  BomMigrationWorkbench.tsx       # composition only
  BomScopeSummary.tsx             # server totals and safety prerequisites
  BomTableToolbar.tsx             # current/preview tab, display-only search, add trigger
  BomTableViewport.tsx            # fixed shell, colgroups, all visual states
  BomLineDialog.tsx               # add and create-version forms
  BomStopDialog.tsx               # reason + history-preserving AlertDialog
  BomApplyDialog.tsx              # manifest summary + gated destructive apply
  useBomMigrationWorkbench.ts     # RTK-to-view adapter and freshness invalidation
  bomMigrationWorkbench.css       # feature-specific geometry/overflow only
  index.ts
  *.test.tsx / *.test.ts
```

`AdminDataPage.tsx` should import `BomMigrationWorkbench` and provide only route context such as an optional selected dish from `?dishId=`. Tier/scope/file/effective date, canonical manifest, current/preview mode, search and manual dialog state move into the workbench/hook. Do not create another Redux slice; RTK Query owns server state and the hook owns short-lived display/form state.

## 4. State and authority pattern

Keep three collections/contracts deliberately separate:

1. `currentDatasetRows`: the server-query result for the selected current scope; its server total drives the summary.
2. `previewManifest`: the full immutable Phase 4/5 response; its counts, blockers, freshness, backup and Gate C fields drive apply eligibility.
3. `visibleRows`: a memoized display-only projection filtered by `searchText`; it drives only `<tbody>` rendering.

The adapter should expose a small derived model such as:

```text
displayRows
serverCurrentTotal
manifestTotals
applyPayloadFromManifest
applyDisabledReasons[]
invalidatePreview(reason)
```

Changing file, customer/scope context or effective date immediately clears/invalidate the local manifest reference and disables apply. Changing search never changes manifest ID, source hash, server totals, candidate set, apply payload or eligibility. Canonical action vocabulary and legacy lifecycle vocabulary remain separate; `regenerate` is downstream-only. Never derive a destructive number from `currentBomRows.length`, `.slice(0, 100)` or any search-filtered array.

RTK canonical apply invalidates `DishCatalog` and `WorkflowReports` only after a successful response. The UI announces success only after Phase 5 has completed downstream regeneration and post-commit invalidation; it does not optimistically claim success.

## 5. Table and toolbar implementation pattern

`BomTableViewport` owns one fixed shell for success, loading, error, dataset-empty and search-empty states:

- keep native `<table>`, `table-layout: fixed`, explicit `<colgroup>` and documented `min-width`;
- current table target: 1,038px minimum with action column 168px; preview table uses the UI-SPEC widths totaling 1,120px;
- desktop viewport is exactly 520px, narrow viewport 440px; `overflow: auto`, `overscroll-behavior: contain`, `scrollbar-gutter: stable` and the table region owns both scroll axes;
- loading retains the real header and at least six normal-height skeleton rows;
- empty/error/search-empty render one full-width body row while preserving table/header/colgroup/shell;
- feature CSS selector should be at least `.ipc-table-shell.ipc-bom-table-viewport` so it overrides the dirty global `overflow-y: visible` without changing `DataTableShell` or `index.css`;
- document/page overflow is forbidden; pressure below table min-width is resolved by local horizontal scroll.

Search follows the locked geometry: a 16px Lucide `Search`, `pointer-events-none`, absolute left 8px, centered at 50%, and input padding-left at least 36px. Use a real accessible label (`Tìm món hoặc nguyên liệu`) and the exact placeholder. The toolbar remains mounted in every state.

The row action group is `inline-flex`, row/nowrap, centered, gap 4px, `white-space: nowrap`. Buttons are nonshrinking; `Sửa` min 68px and `Ngừng` min 76px. Keep Pencil and Power icons only. At smaller widths the table scrolls; actions never wrap.

## 6. Dialog and form pattern

Harden `components/ui/dialog.tsx` over Base UI in a dedicated wave while keeping the existing controlled `open`/`onOpenChange` usage compatible. Add associated `DialogTitle`/`DialogDescription`, focus trap, safe Escape, backdrop behavior and focus return. Cover all existing consumers found by `rg`:

- `SessionTimeoutModal.tsx`;
- chef excess/supplemental dialogs;
- coordination `action-toolbar.tsx`;
- `WeeklyMenuPage.tsx`;
- `AdminDataPage.tsx` until extraction;
- `ApprovalPage.tsx` and `ApprovalRulesPage.tsx`.

Use the new Base UI AlertDialog wrapper for both destructive confirmations:

- `BomStopDialog`: cancel gets initial focus, reason is trimmed 1-500 when required, danger CTA, no hard-delete copy, current dish/ingredient/scope/tier/interval visible;
- `BomApplyDialog`: cancel gets initial focus; full selectable source hash, effective/ISO date, scope, total/destructive detail, regenerate, history-kept, blockers, verified backup, Gate C and freshness visible; every failing prerequisite is visible above the disabled CTA;
- once apply starts, Escape/backdrop/close are disabled; before it starts cancel/Escape is safe;
- on close/success focus returns to the exact trigger or stable summary anchor; after version replacement focus moves to the new logical row's edit trigger; after stop removes a row, focus moves to the named table region;
- forms link field errors using `aria-invalid` and `aria-describedby`, focus the first invalid field, preserve values after server error and prevent accidental close while saving;
- use `role="alert"` only for urgent error/blocker state, `role="status"`/`aria-live="polite"` for nonurgent results.

Manual add/version/stop payloads use the executed Phase 5 DTO exactly. No actor field is rendered or submitted. Published add/version/stop reason rules are server-compatible; client validation is convenience only and server error remains visible.

## 7. Test harness map

Use existing harnesses rather than adding a new runner:

- `frontend/src/features/projects/dishCatalogApi.test.ts`: extend only for the surgical manual reason-body contract; keep legacy form-data characterization until Phase 7.
- `bomReconciliationApi.test.ts`: prove canonical FormData/body contains only allowed server DTO fields and omits actor/path/candidate IDs/client counts.
- feature Vitest/Testing Library tests: search changes only `displayRows`; manifest totals/payload remain byte-for-byte equal; input changes stale preview; every prerequisite produces the exact disabled reason; add/version/stop fields and reason constraints; dialog names/descriptions, initial focus and focus return.
- `frontend/tests/control-surface.spec.ts`: canonical preview/apply keyboard flow, stop/manual flow, Escape safety, non-dismissible apply loading and focus restoration.
- `frontend/tests/ui-audit.spec.ts`: extend existing overflow/action audit with targeted `/admin-data?view=bom-import` fixture matrix at 1365x900 and 1280x900. Record shell and header boxes across full/search/loading/error/empty and require <=1px delta; verify local scroll, no page overflow, search clearance and same-row actions.
- `frontend/tests/visual-routes.spec.ts`: retain current 1365x900 and 390x844 route baselines and add a targeted 1280x900 BOM workbench case. Do not replace the two user-dirty dashboard snapshots.
- `frontend/tests/route-smoke.spec.ts`: keep `/admin-data` heading/navigation smoke and add canonical/manual compatibility assertions only if not duplicated by control-surface.

Quality gate order: targeted Vitest, full `test:unit`, lint, build, control-surface, smoke, UI audit, visual. Gate D additionally requires executed Phase 5 integration/E2E evidence and old writer read-only/consumer inventory for Phase 7; Phase 6 itself removes nothing.

## 8. Dirty-worktree ownership gate

Create a Phase 6 pre-edit manifest before any source change and compare it before every commit. The following frontend files are currently user-dirty:

| Path | Current blob hash | Phase 6 policy |
|---|---|---|
| `frontend/src/features/workflow/pages/AdminDataPage.tsx` | `63f1792c65deb88ed21dc16960f231280c87c2ca` | Required surgical edit; preserve all non-BOM admin changes. |
| `frontend/src/features/projects/dishCatalogApi.ts` | `937db5fa727b4be8a971d069ab8cb7fd80529ce2` | Required minimal manual reason/type edit only; canonical API goes in a new file. |
| `frontend/src/styles/index.css` | `c2ba39f6f33a056e2fe4bb21b9e38e11f121b9d0` | Read-only dependency; use new feature CSS instead. |
| `frontend/src/features/coordination/components/action-toolbar.tsx` | `5958077da32bb06d5074d103fececcfc0c02e3f3` | Read-only dirty Dialog consumer; must pass dialog regression tests unchanged. |
| `frontend/src/features/dashboard/pages/DashboardPage.tsx` | `9ef5134a4a663a0dad86b2f9519a688d05b551a1` | Out of scope; never stage. |
| dashboard desktop/mobile visual PNGs | `9941b0c8e468e21b4afb3dddfeffdca77fde5e50`, `a45264d80577f36b92a1e5ce01198852f52f0c3d` | Out of scope; never overwrite or stage. |

The current dirty diff on direct hotspots is large: `AdminDataPage.tsx` +494/-115, `dishCatalogApi.ts` +3/-3 and `index.css` +641/-0. Therefore plans touching the first two must record pre-edit blob hashes, use explicit allowlists and stage exact files only. Never reset, checkout, stash or bulk-format the worktree.

## 9. Serialized execution order

1. **Phase 5/API readiness and ownership gate:** require Gate A/B/C PASS and actual DTO/OpenAPI; capture dirty hashes, consumer inventory and upstream impacts. Keep apply unavailable if evidence is missing.
2. **Canonical RTK and pure adapter:** add `bomReconciliationApi.ts`, canonical types from actual DTOs, payload-authority tests and `useBomMigrationWorkbench` state tests. Make the minimal dirty `dishCatalogApi.ts` reason update.
3. **Accessible shared dialog primitives:** convert the existing Dialog wrapper to Base UI compatibly, add AlertDialog and run all dialog consumers. This wave is blocked on explicit HIGH-risk approval/evidence.
4. **BOM workbench extraction and dataset summary:** extract from dirty `AdminDataPage`, keep route/tab orchestration, render server totals and all safety states.
5. **Stable table/toolbar/manual CRUD:** add local viewport CSS, fixed colgroups, search/action invariants and add/version/stop dialogs. Do not edit generic `DataTableShell` or global `index.css`.
6. **Canonical apply and compatibility gate:** add the manifest confirmation dialog, fail-closed prerequisite matrix, success refresh/focus/live announcements, then extend unit/control/smoke/UI-audit/visual suites at 1365, 1280 and 390 widths.

No wave may advertise apply before the executed server reports fresh preview, zero blockers, verified backup, Gate C PASS and enabled configuration. Phase 7 legacy deletion remains out of scope.

## 10. Planner guardrails

- Do not put API adapter, global dialog migration, page extraction, table geometry and all E2E work into one plan; they have different risk and rollback boundaries.
- Do not edit `DataTableShell`; its CRITICAL blast radius is avoidable.
- Do not delete old import/template RTK hooks or UI compatibility copy in Phase 6.
- Do not calculate totals or apply payload from filtered/current rendered rows.
- Do not accept actor/path/hash/count/candidate authority from the browser.
- Do not use a custom portal beside Base UI or add another dependency/registry.
- Do not replace stable table states with cards or auto-layout tables.
- Do not stage unrelated dirty CSS, dashboard, coordination or snapshot changes.

