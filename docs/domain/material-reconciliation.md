---
title: Material Reconciliation business contract
status: canonical-domain-contract
owner: GSD
scope: MATERIAL_RECONCILIATION
extracted_from: ../../MEMORY.md
---
# Material Reconciliation

> Contract này được extract nguyên nghĩa từ working memory ngày 08/09/2026. Source/runtime có thể phát hiện implementation lệch contract nhưng không tự thay đổi expected behavior. Mọi thay đổi nghiệp vụ cần owner decision và cập nhật tài liệu này trong cùng task.

## PLANNED BUSINESS CHANGE — daily issue and kitchen export · 17/09/2026

The next implementation campaign is owned by `.planning/notes/MRX-DAILY-ISSUE-KITCHEN-EXPORT-PLAN.md`. Owner decisions:

- Warehouse issue is changing from one weekly initial issue to independent issue transactions per service date.
- UI provides `Tất cả | Thứ 2 … Chủ nhật`; `Tất cả` is overview-only and cannot submit an issue.
- Daily and weekly statuses must come from one backend ledger-derived projection. The active filter must never change weekly status.
- Daily frozen authority requires durable `batch × serviceDate × ingredient × unit` lineage; do not simulate this by filtering weekly aggregate lines.
- Kitchen cooking export is generated from frozen batch facts with servings, dish, ingredient, BOM-per-serving and total required quantity; it excludes IDs, versions, fingerprints, price and purchasing data.
- Existing protected batches are not silently rewritten. Compatibility must be explicit and tested before migration.

The sections below describe the current implemented contract and are the baseline to migrate from. Where the planned change conflicts with the current weekly-issue wording, the new checklist governs implementation only after its red gates and additive lineage design are approved in source/tests.

## BUSINESS CONTRACT HIỆN HÀNH — MATERIAL_RECONCILIATION · 04/09/2026

> Đây là memory ưu tiên cao và là bản nghiệp vụ tự đủ phải được đọc trước mọi task liên quan MRX. Nó supersede mọi ghi chú lịch sử phía dưới nếu có mâu thuẫn, đặc biệt các câu cũ nói issued quantity không nhập tay, issue chỉ được tạo một lần hoặc shortage là hành vi dự kiến.

### 1. Mục tiêu và ranh giới mode

- `MATERIAL_RECONCILIATION` là vòng đời độc lập: **Thực đơn tuần → chuẩn bị nguồn → xem trước định lượng → tạo/đóng băng lô → chuyển Kho → xuất lần đầu → xuất thêm khi cần → đối chiếu → xử lý chênh lệch → hoàn tất**.
- Mode này có đúng các khu vực nghiệp vụ: Dashboard, Thực đơn tuần, Kho nguyên liệu, Đối chiếu, Quản trị dữ liệu; Advanced Settings chỉ là cấu hình admin.
- Mode này **không có Thu mua, Báo cáo, KHSX hay MaterialDemand của DEFAULT**. Không mount/fetch/mutate owner Purchasing/default-demand và không hướng người dùng sang Thu mua để tiếp tục MRX.
- `DEFAULT` và `MATERIAL_RECONCILIATION` dùng chung master data và physical stock, nhưng workflow record/lineage/query/mutation/audit của hai family phải tách tuyệt đối. Không chuyển, copy, re-parent hoặc cộng chéo record khi đổi mode.
- Mọi API read sở hữu batch/report của MRX phải khai báo `ReconciliationOnly`; route ẩn không phải ranh giới API. Shared InventoryIssue read phải ràng buộc `sourceFamily` với mode hiện hành trước repository access, không cho caller tự chọn family chéo mode.
- Trước mọi screenshot, browser action hoặc verdict phải gọi `GET /api/system-operation-mode` và assert đúng mode. Evidence từ mode khác không có giá trị. Không đổi mode khi Kỳ đang kiểm thử thủ công; harness đổi mode phải ghi version trước/sau và phục hồi mode gốc.

### 2. Authority và grain nguồn

