---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 03
subsystem: backend
tags: [reconciliation, preview, sha256, ef-core, authorization, tdd]
requires:
  - phase: 09-02
    provides: audited 20.7 parser, normalization policy, raw blocker evidence, and manifest DTO seam
provides:
  - deterministic read-only purchase-history reconciliation preview
  - dependency-aware keep/version/deactivate/delete/block action matrix
  - Development-only catalog-authorized preview endpoint with server-derived actor
  - source, policy, as-of, database, action, count, and blocker-bound manifest hashes
affects: [09-04, 09-05, supplier-reconciliation, sample-data-api]
tech-stack:
  added: []
  patterns:
    - AsNoTracking snapshot classification with no SaveChanges or transaction path
    - canonical SHA-256 evidence and ordered manifest construction
    - server-owned source resolution plus authorization-before-source-access
key-files:
  created:
    - backend/src/IPCManagement.Api/Services/SampleData/IPurchaseHistoryReconciliationService.cs
    - backend/src/IPCManagement.Api/Services/SampleData/PurchaseHistoryReconciliationService.cs
  modified:
    - backend/src/IPCManagement.Api/Controllers/SampleDataController.cs
    - backend/src/IPCManagement.Api/DependencyInjection.cs
    - backend/src/IPCManagement.Api/Models/DTOs/SampleData/PurchaseHistoryReconciliationDto.cs
    - backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs
key-decisions:
  - "Resolve only the audited 20.7 workbook on the server and reject a hash or 17,739-key baseline mismatch before classification."
  - "Delete only sample-generated dependency-free receipt-line orphans; version changed immutable history and emit deactivate evidence for referenced duplicates."
  - "Bind the manifest to ordered action hashes, exact action counts, blockers, policy, as-of date, source SHA-256, and a deterministic database fingerprint."
  - "Derive PreviewedBy from the authenticated principal; preview requests contain no actor, user ID, replacement, upload, or path field."
requirements-completed: [SUP-03]
duration: 16m
completed: 2026-07-22
---

# Phase 09 Plan 03: Drift-Bound Purchase-History Preview Summary

Deterministic, zero-write reconciliation preview with five auditable dispositions, SHA-256 drift binding, and a Development-only authorized API.

## Accomplishments

- Added an `AsNoTracking` preview service that fingerprints the relevant supplier, ingredient, unit, receipt, receipt-line, stock-movement, and current-stock state without calling `SaveChanges` or opening a transaction.
- Classified source and database differences as exact `keep`, `version`, `deactivate`, `delete`, or `block` actions with deterministic IDs plus before/after evidence hashes.
- Preserved linked or operationally referenced history; hard deletion is proposed only for sample-generated rows proven free of purchase-request, movement, and current-stock dependencies.
- Bound the preview manifest to the audited source SHA-256/name, normalization policy, as-of date, 17,739 current unique-key baseline, 3,207-key audited delta, database fingerprint, ordered action hashes, exact counts, and blockers.
- Published `POST /api/sample-data/purchase-history/preview` behind the existing CatalogAccess policy and sample-data Production guard; unauthorized callers are rejected before the source service is invoked.

## Task Commits

| Commit | Type | Description |
| --- | --- | --- |
| `a94b6f2` | RED | Failing preview purity, immutable-history, orphan-delete, and replay tests |
| `b39c1b8` | GREEN | Read-only classifier, manifest builder, DTO evidence, and service contract |
| `cc0a731` | RED | Failing endpoint authorization, server-identity, and Production-hide tests |
| `b519456` | GREEN | Guarded preview endpoint and scoped DI registration |
| `b5d4888` | RED | Complete deactivate/block matrix and all manifest drift dimensions |
| `9fb74b0` | GREEN | Complete five-action classifier and bind policy drift into the manifest |

## Files Created/Modified

- `backend/src/IPCManagement.Api/Services/SampleData/IPurchaseHistoryReconciliationService.cs` — read-only preview contract.
- `backend/src/IPCManagement.Api/Services/SampleData/PurchaseHistoryReconciliationService.cs` — server source validation, `AsNoTracking` snapshot reads, dependency classification, evidence hashing, and manifest construction.
- `backend/src/IPCManagement.Api/Models/DTOs/SampleData/PurchaseHistoryReconciliationDto.cs` — exact source/database/action/count evidence returned by preview.
- `backend/src/IPCManagement.Api/Controllers/SampleDataController.cs` — Development-only preview endpoint and server-derived operator identity.
- `backend/src/IPCManagement.Api/DependencyInjection.cs` — scoped preview service registration.
- `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs` — purity, action matrix, drift, authorization, and endpoint coverage.

