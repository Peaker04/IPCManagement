---
updated: 2026-08-10
branch: feature/menu-amendment-reconciliation
runtime_ports:
  frontend: 3001
  api: 8001
  shipyard: 8090
  mysql: 3306
  audit_frontend: 3010
  audit_api: 8010
db_lane: ipc_lane9
credentials_via: K6_PASSWORD
workbook:
  path: 'C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx'
  sha256: A7E734CEFBD409E7220C4FF19B3E1B7FDDD4E33D202A3F24E63309D60D4D5A01
---

# Memory hiện hành

File này là nguồn trạng thái duy nhất được auto-load sau `AGENTS.md`. Code/runtime và database
lineage đã kiểm tra trực tiếp luôn cao hơn tài liệu. Run headed mới nhất dùng `3010/8010` với
`ipc_lane9`, health/ready pass rồi đã teardown; hiện không có runtime audit trên hai port này.

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

- Project-wide UI/UX audit is at `docs/UI-UX-PROJECT-AUDIT.md`: Wave 3 closed Reports UX-01/UX-02 with the owner-local
  `ReportsPricePanel` detail action and the existing debounced server-bound search. Focused controls 3/3, five-desktop
  measurements 10/10, lint and production build pass. Wave 2 corrective headed evidence on `ipc_lane9` resolves Approvals:
  queue loading, 20-record and empty geometry are invariant and CLS is `0.000040`–`0.000113` at all five viewports.
  Warehouse remains `NEEDS_EVIDENCE`: production preview reproduces one `53ms` navigation task at `1920×1080`, while
  Chrome DevTools records a `123ms` demand-tab INP without a production component/function owner. No Warehouse UI changed.
  The owned runtime was torn down. Hash/pointer is only in `docs/EVIDENCE-INDEX.md`.
- Wave 3 corrective execution is active in the existing Phase 2 (no new phase/wave): Reports warning detail is now
  collapsed by default, exposes `aria-expanded`, focuses its named detail region when opened and restores trigger focus
  when closed. The protected-route matrix now activates every initially enabled tab at all five desktop viewports;
  the 10 measurement tests pass. A tab that remounts after activation is recorded by owner as `NEEDS_EVIDENCE`, not a
  stale-locator timeout. Dialog plus loading/empty/error/permission fixture coverage remains the active scope; Warehouse
  retains its reservation because state-specific geometry is not yet deterministic.
- Read-only dialog evidence now covers weekly-menu import/edit and the Approvals decision modal: each has an accessible
  modal name, keeps document client width stable, and restores focus to the opener. Meal-order confirmation is a
  mutation-boundary path and therefore remains `NEEDS_EVIDENCE` for the read-only matrix.
- Fresh headed Wave 3 runtime on `ipc_lane9` (`phase02-wave3-corrective`) has 45 route probes over the five desktop
  viewports, 604 GET, zero console/page/request failure, escaped mutation and overflow. It retains four unattributed
  navigation long tasks (`51–56ms`) and maximum CLS `0.10177890755781512`; these are `NEEDS_EVIDENCE`, not authority
  for a Warehouse/Admin production fix. Runtime 3010/8010 was stopped.
- UI measurement protocol đã chuyển oracle của agent từ screenshot sang DOM/test JSON tại
  `docs/UI-UX-MEASUREMENT-PROTOCOL.md`. Chạy `npm run test:ui-measurements -w frontend` để đo các protected
  route với đúng năm desktop viewport; fixture read-only vừa pass `10/10`. Screenshot vẫn lưu cho reviewer
  và E2E evidence, nhưng không đủ độc lập để kết luận PASS/FAIL.
- Dashboard UI Rules Phase 1 đã re-closeout trên `f44390a7`: 19/19 GAP requirement được independent verifier
  xác minh; focused `43/43`, frontend serial `143 file / 804 test`, lint, dependency, frontend build, isolated
  backend build và route budget pass. Headed evidence dùng `ipc_lane9` đúng 5 viewport DOM (bao gồm chính xác
  `1365×900`) trên Service Run/Admin Audit, 10 preference flow, 237 post-action GET, zero console/page/request/
  escaped-mutation/overflow; runtime `3010/8010` đã teardown. Hash/pointer chỉ ở `docs/EVIDENCE-INDEX.md`; 118
  `NEEDS_EVIDENCE` vẫn là backlog, không được promote.
