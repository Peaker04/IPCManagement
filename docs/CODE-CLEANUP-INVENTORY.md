# Inventory code thừa, orphan và chưa gắn

Ngày scan: 2026-08-21  
Trạng thái: living inventory; quyết định cleanup thuộc wave sở hữu consumer.  
Quy tắc xoá: `docs/TABLE-STANDARDIZATION-ROADMAP.md` Wave 8.

## Kết quả source/dependency scan hiện tại

| Candidate | Evidence consumer | Phân loại | Disposition |
| --- | --- | --- | --- |
| `src/components/common/KeepAliveTabPanel.tsx` | Được import bởi Weekly Menu, Warehouse, Purchasing, Approvals, Reports, Chef và Admin panels | production-wired | KEEP; tracked cùng barrel export ở `750e2221`, không còn missing source trên clean checkout |
| `src/components/common/SkeletonTableRow.tsx` | Được export qua common barrel và render bởi `ReportsDataQualityPanel` | production-wired | KEEP |
| `src/lib/useDebouncedValue.ts` | Được dùng bởi BOM, Employees và Inventory page models; có inventory purity contract | production-wired | KEEP |
| `src/features/admin/components/AdvancedDisplaySettings.test.tsx` | Vitest discovery theo hậu tố `.test.tsx` | test entry | KEEP; không yêu cầu production import |
| `tests/statusTokenContract.test.ts` | Vitest discovery theo hậu tố `.test.ts`; khóa `workflowConfig.ts` với `--cell-status-min-w` | test entry | KEEP; tracked cùng status owner ở `9fa3c441`, focused owner suite 55/55 pass |
| `src/features/projects/weekly-menu/coordinationBoundary.test.ts` | Dependency-cruiser đánh dấu orphan vì là test entry | expected entrypoint | KEEP |
| `src/test/setup.ts` | Dependency-cruiser đánh dấu orphan; được Vitest config nạp làm setup | expected config entrypoint | KEEP |
| `public/robots.txt`, `public/llms.txt` | Vite phục vụ implicit từ `public/`; `llms.txt` mô tả public navigation còn `robots.txt` chỉ khai báo crawler policy | static runtime asset | KEEP; đã kiểm route link, không lộ API/secret; tiếp tục review khi deploy domain thay đổi |
| `scripts/generate-status-tokens.mjs` | Không có package script, CI, docs hoặc source reference; token contract test đã kiểm tra trực tiếp `workflowConfig.ts` ↔ `index.css` | superseded/unwired mutating tool | REMOVED; giữ `statusTokenContract.test.ts` làm canonical check |
| `scripts/measure-ultimate-baseline.mjs` | Đã xác minh file `0` bytes, không có package script, CI, docs hoặc source reference | empty/unwired candidate; không có executable capability | REMOVED trong commit cleanup sau consumer proof |
| `scripts/measure-baseline.mjs` | Không có package script, CI, test hoặc docs consumer; chức năng baseline cũ đã được thay bằng `perf-probe.mjs` | retired duplicate measurement tool | REMOVED sau source-aware consumer proof |
| `scripts/measure-rigorous-baseline.mjs` | Không có package script, CI, test hoặc docs consumer; hiệu chuẩn cũ không nằm trong runtime gate hiện hành | retired duplicate measurement tool | REMOVED sau source-aware consumer proof |

Dependency-cruiser hiện quét `423` module và `1572` dependency, không có dependency-rule violation. Hai module có cờ orphan đều là entrypoint hợp lệ nêu trên; kết quả này không chứng minh export/CSS/script không dùng.

### Wave 4/5 cleanup recheck — 2026-08-21

