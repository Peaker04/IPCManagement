---
updated: 2026-08-04
branch: feature/workflow-b17-b18
runtime_ports:
  frontend: 3001
  api: 8001
  shipyard: 8090
  mysql: 3306
  audit_frontend: 3010
  audit_api: 8010
db_lane: ipc_lane1
credentials_via: K6_PASSWORD
workbook:
  path: 'C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx'
  sha256: A7E734CEFBD409E7220C4FF19B3E1B7FDDD4E33D202A3F24E63309D60D4D5A01
---

# Memory hiện hành

File này là nguồn trạng thái duy nhất được auto-load sau `AGENTS.md`. Code/runtime và database
lineage đã kiểm tra trực tiếp luôn cao hơn tài liệu. Hiện chỉ MySQL listen; các app runtime đã teardown.

## Memory ngắn cho phiên tiếp theo

1. Đọc `AGENTS.md` và file này, sau đó đối chiếu `git status --short --branch`, các port trong front matter và timestamp của evidence mới nhất. Chỉ chạy `node .gitnexus/run.cjs status` khi Kỳ yêu cầu dùng GitNexus.
2. Giữ nguyên worktree bẩn và dữ liệu evidence trong lane; không reset, seed, sanitize, restore hoặc import lại chỉ để tái hiện test. Mọi mutation DB mới cần xác nhận đúng lane, lineage và rollback checkpoint.
3. Khi boot E2E, phải dùng source của checkout hiện tại, xác minh `/health/ready` trỏ đúng lane trong front matter, lấy mật khẩu demo từ credential đã xoay và không thử giá trị mặc định.
4. Phân loại dữ liệu theo `docs/DATA-GRAIN-MATRIX.md`: ngày, tuần, snapshot, source-line và movement audit. Không gộp theo tên; mutation luôn dùng source-line ID.
5. Với nghi ngờ duplicate/double-count, đối chiếu cùng lúc FE row/caption, API key và quantity, DB source-line/movement chain và FE sau reload. Các dòng `Bột nở` khác ngày và movement audit hiện hành là hợp lệ; lỗi đã sửa là aggregate stock allocation `Max` → `Sum`.
6. Browser gate phải chạy Chrome headed đủ ma trận viewport, lưu screenshot, API sau action, console/page error, CLS và long task. Không kết luận pass từ BE/API riêng lẻ.
7. GitNexus là opt-in: chỉ khi Kỳ yêu cầu mới phân loại intended final diff theo policy ba lane trong
   `AGENTS.md` và chạy graph evidence. Nếu không, dùng source/test và gate GSD phù hợp, cùng secret scan
   và `git diff --check`.
8. Sau mỗi chuỗi thay đổi/E2E đáng kể, cập nhật front matter, evidence, gate và phần còn mở; việc đã đóng phải xóa khỏi file này và append sang `HISTORY.md`.

## Bất biến

- Grain nghiệp vụ lấy `docs/DATA-GRAIN-MATRIX.md` làm contract. Nhu cầu ngày, tổng tuần, snapshot tồn, source-line chứng từ và movement audit không được trộn.
- Không gộp, deduplicate hoặc dùng React key theo tên nguyên liệu. Dòng tổng chỉ là presentation; action phải drill down về ID nguồn.
- Browser gate desktop hiện hành có đúng năm viewport: `1920×1080`, `1440×900`, `1366×768`, `1365×900`, `1280×900`.
- PB canon đã được Kỳ duyệt toàn bộ ngày `2026-07-30`; Button chọn 8B và form controls chọn 9B theo `docs/PB-UI-VARIANT-AUDIT.md`. `WeeklyMenuLifecyclePanel` phát sinh do hiểu nhầm E2E đã bị gỡ; lifecycle model/registry chỉ còn là contract/test. D-01 khóa Option A: WeeklyMenu DRAFT `Publish` vẫn **Admin-only**; việc Manager/Coordinator không có control là FE chặt hơn BE có chủ đích. Phase 20 đã đóng với zero production PD candidate và không có UI lifecycle panel mới.
- DEC-06 đã được materialize trong Phase 19 bằng registry test-owned `CoordinationOrderScopeLifecycle`: grain mỗi hàng là
  `scenario × operation`, mọi hàng có `scope`, còn `entityState` và `projectionState` tách riêng. Registry có
  20 rows, inventory 13 family và shared FE/BE manifest; production không import registry. WeeklyMenu snapshot
  và hành vi production không đổi.
