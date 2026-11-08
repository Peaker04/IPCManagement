# Collapsed sidebar A — approved design

Owner approved option A on 2026-11-04 after the sidebar brainstorm. This is a repair of the existing shell, not a new sidebar design.

## Approaches
- **A (chosen):** 64px collapsed rail has a single centered expand button in its header. Branding remains in the expanded header; Home remains in navigation. This avoids competing controls in a narrow row.
- **B (not chosen):** stack brand and toggle vertically; preserves collapsed branding but uses more header space.

## Design
- Expanded sidebar remains 240px with current brand, tree navigation and user details.
- Collapsed header keeps its 56px height and contains only a centered 40px expand control; no overlapping home/brand link.
- All collapsed navigation entries use the same centered 40×40 hit area, no horizontal content padding, explicit accessible names and the existing active/route behavior.
- Footer remains mounted in both widths. Collapsed layout stacks the admin-only current-mode link (MRX/STD with its full accessible name), noninteractive avatar identifying the existing user/role, and a 40px icon-only logout button.
- Navigation scrolls independently with min-height zero; header/footer do not shrink. Existing mobile drawer/trigger, authorization, dirty-navigation confirmation, mode-change settings owner and logout handler remain unchanged.
- Reuse existing AppShell/primitives/icons/styles. No dependencies, token/CSS changes, new profile workflow or flyout.

## Verification scope
Use the existing AppShell owner test for collapse/expand, visible identity/mode/logout, accessible icon navigation and actual logout behavior. Preserve non-admin mode denial. Run focused AppShell tests, scoped ESLint and frontend typecheck; not the full FE/BE suite. These do not certify pixel alignment or mobile viewport rendering; report missing browser evidence explicitly.

Live task status belongs only to `.planning/WORK.md`.
