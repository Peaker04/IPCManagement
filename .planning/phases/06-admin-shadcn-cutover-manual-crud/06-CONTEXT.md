# Phase 6 Context: Admin shadcn cutover & manual CRUD

## Boundary

Phase 6 changes the `/admin-data` BOM workbench only after Phase 5 contracts and Gate C evidence exist. It does not change the route, primary admin navigation, canonical workbook semantics, retention policy, apply action vocabulary, or historical-data guarantees.

## Locked user decisions

- **D-06-01:** Preserve the current information architecture and compact industrial-admin visual language. This is a targeted evolution, not a visual overhaul.
- **D-06-02:** Continue using the project's existing shadcn-style/Base UI/Tailwind primitives and IPC tokens. Do not install a second UI kit, modal system, table framework, icon family, font, or animation dependency.
- **D-06-03:** The right BOM table owns a fixed viewport and independent scrolling. Full, searched, loading, error and empty states keep the same outer width, height, column geometry and toolbar position.
- **D-06-04:** Keep `table-layout: fixed`, an explicit `colgroup`, a documented table `min-width`, and a fixed desktop action column. Narrow screens scroll inside the table container, never the page shell.
- **D-06-05:** Search filters only rendered rows. Dataset-wide preview/apply counts, candidates, blockers and scope never derive from the filtered collection.
- **D-06-06:** The search icon is non-interactive, vertically centered and paired with reserved left padding so text and placeholder can never overlap it. The search control keeps a usable minimum width before yielding to overflow behavior.
- **D-06-07:** `Sửa` and `Ngừng` stay in one `flex-nowrap` action row at the supported desktop viewport. Labels and icons do not wrap or shrink; smaller viewports use table-local horizontal scroll.
- **D-06-08:** Preserve manual add, edit-by-version and stop/close for global and customer scopes. Published history is never hard-deleted. Server-derived actor and a bounded nonblank reason remain mandatory where Phase 5 requires them.
- **D-06-09:** Destructive apply uses an accessible confirmation dialog showing source hash, effective date, total/destructive/draft-regenerate/history-kept counts, blockers and backup marker. The primary action is disabled for blockers, stale preview, missing backup or missing Gate C evidence.
- **D-06-10:** Confirmation is cancel-safe by default. Dialog title/description are programmatically associated, focus is trapped, Escape closes when safe, and focus returns to the trigger. Destructive progress cannot be dismissed accidentally.
- **D-06-11:** Loading, empty, error and success are communicated with text plus existing semantic tokens, not color alone. Loading placeholders reserve final geometry; errors remain contextual and retryable.
- **D-06-12:** Motion intensity is minimal: focus, hover, pressed and state feedback only. No decorative motion, gradients, glass effects or page redesign.
- **D-06-13:** Desktop verification targets the existing 1365x900 operational baseline and widths down to 1280px. Mobile remains usable through contained overflow and stacked toolbar controls, without promising a card-based rewrite of the data table.
- **D-06-14:** Compatibility tests must cover keyboard flow, focus return, dialog naming, disabled destructive CTA, unfiltered counts under search, stable table bounding box/column widths and same-row actions.

## Phase contract

### Must preserve

- Route `/admin-data`, `BOM theo đơn giá` tab and existing operational labels.
- Existing IPC blue/slate light theme, compact spacing, small radius and semantic success/warning/danger colors.
- Existing Lucide icon family because it is already the project-wide dependency.
- Current manual dialog fields and versioning intent.
- Phase 5 server authority: UI counts and IDs are informative, never authoritative for apply.

### Must replace or harden

- Direct commit wording and old import-only assumptions with canonical preview/apply language from Phase 4/5.
- The hand-rolled dialog behavior where it cannot guarantee focus trap, Escape handling, accessible description and focus restoration.
- Table shell behavior that permits vertical overflow to change page layout.
- Any derived totals sourced from `currentBomRows` after search/filter.
- Any destructive action that can be triggered without fresh preview, backup marker, zero blockers and Gate C evidence.

## Out of scope

- Removing legacy backend endpoints or DTOs (Phase 7).
- Changing BOM math, customer overlay rules or cleanup classification (Phases 4/5).
- Replacing the whole admin page or introducing a general-purpose grid library.
- Dark-mode rollout, marketing-style visuals, new typography or new brand tokens.

## Acceptance anchors

1. Search for one dish and clear search: table frame, toolbar and column widths do not move.
2. At 1365x900 and 1280px desktop widths, `Sửa` and `Ngừng` remain on one row.
3. Preview totals stay identical before and after filtering; only visible rows change.
4. Keyboard opens and cancels each dialog, returns focus, and cannot confirm while any safety prerequisite is false.
5. Add, version and stop workflows remain available after canonical cutover and preserve published history.

