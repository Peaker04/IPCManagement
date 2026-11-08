---
phase: 30-closed-loop-menu-issue-reconciliation
plan: 09
subsystem: inventory-lineage-consumers
status: complete
tags: [lineage, inventory, reconciliation, data-quality, roslyn, ef-core]
requires: [30-08]
provides:
  - production-wide semantic Type.Method lineage-owner discovery
  - exact typed xUnit consumer matrix with bidirectional owner coverage and source-aware invocation validation
  - canonical DEFAULT issue-line inference with exact-one rejection
  - source-labelled data-quality findings and family-safe cleanup
  - executable DishCatalog lineage not-applicability
  - EF migration/model parity for reconciliation issue ownership
affects: [inventory, planning, reports, sample-data, catalog]
tech-stack:
  added: [SDK-shipped Microsoft.CodeAnalysis, SDK-shipped Microsoft.CodeAnalysis.CSharp]
  patterns: [semantic source discovery, exact matrix bijection, colliding persisted family fixtures]
key-files:
  created:
    - .planning/phases/30-closed-loop-menu-issue-reconciliation/30-09-SUMMARY.md
  modified:
    - backend/tests/IPCManagement.Api.Tests/Phase30DiscoveredConsumerBijectionTests.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Validators/InventoryValidators.cs
    - backend/src/IPCManagement.Api/Features/Reports/Services/DataQualityReportService.cs
    - backend/src/IPCManagement.Api/Features/Reports/Contracts/WorkflowReportDto.cs
    - backend/src/IPCManagement.Api/Features/Catalog/Services/DishCatalogDiagnosticsService.cs
    - backend/src/IPCManagement.Api/Features/Planning/Services/ServiceRunService.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Persistence/InventoryEntityConfigurations.cs
    - backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.MenuReimport.cs
decisions:
  - Discover concrete lineage consumers across backend/src as exact Type.Method owners; exclude generated artifacts and semantically proven declarative EF mappings only.
  - Preserve DEFAULT compatibility by allowing omitted request-line IDs only where the canonical resolver can infer an exact request line.
  - Treat DishCatalog diagnostics as lineage-not-applicable and exclude inventory issue rows from its aggregate readiness total.
  - Keep one reconciliation inventory issue per reconciliation batch, matching migration 76.
metrics:
  completed: 2026-08-31
  tasks: 7
  commits: 15
---

# Phase 30 Plan 09: Consumer Lineage Remediation Summary

Production-wide Roslyn discovery now enforces an exact typed xUnit `Type.Method` lineage-consumer matrix with source-aware invocation paths, while persisted public demand, amendment, and reimport tests prove DEFAULT-only behavior and immutable READY reconciliation facts under colliding issue families.

## What Was Remediated

- Replaced the fixed eight-file substring scanner with production-wide C# syntax-tree and semantic-symbol discovery under `backend/src`.
- Restricted source exclusion to generated output/migrations plus EF `Configure` methods semantically proven to contain builder-rooted declarative statements only; arbitrary `*Configuration` owners remain discoverable.
- Made duplicate, stale, and missing matrix entries fail as exact `Type.Method` set differences.
- Replaced the former substring-only report/command/catalog assertions with persisted public-service fixture behavior.
- Added `sourceFamily` and exact available lineage IDs to data-quality findings; DEFAULT orphan findings expose only their material-request ID.
- Proved cleanup removes only exact DEFAULT orphans while persisted reconciliation and `LEGACY_UNCLASSIFIED` fixtures remain unchanged.
- Proved DishCatalog diagnostics return identical output and cause zero mutations/family-total effects with colliding DEFAULT, MATERIAL_RECONCILIATION, and LEGACY_UNCLASSIFIED issue fixtures.
- Restored `InventoryIssueService.CreateAsync` DEFAULT compatibility through canonical resolver inference while retaining rejection for both-family, reconciliation-on-DEFAULT, foreign, malformed, and legacy cases.
- Aligned validators with resolver behavior: omitted DEFAULT line IDs are accepted for inference, but both-family and malformed reconciliation lines remain invalid.
- Preserved full-day/default service-run compatibility by recognizing canonical request-line ancestry without admitting reconciliation or unclassified lines.
- Restored EF model/migration parity for the unique reconciliation-batch issue index.
- Advanced repository migration evidence from migration 75 to the Phase 30 migration 76 head.

## Exact Discovered Method Matrix