- Quick corrective `260811-nut` đã giữ TABLE-03 nhưng chuyển editor cấu hình luôn hiện thành trigger
  `Tùy chỉnh bảng` trong toolbar không scroll; popover giữ visibility/order/density/reset, khóa cột định danh,
  có radio/copy hướng tác vụ, feedback live và focus return. Independent verifier `5/5`; focused owner suite
  `13/13`, lint và frontend build pass. Không có backend/API/database hoặc evidence/runtime run mới.

## Database audit checkpoint 2026-08-10

- Database hardening/promotion đã hoàn tất trên `ipc_lane9` và base `ipcmanagement`; không truy cập
  `ipc_lane1`. Báo cáo canonical và implementation update ở
  `docs/research/database-current-state-audit-2026-08-10.md`; hash/evidence pointer chỉ ở
  `docs/EVIDENCE-INDEX.md`.
- Kỳ đã chốt `ipcmanagement` là base đích cuối: mọi thay đổi phải pass trên lane khác rồi
  promote bằng cùng reviewed SQL/reconciliation script; không clone/restore đè lane lên base.
- Clone tool nay dùng `SHOW CREATE TABLE`, preserve trigger, compare table definition/trigger inventory và
  fail-closed khi migration-owned object thiếu. Lane9 và base đều ở 61 migration, 164 FK, 3 trigger.
  Base có 4.321 receipt legacy POSTED theo physical movement evidence và 83 receipt không movement giữ DRAFT;
  zero unexpected receipt/unit/schema violation. API base live/ready Healthy; backend `776 pass + 1 skip`;
  closeout recheck có zero pending model change, targeted database/receipt/lineage `36/36`, checkpoint hash,
  secret scan và `git diff --check` đều pass.
- Phase 4.1 đã vận hành outbox: lane9 xử lý 432 message thành 432 durable delivery receipt, zero
  pending/processing/failed/poison; base có zero backlog và relay readiness Healthy. Off-site encrypted
  restore chain vẫn `BLOCKED_EXTERNAL`. Unit normalization/catalog/legacy data-quality cần source owner,
  không auto-merge/backfill.

## Shipyard canonical workflow

- Quy trình chuẩn: `preflight → boot → health → database-sync → test → browser → evidence → teardown → archive`; contract ở `docs/SHIPYARD-OPERATIONS.md`, manifest ở `shipyard/shipyard.manifest.json`.
- Evidence mới chỉ ghi vào `.artifacts/shipyard-live/<run-id>/` với một `manifest.json`/run và các nhánh `screenshots/`, `api/`, `browser/`, `performance/`, `db/`. Các thư mục legacy `browser-use-*`, `e2e*`, debug và log cũ không dùng làm output mới.
- `IPCManagement/shipyard/` là profile tracked; `D:/Kì 7/PRN222 Doanh Nghiệp/shipyard/` là harness Git độc lập; `shipyard-lanes/lane1` là clone bảo vệ. Cleanup repo không copy, sửa hoặc xoá các thư mục ngoài này.
- Lane canonical: `ipc_lane1` chỉ read-only; mutation chỉ `ipc_lane9`; `ipc_e2e_template` chỉ dữ liệu E2E kiểm soát. Audit hiện hành dùng `3010/8010` khi chọn template/mutation profile; không hardcode ngoài manifest/environment.
- DB change chỉ hoàn tất sau preflight → reviewed SQL → apply đúng lane → postflight lineage/constraint/health → rollback evidence → evidence index/state closeout. Không migration/reset/seed/restore/import trên `ipc_lane1`.
- Cleanup đang dry-run; phân loại và blocker ở `docs/SHIPYARD-CLEANUP-INVENTORY.md`. Chưa xóa artifact, lane, harness hoặc evidence chưa reconcile.
- GSD health hiện còn baseline warning/error (root `PROJECT.md`, phase mapping và stale/orphan worktree); coi là hygiene backlog riêng, không tự repair trong run này.
- External path classification: `C:\ipc-workspace` và `D:\IPCManagementCurrent` là junction tới checkout hiện tại; `D:\IPC-browser-use-profile`/`D:\IPC-browser-use-visible` là Chrome profile cũ; `D:\IPCManagement-build` là compiled snapshot; `D:\IPCManagement-backups` và `C:\IPCManagement-offsite-rehearsal` là recovery evidence. Chi tiết và retention gate ở `docs/SHIPYARD-CLEANUP-INVENTORY.md`.
- Cleanup execution 2026-08-09: profile Chrome cũ và build snapshot đã archive ở `D:\IPCManagement-archive\20260809\legacy`; ba recovery archive lỗi đã quarantine, archive authoritative và SQL backups được giữ. Hai junction không bị xóa do runtime policy chặn thao tác link; execution record ở `docs/SHIPYARD-CLEANUP-EXECUTION-2026-08-09.md`.

