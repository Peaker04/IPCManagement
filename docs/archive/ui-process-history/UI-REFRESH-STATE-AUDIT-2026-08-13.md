# Dashboard state and refresh audit — 2026-08-13

> **HISTORICAL / NO EXECUTION AUTHORITY.** Trạng thái trong file phản ánh thời điểm tạo. Dùng `MEMORY.md`, `docs/README.md` và phase hiện hành để quyết định công việc.


Source contract: `.docs/dashboard-state-refresh-rules.md`. Static counts cover `frontend/src`.
Browser-only rules remain unclaimed until headed production-build measurements exist.

| Rule | Phán quyết | Số đo | Vị trí | Số nơi cùng lỗi |
|---|---|---:|---|---:|
| R1 | Đạt (source) | `location.reload` = 0 | `frontend/src` | 0 |
| R2 | Đạt (config) | cache retention = 300s; refetch-on-mount disabled | `api/apiSlice.ts` | 0 |
| R3 | Đạt (scope đã đo bằng source/test) | Weekly Menu aggregate dùng `currentData`; skeleton chỉ khi chưa có page | `weekly-menu/demand/useMaterialDemand.ts`, `MaterialDemandSection.tsx` | 0 trong scope |
| R4 | Không đo được | Thiếu DOM before/after background-refresh height probe | toàn ứng dụng | chưa xác định |
| R5 | Không đạt | global freshness indicator = 0 | app shell | 1 capability gap |
| R6 | Không đo được | không có polling production hiện hành để đo pause; chưa có shared pause contract cho realtime tương lai | query layer | chưa xác định |
| R7 | Không đạt, đã sửa scope phát hiện | broad manual `Coordination` invalidation sau generate = 1 → 0 | `weekly-menu/demand/useMaterialDemand.ts` | 1 |
| R8 | Không đo được | cần store/cache-key probe qua rerender; source có object literals nhưng RTK Query serializes values | query hooks | chưa xác định |
| R10 | Đạt một phần | identical mutations are single-flight; auth refresh is serialized; no global poll/write coordinator | `api/apiSlice.ts` | 1 capability gap |
| R11 | Không đạt | classified A/B/C query registry = 0 | query layer | 1 capability gap |
| R14 | Đạt theo scope hiện tại | production polling declarations = 0 | `frontend/src` | 0 |
| F12/F13 | Không đo được | thiếu row render-count regression and normalized entity measurement | data tables | chưa xác định |
| F15 | Không đo được trong audit source | phải chạy production preview/headed trace | browser harness | chưa xác định |
| F16 | Không đo được | `REQUEST_BUDGET` project parameter chưa khai báo; cần idle one-minute request capture | shared timing config | 1 capability gap |

## Disposition

Applicable normative rules were merged into `docs/DASHBOARD-UI-RULES.md` as F12–F18. The one concrete
broad invalidation found in the active Weekly Menu flow now targets only demand, candidate, purchase,
document, and purchase-request query families. Missing global capabilities are backlog/gate items, not
false PASS claims and not grounds for speculative page-local helpers.