- Không kết luận pass từ BE/API riêng lẻ; evidence phải nối FE control → API → DB transition → FE reload.
- Trước khi chạy file `.sql`, phải soi `USE`, `CREATE DATABASE`, `DROP DATABASE` và `DROP TABLE`; database đích trên CLI không vô hiệu hóa `USE` bên trong file. Không chạy mutation nếu chưa có precondition và rollback.
- UI giữ SAP Fiori compact: work object theo tab, action/status rõ, tab một dòng có overflow hợp lý, shell không remount, panel cũ được giữ khi refetch và loading/empty/error/permission không được đánh đồng.
- Không reset/seed/import lại lane để làm test xanh; artifact và DB lineage phải được bảo toàn.
- Mỗi số liệu trạng thái chỉ khai trong một file: gate hiện hành ở đây, hash output artifact ở evidence index; nơi khác chỉ trỏ link.
- `MEMORY.md` chỉ giữ trạng thái hiện hành; `HISTORY.md` append-only, `LESSONS.md` bất biến, `docs/EVIDENCE-INDEX.md` quản lý artifact và hash.
- GitNexus rigor theo semantics, không theo đuôi file: docs/leaf assertion trơ là graph-free; shared harness
  hoặc permission/route/state/API/cache/schema literals là lightweight; production/API/auth/migration hoặc
  mixed diff là full-analysis. Graph-free risk ghi `N/A`, không tạo LOW giả bằng graph call.

## Còn mở

- `OPEN-04` · owner `Ops/Backup` · đóng khi dump + binlog được mã hóa lên object storage immutable, có SSD luân phiên off-premises và restore drill chỉ từ off-site pass toàn bộ gate runbook.

## Cần Kỳ quyết

- `DEC-02` · Chọn/cấp tài khoản object storage R2 hoặc B2 và hai SSD luân phiên; codebase không tự tạo subscription/credential.
- `DEC-04` · Chốt Manager có được vào UI catalog-write hay không; backend `CatalogAccess` cho phép nhưng FE Admin Data hiện yêu cầu wildcard admin.
- `DEC-05` · Chốt có đưa `inventory.receipt.approve` vào approval inbox hay tiếp tục để API-only.

## Gate hiện hành

Gate Phase 26 chốt ngày `2026-08-02`: 5/5 plan, verifier `5/5 must-haves`, FLOOR-01..04 và
SOURCE-01..03 đều Complete. Application `49/49`; API `705 pass + 1 intentional skip`; frontend
`123 files / 724 tests`; UI-completeness `87/87`; ESLint, dependency-cruiser `0 violation / 373 modules /
1,346 dependencies`, backend build và frontend production build đều pass.

Current-source sau quick `260803-pwg` tại `7e58f94`: contract chuẩn hóa tiếp tục rollout sang Warehouse exceptions. Danh sách cấp bổ sung, danh sách phiếu trả và chi tiết phiếu trả dùng `QueryView`/`QueryViewBoundary`; error/forbidden không còn đi kèm bảng/form trống giả, retry thuộc đúng owner và refresh giữ hàng đang xem. Dashboard slice tại `e0f3361` vẫn giữ nguyên. Root gate pass Application `49/49`, API `705 pass + 1 intentional skip`, UI-completeness `87/87`, frontend `126 files / 741 tests`, ESLint, dependency-cruiser `0 violation / 375 modules / 1,350 dependencies`, backend build và frontend production build. Không browser/runtime/database mutation; Phase 27 chưa mở.

Standardization workstream hoàn tất 7/7 phase và audit pass 26/26 requirement. Current-source gate: Application `49/49`, API `730 pass + 1 intentional skip`, UI-completeness `87/87`, frontend `134 files / 758 tests`, dependency graph `0 violation / 383 modules / 1,370 dependencies`, architecture baseline, lint và hai build. Headed workbook gate pass 5/5 viewport; runtime `3010/8010` đã teardown và workbook source giữ nguyên hash. Ngày 03/08, base `ipcmanagement` cùng `ipc_lane1`, `ipc_lane8`, `ipc_lane9`, `ipc_e2e_template` đã đồng bộ đủ 44 migration, zero pending; catalog và supplemental-material request đều HTTP 200 trên runtime base. Readiness nay fail-closed 503 khi schema còn pending. Auth cold login giảm từ 1.835s xuống 608ms, warm hội tụ 131ms; BCrypt cost 11 giữ nguyên, refresh session cap 10/user và rotation chạy cùng transaction. Duplicate-request follow-up đã đóng mutation-per-keystroke, double-submit login/logout/action, exact concurrent mutation và late-401 refresh race; Chrome headed read-only gate pass 5/5 viewport, 50 request key đều unique, zero console/page error. Chi tiết phase/sự cố đã chuyển sang `HISTORY.md`; hash artifact chỉ ở `docs/EVIDENCE-INDEX.md`.

