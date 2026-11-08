---
phase: 30-closed-loop-menu-issue-reconciliation
plan: 10
subsystem: inventory-reporting
status: complete
tags: [inventory, source-lineage, approvals, audit, csv, ef-core, sqlite]
requires:
  - phase: 30-09
    provides: discovered lineage consumer registry and colliding-family certification fixtures
provides:
  - Exact DEFAULT-only inventory approval, document, report, and KPI business reads
  - Shared audit and CSV rows labelled with exact source family and available source identifiers
  - Public SQLite consumer matrix covering DEFAULT, MATERIAL_RECONCILIATION, and LEGACY_UNCLASSIFIED collisions
  - Updated semantic owner-to-oracle registry for all modified lineage consumers
affects: [30-11, inventory-approvals, workflow-reports, audit-export]
actuals:
  tokens: 15169
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns: [exact header-and-line lineage predicates, line-granular audit provenance, SQLite public-seam collision fixtures]
key-files:
  created:
    - backend/tests/IPCManagement.Api.Tests/Phase30BusinessReadConsumerMatrixTests.cs
  modified:
    - backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalHandlers.cs
    - backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalInboxService.cs
    - backend/src/IPCManagement.Api/Features/Reports/Services/AuditReportService.cs
    - backend/src/IPCManagement.Api/Features/Reports/Services/AuditCsvExporter.cs
    - backend/src/IPCManagement.Api/Features/Reports/Services/InventoryOperationsDocumentQueries.cs
    - backend/src/IPCManagement.Api/Features/Reports/Services/InventoryOperationsReportService.cs
    - backend/src/IPCManagement.Api/Features/Reports/Services/OperationalKpiReportService.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryIssuesController.cs
    - backend/tests/IPCManagement.Api.Tests/InventoryIssuesControllerTests.cs
    - backend/tests/IPCManagement.Api.Tests/Phase30DiscoveredConsumerBijectionTests.cs
key-decisions:
  - "DEFAULT inventory eligibility requires exact MaterialRequest header ancestry and exact MaterialRequestLine ancestry on every issue line."
  - "Shared physical-stock facts remain unfiltered; only family-owned business totals are DEFAULT-isolated."
  - "Audit provenance is emitted per issue line so mixed or unresolved lineage cannot be represented as a fabricated family identity."
patterns-established:
  - "Exact-family read: validate both mutually exclusive header source and mutually exclusive line source before contributing to business totals."
  - "Shared audit surface: classify each row as DEFAULT, MATERIAL_RECONCILIATION, LEGACY_UNCLASSIFIED, or NOT_APPLICABLE and expose only exact available IDs."
requirements-completed: [MRX-01, MRX-02, MRX-06L]
coverage:
  - id: D1
    description: "Inventory approval inbox and mutation handlers accept only exact DEFAULT issues."
    requirement: MRX-02
    verification:
      - kind: integration
        ref: "backend/tests/IPCManagement.Api.Tests/Phase30BusinessReadConsumerMatrixTests.cs#ApprovalInboxAndHandler_Should_UseOnlyExactDefaultLineage"
        status: pass
    human_judgment: false
  - id: D2
    description: "DEFAULT inventory documents, reports, and KPI business totals exclude reconciliation and legacy collisions while shared stock remains canonical."
    requirement: MRX-02
    verification:
      - kind: integration
        ref: "backend/tests/IPCManagement.Api.Tests/Phase30BusinessReadConsumerMatrixTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Audit and CSV rows label source family and expose only exact available source identities."
    requirement: MRX-06L
    verification:
      - kind: integration
        ref: "backend/tests/IPCManagement.Api.Tests/Phase30BusinessReadConsumerMatrixTests.cs#AuditAndCsv_Should_LabelEveryCollidingSourceFamily_WithExactAvailableIdentity"
        status: pass
    human_judgment: false
duration: 45min
completed: 2026-08-31
---

# Phase 30 Plan 10: Closed-Loop Menu Issue Reconciliation Summary

**Exact DEFAULT inventory approvals and business totals now reject colliding reconciliation/legacy lineage, while shared audit and CSV surfaces expose explicit per-line provenance.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-31T01:52:15+07:00
- **Completed:** 2026-08-31T02:37:21+07:00
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Enforced exact DEFAULT header-and-line ancestry before inventory issues appear in approval inboxes or can be approved.
- Isolated DEFAULT workflow documents, operational reports, and KPI business totals without filtering shared physical-stock truth.
- Added line-granular audit provenance, family filtering, and CSV source identity columns for DEFAULT, reconciliation, and unresolved legacy rows.
- Registered every newly modified lineage consumer against executable public-seam oracles in the Plan 30-09 discovery bijection.

