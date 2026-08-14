---
updated: 2026-08-14
branch: feature/menu-amendment-reconciliation
runtime_ports:
  frontend: 3001
  api: 8001
  shipyard: 8090
  mysql: 3306
  audit_frontend: 3010
  audit_api: 8010
  warehouse_dev_frontend: 3020
  warehouse_dev_api: 8020
db_lane: ipc_lane9
warehouse_cleanup_lane: ipc_dev_warehouse_20260812
e2e_lane: ipc_lane7
e2e_runtime:
  frontend: 3036
  api: 8036
credentials_via: IPC_LANE7_<ROLE>_PASSWORD
workbook:
  path: 'C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx'
  sha256: A7E734CEFBD409E7220C4FF19B3E1B7FDDD4E33D202A3F24E63309D60D4D5A01
---

# Memory hiện hành

File này là nguồn trạng thái duy nhất được auto-load sau `AGENTS.md`. Code/runtime và database
lineage đã kiểm tra trực tiếp luôn cao hơn tài liệu. Phase 5 đã closeout; runtime phục vụ Kỳ kiểm thử lại
đang mở với FE `3036` PID 34048 và BE `8036` PID 28544 trên exact `ipc_lane7`. Readiness HTTP 200:
database/migrations Healthy, tổng trạng thái Degraded chỉ vì lifecycle outbox relay cố ý tắt. Chỉ teardown
hai PID mới này khi Kỳ yêu cầu. PID API 3580 là process ngoài run và vẫn được giữ. Runtime warehouse development `3020/8020` nếu còn
mở thuộc lane riêng `ipc_dev_warehouse_20260812`, không được dùng thay cho Phase 5.

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

## Wave 2 correction — Chef receipt scope (14/08/2026)

- Commit `f4b77cf1` sửa lỗi lệch phạm vi: `getKitchenIssuesPage` của Chef truyền `shiftName` cùng `dateFrom/dateTo`, đồng nhất với action query và bộ đếm ký nhận.
- Headed browser trên `3036/8036`, exact `ipc_lane7`, request thực tế `.../kitchen-issues/page?...&shiftName=MORNING&pageNumber=1&pageSize=20`; API trả `totalCount=51`, `totalPages=3`, `items=20`; DOM hiển thị `Đã nhận: 51/51 dòng nguồn` và `Trang 1/3`. Không mutation, console/page/request error hoặc overflow. Evidence: `.artifacts/shipyard-live/phase05-wave2-chef-scope-20260814/manifest.json`.
- Regression `frontend/src/features/chef/chefWorkflowBehavior.test.tsx` khóa query phải có `shiftName`; focused suite `9/9`, lint/build/OpenAPI parity pass.
- Còn mở theo Wave 2: dựng fixture read-only cho 16 bảng conditional; chưa tuyên bố đủ `51/51 browser evidence`. Chef navigation long task hiện đo 94ms, chưa có attribution production owner; không sửa owner chỉ từ số đo.

## Warehouse receipt UI correction (14/08/2026)

- `WarehouseReceiptLifecyclePanel` now keeps “Đã ghi sổ kho” material lines inside a bounded internal scroll region (`288px` viewport), with a stable `474px` detail card, explicit “Nguyên liệu trong phiếu / N dòng nguồn” header, two-column quantity summary, truncation for long names/reasons, and no horizontal overflow.
- Headed read-only proof selected a receipt with `6336px` line content at `/warehouse`; page stayed bounded and no mutation/errors occurred. Evidence JSON: `.artifacts/shipyard-live/phase05-wave2-warehouse-receipt-long-20260814.json`; screenshot is reviewer-only.

## Wave 2 UI/UX regression closure (14/08/2026)

- Data Quality now sanitizes server-authored implementation terms (`Current stock`, `Currentstock`, `ledger`, `stock movements`, `Kilogram`) at the shared mapper seam before rendering; user-facing copy remains Vietnamese.
- Data Quality action cells reserve `8.5rem` and rebalance the fixed table columns; headed fixture confirms the full `Đánh dấu đã xử lý` control is readable at all five desktop viewports.
- Updated read-only fixture assertions for current approval modal vocabulary (`Duyệt đề xuất mua?`, `Giữ đề xuất mua`) and Warehouse empty state. Safe dialogs, Data Quality stress table, and Warehouse empty state each pass `5/5` viewports; no mutation.
- Important coverage correction: the Wave 2 audit script found that the old `35 + 16` arithmetic counted repeated runtime instances across tabs, not unique source owners. Do not claim `51/51` until a source-owner mapping fixture exists. Evidence: `.artifacts/shipyard-live/phase05-wave2-ui-ux-regression-20260814.json`.
9. Rule refresh/performance từ `.docs/dashboard-state-refresh-rules.md` đã được hợp nhất vào canonical
   `docs/DASHBOARD-UI-RULES.md` F12–F24: tách server/client/query state, không document reload, exact
   invalidation, stable args, shared polling class, freshness ở shell, pause khi người dùng đang thao tác,
   chống stale-response race, offline/backoff trung thực và verdict bắt buộc có số đo.

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

