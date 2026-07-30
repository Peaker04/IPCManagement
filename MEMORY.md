---
updated: 2026-07-30
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
- PB canon đã được Kỳ duyệt toàn bộ ngày `2026-07-30`; Button chọn 8B và form controls chọn 9B theo `docs/PB-UI-VARIANT-AUDIT.md`. Chưa mở PE mới trước khi chạy xong `P3 → P4 → PC`.
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
- `OPEN-10` · owner `Frontend/Auth` · đóng khi Kỳ duyệt canonical cho sáu chuỗi PA-4, checker vocabulary xanh và được đưa vào full gate mà không miễn production, dev fixture hoặc test.
- `OPEN-11` · owner `QA/UI` · đóng khi P3 → P4 → PC đo xong thao tác UI thiếu và Kỳ duyệt kết quả trước khi mở PD.

## Cần Kỳ quyết

- `DEC-01` · Xác nhận/gạch 7 UI candidate, bổ sung 3 lỗi còn thiếu và chọn 3 màn IPC golden theo `docs/UI-CONFORMANCE-CANDIDATES.md`.
- `DEC-02` · Chọn/cấp tài khoản object storage R2 hoặc B2 và hai SSD luân phiên; codebase không tự tạo subscription/credential.
- `DEC-03` · Chọn canonical cần sửa cho PA-4: `admin.only`, `inventory:read`, `orders.lock`, `production:read`, `warehouse.issue`, `warehouse:read`; `warehouse.issue` chưa suy ra được canonical từ test generic.
- `DEC-04` · Chốt Manager có được vào UI catalog-write hay không; backend `CatalogAccess` cho phép nhưng FE Admin Data hiện yêu cầu wildcard admin.
- `DEC-05` · Chốt có đưa `inventory.receipt.approve` vào approval inbox hay tiếp tục để API-only.
- `DEC-06` · Duyệt định dạng registry một đối tượng trước khi mở object thứ hai; canon PB đã được duyệt và không còn nằm trong quyết định này.
- `DEC-07` · Duyệt PC một-object tại `docs/P3-P4-PC-WEEKLY-MENU-AUDIT.md`: hiện 0 lệch được xác nhận và 10 bối cảnh chưa kết luận được; chọn bổ sung approval/downstream state + actor vào registry hay cấp browser fixture read-only trước khi chạy lại.

## Gate hiện hành

Gate chốt ngày `2026-07-30`: Application `49/49`; API baseline `697 pass + 1 intentional skip`
khi tách checker PA-4; checker PA-4 riêng lẻ đỏ đúng thiết kế trên sáu chuỗi có file:dòng;
frontend `95 file / 506 test`; ESLint và production build pass. Dependency-cruiser `0 violation /
364 module / 1.251 dependency`; architecture-growth test và strict gate pass. Commit PA `d26a452`
chỉ thêm test/tài liệu, không đổi production behavior. `npm run verify` hiện cố ý dừng ở PA-4 cho
đến khi DEC-03 được chốt; không được skip fixture hoặc test để làm gate xanh.

Chạy lại từ project root:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName!~FrontendPermissionVocabularyTests"
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-build --no-restore --filter "FullyQualifiedName~FrontendPermissionVocabularyTests"
npm run test:unit -w frontend -- --maxWorkers=1
npm run depcruise -w frontend
git diff --check
```

Browser/DB evidence tương ứng chỉ lấy từ các dòng authoritative trong `docs/EVIDENCE-INDEX.md`.

P3 → P4 → PC cho `WeeklyMenuLifecycle` đã đo xong và đang chờ Kỳ duyệt tại
`docs/P3-P4-PC-WEEKLY-MENU-AUDIT.md`. Không mở PD, object thứ hai hoặc PE mới trước quyết định này.

Số liệu ở HISTORY.md là lịch sử, không bao giờ override file này.
