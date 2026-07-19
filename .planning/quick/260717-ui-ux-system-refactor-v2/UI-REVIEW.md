# Phase 260717 — UI Review

**Audited:** 2026-07-18
**Baseline:** `UI-SPEC.md` (draft-for-baseline-audit), plus current plan/ownership/risk contract
**Screenshots:** captured at `localhost:5173` for 1440×900, 768×1024, and 375×812; snapshots not updated

## Audit position

This is a re-audit of the active UI/UX refactor worktree, not a clean-baseline approval. The canonical `TableViewport`, pagination metadata, semantic workflow copy, and protected-route audit are real improvements. The working tree is still not shippable as one coherent surface because dirty route/global-style changes overlap the visual evidence.

Findings are explicitly split:

- **Safe clean-route fixes:** changes that can be made inside the current allowlist after the normal impact/test gates.
- **Dirty-route ownership blockers:** findings in `WeeklyMenuPage.tsx`, `AdminDataPage.tsx`, `DashboardPage.tsx`, `index.css`, or user-owned snapshots that must wait for handoff or a clean baseline.

## Pillar Scores

| Pillar | Score | Key finding |
|---|---:|---|
| 1. Copywriting | 2/4 | Shared copy exists, but dirty Dashboard/Admin surfaces still render raw `Action`, `Contract`, `Audit`, and English `Action queue` labels. |
| 2. Visuals | 2/4 | Canonical table geometry is present, but the active worktree still produces route/baseline composition drift and unresolved Admin/sidebar duplication evidence. |
| 3. Color | 2/4 | Token palette is established, but 12 hardcoded hex colors remain in TSX and `index.css` is a 4,611-line dirty global override surface. |
| 4. Typography | 2/4 | Typography is operationally legible but not token-disciplined: arbitrary sizes and four-plus weight tiers remain, including 10px/11px/12px labels. |
| 5. Spacing | 2/4 | Canonical viewport containment passes, but 145 arbitrary Tailwind dimension values and route-specific fixed heights make responsive geometry inconsistent. |
| 6. Experience Design | 2/4 | Loading/error/empty/disabled/confirmation coverage is materially better, but route state geometry and auth/backend visual evidence remain incomplete. |

**Overall: 12/24**

Scores are not averaged upward: every pillar has a concrete contract violation or evidence gap below. No pillar earns 4 while the current working tree remains ownership-blocked.

## Top 3 Priority Fixes

1. **Reconcile dirty route/global-style ownership before visual migration** — current Admin/WeeklyMenu/Dashboard evidence cannot distinguish UI regressions from feature changes; obtain handoff or clean baseline, then rerun route visuals without changing snapshots prematurely.
2. **Finish semantic copy/token migration on clean surfaces** — replace raw `Contract`, `Audit`, `Action queue`, and direct status/action strings with `uiCopy`/formatters while retaining technical codes for traceability.
3. **Converge typography and dimensions onto the contract** — remove arbitrary route-level font/height values or document the few required table heights as component tokens; validate 375px and tablet layouts after each clean slice.

## Detailed Findings

### Pillar 1: Copywriting (2/4)

**WARNING — shared vocabulary is incomplete.** `RoleInbox` and `DocumentRail` use `formatWorkflowStatus` and `uiCopy.workflow`, but the dirty Dashboard still renders the English kicker `Action queue` and direct `nextAction` values at `frontend/src/features/dashboard/pages/DashboardPage.tsx:385,424`. The UI contract requires semantic labels and consistent operational language.

**WARNING — Admin technical labels remain user-facing.** `AdminDataPage.tsx:390-395` labels tabs as `Contract` and `Audit`, despite the contract mapping these to `Hợp đồng khách hàng` and `Nhật ký thay đổi`. This file is dirty and is therefore an ownership blocker, not a safe edit.

**SAFE CLEAN-ROUTE FIX:** audit remaining clean shared consumers for raw status/action labels and route them through the existing copy map; preserve raw enum/code values in payloads and exports.

### Pillar 2: Visuals (2/4)