## Lifecycle standardization checkpoint

- Phase 3 Receipt đã hoàn tất trên branch `feature/menu-amendment-reconciliation`: `DRAFT → quality inspection → Manager approval → Admin POSTED`; stock chỉ sinh ở `POSTED`, correction hậu nhập append-only đã có source-line/unit lineage. Focused API `96/96`, frontend `10/10` và headed E2E five viewport trên `ipc_lane9` pass; hashes ở `docs/EVIDENCE-INDEX.md`.
- Phase 4 Supply documents đã hoàn tất ngày 2026-08-09. Chuỗi `demand → PR/PO → posted receipt → issue → kitchen acknowledgement → return/supplemental` giữ source-line + unit; shortage/partial/return-over-balance/supplemental-overlap/concurrent mutation và shadow reconciliation đã có regression/evidence.
- `ipc_lane9` hiện có 190 terminal legacy dispositions: 17 `APPLIED` từ candidate duy nhất, 173 `REJECTED` do 2–6 candidate mơ hồ; pending/approved/undispositioned đều 0. Còn 173 issue line nullable provenance có chủ đích và đều là compatibility exception đã disposition, không phải backlog chưa review; return nullable còn 0.
- DB postflight zero source-target mismatch, rejected-source mutation, actor separation, transition/receipt count và supplemental active/duplicate. Focused backend `178/178`, frontend `21/21`, model/build/hygiene cùng Chrome headed năm viewport pass; runtime 3010/8010 đã teardown. Checkpoint/hashes authoritative ở `docs/EVIDENCE-INDEX.md`; không restore và không chạm `ipc_lane1`.

## Governance checkpoint · tiếp tục ở chat mới

- Menu amendment enforce luồng chuẩn `Điều phối tạo → Manager review → Admin thực thi`, chặn tự
  review/tự execute và có break-glass Admin bắt buộc reason + audit. Migration separation nay đã
  nằm trong head 61 trên lane9 và base.
- Approval rule có >=2 required assignment nay được backend xử lý theo sequence cho demand/PR; một actor không thể hoàn thành hai bước, và inbox giữ chứng từ sau bước trung gian. Chưa có immutable snapshot/invalidation round chung.
- Receipt canonical `DRAFT → quality → Manager approved → Admin POSTED`; movement chỉ sinh ở POSTED.
  Legacy base đã được reconcile bằng migration evidence-led, không tạo Manager approval giả.
- Current database gate: lane9 rollback/re-apply và base promotion qua migration 63; relay Healthy;
  model pending zero, Application `49/49`, API `797 pass + 1 intentional skip`, frontend `137 file / 769 test`,
  hai build/lint/dependency/secret scan/`git diff --check` pass.
- Phase 4.2 đã closeout: independent verifier pass `7/7`, focused Phase42 `64/64`, aggregate `20/20`
  gate và `10/10` requirement; Tasks 1–13 giữ lịch sử 5 plan/3 wave. Phase 5 đã unblocked và
  chỉ sẵn sàng discuss/plan, chưa execute. Chi tiết ở Phase 4.2 `VERIFICATION.md`; hash chỉ ở evidence index.

## Cần Kỳ quyết

