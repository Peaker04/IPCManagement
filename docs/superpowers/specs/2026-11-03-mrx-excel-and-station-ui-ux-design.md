# MRX — Excel nghiệp vụ và cải tiến UI/UX theo từng trạm

**Ngày:** 2026-11-03  
**Trạng thái:** Owner đã duyệt tài liệu sau khi được cung cấp đường dẫn và tóm tắt; implementation plan chờ review tại `../plans/2026-11-03-mrx-excel-and-station-ui-ux.md`. Chưa triển khai.  
**Trạng thái công việc:** chỉ theo `.planning/WORK.md`.

## 1. Mục đích và vị trí trong plan

Hoàn thiện các tệp nghiệp vụ MRX thành Excel thật, tiếng Việt, đồng thời sửa trải nghiệm trên các màn hình hiện có và kiểm chứng bằng thao tác thực tế. Đây là gói tiếp nối trong hierarchy:

1. `../plans/2026-11-02-mrx-five-user-production-qualification.md`
2. `../plans/2026-11-03-mrx-lifecycle-scope-lock.md`
3. `../plans/2026-11-03-mrx-single-clone-audit-repair.md`

R6/GateC đã PASS trên candidate cũ, không chứng nhận candidate sau các sửa đổi này. Gói này không cấp quyền quantitative, release, deploy hay đóng campaign.

Quy mô: nhiều chặng FE/BE/test liên quan, không phải một lần đổi nhãn/nút. Thực hiện tuần tự theo trạm và dependency, không viết lại toàn app.

## 2. Các phương án và lựa chọn

- **A — Theo trạm, đầu-cuối (đã chọn):** sửa Excel/template, nội dung, màn hình/dialog rồi xác nhận nghiệp vụ cùng chặng. Dễ gắn mỗi sửa đổi với đầu ra thật; cần giữ dependency và kiểm chứng liên trạm cuối cùng.
- **B — Excel toàn bộ rồi UI toàn bộ:** có thể gom sửa exporter/parser, nhưng trì hoãn phản hồi thực tế và dễ để dữ liệu/file lệch UI.
- **C — Chỉ hai lỗi review, hoãn phần còn lại:** diff nhỏ nhất nhưng không đáp ứng yêu cầu “toàn bộ” Excel và UI/UX.

Chọn A, tái sử dụng owner dùng chung khi có nhu cầu thật; không tạo framework Excel hoặc bộ primitive mới.

## 3. Trong scope, ngoài scope và bất biến

**Trong scope:** FR-MENU, FR-WH, FR-CHEF, FR-RECON, FR-REP; FR-CAT/FR-ADMIN/FR-AUTH khi trực tiếp hỗ trợ MRX. Bao gồm template/input nghiệp vụ, chuẩn bị nguyên liệu, phiếu nấu, lịch sử và báo cáo MRX; UI và quản trị danh mục/BOM/quy đổi liên quan. Không chuyển JSON/log/manifest kỹ thuật sang Excel.

**Bất biến:** DOM-MODE-1; không thay workflow DEFAULT. Giữ định lượng sáu chữ số thập phân, phân biệt ID món dù trùng tên, BOM tính một lần theo distinct ID, lineage kho thật, lịch sử append-only, Chef chỉ đọc/export, Manager không bị thay bởi Admin. Không hạ quyền hay che expected403/409.

**Không làm:** route/workflow xuất kho mới; redesign theme toàn app; package installation; delegation; stage/commit/push/deploy; tạo clone khác/re-dump/bootstrap; sửa main/schema/data khi chưa có scope riêng; Finish/Abort; endurance/k6/quantitative/off-host certification. Không tạo master/stock/supplier giả để chứng minh PASS.

## 4. Hợp đồng Excel và tiếng Việt

### 4.1 Quy tắc chung

