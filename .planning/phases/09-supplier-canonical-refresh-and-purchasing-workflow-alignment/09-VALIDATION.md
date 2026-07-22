---
phase: 9
slug: supplier-canonical-refresh-and-purchasing-workflow-alignment
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-21
approved: 2026-07-21
---

# Phase 9 — Validation Strategy

> Planning compliance is approved: every one of the 35 actual plan tasks has an automated command and no three consecutive tasks lack automation. Execution has not started, so `wave_0_complete` correctly remains `false` and every row remains `planned` rather than `passed`.

## Test Infrastructure

| Property | Value |
|---|---|
| Frameworks | xUnit (.NET 9), Vitest 4.1.10, Playwright 1.60.0 |
| Config | `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`, `backend/coverage.runsettings`, `frontend/playwright.config.ts` |
| Backend focused files | `PurchaseHistoryReconciliationTests.cs`, `MaterialDemandAndPriceExceptionApprovalTests.cs`, `SupplierDecisionWorkflowTests.cs`, `WarehousePurchaseReceivingTests.cs` |
| Frontend focused files | `demandModel.test.ts`, `approval-copy.test.ts`, `purchasingModel.test.ts`, `purchasingHooksBehavior.test.tsx`, `phase9-purchasing-workflow.spec.ts`, `route-smoke.spec.ts`, `ui-audit.spec.ts`, `visual-routes.spec.ts`, `phase9-snapshot-manifest.json` |
| Maximum focused feedback latency | Under 60 seconds; full-suite duration is measured during execution |
| Watch mode | Forbidden in automated verification |

## Command Catalog

Every multi-command entry is executed through `pwsh -NoProfile -Command` with `$ErrorActionPreference='Stop'` and an immediate `if ($LASTEXITCODE -ne 0) { throw ... }` after each native command. PLAN.md commands are authoritative; the catalog gives their exact runnable intent without duplicating long fail-fast wrappers in every table row.

