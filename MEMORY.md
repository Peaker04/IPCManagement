---
updated: 2026-07-31
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

1. Đọc `AGENTS.md` và file này, sau đó đối chiếu `git status --short --branch`, `node .gitnexus/run.cjs status`, các port trong front matter và timestamp của evidence mới nhất.
2. Giữ nguyên worktree bẩn và dữ liệu evidence trong lane; không reset, seed, sanitize, restore hoặc import lại chỉ để tái hiện test. Mọi mutation DB mới cần xác nhận đúng lane, lineage và rollback checkpoint.
3. Khi boot E2E, phải dùng source của checkout hiện tại, xác minh `/health/ready` trỏ đúng lane trong front matter, lấy mật khẩu demo từ credential đã xoay và không thử giá trị mặc định.
4. Phân loại dữ liệu theo `docs/DATA-GRAIN-MATRIX.md`: ngày, tuần, snapshot, source-line và movement audit. Không gộp theo tên; mutation luôn dùng source-line ID.
5. Với nghi ngờ duplicate/double-count, đối chiếu cùng lúc FE row/caption, API key và quantity, DB source-line/movement chain và FE sau reload. Các dòng `Bột nở` khác ngày và movement audit hiện hành là hợp lệ; lỗi đã sửa là aggregate stock allocation `Max` → `Sum`.
6. Browser gate phải chạy Chrome headed đủ ma trận viewport, lưu screenshot, API sau action, console/page error, CLS và long task. Không kết luận pass từ BE/API riêng lẻ.
7. Trước khi sửa code, chạy GitNexus impact upstream và downstream cho từng symbol; trước commit chạy `detect_changes`, full gate phù hợp, secret scan và `git diff --check`.
8. Sau mỗi chuỗi thay đổi/E2E đáng kể, cập nhật front matter, evidence, gate và phần còn mở; việc đã đóng phải xóa khỏi file này và append sang `HISTORY.md`.

## Bất biến

- Grain nghiệp vụ lấy `docs/DATA-GRAIN-MATRIX.md` làm contract. Nhu cầu ngày, tổng tuần, snapshot tồn, source-line chứng từ và movement audit không được trộn.
- Không gộp, deduplicate hoặc dùng React key theo tên nguyên liệu. Dòng tổng chỉ là presentation; action phải drill down về ID nguồn.
- Browser gate desktop hiện hành có đúng năm viewport: `1920×1080`, `1440×900`, `1366×768`, `1365×900`, `1280×900`.
- PB canon đã được Kỳ duyệt toàn bộ ngày `2026-07-30`; Button chọn 8B và form controls chọn 9B theo `docs/PB-UI-VARIANT-AUDIT.md`. `WeeklyMenuLifecyclePanel` phát sinh do hiểu nhầm E2E đã bị gỡ; lifecycle model/registry chỉ còn là contract/test. D-01 khóa Option A: WeeklyMenu DRAFT `Publish` vẫn **Admin-only**; việc Manager/Coordinator không có control là FE chặt hơn BE có chủ đích. PD và object thứ hai vẫn đóng.
- DEC-06 khóa format tương lai `CoordinationOrderScopeLifecycle`: grain mỗi hàng là `scenario × operation`,
  mọi hàng có `scope`, còn `entityState` và `projectionState` tách riêng. Chưa có CoordinationOrder
  registry hoặc implementation object thứ hai; đây chỉ là invariant về schema cho plan tương lai.
- Không kết luận pass từ BE/API riêng lẻ; evidence phải nối FE control → API → DB transition → FE reload.
- Trước khi chạy file `.sql`, phải soi `USE`, `CREATE DATABASE`, `DROP DATABASE` và `DROP TABLE`; database đích trên CLI không vô hiệu hóa `USE` bên trong file. Không chạy mutation nếu chưa có precondition và rollback.
- UI giữ SAP Fiori compact: work object theo tab, action/status rõ, tab một dòng có overflow hợp lý, shell không remount, panel cũ được giữ khi refetch và loading/empty/error/permission không được đánh đồng.
- Không reset/seed/import lại lane để làm test xanh; artifact và DB lineage phải được bảo toàn.
- Mỗi số liệu trạng thái chỉ khai trong một file: gate hiện hành ở đây, hash output artifact ở evidence index; nơi khác chỉ trỏ link.
- `MEMORY.md` chỉ giữ trạng thái hiện hành; `HISTORY.md` append-only, `LESSONS.md` bất biến, `docs/EVIDENCE-INDEX.md` quản lý artifact và hash.

## Còn mở

