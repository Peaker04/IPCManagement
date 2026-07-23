# Phase 3 Research Handoff

**Source:** `.planning/research/SUMMARY.md` (approved milestone research)
**Mode:** Reuse milestone research; no additional phase researcher

## Implementation findings

- Không thêm dependency. Dùng .NET 9, EF Core/Pomelo/MySQL, existing OpenXML reader và xUnit infrastructure.
- Tách contract/policy khỏi `SampleDataImportService`; phase này chỉ cần typed normalized model, shared invariants và forward provenance schema.
- Applied migrations là immutable. Fresh baseline phải ngừng tái seed legacy nhưng không được xóa migration history.
- `DishService` hiện sở hữu manual CRUD và old bulk importer; planner phải tách shared invariant mà chưa retire compatibility surface.
- Provenance cần run-level fingerprint/idempotency metadata và row-level source kind/run link đủ để phân biệt canonical, manual và unknown legacy.
- Backup/restore rehearsal và baseline report là delivery artifact bắt buộc, không phải checklist ghi chú.

## Files and patterns to inspect

- `backend/src/IPCManagement.Api/Services/SampleData/SampleDataImportService.cs`
- `backend/src/IPCManagement.Api/Services/SampleData/XlsxWorkbookReader.cs`
- `backend/src/IPCManagement.Api/Services/DishService.cs`
- `backend/src/IPCManagement.Api/Models/Entities/Dishbom.cs`
- `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`
- `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs`
- `backend/tests/IPCManagement.Api.Tests/SampleDataImportServiceTests.cs`
- `backend/tests/IPCManagement.Api.Tests/DishCatalogTests.cs`
- `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs`
- `scripts/` and `.artifacts/release-gates/` for existing verification/report patterns.

## Threat model inputs

- T-03-01: malicious/corrupt workbook causes unbounded parsing or path disclosure.
- T-03-02: identity collision or silent KG fallback corrupts demand/purchase quantities.
- T-03-03: migration rewrite or broad delete destroys upgrade/history integrity.
- T-03-04: dirty-worktree overlap stages or overwrites unrelated user changes.
- T-03-05: backup marker exists but restore has never been proven.

## Validation Architecture

| Layer | Evidence |
|---|---|
| Contract | xUnit fixtures for sheets, headers, Unicode normalization, weighted duplicate, collision and unit aliases |
| Shared invariants | xUnit/service tests for effective interval, tier and ingredient-level customer overlay |
| Migration | empty-to-latest and representative legacy-to-latest proof; model snapshot diff; no applied-file modification |
| Provenance | integration test for unique idempotency key, actor/reason/hash/count fields and no server-path field |
| Baseline | repeatable script/report with counts/checksums for history, BOM, catalog, stock and draft dependencies |
| Recovery | MySQL clone backup/restore rehearsal with pre/post checksum equality |
| Repository safety | dirty manifest, per-symbol GitNexus impact and pre-commit detect_changes |

## Planner constraints

- Mọi task phải có concrete files, read_first, acceptance criteria, command verification và stop condition.
- Schema plan phải dùng forward EF migration; không chỉnh các file migration cũ.
- Không có task nào xóa legacy production data trong Phase 3.
- Plan phải nêu artifacts/symbols mới và threat_model với ASVS L1 block-on-high.