- Source scan trên `frontend/src`, `frontend/tests`, `frontend/package.json`, root `package.json`, `.github`, `tools` và `docs` không tìm thấy consumer cho hai script untracked `generate-status-tokens.mjs` và `measure-ultimate-baseline.mjs`. `generate-status-tokens.mjs` bị supersede bởi `statusTokenContract.test.ts` (test pass), còn `measure-ultimate-baseline.mjs` là file rỗng `0` bytes; `perf-probe.mjs` mới là probe canonical có ba mode và integrity gate.
- Hai script đã được source/capability-scan và xoá sau khi chứng minh không có consumer; disposition chi tiết nằm ở CLN-01/CLN-02.
- `KeepAliveTabPanel`, `useDebouncedValue` và `statusTokenContract.test.ts` đã có import/discovery consumer; disposition `KEEP` không thay đổi.
- Bốn report N/A untracked `probe-h1[-real-admin]-report.{json,md}` đã bị loại sau khi xác nhận cả hai run đều `0/3` gradable; preview lineage và authenticated build evidence canonical được giữ.

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
| CLN-03 | 8 | public crawler/LLM files | Đã xác nhận asset là public navigation metadata; sửa link `/projects` → `/weekly-menu`, không có API/secret | KEEP |
| CLN-04 | mỗi wave | legacy fixture/selector/export phát hiện khi sửa owner | Source-aware zero-consumer proof | CONTINUOUS |

Wave 4 cleanup: removed stale `bom-current`/`bom-preview` nested-tab entries and browser clicks from floorplan and conditional read-only fixtures. Production retains the two internal render states; only obsolete navigation assumptions were removed.

Không candidate nào trong bảng trên được gọi là “dead” chỉ vì build vẫn pass hoặc grep import bằng 0; config, test discovery, public assets và dynamic registry là consumer hợp lệ cần kiểm riêng.

## Controlled worktree cleanup P1–P3 — 2026-09-08

Phạm vi hiện tại chỉ là inventory read-only/source-metadata; chưa xóa, move, sửa production, cài dependency, stage/commit hoặc gỡ worktree. Báo cáo đầy đủ: [P1–P3 inventory](../.artifacts/controlled-cleanup/p1-p3-20260908/inventory-report.md). Nếu artifact local không có trên checkout khác, checklist/decision summary ở đây vẫn là disposition owner; không suy diễn lại từ tên file.

| ID | Exact candidate | Consumer/ownership proof hiện có | Disposition | Approval/gate còn thiếu |
| --- | --- | --- | --- | --- |
| CC-01 | `.tmp-audit-writers.txt`, `.tmp-mrx-full-run.log`, `.tmp-search-inventory.txt` | pre-delete size/hash matched; no non-cleanup tracked reference | REMOVED — Package A 2026-09-08 | exact three-file deletion; 87,719 bytes |
| CC-02 | root `NUL` | exact reserved-name operand removed; Win32/MSYS both reported 0 bytes at deletion although an earlier `ls` appeared to report 150 bytes | REMOVED_WITH_PROCESS_DEVIATION — Package A | no wildcard/adjacent deletion observed, but shell lacked `set -e` for its expected-size/hash test; see Package A report |
| CC-03 | `IPCManagement-backupsmenu-import-mrx06p-goal/` | exact empty-directory precondition passed | REMOVED — Package A | no external path consumer found in scoped source scan |
| CC-04 | root `src/IPCManagement.Api/obj/IPCManagement.Api.csproj.EntityFrameworkCore.targets` and empty `obj/` | exact generated file size/hash passed; parent outside candidate preserved | REMOVED — Package A | 1,729 bytes |
| CC-05 | root `logs/`, root `test-results/` | exact names/sizes/mtimes matched approved snapshots; no target runtime listeners found on pointer ports | REMOVED — Package A | 10 log files/1,302,231 bytes; four test-result files/30,081 bytes |
| CC-06 | root `node_modules/` | active dependency cache, lockfile và package scripts hiện hành | KEEP | cache cleanup không phải dead-code cleanup; reinstall chưa được phép |
| CC-07 | root `D<U+F03A>/Kì 7/.../.artifacts/shipyard-live/goal-runtime-20260729/` | Package C proved exact private-use name and seven empty directories; Package A revalidated code points/tree/zero files. Canonical `.artifacts/.../goal-runtime-20260729` remained 177 files/20,269,034 bytes before and after. | REMOVED — Package A 2026-09-08 | exact Unicode bottom-up removal; no literal `D:` or wildcard. Reports: `.artifacts/controlled-cleanup/package-c-20260908/d-private-colon-investigation.md`, `.artifacts/controlled-cleanup/package-a-20260908/deletion-report.md`. |
| CC-08 | `.artifacts/` | khoảng 11.53 GB; có tracked members và rất nhiều Phase 28+ immutable evidence/helper/profile references | KEEP as a whole | chỉ retention policy theo exact child mới được tạo candidate |
| CC-09 | `artifacts/`, `.docs/` | artifacts có tracked perf evidence; `.docs` là protected boundary và có tracked runbook | KEEP / EXCLUDE | không thuộc ordinary cleanup |
| CC-10 | ba worktree `.claude/worktrees/*` | worktree sạch nhưng tip lịch sử không có merge-base với current rewritten history; owner/process disposition thiếu | KEEP/REVIEW individually | per-worktree history/owner/open-handle approval; cấm blanket `.claude` removal |
| CC-11 | detached `D:/Temp/ipc-plan30-12-fviJM0` | preflight proved no unique commit/index/untracked; non-force removal partially removed the tree, then owner-approved exact force removal completed while commit `eea626a5` remained addressable | REMOVED — Package B 2026-09-08 | no branch deletion, prune or GC; four registered worktrees remain |
| CC-12 | production modules/symbols | chưa có zero-consumer proof mới; compiler/lint/depcruise/build không chạy trong inventory metadata-only | REVIEW | audit theo feature owner + dynamic/config/public/DI/EF consumers + baseline/focused gates trước khi lập batch xóa |

