# MRX — Bù thiếu và nhu cầu suất phát sinh sau khóa ngày

## Phạm vi và trạng thái

Thiết kế cho FR-WH, FR-RECON, FR-CHEF, FR-MENU và quyền duyệt liên quan FR-APPR. Người dùng chọn phương án B và xác nhận Quản lý hoặc Admin duyệt nhu cầu, Thủ kho ghi lượng thực xuất. Đây là bản thiết kế để duyệt trước triển khai.

Mục tiêu là thực hiện xuất cả nhóm nguyên liệu của món cho suất tăng, bù thiếu đúng lượng và truy vết được tới nhu cầu đã duyệt. Giữ khóa món, số suất và định lượng gốc sau phiếu đầu tiên. DOM-MODE-1 áp dụng cho mọi query, command, audit, export và cache.

## Căn cứ codebase

- `docs/domain/material-reconciliation.md` quy định ngày có phiếu bị khóa sửa nguồn, supplemental chỉ sau initial issue khi lô IN_PROGRESS, MRX không ghi tồn vật lý.
- `MrxSupplementalIssueModal.tsx` hiện gửi nguyên liệu và lý do chữ; `DailyLineOption` chưa đưa nhu cầu và lượng còn thiếu vào giao diện.
- `useMrxDailyWorkspace.ts` gửi version, commandId và dòng ngày qua `/api/inventory-issues`.
- `ReconciliationBatchQueryProjector.ListDishesAsync` cung cấp món, phạm vi ngày/ca và rate quy đổi; có thể trả rate thiếu hoặc chặn lineage mâu thuẫn.
- `FrozenBomQuantityPolicy` yêu cầu bằng chứng quy đổi đã đóng băng và làm tròn quantity cuối tới 6 chữ số.
- `ReconciliationKitchenExportService` đọc suất đã đóng băng; chưa có nguồn nhu cầu suất tăng có cấu trúc.
- `ReconciliationCompletionService` kiểm tra WEEK_COMPLETE từ projection ngày.
- G3 E2E hiện chứng minh bù một lượng thiếu nhập tay rồi reload; chưa chứng minh UI gợi lượng thiếu hoặc nhu cầu suất tăng được duyệt rồi truyền qua Bếp và đối soát.

## Các phương án đã xét

A thêm thông tin thiếu cho một nguyên liệu trong modal hiện tại. B thêm bù nhiều dòng và chứng từ nhu cầu phát sinh liên kết phiếu thực xuất. Người dùng chọn B và chốt quyền duyệt riêng. Việc chỉ thêm số suất vào lý do phiếu không cung cấp định danh hoặc trạng thái để Bếp và đối soát cùng đọc.

## Quyết định và đề xuất phạm vi

Các quyết định đã chốt gồm phương án B, khóa nguồn gốc sau xuất và quyền duyệt của Quản lý/Admin. Các lựa chọn dưới đây là đề xuất của bản thiết kế, cần được xem cùng khi duyệt spec.

- Bản đầu hỗ trợ món đã có trên đúng lô/ngày/ca/loại suất và nguyên liệu đã có trong frozen daily lineage. Món hoặc nguyên liệu ngoài phạm vi cần một thiết kế mở rộng có duyệt riêng.
- Thủ kho lập yêu cầu từ modal. Quản lý/Admin duyệt hoặc từ chối tại `/reconciliation?view=supplemental`, thuộc nhóm đối soát MRX. Đây là đích mới cần đăng ký route leaf/capability rõ ràng. Quản lý không phải mở route Kho để duyệt.
- Mỗi yêu cầu thuộc một lô và một ngày, có một hoặc nhiều món và số suất tăng nguyên dương theo ca/loại suất. Quyền hiện có của Điều phối không tự được mở rộng sang màn này.
- Bù thiếu gốc thuộc quyền xuất kho hiện tại. Nhu cầu tăng suất phải duyệt. Xuất thêm cho hao hụt/hỏng giữ luồng trực tiếp với lý do và được đối soát như chênh lệch theo hợp đồng hiện hành.
- Yêu cầu có lần cấp thực xuất chưa được hủy hoặc giảm số suất bằng thao tác ghi đè. Bản đầu hướng dẫn tạo hồ sơ xử lý có liên kết với Quản lý; luồng hoàn trả hoặc giảm nhu cầu sau cấp chưa thuộc phạm vi triển khai này.

## Yêu cầu nghiệp vụ

### SD-01 — Khóa và phân quyền

