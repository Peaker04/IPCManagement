# Phase 8 — Final UI Review

**Audited:** 2026-07-20  
**HEAD:** `96c24d5` (`fix: preserve zero servings and active demand status`)  
**Scope:** Lightweight closure check of `782dc13..96c24d5`, reusing the established Phase 8 18/24 audit evidence  
**Baseline:** `08-PLAN.md`, `08-BASELINE.md`, approved IPC UI design contract, and UI Contract v2  
**Screenshots:** refreshed 1440×900, 768×1024, and 375×812 captures from `http://localhost:5173` under `.planning/ui-reviews/08-closure-20260720-96c24d5/`; captures remain unauthenticated at `/login`, while authenticated responsive behavior is covered by the current 16-test Playwright route smoke suite  
**Verdict:** **FINAL PASS WITH QUALITY WARNINGS — No UI contract regression at `96c24d5`. The latest code preserves authoritative zero servings and removes the false stale-demand status without changing visible copy, layout, styling, routes, ARIA relationships, or interaction structure. The established score remains 18/24; residual copy and semantic-token consistency remain non-blocking quality debt.**

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Primary remediated labels are task-oriented Vietnamese; a few secondary surfaces still expose `catalog`, `backend`, `demand`, `tier`, and raw status codes. |
| 2. Visuals | 3/4 | Shared operational hierarchy is coherent and responsive tests pass, but fresh authenticated route screenshots were unavailable for independent visual inspection. |
| 3. Color | 2/4 | Status badges improved, but Phase 8 still contains extensive direct Tailwind slate and state-color utilities instead of IPC semantic tokens. |
| 4. Typography | 3/4 | Arbitrary 10–13.5px text was removed; the remaining scale is four standard sizes, though four weights remain in use. |
| 5. Spacing | 3/4 | Repeated 560px weekly-table geometry moved to a shared variant and problematic fixed control widths were removed; some one-off table/dialog dimensions remain. |
| 6. Experience Design | 4/4 | Explicit purchase selection, weekly freshness safeguards, paged Chef receipts, ARIA relationships, and all automated behavior gates pass. |

**Overall: 18/24**

---

## Severity Summary

- **BLOCKER:** 0
- **WARNING:** 4 non-functional consistency findings
- **Resolved from prior review:** Weekly Menu tab ARIA, user-facing primary jargon, tiny arbitrary text, repeated weekly viewport geometry, and Weekly Menu shell line cap

## Closure Snapshot — `96c24d5`

- **No UI contract regression:** the frontend delta is confined to serving-resolution model/hook logic and its focused test; it adds no JSX, labels, Tailwind classes, routes, or ARIA changes.
- **Authoritative zero preserved:** `resolveSlotServingInfo` treats every non-missing quantity-plan state as authoritative, so a confirmed zero remains zero instead of restoring stale imported portions (`frontend/src/features/projects/weekly-menu/schedule/scheduleModel.ts:65-87`; `useWeeklyScheduleEditor.ts:74-86`).
- **False stale status removed:** regenerated active demand groups no longer expose cancelled-history state as a current warning (`backend/src/IPCManagement.Api/Services/Workflow/WorkflowReportService.cs:729-730`).
- **Current gates pass:** frontend unit 136/136, production build, lint, responsive smoke 16/16, and focused Release `WorkflowGenerationTests` 91/91. The initial Debug backend attempt was blocked only by the already-running API executable; the Release rerun passed without stopping it.
- **Decomposition limits remain intact:** Weekly Menu 362 lines, Purchasing 109, Chef 149, `useWeeklyScheduleEditor` 197.

## Top 3 Remaining Fixes

1. **Finish Vietnamese copy normalization** — replace the remaining `catalog`, `backend`, `demand`, `tier`, and raw `DRAFT`/`ROLLED_BACK` output with plain-language labels while retaining technical codes only as secondary traceability text.
2. **Complete semantic color migration** — route state colors through `StatusBadge`, `InlineAlert`, and IPC semantic classes instead of direct blue/amber/emerald/green/red utilities.
3. **Turn remaining repeated viewport sizes into named variants** — add compact/history/detail variants for the remaining 260/320/360px table boundaries where repetition exists.

---

## Remediation Verification

