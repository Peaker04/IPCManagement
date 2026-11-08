# MRX new-menu entry and scope handoff — approved design

## Intent and authority
Owner approved the proposed end-to-end flow on 2026-11-06 and requires a complete owner-level repair, not a button-only patch. From Dashboard, “Lập lô đối soát mới” opens the existing weekly-menu import dialog. The MRX preparation page also exposes “Nhập thực đơn mới” while inspecting an old/completed batch. A successful import selects the imported customer/week; cancel or failure does not change the inspected batch.

Contracts: FR-DASH, FR-MENU, FR-RECON; DOM-MODE-1; MRX source grain customer × week; BR-MRX-EDIT-1/2/3/6, BR-MRX-SERV-2; DESIGN UXR-03, D7, M1.2, M3, N6, C1–C12. Existing preview/commit, source-change approvals, locked dates and completed-batch guards remain authoritative. An import is not automatic batch creation.

## Approaches
- Rename the Dashboard button and instruct users to change week manually: smaller, but leaves the reported missing entry and successful-import scope defect unresolved. Rejected.
- Reuse the existing import dialog and existing route/workspace owners, with explicit creation intent and a successful-import scope handoff: selected and approved.
- Add a new creation page, API or global wizard/store: duplicates existing authority. Rejected.

## Ownership and behavior
- Dashboard expresses the navigation intent as `/weekly-menu?view=mrx-batch&action=import`. The ordinary MRX source navigation continues to inspect the current scope.
- MRX workbench owns dialog opening/closing and checks the existing authoring role/permission/mode. URL intent cannot bypass those checks. Removing only `action` on close must preserve other query parameters. No automatic POST occurs on navigation, reload or reopening.
- Header receives the existing `onOpenImport` callback and renders a named new-menu action only when authorized. This permission is independent of whether the currently viewed batch is completed; reimport/edit permissions for that batch stay locked.
- New-menu import requires selecting the target week explicitly rather than silently inheriting the completed batch's week. Reimport retains the inspected source scope. Both use the one `WeeklyMenuImportModal`; no second blocking modal or parallel importer.
- Import dialog mounts on demand so prior file, preview, history or error cannot survive a close/reopen into another scope. Existing modal dirty-close/navigation protection is used for selected files/previews; every manual close path uses the same safe-close callback, and pending requests cannot be dismissed. Successful commit may close without a discard prompt.
- A successful import notifies callers of the committed request's customerId and ISO weekStartDate. Rollback/history refresh remains a refresh-only event, not an imported-scope navigation. DEFAULT caller compatibility is preserved.
- MRX hook remains the owner of active customer/week, source query and preview invalidation. Explicit URL scope takes precedence over session/cache; success updates the URL and session consistently and invalidates the affected preview before reading the imported scope. Prior-scope data must not become editable/actionable under new selectors while waiting; delayed old responses cannot select the old batch or restore old session identity.
- Existing server preview diagnostics reject locked/completed targets; the new entry does not reinterpret a rejected import as success, clear locks, fabricate servings/BOM or rewrite an old batch. Same-week changes continue through existing source-change approval semantics.

## Boundaries and exclusions
Only existing FE owners and their tests change. No BE/API/generated-contract/schema/permission-policy changes, package installation, database mutations, seed, browser login, deployment, staging or commit. Do not redesign shared headers or generic query caches. Preserve inherited working-tree changes and the earlier Dashboard spacing repair.

## Acceptance
1. Dashboard new action opens the real importer despite an old/completed cached scope; ordinary navigation does not.
2. Authorized preparation users can start a new import while old-batch editing remains unavailable. Forbidden roles/modes cannot open it via URL.
3. Cancel, failure and locked preview leave old data/scope intact; close/reopen has no stale file/token and dirty input is protected.
4. Successful import of another customer/week requests, selects and displays that scope, including same-route navigation and delayed-response conditions; no automatic batch creation.
5. DEFAULT import and MRX reimport/history approval/locked-day tests remain green. Owner performs live visual/workflow UAT; local checks do not certify real writes.