| Type.Method | Disposition |
|---|---|
| `ApprovalInboxService.BuildInventoryIssueItemsAsync` | FAMILY_PRESERVING_READ |
| `AuditReportService.GetAuditChangesAsync` | FAMILY_LABELLED_AUDIT |
| `DataQualityCommandService.CleanupDataQualityAsync` | DEFAULT_ONLY_COMMAND |
| `DataQualityReportService.GetDataQualityAsync` | FAMILY_LABELLED_REPORT |
| `InventoryIssueApprovalHandler.HandleCoreAsync` | FAMILY_PRESERVING_COMMAND |
| `InventoryIssueLineResolver.BuildIssuedBySourceLine` | EXACT_ONE_LINE_RESOLUTION |
| `InventoryIssueRepository.GetIssuedLinesForMaterialRequestAsync` | DEFAULT_ONLY_READ |
| `InventoryIssueService.ConfirmReceiptAsync` | FAMILY_PRESERVING_COMMAND |
| `InventoryIssueService.CreateAsync` | DEFAULT_COMPATIBLE_EXACT_ONE |
| `InventoryIssueService.CreateFromReconciliationAsync` | RECONCILIATION_ONLY_COMMAND |
| `InventoryMapper.MapIssue` | FAMILY_LABELLED_MAPPING |
| `InventoryMapper.MapIssueLine` | FAMILY_LABELLED_MAPPING |
| `InventoryOperationsReportService.GetSupplyLineReconciliationAsync` | FAMILY_LABELLED_REPORT |
| `InventoryOperationsReportService.MapKitchenIssue` | FAMILY_LABELLED_MAPPING |
| `InventoryOperationsReportService.QueryIssueLines` | FAMILY_LABELLED_REPORT |
| `InventoryReturnService.EnsureExactSourceFamily` | EXACT_ONE_VALIDATION |
| `InventoryReturnService.EnsureOwningFamilyActive` | FAMILY_STATUS_VALIDATION |
| `InventoryReturnService.GetAllocationBalancesAsync` | FAMILY_PRESERVING_READ |
| `InventoryReturnService.LoadScopedSourceLinesAsync` | FAMILY_SCOPED_READ |
| `LegacyLineageDispositionService.ApplyProvenanceAsync` | LEGACY_REMEDIATION_COMMAND |
| `LegacyLineageDispositionService.GetIssueLineCandidatesAsync` | LEGACY_REMEDIATION_READ |
| `MaterialDemandService.EnsureMaterialRequestAsync` | DEFAULT_ONLY_COMMAND |
| `MaterialDemandService.GetStalenessAsync` | DEFAULT_ONLY_READ |
| `MaterialDemandStockReservation.ReserveAsync` | DEFAULT_ONLY_COMMAND |
| `MenuAmendmentService.CreateAsync` | DEFAULT_ONLY_COMMAND |
| `MenuAmendmentService.ExecuteCoreAsync` | DEFAULT_ONLY_COMMAND |
| `OperationalKpiReportService.GetOperationalKpisAsync` | FAMILY_LABELLED_REPORT |
| `ReconciliationBatchService.LoadLinkedIssuedQuantitiesAsync` | RECONCILIATION_ONLY_READ |
| `ServiceRunService.GetPageAsync` | DEFAULT_ONLY_READ |
| `ServiceRunService.GetProjectionAsync` | DEFAULT_ONLY_READ |
| `ServiceRunService.SelectRelevantIssueLines` | DEFAULT_ONLY_PROJECTION |
| `SupplementalMaterialRequestService.CreateAsync` | DEFAULT_ONLY_COMMAND |
| `SupplementalMaterialRequestService.EnsureDefaultSourceFamily` | DEFAULT_ONLY_VALIDATION |
| `SupplementalMaterialRequestService.FulfillAsync` | DEFAULT_ONLY_COMMAND |
| `SupplementalMaterialRequestService.LoadSourceLineAsync` | DEFAULT_ONLY_READ |
| `SupplementalMaterialRequestService.ResolveSourceShiftNameAsync` | DEFAULT_ONLY_READ |
| `SupplementalMaterialRequestService.RouteToPurchasingAsync` | DEFAULT_ONLY_COMMAND |
| `WeeklyMenuImportPersistence.RequireNoIrreversibleDownstreamDocumentsAsync` | DEFAULT_ONLY_VALIDATION |

DishCatalog has no concrete lineage-member owner method and is therefore deliberately absent from the bijection. `DishCatalogDiagnosticsServiceTests.Diagnostics_Should_BeLineageNotApplicable_WithIdenticalOutputAndZeroEffects` is the executable not-applicability proof.

## Final Two-Gap Remediation