- UI Phase 3 `Project-wide Human UI and Refresh Stability` đã mở trong workstream
  `dashboard-ui-rules-conformance`. Wave 1 commit `c9147a00` khóa inventory test-owned hiện hành:
  53 production owner, 51 bảng, 33 dialog, 9 tab switcher; exact floorplan registry đã bổ sung tab
  `purchasing-supplemental` từng bị bỏ sót. Shared `StatusBadge` giữ stable geometry owner, chỉ transition
  color/opacity; unknown backend status hiển thị `Trạng thái chưa xác định`; Reports correction giữ dữ liệu
  cũ khi background refetch và bỏ jargon `append-only` khỏi bề mặt. Focused `20/20`, inventory/floorplan
  `28/28`, full ESLint và production build PASS. Full Vitest chưa có verdict vì runner vượt 4 phút và orphan
  do lượt này tạo đã được dừng; không khai PASS. Route gzip budget đang RED cả 10 route, overage lớn nhất
  Coordination `44,69 KiB`, Approval `36,56 KiB`, Dashboard `34,99 KiB`; trace cho thấy shared app chunk
  `139,21 KiB gzip` và shared RTK/query chunk `30,37 KiB gzip` là common cost. Không nâng budget; tiếp theo
  phân tích/split lowest shared owner, rồi production-build headed read-only trên `3036/8036` theo F12–F24.

- Phase 3 Wave 2 checkpoint ngày 14/08: cả hai table primitive (`.ipc-data-table` và shadcn `Table`) nay dùng
  fixed layout; hai bảng từng đứng ngoài primitive (đối soát amendment, báo giá NCC) đã nhập shared contract.
  Main shell không còn idle-preload toàn bộ route, chỉ preload đúng route khi pointer/focus/touch thể hiện intent.
  Focused inventory/shared `28/28` rồi `16/16`, ESLint và production build PASS. Performance test xác nhận idle
  không tải route ngoài ý định và intent navigation có zero script sau click/zero long task; cache-navigation
  vẫn đo 5 MainLayout render so với gate 4 nên giữ `NEEDS_EVIDENCE`. Production-build headed exact lane7 có 44
  route/tab probe, 35 table instance render được đều fixed, zero reload/browser/request/mutation error, max CLS
  0,06484; Chef navigation có một long task 56ms. 16 bảng conditional chưa render không được tính PASS. Preview
  3046 đã teardown; FE 3036 PID 34048 và BE 8036 PID 32124 vẫn phục vụ Kỳ. Evidence/hash chỉ ở index.

- Phase 3 shell-refresh follow-up: `MainLayout` không còn subscribe toàn bộ RTK Query store để đổi nhãn badge
  header theo mọi request con. Header Weekly Menu giữ ngữ cảnh ổn định `Theo dõi kế hoạch tuần`; trạng thái refresh
  thật vẫn nằm tại query boundary của đúng work area. Cache-navigation đo MainLayout render `5 → 3` (gate `≤4`),
  mỗi endpoint intent-prefetch đúng một request, warm return không refetch và CLS `0,0384`. Shared query/table
  regression `68/68`, ESLint và production build PASS. Tiếp theo vẫn phải disposition 16 bảng conditional chưa
  render trong live fixture; không suy rộng 35 instance đã đo thành 51/51.