- `OPEN-01` · owner `QA/UI` · đóng khi Kỳ chốt/gạch 7 candidate, bổ sung đủ 10 lỗi + 3 golden IPC và harness có oracle nhị phân chạy đủ 5 viewport.
- `OPEN-02` · owner `Backend/SampleData` · đóng khi BOM workbook hỏng trả lỗi domain thân thiện thay vì HTTP generic và có API regression.
- `OPEN-03` · owner `Frontend/WeeklyMenu+Admin` · đóng khi commit import và activate/deactivate nhân viên đều có confirm nêu đủ scope/tác động.
- `OPEN-04` · owner `Ops/Backup` · đóng khi dump + binlog được mã hóa lên object storage immutable, có SSD luân phiên off-premises và restore drill chỉ từ off-site pass toàn bộ gate runbook.
- `OPEN-05` · owner `Backend/Audit` · đóng khi thay đổi contract/menu-schedule effective range có audit coverage end-to-end.
- `OPEN-06` · owner `Backend/Planning+DB` · đóng khi invariant một tier cho mỗi customer/week được enforce ngoài UI và có migration/test.
- `OPEN-07` · owner `Import/Platform` · đóng khi preview có BOM diagnostics đúng scope, token/checksum commit và provenance cho dish do import tạo.
- `OPEN-08` · owner `Backend/Import` · đóng khi batch hai khách hàng atomic hoặc có recovery protocol được test.
- `OPEN-09` · owner `QA/Tooling` · đóng khi artifact spreadsheet author được workbook case matrix và browser E2E import xác minh mà không mutate template gốc.

## Cần Kỳ quyết

- `DEC-01` · Xác nhận/gạch 7 UI candidate, bổ sung 3 lỗi còn thiếu và chọn 3 màn IPC golden theo `docs/UI-CONFORMANCE-CANDIDATES.md`.
- `DEC-02` · Chọn/cấp tài khoản object storage R2 hoặc B2 và hai SSD luân phiên; codebase không tự tạo subscription/credential.
- `DEC-04` · Chốt Manager có được vào UI catalog-write hay không; backend `CatalogAccess` cho phép nhưng FE Admin Data hiện yêu cầu wildcard admin.
- `DEC-05` · Chốt có đưa `inventory.receipt.approve` vào approval inbox hay tiếp tục để API-only.

## Gate hiện hành

Gate chốt ngày `2026-07-31`: Application `49/49`; API `698 pass + 1 intentional skip`; checker PA-4
riêng lẻ `1/1` pass và vẫn quét production, dev fixture cùng test không miễn trừ. Frontend giữ nguyên
`95 file / 506 test`; ESLint và production build pass. Dependency-cruiser `0 violation / 363 module /
1.242 dependency`; architecture-growth test và strict gate pass. Root `npm run verify` pass toàn bộ.
Commit `8b87470` canonicalize đúng tám callsite; backend vocabulary/policy, guard implementation,
route/menu/action gate và rendered UI không đổi. PA-4 closeout đã chuyển sang `HISTORY.md`.

PA-2B/PC fixture final chạy Chrome headed `6/6` trên đúng năm viewport: 11 scenario, 115
actor-scenario case, 2.675 interaction point, 115 screenshot, 1.235 API record, 0 business mutation,
0 unhandled API, 0 overflow/page error/unexpected browser issue. Nó chỉ chứng minh FE rendering với API
intercept, không phải backend/DB E2E. Evidence/hash authoritative ở `docs/EVIDENCE-INDEX.md`.

Operational E2E riêng chạy Chrome headed trên disposable `ipc_e2e_template`: import → Admin Contracts
publish → hoàn tất 12 ca → sinh/duyệt 6 demand → handoff Thu mua; 28 mutation đều 2xx, DB đạt 12 plan
COMPLETED, 6 request MANAGERAPPROVED và 350 line. `ipc_lane1` không đổi; template đã rollback bằng clone
61 bảng và runtime `3001/8001/8090` đã teardown.

Chạy lại từ project root:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName!~FrontendPermissionVocabularyTests"
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-build --no-restore --filter "FullyQualifiedName~FrontendPermissionVocabularyTests"
npm run test:unit -w frontend -- --maxWorkers=1
npm run depcruise -w frontend
git diff --check
```

Browser/DB evidence tương ứng chỉ lấy từ các dòng authoritative trong `docs/EVIDENCE-INDEX.md`.

PA-2B/PC và operational E2E cho `WeeklyMenuLifecycle` đã đo xong. D-01 khóa Option A: control
`Publish` tại Admin Data → Contract vẫn **Admin-only**; DRAFT × Manager/Coordinator là FE chặt hơn BE
có chủ đích, không phải defect còn chờ alignment. PD và object thứ hai vẫn đóng.

Số liệu ở HISTORY.md là lịch sử, không bao giờ override file này.
