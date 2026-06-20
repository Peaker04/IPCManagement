---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 02 complete
stopped_at: FE-4.4/FE-4.5/FE-4.6 complete; FE-4.5 downloads CSV from authorized report rows because backend export URL does not return an Excel/blob file
last_updated: "2026-06-20T10:45:00+07:00"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 32
  completed_plans: 32
  percent: 100
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-13)

**Core value:** Staff can scan operational state quickly and complete kitchen-management tasks without visual confusion or workflow friction.
**Current focus:** Phase 02 — Data-driven Workflow Integration from IPC Sample Files

## Current Status

- GSD project context prepared for a brownfield frontend UI/UX refactor.
- Codebase maps already exist under `.planning/codebase/`.
- Phase 1 frontend UI/UX refactor is complete and audit-passed.
- Phase 1.1 recomposed the app around operational IA and workflow-specific page structures.
- Phase 1.1 UI design contract is approved and execution verification has passed.
- Phase 1.1 completed five execution plans across three waves.
- Phase 1.2 inserted to align the frontend IA with the IPC swimlane workflow in `.docs/unnamed (1).png`.
- Phase 1.2 planning is complete with six plans across three waves.
- Phase 1.2 Plan 01.2-01 completed workflow foundation, shared swimlane primitives, and protected route aliases.
- Phase 1.2 Plan 01.2-02 completed route-aware shell context and dashboard control-room recomposition.
- Phase 1.2 Plan 01.2-03 completed coordination mobile fixes and KHSX/demand workflow branch.
- Phase 1.2 Plan 01.2-04 completed approval, purchasing, warehouse, and admin lane workbenches.
- Phase 1.2 Plan 01.2-05 completed kitchen receiving/exception lifecycle and price report handoffs.
- Phase 1.2 Plan 01.2-06 completed lint/build, browser route smoke, and preservation verification.
- Phase 1.2 is complete and verified.
- Phase 1.2 UI review completed; dashboard and weekly menu layout density was reduced in remediation commit `293ac2b`.
- Phase 1.3 inserted to harden the full frontend UI/UX after the end-to-end workflow IA pass.
- Phase 1.3 planning is complete with six serialized plans across six waves.
- Phase 1.3 Plan 01.3-01 completed token reference and shared primitive hardening foundation.
- Phase 1.3 Plan 01.3-02 completed priority page token cleanup and responsive polish.
- Phase 1.3 Plan 01.3-03 completed motion and keyboard focus hardening.
- Phase 1.3 Plan 01.3-04 completed selective local feedback hardening while preserving existing dialogs.
- Phase 1.3 Plan 01.3-05 completed Playwright route smoke and focused visual regression coverage.
- Phase 1.3 Plan 01.3-06 completed final preservation, responsive, and regression audit.
- Phase 1.3 is complete and verified.
- Quick task `260614-rbd` removed the RoleInbox `GẤP!` chip and clock icon, then hardened badge/button text wrapping.
- Quick task `260614-rib` tightened dashboard RoleInbox action button sizing and metadata spacing after screenshot review.
- Quick task `260614-qu7` completed dashboard RoleInbox alignment with status anchored top-right, action anchored bottom-right, and two-column metadata.
- Quick task `260614-qk1` completed fixed-column alignment for role-inbox cards after pagination.
- Quick task `260614-q89` completed data-scale UI hardening for fixed cards, table containment, and pagination.
- Quick task `260613-fpl` completed backend coordination dish mapping verification.
- Quick task `260613-nav` completed sidebar workflow lane link update.
- Phase 1.4 inserted after Phase 1.3 as a deep UI/UX hardening pass for all current routes, using AISTHEA `.agent` `ui-ux-pro-max`, frontend-design, brainstorming, and plan-writing guidance as research input.
- Phase 1.4 planning is complete with six serialized plans across six waves.
- Phase 1.4 Plan 01.4-01 completed the deep UI contract, shared primitive hardening, and preservation baseline.
- Phase 1.4 Plan 01.4-02 completed shell, login, dashboard, and RoleInbox deep hardening with passing lint/build/smoke/visual verification.
- Phase 1.4 Plan 01.4-03 completed Weekly Menu and Coordination data-scale hardening with passing lint/build/smoke/visual verification.
- Phase 1.4 Plan 01.4-04 completed Chef, Approval, Purchasing, and Warehouse workbench hardening with passing lint/build/smoke/visual verification.
- Phase 1.4 Plan 01.4-05 completed Reports and Admin Data table/audit hardening with passing lint/build/smoke/visual verification.
- Phase 1.4 Plan 01.4-06 completed full-route visual, accessibility, preservation, and data-scale verification.
- Phase 1.4 is complete and verified.
- Quick task `260615-status-dot-alignment` completed shared status badge/dot alignment across current routes and verified geometry, smoke, and visual checks.
- Quick task `260615-badge-palette-hardening` completed restrained badge palette cleanup for shared status, dashboard inbox, coordination table, stock movement, and chef badges.
- Quick task `260615-semantic-card-backgrounds` removed noisy semantic background fills from operational cards while preserving severity via thin strips and small indicators.
- Quick task `260615-remove-mock-backend-notes` removed redundant UI notes and console warning about demo/mock frontend and backend persistence.
- Quick task `260615-remove-left-card-color-status` removed left-bordered operational cards and restored soft colored backgrounds to status badges/chips.
- Quick task `260615-row-based-layout` applied row-based layouts to cramped shared UI clusters across current routes and refreshed affected visual snapshots.
- Quick task `260615-operational-layout-sprawl` reduced vertical sprawl, over-boxing, wasted spacing, and repeated operational headings across current routes.
- Quick task `260615-single-column-workbench-panels` converted remaining asymmetrical two-column route wrappers into single-column full-width component stacks.
- Quick task `260615-omx` executed the Antigravity UI/UX audit, synchronized shared alignment/status/typography fixes across current routes, and refreshed visual baselines.
- Phase 2 added to turn the `.docs` sample files into backend-backed workflow data, replace frontend mocks, correct the IPC swimlane decisions, and add missing admin statistics/reporting.
- Phase 2 planning is prepared with six serialized plans covering sample-data contracts, backend seed/import, workflow APIs, frontend mock replacement, admin reports, and end-to-end verification.
- Phase 2 Plan 02-01 completed the sample data contract, parser strategy, source mapping, dry scan evidence, and canonical workflow locks.
- Phase 2 Plan 02-02 started backend sample import foundation with a package-free `.xlsx` reader, Development-only import endpoint, BOM/dish/ingredient/supplier import path, and backend tests.
- Phase 2 Plan 02-02 extended the sample importer to weekly DAV menu schedules, meal quantity plans/lines, supplier policies, receipts, stock movements, and current stock rows; backend build/tests pass and DB/API spot check remains before marking 02-02 complete.
- Phase 2 Plan 02-02 DB/API spot check could not complete yet: API is not listening on `localhost:5262`, MySQL is listening on `localhost:3306`, root/no-password is rejected, and no `appsettings.json` connection/JWT config exists in the worktree.
- Phase 2 Plan 02-03 started the backend material-demand API slice: demand is calculated from confirmed servings/menu items/BOM before current stock is applied, with `POST /api/material-demand/generate` and calculator tests.
- Phase 2 Plan 02-03 added purchase request generation from material shortage lines, `POST /api/purchase-workflow/from-demand`, `PurchaseAccess`, and planner tests; build passes and backend tests are 27/27.
- Phase 2 Plan 02-03 added kitchen excess inventory return API/service/repository, validates return quantities against the source issue, writes stock movement `RETURN`, and backend tests pass 29/29.
- Phase 2 Plan 02-03 added workflow report APIs for current stock, stock movements, workflow documents, demand, purchasing, receipt price variance, kitchen issue, issue-vs-return usage, audit changes, and order export; build passes and backend tests are 33/33.
- Phase 2 Plan 02-04 replaced primary frontend operational mock arrays with API-backed RTK Query hooks, removed workflowData/workflowSelectors, removed generated coordination order seed data, and passed frontend build/lint/route smoke.
- Phase 2 Plan 02-05 completed admin statistics and expanded report UI tabs for demand, purchase, stock, kitchen issue/export, issue-vs-return usage, price variance, and audit changes; frontend build/lint/route smoke pass and live DB/API spot checks move to 02-06.
- Phase 2 Plan 02-06 completed final verification: GitNexus up to date, sample import succeeded, live report APIs returned data for demand/purchase/stock/kitchen issue/issue-vs-return/price variance/audit, backend build/tests passed, and frontend build/lint/smoke passed.
- Quick task `260619-she` completed Kỳ-owned residual R-02/R-03/R-04 work: checkpointed the Phase 2 worktree, added `GET /api/dishes/catalog` with BOM/menu-slot details, guarded `/api/sample-data/*` with Production 404 behavior, refreshed GitNexus, and updated `Project_Tracking v.xlsx`.
- Quick task `260619-szs` marked Kỳ `BE-3.4` complete based on existing eager-load/catalog/demand code and stopped at `BE-3.5` because `BE-3.2` and `BE-3.3`/SDS are not ready.
- Quick task `260619-t7p` completed R-01/R-05/R-06: Weekly Menu and Chef preview now use backend catalog BOM data instead of `menuData.ts`, protected routes are code-split, visual baselines were refreshed, and frontend build/lint/smoke/visual checks pass.
- Quick task `260619-decimal-quantity-money-policy` completed shared decimal/quantity/money normalization across backend calculations, import/write payloads, API DTO mappings, and frontend operational display formatting.
- Quick task `260619-operational-card-overflow-copy` fixed approval/document card overflow with imported-style data, ellipsized long document codes, and added copy buttons for full document IDs.
- Quick task `260619-stable-main-scrollbar-gutter` fixed approval/context badge layout shift between tab panels with and without viewport scrollbar.
- Quick task `260619-remove-draft-order-status-banner` removed the coordination draft status alert/banner and its unused CSS/component file.
- Quick task `260619-remove-chef-draft-alert` removed the chef `Bản dự thảo từ điều phối` warning alert while preserving the locked-shift official alert.
- Quick task `260620-dlp` continued FE-3.1/FE-3.2/FE-3.3: normalized the catalog RTK Query hook name to `useGetDishesCatalogQuery`, verified Weekly Menu and Chef Dashboard use backend `/api/dishes/catalog` BOM data, and stopped FE-3.1's menu-schedule/meal-quantity hooks because BE-3.2/BE-3.3 endpoints/SDS are still absent.
- Quick task `260620-e0r` completed FE-3.4/FE-3.5/FE-3.6: catalog loading/error/empty states are visible in Weekly Menu and Chef Dashboard, `DEV_FALLBACK_DISHES`/`DEV_FALLBACK_RAW_MATERIALS` are absent from `frontend/src`, and frontend build/lint/smoke pass.
- Quick task `260620-edz` completed FE-4.1/FE-4.2 against available coordination APIs and completed FE-4.3 for syncing/draft/locked banner states; Completed/signoff remains blocked because BE-4.3/BE-4.4 endpoint/SDS is absent.
- Quick task `260620-emx` completed FE-4.4/FE-4.5/FE-4.6: coordination lock/export now use custom confirmation dialogs, export fetches authorized report rows and downloads CSV, and frontend build/lint/smoke plus a focused dialog check pass.

