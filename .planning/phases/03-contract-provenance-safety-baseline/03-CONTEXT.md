# Phase 3: Contract, provenance & safety baseline - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Source:** User-approved milestone research, requirements and roadmap

<domain>
## Phase Boundary

Phase 3 chỉ khóa collision/unit/shared-CRUD invariant, provenance schema, characterization baseline và backup/restore safety proof. Phase này có thể định nghĩa target contract types nhưng Phase 4 sở hữu parser/source-trace pipeline (CAN-02) và Phase 7 sở hữu single Admin bulk surface sau retirement (CAN-01). Phase này không cung cấp destructive apply, không cleanup production data và không retire old endpoint/UI.

</domain>

<decisions>
## Implementation Decisions

### Canonical workbook
- **D-03-01:** Bulk BOM canonical có đúng ba sheet `định lượng suất 25k`, `định lượng suất 30k`, `định lượng suất 34k`; nhận diện bằng cấu trúc, không bằng local filename/path.
- **D-03-02:** Phase 3 định nghĩa target normalized model không chứa EF entity; Phase 4 triển khai parser và population source sheet/row/trace để hoàn thành CAN-02.
- **D-03-03:** Duplicate chỉ weighted-dedupe khi có serving basis; identity/unit ambiguous là blocker.

### Units and scope
- **D-03-04:** Technical-unit mapping `CAI/HOP/QUA/O/MIENG/CAY/LAT/KG` phải versioned; unknown không fallback `KG`.
- **D-03-05:** Customer BOM overlay theo ingredient/unit; dòng không override fallback global.
- **D-03-06:** Bulk và manual CRUD dùng chung overlap/effective/tier/scope invariants.

### Safety and history
- **D-03-07:** Chứng từ approved/locked/completed, audit, approval history và stock ledger là immutable boundary.
- **D-03-08:** Không rewrite/delete migration đã apply; chỉ tạo forward migration cho provenance/run schema.
- **D-03-09:** Mỗi run contract có source hash, contract/policy version, effective date, actor, reason, backup ID, status và action counts.
- **D-03-10:** Không edit code trước khi có dirty-worktree manifest, GitNexus impact, characterization tests và baseline report.

### the agent's Discretion
- Tên C# record/interface/entity chính xác, miễn kết quả tách parser/reconciliation domain rõ ràng và không thêm dependency.
- Hình thức lưu unit mapping versioned bằng code-owned policy hay forward-seeded table, miễn có version, alias và test fixtures.
- Định dạng baseline report/checksum, miễn tái chạy được và so sánh được pre/post.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — Phase 3 owns CAN-03..04, SAFE-04..05, CRUD-02, RETIRE-03; CAN-02 is Phase 4 and CAN-01 is Phase 7.
- `.planning/ROADMAP.md` — Phase 3 boundary, success criteria và Gate A.
- `.planning/research/SUMMARY.md` — contract, retention, architecture, risk gates và verification matrix đã duyệt.
- `backend/src/IPCManagement.Api/Services/SampleData/SampleDataImportService.cs` — importer ba sheet, unit map và normalization hiện tại.
- `backend/src/IPCManagement.Api/Services/DishService.cs` — overlap/version/manual CRUD và old bulk contract.
- `backend/src/IPCManagement.Api/Models/Entities/Dishbom.cs` — BOM persistence model hiện tại.
- `backend/src/IPCManagement.Api/Migrations/` — applied migration history phải giữ nguyên.
- `AGENTS.md` — GitNexus impact/detect_changes gates.

</canonical_refs>

<specifics>
## Specific Ideas

- Workbook path `D:\Kì 7\PRN222 Doanh Nghiệp\IPC. Định lượng 07.2026.xlsx` chỉ là fixture/dev source, không được thành production API contract.
- Baseline phải bao gồm active BOM theo tier/scope, overlap, unknown unit, invalid quantity, TMP rows, catalog orphan, stock-bearing ingredients, draft/open dependencies và checksum history.
- `Clean_Legacy_Imported_Bom.sql` và `ReplaceBomCatalog` là anti-pattern tham chiếu; không dùng là runner production.

</specifics>

<deferred>
## Deferred Ideas

- Pure parser/preview/classifier implementation → Phase 4.
- Transactional apply, cleanup và downstream regeneration → Phase 5.
- Admin shadcn workbench → Phase 6.
- Old format retirement và guarded rollout → Phase 7.

</deferred>

---
*Phase: 03-contract-provenance-safety-baseline*
*Context gathered: 2026-07-16 from user-approved milestone artifacts*