- Weekly Menu read/import, bulk dish edit, menu schedule publication và meal quantity-plan read/quick servings là source-authoring owner dùng chung có chủ đích; vẫn chỉ có một source authority.
- Endpoint lịch sử thay đổi nguồn theo lô chỉ trả audit của các định danh nguồn tạo lô (phiên bản/thực đơn/lịch, kế hoạch và dòng số suất, BOM, đợt nhập). Trạng thái vòng đời `ReconciliationBatch` và audit `InventoryIssue` thuộc lịch sử lô/giao dịch Kho, không thuộc lịch sử tác giả nguồn.
- Phạm vi nguồn là **customer × week**; nhiều khách hàng tạo các lô độc lập, không trộn dòng hoặc lineage giữa khách hàng.
- Số suất thuộc grain **customer × service date/day × shift**. Mọi món trong cùng ngày/ca dùng cùng số suất; không lưu số suất độc lập cho từng món.
- Người dùng được tăng hoặc giảm số suất, sửa món và sửa BOM trước khi đóng băng. Trạng thái “Hoàn tất” của số suất chưa đồng nghĩa source bất biến; source chỉ bất biến sau `READY`.
- Món thiếu BOM vẫn phải được giữ trong nguồn và hiển thị đầy đủ diagnostic; không coi demand là hoàn chỉnh, không tự bỏ món và không tạo BOM giả. Recovery phải qua authority BOM chính thức.

### 3. BOM và template định lượng

- BOM sở hữu định lượng theo suất, không sở hữu số suất, giá mua thực tế hoặc cost nhập tay.
- Template Excel hiện hành ưu tiên vùng nhập: `Tên món` khóa; `Nguyên liệu chính`, `Đơn vị`, `Định lượng/suất`, `Hao hụt (%)`, `Ghi chú`; metadata hệ thống nằm ở cột ẩn/khóa.
- Dropdown nguyên liệu lấy danh mục active nhưng vẫn cho nhập nguyên liệu mới; dropdown đơn vị hiển thị tiếng Việt và ánh xạ về `UnitCode`. Parser tiếp tục nhận header/mã đơn vị cũ.
- Giá vốn được tính từ `GrossQtyPerServing × Ingredient.ReferencePrice`; mức 25k/30k/34k là price-tier chọn phiên bản BOM, không phải giá nguyên liệu. Nguyên liệu mới có reference price 0 cho đến khi được cập nhật bằng authority chính thức; không trình bày giá vốn 0 như kết quả đầy đủ nếu thiếu giá.

### 4. Preview, commit và đóng băng

- Preview phải trình bày chi tiết customer/week/day/shift, món, nguyên liệu, đơn vị, đóng góp và tổng required quantity; không chỉ trả một fingerprint kỹ thuật.
- Preview sử dụng source fingerprint v2 bao gồm menu/version, dish/BOM, servings, conversion và material projection. Mọi sửa nguồn sau preview làm preview stale, disable tạo lô và yêu cầu `Kiểm tra lại nguồn`.
- Commit phải recompute projection/fingerprint trong transaction trước write; source stale bị từ chối không partial persistence. Retry/double commit cùng command/source phải ổn định identity.
- Lô lifecycle: `DRAFT → READY → TRANSFERRED → IN_PROGRESS → COMPLETED`.
- `DRAFT`: còn chuẩn bị; `READY`: đã đóng băng immutable; `TRANSFERRED`: chờ Kho tạo phiếu đầu tiên; `IN_PROGRESS`: đã có issue ledger và được đối chiếu/xuất thêm; `COMPLETED`: read-only.
- Sau `READY`, mọi thay đổi menu, món, BOM, servings, conversion hoặc master không được rewrite frozen line/contributor. Nguồn mới phải tạo batch/version mới.

### 5. Invariant tồn kho bắt buộc

- **Trong `MATERIAL_RECONCILIATION`, operational warehouse luôn được giả định là đủ nguyên liệu để xuất.** Đây là quyết định nghiệp vụ gốc tại `30-CONTEXT.md:13`; mode không có bước Thu mua.
- `Không đủ tồn kho để tạo phiếu xuất` trong MRX là **vi phạm invariant/readiness defect**, không phải nhánh nghiệp vụ người dùng phải xử lý. Không hướng người dùng sang Thu mua và không dùng shortage rollback làm acceptance chính của mode này.
- Warehouse vẫn là owner duy nhất của issue + stock movement; issue là giao dịch kho thật và physical stock/ledger/audit vẫn phải nhất quán.
- Invariant đủ tồn không cho phép seed/reset tùy tiện, direct current-stock write, receipt giả, stock ledger thứ hai, lineage giả, xóa lịch sử hoặc âm thầm làm tồn kho âm. Phải bảo đảm sufficient-stock precondition bằng public/official authority hoặc contract provisioning MRX có canonical ledger/audit; không bypass validator. MySQL `stockmovements.movementType` chỉ chấp nhận `RECEIPT|ISSUE|RETURN|ADJUSTMENT|RECEIPT_CORRECTION`, vì vậy provisioning phải dùng `ADJUSTMENT` và nhận diện MRX qua reason/note + `refTable/refId`, không phát minh enum mới.
- Runtime defect ngày 04/09 tại `MATERIAL_RECONCILIATION / 64`, batch `ca139119-eb5b-4d47-baa4-5f2ee3b3536d`: 67/67 dòng `Dự kiến xuất đủ` nhưng issue từng trả `Không đủ tồn kho để tạo phiếu xuất`. Source hiện đã được sửa để reconciliation issue bắt shortage, bổ sung đúng `MissingQty` qua canonical `StockLedgerService.AddStockAsync` với movement enum hợp lệ `ADJUSTMENT`, reason/note `MRX provision` và batch lineage rồi tạo issue và ISSUE movement trong cùng protected transaction; không direct-write, không âm kho, không mở Thu mua. Focused application-path 23/23 PASS; runtime API 5262 đã rebuild/restart, nhưng chưa tự tạo phiếu trên batch của Kỳ để tránh mutation thay người dùng.