| Prior finding | Result | Evidence |
|---|---|---|
| Weekly Menu tabs referenced missing panels | **RESOLVED** | `ViewSwitcher` generates tab IDs and `aria-controls` (`frontend/src/components/common/ViewSwitcher.tsx:42-50`); `WeeklyMenuViewContent` generates matching `id`, `role="tabpanel"`, and `aria-labelledby` for every view (`frontend/src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx:38-72`). |
| Primary workflow exposed `Chờ demand`, `sai tier`, `OK`, `Chưa resolve` | **RESOLVED** | The status strip now uses `Chờ tính nhu cầu`, `đơn giá sai`, and `Hợp lệ` (`frontend/src/features/projects/pages/WeeklyMenuPage.tsx:260-264`); Chef uses `Chưa xác định định lượng` (`frontend/src/features/chef/production/ChefProductionSection.tsx:50`). |
| Weekly Menu shell exceeded 400 lines | **RESOLVED** | `WeeklyMenuPage.tsx` is 362 physical lines at HEAD. |
| Arbitrary tiny text scale | **RESOLVED** | Changed Phase 8 TSX now uses standard `text-xs`, `text-sm`, `text-base`, and `text-lg`; no 10px, 11px, 12px, 13px, or 13.5px text utilities remain. |
| Repeated 560px weekly table declarations | **RESOLVED** | `TableViewport` now provides `size="weekly"` (`frontend/src/components/common/TableViewport.tsx:4-29`), used by demand, cost, purchase-summary, and dish-material views. |
| Fixed narrow control widths | **RESOLVED** | Dish selector uses `w-full sm:w-72` (`frontend/src/features/projects/weekly-menu/dish-materials/DishMaterialsSection.tsx:20-24`); Chef shift controls use `w-28` (`frontend/src/features/chef/pages/ChefDashboardPage.tsx:125-128`). |
| Purchasing silently targeted the first actionable record | **RESOLVED** | Create and submit targets start empty, are cleared on page changes, and mutations stop with task-specific warning copy until the user explicitly selects a demand/request (`frontend/src/features/workflow/purchasing/demand/usePurchaseDemand.ts:25-27`, `:50-77`, `:95-104`). |
| Weekly staleness checks could be partial or fail without blocking generation | **RESOLVED** | Loading and partial-error states have explicit Vietnamese alerts; generation is disabled while freshness is loading or incomplete, with state-specific button copy (`frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:27`, `:51-68`). |
| Chef receipts were capped at 100 rows and could falsely claim all received | **RESOLVED** | Receipt queries use server page metadata, expose navigation, and set `allReceived` only when no additional pages exist (`frontend/src/features/chef/receipts/useKitchenReceipts.ts:11-31`, `:74-87`; `frontend/src/features/chef/receipts/KitchenReceiptSection.tsx:50-56`). The page status explicitly says when only the current page is complete (`frontend/src/features/chef/pages/ChefDashboardPage.tsx:46-51`, `:74-77`). |

## Current HEAD Functional Verification

| Remediation area | Result | Evidence |
|---|---|---|
| Weekly demand integrity | **PASS** | Current unit coverage verifies demand scope/model behavior; `MaterialDemandSection` and `useMaterialDemand` remain wired through the operational workflow. |
| Chef service-date scoping | **PASS** | New `chefServiceDate` and `chefWorkflowBehavior` tests cover selected-date production, receipt, and exception behavior. |
| Purchasing actionable records | **PASS** | New purchasing hook/model behavior tests cover selecting actionable demand and creating requests; Playwright also completes the create flow. |
| Visible responsive behavior | **PASS** | Playwright renders protected routes at desktop, tablet, and 320px mobile and completes approval, warehouse issue, and kitchen signoff at tablet/mobile. |
| Source-contract replacement | **PASS** | Brittle source-wiring assertions were replaced by hook behavior tests at `66ddc08`; page limits were independently recounted at current HEAD. |
| Explicit purchasing target | **PASS** | The hook has no implicit first-record fallback, clears selection on page changes, and Playwright selects a material demand before creating the request (`frontend/src/features/workflow/purchasing/demand/usePurchaseDemand.ts:50-77`; `frontend/tests/route-smoke.spec.ts:1308-1389`). |
| Weekly freshness/error safety | **PASS** | Weekly demand displays progress/error copy and disables generation for loading or partial-error freshness states (`frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:51-68`); focused model/hook tests pass in the 136-test unit suite. |
| Chef receipt pagination | **PASS** | Page size is bounded at 100, server totals drive `PaginationBar`, and behavior tests cover 101 receipt lines across two pages (`frontend/src/features/chef/receipts/useKitchenReceipts.ts:16-31`; `frontend/src/features/chef/receipts/KitchenReceiptSection.tsx:50-56`; `frontend/src/features/chef/chefWorkflowBehavior.test.tsx`). |

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **WARNING — secondary copy still leaks implementation vocabulary.** Schedule-save feedback says changes are written to `backend` and the user can create `demand` (`frontend/src/features/projects/weekly-menu/schedule/useWeeklyScheduleEditor.ts:150-162`, `:187`). Use `hệ thống` and `tính nhu cầu nguyên liệu`.
- **WARNING — two setup/empty surfaces still say `catalog` and `tier`.** Examples are `Chưa có catalog` and `Chọn tier cho file` in `frontend/src/features/projects/weekly-menu/dish-materials/DishMaterialsSection.tsx:24` and `frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:41`. Prefer `Chưa có danh mục món` and `Chọn mức định lượng cho tệp`.
- **WARNING — raw workflow status codes remain visible.** Production plan and import history render backend statuses directly (`frontend/src/features/projects/weekly-menu/production-plan/ProductionPlanSection.tsx:38`; `frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportHistory.tsx:25`). Map them to `Bản nháp`, `Đã hoàn tác`, and equivalent Vietnamese labels, with the code shown secondarily only if traceability requires it.
- **Positive evidence:** the primary status strip, demand action/alerts, purchase summary, and Chef unresolved state were rewritten in operational Vietnamese. Examples: `frontend/src/features/projects/pages/WeeklyMenuPage.tsx:260-264`, `frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:39-61`, and `frontend/src/features/chef/production/ChefProductionSection.tsx:48-52`.

