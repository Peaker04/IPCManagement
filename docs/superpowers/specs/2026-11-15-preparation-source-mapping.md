# Chuẩn hóa nhóm chuẩn bị từ nguồn raw — hợp đồng triển khai

Ngày: 2026-11-15. Phương án A đã được người dùng duyệt: đối soát nguồn, kiểm tra toàn bộ danh mục và chỉ trình quy tắc cùng ngoại lệ. Giữ phương thức thực hiện native. Tài liệu này cụ thể hóa phần dữ liệu của AC-03 trong `2026-11-15-mrx-workbook-acceptance.md`; không thay thế các cổng Excel/runtime đã có.

## 1. Mục tiêu và phạm vi được duyệt

FR-CAT, FR-PUR, FR-WH/FR-RECON. Kho cần nhóm hàng để chuẩn bị, thu mua cần giữ đúng NCC và hiệu lực cung ứng, quản trị cần duy trì danh mục nhất quán. Không bắt người dùng đọc lại 773 dòng nếu có thể đối soát bằng nguồn.

Được thực hiện: đọc nguồn private và database `ipcmanagement` ở chế độ read-only; xây báo cáo đối soát/quy tắc/ngoại lệ; triển khai kiểm định và sửa đúng owner liên quan; diễn tập mapping đã xác định trên clone bằng quy trình hiện có. Các đề xuất chưa rõ nghĩa không trở thành dữ liệu thật chỉ vì thiết kế đã được duyệt.

Không suy ra quyền commit/push/deploy, gộp hoặc xóa NCC, sửa chứng từ, giá, tồn kho, đơn vị hay BOM. Áp dụng vào database nguồn chỉ sau khi có mapping cụ thể, số dòng ảnh hưởng và bằng chứng clone/rollback. Những phần không liên quan giữ nguyên.

## 2. Baseline kiểm chứng được

Nguồn và giới hạn của số liệu nằm trong `2026-11-15-preparation-raw-source-review.md`:

- Raw đặt hàng: SHA256 `4a91f9ea847068abeb147eff7ed7401b029d698f73e495641099dd9fa552bc88`, 34 sheet; SUMMARY có 31 ánh xạ, thêm sheet Vịt a Việt.
- Raw BOM: SHA256 `a1459b87292514adff234c6ec8258b7ff54f68319a96533b0ba489e0b57bf403`, 3 sheet định lượng trong 6 sheet.
- NGUỒN: 28 cột có tiêu đề, 575 mục; danh mục database: 773 nguyên liệu tại thời điểm inventory.
- Tìm thấy tên trực tiếp: 765/773; 711 có trong sheet đặt hàng, 222 có trong BOM; chưa kiểm định đây là cùng định danh/đơn vị/quy cách. 639 tên ở một NCC đặt hàng, 72 tên ở nhiều NCC đặt hàng sau chuẩn hóa hoa–thường/khoảng trắng.
- Hai layout Chuối/Đá thiếu cột Tên hàng. Không gọi số dòng đọc được là số giao dịch hợp lệ. Không gọi 8 tên chưa khớp là toàn bộ số ngoại lệ.

Không cố định 773 làm mục tiêu PASS khi database thay đổi. Mỗi lượt lấy snapshot mới, ghi thời điểm/phạm vi/hash; mọi nguyên liệu trong snapshot phải có đúng một kết quả, kể cả inactive và chưa rõ.

## 3. Bốn khái niệm phải độc lập

1. Định danh nguyên liệu: IngredientId/IngredientCode, tên và canonical UnitId. Không gộp theo tên bỏ dấu hoặc đổi đơn vị để làm khớp.
2. Định danh NCC: SupplierId/SupplierCode; tên/alias nguồn chỉ là bằng chứng tìm kiếm. Cùng tên khác ID có thể là trùng hoặc hai pháp nhân khác nhau.
3. Quan hệ cung ứng: liên kết/báo giá có hiệu lực theo nguyên liệu/ngày. Một nguyên liệu có thể có nhiều NCC; không chọn dòng đầu, NCC cuối cùng trong file hoặc giá thấp nhất làm mặc định.
4. Nhóm chuẩn bị: một PreparationGroupCode chính cho mỗi IngredientId. Không thay thế NCC thật bằng tên nhóm và không nhân dòng lượng cần theo số NCC.