- Wave 2 lifecycle/UI correction ngày 14/08 đang ở working tree: aggregate demand đã tách
  `pendingKitchenReceiptQty` khỏi `unissuedQty` (3 kg ANV 15/08 là ba source-line retry chưa có `ReceivedAt`,
  không được gọi là thiếu mua); OpenAPI/schema đã sinh lại từ DTO. FE map pending sang “Chờ Bếp nhận” và link có
  ngày tới `/chef-dashboard`, thiếu thật tới Thu mua, hoàn tất là text tĩnh. Chef checklist đã sửa dùng query
  phân trang 20 dòng thay vì action query 500 dòng; đổi trang reset nhóm mở và hiển thị nhãn trang. Data Quality
  dùng vocabulary tiếng Việt dùng chung, action link gộp vào cột hướng xử lý; bảng quality có min-width và clamp
  nội dung dài. Focused FE `55/55`, backend regression `1/1`, lint/build PASS; chưa có headed re-run, 16
  conditional fixtures hoặc Chef 56ms attribution. BE đã restart đúng owner sang artifact mới PID 28544; live API
  readback ANV 15/08 trả `unissuedQty=0`, `pendingKitchenReceiptQty=3` cho Thịt bằm. Extra FE 3037 dùng để
  bootstrapping đã teardown; FE 3036 PID 34048 vẫn là runtime chính.

- Phase 5 Plan 05-04 đã hoàn tất ngày 2026-08-14. Top-level manifest PASS, hash authoritative ở
  `docs/EVIDENCE-INDEX.md`; full regression/build/EF/OpenAPI/hygiene xanh, protected-lane attempt 0 và
  runtime `3036/8036` đã teardown đúng owner. Không reset/seed/import lại ANV/DAV tuần `2026-08-10`;
  dữ liệu append-only trên `ipc_lane7` được giữ làm lineage. Chi tiết execution nằm trong
  `05-04-SUMMARY.md` và `HISTORY.md`; nội dung lịch sử dài phía dưới không phải next action.

- Database unit investigation and whole-day E2E audit (12/08): read-only proof on
  `ipc_dev_warehouse_20260812` confirms the warehouse-clean baseline is correct: current stock, receipt, issue,
  return, movement, lot and snapshot are all `0`; BOM/catalog and `8` PO / `54` PO lines are intentionally
  preserved. The unit problem is semantic, not Vietnamese decimal formatting: `G` remains `baseUnitCode=G`, factor
  `1` (not the intended `KG` / `0.001`); fractional BOM quantities persist for counted units (CAI 18/55,
  CAY 3/3, LAT 12/15, MIENG 3/3, O 5/15, QUA 3/3); all `44` normalization reviews remain
  `NEEDS_CONFIRMATION`. Do not auto-convert `G`, round counted units, or apply package factor without owner decision.
  Audit lane `ipc_lane7` was cloned from `ipc_e2e_template`, checkpointed, migrated 49→66 migrations and passed
  source-line/fence schema postflight. It then exposed legacy template lineage GAP: `173/187` issue lines match
  duplicate demand lines, so those documents cannot prove an end-to-end happy path. Credentials were reset only in
  `ipc_lane7`. The controlled receipt fixture `PO-E2E-RECEIPT-20260812` completed in Chrome headed: Điều phối created
  the draft, Thủ kho accepted quality, Quản lý approved and Admin posted. Browser API evidence plus DB postflight prove
  `POSTED/ACCEPTED`, correct lot/manufacture/expiry evidence, PO `RECEIVED`, exactly one stock movement and Dưa hấu
  stock `+1`; artifact hashes are only in `docs/EVIDENCE-INDEX.md`. Whole-day issue → kitchen receipt → service-run
  lifecycle still requires a new controlled fixture because legacy source-line lineage is ambiguous. Runtime `8030/3030`
  is owned by this E2E and must be torn down on close; user runtime `8020/3020` is untouched.

