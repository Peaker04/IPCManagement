# Đánh giá Agent Brief 30/07/2026

Tài liệu này phản chứng `.docs/AGENT-BRIEF-2026-07-30.md` trên checkout
`feature/workflow-b17-b18`, source hiện hành và truy vấn read-only `ipc_lane1`. Brief gốc
được giữ nguyên. Gate hiện hành chỉ lấy từ `MEMORY.md`; artifact/hash chỉ lấy từ
`docs/EVIDENCE-INDEX.md`.

## 1. Phản chứng chín giả thuyết

| Mục brief | Verdict | Bằng chứng và kết luận |
|---|---|---|
| Backup off-site vật lý còn hở | **Đúng** | Runbook nói C:/D: có thể cùng physical disk và cần external/NAS/cloud (`tools/db/README.md:265-266`). `OPEN-04` theo dõi implementation/restore drill; `DEC-02` chỉ giữ phần Kỳ phải cấp/chọn R2/B2 và hai SSD. |
| Workbook-authoring bị blocker artifact tool | **Đúng trong runtime này** | Spreadsheet skill bắt buộc dependency do `load_workspace_dependencies` cấp và buộc dừng nếu runtime/tool không có (skill `spreadsheets`, dòng 20-21). Runtime hiện không expose loader này; không được tự cài hay lách path. |
| Một tier/customer/week chỉ enforce ở UI | **Một phần** | BE import buộc một tier thuộc tập cho phép (`WeeklyMenuImportService.cs:23,45,182-196`) và ghi tier đó cho toàn bộ schedule import (`WeeklyMenuImportPersistence.cs:108-117,505-545`). DB chỉ unique customer/date/shift, không enforce các schedule cùng tuần có cùng `MenuPrice` (`MenuEntityConfigurations.cs:119-126`). Cần khóa invariant xuyên mọi write path, không kết luận “chỉ UI”. |
| BOM xlsx hỏng trả HTTP generic | **Đúng** | Controller gọi thẳng import service (`DishBomImportsController.cs:43-58`); parser workbook chỉ `finally` xóa temp, không map `InvalidDataException` (`DishBomImportParser.cs:299-348`); middleware không có arm cho lỗi file này (`ExceptionMiddleware.cs:35-62`). Weekly-menu đã có `FILE_READ_ERROR`, BOM chưa có regression tương ứng. |
| Supplemental fulfillment thiếu transaction | **Sai, đã đóng** | `FulfillAsync` bọc load, issue, `RemoveStockWithCheckAsync`, audit, state và save trong `_transactionRunner.ExecuteAsync` (`SupplementalMaterialRequestService.cs:164-252`). Đã xóa khỏi memory. |
| Năm component Thu mua là dead code | **Sai theo checkout hiện tại** | Tìm definition/reference cho `PurchaseDemandSection`, `PurchaseOrderSection`, `PurchaseSupplierSection`, `PurchaseHandoffSection`, `SupplierLineItem` đều 0 kết quả. Claim cũ chỉ còn trong lịch sử (`HISTORY.md:433`), không còn quyết định sản phẩm để chốt. |
| Hai test migration upgrade chưa chạy CI | **Đúng lúc đánh giá; đã xử lý** | Hai test nay tự dựng fixture ở predecessor migration và được chạy riêng trong `.github/workflows/verify.yml`; gate local trên MySQL thật đã pass. |
| Hai migration ID mồ côi | **Đúng lúc đánh giá; đã xử lý** | Truy vấn read-only `ipc_lane1.__EFMigrationsHistory` trả về cả hai ID. Source đã khôi phục hai no-op migration đúng ID; fresh/upgrade/schema/lineage gate đều pass. |
| Diagnostics đếm bảng tuần tự | **Đúng** | `GetSampleImportStatusAsync` chạy các `CountAsync` nối tiếp, trong đó report là tổng nhiều query (`DishCatalogDiagnosticsService.cs:245-264`). Chưa có benchmark nên chỉ kết luận query shape, chưa gán P-level. |

Giả thuyết “`gsd-doc-writer` append `MEMORY.md`” cũng **sai**: agent chỉ có
`create/update/supplement/fix`; append chỉ là semantics của `supplement` cho doc được giao,
không có nhánh nào tự động ghi `MEMORY.md` (`gsd-doc-writer.md:18,72-86`). Vì vậy
không sửa agent này; quy tắc compact được giữ trong `MEMORY.md`/`AGENTS.md`.

## 2. Baseline oracle UI thực tế