- `DEC-04` · Chốt Manager có được vào UI catalog-write hay không; backend `CatalogAccess` cho phép nhưng FE Admin Data hiện yêu cầu wildcard admin.
- `DEC-05` · Chốt có đưa `inventory.receipt.approve` vào approval inbox hay tiếp tục để API-only.

## Gate hiện hành

Menu-amendment reversible E2E ngày `2026-08-07` đã tạo scope `E2EAMEND27C` trên `ipc_e2e_template`: Admin import/preview `114` dòng và publish, Admin create `200`, Manager review `200`, Admin execute `200`, browser reload render `Đã thực thi` và món `Gà kho sả`. Commit `b76ecae` sửa hai empty-ID query Pomelo/EF để scope không có demand/PR không trả `500`; targeted API `4/4` và backend build pass. Evidence browser ở `.artifacts/shipyard-live/menu-amendment-e2e-20260807/reversible-executed.json` và `reversible-executed.png`.

Menu-amendment implementation commit `429263a` thêm snapshot yêu cầu thay đổi, hậu kiểm Admin/Quản lý, fail-closed khi đã có PO/nhập/xuất và materialize version/menu/schedule mới khi thực thi nhánh reversible. Backend `746 pass + 1 intentional skip`; frontend trước đó pass `135 file / 761 test`, hai build pass. Migration đã chạy thành công trên `ipc_e2e_template`; ANV tuần `2026-08-03` có dữ liệu chứng từ vật lý nên mọi yêu cầu đúng phải giữ `RECONCILIATION_REQUIRED`, không được thực thi trực tiếp. Headed Chrome đã đọc trạng thái đó ở Admin. Retry Manager ngày `2026-08-07` với `quanly/quanly` đăng nhập `200`, reload scope `ANV - AMANN` và hiện đúng hai yêu cầu `Cần đối soát chứng từ` với zero control `Duyệt`/`Thực thi`, zero console/page error và zero horizontal overflow. Screenshot/response local ở `.artifacts/shipyard-live/menu-amendment-e2e-20260807/manager-reconciliation-1440x900.png` và `manager-reconciliation-probe.json`. Run có 1 long task `59ms`, CLS `0.0756`; không dùng như performance gate xanh. Commit `9d58beb` sửa UI: `401` báo sai credentials thay vì lỗi kết nối; inbox sửa thực đơn hiển thị retry/error thay vì giả là trống. Targeted tests `5/5`, ESLint và production build pass. Còn thiếu browser E2E normal branch (amendment reversible: Manager duyệt → Admin thực thi) trên customer/week mới, không có demand/PO/receipt/issue.

Lifecycle rerun chuẩn hóa ngày 05/08 trên `ipc_lane9` đã clone/sanitize riêng rồi chạy menu đúng tuần `2026-08-03`: import/publish một lần, sáu ngày schedule đi hết demand/duyệt/PR/PO/nhập/xuất/Bếp nhận. Friday Service Run khép ca 840/840 và direct DB có `ClosedAt` + snapshot + audit; Saturday thiếu BOM bị `BLOCKED` đúng token. Chrome headed đã đọc ảnh: cột `Mua dự kiến` chỉ là nhu cầu ban đầu, blocker hiện hành thuộc Ca phục vụ; console/page error 0, CLS 0, zero long task. Runner dùng preview token khi commit và tái sử dụng access token theo tuần để không tự chạm auth rate-limit. Runtime `3010/8010` đã teardown.

Gate Phase 26 chốt ngày `2026-08-02`: 5/5 plan, verifier `5/5 must-haves`, FLOOR-01..04 và
SOURCE-01..03 đều Complete. Application `49/49`; API `705 pass + 1 intentional skip`; frontend
`123 files / 724 tests`; UI-completeness `87/87`; ESLint, dependency-cruiser `0 violation / 373 modules /
1,346 dependencies`, backend build và frontend production build đều pass.