## Accumulated Context

### Roadmap Evolution

- Phase 1.1 inserted after Phase 1 as urgent follow-up work: Operational IA & Page Recomposition.
- Phase 1.1 planned as a route-preserving operational IA recomposition with shared workbench primitives, page-level workflow recomposition, and final responsive/preservation verification.
- Phase 01.2 inserted after Phase 1.1 as urgent follow-up work: End-to-End Kitchen Workflow IA. (URGENT)
- Phase 01.3 inserted after Phase 1.2 as urgent follow-up work: UI/UX Hardening & Visual Regression. (URGENT)
- Phase 01.4 inserted after Phase 1.3 as urgent follow-up work: UI/UX Deep Hardening All Routes. (URGENT)
- Phase 02 added after Phase 01.4: Data-driven Workflow Integration from IPC Sample Files.

## Active Phase

| Phase | Status | Next |
| --- | --- | --- |
| 02 Data-driven Workflow Integration from IPC Sample Files | Complete | FE-4.4/FE-4.5/FE-4.6 complete; FE-4.3 Completed/signoff still blocked on BE-4.3/BE-4.4 endpoint/SDS |

## Quick Tasks Completed

| Quick ID | Description | Date | Code Commit | Summary |
| --- | --- | --- | --- | --- |
| `260619-t7p` | R-01/R-05/R-06: catalog-backed menu/chef preview, route code-splitting, visual baselines | 2026-06-19 | `1511ceb` | [SUMMARY.md](./quick/260619-t7p-r-01-r-05-r-06-frontend-catalog-fallback/260619-t7p-SUMMARY.md) |
| `260620-emx` | FE-4.4/FE-4.5/FE-4.6 coordination confirmation dialogs, CSV export, verification | 2026-06-20 | `00c5baf` | [SUMMARY.md](./quick/260620-emx-fe-4-4-fe-4-5-fe-4-6-coordination-dialog/260620-emx-SUMMARY.md) |
| `260620-e0r` | FE-3.4/FE-3.5/FE-3.6 catalog states, fallback audit, frontend verification | 2026-06-20 | `6c7b56b` | [SUMMARY.md](./quick/260620-e0r-fe-3-4-fe-3-5-fe-3-6-catalog-loading-err/260620-e0r-SUMMARY.md) |
| `260620-edz` | FE-4.1/FE-4.2/FE-4.3 coordination API integration and status banner | 2026-06-20 | `87bb829` | [SUMMARY.md](./quick/260620-edz-fe-4-1-fe-4-2-fe-4-3-coordination-rtk-qu/260620-edz-SUMMARY.md) |
| `260620-dlp` | FE-3.1/FE-3.2/FE-3.3 catalog hook alignment and SDS blocker capture | 2026-06-20 | `1a8e295` | [SUMMARY.md](./quick/260620-dlp-fe-3-1-fe-3-2-fe-3-3-catalog-rtk-query-w/260620-dlp-SUMMARY.md) |
| `260619-szs` | Kỳ BE-3.4 complete; stopped before BE-3.5 SDS/dependency blocker | 2026-06-19 | no code change | [SUMMARY.md](./quick/260619-szs-continue-ky-be-3-4-stop-before-sds-block/260619-szs-SUMMARY.md) |
| `260619-she` | Kỳ R-02/R-03/R-04: catalog API, checkpoint commit, SampleData production guard | 2026-06-19 | `c5439ab` | [SUMMARY.md](./quick/260619-she-ky-r2-r3-r4-catalog-api-checkpoint-commi/260619-she-SUMMARY.md) |
| `260619-remove-chef-draft-alert` | gỡ alert Bản dự thảo từ điều phối ở màn bếp trưởng | 2026-06-19 | uncommitted | [SUMMARY.md](./quick/260619-remove-chef-draft-alert/260619-remove-chef-draft-alert-SUMMARY.md) |
| `260619-remove-draft-order-status-banner` | xóa banner trạng thái dự thảo ở màn điều phối | 2026-06-19 | uncommitted | [SUMMARY.md](./quick/260619-remove-draft-order-status-banner/260619-remove-draft-order-status-banner-SUMMARY.md) |
| `260619-stable-main-scrollbar-gutter` | ổn định scrollbar gutter để inline badge không nhảy khi đổi tab | 2026-06-19 | uncommitted | [SUMMARY.md](./quick/260619-stable-main-scrollbar-gutter/260619-stable-main-scrollbar-gutter-SUMMARY.md) |
| `260619-operational-card-overflow-copy` | sửa méo cột do số lượng/mã chứng từ dài và thêm copy mã chứng từ | 2026-06-19 | uncommitted | [SUMMARY.md](./quick/260619-operational-card-overflow-copy/260619-operational-card-overflow-copy-SUMMARY.md) |
| `260619-decimal-quantity-money-policy` | đồng bộ xử lý số lượng, tiền, phần trăm và payload hiển thị | 2026-06-19 | uncommitted | [SUMMARY.md](./quick/260619-decimal-quantity-money-policy/260619-decimal-quantity-money-policy-SUMMARY.md) |
| `260613-fpl` | xử lý và verify các thay đổi backend coordination còn uncommitted | 2026-06-13 | `8f417fb` | [SUMMARY.md](./quick/260613-fpl-x-l-v-verify-c-c-thay-i-backend-coordina/SUMMARY.md) |
| `260613-nav` | cập nhật các workflow lane còn thiếu lên thanh nav/sidebar | 2026-06-13 | `03c4757` | [SUMMARY.md](./quick/260613-nav-sidebar-workflow-links/SUMMARY.md) |
| `260614-q89` | data-scale UI hardening: fixed cards and paging for long-lived operational lists | 2026-06-14 | `0b9ebc7` | [SUMMARY.md](./quick/260614-q89-data-scale-ui-hardening-fixed-cards-and-/260614-q89-SUMMARY.md) |
| `260614-qk1` | fix role inbox fixed-column alignment after pagination | 2026-06-14 | `cb405ef` | [SUMMARY.md](./quick/260614-qk1-fix-role-inbox-fixed-column-alignment-af/260614-qk1-SUMMARY.md) |
| `260614-qu7` | fix dashboard role-inbox visual alignment after screenshot review | 2026-06-14 | `7ea755d` | [SUMMARY.md](./quick/260614-qu7-fix-dashboard-role-inbox-visual-alignmen/260614-qu7-SUMMARY.md) |
| `260615-status-dot-alignment` | fix shared status dot alignment across current routes | 2026-06-15 | `5bc411a` | [SUMMARY.md](./quick/260615-status-dot-alignment/260615-status-dot-alignment-SUMMARY.md) |
| `260615-badge-palette-hardening` | restrain noisy badge colors across current routes | 2026-06-15 | `799b573` | [SUMMARY.md](./quick/260615-badge-palette-hardening/260615-badge-palette-hardening-SUMMARY.md) |
| `260615-semantic-card-backgrounds` | remove noisy semantic background fills from operational cards | 2026-06-15 | `50657fd` | [SUMMARY.md](./quick/260615-semantic-card-backgrounds/260615-semantic-card-backgrounds-SUMMARY.md) |
| `260615-remove-mock-backend-notes` | remove redundant mock/demo/backend notes from UI | 2026-06-15 | `676fde3` | [SUMMARY.md](./quick/260615-remove-mock-backend-notes/260615-remove-mock-backend-notes-SUMMARY.md) |
| `260615-remove-left-card-color-status` | remove left-bordered cards and color status badge backgrounds | 2026-06-15 | `4083f66` | [SUMMARY.md](./quick/260615-remove-left-card-color-status/260615-remove-left-card-color-status-SUMMARY.md) |
| `260615-row-based-layout` | apply row-based layouts to cramped shared UI clusters | 2026-06-15 | `4c8da69` | [SUMMARY.md](./quick/260615-row-based-layout/260615-row-based-layout-SUMMARY.md) |
| `260615-operational-layout-sprawl` | reduce vertical sprawl and over-boxed operational layout | 2026-06-15 | `a0c0159` | [SUMMARY.md](./quick/260615-operational-layout-sprawl/260615-operational-layout-sprawl-SUMMARY.md) |
| `260615-single-column-workbench-panels` | convert asymmetrical two-column route wrappers to full-width stacks | 2026-06-15 | `51885da` | [SUMMARY.md](./quick/260615-single-column-workbench-panels/260615-single-column-workbench-panels-SUMMARY.md) |
| `260615-omx` | execute Antigravity UI/UX audit fixes across current routes | 2026-06-15 | `none` | [SUMMARY.md](./quick/260615-omx-audit-ui-ux-hi-n-t-i-v-l-p-plan-ng-b-ch-/260615-omx-SUMMARY.md) |
| `260614-rib` | tighten dashboard role-inbox action button sizing and metadata spacing | 2026-06-14 | `457e6bb` | [SUMMARY.md](./quick/260614-rib-tighten-role-inbox-actions/260614-rib-SUMMARY.md) |
| `260614-rbd` | remove dashboard role-inbox urgent chip and clock icon overflow | 2026-06-14 | `87a7b40` | [SUMMARY.md](./quick/260614-rbd-remove-urgent-clock-overflow/260614-rbd-SUMMARY.md) |
| `260618-mysql-phase2-import-export` | tạo file import MySQL Phase 2 và báo cáo đối chiếu dữ liệu chưa thêm | 2026-06-18 | `none` | [SUMMARY.md](./quick/260618-mysql-phase2-import-export/260618-mysql-phase2-import-export-SUMMARY.md) |