Mã nhóm từ `Helpers/PreparationSupplyGroups.cs`: PRODUCE, FRESH_MEAT, FRESH_SEAFOOD, FROZEN, SEASONING, RICE, NOODLES, EGGS, DAIRY, BAKERY, BEVERAGES, PACKAGING, ICE, OTHER, UNCLASSIFIED. Cập nhật theo câu trả lời người dùng trong lúc triển khai: tách riêng Gạo; Bún, mỳ & phở; Trứng; Sữa & chế phẩm; Bánh; Nước giải khát; Bao bì; Nước đá, không gom các nhóm này vào Khác. Người dùng yêu cầu research từng nguyên liệu của ba NCC ĐL, không xác nhận mọi hàng của họ là đông lạnh. Quy tắc đã duyệt: ưu tiên FROZEN khi đã xác nhận đông lạnh; cá/tôm tươi vào FRESH_SEAFOOD. Không dùng OTHER để che thiếu bằng chứng.

## 4. Hợp đồng bằng chứng và đối soát

MAP-01 — Đọc đủ nguồn. Lập inventory tất cả sheet/tiêu đề; phân biệt supplier table, NGUỒN membership, SUMMARY alias, BOM label, special layout, non-data và unsupported. Với special layout, phải có quy tắc xác định mặt hàng được duyệt; không tự suy ra Chuối = nguyên liệu Chuối cụ thể hoặc Đá = một loại đá cụ thể chỉ từ tên sheet.

MAP-02 — Lineage không mất. Mỗi evidence giữ sourceHash, workbook logical name, sheet, physical row, column hoặc header, raw name/unit/supplier label, source kind; merge-cell evidence ghi ô gốc và vùng gộp. Chỉ lan giá trị theo vùng merge thật, không forward-fill ô trống không giới hạn. Báo cáo không chứa giá, điện thoại, thanh toán, credentials hoặc nội dung file cấu hình.

MAP-03 — Không biến candidate thành identity. Khớp Unicode NFC/hoa–thường/khoảng trắng chỉ tạo candidate. Alias sử dụng theo owner `PurchaseHistoryNormalizationPolicy` và ánh xạ đã có bằng chứng. Giữ dấu tiếng Việt và thông số size/loại/quy cách. Fuzzy match chỉ được gợi ý, không tự chấp nhận; nhiều candidate ID thì giữ conflict.

MAP-04 — Đơn vị riêng. Giữ raw unit và canonical unit, nhận diện alias đã được xác nhận; kg/g chỉ chuyển khi quan hệ và hệ số hiện hành chứng minh được. Hộp/gói, bịch/kg, quả/kg, miếng/kg không tương đương nếu thiếu quy cách có hiệu lực. Group mapping không được sửa UnitId, ConvertRateToBase hay số lượng.

MAP-05 — Nguồn có thể mâu thuẫn. SUMMARY cho biết sheet→nhãn NCC; NGUỒN cho biết danh sách khai báo, không chứng minh đã mua; order row hợp lệ cho biết giao dịch tại ngày; BOM Supplier thường chỉ là nhãn nhóm. Giữ các nguồn song song và lý do đồng thuận/mâu thuẫn, không áp một thứ tự ưu tiên để âm thầm xóa bằng chứng khác. Gạo→NL Rau không đủ để gán PRODUCE; Sả→NL tươi sống không đủ để gán FRESH_MEAT.

Ruling từ nghiên cứu thực tế: ba nhãn BOM chỉ là NL Rau/NL rau/NL tươi sống, còn NCC đặt hàng là đối tác khác namespace. Giữ SOURCE_LABEL_DISAGREEMENT trong evidenceNotes; không coi sự khác nhau này là lỗi định danh NCC buộc người dùng xác nhận lại 168 nguyên liệu. Không tạo rule nhóm từ BOM_LABEL. Blockers thực sự về identity/unit/preservation hoặc mâu thuẫn giữa các rule có nghĩa vẫn giữ nguyên.

MAP-06 — Ngày và tính hợp lệ. Phân biệt declaration, candidate row và accepted transaction. Dùng parser hiện có để kiểm định giao dịch, ngày, quantity và unit normalization; không coi raw name row là receipt. Không dùng `PurchaseHistorySourceParser.Supersede` để rút gọn bằng chứng nhóm: khóa ngày+tên và Last() có thể làm mất nguồn NCC khác. Không thay audited purchase-history baseline 17,739 bằng số dòng phát hiện của báo cáo.