### Pillar 2: Visuals (3/4)

- **WARNING — fresh authenticated route screenshots remain unavailable.** The new desktop/tablet/mobile captures show the login card, so this re-review does not claim direct visual confirmation of authenticated density, clipping, or table geometry.
- **Positive evidence:** the shared hierarchy remains consistent across all three routes: operational frame, command region, context strip, view switcher, bounded panels/tables, and text-labelled states.
- **Positive evidence:** current Playwright tests render protected routes at desktop, tablet, and 320px mobile; they also exercise purchasing create and tablet/mobile approval, warehouse issue, and kitchen signoff. Supplied real-API Chromium UAT previously passed Weekly Menu and Chef dashboard flows.
- **Positive evidence:** icons remain in the established Lucide family and no new decorative visual system was introduced.

### Pillar 3: Color (2/4)

- **WARNING — direct palette utilities remain widespread.** Current Phase 8 TSX includes 31 `text-slate-500`, 31 `bg-slate-100`, 17 `text-slate-600`, 16 `border-slate-200`, plus direct blue, amber, emerald, green, and red state classes. This does not fully meet the design contract's IPC-token requirement.
- **WARNING — some leaf components still encode status meaning with direct colors.** Examples include row BOM state in `frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx:52`, quantity variance in `frontend/src/features/projects/weekly-menu/purchasing/PurchaseSummarySection.tsx:58`, and import states in `frontend/src/features/projects/weekly-menu/import/importValidation.ts:30-34`.
- **Positive evidence:** remediated serving status now uses `StatusBadge` (`frontend/src/features/projects/weekly-menu/schedule/QuickServingCell.tsx:27`), command-bar active state uses a badge (`frontend/src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:69-72`), and no new hardcoded hex/rgb literals were introduced in Phase 8 TS/TSX.
- **Remediation:** add semantic text/background/border variants for neutral, info, success, warning, and danger, then consume those variants in leaf components.

### Pillar 4: Typography (3/4)

- **WARNING — weight usage remains broader than the minimal contract.** Current Phase 8 TSX uses normal, medium, semibold, and bold. This is workable but should be reduced to clearly defined body/control/emphasis roles.
- **Resolved:** arbitrary micro-sizes were removed. The current changed TSX distribution is 39 `text-sm`, 17 `text-xs`, five `text-lg`, and two `text-base`, with no arbitrary pixel font sizes.
- **Positive evidence:** operational metadata no longer drops to 10–11px; schedule dates, status chips, and dialog copy now use standard readable utilities (`frontend/src/features/projects/weekly-menu/schedule/WeeklyScheduleEditorDialog.tsx:20-40`; `frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportDialog.tsx:18-38`).

### Pillar 5: Spacing (3/4)

