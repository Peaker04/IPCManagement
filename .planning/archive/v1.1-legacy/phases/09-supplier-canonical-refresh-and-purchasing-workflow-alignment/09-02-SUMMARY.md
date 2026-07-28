---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 02
subsystem: purchase-history-reconciliation
tags: [xlsx, normalization, provenance, xunit, tdd]
requires:
  - phase: 09-01
    provides: audited workbook identity, 3,207-key delta, and Phase 09 reconciliation test seam
provides:
  - deterministic stream-based parser for the audited 20.7 purchase-history workbook
  - immutable blocker-first supplier, ingredient, unit, package, and date normalization policy
  - preview/apply DTO contracts that exclude client-controlled source paths, actors, and replacements
affects: [09-03, 09-04, 09-05, 09-08, 09-14]
tech-stack:
  added: []
  patterns: [server-resolved stream parsing, raw-cell provenance, versioned normalization policy, structured blocker codes]
key-files:
  created:
    - backend/src/IPCManagement.Api/Services/SampleData/PurchaseHistorySourceParser.cs
    - backend/src/IPCManagement.Api/Services/SampleData/PurchaseHistoryNormalizationPolicy.cs
    - backend/src/IPCManagement.Api/Models/DTOs/SampleData/PurchaseHistoryReconciliationDto.cs
  modified:
    - backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs
key-decisions:
  - "Keep purchase-history source discovery server-owned: the parser accepts a resolved stream and never a request path."
  - "Version the locked normalization contract as purchase-history-normalization/2026-07-22/v1 and block every unaudited interpretation."
  - "Represent preview/apply acknowledgement with manifest hashes and accepted action IDs only; never accept normalized replacements or actor IDs."
patterns-established:
  - "Every parsed candidate carries workbook/sheet/row source identity, raw cells, source key, business key, and row hash."
  - "Normalization returns stable blocker codes with the original source trace instead of defaulting, clamping, dropping, or guessing."
requirements-completed: [SUP-01, SUP-02]
duration: 32m
completed: 2026-07-22
---

# Phase 9 Plan 2: Purchase History Parser and Normalization Summary

**Deterministic audited-XLSX parsing with complete raw provenance and a versioned blocker-first normalization contract for suppliers, ingredients, units, packages, and delivery dates.**

## Performance

- **Duration:** 32m
- **Started:** 2026-07-22T05:31:09Z
- **Completed:** 2026-07-22T06:03:30Z
- **Tasks:** 2
- **Files changed or created:** 4

## Accomplishments

- Parsed the exact 20.7 workbook from an already-resolved stream into 34 recognized sheets, 31 supplier-policy sheets, 30 data sheets, and the reproduced 3,207-key case-insensitive delta over 19.5.
- Preserved deterministic source keys, normalized business keys, row hashes, sheet/row coordinates, and complete raw cells for candidates and blockers; 20.7 supersedes legacy duplicates predictably.
- Added the immutable `purchase-history-normalization/2026-07-22/v1` policy with audited supplier allowlisting, ingredient separation, bounded unit aliases, BICH package snapshots, and as-of-plus-seven-day date bounds.
- Added preview/apply DTOs whose client input is limited to manifest ID/hash, accepted action IDs, and backup/restore evidence; source paths, actor IDs, and normalized replacement payloads are absent.

## Task Commits

1. **Task 1 RED: Add failing purchase-history parser contract** — `ae1f44c` (`test`)
2. **Task 1 GREEN: Parse audited purchase history deterministically** — `6089df6` (`feat`)
3. **Task 2 RED: Add failing normalization policy contract** — `2fc71b4` (`test`)
4. **Task 2 GREEN: Enforce blocker-first purchase normalization** — `f4acff6` (`feat`)

## Files Created/Modified

- `backend/src/IPCManagement.Api/Services/SampleData/PurchaseHistorySourceParser.cs` — package-free ZIP/XML parser, audited sheet recognition, workbook/source/business identities, supersession, and raw trace.
- `backend/src/IPCManagement.Api/Services/SampleData/PurchaseHistoryNormalizationPolicy.cs` — versioned supplier/ingredient/unit/package/date policy with stable blockers.
- `backend/src/IPCManagement.Api/Models/DTOs/SampleData/PurchaseHistoryReconciliationDto.cs` — server-owned preview and manifest-bound apply contracts.
- `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs` — exact workbook baseline, supersession, table-driven normalization, blocker evidence, and DTO boundary tests.

## Decisions Made

- Kept parsing pure and server-owned by accepting only a resolved `Stream`, source SHA-256, source label, and explicit as-of date; the parser has no EF, request path, active-supplier query, or current-clock dependency.
- Built the canonical supplier set from audited SUMMARY/data-sheet values, with pseudo-suppliers and unreferenced headings blocked as `SUPPLIER_UNKNOWN`.
- Preserved plain `BICH`, required an ingredient+supplier+period rule for decorated package sizes, and snapshotted the applied rule instead of inferring a mutable current value.
- Treated `kh`/`canh`, unknown units, ambiguous embedded supplier text, missing package rules, and dates outside the allowed window as explicit blockers without KG fallback, clamp, delete, or silent skip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Parsed scientific-notation quantities without losing importable rows**
- **Found during:** Task 1 GREEN
- **Issue:** Audited workbook quantities such as exponential numeric text parsed as zero under decimal-only number styles, breaking three legacy business keys.
- **Fix:** Allowed the exponent number style while retaining invariant/culture-bounded decimal parsing and added exact row/key regression assertions.
- **Files modified:** `PurchaseHistorySourceParser.cs`, `PurchaseHistoryReconciliationTests.cs`
- **Commit:** `6089df6`

**2. [Rule 1 - Bug] Matched workbook merged-cell and repeated-header behavior**
- **Found during:** Task 1 GREEN
- **Issue:** Raw XLSX sheets contain merged values and repeated header labels that a naive XML projection either omitted or treated as duplicate dictionary keys.
- **Fix:** Propagated merged values and kept deterministic header-column mapping while preserving every raw cell in the source trace.
- **Files modified:** `PurchaseHistorySourceParser.cs`
- **Commit:** `6089df6`

## Verification

- Focused parser suite: **3 passed, 0 failed**.
- Focused normalization suite: **28 passed, 0 failed**.
- Full purchase-history reconciliation suite: **36 passed, 1 intentionally skipped, 0 failed**.
- Existing `SampleDataImportServiceTests` characterization: **31 passed, 0 failed**.
- Backend Release build: **succeeded with 0 warnings and 0 errors**.
- GitNexus `compare` against `main`: **LOW risk, 0 affected processes**; task-level staged checks were also LOW.
- Package/project manifests unchanged; no new NuGet/npm dependency was introduced.
- Protected SQL remained untracked with SHA-256 `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53`.
- Source-contract scans found no parser EF/request-path/current-clock dependency and no client-controlled path, actor, user ID, or normalized replacement field in request DTOs.

## Known Stubs

- `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs:316` — immutable-history apply and no-op replay remains an intentional skipped RED seam owned by Plan 09-05; it does not block this parser/normalization goal.

## Next Phase Readiness

- Plans 09-03 through 09-05 can consume deterministic candidates, structured blockers, immutable policy identity, and manifest-bound DTOs without reopening workbook interpretation.
- Supplier/purchasing plans can display exact raw sheet/row/cell evidence for every blocked ambiguity.
- No database mutation or live/shared reconciliation apply was performed in this plan.

## Self-Check: PASSED

- All four production/test files and this summary exist on disk.
- Task commits `ae1f44c`, `6089df6`, `2fc71b4`, and `f4acff6` exist in Git history.