- Mọi đầu vào/đầu ra nghiệp vụ trong scope có đường đi `.xlsx` thực sự. Download phải đúng MIME/nội dung OOXML, không CSV đổi đuôi. Test input đi qua parser thật, không chỉ đổi tên fixture.
- Giữ endpoint/consumer CSV tương thích nếu chưa chứng minh có thể bỏ; XLSX là lựa chọn nghiệp vụ chính. CSV còn reachable vẫn phải chống formula injection. Không tự xóa API CSV đang có caller.
- Ô số là số, không chuỗi format che mất độ chính xác; giữ sáu chữ số thập phân trong dữ liệu và hiển thị phù hợp. Không cộng kg với lít. Ngày/ca/khách/tuần lấy đúng scope thực; mã có số 0 đầu và text giống công thức giữ kiểu text.
- Tiêu đề, hướng dẫn, tên sheet và lỗi dùng tiếng Việt nghiệp vụ. Giữ mã tham chiếu thật khi cần tra cứu; không phơi DTO/property/fixture label làm từ vựng người dùng.
- Giữ mọi cột bắt buộc của hợp đồng nhập. Template và parser được sửa cùng owner; alias kỹ thuật cũ giữ tương thích khi đã có consumer, không âm thầm đổi nghĩa/đơn vị. Lỗi chỉ rõ sheet/dòng/cột và cách sửa, không commit một phần ngoài hợp đồng hiện hành.
- Dữ liệu user-controlled trong XLSX phải là text cell, không formula; CSV xử lý text nguy hiểm riêng, không biến số âm hợp lệ thành text. Xác nhận an toàn bằng đọc workbook/CSV thực, không chỉ assert file tồn tại.
- Freeze header/cột định danh, filter và print layout khi có ích; không áp một layout duy nhất cho mọi chứng từ. Workbook lớn phải giữ các giới hạn hiện có, không bỏ paging/streaming để dựng tất cả dữ liệu trong browser.

### 4.2 Hình dạng theo nghiệp vụ

| Chặng | Hình dạng và owner định hướng |
|---|---|
| Thực đơn/số suất | Template và dữ liệu nhập đúng khách/tuần/ngày/ca, món và suất; giữ bốn slot và group/individual theo hợp đồng hiện tại. `WeeklyMenuImportModal`, weekly-menu API và workbook parser/export owner hiện có. |
| BOM/quy đổi liên quan | Header tiếng Việt, danh mục/hướng dẫn hợp lệ; tất cả trường bắt buộc bám parser/DTO C#. `DishBomBatchImportModal`, `bomApi`, Catalog import services và unit conversion owner thực tế. Không tự thêm CRUD đơn vị. |
| Chuẩn bị nhiều khách | Dùng `ReconciliationPreparationWorkbookExporter` hiện đã có XLSX và nhóm NCC thật. Đề xuất sheet hướng dẫn, tổng hợp theo ngày, chi tiết phân bổ; ngày → NCC → nguyên liệu khi nguồn có NCC. Không tự gán NCC thiếu; không đổi tổng/phân bổ. |
| Bếp | Ngày → ca → món → nguyên liệu, đúng khách/tuần đã chọn, đọc/export không ghi. Reuse `ReconciliationKitchenExportService`, cooking controller/workbench. |
| Lịch sử/báo cáo | Sheet theo mục đích từng báo cáo, giữ ngày/chứng từ/trạng thái/quantity/lineage cần thiết, đúng filter/scope và paging/export toàn phạm vi theo hợp đồng. Reuse reports/history query và exporter owners; không xuất riêng trang hiện tại rồi gọi là toàn bộ. |

Tên sheet/cột chính xác và danh sách endpoint được kiểm kê source trước patch ở từng trạm, ghi checklist trong WORK. Đây là chi tiết implementer được quyết định nếu không làm mất trường/đổi nghĩa/đổi phạm vi; thay hợp đồng nghiệp vụ phải quay lại Owner.

## 5. Hai must-fix làm trước

