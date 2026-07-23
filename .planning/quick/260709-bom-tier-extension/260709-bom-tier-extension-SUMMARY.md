---
quick_id: 260709-bom-tier-extension
title: Iter1 Production Plan BOM tier extension
status: verified
date: 2026-07-09
linked_phase: Iter1_Production_Plan
---

# Summary

Implemented an addendum over `Iter1_Production_Plan` for BOM by price tier and customer override, planned purchase day/week views, and daily production plan handoff to kitchen.

## Delivered

- Extended BOM data with fixed price tiers `25000`, `30000`, `34000` and optional customer override scope.
- Added Excel-compatible CSV BOM template download, import preview, and all-or-nothing commit endpoints.
- Updated material demand generation to resolve BOM by customer override first, then global tier, and reject non-standard menu prices.
- Added purchase-plan report API with `groupBy=day|week`.
- Added daily production plan API and send-to-kitchen action.
- Added Admin Data BOM import UI, Reports purchase-plan UI, Chef daily plan panel, and Weekly Menu workflow/tier warnings.
- Added EF migration metadata/snapshot so `AddBomTierWorkflow` is discoverable and can be applied by `dotnet ef database update`.

## Verification

- `dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj` passed.
- `dotnet test backend/IPCManagement.slnx --no-restore` passed: 191/191.
- `npm run verify` passed.
- `npm run build --workspace frontend` passed.
- `npm run lint --workspace frontend` passed.
- `npm run test:smoke --workspace frontend` passed: 13/13.
- `npm run verify:release:audit` passed: AUDIT_PASS.
- `npm run e2e:exceptions` passed after applying the new EF migration to the local dev DB.
- `npm run benchmark:workflow` passed.
- `npm run test:visual --workspace frontend` passed after refreshing the intended mobile snapshots for Weekly Menu and Chef Dashboard.

## Follow-up

- Apply the new EF migration in any other demo/staging DB before live API testing.

## Refactor Update - 2026-07-09

- Removed the old Admin Data manual BOM adjustment panel from the active code path; BOM maintenance now goes through tier/customer template download, preview, and commit.
- Removed frontend API hooks and UI usage for `purchase-demand` and `purchase-workflow/from-demand`; purchase screens now show `purchase-plan` as the planning source and use existing purchase requests only for supplier/order actions.
- Normalized purchase workflow document wording to `Đơn mua` instead of the legacy `Danh sách mua thêm` label.
- Updated route smoke and visual fixtures to the new purchase-plan contract.
- Verification passed after refactor: `dotnet test backend/IPCManagement.slnx --no-restore`, `npm run lint --workspace frontend`, `npm run build --workspace frontend`, `npm run test:smoke --workspace frontend`, and `npm run test:visual --workspace frontend`.
- GitNexus `detect_changes` completed and reported HIGH risk because the overall phase touches backend model/service flows plus frontend workflow pages; no HIGH impact was reported for the individual refactored FE pages before edit.

## Refactor Update - 2026-07-10

- Removed Weekly Menu manual portion adjustment controls (`menuPrice`, preprocessing loss rate, computed quantity factor) from the active UI and calculation path.
- Weekly Menu now displays a read-only fixed BOM tier strip for `25k`, `30k`, and `34k`; invalid legacy schedule prices are surfaced as blocking tier warnings before demand generation.
- Weekly menu Excel import now requires a fixed BOM tier per import job and sends `priceTierAmount` through preview and commit.
- Backend weekly menu import now persists the selected fixed tier directly to schedule pricing with BOM rate `100%`, instead of falling back to customer contract/default manual policy.
- Import, edit, and rollback modals on Weekly Menu were aligned to the dense IPC operations style with clearer headers, bounded content, and visible tier/status columns.
- Verification passed after this refactor: `dotnet test backend/IPCManagement.slnx --no-restore`, `npm run lint --workspace frontend`, `npm run build --workspace frontend`, `npm run test:smoke --workspace frontend`, and `npm run test:visual --workspace frontend`.
- GitNexus `detect_changes` completed and reported HIGH risk for the accumulated phase worktree (`42 files`, `38 symbols`, `9 affected processes`); the new Weekly Menu symbol impact checked before edit was LOW.

## UI Adjustment - 2026-07-10

- Weekly Menu fixed BOM context strip now shows only the active BOM tier for the current menu instead of rendering all `25k/30k/34k` choices outside the import flow.
- The Weekly Menu import modal now uses a dropdown for BOM tier selection, aligned with the customer/week/file form controls.
- The `Định mức BOM cố định`, `Nguồn định mức`, and `BOM áp dụng` fields were balanced into equal columns with matching value-box height and label rhythm.
- Verification passed: `npm run lint --workspace frontend`, `npm run build --workspace frontend`, `npm run test:visual --workspace frontend`, and `npm run test:smoke --workspace frontend`.

## Backend Warning Fix - 2026-07-10

- Configured MySQL EF Core queries to use `QuerySplittingBehavior.SplitQuery` by default in backend service registration.
- This removes the runtime `MultipleCollectionIncludeWarning` for report/workflow queries that load more than one collection navigation.
- Verification passed: `dotnet test backend/IPCManagement.slnx --no-restore` (`191/191`).

## Production Plan UI Adjustment - 2026-07-10

- Adjusted the Weekly Menu production-plan tab so the `Ngày phục vụ:` filter label stays on one line.
- Reworked weekly production-plan rendering into day-based pagination; only the active day page is rendered when viewing the whole week.
- Added compact page summary controls for plan count, line count, and total servings while keeping the detailed KHSX table lazy-rendered per active page.
- Verification passed: `npm run lint --workspace frontend`, `npm run build --workspace frontend`, `npm run test:visual --workspace frontend`, and `npm run test:smoke --workspace frontend`.

## Production Plan Week Filter Fix - 2026-07-10

- Root cause: the production-plan tab called `/production-plans/filter` with only `customerId` when `Cả tuần` was selected, so older production plans for the same customer could appear before the current menu week.
- Fixed Weekly Menu to filter returned production plans by the dates visible in the currently selected menu week when no single service date is selected.
- This prevents historical dates such as `18/6/2026` from appearing in the current weekly production-plan pagination.
- Verification passed: `npm run lint --workspace frontend`, `npm run build --workspace frontend`, `npm run test:visual --workspace frontend`, and `npm run test:smoke --workspace frontend`.