## Final Consumer / Family Matrix

| Consumer surface | DEFAULT | MATERIAL_RECONCILIATION | LEGACY_UNCLASSIFIED | Shared physical stock |
|---|---|---|---|---|
| Approval inbox / inventory approval handler | Included and mutable only with exact header + all-line ancestry | Excluded; zero mutation | Excluded; zero mutation | N/A |
| Inventory workflow documents | Included | Excluded | Excluded | N/A |
| Inventory operations reports and KPI business totals | Included in family-owned totals | Excluded from DEFAULT totals | Excluded from DEFAULT totals | Preserved unfiltered |
| Shared audit/detail | Label `DEFAULT`; MaterialRequest and MaterialRequestLine IDs only | Label `MATERIAL_RECONCILIATION`; batch and batch-line IDs only | Label `LEGACY_UNCLASSIFIED`; no fabricated IDs | N/A |
| CSV export | Exports source family and exact available IDs | Exports source family and exact available IDs | Exports legacy label with empty unavailable IDs | N/A |

## Task Commits

1. **Task 1: Prove exact-family business reads and DEFAULT approvals** - `6630fdbf`
2. **Task 2: Keep documents, reports and KPI totals exact to DEFAULT** - `e1f31895`
3. **Task 3: Label every shared audit and CSV row with exact provenance** - `183fa0b9`
4. **Semantic registry alignment and document oracle** - `a0e82c36`
5. **Collision-sensitive read evidence closure** - `24389060`
6. **Non-empty shared physical inventory truth** - `b6ef8a53`

## Files Created/Modified

- `backend/tests/IPCManagement.Api.Tests/Phase30BusinessReadConsumerMatrixTests.cs` - Colliding-family SQLite public-seam matrix.
- `backend/tests/IPCManagement.Api.Tests/Phase30DiscoveredConsumerBijectionTests.cs` - Exact owner-to-oracle registrations for approval, document, KPI, and audit consumers.
- `backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalInboxService.cs` - Exact DEFAULT inbox predicate.
- `backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalHandlers.cs` - Exact DEFAULT mutation guard.
- `backend/src/IPCManagement.Api/Features/Reports/Services/InventoryOperationsDocumentQueries.cs` - DEFAULT-only issue and return documents.
- `backend/src/IPCManagement.Api/Features/Reports/Services/InventoryOperationsReportService.cs` - DEFAULT-only business quantities and issue-line queries.
- `backend/src/IPCManagement.Api/Features/Reports/Services/OperationalKpiReportService.cs` - DEFAULT-only inventory business KPI inputs.
- `backend/src/IPCManagement.Api/Features/Reports/Services/AuditReportService.cs` - Per-line family classification, identities, and filtering.
- `backend/src/IPCManagement.Api/Features/Reports/Services/AuditCsvExporter.cs` - Family and source identity CSV columns.
- `backend/src/IPCManagement.Api/Features/Reports/Contracts/WorkflowReportDto.cs` - Audit provenance contract fields.
- `backend/src/IPCManagement.Api/Shared/Contracts/WorkflowReportQueryDto.cs` - Source-family query filter.

## Final Blocker Remediation

- Replaced the vacuous empty-collection physical-truth comparison with stable canonical `CurrentStock` and `StockMovement` facts carrying non-zero decimals, exact composite/reference identities, dates, balances, lot/reason/note provenance, performer identity, and current-stock version.
- Asserted the complete mapped physical rows before collisions, then invoked the real current-stock, stock-movement, DEFAULT report, paged report, and KPI seams after inserting DEFAULT, reconciliation, and legacy issue families. Both raw physical rows and report projections must remain exactly unchanged and visible, so family/mode filtering of shared truth now fails the test.
- Made inventory issue detail validation consistent with list validation: an unknown `sourceFamily` now returns HTTP 400 by catching `ArgumentException`, while valid detail, not-found, and warehouse authorization behavior remain unchanged.

## Verification