**WARNING — canonical table surface is structurally correct.** `TableViewport.tsx:16-28` owns scroll, region naming, caption association, and focus. The UI audit passed both protected-route checks, including Admin data-quality action readability (`npm run test:ui-audit --workspace frontend`: 2/2).

**BLOCKER — whole-route visual evidence is not attributable.** Existing ownership evidence records Admin sidebar duplication/BOM geometry/mobile-height drift and Reports mobile overlay across shell, filters, KPI cards, tabs, and table. The current visual run is therefore not evidence for a clean shell fix. `OWNERSHIP.md:40-44` correctly forbids snapshot or global-style changes until reconciliation.

**DIRTY-ROUTE OWNERSHIP BLOCKER:** `AdminDataPage.tsx` still uses `DataTableShell` at `:1087-1152` and several `PaginatedTableFrame` surfaces at `:1513,1721,1752,1883,2042`; source and GitNexus disagree on the remaining consumer/blast radius. Do not delete or globally bridge the legacy shell until the discrepancy and handoff are resolved.

### Pillar 3: Color (2/4)

**WARNING — token system exists but is not enforced.** `index.css:52-88` defines IPC semantic colors and focus/shadow tokens, but the dirty stylesheet is 4,611 lines and contains extensive hardcoded declarations. TSX still has 12 hardcoded hex uses, including icon colors in `WeeklyMenuPage.tsx:2738,2766,2860,3122,3281,3432`, `ReportsPage.tsx:555,603,647,683,705`, and alternating row background at `order-table.tsx:174`.

**WARNING — accent/status discipline is mixed.** Blue, amber, red, green, slate, and direct icon colors are applied at route level rather than consistently through semantic tokens. This makes the 60/30/10 operational palette impossible to verify from source and increases dirty-global-style risk.

**DIRTY-ROUTE OWNERSHIP BLOCKER:** do not normalize `index.css` or route colors until its 641-line pre-existing diff is classified. A clean fix can replace hardcoded colors only in allowlisted shared primitives or a separately handed-off route hunk.

### Pillar 4: Typography (2/4)

**WARNING — scale is too fragmented for the contract.** Source uses standard Tailwind sizes plus arbitrary sizes such as `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[12.5px]`, `text-[13px]`, and `text-[14px]`; examples include `AdminDataPage.tsx:1222-1340,1969-2008`, `WeeklyMenuPage.tsx:832,854`, and `ReportsPage.tsx:753,759`.

**WARNING — weight hierarchy is broad and route-local.** `font-normal`, `font-medium`, `font-semibold`, `font-bold`, `font-black`, and multiple display sizes are present. `ChefDashboardPage.tsx:67` uses `text-4xl font-black`, while dense operational tables use 10–12px bold labels. The product can remain readable, but the v2 contract does not yet have a demonstrably controlled type hierarchy.

**SAFE CLEAN-ROUTE FIX:** define/check typography tokens at shared primitives and reserve very small labels for metadata with a documented minimum; migrate clean component classes first.

### Pillar 5: Spacing (2/4)

**WARNING — arbitrary dimensions are widespread.** Static scan found 145 arbitrary Tailwind dimension values. Fixed table heights are repeated in dirty/large route files, for example `WeeklyMenuPage.tsx:2925,3150,3224,3331,3490` and `AdminDataPage.tsx:1087`; these preserve existing geometry but are not yet expressed as canonical component tokens.

**WARNING — responsive evidence is narrow.** Fresh captures cover the three required viewport sizes, but the current server capture lands on the login surface without authenticated route traversal. The automated UI audit proves no global overflow for its protected-route fixtures, not that all route-specific fixed heights and action rows meet the tablet/mobile contract.

**SAFE CLEAN-ROUTE FIX:** inventory arbitrary values in allowlisted shared components, convert only values with a stable semantic meaning to tokens, and rerun the 375px/768px route checks serially.

### Pillar 6: Experience Design (2/4)