UI/UX iteration `260802-bom-detail`: evidence before/after cho Shipyard pagination đã được chụp và đọc trực quan. Admin BOM trả lại 8 cột chi tiết, form import xếp trên bảng để bảng không bị nén; `AdminQueryBoundary` chuyển refresh notice sang overlay `role=status` để không chèn vào flow. Probe after pass read-only trên `1280×900` và `1440×900`: BOM first/last đều `520px`, Reports Quality `520px`, Warehouse Demand `480px`, không mutation và không browser/console/page error. Hash authoritative nằm ở `docs/EVIDENCE-INDEX.md`.

Shipyard headed final2 gate current-source pass đúng 50 canonical state × năm viewport, 250 screenshot và 962 API response thành công. 190 tab interaction có p95 `117.8 ms`, max `149.5 ms`, zero over-budget/CLS/long-task/duplicate read/browser error/escaped mutation/header-body misalignment. 24 local-scroll samples chỉ là vertical scrollbar gutter `14–17 px`; không có content delta >20 px. Hash và pointer authoritative chỉ nằm ở `docs/EVIDENCE-INDEX.md`.

Local UI cleanup ngày 04/08 trên working tree chưa commit: canonical headed read-only gate sau sửa empty state ở tab `Tổng hợp mua` pass 50 state × 5 viewport (250 screenshot), 190 tab interaction p95 `156.7 ms`, max `221.3 ms`, zero API non-2xx, browser/page error, escaped mutation, duplicate read, overflow, long-task, CLS và header/body table misalignment. `suspiciousEmptyTableViewportCount` giảm 3→0; 11 bảng có local horizontal scroll đều có owner `overflow-x` hợp lệ. Runtime `3001/8001` đã teardown; hash/pointer local evidence nằm ở `docs/EVIDENCE-INDEX.md` và không được coi là bằng chứng cho một commit sạch.

Local state-transition E2E ngày 04/08 đã dùng dữ liệu có kiểm soát trên `ipc_e2e_template`, không chạm `ipc_lane1`: stage hash-locked workbook ANV/DAV + malformed/checksum mismatch, import commit ra `DRAFT`, reload xác nhận badge `Bản nháp` tone neutral, rollback ra `ROLLED_BACK`, reload xác nhận badge `Đã hoàn tác` tone warning. Probe cuối giữ hai terminal version nhưng zero schedule/tier. Browser fixture điều phối tự sinh đủ `DRAFT`, `FORECASTED`, `CONFIRMED`, `ADJUSTED`, `COMPLETED`, `ARCHIVED`, `CANCELLED`, lock/signoff/unlock và legacy payload; 16/16 pass sau khi dùng `ordersQuery.currentData` để không đồng bộ cache scope cũ sang ca mới. Unit status 22/22, ESLint và production build pass. Runtime `3010/8010` sẽ teardown; hash/pointer local evidence nằm ở `docs/EVIDENCE-INDEX.md`, không đại diện commit sạch.

Dataset E2E tuần hiện tại được giữ lại trong `ipc_e2e_template`: ANV tuần `2026-08-03` có version đã publish, 12 schedule và 1 tier. Menu chuẩn có `Thịt heo kho sả ruốc` đủ 9 BOM và món định danh `Món E2E thiếu BOM tuần 20260803` thiếu BOM có chủ đích; browser headed reload + catalog API + DB probe đã xác nhận cả hai nhánh. Không import lại hoặc reset giữa các transition của lifecycle đã hoàn tất. Checkpoint rollback có trước import; hash/pointer nằm ở `docs/EVIDENCE-INDEX.md`. Không chạm `ipc_lane1`.

Full-project lifecycle E2E đã hoàn tất ngày 04/08 trên `ipc_e2e_template`, không chạm `ipc_lane1`: import menu tuần ANV → publish → hoàn tất 12 ca → demand (đủ BOM, thiếu BOM và shortage) → duyệt demand/PR → supplier/PO/nhập kho → xuất kho/bếp ký nhận → phiếu trả `RET-20260804-201237-A8A8` được kho nhận → yêu cầu bổ sung `SUP-20260804-131528-E847` được cấp đủ và bếp ký nhận. Chrome headed reload đã xác nhận Reports và Admin Audit; matrix read-only 5 viewport × Bếp/Kho ngoại lệ/Báo cáo/Admin Audit có 20 screenshot, console/page error `0`, CLS `0`, zero long task. DB direct read-only trả `ReceivedIssueCount=1`, `IssueLineCount=7`, `ReceivedReturnCount=1`, `FulfilledSupplementalCount=1`. Evidence authoritative và hash nằm ở `docs/EVIDENCE-INDEX.md`; API audit runtime `3010/8010` hiện vẫn chạy với override `ipc_e2e_template`, không restart nếu chưa giữ override đó.