| ID | Exact automated command |
|---|---|
| C-SAFETY | Fail-fast PowerShell: load `ProtectedSqlSha256` from `09-WAVE0-EVIDENCE.md`; compare `Get-FileHash -Algorithm SHA256`; assert `git status --porcelain=v1 --untracked-files=all -- backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql` is exactly `?? backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql`; assert `git ls-files --error-unmatch -- &lt;path&gt;` exits nonzero. |
| C-BE-ALL | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj -c Release --no-restore --filter "FullyQualifiedName~PurchaseHistoryReconciliationTests|FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests|FullyQualifiedName~SupplierDecisionWorkflowTests|FullyQualifiedName~WarehousePurchaseReceivingTests"` |
| C-BE-PARSER | Same project/filter `FullyQualifiedName~PurchaseHistoryReconciliationTests&amp;FullyQualifiedName~Parser` |
| C-BE-NORMALIZATION | Same project/filter `FullyQualifiedName~PurchaseHistoryReconciliationTests&amp;FullyQualifiedName~Normalization` |
| C-BE-PREVIEW | Same project/filter `FullyQualifiedName~PurchaseHistoryReconciliationTests&amp;FullyQualifiedName~Preview` |
| C-BE-PREVIEW-API | Same project/filter `FullyQualifiedName~PurchaseHistoryReconciliationTests&amp;FullyQualifiedName~PreviewEndpoint` |
| C-BE-PERSISTENCE | Same project/filter `FullyQualifiedName~PurchaseHistoryReconciliationTests&amp;FullyQualifiedName~PersistenceContract|FullyQualifiedName~WarehousePurchaseReceivingTests&amp;FullyQualifiedName~PackageSnapshot` |
| C-MIG-RECON | Fail-fast `dotnet ef migrations list ...`, reconciliation migration tests, then C-SAFETY. |
| C-BE-APPLY-GUARD | ApplyGuard-filtered reconciliation tests, then C-SAFETY. |
| C-BE-APPLY | Same project/filter `FullyQualifiedName~PurchaseHistoryReconciliationTests&amp;FullyQualifiedName~Apply` |
| C-BE-RECON | All `PurchaseHistoryReconciliationTests`, then C-SAFETY. |
| C-BE-ROLE | Same project/filter `FullyQualifiedName~AuthorizationPoliciesTests|FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests&amp;FullyQualifiedName~RoleBoundary` |
| C-BE-DEMAND | Same project/filter `FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests&amp;FullyQualifiedName~MaterialDemand` |
| C-BE-INBOX | Same project/filter `FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests&amp;FullyQualifiedName~Inbox` |
| C-BE-APPROVED | Same project/filter `FullyQualifiedName~WorkflowGenerationTests|FullyQualifiedName~SupplierDecisionWorkflowTests&amp;FullyQualifiedName~ApprovedDemand` |
| C-BE-WORKBENCH | Same project/filter `FullyQualifiedName~SupplierDecisionWorkflowTests&amp;FullyQualifiedName~Workbench` |
| C-BE-DECISION-PERSIST | Same project/filter `FullyQualifiedName~SupplierDecisionWorkflowTests&amp;FullyQualifiedName~Persistence|FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests&amp;FullyQualifiedName~Persistence` |
| C-MIG-DECISION | Decision/exception migration filter plus C-SAFETY. |
| C-BE-EVIDENCE | Same project/filter `FullyQualifiedName~SupplierDecisionWorkflowTests&amp;FullyQualifiedName~Evidence` |
| C-BE-SUPPLIER | All `SupplierDecisionWorkflowTests` |
| C-BE-THRESHOLD | Same project/filter `FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests&amp;FullyQualifiedName~Threshold|FullyQualifiedName~WorkflowReportCalculatorTests` |
| C-BE-EXCEPTION | Same project/filter `FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests|FullyQualifiedName~SupplierDecisionWorkflowTests&amp;FullyQualifiedName~Submit` |
| C-BE-PO | Same project/filter `FullyQualifiedName~SupplierDecisionWorkflowTests&amp;FullyQualifiedName~PurchaseOrder|FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests` |
| C-BE-WHR-AUTH | Same project/filter `FullyQualifiedName~WarehousePurchaseReceivingTests&amp;FullyQualifiedName~Authorization|FullyQualifiedName~WarehousePurchaseReceivingTests&amp;FullyQualifiedName~Validation` |
| C-BE-WHR-RECORD | Same project/filter `FullyQualifiedName~WarehousePurchaseReceivingTests&amp;FullyQualifiedName~Record` |
| C-BE-WHR | All `WarehousePurchaseReceivingTests` |
| C-FE-WORKFLOW | `npm run test:unit --workspace frontend -- --run src/features/workflow/purchasing/purchasingModel.test.ts src/features/workflow/purchasing/purchasingHooksBehavior.test.tsx src/features/projects/weekly-menu/demand/demandModel.test.ts` |
| C-FE-DEMAND | `npm run test:unit --workspace frontend -- --run src/features/projects/weekly-menu/demand/demandModel.test.ts` |
| C-FE-APPROVAL | Fail-fast approval-copy+demand Vitest command followed by frontend lint. |
| C-FE-PURCHASE | Focused purchasing model/hook Vitest command. |
| C-FE-PURCHASE-BUILD | Fail-fast focused purchasing Vitest, frontend lint, and frontend build. |
| C-FE-WAREHOUSE | Fail-fast purchasing hook Vitest, frontend lint, and frontend build. |
| C-PW-DISCOVERY | Fail-fast discovery of `phase9-purchasing-workflow.spec.ts`, `route-smoke.spec.ts`, `ui-audit.spec.ts`, and `visual-routes.spec.ts`; then parse `frontend/tests/phase9-snapshot-manifest.json`, require its only property to be `snapshotPaths`, and compare that array exactly against: `purchasing-phase09-1365x900-chromium-win32.png`, `purchasing-phase09-1280x900-chromium-win32.png`, `purchasing-phase09-768x1024-chromium-win32.png`, `purchasing-phase09-390x844-chromium-win32.png`, `warehouse-phase09-1365x900-chromium-win32.png`, `warehouse-phase09-1280x900-chromium-win32.png`, `warehouse-phase09-768x1024-chromium-win32.png`, and `warehouse-phase09-390x844-chromium-win32.png` under `frontend/tests/visual-routes.spec.ts-snapshots/`. This Wave 0 contract validates the registry, not PNG existence. |
| C-PW-SNAPSHOT-ACTUAL | Run C-PW-DISCOVERY, require every registry path to exist after Plan 09-14 generation, and require the snapshot directory to contain exactly eight `*phase09*.png` files. |
| C-FULL | Fail-fast C-BE-ALL, backend full suite, frontend lint/build/unit/smoke/UI-audit/visual, UAT marker assertions, and C-SAFETY. |
| C-FINAL-GATE | Assert `ROUND_1=PASS`, `ROUND_2=PASS`, `REAL_APPLY_NOT_EXECUTED`, then C-SAFETY. |

## Per-Task Verification Map

| Task | Plan | Wave | Requirements | Threats | Automated command | Planned test artifact | Plan status | Execution |
|---|---:|---:|---|---|---|---|---|---|
| 09-01-T1 | 01 | 0 | SUP-01..04 | T-09-01..03 | C-SAFETY + Wave 0 evidence-marker assertions | `09-WAVE0-EVIDENCE.md` | covered | planned |
| 09-01-T2 | 01 | 0 | SUP-01..04, PUR-01..05, WHR-01, PUI-01 | T-09-02..03 | C-BE-ALL + C-PW-DISCOVERY | four backend suites + four browser suites + exact eight-path snapshot manifest | covered | planned |
| 09-02-T1 | 02 | 1 | SUP-01, SUP-02 | T-09-04..06 | C-BE-PARSER | `PurchaseHistoryReconciliationTests.cs` | covered | planned |
| 09-02-T2 | 02 | 1 | SUP-01, SUP-02 | T-09-04..06 | C-BE-NORMALIZATION | `PurchaseHistoryReconciliationTests.cs` | covered | planned |
| 09-06-T1 | 06 | 1 | PUR-01 | T-09-17 | C-BE-ROLE | approval/authorization tests | covered | planned |
| 09-06-T2 | 06 | 1 | PUR-01 | T-09-18, T-09-19 | C-BE-DEMAND | approval tests | covered | planned |
| 09-06-T3 | 06 | 1 | PUR-01 | T-09-17..19 | C-BE-INBOX | approval tests | covered | planned |
| 09-03-T1 | 03 | 2 | SUP-03 | T-09-08, T-09-09 | C-BE-PREVIEW | reconciliation tests | covered | planned |
| 09-03-T2 | 03 | 2 | SUP-03 | T-09-07 | C-BE-PREVIEW-API | reconciliation tests | covered | planned |
| 09-07-T1 | 07 | 2 | PUR-01, PUR-02 | T-09-20, T-09-22 | C-BE-APPROVED | workflow/supplier tests | covered | planned |
| 09-07-T2 | 07 | 2 | PUR-02 | T-09-21 | C-BE-WORKBENCH | supplier workflow tests | covered | planned |
| 09-04-T1 | 04 | 3 | SUP-04, WHR-01 | T-09-11, T-09-12 | C-BE-PERSISTENCE | reconciliation/Warehouse tests | covered | planned |
| 09-04-T2 | 04 | 3 | SUP-04, WHR-01 | T-09-10 | C-MIG-RECON | migration + protected-SQL gate | covered | planned |
| 09-05-T1 | 05 | 4 | SUP-04 | T-09-13, T-09-14 | C-BE-APPLY-GUARD | reconciliation tests + evidence | covered | planned |
| 09-05-T2 | 05 | 4 | SUP-04 | T-09-15, T-09-16 | C-BE-APPLY | reconciliation tests | covered | planned |
| 09-05-T3 | 05 | 4 | SUP-04 | T-09-13..16 | C-BE-RECON | reconciliation tests + Wave 0 evidence | covered | planned |
| 09-08-T1 | 08 | 4 | PUR-03, PUR-04 | T-09-23, T-09-24 | C-BE-DECISION-PERSIST | supplier/approval tests | covered | planned |
| 09-08-T2 | 08 | 4 | PUR-03..05 | T-09-24, T-09-25 | C-MIG-DECISION | migration + protected-SQL gate | covered | planned |
| 09-09-T1 | 09 | 5 | PUR-03 | T-09-26, T-09-27 | C-BE-EVIDENCE | supplier workflow tests | covered | planned |
| 09-09-T2 | 09 | 5 | PUR-03 | T-09-26..28 | C-BE-SUPPLIER | supplier workflow tests | covered | planned |
| 09-10-T1 | 10 | 6 | PUR-04 | T-09-29 | C-BE-THRESHOLD | approval/report regression tests | covered | planned |
| 09-10-T2 | 10 | 6 | PUR-04 | T-09-30, T-09-31 | C-BE-EXCEPTION | approval/supplier tests | covered | planned |
| 09-10-T3 | 10 | 6 | PUR-05 | T-09-32 | C-BE-PO | supplier/order tests | covered | planned |
| 09-11-T1 | 11 | 7 | WHR-01 | T-09-33, T-09-34 | C-BE-WHR-AUTH | Warehouse tests | covered | planned |
| 09-11-T2 | 11 | 7 | WHR-01 | T-09-34, T-09-35 | C-BE-WHR-RECORD | Warehouse tests | covered | planned |
| 09-11-T3 | 11 | 7 | WHR-01 | T-09-36 | C-BE-WHR | Warehouse tests | covered | planned |
| 09-12-T1 | 12 | 8 | PUR-01, PUR-03..05, WHR-01, PUI-01 | T-09-37..39 | C-FE-WORKFLOW | model/hook/demand tests | covered | planned |
| 09-12-T2 | 12 | 8 | PUR-01, PUI-01 | T-09-37..39 | C-FE-DEMAND | demand tests | covered | planned |
| 09-12-T3 | 12 | 8 | PUR-04, PUI-01 | T-09-37..39 | C-FE-APPROVAL | approval/demand tests | covered | planned |
| 09-13-T1 | 13 | 9 | PUR-01..05, PUI-01 | T-09-40, T-09-41 | C-FE-PURCHASE | purchasing model/hook tests | covered | planned |
| 09-13-T2 | 13 | 9 | PUR-01..05, PUI-01 | T-09-40, T-09-41, T-09-43 | C-FE-PURCHASE-BUILD | purchasing tests/lint/build | covered | planned |
| 09-13-T3 | 13 | 9 | WHR-01, PUI-01 | T-09-42, T-09-43 | C-FE-WAREHOUSE | Warehouse/purchasing tests/lint/build | covered | planned |
| 09-14-T1 | 14 | 10 | PUR-01..05, WHR-01, PUI-01 | T-09-40..46 | C-PW-SNAPSHOT-ACTUAL | focused, route, audit, visual specs + the eight manifest-declared snapshots | covered | planned |
| 09-14-T2 | 14 | 10 | SUP-04, PUR-01..05, WHR-01, PUI-01 | T-09-44..47 | C-FULL | UAT evidence + full suites | covered | planned |
| 09-14-T3 | 14 | 10 | SUP-04 | T-09-47 | C-FINAL-GATE | operator/UAT evidence | covered | planned |

## Nyquist Continuity Audit

- Total actual tasks: **35**.
- Tasks with an automated command: **35/35**.
- Longest consecutive run without automation: **0**.
- Wave 0 creates every missing focused test/evidence seam and the exact snapshot registry before production behavior changes; Plan 09-14 creates the registered PNGs.
- Multi-command gates are fail-fast and assert native exit codes.
- Destructive/schema/final gates compare protected SQL SHA-256, exact `??` porcelain status, and untracked state.
- The human checkpoint in 09-14-T3 follows automated C-FINAL-GATE; it does not replace automation.

## Wave 0 Execution Checklist

- [ ] GitNexus exact-HEAD clean/re-index evidence captured.
- [ ] Protected SQL hash/status/untracked baseline captured.
- [ ] Workbook hash, 34-sheet and 3,207 unique normalized delivery-date-plus-ingredient key audit reproduced case-insensitively.
- [ ] Disposable clone backup/restore/fingerprint proof captured.
- [ ] Four focused backend suites and all four Phase 09 browser suite seams discovered; the exact eight-path snapshot registry is valid without claiming PNG generation.

These boxes remain unchecked until execution. Their pending state does not invalidate the approved plan-level Nyquist mapping.

## Full-Phase Exit Gate

1. C-BE-ALL and complete backend suite pass.
2. Frontend lint, build, unit, route-smoke, UI-audit, and visual suites pass.
3. The focused real-stack workflow passes twice after independent `ipc_e2e_template` restores.
4. Eight deterministic Phase 09 snapshots match the four required viewports for Purchasing and Warehouse.
5. `detect_changes({scope:"compare",base_ref:"main"})` reports only planned symbols/processes.
6. C-SAFETY passes and `REAL_APPLY_NOT_EXECUTED` remains recorded.
7. Operator reviews the evidence; any real target remains a separate, explicitly authorized request.

## Validation Sign-Off

- [x] Every actual task is mapped to plan, wave, requirement, threat, automated command, and planned artifact.
- [x] No three consecutive tasks lack automation.
- [x] All Wave 0 missing seams have an owning task.
- [x] No watch-mode command is used.
- [x] Multi-command checks are fail-fast.
- [x] Plan-level Nyquist compliance is approved.
- [ ] Wave 0 execution completed.
- [ ] Full phase execution completed.

**Approval:** Plan validation approved on 2026-07-21. Execution status remains pending.