Mọi write giữ DEFAULT và MRX tách biệt. Thủ kho tạo/gửi yêu cầu và ghi phiếu thực xuất sau duyệt. Quản lý/Admin xác nhận hoặc từ chối nhu cầu. Quyền Admin duyệt nhu cầu không tự cấp quyền thực xuất. Actor, quyền và version được kiểm tra lại tại server. Không thêm cơ chế tự duyệt ngoài các quy tắc phê duyệt áp dụng hiện có.

Ngày có initial issue vẫn khóa sửa món/suất gốc. Nhu cầu phát sinh chỉ được tạo trên lô IN_PROGRESS và ngày đã có initial issue. Lô COMPLETED chỉ đọc. Việc đóng lô và duyệt/ghi supplemental phải có kiểm soát đồng thời theo cùng aggregate.

### SD-02 — Nhu cầu phát sinh và trạng thái

Nhu cầu có mã, batchId, serviceDate, requester/time/reason, version và command receipt. Dòng món có dishId, shiftName, menuVariant, extraServings cùng định danh nguồn đóng băng và snapshot món/BOM/quy đổi. Tổng nguyên liệu phát sinh có định danh liên kết với từng dòng món.

Luồng quyết định `DRAFT → PENDING_REVIEW → APPROVED | REJECTED`. Hủy yêu cầu chưa cấp chuyển `CANCELLED`, giữ actor/time/reason. Quyết định duyệt và tiến độ cấp là hai chiều trạng thái. Yêu cầu APPROVED có `Chưa cấp`, `Cấp một phần`, `Đã cấp đủ`, hoặc `Cấp vượt cần xử lý` theo từng nguyên liệu và toàn yêu cầu.

Chỉ DRAFT được sửa. Khi gửi, server chụp định mức từ lineage có đủ bằng chứng. Duyệt xác nhận đúng snapshot và version đó. Sau từ chối, tạo yêu cầu mới có liên kết tới hồ sơ trước nếu cần thay đổi và gửi lại. Lý do từ chối/hủy bắt buộc.

### SD-03 — Tính cả nhóm trên server

Chọn món phải kèm ca và loại suất, vì cùng món có thể xuất hiện nhiều lần trong ngày. Tất cả dòng món của yêu cầu được tính và gộp theo exact frozen daily line và canonical unit. Giữ phần đóng góp của mỗi món để truy vết, kể cả khi nhiều món dùng cùng nguyên liệu.

Server tính lượng từ BOM/rate đóng băng theo policy đang dùng; precision trung gian được giữ, chỉ lượng cuối theo daily line làm tròn AwayFromZero đến 6 chữ số. Kiểm tra số suất nguyên dương, overflow, dòng trùng và ánh xạ. Chặn thiếu rate, null/zero rate hoặc BOM/contributor không thống nhất, và trả lỗi cụ thể theo nguyên liệu/ngữ cảnh. Không suy rate ngược từ tổng đã làm tròn hoặc BOM hiện hành để điền thiếu bằng chứng lịch sử.

Snapshot thiếu không mở chức năng xuất trọn món. Bù thiếu gốc vẫn thực hiện được khi frozen daily quantity hợp lệ. Giao diện phải chỉ rõ trường hợp chưa nhập số suất, lỗi tải và thiếu dữ liệu quy đổi bằng các trạng thái phù hợp.

### SD-04 — Authority lượng và phân bổ phiếu

Mỗi phiếu supplemental tiếp tục do Inventory owner ghi, liên kết exact batch/day/daily line. Bổ sung phân bổ giữa issue line và mục đích `BASELINE_SHORTAGE`, `APPROVED_EXTRA_DEMAND` hoặc `UNPLANNED_EXTRA`. Mỗi phân bổ phát sinh trỏ đúng dòng nhu cầu đã duyệt. Tổng phân bổ bằng thực xuất của issue line, một lượng chỉ được tính một lần.

Với mỗi daily line, gọi B là frozen baseline, E là tổng nhu cầu phát sinh đã duyệt còn hiệu lực, N là lượng xuất ròng theo ledger hiện có. Hệ thống đọc được B, E, N và `N − (B + E)` cho đối soát. Phân bổ duy trì riêng phần thiếu gốc và thiếu của từng yêu cầu; không bù chéo ngầm giữa hai mục đích hoặc hai khách/ngày/đơn vị.