1. **CSV công thức:** `ReconciliationKitchenExportService` hiện chỉ quote text. Customer code `=1+1`, name `1` có thể thành công thức trong Excel. Regression tại owner export hiện có phải fail trên pre-fix vì text chưa được neutralize; sửa serializer text-cell, bảo toàn dấu quote/dấu phẩy/xuống dòng và số hợp lệ. Rà caller để tránh owner khác tiếp tục lỗ hổng tương tự trong scope.
2. **Login queue timeout:** `fixtures/authHelpers.ts::loginRole` phải chờ `respectLoginBudget()` trước khi tạo response waiter; waiter vẫn được đăng ký trước click. Giữ queue13s và server5/min/IP. Regression fake-clock chứng minh năm reauth đồng thời không timeout chỉ vì đang xếp hàng và response vẫn bắt đúng request; không tăng timeout để che lỗi.

Đây là hai lỗi đã xác nhận, không biến mọi nghi ngờ review thành finding mới chưa có reproduction.

## 6. UI/UX: sửa tại trang đang có

Trạm xuất kho ngày là workbench hiện có dưới `/warehouse`, owner `MrxDailyIssueWorkbench.tsx` và `useMrxDailyWorkspace.ts`; không thêm route hay workflow song song. Phác thảo tại `.superpowers/brainstorm/188-1793723512/content/mrx-erp-excel-and-operation-v1.html` chỉ minh họa hướng thiết kế, không phải mã production để sao chép nguyên trạng.

- Dùng primitives/composites và token hiện có theo DESIGN/UI-KIT, Impeccable Operate; mọi thay đổi styling thuộc authority `frontend/src/styles/index.css`, không token tùy tiện/inline/external CSS.
- Ngữ cảnh khách/ngày/tuần/ca/role rõ ràng; một primary action cho work object. Chọn filter không được âm thầm đổi scope khác. Không khóa nút mà thiếu lý do.
- Bảng compact36–40px khi phù hợp nội dung, chữ không dưới12px, frozen header/cột định danh; overflow nằm ở bảng chứ không cả trang. Không thu nhỏ chữ để tránh responsive.
- Dialog ngắn cho xác nhận; công việc dài dùng workbench/panel hiện có. Một blocking modal tại một thời điểm, body cuộn và footer truy cập được. Escape/Tab/Shift+Tab/focus return đúng, cảnh báo bản nhập chưa lưu theo primitive hiện có.
- Sáu trạng thái: loading, empty, error, permission-denied, partial, write-reconciliation. Giữ bản nhập khi lỗi; conflict cho phép đối chiếu dữ liệu mới, unknown outcome kiểm tra kết quả trước tạo lại; không success giả.
- Hardcode audit phân biệt static business label hợp lệ với ngày/số lượng/tên/NCC/status/fixture text bịa trong production. Không xóa hằng nghiệp vụ cần thiết chỉ vì là literal.
- **NCC ở trang xuất ngày chưa được chốt:** mặc định không thêm phân nhóm mới tại đây. Giữ grouping ở chuẩn bị/Excel hiện có; chỉ đưa vào trang xuất nếu source và thao tác thật chứng minh lợi ích, rồi trình Owner. Không dùng mockup làm quyền mở rộng scope.

## 7. Thứ tự và tiêu chí theo trạm

Sau hai must-fix: (1) template/danh mục/BOM/quy đổi cần thiết, (2) thực đơn và số suất, (3) duyệt/sửa nguồn, (4) chuẩn bị phối hợp, (5) xuất đầu/bổ sung và recovery, (6) Bếp, (7) đối soát/chốt/lịch sử/báo cáo. Có thể gom patch chung tại đúng serializer/parser/primitive owner trước các caller, không nhiều writer.

Mỗi chặng: kiểm kê hữu hạn → reproduce/contract → sửa nhỏ → build/lint/owner tests → thao tác FE thật khi được admission → đọc XLSX tải/nhập và durable result/reload → verdict trong WORK. Chặng lỗi không chạy nhóm dài phía sau để tích lũy PASS không liên quan. Một lượt audit và một lượt confirm sửa; finding mới phân loại và chốt hữu hạn, không đánh bóng vô hạn.

## 8. Verification và bằng chứng

