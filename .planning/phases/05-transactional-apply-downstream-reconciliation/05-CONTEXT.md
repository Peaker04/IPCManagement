# Phase 5: Transactional apply & downstream reconciliation - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Source:** User-approved milestone research, requirements and roadmap

<domain>
## Phase Boundary

Phase 5 bật apply canonical BOM trong transaction, retention-aware cleanup mutation đã preview, staleness và regeneration cho draft/open dependencies. Phase này không thay UI Admin và không retire old endpoint/template/code.

</domain>

<decisions>
## Implementation Decisions

### Transactional reconciliation
- **D-05-01:** Apply nhận preview token/ID nhưng phải reparse, recompute DB fingerprint và reclassify server-side; không tin candidate/action IDs từ client.
- **D-05-02:** Domain DML và audit/run counts commit trong một transaction; exception/cancellation rollback toàn bộ.
- **D-05-03:** Unique fingerprint/source-policy-effective-date guard làm apply idempotent; lần hai trả completed/no-op với 0 version/audit rỗng.
- **D-05-04:** Published BOM change = close old version + create new version; unchanged row không mutation; manual source/provenance không bị canonical import xóa mù.

### Retention and deletion
- **D-05-05:** Approved/locked/completed docs, approval history, audit và stock ledger giữ bit-for-bit/count/checksum.
- **D-05-06:** Hard-delete chỉ true orphan đã preview lại, không reference và stock=0; entity có history archive/deactivate; uncertainty=block.
- **D-05-07:** Ordered/received/issued/returned dependency là blocker; cleanup theo leaf-first order và dừng khi action counts khác preview.

### Downstream consistency
- **D-05-08:** BOM version/change token tham gia staleness theo customer/tier/dish/effective scope; scope không ảnh hưởng không stale.
- **D-05-09:** Chỉ exact draft/open statuses đã khóa trong lifecycle policy được cancel/regenerate; mỗi document tối đa một lần theo run.
- **D-05-10:** Regeneration dependency order: draft purchase/inventory leaf → material demand/production draft → menu draft; downstream locked reference chặn upstream destructive action.
- **D-05-11:** Demand dùng tier/unit conversion và customer overlay theo ingredient+unit, fallback global cho dòng còn lại; không nhân legacy portion-rule factor cho calculation mới.
- **D-05-12:** Cache/tag/report invalidation chỉ sau transaction commit; request sau thấy catalog hiện hành, history report vẫn đọc snapshot cũ.

### Audit and stop conditions
- **D-05-13:** Published manual edit thiếu actor/reason bị reject; đủ dữ liệu tạo version, adjustment và audit.
- **D-05-14:** Apply/cleanup không bật nếu Gate B, backup marker, blocker=0, preview freshness hoặc Phase 3/4 verification chưa pass.
- **D-05-15:** Checksum drift, new blocker, unexpected GitNexus flow hoặc action count mismatch là fail/rollback, không best-effort continue.

### the agent's Discretion
- Transaction isolation level và batch size, miễn giữ atomic domain+audit semantics và tránh transaction kéo dài do parse file.
- Tên change-token/staleness component và cache invalidation abstraction, miễn scope-aware và testable.
- Cách biểu diễn cancel/regeneration linkage, miễn source run và old/new document trace được lưu.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — SAFE-03, DATA-02..04, DOWN-01..05, CRUD-03.
- `.planning/ROADMAP.md` — Phase 5 scope, Gate C và success criteria.
- `.planning/research/SUMMARY.md` — retention matrix, target architecture và verification matrix.
- Phase 3 plans — provenance/run schema, lifecycle policy, baseline/restore artifacts.
- Phase 4 plans — parser, diff, preview manifest, dependency classifier và Gate B artifacts.
- `backend/src/IPCManagement.Api/Services/Workflow/MaterialDemandCalculator.cs`
- `backend/src/IPCManagement.Api/Services/Workflow/MaterialDemandService.cs`
- `backend/src/IPCManagement.Api/Services/DishService.cs`
- `backend/src/IPCManagement.Api/Services/Workflow/WorkflowReportService.cs`
- `AGENTS.md`

</canonical_refs>

<specifics>
## Specific Ideas

- Apply file parsing/normalization nên hoàn tất trước transaction; bên trong transaction phải revalidate hash/fingerprint/candidates và ghi mutation/audit.
- Apply result counts phải reconcile với manifest action counts và baseline; no-op counts rõ ràng.
- Integration fixtures phải có mixed states, customer partial override, unit family, locked downstream, stock-bearing ingredient và injected failure.

</specifics>

<deferred>
## Deferred Ideas

- Admin shadcn preview/apply/cleanup UX → Phase 6.
- Old writer/template/code/data retirement và rollout clone → Phase 7.

</deferred>

---
*Phase: 05-transactional-apply-downstream-reconciliation*
*Context gathered: 2026-07-16 from approved milestone artifacts*