### 6. Phiếu xuất đầu tiên — manual actual issue

- Chỉ được tạo khi batch là `TRANSFERRED`, chưa có linked issue và actor có Warehouse permission.
- Phiếu đầu tiên phải chứa **mọi frozen batch line đúng một lần**; không thiếu dòng, lặp dòng, thêm ingredient ngoài lô hoặc trộn batch/customer.
- `RequestedQty` luôn bằng frozen `RequiredQuantity`; người dùng không được sửa requested source fact.
- Người dùng nhập `IssuedQty > 0` cho từng frozen line. Under-issue được phép. Over-issue được phép chỉ khi có `VarianceReason` tiếng Việt bắt buộc và audit được giữ.
- UI phải hiển thị required/input tối đa 6 chữ số, bỏ zero thừa; so sánh qua quantity precision 6 chữ số, không dùng raw JS comparison. Draft labels: `Chưa nhập`, `Dự kiến xuất thiếu`, `Dự kiến xuất đủ`, `Dự kiến xuất vượt`; committed labels: `Đã xuất thiếu`, `Đã xuất đủ`, `Đã xuất vượt`.
- `Điền đủ toàn bộ` chỉ điền chính xác frozen required values vào draft, không tạo issue. Chênh lệch thiếu/vượt phải hiển thị số lượng cụ thể. Over reason chỉ xuất hiện/bắt buộc khi normalized difference > 0.
- Issue thành công atomically ghi `InventoryIssue`, đủ `InventoryIssueLine`, stock movements, audit, lifecycle, idempotency và exact `ReconciliationBatchLineId`; batch chuyển `TRANSFERRED → IN_PROGRESS`. Failure không để partial residue.

### 7. Phiếu xuất thêm

- Chỉ được phép sau initial issue, khi batch là `IN_PROGRESS`; `COMPLETED` read-only.
- Mỗi supplemental transaction chọn **một hoặc nhiều ingredient đã có trong frozen batch** (chọn trực tiếp hoặc tính theo món và số suất phát sinh từ BOM hiện hành), quantity dương và lý do tiếng Việt bắt buộc. Phép tính theo món chỉ hợp lệ khi mỗi BOM nguồn ánh xạ duy nhất tới một frozen batch line cùng nguyên liệu; lineage mâu thuẫn phải fail-closed và hướng người dùng chọn nguyên liệu trực tiếp, không tùy ý chọn contributor đầu tiên. Sau khi đã có phiếu xuất đầu tiên, màn hình Thực đơn tuần phải dẫn thẳng tới đúng `batchId` ở Kho; thay đổi số suất không được âm thầm ghi đè `RequiredQuantity` đã khóa.
- Projection món cho xuất thêm giữ chính xác contributor → frozen line; nếu nguyên liệu trên BOM hiện hành đã đổi và không còn khớp frozen ingredient, phải fail closed thay vì gắn ingredient mới vào ID dòng cũ. Định lượng/suất sau quy đổi giữ precision cho phép nhân số suất; chỉ làm tròn quantity cuối đến 6 chữ số, không làm tròn rate nhỏ về 0 trước phép nhân. Đây là read projection, không sửa frozen requirement/contributor. Consumer xuất thêm phải phân biệt đang tải, thành công không có món và lỗi định lượng; lỗi phải hiển thị lý do/thử lại, vẫn cho phép chọn trực tiếp frozen ingredient. Không tính xuất theo món từ dữ liệu lỗi hoặc cache của batch khác.
- Mỗi lần xuất thêm tạo `InventoryIssue` mới với cùng batch/frozen-line lineage. Không sửa issue trước, không tạo frozen material row mới và không cho ingredient ngoài lô.
- Một ingredient có thể có nhiều supplemental issue; history/audit/stock movement của từng giao dịch phải giữ append-only và hiển thị được.
- Lifecycle transition của initial và supplemental issue cùng batch phải dùng aggregate sequence tăng theo batch version; không được tái dùng sequence `1`, vì unique lifecycle fence sẽ biến lần xuất thêm hợp lệ thành lỗi 500.

