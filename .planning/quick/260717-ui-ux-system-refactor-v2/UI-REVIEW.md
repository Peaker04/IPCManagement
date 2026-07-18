# Wave 4.5 UI review — 2026-07-18

## Design read

Reading this as: an operational B2B product redesign-preserve for kitchen managers, coordinators, purchasing and warehouse staff, with a trust-first clarity language, leaning toward the existing Tailwind/shadcn primitives and restrained motion.

The target is not a decorative redesign. The target is one predictable shell, one action hierarchy, readable operational states and bounded tables at every viewport.

## Current visual evidence

The dashboard visual run was executed with current source and existing snapshots, without updating snapshots:

| Route | Viewport | Result | Evidence |
|---|---|---|---|
| Dashboard | desktop | pass | Current shell and dashboard geometry render consistently. |
| Chef dashboard | desktop | pass | Current shell, empty state and action surfaces render consistently. |
| Dashboard | mobile 390px | fail | Actual `390×3443`; baseline `390×3404`; `83,531` pixels differ (`0.07`). |
| Chef dashboard | mobile 390px | fail | Actual `390×1266`; baseline `390×1227`; `31,860` pixels differ (`0.07`). |

The inspected actual/baseline pair shows content drift rather than duplicate shell rendering: date values differ, dashboard status copy differs (`Đang nghẽn` vs `Theo dõi điểm tắc`), and chef empty/backend-state copy differs. The current mobile navigation is a deliberate two-column responsive layout and remains readable without global overflow in the UI audit.

## CSS decision

- Do not delete mobile navigation or table rules based on the red visual overlay alone.
- Do not regenerate snapshots until fixture date/state copy is explicitly reconciled with the intended product baseline.
- Keep `index.css` protected because it contains user-owned global changes. Any selector deletion must come from a reference inventory and be staged separately from BOM/production-plan work.
- The clean feedback slice uses utility classes and existing shadcn Dialog; it does not add a second CSS system.

## Feedback audit result

- Native `alert`, `confirm` and `prompt` calls are absent from `frontend/src` in the current working tree.
- `ApprovalPage`, `ApprovalRulesPage` and `PurchasingPage` use typed toast feedback and React confirmation dialogs.
- The `AdminDataPage` CSV feedback hunk is intentionally unstaged because its import/hook context overlaps the dirty BOM feature diff; it remains the next ownership-reconciliation item.

## Next safe visual slice

1. Reconcile mobile dashboard/chef fixtures and copy ownership without changing shell geometry.
2. Audit one clean route's CSS selectors and remove only proven-dead declarations in a dedicated commit.
3. Reconcile `AdminDataPage` and `WeeklyMenuPage` ownership before applying route-level layout changes.