Ví dụ B=10 kg, initial xuất 8 kg, nhu cầu tăng được duyệt 3 kg. Khi xuất 3 kg toàn bộ cho phát sinh, yêu cầu tăng đã đủ, gốc còn thiếu 2 kg; lô vẫn chưa đủ điều kiện chốt. Khi xuất thêm 2 kg bù gốc thì N=13 kg, B+E=13 kg, hai mục đích đều đủ.

Phiếu lịch sử chưa có phân bổ giữ nguyên và hiển thị `Chưa phân bổ mục đích` khi cần. Không phân loại tự động bằng lời ghi chú. Lô không có nhu cầu phát sinh tiếp tục dùng authority và completion hiện có. Với lô kết hợp hồ sơ mới và phiếu lịch sử chưa đủ phân bổ, server yêu cầu đối chiếu/phân bổ có audit trước khi xác nhận hoàn tất; không tự coi phần dư cũ là đã cấp cho yêu cầu mới. Lượng trả lịch sử được tính đúng net ledger và giữ cảnh báo phân bổ chưa đủ bằng chứng nếu thiếu quan hệ rõ ràng.

### SD-05 — Ghi phiếu, lặp và đồng thời

Preview ở FE chỉ để hiển thị. Server xác thực version lô, version nhu cầu duyệt và phần đã cấp khi ghi. Có thể xuất một phần hoặc nhiều lần. Đề nghị mặc định bằng phần còn phải cấp và luôn cho xem kết quả sau lần xuất. Lượng vượt được hiển thị rõ, yêu cầu lý do và được giữ là phần vượt, không tự mở rộng suất đã duyệt.

Phiếu, allocation, audit, lifecycle, batch version và idempotent receipt ghi trong cùng transaction. Replay cùng command trả đúng kết quả cũ. Hai lần cấp đồng thời vào cùng phạm vi phải kiểm tra lại lượng còn lại; request thua nhận conflict và tải lại, giữ nháp để người dùng xác nhận lại. Retry không tự gửi với version mới. Mất phản hồi sau commit mở chế độ kiểm tra kết quả theo command/receipt, chặn gửi command mới đến khi rõ kết quả. MRX không tác động currentstock/stockmovements/lots.

### SD-06 — Đồng bộ query và chứng từ

| Bề mặt | Thông tin phải hiển thị |
|---|---|
| Chuẩn bị lô đối soát | Suất gốc khóa và phần phát sinh đã duyệt theo ca/món, liên kết lịch sử chỉ đọc |
| Kho theo ngày | Thiếu gốc, nhu cầu phát sinh đã duyệt, đã cấp, còn thiếu và lượng lần này |
| Duyệt MRX | Người gửi, ngày/ca/món/loại suất, số suất tăng, snapshot nguyên liệu và lịch sử quyết định |
| Phiếu nấu của Bếp trưởng | Suất gốc và suất tăng đã duyệt, mã hồ sơ và thời điểm duyệt; không suy số suất đã nấu từ lượng Kho cấp |
| Đối soát và chốt lô | B/E/N, phần thiếu theo mục đích, phần vượt và điều kiện chốt thống nhất |
| Excel chuẩn bị và phiếu bếp | Phạm vi khách/ngày/tuần thống nhất với query; thêm phần phát sinh rõ nhãn và mã hồ sơ, giữ mẫu hai sheet đã duyệt |
| Lịch sử | Chuỗi request → approval → từng issue → allocation → completion, có actor/time/reason |

Request pending/rejected không cộng vào suất bếp hoặc định lượng phải cấp. Approved demand cập nhật query và cache ngay sau commit dù chưa xuất. Bếp chỉ đọc nhu cầu được phép, không lộ lượng thực xuất/sai lệch của Kho. Số thiếu/vượt không được cộng giữa kg, quả hoặc đơn vị khác. Read-model và export phải đọc cùng version/snapshot nhất quán.

### SD-07 — Kết thúc và điều chỉnh

Chốt yêu cầu baseline và mọi nhu cầu approved đã đủ cấp, các overage cần thiết có giải trình hợp lệ và không còn hồ sơ pending chưa xử lý. DRAFT chưa gửi không cộng vào nhu cầu, nhưng phải được hiển thị cho người chốt nhận biết. Phần đã cấp không được xóa/sửa mất lịch sử. Hủy pending/rejected hoặc approved chưa có cấp phải ghi quyết định và kiểm tra version. Nếu Bếp đã đọc nhu cầu approved rồi yêu cầu bị hủy, lần đọc mới phải thể hiện hủy và lịch sử tương ứng.

## Thiết kế FE theo Impeccable

