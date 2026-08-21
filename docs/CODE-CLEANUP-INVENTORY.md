# Inventory code thừa, orphan và chưa gắn

Ngày scan: 2026-08-21  
Trạng thái: living inventory; quyết định cleanup thuộc wave sở hữu consumer.  
Quy tắc xoá: `docs/TABLE-STANDARDIZATION-ROADMAP.md` Wave 8.

## Kết quả source/dependency scan hiện tại

| Candidate | Evidence consumer | Phân loại | Disposition |
| --- | --- | --- | --- |
| `src/components/common/KeepAliveTabPanel.tsx` | Được import bởi Weekly Menu, Warehouse, Purchasing, Approvals, Reports, Chef và Admin panels | production-wired | KEEP |
| `src/components/common/SkeletonTableRow.tsx` | Được export qua common barrel và render bởi `ReportsDataQualityPanel` | production-wired | KEEP |
| `src/lib/useDebouncedValue.ts` | Được dùng bởi BOM, Employees và Inventory page models; có inventory purity contract | production-wired | KEEP |
| `src/features/admin/components/AdvancedDisplaySettings.test.tsx` | Vitest discovery theo hậu tố `.test.tsx` | test entry | KEEP; không yêu cầu production import |
| `tests/statusTokenContract.test.ts` | Vitest discovery theo hậu tố `.test.ts` | test entry | KEEP; xác minh test pass trong wave token owner |
| `src/features/projects/weekly-menu/coordinationBoundary.test.ts` | Dependency-cruiser đánh dấu orphan vì là test entry | expected entrypoint | KEEP |
| `src/test/setup.ts` | Dependency-cruiser đánh dấu orphan; được Vitest config nạp làm setup | expected config entrypoint | KEEP |
| `public/robots.txt`, `public/llms.txt` | Vite phục vụ implicit từ `public/`, không có TS import | static runtime asset | KEEP-REVIEW; kiểm content/deploy contract trước khi commit |
| `scripts/generate-status-tokens.mjs` | Không có package script, CI, docs hoặc source reference; token contract test đã kiểm tra trực tiếp `workflowConfig.ts` ↔ `index.css` | superseded/unwired mutating tool | REMOVED; giữ `statusTokenContract.test.ts` làm canonical check |
| `scripts/measure-ultimate-baseline.mjs` | Đã xác minh file `0` bytes, không có package script, CI, docs hoặc source reference | empty/unwired candidate; không có executable capability | REMOVED trong commit cleanup sau consumer proof |

Dependency-cruiser hiện quét `423` module và `1572` dependency, không có dependency-rule violation. Hai module có cờ orphan đều là entrypoint hợp lệ nêu trên; kết quả này không chứng minh export/CSS/script không dùng.

### Wave 4/5 cleanup recheck — 2026-08-21

- Source scan trên `frontend/src`, `frontend/tests`, `frontend/package.json`, root `package.json`, `.github`, `tools` và `docs` không tìm thấy consumer cho hai script untracked `generate-status-tokens.mjs` và `measure-ultimate-baseline.mjs`. `generate-status-tokens.mjs` bị supersede bởi `statusTokenContract.test.ts` (test pass), còn `measure-ultimate-baseline.mjs` là file rỗng `0` bytes; `perf-probe.mjs` mới là probe canonical có ba mode và integrity gate.
- Hai script đã được source/capability-scan và xoá sau khi chứng minh không có consumer; disposition chi tiết nằm ở CLN-01/CLN-02.
- `KeepAliveTabPanel`, `useDebouncedValue` và `statusTokenContract.test.ts` đã có import/discovery consumer; disposition `KEEP` không thay đổi.

## Ledger consumer scan — 2026-08-21

Source-aware `rg` scan trên `frontend/src`, `frontend/tests`, `backend/src` và `backend/tests` xác nhận các shared ledger owners đều có consumer production và/hoặc contract test:

| Owner | Consumer evidence | Disposition |
| --- | --- | --- |
| `StockMovementTable` | Warehouse, Admin Inventory, Chef journal, Reports, common tests/barrel | KEEP; shared consumer-dependent |
| `WeeklyMenuImportHistory` | Import dialog/hook/API, route preloader, backend controller/service/contract tests | KEEP; Wave 3 owner |
| `AdminAuditPanel` | AdminDataPage, model, feedback/state/typography contracts | KEEP |
| `WarehouseReceiptLifecyclePanel` | WarehousePage, UI audit, query-boundary and component tests | KEEP |
| `RoleInbox` | Dashboard, Warehouse Demand, Reports overview/API and common tests/barrel | KEEP |
| `WeeklyMenuImportJobs` | Import dialog and confirmation/source/typography/quantity tests | KEEP |

Không phát hiện ledger owner nào chỉ còn export mà không có consumer. Dynamic registry/style consumers vẫn thuộc Wave 8 sweep; candidate script dispositions không thay đổi.

## Checklist áp dụng trong mọi wave

- [ ] Liệt kê file/symbol/style/script bị thay thế.
- [ ] Tìm direct import, barrel export, lazy import, registry, route, permission, string/class consumer và config/CI/docs invocation.
- [ ] Với dynamic consumer, thêm contract/test trước khi kết luận `KEEP` hoặc `REMOVE`.
- [ ] Xoá consumer cuối và implementation trong cùng commit; không để barrel export chết.
- [ ] Code mới phải có production consumer hoặc test/config entrypoint được ghi rõ.
- [ ] Chạy build, focused tests, dependency-cruiser và source inventory sau cleanup.
- [ ] Nếu candidate nằm trong dirty change không thuộc wave, ghi `REVIEW` và giữ nguyên; không overwrite/xoá thay đổi của owner khác.

## Hàng đợi cleanup

| ID | Wave owner | Candidate | Điều kiện quyết định | Trạng thái |
| --- | --- | --- | --- | --- |
| CLN-01 | 7/8 | `generate-status-tokens.mjs` | Token contract đã có test canonical; script mutating không có consumer; đã xoá | REMOVED |
| CLN-02 | 7/8 | `measure-ultimate-baseline.mjs` | Đã đối chiếu: 0 bytes, không capability/consumer; đã xoá cùng inventory update | REMOVED |
| CLN-03 | 8 | public crawler/LLM files | Xác nhận deploy/product intent và nội dung không lộ route nội bộ | REVIEW |
| CLN-04 | mỗi wave | legacy fixture/selector/export phát hiện khi sửa owner | Source-aware zero-consumer proof | CONTINUOUS |

Wave 4 cleanup: removed stale `bom-current`/`bom-preview` nested-tab entries and browser clicks from floorplan and conditional read-only fixtures. Production retains the two internal render states; only obsolete navigation assumptions were removed.

Không candidate nào trong bảng trên được gọi là “dead” chỉ vì build vẫn pass hoặc grep import bằng 0; config, test discovery, public assets và dynamic registry là consumer hợp lệ cần kiểm riêng.