- Phase 5 Purchasing live scope `P5E2E0812SAFE` trên `ipc_lane9`: `PR-20260812-FULLDAY` đã được Admin gửi từ
  `DRAFT` sang hàng đợi duyệt qua Chrome headed; trước khi gửi có `38/38` dòng đã chọn supplier quotation, ngày giao
  Kỳ chốt `2026-08-13`.
  Hai dòng Chuối dùng NCC `CHUỐI`, `1.500đ/quả`; từng source-line lưu note quy đổi `9.000đ/kg`, `1 kg = 6 quả`.
  Evidence authoritative/hash ở `docs/EVIDENCE-INDEX.md` (`service-run-confirm-historical-supplier-decisions`,
  `service-run-confirm-banana-conversion`, `service-run-correct-provisional-shrimp-note`). Mười source-line
  còn lại đã dùng decision `TẠM THỜI` để Kỳ sửa sau: Bột nở/Tạp hóa Thái/25k, Da heo/Dì Tài/30k,
  Nạc đùi mông/Tuyến Tâm/98k, Nấm mèo/Chay/110k, Tôm/Chị Vân/145k (size chưa xác minh); mỗi family 2 dòng.
  Dòng DRAFT không còn sửa được sau khi gửi. Manager đã duyệt và Admin tạo 8 PO theo NCC; headed readback xác nhận
  đúng 8 PO không rỗng của PR, tất cả `ORDERED`, zero browser error/overflow. Receipt-draft integrity blocker đã đóng:
  runner Điều phối từng tạo lặp 303 receipt `DRAFT/PENDING_INSPECTION` cùng source-line Bột nở của một PO; preflight
  live xác nhận 8 PO, 303 receipt cùng đúng một source-line và zero `POSTED`/stock movement/current-stock mutation.
  Migration `20260812102011_AddPurchaseReceiptActiveLineFence` đã apply **chỉ trên `ipc_lane9`** sau checkpoint backup;
  active-line fence, legacy fallback, UI chặn action trùng và lifecycle `VOIDED` có audit là source-of-truth. Remediation
  đã void có audit 303/303 draft: DB postflight có active/POSTED/lease/movement đều 0, transition và audit đều 303,
  current stock liên quan vẫn 0. Chrome headed Admin reload trên runtime owned 3010/8010 hiển thị `VOIDED`, zero browser
  error, write nghiệp vụ và overflow. Sau đó đã tạo **đúng một** replacement receipt
  `2abd6e9c-0701-e4e2-18f9-89dc8209a5b7` cho canonical Bột nở source-line
  `5c31be27-cdf3-9aa3-e184-d1f017a6e8b9`, kho hợp lệ `11111111-1111-4111-8111-111111111102`, quantity `2.7132 kg`,
  giá `25.000đ`, lô `P5E2E0812SAFE-e74c403e`: DB và Chrome headed Điều phối reload cùng xác nhận
  `DRAFT/PENDING_INSPECTION`, version 0, một active lease, zero POSTED/movement/current-stock mutation. Guard backend
  giờ trả 404 cho warehouse ID không tồn tại thay vì FK 500; focused test `WarehousePurchaseReceivingTests` 21/21 pass.
  Không quality/approve/POSTED receipt này nếu chưa có lệnh mới. Runtime 8010/3010 của remediation đã teardown sau
  evidence; 8020/3020 ngoài scope vẫn giữ nguyên. Evidence/hash chỉ ở `docs/EVIDENCE-INDEX.md`. Credential Manager dùng
  biến riêng `IPC_PHASE05_MANAGER_PASSWORD`.

- Project-wide UI/UX audit is at `docs/UI-UX-PROJECT-AUDIT.md`: Wave 3 closed Reports UX-01/UX-02 with the owner-local
  `ReportsPricePanel` detail action and the existing debounced server-bound search. Focused controls 3/3, five-desktop
  measurements 10/10, lint and production build pass. Wave 2 corrective headed evidence on `ipc_lane9` resolves Approvals:
  queue loading, 20-record and empty geometry are invariant and CLS is `0.000040`–`0.000113` at all five viewports.
  Warehouse remains `NEEDS_EVIDENCE`: production preview reproduces one `53ms` navigation task at `1920×1080`, while
  Chrome DevTools records a `123ms` demand-tab INP without a production component/function owner. No Warehouse UI changed.
  The owned runtime was torn down. Hash/pointer is only in `docs/EVIDENCE-INDEX.md`.
- Wave 3 corrective execution is closed in the existing Phase 2 (no new phase/wave). The read-only matrix passes
  `35/35` across exactly five desktop viewports after running with `NODE_OPTIONS=--max-old-space-size=4096`: every
  permitted protected-route tab is traversed through `tab → aria-controls tabpanel → nested tablist` and verified by a
  fresh `aria-selected=true` locator; no stale-remount disposition remains. Warehouse direct `/403` is fixture-proven
  for a user without `warehouse.read`; its loading/empty/error lifecycle states remain zero-write. The fixture now uses
  shape-correct page responses for every report price subview and Approval purchase-request history.
- Read-only dialog evidence covers weekly-menu import/edit and the Approvals decision modal at all five viewports:
  accessible name, `aria-modal`, focus containment, stable document client width, focus return and zero non-GET request.
  Meal-order confirmation and other mutation-bound dialogs remain explicitly `NEEDS_EVIDENCE`, not false PASS.