MAP-07 — Quy tắc nhóm có phạm vi. Mỗi rule có ruleId/version, nguồn/cột hoặc selector IngredientId cụ thể, group đề xuất, căn cứ bảo quản nếu cần, danh sách ngoại lệ, trạng thái proposed/confirmed và lý do. Nhãn ĐL không tự được giải nghĩa thành đông lạnh. NCC tổng hợp/chay/tạp hóa cần rà theo mặt hàng. Một nguồn có nhiều nhóm hợp lệ thì không dùng rule áp cả cột.

MAP-08 — Kết quả và blockers độc lập. Mỗi nguyên liệu có recommendationState: SUPPORTED, CONFLICT, MISSING_EVIDENCE hoặc UNSUPPORTED_LAYOUT; proposedGroupCode có thể null; reviewState: PENDING hoặc CONFIRMED. Mảng blocker giữ cả identity, unit, supplier và preservation vấn đề; không ép vào một cột trạng thái duy nhất. SUPPORTED chỉ có nghĩa các bằng chứng đáp ứng rule, không tự là CONFIRMED. Lỗi đơn vị/NCC không được làm mất nguyên liệu khỏi bảng.

MAP-09 — Coverage bảo toàn. Tập kết quả bằng đúng tập IngredientId snapshot, không thiếu/trùng; thống kê theo trạng thái, nhóm, blockers và nguồn. Ngoại lệ được gom theo vấn đề để người dùng duyệt quy tắc một lần; bảng đầy đủ vẫn có để truy vết. Không hứa rằng mọi nguyên liệu nhiều NCC đều là lỗi hoặc rằng 8 unmatched là số ca cần duyệt.

## 5. Quy tắc khởi đầu để đưa ra duyệt

Đây là giả thuyết từ nguồn, không phải assignment được phép apply:

| Nguồn/nhãn | Định hướng | Điều kiện và ngoại lệ bắt buộc |
| --- | --- | --- |
| Rau; Trái cây | PRODUCE | Kiểm mặt hàng, biến thể chế biến/bảo quản và nguồn mâu thuẫn |
| Gia vị | SEASONING | NCC có cả hàng ngoài gia vị; kiểm đơn vị/quy cách riêng |
| Thịt tươi | FRESH_MEAT | Xác nhận mặt hàng thịt, tươi; rau/gia vị đi kèm không theo nhóm thịt |
| Cá; Tôm; Mực | FRESH_SEAFOOD hoặc FROZEN | Phải xác nhận trạng thái bảo quản, ưu tiên FROZEN khi đủ bằng chứng |
| ĐL Thúy/Tuyến Tâm/Sáng Ngọc | Chưa chốt | Xác nhận nghĩa ĐL và từng loại hàng; không suy đoán từ chữ viết tắt |
| Chay; Tạp hóa; Hồng Duy | Theo từng mặt hàng | Không áp một nhóm cho cả NCC |
| Gạo | RICE | Kiểm mặt hàng, không áp theo nhãn BOM NL Rau |
| Bún; Mỳ/phở | NOODLES | Kiểm mặt hàng; nhóm này không xác nhận bảo quản tươi/khô |
| Trứng; Sữa; Bánh; Nước giải khát; Bao bì; Đá | EGGS; DAIRY; BAKERY; BEVERAGES; PACKAGING; ICE tương ứng | Người dùng duyệt tách nhóm; NCC hỗn hợp vẫn cần ngoại lệ theo mặt hàng, không đổi NCC thật |

## 6. Manifest và áp dụng giới hạn

MAP-10 — Preview deterministic. Snapshot chứa ID/code/name/unit/active/currentGroup và supplier/quotation evidence cần thiết; fingerprint có thứ tự ổn định, không chứa secret. Manifest chứa source hashes, snapshot hash, ruleVersion/hash, exact per-ID before/after, evidence refs, reviewer decision references và mapping hash. Cùng input cho cùng semantic output/hash; timestamp nằm ngoài nội dung hash.

MAP-11 — Fail closed. Chỉ apply dòng CONFIRMED, group hợp lệ, không thay định danh/đơn vị, không còn blocker liên quan tới assignment. Khác file hash/snapshot/rule/mapping, tên trùng nhiều ID, trước khi apply bị người khác đổi dữ liệu thì từ chối lượt apply và preview lại. Không biến một phần lỗi thành thành công toàn bộ.