## Decisions Made

- The filename is not trusted as identity: the server re-parses the fixed 20.7 workbook and requires the audited SHA-256 and 17,739 unique-key count.
- A nonzero current-stock aggregate is treated conservatively as an operational dependency, preventing hard deletion of a receipt line that may contribute to live stock.
- `block` remains both a structured action and a raw-evidence diagnostic, so later apply logic can require an empty blocker set without losing source traceability.
- The response may show the authenticated operator, but no client-controlled actor or local filesystem path participates in the request contract or manifest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Extended the preview evidence DTO contract**
- **Found during:** Task 1 GREEN implementation
- **Issue:** The existing DTO seam did not carry source name, database fingerprint, exact action counts, target/reason fields, or before/after/action hashes required by D-09-07 and D-09-10.
- **Fix:** Added server-output-only evidence fields while preserving the path/actor/replacement-free request contract.
- **Files modified:** `backend/src/IPCManagement.Api/Models/DTOs/SampleData/PurchaseHistoryReconciliationDto.cs`
- **Commit:** `b39c1b8`

**2. [Rule 2 - Missing critical functionality] Completed deactivate/block and drift coverage before closeout**
- **Found during:** Overall plan verification
- **Issue:** The first GREEN implementation covered keep/version/delete and blocker diagnostics but did not emit explicit deactivate/block actions or prove every manifest drift dimension.
- **Fix:** Added RED coverage for referenced duplicate deactivation, catalog ambiguity blocking, and source/policy/as-of/database/action drift; completed the action matrix in the shared preview service.
- **Files modified:** `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs`, `backend/src/IPCManagement.Api/Services/SampleData/PurchaseHistoryReconciliationService.cs`
- **Commits:** `b5d4888`, `9fb74b0`

### GitNexus Risk Gate

- Pre-edit impact for the controller, constructor, existing import action, DI class, and `AddBackendServices` was LOW with zero affected processes.
- The pre-commit staged scan of controller plus DI reported HIGH across nine existing sample-import flows. Execution stopped, the exact two-file diff was shown, and the user explicitly approved that bounded preview-only scope before commit `b519456`.
- After commit and index refresh, the complete `f307bd4..9fb74b0` plan range reports LOW risk, 104 changed symbols, and zero affected processes. Compare-to-`main` remains HIGH because it includes 79 files from pre-existing branch work outside this plan.

## Verification

- Focused Release preview filter: **9 passed, 0 failed**.
- Preview endpoint subset: **4 passed, 0 failed** — Manager success, server identity, unauthenticated 401, unauthorized 403, Production 404, and no service access on rejected calls.
- All `PurchaseHistoryReconciliationTests`: **45 passed, 0 failed, 1 skipped**; the skip is the Plan 09-05 guarded-apply seam.
- Existing `SampleDataImportServiceTests`: **31 passed, 0 failed**.
- Full backend Release suite: **377 passed, 0 failed, 6 skipped**; all skips are explicitly assigned to later Phase 9 plans.
- Backend Release build: **succeeded with 0 warnings and 0 errors**.
- Package/project manifest diff: **empty**; no NuGet or npm dependency was added.
- Protected SQL remains untracked with SHA-256 `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53`.
- Guard scan found no preview `SaveChanges`, transaction, apply branch, client path, upload, actor ID, or user ID field.
- Final metadata commit was intentionally skipped by the GSD commit helper with `skipped_gitignored`; `.planning/` is ignored by repository policy, so no force-stage fallback was used.

## Known Stubs

- `PurchaseHistoryReconciliationTests.Apply_preserves_immutable_history_and_second_apply_is_no_op` remains intentionally skipped; Plan 09-05 owns guarded apply and no-op replay. It does not block this plan's pure preview goal.

## Next Phase Readiness

- Plan 09-04 can persist reconciliation runs/evidence against the deterministic manifest and action DTO contract.
- Plan 09-05 can rebuild the same preview inside a transaction, compare exact hashes/counts, require backup/restore evidence, and apply only accepted action IDs.
- No database mutation, live/shared reconciliation, client-controlled source, or apply endpoint was introduced.

## Self-Check: PASSED

- All six implementation/test files and this summary exist on disk.
- All six task/TDD commits resolve as commits in repository history.
- No unexpected tracked deletion or untracked generated output was found.