| ID brief | Verdict | Hiện có | Khoảng trống |
|---|---|---|---|
| B-C1 | **Đúng cho headed evidence** | Script chụp ba PNG mỗi viewport (`phase18-headed-audit.mjs:162-169`); PowerShell chỉ kiểm tra file tồn tại (`Assert-Phase18Evidence.ps1:78-80`). | Không có read-back/vision verdict hay reference pair. |
| B-C2 | **Đúng** | Không có `floorplan` metadata trong `frontend/src`/tests. | Chưa có contract list-report/worklist/object-page/overview-page theo màn. |
| B-C3 | **Sai một phần** | Headed gate đo error, overflow, CLS, long task (`phase18-headed-audit.mjs:180-194`). Playwright `ui-audit` đã bắt word-break/action width/dialog label (`ui-audit.spec.ts:304-350`) và tab nowrap/target/clip/animation/scroll jump (`ui-audit.spec.ts:444-534`). | Chưa có unit/locale, weekly-vs-daily label, disabled reason, primary action in-fold, object-page key facts, token spacing, contrast, form grid, focus ring toàn cục, skeleton parity, sticky table hay per-viewport invariant. |
| B-C4 | **Đúng** | `frontend/src` có 0 file emit `data-component`; chỉ có vài marker/test ID cục bộ. | Selector hiện tại không ánh xạ ổn định về component/source. |
| B-C5 | **Chưa được enforce** | Helper/harness là script chụp + assert; không có boundary quyền Capturer/Judge/Fixer trong repo. | Cần ma trận và input 10 case trước khi tách vai; không tự tạo 10 lỗi thay Kỳ. |

Kết luận D-08: có thể mở rộng `frontend/tests/ui-audit.spec.ts`; không nên viết lại
harness. D-09→D-15 chưa được phép khởi động vì chưa có 10 case + reference
và chưa có matrix nhị phân.

## 3. Audit mattpocock/skills

| Cảnh báo | Verdict hiện tại |
|---|---|
| Chưa setup | **Sai**: `docs/agents/{issue-tracker,triage-labels,domain}.md` đã tồn tại. `domain.md` đã được sửa con trỏ stale sang `MEMORY.md` và `docs/DOMAIN.md`. |
| Tên skill chắc chắn collision | **Sai trong repo này**: 21 tên trong lock không trùng 9 thư mục skill dự án đang tracked; GSD đã có prefix `gsd-`. Không prefix chỉ để khớp dự đoán. |
| Đã ghim upstream commit | **Chưa đạt**: `skills-lock.json` có source/path/content hash nhưng không có commit SHA; file lock và skill mới còn local/untracked hoặc ignored. |
| Skill ngoài đã security-review | **Chưa chứng minh**: content hash giúp phát hiện drift, không chứng minh instruction an toàn. Không bật orchestrator hay update skill trước khi chốt quyền sở hữu process và provenance. |

## 4. Đã apply và còn chặn

- **Đã apply:** tách memory theo kiến trúc bốn tầng; xóa supplemental/dead-code stale
  khỏi current memory; giữ đúng chín dòng open; bổ sung glossary nghiệp vụ; sửa
  config skill local; hoàn thành D-01 và D-08.
- **Chưa apply có chủ đích:** không tạo `CONTEXT.md` trùng `docs/DOMAIN.md`; không prefix
  skill khi audit không có collision; không sửa `gsd-doc-writer` vì giả thuyết sai; không
  emit `data-component` hay thêm lint/matrix khi thiếu 10 case + reference.
- **Cần Kỳ quyết:** commit/pin bộ skill local theo upstream SHA nào; xác nhận/gạch
  bảy UI candidate, bổ sung đủ mười lỗi và chọn ba màn golden; cấp/chọn tài khoản
  R2 hoặc B2 cùng hai SSD off-premises.

## 5. Quyết định bổ sung đã apply

- GSD là process owner duy nhất; hotfix cũng qua GSD. Các orchestrator mattpocock và
  router của chúng bị vô hiệu hóa theo `docs/adr/0001-gsd-process-ownership.md`.
- Bảy UI candidate được ghi thành checklist chờ Kỳ xác nhận; chưa candidate nào
  được promote thành bug/matrix.
- Hai upgrade migration test đã có predecessor fixture và bước CI. Sau khi test xanh,
  hai ID mồ côi được khôi phục bằng no-op; ba ID legacy hợp nhất giữ nguyên SQL.
- Backup target là object storage immutable + SSD luân phiên; gap chỉ đóng sau restore
  drill chỉ từ off-site.