- Final focused Plan 30-10 / bijection / reconciliation / workflow / controller selection: **184 passed**.
- Final complete API test project: **1181 passed, 1 intentional skip, 0 failed**.
- Final `backend/IPCManagement.slnx` Release build: **passed, 0 errors, 5 pre-existing nullable warnings**.
- Final EF model parity: **no pending model changes**.
- Frontend build was not rerun because no frontend or shared generated contract was touched.
- `dotnet test ... --filter "FullyQualifiedName~Phase30DiscoveredConsumerBijectionTests|FullyQualifiedName~Phase30BusinessReadConsumerMatrixTests"`: **27 passed**.
- Focused matrix plus `WorkflowGenerationTests`: **153 passed**.
- Complete API test project: **1177 passed, 1 skipped, 0 failed**.
- API production build with isolated output: **passed, 0 errors** (existing nullable warnings remain).
- `dotnet ef migrations has-pending-model-changes`: **no model changes since the last migration**.
- `git diff --check HEAD~4..HEAD` and working-tree diff check: **passed**.
- Solution-wide isolated-output build was attempted but the pre-existing nested test artifacts under `backend/src/IPCManagement.Api/bin` exceeded the Windows 260-character path limit while the Application test project copied content; the scoped API build and complete API suite both passed.

## Decisions Made

- Exact DEFAULT classification is deliberately stricter than a non-null header: every line must carry only MaterialRequestLine ancestry.
- Non-DEFAULT approval requests return no result and perform no mutation rather than attempting fallback classification.
- Audit issue documents are loaded then flattened in memory to maintain reliable per-line rows across the relational test provider.
- Unrelated audit entities use `NOT_APPLICABLE`; they are not falsely assigned an inventory family.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered newly touched semantic consumers**
- **Found during:** Final regression verification
- **Issue:** Plan 30-09's discovery bijection correctly rejected modified lineage consumers that were not connected to the new collision oracle.
- **Fix:** Added exact owner sets and a public workflow-document oracle to the Plan 30-10 matrix.
- **Files modified:** `Phase30DiscoveredConsumerBijectionTests.cs`, `Phase30BusinessReadConsumerMatrixTests.cs`
- **Verification:** 27 focused matrix/discovery tests passed; full API suite passed.
- **Committed in:** `a0e82c36`

**2. [Rule 3 - Blocking] Used relational fixture and in-memory audit flattening**
- **Found during:** Task 3
- **Issue:** EF InMemory navigation flattening returned no audit issue rows and did not represent production relational behavior.
- **Fix:** Reused the existing SQLite workflow fixture and flattened loaded issue documents per line in memory.
- **Files modified:** `WorkflowGenerationTests.Fixture.cs`, `Phase30BusinessReadConsumerMatrixTests.cs`, `AuditReportService.cs`
- **Verification:** Matrix, focused workflow regression, and full API suites passed.
- **Committed in:** `6630fdbf`, `183fa0b9`

**Total deviations:** 2 auto-fixed (2 Rule 3)
**Impact on plan:** Both fixes were required to preserve the semantic discovery contract and obtain production-representative lineage verification; no product scope was added.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: authorization-sensitive-family-filter | `ApprovalInboxService.cs`, `ApprovalHandlers.cs` | Family predicates now form part of the boundary preventing cross-family exposure and mutation; covered by collision tests. |
| threat_flag: audit-provenance-contract | `AuditReportService.cs`, `AuditCsvExporter.cs` | Shared audit/export reveals cross-family lineage only with explicit family labels and exact available IDs. |

## Issues Encountered

- The solution-level build encountered a Windows path-length failure caused by pre-existing recursively nested build artifacts. This does not affect the changed API project, which built successfully, or its complete 1178-test run.
- Nullable warnings remain in existing navigation-heavy queries; no warning is a runtime test/build error, and the exact-family integration matrix covers the changed paths.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 30-11 can build on exact business-read isolation and the updated semantic owner registry. There are no functional blockers from this plan.

## Self-Check: PASSED

- Final remediation files and the canonical non-empty physical-truth regression exist.
- Focused 184-test selection, full 1182-test API project, solution Release build, EF parity, debt-marker scan, and diff hygiene passed at the remediation working tree.
- All 13 original changed source/test files exist.
- Commits `6630fdbf`, `e1f31895`, `183fa0b9`, and `a0e82c36` exist in history.
- Focused, regression, full API suite, API build, EF parity, and diff hygiene evidence are recorded above.

---
*Phase: 30-closed-loop-menu-issue-reconciliation*
*Completed: 2026-08-31*

## Final Local Closeout Reconciliation

- **Final verdict:** PASS at verified HEAD `6bfbd9f9`.
- The complete Plan 30-10 commit chain is `6630fdbf`, `e1f31895`, `183fa0b9`, `a0e82c36`, `24389060`, and `b6ef8a53`.
- The final non-empty shared-physical-truth and detail-validation remediation is `b6ef8a53`; local aggregate gates later passed canonically.
- Protected execution remains excluded; see `30-VERIFICATION.md`.