## Session

**Stopped at:** Phase 02 complete after MySQL import SQL export and comparison report
**Resume file:** `.planning/phases/02-data-driven-workflow-integration-from-ipc-sample-files/02-06-CHECKPOINT.md`

---
*Last updated: 2026-06-18 after creating Phase 2 MySQL import SQL and comparison report*

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 01.4 P01 | 9 min | 3 tasks | 8 files |
| Phase 01.4 P02 | resumed | 3 tasks | shell/login/dashboard RoleInbox hardening |
| Phase 01.4 P03 | continued | 3 tasks | weekly menu and coordination data-scale hardening |
| Phase 01.4 P04 | continued | 3 tasks | chef and workflow lane hardening |
| Phase 01.4 P05 | continued | 3 tasks | reports and admin data audit hardening |
| Phase 01.4 P06 | continued | 4 tasks | full route verification and UIDH evidence mapping |
| Phase 02 Planning | active | 6 plans | data-driven workflow integration from `.docs` sample files |
| Phase 02 P01 | completed | 1 contract | sample data dry scan, mapping, and parser strategy |
| Phase 02 P02 | in progress | backend | sample import endpoint, xlsx reader, BOM/menu/quantity/receipt/stock import path; awaiting DB/API spot check |
| Phase 02 P03 | in progress | backend | material demand, purchase request, inventory return, stock/report APIs, and order export reroute added; DB/API smoke remains |
| Phase 02 P04 | completed | frontend | primary operational mocks replaced with API hooks; build/lint/smoke pass; seeded DB spot check remains for final verification |
| Phase 02 P05 | completed | frontend | admin statistics and report tabs completed; build/lint/smoke pass; live API spot check remains for final verification |
| Phase 02 P06 | completed | verification | sample import, GitNexus refresh, backend/frontend verification, API spot checks, and mock-removal audit completed |