**PASS WITH WARNING — state primitives are present.** `TableViewport`, `PaginationBar`, `CursorPaginationBar`, `EmptyState`, `InlineAlert`, disabled mutation buttons, and `ConfirmDialog` provide the intended building blocks. `PaginationBar.tsx:17-19,30-44` clamps page state and exposes disabled navigation; `TableViewport.tsx:21-27` keeps a stable focusable region.

**WARNING — state coverage is not proven uniformly.** The UI contract requires every long-table consumer to cover loading, error, empty, no-result, mutating/stale states in the same viewport geometry. Many Admin/Reports empty rows are local helpers (`EmptyRow`) and the current evidence does not establish equal loading/error geometry across every table.

**WARNING — auth/backend evidence remains environmental.** The plan records protected-route smoke/login failures when fallback auth or backend availability is missing. The current `test:ui-audit` pass is useful for overflow/action controls, but it does not close the authenticated smoke and visual-baseline gate.

**DIRTY-ROUTE OWNERSHIP BLOCKER:** Admin CSV feedback and route-level state changes overlap the 613-line user-owned diff; do not move those handlers or consolidate feedback until ownership is explicitly reconciled.

## Safe Clean-Route Fixes

- Continue only within the `OWNERSHIP.md:13-24` allowlist and run the required impact/detect/test gates for shared symbols.
- Complete copy/token enforcement in shared components and clean route consumers.
- Add contract tests for stable state-slot geometry, accessible labels, pagination mode semantics, and reduced-motion behavior.
- Rerun serial controls/UI-audit/smoke/visual checks after each isolated slice; preserve snapshots unless a root cause and owner are recorded.

## Dirty-Route Ownership Blockers

- `WeeklyMenuPage.tsx` — 135-line pre-existing feature diff; visual and fixed-height findings are not safe to stage without hunk classification.
- `AdminDataPage.tsx` — 613-line pre-existing BOM/import/contract diff; legacy shell migration and feedback changes are blocked.
- `DashboardPage.tsx` and `frontend/src/styles/index.css` — current visual/copy/global-style changes cannot be separated from route regressions without handoff.
- `frontend/tests/visual-routes.spec.ts-snapshots/*` — dirty user-owned snapshots; no snapshot update was made.

## Verification Evidence

- `npm run test:ui-audit --workspace frontend`: 2/2 passed.
- `npm run test:visual --workspace frontend`: run without update mode; the route suite reported baseline mismatches beginning with Weekly Menu, Chef Dashboard, Reports, and Purchasing. Existing plan evidence records the broader run as 6/20 pass and 14/20 intentional baseline failures; these remain ownership/baseline findings.
- Fresh CLI captures: desktop/tablet/mobile at `localhost:5173`; unauthenticated capture shows the login surface, so it is not evidence of protected-route visual parity.
- No application source or visual snapshot was edited by this audit.

## Files Audited

- `.planning/quick/260717-ui-ux-system-refactor-v2/PLAN.md`
- `.planning/quick/260717-ui-ux-system-refactor-v2/UI-SPEC.md`
- `.planning/quick/260717-ui-ux-system-refactor-v2/OWNERSHIP.md`
- `.planning/quick/260717-ui-ux-system-refactor-v2/RISK-REGISTER.md`
- Existing `UI-REVIEW.md`, `BASELINE.md`, and `PAGINATION-CONTRACT-GAP.md`
- `frontend/src/components/common/TableViewport.tsx`
- `frontend/src/components/common/DataTableShell.tsx`
- `frontend/src/components/common/PaginationBar.tsx`
- `frontend/src/features/dashboard/pages/DashboardPage.tsx`
- `frontend/src/features/projects/pages/WeeklyMenuPage.tsx`
- `frontend/src/features/reports/pages/ReportsPage.tsx`
- `frontend/src/features/workflow/pages/AdminDataPage.tsx`
- `frontend/src/components/common/RoleInbox.tsx`
- `frontend/src/components/common/DocumentRail.tsx`
- `frontend/src/styles/index.css` and `frontend/src/styles/ui-redesign.css`
- frontend UI audit and visual Playwright specs/snapshots
