# Phase 4 Research Handoff

**Source:** `.planning/research/SUMMARY.md`
**Mode:** Reuse milestone research; no additional phase researcher

## Implementation findings

- Reuse bounded OpenXML capabilities in `XlsxWorkbookReader`; do not add Excel package.
- Parser must be pure and typed. Database reconciliation is a separate service consuming normalized desired state.
- Preview and apply must share classifier/policy version, but only preview exists in Phase 4.
- Preview purity requires relational integration evidence, not only mocks.
- Authorization must be Admin policy/role at controller boundary and actor must come from `ICurrentUserService` or established equivalent.
- Security bounds must apply before/deep during ZIP/XML parse to avoid compressed input amplification.
- Classifier must query only relevant dependencies and treat uncertainty conservatively as blocker.

## Likely code boundaries

- `Services/Bom/IPresetBomWorkbookParser.cs`
- `Services/Bom/PresetBomWorkbookParser.cs`
- `Services/Bom/IBomCatalogReconciliationService.cs`
- `Services/Bom/BomCatalogReconciliationService.cs` (preview only in Phase 4)
- `Services/Bom/IBomLegacyCleanupClassifier.cs`
- `Services/Bom/BomLegacyCleanupClassifier.cs`
- Admin-only controller/DTOs for multipart preview and preview status
- Focused parser, security, preview purity, drift and classifier test fixtures

## Threat model inputs

- T-04-01: ZIP/XML bomb or oversized workbook exhausts memory/CPU.
- T-04-02: client-forged actor/path/candidate IDs bypass scope.
- T-04-03: preview mutates tracked entities or persists partial state.
- T-04-04: stale preview used after DB/file/policy change.
- T-04-05: dependency ambiguity classifies referenced/stock-bearing row as deletable.

## Validation Architecture

| Layer | Evidence |
|---|---|
| Parser | xUnit fixtures for canonical sheets/headers/Unicode/trace/dedupe/unit blockers |
| Upload security | API tests for auth, bytes/ZIP/XML/relationships/rows/cells/cancellation/path leak |
| Preview purity | Relational integration test comparing counts/checksums and ChangeTracker before/after |
| Drift | Manifest hash/parameter/DB fingerprint conflict tests with 0 mutation |
| Classifier | Mixed dependency fixture mapping each action/reason/blocker and unknown=block |
| Repository | GitNexus impact before edits and detect_changes/ownership comparison before commit |

## Planner constraints

- Không task apply/cleanup mutation, frontend RTK/UI hoặc old-surface removal.
- Mỗi plan có threat_model ASVS L1 block HIGH và artifacts/symbols created.
- Cross-phase artifacts from Phase 3 phải liệt kê dependency, không khai báo là existing source trước execution.