### Package D source/tool audit — 2026-09-08

Audit dùng tooling đã cài; không xóa production. Báo cáo: `.artifacts/controlled-cleanup/package-d-e-20260908/audit-and-checkpoint-proposal.md`.

| ID | Finding | Evidence | Disposition |
| --- | --- | --- | --- |
| CC-15 | strict architecture-growth có ba new-baseline findings: `AuditReportService` 747 lines, `InventoryIssueService` 657, `SupplementalMaterialRequestService` 609; hai service cũ vẫn PLAN_REQUIRED | architecture tests 6/6 PASS; strict gate vẫn FAIL đúng 3 new-debt findings | PLAN WRITTEN / REFACTOR DEFERRED; bounded split proposal giữ constructor/interface/route và không regenerate baseline |
| CC-16 | chín dependency violations: 2 shared→feature, 5 cross-feature→reconciliation, 2 reconciliation→app | baseline red đúng 9; sau move xuống `components`/`lib`, mapper canonical ở `api` và compatibility facades, dependency-cruiser 0 violation | REMEDIATED; không xóa module/public path, behavior tests 119/119 PASS |
| CC-17 | hai orphan modules từ dependency-cruiser | `coordinationBoundary.test.ts` là test entry; `src/test/setup.ts` là Vitest setup | KEEP; expected entrypoints |
| CC-18 | backend build có năm nullable warnings tại ApprovalInbox và Reports services | rebuild baseline 5 warning; guard navigation/required ID sau sửa cho rebuild 0 warning/0 error; focused backend 54/54 PASS | REMEDIATED; không dùng warning suppression hoặc null-forgiving mới |
| CC-19 | deep audit 67 script/tool candidates | 59 KEEP, 6 REVIEW, 2 REMOVE-CANDIDATE; scanner false-positive được disposition bằng import/evidence/manual-owner proof | DISPOSITION COMPLETE / NO DELETION; hai remove-candidate vẫn chờ exact approval, sáu review giữ nguyên |

### Current architecture disposition

Giữ modular monolith/VSA-lite backend và frontend feature ownership với một RTK Query base API. Tái sử dụng TypeScript/ESLint, dependency-cruiser, architecture-growth, route-budget, workflow-boundary, Vitest và backend gates đã wired; chưa cần thêm Knip hoặc framework monorepo. CLEAN-IMPLEMENT đã đưa dependency-cruiser từ 9 về 0 violation và backend rebuild từ 5 nullable warning về 0; independent review không có issue. Strict architecture-growth vẫn đỏ có chủ đích đúng ba service chỉ mới có split proposal, không được mở rộng baseline để che debt. Artifact retention và worktree retention là hai policy riêng; không dùng mục tiêu “git sạch” để xóa evidence hoặc lịch sử.
