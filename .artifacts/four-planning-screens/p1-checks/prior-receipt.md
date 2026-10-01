# Four DEFAULT read-only planning sandbox candidates

Implemented; independent acceptance **PENDING**. No PAGE_READY or production-performance PASS.

## Implementation
- `dish-materials`: effective gross BOM per serving and reference tray cost, no editing.
- `cost`: existing saved-menu serving/cost model; missing BOM explicitly incomplete/unavailable, never zero-cost fiction.
- `production-plan`: persisted plan headers/version/lifecycle and dish quantities, no sends.
- `purchase-summary`: physical server aggregate rows/counters/search/page, never projected fallback.
- Active workspace queries only. Current-key `currentData` guards exclude prior scope/page/search rows; denial/error precede cached content. Approved purchase-hook repair also affects legacy WeeklyMenuPage pending behavior; public prior-key RED→GREEN regression, not whole-legacy browser acceptance.
- Candidate-local pager retains same-scope/search navigation metadata only, not rows/counters. Pending requested page differs from loaded page. Existing focus-preservation opt-in blocks repeat navigation; scope/search/error/denial reset metadata. Pending next/back, repeated Enter/Space, last short page, zero-search and denial verified.
- **Xuất BOM dự kiến** calls unchanged `buildWarehouseCsv` with real customer/week. Existing BOM projection bytes retained; legacy LT/TT are projected quantities, not physical consumption/handoff. No UNKNOWN/hardcoded fallback or physical export.
- Preview registration/shell links only; production `/weekly-menu`, route registry/MainLayout/backend/capabilities/mode unchanged. No DB/seed/install/business writes/stage/commit/reset/restore. Inherited Demand/shared dirt preserved.

## Changed files
New: frontend/src/features/planning/cost/{ReadPlanningPreviewPage.tsx,ReadPlanningPreviewPage.test.tsx,CostScreen.tsx,readPlanning.css}; frontend/src/features/planning/dish-materials/DishMaterialsScreen.tsx; frontend/src/features/planning/production-plan/ProductionPlanScreen.tsx; frontend/src/features/planning/handoff/{HandoffScreen.tsx,HandoffScreen.test.tsx}.
Modified narrowly: frontend/src/routes/AppRouter.tsx; frontend/src/features/planning/PlanningPreviewShell.tsx; frontend/src/features/projects/weekly-menu/purchasing/{usePurchaseSummary.ts,usePurchaseSummary.handoff.test.tsx}; docs/domain/weekly-menu-contract.md; docs/EVIDENCE-INDEX.md; MEMORY.md; .planning/notes/FE-CONTRACT-KIT-NORMALIZATION.md. Verification scripts/artifacts under .artifacts/four-planning-screens, not staged.

## Validation
Final logs: `.artifacts/four-planning-screens/final-checks/`.
- `npx vitest run src/features/planning/handoff/HandoffScreen.test.tsx src/features/planning/cost/ReadPlanningPreviewPage.test.tsx src/features/projects/weekly-menu/purchasing/usePurchaseSummary.handoff.test.tsx --maxWorkers=1`: PASS,3 files/8 tests.
- `npx tsc -b --pretty false`: PASS.
- Scoped ESLint four candidate directories, shell/router/purchase owner and owner test: PASS.
- `VITE_ENABLE_KIT_PREVIEW=true npx vite build --outDir ../.artifacts/four-planning-screens/final-checks/preview-build`: PASS,1.18s; isolated output, user dist untouched.
Earlier consolidated5 files/14 tests PASS is baseline, not whole-suite final acceptance.
Report inspection initially hit cp1252 decoding failure; explicit UTF-8 retry succeeded. A long receipt-generation command subsequently failed parsing before edits; bounded writes replace it, no product failure.

## Browser and image review
- Final `browser-1790858058193`: PASS_SCOPED,11/11 captures individually opened.
- Final `interactions-1790857974007`: PASS_SCOPED,5/5 individually opened.
- `browser-1790857999704`: retained FAIL_SCOPED from instantaneous scope-clear assertion; runner awaits visible prerequisite now. All11 captures individually opened, not promoted as PASS.
- Prior focus-loss FAIL retained; final pending pager GREEN above. Two prior selected-detail images also opened.
Reviewed images show readable ledgers/provenance/units, full numeric precision and wrapping controlled long text, explicit denial/empty/missing-BOM states, no visible clipping/overlap. DOM metrics report no overflow; handoff page/search widths stable. Scope/key suppression and native selection/href interactions verified.
Each screen: **PASS_SCOPED** implementation and bounded natural/guard checks; **NEEDS_EVIDENCE** broader readiness.
Final reports errors=[],failures=[],blockedWrites=[]; login only permitted POST. Natural GET counts including mode dish7/cost7/production4/handoff8; page1→2 one aggregate GET; real-scope CSV download verified.

## Runtime, provenance, teardown
HEAD db8d9ed43769f59cc0cb0221f99a44cfb5e8ad75; branch refactor/design-system-maturity-pass-20260929; observed index empty. Broad inherited dirt is not this batch.
Actual preimages at `.artifacts/four-planning-screens/intake-1790855811829`; resume preimages at `resume-intake-1790857769839`; conflict SHA checks PASS before edits. New candidates had no prior bytes. Hashes belong only in docs/EVIDENCE-INDEX.md.
Final DEFAULT authenticated runtime version129, headed Chrome154. FE5173 PID8648 / BE5262 PID11452 retained; user Chrome24908 tabs untouched. Reports confirm run browser created/closed and user servers untouched. No owned browser or long operation remains. DB/migrations Healthy; readiness Degraded from disabled lifecycle-outbox, no config change.

Remaining **NEEDS_EVIDENCE**: real actor denial matrix; durable lifecycle (not authorized/exercised); field performance/CLS/frame/native zoom; full keyboard boundary matrix; independent reviewer acceptance. DEV lab elapsed/cumulative shift observations are not production performance proof. Recommended next step: independent bounded acceptance review, not cutover or broader campaign.