MAP-12 — Clone trước. Dùng clone chính xác của snapshot qua runner hiện có; ghi target identity và run ownership. Dry-run không ghi; apply trong transaction chỉ đổi PreparationGroupCode của exact IDs và lưu receipt/before-image trong vùng private. Apply lặp lại cùng mapping không tạo thêm thay đổi; rollback chỉ hoàn nguyên đúng các giá trị do lượt đó thay và phải từ chối ghi đè thay đổi phát sinh sau đó. Không DROP column để rollback mapping.

MAP-13 — Không lan sai. Tên/code/ID/UnitId, BOM lines/quantities/prices, quotation/PO/receipt references, stock/movements, MRX frozen source/demand/servings/approvals không đổi trước/sau. Chỉ grouping/order/presentation và group field được thay. Master data chung không làm hợp nhất DEFAULT và MATERIAL_RECONCILIATION. Nếu group hiển thị lấy master hiện hành, phải nói rõ đó là nhãn hiện hành, không tuyên bố là nhóm đã đóng băng trong snapshot cũ.

MAP-14 — Giữ dữ liệu đã xác nhận qua các đường vào. Create/edit hợp lệ, API reject group lạ; thiếu group trên update giữ nguyên; import lại giữ assignment cũ, nguyên liệu mới chưa có căn cứ để UNCLASSIFIED. BOM Supplier không được tạo quotation giả. Các đường import có sẵn phải được liệt kê và kiểm tra, không sửa một đường rồi coi toàn hệ thống đạt.

MAP-15 — Export không đổi ý nghĩa. Giữ hai sheet và legacy path; cộng đúng allocation theo IngredientId/canonical UnitId/exact batch scope. Một nguyên liệu nhiều NCC không nhân tổng; cùng tên khác ID không gộp; đổi NCC trong tuần không đếm lượng hai lần. Missing/ambiguous/inactive/expired/future quotations vẫn phân biệt. Không thay actual supplier bằng nhóm đã chuẩn hóa.

## 7. Coverage và bằng chứng bắt buộc

| Case | Oracle / kết quả | Task plan |
| --- | --- | --- |
| Đổi hash, unsupported sheet, special layout thiếu tên | Inventory đầy đủ, không silent skip/apply | 1 |
| SUMMARY/NGUỒN/BOM/order disagree; merged blank | Giữ lineage và conflict, không forward-fill bừa | 1–2 |
| HOA/thường/NFC/NFD; dấu/size/loại khác; duplicate IDs | Candidate đúng; không auto gộp | 2 |
| Hộp/gói, kg/g, bịch/kg, thiếu package, unit conversion đã có | Block hoặc chuyển theo đúng rule; không đổi canonical unit | 2 |
| Gạo NL Rau; Sả NL tươi sống; đông lạnh/chay/tạp hóa | Không phân nhóm theo supplier label đơn lẻ | 2–3 |
| Active/inactive, nhiều NCC, tên trùng, ngày thay NCC | Identity giữ nguyên; conflicts không làm nhân lượng | 2, 5 |
| 773 hiện tại hoặc danh mục đã tăng; test-marked names | Mỗi ID một kết quả, không xóa loại trừ để đạt coverage | 3 |
| Manifest replay, tamper, stale snapshot, concurrent edit | Cùng input ổn định; reject stale/tamper; transaction rollback | 4 |
| Create/edit/import/reimport, unknown/omitted group | Giữ confirmed assignment; UNCLASSIFIED cho mới chưa rõ | 5 |
| Clone apply/rollback/reapply; failure giữa chừng | Exact affected IDs, invariants không đổi, cleanup receipt | 4, 6 |
| Day/week/customers/batches/units; current and legacy export | Totals/snapshot không đổi, group đúng, schema + Excel open | 5–6 |

Kiểm chứng thực hiện theo ipc-test-audit/code-review; UI chỉ khi cần đổi giao diện và phải qua impeccable + scoped pre-code gate + contract tests. Không thêm giao diện mới chỉ để hiển thị báo cáo một lần. Bằng chứng native Excel/schema cũ được giữ nhưng không thay cho workbook mới sau mapping.

## 8. Definition of done

Từng MAP-01…15 có PASS/FAIL/NEEDS_EVIDENCE/BLOCKED và đường dẫn bằng chứng. Có bảng quyết định nhỏ cho người dùng, full lineage private, mapping được review, clone receipts, đối soát totals/references và rollback/cleanup. Không đánh dấu whole-plan PASS khi còn nhóm chưa có căn cứ hoặc source apply chưa được nghiệm thu. WORK là owner trạng thái duy nhất; tài liệu này là hợp đồng, không là trạng thái runtime.
