---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: executing
stopped_at: Completed 09-14-PLAN.md with operator-accepted disposable evidence; 09-05 residual checkpoint preserved
last_updated: "2026-07-23T00:57:19.966Z"
last_activity: 2026-07-23 — Plan 09-14 accepted after two restored Shipyard rounds; no real apply
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 37
  completed_plans: 14
  percent: 38
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-13)

**Core value:** Staff can scan operational state quickly and complete kitchen-management tasks without visual confusion or workflow friction.
**Current focus:** v1.1 Phase 9 — Supplier canonical refresh and purchasing workflow alignment

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
- Cleanup run 2026-07-03 archived all completed phase directories into `.planning/milestones/v1.0-phases/` and removed only generated artifacts/build outputs from the conservative allowlist.
- GSD code review report was written to `.planning/milestones/v1.0-phases/02-data-driven-workflow-integration-from-ipc-sample-files/02-REVIEW.md`; status is `issues_found` with 3 Critical and 2 Warning findings.
- 2026-07-07 review follow-up closed the release gate: `.artifacts/release-gates/20260707-123452/quality-gate-summary.md` passed backend build, backend tests, frontend lint, frontend build, frontend smoke, seed reset, and selected E2E evidence after local EF migrations were applied and the demo seed/import reset was rerun.
- 2026-07-07 tracker follow-up marked `MVP-038` done after demo seed/import reset evidence and marked `MVP-039` done after refreshing `.docs/MVP_MANUAL_RUNBOOK.md`, `.docs/MVP_DEMO_DATA.md`, and `.docs/ITER1_RELEASE_QUALITY_GATE.md` to current script paths and demo anchors.
- 2026-07-07 tracker follow-up marked `MVP-040` done after closing the current seed-reset/local-migration and approval-smoke blockers, committing `a2f971c`, and rerunning the full release gate successfully.
- 2026-07-07 P0 tracker follow-up closed `MVP-030` Warehouse UI, `MVP-032` Chef Receive, and `MVP-034` Chef UI: WarehousePage now calls `POST /api/inventory-issues`, ChefDashboardPage uses live kitchen issue rows and `confirmInventoryIssueReceipt`, frontend lint/build/smoke pass, and live confirm API returned success with pendingAfter=0.
- 2026-07-07 P1 tracker follow-up closed `MVP-033` Kitchen Return: ChefDashboardPage now posts excess/waste returns to `POST /api/inventory-returns` from live kitchen issue rows, frontend lint/build/smoke pass, and live verification created `RET-20260707-130839-327D` with issue-vs-return delta +0.01 plus RETURN stock movement evidence.
- 2026-07-07 P1 tracker follow-up closed `MVP-035` Minimal Audit: audit report actor fallback prevents null `changedByName`, live `/api/workflow-reports/audit-changes?limit=300` returned missingRequired=0 with Import/Demand/Purchasing/Approval/Receipt/Issue/KitchenReceipt/Signoff examples, and ApprovalPage now sends backend enum values for live approval decisions.
- 2026-07-07 final MVP tracker reconciliation closed `MVP-017` Cost Calculation and `MVP-018` Export Minimal from existing code/live evidence: WeeklyMenuPage cost tab calculates BOM/reference-price costs with missing-BOM fallback, export CSV includes week/customer/material/quantity/unit/cost fields, and live catalog/demand APIs returned BOM/reference price plus shortage rows. `Project_Tracking (1).xlsx` now has zero open MVP rows.
- 2026-07-08 production-plan follow-up fixed Weekly Menu KHSX day filtering so `/api/production-plans/filter` receives an ISO service date instead of the UI day key (`t2`, `t3`, ...). Verify: GitNexus impact LOW / 0 affected processes, detect_changes LOW, frontend lint/build pass, backend build/tests 182 passed, frontend smoke 9 passed.
- 2026-07-08 PRD-130 completed in `Iter1_Production_Plan`: `/reports` now includes backend-backed Data quality tab and CSV export alongside demand, purchase, stock, movement, kitchen, usage, and audit report exports. Verify: GitNexus impact LOW for ReportsPage, detect_changes MEDIUM with ReportsPage flow only, frontend lint/build pass, route smoke 9/9 pass. `Project_Tracking (1).xlsx` row PRD-130 was updated to Done.
- 2026-07-08 PRD-131 completed in `Iter1_Production_Plan`: data-quality API DTO now includes owner, backend assigns owner by issue category/route, and Reports/Admin Data show owner + severity + remediation route. Verify: GitNexus impact LOW for GetDataQualityAsync/BuildDataQualityIssue/AdminDataPage/mapDataQualityReport, detect_changes MEDIUM, backend build pass, backend tests 182/182 pass, frontend lint/build pass, route smoke 9/9 pass. `Project_Tracking (1).xlsx` row PRD-131 was updated to Done.
- 2026-07-08 PRD-132 completed in `Iter1_Production_Plan`: audit rows now keep `businessArea` as an explicit group in workflowApi, Reports audit table/export, and Admin Data audit table so Import/Approval/Receipt/Issue/Signoff/Regenerate changes are not mixed together. Verify: GitNexus impact LOW for mapAuditChange/ReportsPage/AdminDataPage, detect_changes MEDIUM, frontend lint/build pass, route smoke 9/9 pass. `Project_Tracking (1).xlsx` row PRD-132 was updated to Done.
- 2026-07-08 PRD-133 completed in `Iter1_Production_Plan`: Playwright smoke coverage now verifies Reports date/shift filters, CSV export, audit business-area grouping, data-quality remediation link, and seeded workflow stages across demand, purchase, stock, movement, kitchen, usage, audit, and data-quality tabs. Verify: GitNexus impact LOW for stubWorkflowReports/ReportsPage, detect_changes MEDIUM for current diff, frontend lint/build pass, route smoke 10/10 pass. `Project_Tracking (1).xlsx` row PRD-133 was updated to Done.
- 2026-07-08 PRD-140 completed in `Iter1_Production_Plan`: data-quality issue remediation now records resolve/reopen audit events, keeps persistent computed issues visible with remediation status/counts, and exposes Resolve/Reopen in Admin Data plus remediation status in Reports export/table. Verify: GitNexus impact LOW before edits for GetDataQualityAsync/BuildDataQualityIssue/WorkflowReportsController/AdminDataPage/mapDataQualityReport; post-change detect_changes CRITICAL on total working diff, backend build pass, backend tests 183/183 pass, frontend lint/build pass, route smoke 10/10 pass. `Project_Tracking (1).xlsx` row PRD-140 was updated to Done.
- 2026-07-09 PRD-141 completed in `Iter1_Production_Plan`: data-quality issues now carry owner, priority rank, SLA hours/due-at/label by category, urgent issue count, and urgent-first ordering so production knows what to process first. Reports/Admin Data show SLA priority and Reports CSV exports SLA/priority. Verify: GitNexus impact LOW before edits for BuildDataQualityIssue/AdminDataPage/ReportsPage/mapDataQualityReport, post-change detect_changes CRITICAL on total working diff, backend build pass, backend tests 183/183 pass, frontend lint/build pass, route smoke 10/10 pass. `Project_Tracking (1).xlsx` row PRD-141 was updated to Done.
- 2026-07-09 PRD-143 completed in `Iter1_Production_Plan`: data-quality regression coverage now verifies missing BOM, missing contract, missing/inactive supplier, stale demand, stale purchase request, invalid unit/conversion, negative stock, and orphan document issues. Verify: GitNexus impact LOW for GetDataQualityAsync/test symbol before edits, post-change detect_changes CRITICAL on total working diff, backend build pass, backend tests 183/183 pass, frontend lint/build pass, route smoke 10/10 pass. `Project_Tracking (1).xlsx` row PRD-143 was updated to Done.
- 2026-07-09 PRD-150 completed in `Iter1_Production_Plan`: deployment config now has Demo/LAN runtime templates, production placeholder validation covers DB/JWT/CORS/host placeholders, and README documents dev/demo/LAN/production config separation plus LAN run command. Verify: GitNexus impact LOW for DeploymentConfigurationValidator.Validate and tests, post-change detect_changes CRITICAL on total working diff, backend build pass, validator tests 4/4 pass, backend tests 184/184 pass. `Project_Tracking (1).xlsx` row PRD-150 was updated to Done.
- 2026-07-09 PRD-151 completed in `Iter1_Production_Plan`: migration deploy now has `scripts/Invoke-Iter1MigrationPlan.ps1` to audit latest EF migration, write `.artifacts/migrations/<timestamp>/migration-plan-summary.md`, and apply migrations with `-Apply` instead of manual DB edits. README documents the audit/apply commands. Verify: migration audit pass with latest migration `20260708130000_RestorePurchaseRequestReceiptStatuses`, backend build pass, post-change detect_changes CRITICAL on total working diff. `Project_Tracking (1).xlsx` row PRD-151 was updated to Done.
- 2026-07-09 PRD-152 completed in `Iter1_Production_Plan`: seed modes now route through `scripts/Invoke-Iter1SeedMode.ps1`, separating `DemoReset` from `ProductionBaseline`; quality gate uses the wrapper, demo reset blocks public targets unless explicitly allowed, and production baseline does not call sample-data import. Verify: DemoReset audit pass, ProductionBaseline audit pass, quality gate audit pass, backend build pass, post-change detect_changes CRITICAL on total working diff. `Project_Tracking (1).xlsx` row PRD-152 was updated to Done.
- 2026-07-09 PRD-153 completed in `Iter1_Production_Plan`: release verification is now one npm command via `npm run verify:release` plus `npm run verify:release:audit`; the quality gate includes backend restore, frontend restore, backend build/tests, frontend lint/build/smoke, and seed-mode evidence. Verify: `npm run verify:release:audit` pass with `.artifacts/release-gates/20260709-002600/quality-gate-summary.md`, backend build pass, post-change detect_changes CRITICAL on total working diff. `Project_Tracking (1).xlsx` row PRD-153 was updated to Done.
- 2026-07-09 PRD-170 completed in `Iter1_Production_Plan`: happy path E2E now runs through live backend/DB with `npm run e2e:happy -- -SkipSeedReset`, covering demand approval, purchase request submit/approval, purchase order receipt, inventory issue, kitchen receipt, and workflow reports. It also fixed live blockers: demand approval endpoint and purchase-request status filter translation. Verify: `.artifacts/e2e/20260709-004127175/happy-path-e2e-summary.md` PASS, backend build pass, backend tests 184/184 pass, post-change detect_changes CRITICAL on total working diff. `Project_Tracking (1).xlsx` row PRD-170 was updated to Done.
- 2026-07-09 PRD-171 completed in `Iter1_Production_Plan`: exception path E2E now runs with `npm run e2e:exceptions`, covering stale demand, missing BOM data-quality issue, stock shortage 409 with suggested action, rejected approval via order adjustment, remediation resolve, and recovery continuation through demand/purchase regeneration. Verify: `.artifacts/e2e/20260709-103742321/exception-path-e2e-summary.md` PASS.
- 2026-07-09 PRD-180 completed in `Iter1_Production_Plan`: `.docs/ITER1_ACTOR_RUNBOOK.md` now gives actor-specific operating steps for Admin, Operations, Planner, Purchasing, Warehouse, Chef, and Manager, including exception recovery and verification commands. Verify: release gate and README link the runbook.
- 2026-07-09 PRD-181 completed in `Iter1_Production_Plan`: `.docs/ITER1_DAILY_CHECKLIST.md` now gives daily/weekly operating checks for import, validation, signoff, demand generation, purchase approval, warehouse receipt/issue, kitchen close, reports/audit, and exception response. Verify: release gate and README link the checklist.
- 2026-07-09 PRD-190 completed in `Iter1_Production_Plan`: `.docs/ITER1_DESTRUCTIVE_ENDPOINT_AUDIT.md` now registers reset/delete/regenerate endpoints, production rules, and verification evidence for hiding `/api/sample-data/*` outside Development. Verify: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter SampleDataProductionGuard --no-restore` passed 1/1.
- 2026-07-09 PRD-191 completed in `Iter1_Production_Plan`: production frontend builds no longer expose mock login hints, dev fallback credentials, or `dev-login-fallback-token` strings. Dev fallback remains explicitly gated behind `DEV && VITE_ENABLE_MOCK_LOGIN=true`. Verify: GitNexus impact LOW for `LoginPage` and `baseQueryWithAuthHandling`; `npm run lint:fe`, clean `npm run build:fe`, `npm run test:smoke -w frontend`, and production bundle grep returned `no_prod_mock_strings_found`.
- 2026-07-09 PRD-142 completed in `Iter1_Production_Plan`: workflow reports now expose `POST /api/workflow-reports/data-quality/cleanup` with dry-run-by-default cleanup for safe orphan/stale workflow documents. Apply mode removes only eligible `DRAFT/CANCELLED/FAILED/IMPORT_FAILED` orphan/stale demand, purchase, and inventory issue records that have no receipt/order/return/stock-movement downstream, and writes DataQuality Cleanup audit logs. Verify: backend build pass, data-quality tests 3/3 pass, backend tests 185/185 pass.
- 2026-07-09 PRD-160 completed in `Iter1_Production_Plan`: API requests now accept or generate `X-Correlation-ID`, propagate it through `HttpContext.TraceIdentifier`, response headers, logging scopes, and Serilog console/file output so import, generation, approval, warehouse, and signoff calls can share one production-week trace key. Verify: correlation middleware tests 3/3 pass, backend build pass, backend tests 188/188 pass.
- 2026-07-09 PRD-161 completed in `Iter1_Production_Plan`: `GET /api/workflow-reports/operational-kpis` now surfaces failed workflow/import records, data-quality errors, and approvals waiting beyond the operational threshold. Admin > Thống kê shows all three signals with direct handoff to Reports, Data Quality, and Approvals so production does not depend on a developer console. Verify: focused KPI test pass, backend tests 189/189 pass, frontend lint/build pass, route smoke 10/10 pass.
- 2026-07-09 PRD-172 completed in `Iter1_Production_Plan`: Playwright visual coverage now captures 10 workflow routes at 1365x900 desktop and 390x844 mobile with deterministic API fixtures and settled network/UI state. Twenty baseline images were generated and inspected for overlap, horizontal overflow, and operational layout quality. Verify: visual update 20/20 pass, repeated visual suite 20/20 pass, frontend lint/build pass.
- 2026-07-09 PRD-173 completed in `Iter1_Production_Plan`: route smoke now executes the approval decision, warehouse issue creation, and kitchen receipt signoff as one operational flow at 768px tablet and 390px mobile, checking request payloads, success feedback, and horizontal overflow after every lane. Verify: focused mobile UAT 2/2 pass, full route smoke 12/12 pass, frontend lint/build pass.
- 2026-07-09 PRD-200 completed in `Iter1_Production_Plan`: workflow reports now expose cursor-page contracts for stock movements and audit changes, bound every audit source query by cursor/limit, support ascending or descending date order, and keep the original array endpoints compatible. Reports > Nhập/xuất kho and Audit use server-side cursor navigation with date filters and sort controls. Verify: focused backend paging tests 2/2 pass, backend tests 190/190 pass, frontend lint/build pass, route smoke 13/13 pass, visual suite 20/20 pass.
- 2026-07-09 PRD-201 completed in `Iter1_Production_Plan`: purchase generation now batch-loads effective quotations, active suppliers, and latest receipt context instead of issuing per-shortage-line database queries. `npm run benchmark:workflow` verifies a 12-customer, 12-ingredient, 7-day dataset with 1,008 demand and 1,008 purchase lines. Baseline was 4,102 SELECTs/about 3 seconds; optimized evidence was 91 SELECTs/1,048 ms. Verify: benchmark pass, backend build pass, backend tests 191/191 pass.
- 2026-07-09 tracker status after PRD-201 implementation: 66 P0 Done, 0 P0 Backlog, 14 P1 Done, 0 P1 Backlog. All 80 implementation rows are complete; workbook update remains pending because the spreadsheet artifact runtime was unavailable in this session.
- 2026-07-09 Iter1 addendum implemented after scope change: BOM now supports 25k/30k/34k tiers plus optional customer override, Admin Data has BOM template/preview/commit import, demand resolves customer-tier BOM safely, Reports exposes purchase plan by day/week, Chef Dashboard shows/sends daily production plan, and Weekly Menu warns on invalid BOM tiers. Verify so far: backend build pass, frontend build pass. Summary: `.planning/quick/260709-bom-tier-extension/260709-bom-tier-extension-SUMMARY.md`.

## Accumulated Context

### Roadmap Evolution

- Phase 9 added: Supplier canonical refresh and purchasing workflow alignment
- Milestone v1.1 started after archived Phase 2; phase numbering continues at 3 rather than resetting.
- Phase 3–7 roadmap created from approved research and 33 requirements with ingredient-level customer overlay semantics.
- Destructive apply is gated until Phase 3 safety baseline and Phase 4 read-only preview/classifier pass; old surface retirement is gated until Phase 6 canonical UI/manual CRUD compatibility passes.
- Across v1.1, preserve dirty worktree, applied migrations and locked/completed history; only true orphan and eligible draft/open data may be mutated by guarded policy.

- Phase 1.1 inserted after Phase 1 as urgent follow-up work: Operational IA & Page Recomposition.
- Phase 1.1 planned as a route-preserving operational IA recomposition with shared workbench primitives, page-level workflow recomposition, and final responsive/preservation verification.
- Phase 01.2 inserted after Phase 1.1 as urgent follow-up work: End-to-End Kitchen Workflow IA. (URGENT)
- Phase 01.3 inserted after Phase 1.2 as urgent follow-up work: UI/UX Hardening & Visual Regression. (URGENT)
- Phase 01.4 inserted after Phase 1.3 as urgent follow-up work: UI/UX Deep Hardening All Routes. (URGENT)
- Phase 02 added after Phase 01.4: Data-driven Workflow Integration from IPC Sample Files.

## Active Phase

| Phase | Status | Next |
| --- | --- | --- |
| 03 Contract, provenance & safety baseline | Planned in roadmap | Discuss/plan Phase 3; no destructive data action |

## Quick Tasks Completed

| Quick ID | Description | Date | Code Commit | Summary |
| --- | --- | --- | --- | --- |
| `260701-prd-061` | PRD-061 structured import validation DTO with row-column-cell issues | 2026-07-01 | uncommitted | [SUMMARY.md](./quick/260701-prd-061-import-validation/260701-prd-061-SUMMARY.md) |
| `260701-prd-060` | PRD-060 weekly menu import wizard with validate-before-commit gate | 2026-07-01 | uncommitted | [SUMMARY.md](./quick/260701-prd-060-import-wizard/260701-prd-060-SUMMARY.md) |
| `260701-prd-053` | PRD-053 missing BOM remediation deep-link and demand rerun | 2026-07-01 | uncommitted | [SUMMARY.md](./quick/260701-prd-053-missing-bom-remediation/260701-prd-053-SUMMARY.md) |
| `260701-prd-052` | PRD-052 unit conversion validation and missing conversion issues | 2026-07-01 | uncommitted | [SUMMARY.md](./quick/260701-prd-052-unit-conversion/260701-prd-052-SUMMARY.md) |
| `260630-prd-051` | PRD-051 BOM versioning with draft/published demand sync | 2026-06-30 | uncommitted | [SUMMARY.md](./quick/260630-prd-051-bom-versioning/260630-prd-051-SUMMARY.md) |
| `260630-prd-050` | PRD-050 BOM production UI and effective-date overlap sync | 2026-06-30 | uncommitted | [SUMMARY.md](./quick/260630-prd-050-bom-production-ui/260630-prd-050-SUMMARY.md) |
| `260627-8y7` | audit and combine feature/huy-coordination into dirty dev safely | 2026-06-26 | uncommitted | [SUMMARY.md](./quick/260627-8y7-audit-and-combine-feature-huy-coordinati/260627-8y7-SUMMARY.md) |
| `260626-g2q` | cập nhật BOM cho toàn bộ món ăn có dữ liệu trong file định lượng IPC | 2026-06-26 | data-only | [SUMMARY.md](./quick/260626-g2q-c-p-nh-t-bom-cho-to-n-b-m-n-n-t-file-nh-/260626-g2q-SUMMARY.md) |
| `260626-fuo` | tạo migration seed dữ liệu BOM mẫu tạm thời để tiếp tục luồng hoạt động | 2026-06-26 | uncommitted | [SUMMARY.md](./quick/260626-fuo-t-o-migration-seed-d-li-u-bom-m-u-t-m-th/260626-fuo-SUMMARY.md) |
| `260620-sln` | đồng bộ tài liệu database hiện tại giữa Word, schema SQL và import comparison | 2026-06-20 | uncommitted | [SUMMARY.md](./quick/260620-sln-ng-b-t-i-li-u-database-hi-n-t-i-gi-a-doc/260620-sln-SUMMARY.md) |
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
| `260721-stw` | hoàn thiện Shipyard MySQL template restore, lane dashboard và BOM tier dry-run | 2026-07-21 | `1e3a082` | [SUMMARY.md](./quick/260721-stw-hoan-thien-shipyard-mysql-template-resto/260721-stw-SUMMARY.md) |

## Session

**Stopped at:** Completed 09-14-PLAN.md; 09-05 residual checkpoint preserved
**Resume file:** .planning/phases/09-supplier-canonical-refresh-and-purchasing-workflow-alignment/09-05-PLAN.md

---
*Last updated: 2026-07-23 — completed Phase 09 Plan 14 disposable UAT evidence checkpoint*

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
| Phase 09 P01 | 3h 24m | 2 tasks | 16 files |
| Phase 09 P02 | 32m | 2 tasks | 4 files |
| Phase 09 P06 | 32m | 3 tasks | 9 files |
| Phase 09 P03 | 16m | 2 tasks | 6 files |
| Phase 09 P07 | 55m | 2 tasks | 18 files |
| Phase 09 P04 | 35m | 2 tasks | 10 files |
| Phase 09 P08 | 14m | 2 tasks | 11 files |
| Phase 09 P09 | 28m | 2 tasks | 7 files |
| Phase 09 P10 | 49m | 3 tasks | 12 files |
| Phase 09 P11 | 25min | 3 tasks | 12 files |
| Phase 09 P12 | 24m26s | 3 tasks | 14 files |
| Phase 09 P13 | 28m | 3 tasks | 12 files |
| Phase 09 P14 | resumed | 3 tasks | browser evidence, two restored rounds, operator checkpoint |

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
- [Phase 09]: Use the reproduced 3,207 unique case-insensitive delivery-date-plus-ingredient delta instead of unsupported 3,209.
- [Phase 09]: Disposable clones copy DEFAULT_GENERATED temporal fields and exclude only columns with non-empty generation_expression.
- [Phase 09]: Keep purchase-history source discovery server-owned: parser input is a resolved stream, never a request path. — Prevents client-controlled file access while keeping parsing deterministic and testable.
- [Phase 09]: Version normalization as purchase-history-normalization/2026-07-22/v1 and block every unaudited interpretation with raw evidence. — Historical reconciliation must replay identically without silent defaults, clamps, drops, or mutable policy lookup.
- [Phase 09]: Limit apply acknowledgement to manifest identity and accepted action IDs; clients cannot send actor IDs or normalized replacements. — The server remains authoritative for source discovery, identity, normalization, and authenticated actor context.
- [Phase 09]: Only Manager/Admin can decide material demand and purchase requests; Purchasing keeps preparation and quotation permissions only. — Enforces D-09-11 at the server authorization boundary.
- [Phase 09]: Reuse material-request ID/status plus approval history as the durable target; replay is idempotent and stale/conflicting decisions fail. — Keeps one canonical approval path without a parallel table.
- [Phase 09]: Approved material-demand snapshots are immutable and require an explicit future recalculation/version path. — Preserves the exact snapshot the Manager decided.
- [Phase 09]: Resolve only the audited 20.7 workbook server-side and reject source hash or 17,739-key baseline drift.
- [Phase 09]: Delete only sample-generated dependency-free orphans; version immutable history and deactivate referenced duplicates.
- [Phase 09]: Bind preview manifests to source, policy, as-of date, database fingerprint, ordered action hashes, exact counts, and blockers.
- [Phase 09]: Derive preview actor from authenticated server identity and accept no client path, actor, or replacement.
- [Phase 09]: Generated purchase drafts are supplier-neutral; missing supplier is valid only before explicit selection, and supplier-dependent transitions reject it.
- [Phase 09]: The purchasing workbench uses six mutually exclusive service-date stages and selected-date paging with size 8 by default and 100 maximum.
- [Phase 09]: Price exception classification is strict: only a proposed price more than 15 percent above reference enters exception.
- [Phase 09]: Plan 09-08 follows the 09-07 nullable SupplierId migration and must not repeat that nullability alteration.
- [Phase 09]: Persist accepted reconciliation as one unique manifest run with required server actor and deterministic action evidence.
- [Phase 09]: Store receipt package evidence only as an all-null or complete positive quantity/base-unit/policy triple.
- [Phase 09]: Keep 09-04 migration limited to audit tables and nullable snapshot columns; correct snapshot drift without unrelated supplier ALTER operations.
- [Phase 09]: Limit fresh-install compensation to the disposable test fixture and record that it is not a full model-parity proof.
- [Phase 09]: Mark pre-existing supplier links as legacy snapshots without creating confirmation evidence. — Preserves immutable history and prevents legacy data from satisfying the new explicit-confirmation contract.
- [Phase 09]: Enforce one current supplier decision through a nullable unique current-decision key. — MySQL permits multiple null values for superseded rows while rejecting more than one current row per purchase-request line.
- [Phase 09]: Reuse the existing unique purchase-order request-supplier index. — The original purchase-order migration already enforces PUR-05; recreating it would make the forward migration fail.
- [Phase 09]: Bind strict price exceptions to one supplier-decision proposal fingerprint and version. — Edits create superseding records and cannot silently reuse a Manager decision for a changed proposal.
- [Phase 09]: Prefer effective quotations; only when none exist, offer each active supplier's latest comparable receipt evidence, and never infer a supplier from activity alone.
- [Phase 09]: Treat confirmation as an append-only evidence snapshot: identical retries are idempotent, changed choices supersede the current row and increment the version.
- [Phase 09]: Accept only evidence identity, proposed price/delivery, and expected version from the client; derive reference values, fingerprint, and confirmer from server state.
- [Phase 09]: Require a current decision matching the purchase-line snapshot before submit and expose current plus historical decisions in the workbench.
- [Phase 09]: Keep shared reporting at >=15 percent and isolate purchasing at strict >15 percent. — Preserves locked report semantics while enforcing the purchasing exception boundary.
- [Phase 09]: Bind exception approval and purchase-order reuse to the current proposal fingerprint and version. — Superseded supplier evidence cannot authorize a changed proposal.
- [Phase 09]: Use the existing request-supplier unique key with Serializable load-or-create and reload-on-race. — Provides stable retries without a new schema or dependency.
- [Phase 09]: Derive purchase-order-line identity from request line plus decision fingerprint. — Makes the immutable proposal snapshot verifiable without adding a column.
- [Phase 09]: Require raw lot evidence for every purchase receipt; fresh-daily ingredients additionally require manufacture and expiry dates.
- [Phase 09]: Derive deterministic receipt identity from purchase order plus idempotency key and validate the persisted full raw-evidence body on replay.
- [Phase 09]: Keep purchase progress reads while removing the Purchase-owned receipt writer; Warehouse owns the sole mutation path.
- [Phase 09]: Treat generated DRAFT material demand as the authoritative pending approval state; do not add a duplicate submit mutation. — Generation already persists the versioned snapshot and inbox record.
- [Phase 09]: Expose demand source document and price-exception supplier as read-only inbox evidence instead of client inference. — Approval evidence must remain server-owned and auditable.
- [Phase 09]: Keep approval dialogs contextual, safe-focused, and non-dismissible while decisions are pending. — Prevents accidental destructive confirmation and preserves recovery context.
- [Phase 09]: Receipt evidence requirements are projected by the server from ingredient policy; the client never infers them. — Keeps receipt validation authoritative and auditable.
- [Phase 09]: Actual receipt mutation is Warehouse-only; Purchasing keeps read-only handoff and progress. — Preserves role ownership while exposing operational status upstream.
- [Phase 09]: Receipt retries retain one idempotency key and all operator-entered evidence. — Makes 4xx and conflict recovery safe without duplicate receipts or re-entry.

## Current Position

Phase: 9 of 9 — Supplier canonical refresh and purchasing workflow alignment
Plan: 13 of 14 completed; 09-05 accepted-apply proof remains deferred
Status: Plan 09-14 disposable evidence accepted; Phase 09 remains partial until SUP-04 is resolved
Last activity: 2026-07-23 — Plan 09-14 completed with REAL_APPLY_NOT_EXECUTED