- Fresh headed Wave 3 runtime on `ipc_lane9` (`phase02-wave3-corrective`) has 45 route probes over the five desktop
  viewports, 604 GET, zero console/page/request failure, escaped mutation and overflow. It retains four unattributed
  navigation long tasks (`51–56ms`) and maximum CLS `0.10177890755781512`; these are `NEEDS_EVIDENCE`, not authority
  for a Warehouse/Admin production fix. Runtime 3010/8010 was stopped.
- Final headed Wave 3 run after the Warehouse state-reservation repair is authoritative for this source: 45 route probes,
  604 GET, zero browser/page/request failure, escaped mutation and overflow; CLS maximum is `0.09845798199929733` and
  meets the gate. Eight Warehouse/Admin document-navigation long tasks (`51–78ms`) remain unattributed, therefore
  `NEEDS_EVIDENCE`; runtime 3010/8010 was stopped.
- Warehouse receipt lifecycle loading, empty and error are fixture-proven at all five desktop viewports with zero write
  request. Only its loading response reserves `48rem`; settled empty/error states release that blank space. Permission
  coverage is now proven through the direct Warehouse `RoleGuard` forbidden boundary.
- UI measurement protocol đã chuyển oracle của agent từ screenshot sang DOM/test JSON tại
  `docs/UI-UX-MEASUREMENT-PROTOCOL.md`. Chạy `NODE_OPTIONS=--max-old-space-size=4096 npm run test:ui-measurements -w frontend`
  để đo các protected route với đúng năm desktop viewport; fixture read-only pass `35/35`. Screenshot vẫn lưu cho reviewer
  và E2E evidence, nhưng không đủ độc lập để kết luận PASS/FAIL.
- UI/UX rule adoption docs-only ngày 12/08 đã tạo điểm vào canonical tại `docs/UI-PHILOSOPHY.md` và glossary tại
  `docs/GLOSSARY.md`; `docs/DASHBOARD-UI-RULES.md` chuyển sang `adopted-contract`. Các entrypoint
  `docs/ARCHITECTURE.md`, `docs/UI-UX-FE-BE-DATABASE-STANDARDIZATION.md`, `docs/UI-UX-MEASUREMENT-PROTOCOL.md`
  và `frontend/README.md` đã trỏ về các tài liệu này. Không có thay đổi source/runtime/database; link scan,
  secret scan và `git diff --check` pass.
- Quy trình thực thi UI/UX canonical nằm tại `docs/UI-UX-EXECUTION-HARNESS.md`: phân loại audit/sửa/mutation,
  dùng DOM/test/API/focus/trace thay vì screenshot verdict, sửa theo owner thấp nhất, browser headed theo lane
  hiện hành, DevTools MCP chỉ on-demand và handoff không mang credential/runner ID cũ sang scope mới.
- UX-05 control-surface đã đóng: `NODE_OPTIONS=--max-old-space-size=4096 npm run test:controls -w frontend -- --workers=1`
  pass `25/25`. Purchasing và Warehouse đều render named populated table viewport với local horizontal scroll tại `390px`.
  Sửa chỉ ở fixture: inventory return/amendment shape và contract `production-plans/filter` theo range, không đổi production UI.
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

## Warehouse-only cleanup checkpoint 2026-08-12

- Authoritative disposable lane là `ipc_dev_warehouse_20260812`. Chỉ dữ liệu kho vật lý cũ được làm sạch: receipt, issue, return, supplemental, correction, stocktake, movement, snapshot và current stock. Evidence/hash nằm trong `docs/EVIDENCE-INDEX.md` dưới `warehouse-clean-20260812`; lane chưa promote.
- BOM lấy nguyên từ `.docs/IPC. Định lượng 07.2026.xlsx`, không force số nguyên và không làm tròn quantity phân số. Postflight so sánh toàn bộ cột `dishbom` hai chiều với `ipcmanagement` có zero difference; menu, planning, demand, PR/PO và approval history giữ nguyên.
- `ipc_dev_clean_20260812` là attempt làm sạch quá rộng trước khi Kỳ thu hẹp scope; giữ làm historical/superseded evidence, không dùng cho phát triển, E2E hoặc promotion. Không tự drop lane này nếu chưa có cleanup authorization riêng.
- Runtime riêng cho lane authoritative đang chạy tại frontend `3020`, API `8020`; API readiness HTTP 200, database/migration Healthy, tổng health Degraded chỉ vì outbox relay tắt trong development. Chrome profile riêng đã mở tại `http://127.0.0.1:3020`; không login tự động và không chạm session Chrome có sẵn. Runtime manifest: `.artifacts/shipyard-live/warehouse-runtime-20260812/manifest.json`.

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