Chế độ Operate, dùng `docs/DESIGN.md`, `docs/UI-KIT.md`, tokens ở `frontend/src/styles/index.css` và các primitive hiện có. Scoped Pre-Code UI Gate phải được xuất trước chỉnh TSX/CSS. D6/D7/T7/T8/M1.2/N6 áp dụng theo bề mặt. Giữ một modal chặn tại một thời điểm.

Kho có hai tác vụ chính `Bù phần còn thiếu` và `Suất phát sinh`. Tác vụ bù thiếu có bảng nguyên liệu, ĐVT, nhu cầu gốc, đã cấp cho gốc, còn thiếu, lượng lần này và thao tác điền đủ. Khi chọn Suất phát sinh, hiển thị yêu cầu và trạng thái duyệt. Nháp cho nhập ca/loại suất/món/số suất/lý do và nút Gửi duyệt. Hồ sơ đã duyệt cho xem định mức nguyên liệu và xác nhận thực xuất một phần hoặc đủ. Giữ luồng nhập trực tiếp cho tình huống kho hiện có.

Quản lý/Admin duyệt tại một leaf MRX trong nhóm Đối soát, danh sách ngắn và modal detail. Header/footer hành động thống nhất, badge có ngữ nghĩa và căn đúng cột. Người chỉ có quyền duyệt không thấy input thực xuất. Ba cảnh báo riêng cho chưa nhập số suất, thiếu căn cứ BOM và dữ liệu thay đổi.

6 states cần thiết gồm loading, empty, error, permission-denied, partial và write-reconciliation. Kiểm tra cả desktop 1440×900, tablet 960×720, viewport hẹp 600×480 và 200% zoom theo khả năng hỗ trợ của shell. Bảng rộng dùng sticky header/cột định danh, modal cuộn thân và giữ được nút thao tác. Screenshot fixture chỉ chứng minh giao diện, persistence phải có API/database evidence riêng.

## Ma trận nghiệm thu

| AC | Trường hợp và kết quả bắt buộc |
|---|---|
| 01 | Nhu cầu Bầu 8,77503, đã xuất 2 → còn thiếu 6,77503; điền đủ bù đúng lượng |
| 02 | Bù một phần rồi bù nốt, nhiều dòng/many issues; remaining và receipt đúng sau reload |
| 03 | Request tăng suất pending chỉ Quản lý/Admin quyết định; Thủ kho không tự gọi approve thành công |
| 04 | Approved snapshot xác định đúng khách/lô/ngày/ca/mặn-chay/món và nhóm nguyên liệu |
| 05 | Ví dụ B=10/E=3/đã xuất gốc8/phát sinh3 giữ thiếu gốc2, chặn chốt; cấp gốc2 thì đủ |
| 06 | Hai món dùng chung nguyên liệu gộp quantity một lần, giữ contribution cho từng món |
| 07 | Thiếu frozen conversion, ambiguous mapping, rate rất nhỏ, overflow, suất lẻ/0/âm đều có kết quả đúng |
| 08 | Ca/ngày khác, món ngoài nguồn, ingredient/unit sai, cross-customer, DEFAULT và COMPLETED bị chặn |
| 09 | Hai người cùng cấp/duyệt/hủy/chốt; loser không có phiếu hay allocation một phần |
| 10 | Mất phản hồi, double-click, replay cùng command và refresh không tạo phiếu trùng |
| 11 | Pending/rejected/cancelled không tăng suất bếp; approved chưa xuất đã xuất hiện là nhu cầu được duyệt |
| 12 | UI, CSV/XLSX, phiếu nấu, history, reports và completion cùng authority; giữ quyền từng vai trò |
| 13 | Phiếu cũ và return compatibility giữ tổng net, không phân bổ tự động bằng lý do chữ |
| 14 | 3 khách cùng tuần có nguyên liệu chung, bỏ chọn khách và phạm vi ngày/tuần không lẫn nhau |
| 15 | Frozen source fingerprint không đổi; stock/lots/movements không đổi; clone cleanup có bằng chứng |
| 16 | Migration upgrade trên clone dữ liệu cũ, schema validation và mở XLSX bằng Excel bình thường |

## Trạng thái triển khai

Chỉ tạo tài liệu. Các lựa chọn phạm vi và xử lý hồ sơ cũ ở trên cần được duyệt cùng spec. Triển khai theo plan cùng tên sau duyệt. Migration Production, commit/push/deploy là các thao tác riêng theo quyền hiện hành.