## Decisions

- [Phase 01.4]: 01.4-01: Keep table/list growth contained in DataTableShell and pagination primitives without API or Redux changes.
- [Phase 01.4]: 01.4-01: Record preservation baseline without staging pre-existing forbidden-boundary dirty work.
- [Phase 01.4]: 01.4-01: Use shared ipc-task-card aliases before route-specific card hardening.
- [Phase 01.4]: 01.4-02: Use direct CSS grid areas for RoleInbox status/main/action so status remains top-right and action bottom-right across 375px through 1920px.
- [Phase 01.4]: 01.4-02: Update dashboard visual snapshot after intentional RoleInbox layout hardening and require full visual suite rerun.
- [Phase 01.4]: 01.4-03: Keep Weekly Menu schedule as a contained horizontal matrix while adding internal scroll boundaries for long-lived cost/demand data.
- [Phase 01.4]: 01.4-03: Add Coordination display pagination locally in `OrderTable` without changing Redux state or order calculations.
- [Phase 01.4]: 01.4-04: Keep wide chef/workflow tables inside named `DataTableShell` scroll regions so mobile/tablet layouts have zero page-level overflow.
- [Phase 01.4]: 01.4-04: Add local display pagination to `DemandSummary` without changing workflow data, API, Redux, or route behavior.
- [Phase 01.4]: 01.4-05: Make `DataTableShell` focusable so keyboard users can reach scrollable report/admin table regions.
- [Phase 01.4]: 01.4-05: Replace Admin audit reason truncation with wrapped, bounded, inspectable long-text cells.
- [Phase 01.4]: 01.4-06: Use direct Playwright route matrix as final browser evidence because the in-app Browser tool was unavailable.
- [Phase 01.4]: 01.4-06: Treat existing unstaged `coordinationSlice.ts` diff as preserved dirty work outside Phase 01.4 committed scope.
- [Quick 260615-row-based-layout]: Prefer shared row-list CSS over per-route card grids for dense operational summaries, with mobile single-column fallbacks.
- [Quick 260615-operational-layout-sprawl]: Remove redundant child headings and repeated Dashboard lane navigation when parent sections or swimlane actions already carry the same information.
- [Quick 260615-single-column-workbench-panels]: Prefer full-width stacked operational components over asymmetrical main-plus-rail wrappers on route workbenches.
- [Phase 02]: Warehouse flow is approved demand -> warehouse picks/exports by list -> record issue document -> stock movement -> chef signs receipt.
- [Phase 02]: System flow calculates material demand from BOM before checking stock; stock check branches to issue demand or suggested purchase shortage.
- [Phase 02]: Chef flow has one post-cooking excess/shortage check; excess creates return, shortage creates supplemental issue request, matched usage completes the shift/KHSX.
- [Phase 02]: Admin must include statistics/reporting for demand, purchasing, stock, receipt price variance, kitchen issue, issue-vs-return usage, and audit/BOM/stock changes.
- [Phase 02]: Start with a dev/sample seed runner or bounded backend import service; full admin Excel upload can wait until the data contract and APIs stabilize.
- [Phase 02]: Represent savory/vegetarian/main/side/soup/dessert menu sections through `menuItems.dishSlot` under the existing schema.