- **WARNING — some fixed geometry remains outside named variants.** Examples include 260px import/history viewports, 320px Chef production, and 360px cost detail (`frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx:26`, `frontend/src/features/chef/production/ChefProductionSection.tsx:33`, `frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx:65`). These are defensible table boundaries but should become named variants if reused.
- **Resolved:** the four main weekly views now use `TableViewport size="weekly"` instead of repeating 560px height declarations (`frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx:64`, `frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx:29`, `frontend/src/features/projects/weekly-menu/purchasing/PurchaseSummarySection.tsx:32`, `frontend/src/features/projects/weekly-menu/dish-materials/DishMaterialsSection.tsx:36`).
- **Resolved:** previous arbitrary `w-[96px]`, `w-[110px]`, `w-[280px]`, `text-[13.5px]`, and `md:pt-[40px]` usages were replaced with responsive scale utilities.
- **Positive evidence:** shared local-scroll table boundaries and responsive action wrapping continue to pass desktop/tablet/mobile smoke coverage.

### Pillar 6: Experience Design (4/4)

- **ARIA pass:** every Weekly Menu tab now controls a matching active tabpanel through `WeeklyMenuViewContent` (`frontend/src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx:38-72`). Purchasing and Chef retain equivalent panel relationships.
- **State pass:** loading, error, empty, stale, mutating, disabled, and feedback states remain present across Weekly Menu, Purchasing, and Chef. The remediation did not remove the established task-state coverage.
- **Interaction pass:** current smoke tests pass protected routes and operational mutations at desktop/tablet/mobile. Purchasing creation requires an explicit selected material demand (`frontend/tests/route-smoke.spec.ts:1308-1389`), and tablet/mobile kitchen signoff remains covered (`frontend/tests/route-smoke.spec.ts:1423-1453`). Supplied live Chromium UAT against the real API/database previously passed login, Weekly Menu, purchasing create, warehouse issue, and Chef dashboard.
- **Paged receipt safety pass:** receipt scope changes reset the effective page to 1; page changes are server-backed at 100 rows; the UI does not claim all receipts are complete while later pages exist (`frontend/src/features/chef/receipts/useKitchenReceipts.ts:11-31`, `:74-83`; `frontend/src/features/chef/pages/ChefDashboardPage.tsx:46-51`).
- **Decomposition pass:** all page, component, and hook line gates now pass; lazy read-only boundaries remain in place with accessible stable fallbacks.
- No experience-design defect was found that breaks task completion or violates the remediated interaction contract.

---

## Decomposition and Test Gates

| Gate | Result | Evidence |
|---|---|---|
| Weekly Menu page ≤400 | **PASS** | 362 lines |
| Purchasing page ≤400 | **PASS** | 109 lines |
| Chef dashboard page ≤400 | **PASS** | 149 lines |
| Workflow component ≤500 | **PASS** | Largest inspected Phase 8 production component remains below 500 lines |
| Custom hook ≤300 | **PASS** | `useWeeklyScheduleEditor.ts` is 216 lines at current HEAD; no Phase 8 custom hook exceeds 300 lines |
| Weekly Menu ARIA tab contract | **PASS** | Six generated tabpanels with matching tab IDs |
| Frontend unit tests | **PASS** | `npm run test:unit --workspace frontend -- --run`: 36 files, 136 tests |
| Frontend production build | **PASS** | `npm run build --workspace frontend`: TypeScript and Vite build completed |
| Frontend lint | **PASS** | `npm run lint --workspace frontend`: ESLint completed without diagnostics |
| Playwright smoke | **PASS** | `npm run test:smoke --workspace frontend`: 16/16 tests |
| Registry safety | **N/A** | No root or frontend `components.json`; no third-party registry audit applicable |

## Final Recommendation

Phase 8 can be closed from a functional, accessibility-contract, visible-behavior, and decomposition standpoint. Carry the remaining copy mapping and semantic color migration as bounded UI-system cleanup; they are quality warnings, not blockers for the operational page decomposition objective. Final score: **18/24**.

## Files Audited

- `.planning/phases/08-operational-page-feature-decomposition/08-PLAN.md`
- `.planning/phases/08-operational-page-feature-decomposition/08-BASELINE.md`
- `.planning/quick/260717-ui-ux-system-redesign/260717-ui-ux-system-redesign-UI-SPEC.md`
- `.planning/quick/260717-ui-ux-system-refactor-v2/UI-SPEC.md`
- All frontend source/test files in final remediation range `66ddc08..782dc13`
- All Phase 8 frontend source/test files in `f450e50^..782dc13`
- Shared operational components and current IPC styles/tokens
- Fresh screenshots under `.planning/ui-reviews/08-final-20260720-782dc13/` (git-ignored binaries)