- Demand/reservation collision ordering now executes a fresh second public `MaterialDemandService.GenerateAsync` after exact DEFAULT, reconciliation, and legacy issue headers/lines are persisted. The oracle proves the prior DEFAULT request reserves exactly `200 - 50 = 150`, the second request sees exactly `100` stock and purchases exactly `100`, while reconciliation quantity `80` and legacy quantity `70` neither reserve nor satisfy demand. Persisted stock remains `250`, stock movements remain zero, staleness still blocks only on the exact DEFAULT request, and every EF-model scalar on every non-DEFAULT issue/header line is serialized and equal before/after.
- Registry invocation closure now compiles repository source with Roslyn and traverses exact normalized `IMethodSymbol` identities. Identity includes fully qualified containing type, overload parameter signature, reduced extension original definition, exact virtual/interface dispatch targets, invocation operations, and method-group references. Reached source methods alone are followed; unresolved/ambiguous relevant calls fail closed.
- Synthetic registry negatives prove unrelated same-name methods, wrong overloads, and wrong extension receivers cannot claim a target owner. Exact owner and extension receiver positives remain green.
- Exact graph enforcement exposed two prior name-graph false positives. The public DEFAULT issue oracle now actually executes `InventoryIssueApprovalHandler`, and the reconciliation owner oracle now actually calls the public batch projection that reaches `LoadLinkedIssuedQuantitiesAsync`; existing behavioral closures are preserved rather than removed from the registry.

## Verification

- Focused scanner, registry-negative, demand/reservation, DEFAULT approval, and reconciliation projection selection: **5/5 passed**; broader focused Plan 30-09 selection: **24/24 passed**.
- Full API test suite: **1171 passed, 1 intentional integration skip, 0 failed**.
- Release solution build: **passed**, 0 warnings, 0 errors.
- EF parity: `dotnet ef migrations has-pending-model-changes` reports **No changes have been made to the model since the last migration**.
- Adversarial production insertion: exact missing owner `Phase30AdversarialConfiguration.ExecutableOwner` failed the bijection as required; temporary file removed.
- Diff hygiene: committed and working-tree `git diff --check` **passed**.
- Application architecture suite: **48/49 passed**; the sole failure remains the six previously certified baseline cross-feature edges. No allowlist was widened.

## Commits

- `cf4bb0d9` test(30-09): add failing consumer-family bijection gate
- `dba27223` fix(30-09): preserve issue families in data quality cleanup
- `7f9c6b0b` fix(30-09): keep planning consumers on exact default ancestry
- `61208edd` fix(30-09): isolate menu persistence default issue locks
- `30080c44` fix(30-09): restore canonical default issue line inference
- `f2748c4d` test(30-09): enforce semantic lineage owner bijection
- `e553eabe` fix(30-09): expose exact report lineage provenance
- `24707ca6` fix(30-09): retain legacy default line projection compatibility
- `63ad189b` fix(30-09): align request validation with default inference
- `002a8872` test(30-09): advance migration head evidence
- `566d7132` fix(30-09): restore reconciliation issue index parity
- `ce339ba9` test(30-09): close semantic owner certification gaps
- `b4e0ad35` test(30-09): harden semantic lineage registry
- `ceac9a07` test(30-09): prove persisted collision isolation
- `aa891806` test(30-09): close final certification gaps

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Restored full-day DEFAULT issue-line projection**
   - Found during full-suite verification.
   - Exact header-only filtering excluded historical canonical DEFAULT lines whose ownership existed at line level.
   - Fixed by accepting canonical material-request-line ancestry while still excluding reconciliation and legacy lines.
   - Commit: `24707ca6`.

2. **[Rule 1 - Bug] Aligned validators with canonical DEFAULT inference**
   - Found during full-suite verification.
   - Standalone line validation contradicted the restored service compatibility by requiring an explicit source-line ID.
   - Fixed without weakening both-family or reconciliation validation.
   - Commit: `63ad189b`.

3. **[Rule 3 - Blocking] Restored EF snapshot parity**
   - Found by the mandatory EF parity gate.
   - Runtime configuration declared the reconciliation-batch issue index non-unique while migration 76 and its snapshot declared exact one-to-one ownership.
   - Fixed the runtime configuration to match the migration.
   - Commit: `566d7132`.

4. **[Rule 3 - Blocking] Updated migration-head evidence**
   - Found by the full API suite.
   - Evidence tests still asserted migration 75 after the committed Phase 30 migration 76.
   - Updated count/head expectations while preserving immutable archive-prefix verification.
   - Commit: `002a8872`.

## Known Stubs

None.

## Self-Check: PASSED

All listed implementation/test files exist; prior Plan 30-09 commits are present in history; exact Roslyn symbol-call registry closure, same-name/overload/extension negatives, post-collision public demand/reservation, EF-model-complete non-DEFAULT equality, staleness, full API, build, EF parity, unchanged architecture baseline, and diff-hygiene gates were executed.

## Final Local Closeout Reconciliation

- **Final verdict:** PASS at verified HEAD `6bfbd9f9`.
- The previously unnamed “final atomic remediation commit” is `aa891806`; preceding final certification commits include `ce339ba9` and the listed Plan 30-09 chain through `ceac9a07`.
- Final canonical local gates passed after later repository-wide remediation; historical failed aggregate attempts remain preserved and are not treated as PASS evidence.
- See `30-VERIFICATION.md` for the exact commit range and gate matrix.
