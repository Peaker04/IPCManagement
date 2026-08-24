# Ma trận phạm vi dữ liệu ngày, tuần và chứng từ

Tài liệu này là contract chung cho backend, frontend, export và E2E khi hiển thị nguyên liệu. Mục tiêu là phân biệt dòng lặp hợp lệ với duplicate thật và ngăn cộng hai lần tồn kho.

## Khóa nghiệp vụ chuẩn

| Loại dữ liệu | Grain bắt buộc | Quy tắc hiển thị |
|---|---|---|
| Nhu cầu vận hành theo ngày | `serviceDate + customerId + priceTierAmount + ingredientId + unitId` | Có cột Ngày khi xem nhiều ngày. Nhiều món/BOM source-line có thể đóng góp vào một dòng tổng ngày; nguồn món vẫn phải xem được. |
| Tổng BOM dự kiến cả tuần | `weekStartDate + customerId + priceTierAmount + ingredientId + unitId` | Phải ghi rõ “tổng BOM cả tuần”; không được gọi là tồn/thiếu theo ngày. |
| Tồn kho hiện tại | `warehouseId + ingredientId` với `unitId` lưu trên snapshot | Một snapshot tại thời điểm hiện tại, không cộng lại stock movement để render cùng bảng. |
| Stock snapshot theo kỳ | `period + warehouseId + ingredientId + unitId` | Có kỳ snapshot; không trộn với tồn hiện tại. |
| Chứng từ | `documentId + sourceLineId` | Giữ từng dòng nguồn để thao tác, nhận hàng, ký nhận, trả hàng và audit. UI có thể thêm một dòng tổng trình bày theo `ingredientId + unitId`, nhưng phải mở lại được từng source-line. |
| Bút toán kho | `movementId` | Mỗi nhập/xuất/trả/điều chỉnh là một audit event. Không deduplicate vì cùng tên nguyên liệu hoặc cùng chứng từ. |
| BOM món | `dishId + customer scope + priceTierAmount + effective range + bomLineId` | Phân tích theo một suất và ngày hiệu lực. Không gộp hai ingredient ID chỉ vì tên giống nhau. |
| Danh mục nguyên liệu | `ingredientId` | Tên trùng là vấn đề data quality cần merge/deactivate có duyệt, không phải lý do gộp tự động trên FE. |

## Bất biến kho vận hành

`IsOperationalActive` chỉ định kho vận hành hiện hành; nó không thay đổi grain. `warehouseId` vẫn là thành phần bắt buộc của tồn hiện tại, lot, snapshot, chứng từ, stock movement, purchasing compatibility, authorization, audit và lineage. Hàng kho lịch sử/inactive cùng mọi FK vẫn giữ nguyên ID; không được merge, reassign, cộng dồn stock hoặc physically delete vì giao diện chỉ còn một kho vận hành.

`OperationalSingletonKey` là discriminator nullable do MySQL sinh từ `CASE WHEN IsOperationalActive THEN 1 ELSE NULL END`; application/API không được ghi nó. Unique index chỉ khóa at-most-one active. Việc chuyển một hàng sang active là mutation được ủy quyền riêng theo `DEPLOYMENT.md`, không phải startup repair hay bước tự động của migration. Zero active trước checkpoint là trạng thái fail-closed có chủ đích; không được tự chọn fallback.

## Phân loại các màn hình

