# Phase 4: Canonical parser, preview & dependency classifier - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Source:** User-approved milestone research, requirements and roadmap

<domain>
## Phase Boundary

Phase 4 tạo parser canonical thuần, upload bounded, preview manifest read-only và dependency classifier. Không apply mutation, không cleanup DML, không regenerate downstream và không thay UI Admin trong phase này.

</domain>

<decisions>
## Implementation Decisions

### Parser and contract
- **D-04-01:** `IPresetBomWorkbookParser` không phụ thuộc EF; input là bounded workbook stream/object, output là normalized canonical rows và structured issues có sheet/row/cell.
- **D-04-02:** Parser hoàn tất CAN-02 bằng deterministic normalization/source trace, dùng contract và unit policy từ Phase 3.
- **D-04-03:** Missing sheet/header, unsupported tier, invalid quantity, identity collision và ambiguous unit là blocking issue; không mutate hoặc fallback.

### Preview and classifier
- **D-04-04:** Preview dùng `AsNoTracking`, không `SaveChanges`, không tracked mutation và checksum/count trước/sau phải bằng nhau.
- **D-04-05:** Manifest có preview ID, SHA-256, contract/policy version, effective date, actor, DB fingerprint, TTL, source trace và action/blocker counts.
- **D-04-06:** File, effective date, policy hoặc DB drift làm manifest stale; apply tương lai phải reparse/reclassify server-side.
- **D-04-07:** Classifier dùng một pure policy cho `keep/archive/deactivate/regenerate/delete/block`; unknown lifecycle/reference/stock state mặc định `block`.

### Security and compatibility
- **D-04-08:** Preview endpoint Admin-only; actor lấy từ server identity, không tin client actor/path/candidate IDs.
- **D-04-09:** Upload có byte/sheet/row/cell/shared-string/XML/ZIP/external-link bounds và cancellation; corrupt/abusive input trả 4xx không leak temp/server path.
- **D-04-10:** Production API không nhận `D:\...` hay filesystem path; dev sample orchestration có thể gọi service nội bộ bằng stream nhưng không expose path contract.
- **D-04-11:** Old writer/template/UI giữ nguyên compatibility trong Phase 4; không có endpoint apply destructive được expose trước Gate B.

### the agent's Discretion
- Tên DTO/controller route chính xác, miễn tách preview và apply, giữ controller mỏng và RTK/UI chỉ được thêm ở Phase 6.
- Cách tính DB fingerprint, miễn bounded, deterministic và cover rows/versions liên quan.
- Cách lưu preview manifest tạm thời, miễn TTL, actor/scope binding và không cho client forge.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — CAN-02, SAFE-01..02, DATA-01, SEC-01..03.
- `.planning/ROADMAP.md` — Phase 4 scope, success criteria và Gate B.
- `.planning/research/SUMMARY.md` — canonical preview/apply contract, security và retention classifier.
- `.planning/phases/03-contract-provenance-safety-baseline/*-PLAN.md` — artifacts Phase 3 sẽ cung cấp; Phase 4 không giả định chúng đã có trước execution.
- `backend/src/IPCManagement.Api/Services/SampleData/XlsxWorkbookReader.cs` — low-level reader pattern.
- `backend/src/IPCManagement.Api/Services/SampleData/SampleDataImportService.cs` — importer/parser hiện tại cần tách.
- `backend/src/IPCManagement.Api/Middlewares/SampleDataProductionGuardMiddleware.cs` — production guard pattern, không thay thế Admin auth.
- `AGENTS.md` — GitNexus gates.

</canonical_refs>

<specifics>
## Specific Ideas

- Preview action counts phải tách history kept, create/version, draft regenerate, archive/deactivate, true-orphan delete và blocked.
- Filter/search là Phase 6 display concern; backend preview counts luôn toàn dataset.
- Upload security tests phải có renamed non-XLSX, empty, corrupt ZIP, external relationship, oversize shared strings và cancellation.

</specifics>

<deferred>
## Deferred Ideas

- Transactional apply, cache invalidation và downstream reconciliation → Phase 5.
- shadcn Admin workbench/RTK integration → Phase 6.
- Old contract removal → Phase 7.

</deferred>

---
*Phase: 04-canonical-parser-preview-dependency-classifier*
*Context gathered: 2026-07-16 from approved milestone artifacts*