### 8. Authority số đã xuất và đối chiếu

- `IssuedQuantity` chỉ được suy ra từ tổng mọi linked `InventoryIssueLine` của frozen line **trừ confirmed returns**. Legacy `ReconciliationActual` với `Side == ISSUED` chỉ giữ audit compatibility, không có authority.
- Public legacy mutation `PUT /api/reconciliation/lines/{lineId}/purchased|issued` đã ngừng hỗ trợ và phải trả `410 Gone`; không được tái xuất FE mutation hook/drawer cho hai đường này. Dữ liệu actual/revision cũ vẫn được giữ để đọc và audit.
- Missing linked issue dictionary entry nghĩa là `null/chưa xuất`, không phải decimal 0. Trước initial issue, reconciliation hiển thị `Chưa xuất`, không mở disposition và không giả vờ đã có giao dịch.
- Reconciliation so sánh frozen `RequiredQuantity` với ledger-derived total issued; cùng ingredient xuất thêm phải aggregate vào đúng reconciliation row.
- Under/over tạo variance thật. Disposition chỉ được mở khi batch `IN_PROGRESS`, có linked issue và line cần xử lý; category/value hiển thị tiếng Việt, không raw enum/UUID/version/fingerprint.
- Issue notes, supplemental reasons và over-issue reasons phải xuất hiện trong detail/change history. Completion chỉ được phép khi mọi line đã match hoặc có disposition hợp lệ; reload/deep-link giữ cùng batch và state.

### 9. Quyền, concurrency, audit và dữ liệu

- Mode không cấp quyền. Admin Data mutation vẫn cần Admin authority; issue/supplemental cần Warehouse authority; readiness/transfer dùng owner được định nghĩa; reconciliation disposition/completion dùng quyền tương ứng.
- Trong MRX, Admin Audit mặc định lọc `sourceFamily=MATERIAL_RECONCILIATION`; Admin có thể chủ động chọn `ALL`. Bảng và CSV dùng cùng scope, scope được giữ trong URL; giá trị thiếu/không hợp lệ fail-closed về MRX.
- Customer data scope hiện là intentional-global cho actor có `ReportAccess/report.read`; không suy hoặc thêm customer restriction khi chưa có claim/assignment authority chính thức.
- Mode/version và aggregate expected version phải recheck trong transaction trước durable write. Stale tab, stale batch, concurrent/double submit và wrong mode phải fail closed, không duplicate issue/movement/audit/idempotency.
- Mỗi committed `QuantityImportBatchId` chỉ có một reconciliation batch canonical. DB unique constraint là authority; retry cùng command trả canonical prior result, command khác cho source đã dùng phải conflict; muốn đối chiếu lại cần committed import authority mới. Supplemental dùng command identity mới cho từng giao dịch.
- Không hard-delete valid issue, issue line, stock movement, return, audit, contributor hoặc reconciliation history. Không reshape retained/protected batch và không fabricate evidence.

### 10. Evidence và quy tắc thực thi

- Full acceptance phải đi qua public UI/API từ import/select menu → corrections → servings → missing-BOM recovery → preview → commit → READY → transfer → initial manual issue → optional supplemental → reconciliation/disposition → completion/reload.
- E2E phải đối chiếu đồng thời DOM/browser state, request/response, backend state, DB transitions, lineage, stock movement và render sau reload. Screenshot một mình không phải PASS oracle.
- Disposable fixture chỉ được bootstrap declared master/start stock; hành vi từ menu import trở đi phải dùng public seams. Protected data không reset/seed/direct-write.
- Current Phase 34 disposable lifecycle evidence: `.artifacts/shipyard-live/material-reconciliation-full-e2e/runs/20260909-224848/full/`, 49/49 headed browser/API lifecycle PASS, final batch `COMPLETED`, 84 frozen lines, 494 contributors, 2 issues/85 issue lines and movements, one confirmed return, supplemental and exact-return disposition invalidation PASS. Database: `ipc_mrx_full_e2e_phase34_20260909224848_f`; `ipc_lane9` was not referenced or mutated.