Source-ownership headed gate pass `6/6` trên đủ 50 canonical state × năm viewport `1920×1080`,
`1440×900`, `1366×768`, `1365×900`, `1280×900`, tổng 250 viewport-state cell. DOM/bundle leakage,
nearest-ancestor tuple và nondecreasing test-count gate đều xanh. Run chỉ dùng read-only API stub;
`ipc_lane1` không seed/import/reset/restore và không có runtime/database mutation.

GitNexus Plan 26-04 full-analysis đã disposition 17 symbol, 3 expected `OperationalFrame` process,
effective MEDIUM và HIGH-rigor review APPROVE; Plan 26-05 lightweight compare có 53 checker/test symbol,
5 file, LOW, zero affected production process. Cả hai đều Deferred none.

Milestone v1.4 `SAP Fiori Visual Conformance & Evidence Intelligence` có đúng năm Phase 26–30.
Phase 26 đã hoàn tất; Phase 27 chưa mở và chỉ ở trạng thái sẵn sàng discuss/plan. SAP Fiori là
oracle level 1; `ui-ux-pro-max` chỉ bổ sung accessibility và implementation khi không xung đột.

PC aggregate authoritative là `FE-fixture-read-only`: 6 family, 34 scenario, 44 canonical row, 5 viewport,
535 measurement, 375 observed control, 265 `KHỚP`, 255 `CHƯA-KẾT-LUẬN-ĐƯỢC` và 15 `LỆCH VỊ TRÍ`;
`THIẾU`, `MỒ CÔI` và `IM LẶNG` đều 0. Có 4.565 intercepted read và 255 intercepted mutation, tất cả
status 200; 300 screenshot path, 435 performance record, 0 browser issue và 0 overflow. Canonical operations
có control đã được exercise với request/post-action evidence; đây vẫn không phải backend/DB E2E. Hash và
pointer authoritative chỉ nằm ở `docs/EVIDENCE-INDEX.md`.

Ledger 22 group expand đúng 255 unresolved identity, giữ D-01 intentional FE-stricter và checkpoint
`DEFERRED` với zero production candidate. Commit `6032fea` chỉ đổi test fixture `warehouse.manage` thành
backend-canonical `inventory.read`; policy, route, gate, control, production behavior, runtime và database không đổi.

Chạy lại từ project root:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-build --no-restore --filter "FullyQualifiedName~FrontendPermissionVocabularyTests"
npm run test:unit -w frontend -- --run tests/pcActionCompletenessContract.test.ts tests/pcActionCompletenessFixture.test.ts tests/pcActionCompletenessDisposition.test.ts --maxWorkers=1
npm run verify
git diff --check
```

Phase 21 hoàn tất đủ 15 plan: date 31→0, Button 77→0, Form 39/26/4→0, quantity 26→0 và currency 12→0;
mọi exception còn lại được count-lock. `OPEN-03` đã đóng bằng confirmation scope-aware cho import commit/rollback
và employee activate/deactivate. Phase 22–25 lần lượt là P5, P6, P7 và P8+PF; không có phase ngoài addendum.

Phase 22 P5 hoàn tất docs-only: `docs/UI-CONFORMANCE-MATRIX.md` có đúng 20 normative row — 18 PB và 2 PF/O3.
Mọi spacing/min-height/contrast/pixel/golden/quota thiếu nguồn giữ `UNRESOLVED`; verifier pass `4/4`, graph risk
`N/A — graph-free diff`. Phase 23 chỉ được chọn failure còn tồn tại sau PE; zero failure thì ghi zero, không chế RED.

Phase 23 P6 audit đủ 20/20 row; aggregate source gate 7/7 pass. Kết quả đóng băng là `selected_failures: 0`,
`red_assertions_created: 0`; conditional test file không được tạo. Phase 24 không được sửa production vì không có
P6 RED evidence; chỉ ghi no-op và xác minh current source/evidence lane không đổi.

Phase 24 P7 đóng no-op: `production_fixes: 0`, `green_assertions_after_fix: 0`; aggregate source + PC pass
4 file/50 test. Phase 25 P8+PF đã khóa permanent gate, lưu evidence headed current-source và đóng addendum;
Phase 26 chỉ thuộc milestone v1.4 riêng ở trên.

Số liệu ở HISTORY.md là lịch sử, không bao giờ override file này.
