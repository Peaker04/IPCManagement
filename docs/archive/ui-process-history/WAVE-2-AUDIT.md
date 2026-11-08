# Wave 2 — Action queue audit

> **HISTORICAL / NO EXECUTION AUTHORITY.** Trạng thái trong file phản ánh thời điểm tạo. Dùng `MEMORY.md`, `docs/README.md` và phase hiện hành để quyết định công việc.


Status: **CLOSED**

## Scope

Approval reconciliation, warehouse exception queues, report data-quality issues and admin cleanup.

## Evidence

- All four surfaces use a canonical table viewport/frame and server pagination where the API exposes a page.
- Each row has a stable domain key and a server-provided action eligibility decision.
- Empty, loading/error and retry states are present at the owning query boundary.
- Data-quality table was reduced from nine to seven decision columns by combining `SLA + trạng thái` and `nhóm lỗi + đối tượng`.
- `frontend/tests/tableContracts.test.ts` blocks direct production tables outside canonical primitives.
- `npm run test:unit -- --run tests/tableContracts.test.ts` — PASS (2 tests).
- `npm run build` — PASS.

## Disposition

| Surface | Decision | Rationale |
| --- | --- | --- |
| Approval reconciliation | keep | One primary approval status; detail dialog owns correction reason and source IDs. |
| Warehouse supplemental/returns | keep | Action eligibility is explicit and actions remain row-local. |
| Warehouse allocation disposition | keep | Quantity facts are distinct; disposition is the only row action. |
| Reports data quality | condense | Removed duplicate visual density without dropping severity, SLA, owner, issue or remediation. |
| Admin cleanup | keep | Six columns already fit the queue contract and reuse the same remediation semantics. |

## Go/no-go

Wave 3 may start. No unowned action-queue component or direct-table consumer remains in the audited scope. Runtime matrix đầy đủ vẫn thuộc Wave 7; probe hiện hành đã được tích hợp tại `frontend/scripts/perf-probe.mjs` và lần đo owner-local mới nhất được ghi trong `WAVE-3-AUDIT.md`.