Service Run lifecycle closeout ngày 05/08 trên `ipc_e2e_template`: Reports tách `estimatedPurchaseCost` theo PurchaseRequestLine và `actualReceivedCost` theo ReceiptLine, giữ `null` khi chưa nhập; source-line issue projection đã scope đúng plan/date/shift. Chrome headed recheck xác nhận lệch suất `840 → 839`, waiver có lý do, close/reload, Warehouse/Purchasing/Reports API 200 và DB audit/snapshot. Hash authoritative nằm ở `docs/EVIDENCE-INDEX.md`; runtime `3010/8010` đã teardown.

Current-source sau quick `260803-pwg` tại `7e58f94`: contract chuẩn hóa tiếp tục rollout sang Warehouse exceptions. Danh sách cấp bổ sung, danh sách phiếu trả và chi tiết phiếu trả dùng `QueryView`/`QueryViewBoundary`; error/forbidden không còn đi kèm bảng/form trống giả, retry thuộc đúng owner và refresh giữ hàng đang xem. Dashboard slice tại `e0f3361` vẫn giữ nguyên. Root gate pass Application `49/49`, API `705 pass + 1 intentional skip`, UI-completeness `87/87`, frontend `126 files / 741 tests`, ESLint, dependency-cruiser `0 violation / 375 modules / 1,350 dependencies`, backend build và frontend production build. Không browser/runtime/database mutation; Phase 27 chưa mở.

Standardization workstream hoàn tất 7/7 phase và audit pass 26/26 requirement. Current-source gate: Application `49/49`, API `730 pass + 1 intentional skip`, UI-completeness `87/87`, frontend `134 files / 758 tests`, dependency graph `0 violation / 383 modules / 1,370 dependencies`, architecture baseline, lint và hai build. Headed workbook gate pass 5/5 viewport; runtime `3010/8010` đã teardown và workbook source giữ nguyên hash. Ngày 03/08, base `ipcmanagement` cùng `ipc_lane1`, `ipc_lane8`, `ipc_lane9`, `ipc_e2e_template` đã đồng bộ đủ 44 migration, zero pending; catalog và supplemental-material request đều HTTP 200 trên runtime base. Readiness nay fail-closed 503 khi schema còn pending. Auth cold login giảm từ 1.835s xuống 608ms, warm hội tụ 131ms; BCrypt cost 11 giữ nguyên, refresh session cap 10/user và rotation chạy cùng transaction. Duplicate-request follow-up đã đóng mutation-per-keystroke, double-submit login/logout/action, exact concurrent mutation và late-401 refresh race; Chrome headed read-only gate pass 5/5 viewport, 50 request key đều unique, zero console/page error. Chi tiết phase/sự cố đã chuyển sang `HISTORY.md`; hash artifact chỉ ở `docs/EVIDENCE-INDEX.md`.

UI/UX iteration `260802-bom-detail`: evidence before/after cho Shipyard pagination đã được chụp và đọc trực quan. Admin BOM trả lại 8 cột chi tiết, form import xếp trên bảng để bảng không bị nén; `AdminQueryBoundary` chuyển refresh notice sang overlay `role=status` để không chèn vào flow. Probe after pass read-only trên `1280×900` và `1440×900`: BOM first/last đều `520px`, Reports Quality `520px`, Warehouse Demand `480px`, không mutation và không browser/console/page error. Hash authoritative nằm ở `docs/EVIDENCE-INDEX.md`.

Shipyard headed final2 gate current-source pass đúng 50 canonical state × năm viewport, 250 screenshot và 962 API response thành công. 190 tab interaction có p95 `117.8 ms`, max `149.5 ms`, zero over-budget/CLS/long-task/duplicate read/browser error/escaped mutation/header-body misalignment. 24 local-scroll samples chỉ là vertical scrollbar gutter `14–17 px`; không có content delta >20 px. Hash và pointer authoritative chỉ nằm ở `docs/EVIDENCE-INDEX.md`.

Local UI cleanup ngày 04/08 trên working tree chưa commit: canonical headed read-only gate sau sửa empty state ở tab `Tổng hợp mua` pass 50 state × 5 viewport (250 screenshot), 190 tab interaction p95 `156.7 ms`, max `221.3 ms`, zero API non-2xx, browser/page error, escaped mutation, duplicate read, overflow, long-task, CLS và header/body table misalignment. `suspiciousEmptyTableViewportCount` giảm 3→0; 11 bảng có local horizontal scroll đều có owner `overflow-x` hợp lệ. Runtime `3001/8001` đã teardown; hash/pointer local evidence nằm ở `docs/EVIDENCE-INDEX.md` và không được coi là bằng chứng cho một commit sạch.

