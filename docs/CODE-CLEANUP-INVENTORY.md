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
| `scripts/generate-status-tokens.mjs` | Không có package script, CI, docs hoặc source reference; script có khả năng ghi CSS | unwired tool candidate | REVIEW/REMOVE trong wave token owner; không tự chạy hoặc commit khi chưa có contract |
| `scripts/measure-ultimate-baseline.mjs` | Không có package script, CI, docs hoặc source reference | superseded/unwired probe candidate | REVIEW/REMOVE sau khi so coverage với `perf-probe.mjs` và `measure-baseline.mjs` |

Dependency-cruiser hiện quét `423` module và `1572` dependency, không có dependency-rule violation. Hai module có cờ orphan đều là entrypoint hợp lệ nêu trên; kết quả này không chứng minh export/CSS/script không dùng.

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
| CLN-01 | 7/8 | `generate-status-tokens.mjs` | Có canonical generated-token contract + package command thì wire; nếu không remove | REVIEW |
| CLN-02 | 7/8 | `measure-ultimate-baseline.mjs` | Diff capability/output với probe canonical; migrate unique check hoặc remove | REVIEW |
| CLN-03 | 8 | public crawler/LLM files | Xác nhận deploy/product intent và nội dung không lộ route nội bộ | REVIEW |
| CLN-04 | mỗi wave | legacy fixture/selector/export phát hiện khi sửa owner | Source-aware zero-consumer proof | CONTINUOUS |

Không candidate nào trong bảng trên được gọi là “dead” chỉ vì build vẫn pass hoặc grep import bằng 0; config, test discovery, public assets và dynamic registry là consumer hợp lệ cần kiểm riêng.