| Khu vực / bảng | Phạm vi | Grain hiển thị hoặc thao tác | Dấu hiệu bắt buộc trên UI |
|---|---|---|---|
| Kế hoạch tuần · Kế hoạch tuần | Tuần | Ngày + ca + vị trí món | Header ngày của tuần; khách hàng và tier ở context. |
| Kế hoạch tuần · Nhu cầu | Một ngày đang chọn | Nhu cầu ngày theo khách hàng/tier/nguyên liệu/đơn vị | Caption “trong ngày đang xem”; KHSX nguồn ghi ngày và ca. |
| Kế hoạch tuần · Tổng hợp mua | Tuần, chi tiết theo ngày | Một dòng ngày–khách hàng–tier–nguyên liệu–đơn vị | Có cột Ngày và caption grain đầy đủ. Fallback trước khi tính tồn phải ghi “tổng BOM cả tuần”. |
| Kế hoạch tuần · Giá vốn | Tuần | Dòng món trong tuần | Context khách hàng, tuần và tier; không dùng làm số tồn. |
| Kế hoạch tuần · Nguyên liệu món | Một món / một suất / ngày hiệu lực | BOM line theo ingredient ID và unit ID | Hiển thị ngày áp dụng BOM và “một khay”. |
| Thu mua · Xử lý thu mua | Tuần để điều hướng, một ngày để thao tác | Nhóm trình bày `ingredientId + unitId` trong ngày; action theo `purchaseRequestLineId` | Bắt buộc chọn ngày; dòng tổng mở được mọi dòng nguồn. |
| Thu mua · Báo giá | Danh mục theo khoảng hiệu lực | Ingredient + supplier + unit + effective range | Không diễn giải là nhu cầu ngày hoặc tuần. |
| Kho · Tồn hiện tại | Hiện tại | Warehouse + ingredient snapshot | Title/caption ghi “tồn kho hiện tại”. |
| Kho · Nhu cầu xuất | Ngày/chứng từ | Material request / issue source-line | Hiển thị ngày, phiếu và source-line; không cộng chéo chứng từ. |
| Kho · Đơn mua/nhập kho | Chứng từ | Purchase order line | Có mã đơn; nhóm trình bày mở được từng `purchaseOrderLineId`. |
| Kho · Luân chuyển | Khoảng ngày / audit | Một stock movement event | Có thời gian, loại bút toán, chứng từ và kho. |
| Bếp · Ca sản xuất | Một ngày + ca | Món và nguyên liệu của ca | Context ngày/ca; không cộng xuyên ngày. |
| Bếp · Checklist nhận | Một ngày + ca | Nhóm trình bày ingredient + unit; action theo inventory issue line | Hiển thị số phiếu/dòng nguồn và dialog xác nhận đúng phiếu. |
| Bếp · Trả/dư/thiếu | Một ngày + ca + chứng từ | Return/supplemental source-line | Giữ issue ID, ingredient ID và unit ID. |
| Báo cáo · Nhu cầu | Khoảng ngày, dòng theo ngày | Grain nhu cầu vận hành chuẩn | Có cột Ngày. |
| Báo cáo · Kế hoạch mua | Người dùng chọn Ngày hoặc Tuần | Grain tương ứng lựa chọn + ingredient + unit | Cột Kỳ và control “Theo ngày / Theo tuần”. |
| Báo cáo · Tồn hiện tại | Hiện tại | Warehouse + ingredient snapshot | Không có phép cộng xuyên ngày. |
| Báo cáo · Biến động kho | Khoảng ngày / audit | Movement ID | Không deduplicate dòng lặp cùng nguyên liệu. |
| Báo cáo · Xuất bếp / sử dụng | Ngày + ca + issue | Issue + ingredient + unit | Có phiếu xuất, ngày và ca. |
| Admin · Nguyên liệu | Master | Ingredient ID | Tên trùng được cảnh báo data quality. |
| Admin · BOM | Master có hiệu lực | Dish + scope + tier + date range + BOM line | Search/filter không thay đổi grain. |

## Quy tắc chống double-count

1. Không dùng tên nguyên liệu làm khóa cộng hoặc khóa React.
2. Không cộng `CurrentStockQty` lặp lại trên từng BOM line. Nếu backend phân bổ tồn cho từng dòng thì aggregate dùng `Sum`; nếu backend trả snapshot lặp thì phải chuẩn hóa contract trước, không đoán bằng `Max` trên FE.
3. Không cộng snapshot tồn hiện tại với tổng stock movement trong cùng phép tính. Movement chỉ dùng để reconcile snapshot.
4. Không xóa dòng chứng từ hoặc bút toán vì trông giống nhau. Duplicate thật phải trùng source-line ID hoặc vi phạm unique key của đúng grain.
5. Mọi bảng tuần chứa dòng ngày phải có cột ngày. Chỉ được bỏ cột ngày khi caption ghi rõ đây là tổng cả tuần.
6. Mọi dòng tổng trình bày có action phải drill down về source-line ID; mutation không được gửi ID của nhóm tổng.

## Gate kiểm chứng

- Unit/API test khóa key và phép cộng ở từng grain.
- Source-contract test khóa title, caption, cột ngày và khả năng mở dòng nguồn.
- Browser gate kiểm tra cùng dữ liệu trên ma trận viewport khai trong `MEMORY.md`, không overflow/tab wrap/layout shift.
- E2E đối chiếu FE control → API request/response → DB transition → FE reload.
- Dữ liệu regression “Bột nở” và artifact authoritative được định danh trong `docs/EVIDENCE-INDEX.md`; không copy số đo vào contract này.