Local state-transition E2E ngày 04/08 đã dùng dữ liệu có kiểm soát trên `ipc_e2e_template`, không chạm `ipc_lane1`: stage hash-locked workbook ANV/DAV + malformed/checksum mismatch, import commit ra `DRAFT`, reload xác nhận badge `Bản nháp` tone neutral, rollback ra `ROLLED_BACK`, reload xác nhận badge `Đã hoàn tác` tone warning. Probe cuối giữ hai terminal version nhưng zero schedule/tier. Browser fixture điều phối tự sinh đủ `DRAFT`, `FORECASTED`, `CONFIRMED`, `ADJUSTED`, `COMPLETED`, `ARCHIVED`, `CANCELLED`, lock/signoff/unlock và legacy payload; 16/16 pass sau khi dùng `ordersQuery.currentData` để không đồng bộ cache scope cũ sang ca mới. Unit status 22/22, ESLint và production build pass. Runtime `3010/8010` sẽ teardown; hash/pointer local evidence nằm ở `docs/EVIDENCE-INDEX.md`, không đại diện commit sạch.

Dataset E2E tuần hiện tại được giữ lại trong `ipc_e2e_template`: ANV tuần `2026-08-03` có version đã publish, 12 schedule và 1 tier. Menu chuẩn có `Thịt heo kho sả ruốc` đủ 9 BOM và món định danh `Món E2E thiếu BOM tuần 20260803` thiếu BOM có chủ đích; browser headed reload + catalog API + DB probe đã xác nhận cả hai nhánh. Không import lại hoặc reset giữa các transition của lifecycle đã hoàn tất. Checkpoint rollback có trước import; hash/pointer nằm ở `docs/EVIDENCE-INDEX.md`. Không chạm `ipc_lane1`.

Full-project lifecycle E2E đã hoàn tất ngày 04/08 trên `ipc_e2e_template`, không chạm `ipc_lane1`: import menu tuần ANV → publish → hoàn tất 12 ca → demand (đủ BOM, thiếu BOM và shortage) → duyệt demand/PR → supplier/PO/nhập kho → xuất kho/bếp ký nhận → phiếu trả `RET-20260804-201237-A8A8` được kho nhận → yêu cầu bổ sung `SUP-20260804-131528-E847` được cấp đủ và bếp ký nhận. Chrome headed reload đã xác nhận Reports và Admin Audit; matrix read-only 5 viewport × Bếp/Kho ngoại lệ/Báo cáo/Admin Audit có 20 screenshot, console/page error `0`, CLS `0`, zero long task. DB direct read-only trả `ReceivedIssueCount=1`, `IssueLineCount=7`, `ReceivedReturnCount=1`, `FulfilledSupplementalCount=1`. Evidence authoritative và hash nằm ở `docs/EVIDENCE-INDEX.md`; API audit runtime `3010/8010` hiện vẫn chạy với override `ipc_e2e_template`, không restart nếu chưa giữ override đó.

Audit evidence-led ngày 05/08 trên current worktree sửa projection Reports: ISSUE chuẩn dùng `InventoryIssue.ReceivedAt`, ISSUE bổ sung dùng `SupplementalMaterialRequest.FULFILLED`; sau Chrome headed reload cả hai hiển thị `Bếp đã nhận`/`Đã hoàn tất`. Audit table được chờ đến khi render thực sự (8 rows trước/sau reload) thay vì chỉ chờ tiêu đề panel; matrix 5 viewport lặp lại cùng readiness. Kỳ đã chọn giữ kế hoạch điều phối và ký nhận vật tư là hai trạng thái độc lập: Chef giải thích rõ kế hoạch chưa đồng bộ không chặn checklist nhận nguyên liệu; không thêm prerequisite xuất kho. Runtime `3010/8010` đã teardown sau run.

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