- Nạp test-audit/ipc-test-audit trước sửa test; regression fail pre-fix đúng nguyên nhân. Một test owner mạnh nhất mỗi contract; mở rộng case/table hiện có thay duplicate; không mock component dưới test hoặc thêm seam chỉ cho test.
- Scoped Pre-Code UI Gate trước TSX/CSS; code-review và ui-review theo project; build/lint/API/architecture/dependency gates liên quan. UI contracts gồm `operationalPageContracts.test.ts` và các `*.contract.test.tsx` bị ảnh hưởng.
- UI thực từng chặng: laptop1280×720/1366×768, desktop1920×1080, hẹp960×720 và native browser zoom200% tại điểm rủi ro. Implementation plan chốt selection nhỏ nhất thay matrix mọi route×role×viewport. Màn cần kiểm tra riêng: source grid/import/review, kho/ngày/bổ sung/conflict, cooking, disposition/completion/history/report. Ảnh menu không chứng minh các dialog.
- Kiểm tra keyboard/focus, cuộn bảng/body, nút không che/cắt, errors/recovery; real operation đúng actor. SQL/HTTP chỉ corroborate, không thay FE để tạo business claim.
- Parse bytes workbook: sheet/header/types, ngày/ca/khách, số lượng, distinct ID, supplier grouping khi có, scope và tổng khớp oracle độc lập. Tải nhập rồi xác nhận trạng thái durable, không chỉ file exists hoặc response200.
- Verdict từng tiêu chí: PASS/FAIL/NEEDS_EVIDENCE/BLOCKED. Liên kết candidate/build, actor/batch/revision, ảnh/download/parsed readback/RED→GREEN trong campaign hiện có. Không chỉnh lifecycle acceptance packet cũ hay rebind immutable manifests.

## 9. Runtime và tài nguyên

Giữ campaign `20261103t101725z_407a6d`, clone `ipc_mrx_evidence_20261103t101725z_407a6d`; main `ipcmanagement` chỉ đọc. Không Start lần nữa, tạo DB integration, dump/restore, migrate hay seed scope khác. Prerequisite mới phải được khai báo và duyệt trước. Credentials DPAPI/private ACL; dedicated Chrome, single worker, maxFailures1; chỉ dừng process thuộc ownership đã xác minh.

Thiết kế này không tự cấp ngân sách một attempt mới. Trước runtime, implementation plan phải chốt gate/case selection, phase/case budgets, storage headroom và quyền mutation đúng phạm vi; xin admission riêng khi current scope chưa bao phủ. Giữ caps hiện hành (2GiB soft/4GiB hard, reserve256MiB; scanner10000files/3000ms; unknown usage blocks). Không nâng timeout/caps/retry aggregate tự động. Prototype browser/server không phải runtime campaign hoặc bằng chứng nghiệp vụ.

## 10. Hoàn tất và phần còn mở

Gói đạt khi hai lỗi có regression thật; toàn bộ đường file nghiệp vụ kiểm kê trong scope có XLSX thực/tiếng Việt/safe text; UI từng trạm không còn lỗi chặn tiêu chí đã chốt; gates và bằng chứng đúng candidate sau sửa. Không gọi toàn plan/release PASS khi parent gates chưa hoàn tất.

**Quyết định implementer được phép:** bố cục sheet/cột không đổi semantics, cách gom patch dùng chung, owner test nhỏ nhất, representative viewport theo rủi ro. **Cần Owner ruling:** grouping mới trên trang xuất ngày, thay hợp đồng nhập/đơn vị/quyền, prerequisite/master mutations mới, ngân sách/runtime selection mới, mở scope DEFAULT/quantitative/release.

Tài liệu tự rà theo góc nhìn builder tại parent (không delegation): nêu owner và callers, compatibility CSV/XLSX, precision/security, rollback bằng sửa có kiểm chứng chứ không reset dirty tree, admission độc lập và bằng chứng chưa có. Chưa có independent delegated review. Sau khi Owner duyệt tài liệu này, bước tiếp theo là `writing-plans`, không triển khai sản phẩm trước bước đó.
