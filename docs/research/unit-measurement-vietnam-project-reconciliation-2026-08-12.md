# Đối chiếu đơn vị đo Việt Nam với IPCManagement — 2026-08-12

## Phạm vi và trạng thái

Đây là research và audit **readonly**. Không sửa source, không cập nhật database,
không backfill, không seed/reset/import dữ liệu.

Nguồn dữ liệu nội bộ:

- `ipc_lane1` qua compiled read-only evidence query. Audit ngày 2026-08-10 đã xác nhận
  fingerprint unit giống `ipc_lane9` và `ipcmanagement`.
- `.docs/IPC. Định lượng 07.2026.xlsx`.
- Source hiện hành của backend/frontend và migration/schema.
- Audit canonical: `docs/research/database-current-state-audit-2026-08-10.md`.

## Kết luận ngắn

> Quyết định nghiệp vụ 2026-08-12: không force BOM từ
> `IPC. Định lượng 07.2026.xlsx` về số nguyên. Các quantity phân số trong BOM được
> giữ theo nguồn; cleanup chỉ áp dụng cho dữ liệu kho vật lý cũ. Các nhận định dưới
> đây về unit đếm là audit semantics/rủi ro lan truyền, không phải authority để round
> hoặc đổi unit BOM.

1. Dấu phẩy trong `0,3` **không phải dấu sai** khi hiển thị tiếng Việt. Frontend dùng
   `Intl.NumberFormat('vi-VN')`, nên `0.3` được trình bày thành `0,3`; dấu chấm là
   phần tách hàng nghìn và dấu phẩy là phần thập phân.
2. Tuy nhiên, dữ liệu nghiệp vụ đang sai ở tầng quantity/unit: BOM có số lẻ trong các
   unit đếm được. Hiện có `18/55` dòng BOM dùng `Cái`, `3/3` dùng `Cây`, `3/3` dùng
   `Miếng`, `3/3` dùng `Quả`, `12/15` dùng `Lát`, và `5/15` dùng `Ổ` với quantity
   không nguyên.
3. Sai lệch đã lan từ BOM sang chứng từ: `Chả cá/Miếng` có issue, purchase request,
   purchase order và receipt quantity lẻ; `Chuối/Quả` cũng có issue, purchase order,
   purchase request và receipt quantity lẻ. Đây không còn là lỗi format UI đơn thuần.
4. Nguyên nhân gốc là mô hình `Unit` chỉ có mã/tên/baseUnit/conversion factor, còn
   quantity dùng chung `decimal(18,6)` và `DecimalPolicy.QuantityScale = 6` cho mọi
   loại unit. Không có `dimension`, `unitKind`, `allowFraction` hoặc precision policy
   theo unit.
5. Luồng preset BOM còn trộn ngữ nghĩa khối lượng và số đếm: workbook có cột
   `Khối lượng (kg)`/`Định lượng (gram)/khay`, nhưng importer có thể gán kết quả đó vào
   `grossQtyPerServing` rồi map nguyên liệu sang `QUA`, `MIENG`, `CAI`, `CAY`...
6. Có thêm một vấn đề chuẩn hóa unit độc lập: `44/44` unit-normalization review vẫn
   ở `NEEDS_CONFIRMATION`; `38` bị block và chỉ `6` có factor đề xuất. Không được tự
   áp dụng các conversion này.

## Chuẩn pháp lý và cách hiểu đúng

Luật Đo lường 04/2011/QH13 quy định đơn vị đo gồm đơn vị pháp định và đơn vị khác;
kilôgam (kg) là đơn vị cơ bản của khối lượng. Đơn vị khác có thể được dùng theo thỏa
thuận, nhưng trong trường hợp tranh chấp phải quy đổi về đơn vị pháp định.

Nghị định 86/2012/NĐ-CP tiếp tục phân biệt đơn vị SI, đơn vị theo thông lệ quốc tế và
đơn vị theo tập quán trong nước; khi trình bày cùng một kết quả, đơn vị pháp định phải
được trình bày trước và đơn vị khác để trong ngoặc.

Các văn bản này **không nói rằng mọi từ `quả`, `cái`, `miếng`, `lát` phải luôn là số
nguyên trong mọi công thức**. Quy tắc số nguyên là business rule của vật thể đếm được
trong từng quy trình. Với IPCManagement, quy tắc nên là:

- mua/nhập/xuất/cấp phát vật thể nguyên chiếc: quantity phải nguyên;
- BOM có thể dùng định lượng trung bình, nhưng nếu quantity là phân số thì không nên
  gắn nhãn như một vật thể nguyên chiếc nếu kho không thể cấp phân số đó;
- nếu nguyên liệu thực tế được cân/cắt theo khối lượng, nên dùng `g`, `kg`, `ml` hoặc
  `l` làm unit nghiệp vụ thay vì giả lập bằng `Cái/Quả/Miếng`;
- bao bì như `Bịch (10 cái)` phải là quy cách đóng gói, không phải conversion factor
  chung cho mọi nguyên liệu.

Nguồn chính:

- Luật 04/2011/QH13: <https://vanban.chinhphu.vn/?docid=162349&pageid=27160>
- Nghị định 86/2012/NĐ-CP: <https://vanban.chinhphu.vn/?classid=1&docid=164137&pageid=27160>
- Nghị định 43/2017/NĐ-CP về nhãn hàng hóa:
  <https://vanban.chinhphu.vn/default.aspx?docid=189385&pageid=27160>
- Thông tư về phép đo khối lượng trong thương mại bán lẻ:
  <https://vbpl.vn/bocongthuong/Pages/ivbpq-toanvan.aspx?ItemID=122963>

## Đơn vị hiện có trong dự án

### Đơn vị đang được dùng trong BOM hoặc dữ liệu vận hành

| Nhóm | Mã/unit hiện có | Đánh giá readonly |
|---|---|---|
| Khối lượng | `KG` — Kilogram | Phù hợp cho hàng cân; đang chiếm phần lớn BOM (`1.860` dòng). |
| Khối lượng | `G` — Gram | Ý định migration là `baseUnitCode=KG`, factor `0,001`, nhưng evidence hiện đọc được `G/G/1`; cần kiểm tra và sửa bằng migration có duyệt, không tự backfill. |
| Thể tích | `LIT` — Lít | Có thể dùng cho chất lỏng; cần thống nhất thêm ml nếu nghiệp vụ cần độ nhỏ hơn lít. |
| Đếm vật thể | `CAI` — Cái, `CHIEC` — Chiếc, `QUA` — Quả, `TRAI` — Trái, `CON` — Con, `CAY` — Cây, `MIENG` — Miếng, `LAT` — Lát, `O` — Ổ, `VIEN` — Viên | Là nhóm phải có policy nguyên/phân số theo từng nguyên liệu và quy trình. Hiện BOM đã có quantity lẻ. |
| Đóng gói | `HOP`, `CHAI`, `LON`, `GOI`, `BICH`, `BAO`, `THUNG`, `CAN`, `LOC`, `BICH-(10-CAI)`, `BANH`, `BO`, `PHAN`, `HU`, `VIT` | Là quy cách/đơn vị giao dịch; không được suy ra factor chỉ từ tên. Cần package snapshot hoặc bằng chứng nhãn/NCC. |
| Đơn vị dân dụng/legacy | `CAP`, `DOI`, `ĐOI`, `BI`, `BINH`, `K`, `KH`, `XAP`, `CUC`, `LON`, `VIE...` và các mã không có reference | Một số là đơn vị hợp lệ theo ngữ cảnh, nhưng một số chỉ là dữ liệu legacy/ambiguous; cần owner xác nhận trước khi đưa vào catalog chuẩn. |

Audit schema cho thấy có `43` unit, zero mã trùng sau normalize, zero conversion rate
`<= 0`, zero base-family mất và zero orphan. Đây chỉ chứng minh integrity kỹ thuật;
không chứng minh semantics của unit là đúng.

Hai ambiguity tên đang tồn tại:

- `BO`, `BO_BUNCH`, `BO_SET` có tên hiển thị gần/trùng nhau theo normalize;
- `DOI` và `ĐOI` là hai mã khác nhau nhưng cùng hiển thị `đôi`.

## Bằng chứng quantity sai theo unit

### BOM

| Unit | Tổng BOM | BOM quantity lẻ | Mẫu đã đọc |
|---|---:|---:|---|
| `CAI` — Cái | 55 | 18 | Trứng cút `3,08`; trứng gà `0,8`, `0,933333`, `0,877863`, `0,04`, `0,52`. |
| `CAY` — Cây | 3 | 3 | Căn cuộn `1,2`. |
| `HOP` — Hộp | 3 | 0 | Không thấy lẻ trong BOM hiện audit. |
| `LAT` — Lát | 15 | 12 | Có các dòng `0,5` hoặc giá trị phân số. |
| `MIENG` — Miếng | 3 | 3 | Chả cá `2,389381`. |
| `O` — Ổ | 15 | 5 | Bánh mì `1,5` ở một số món. |
| `QUA` — Quả | 3 | 3 | Chuối `1,024460`. |

Các số trên được tính bằng `MOD(quantity, 1) <> 0`, không phải do làm tròn UI.

### Chuỗi chứng từ

`Chuối/QUA`:

- issue: `6/6` dòng lẻ, quantity `1.751,826600` trong evidence;
- purchase request: `8/8` dòng lẻ, khoảng `860,546400`–`891,280200`;
- purchase order: `8/8` dòng lẻ, cùng khoảng;
- receipt: `8/8` dòng lẻ.

`Chả cá/MIENG`:

- issue: `2/2` dòng lẻ, `4.085,841510`;
- purchase request/order: `2/2` dòng lẻ, khoảng `2.007,080040`–`2.078,761470`;
- receipt: `2/2` dòng lẻ.

Trong khi đó `currentstock` hiện giữ số nguyên cho `CAI`, `CAY`, `LAT`, `MIENG`,
`QUA`; điều này cho thấy lỗi quantity lẻ nổi bật ở chain BOM → demand → purchase/
issue/receipt, không phải toàn bộ kho đã lưu phân số.

## Nguyên nhân kỹ thuật đã xác định

### 1. Một precision policy cho mọi unit

- `backend/src/IPCManagement.Api/Helpers/DecimalPolicy.cs` đặt
  `QuantityScale = 6` và `RoundQuantity` dùng chung cho mọi quantity.
- Entity/schema dùng `decimal(18,6)` cho `GrossQtyPerServing` và hầu hết quantity
  vận hành.
- Không có field biểu diễn `COUNT`, `MASS`, `VOLUME`, `PACKAGE`, cũng không có
  `allowFraction`/`quantityStep`/`operationalUnit`.

Do đó DB chấp nhận `0,3 Quả`, `1,2 Cây`, `2,389381 Miếng` như các số decimal hợp lệ.

### 2. Preset BOM import trộn kg/gram với unit đếm

`SampleBomImportService` đọc các cột:

- `Khối lượng ( kg)`;
- `Định lượng (gram) / khay`.

`PresetBomImportPolicy.ParseGrossQtyPerServing` parse định lượng và có nhánh chia
`/1000` khi giá trị lớn hơn 5. Sau đó `SampleBomImportService.ResolvePresetBomUnit`
map một số tên nguyên liệu sang unit đếm, ví dụ:

- `Chuối → QUA`;
- `Chả cá → MIENG`;
- `Căn cuộn → CAY`;
- `Trứng cút/Trứng gà → CAI`;
- `Bánh mì → O`.

Kết quả numeric từ workbook được lưu vào `DishBom.GrossQtyPerServing` cùng unit đếm
đó. Đây là điểm làm mất distinction giữa “khối lượng định lượng cho một suất” và
“số vật thể nguyên chiếc”.

### 3. Import chính thức cũng không validate fraction theo unit

`DishBomImportParser` kiểm tra unit có tồn tại và quantity lớn hơn 0, nhưng không có
rule cấm fraction cho unit đếm. Vì vậy mọi import/API có thể tiếp tục tạo dữ liệu
giống lỗi này dù formatter đã đúng.

### 4. Unit normalization review chưa được disposition

44 review còn mở là bằng chứng dữ liệu nguồn có nhiều quy cách khác nhau:

- `Bánh tráng gói ram 500g`: `GOI → KG`, factor đề xuất `0,5`, confidence HIGH;
- `Sữa chua Proby 65ml`: `THUNG → HOP`, factor `50`, confidence CONFIRMED;
- `Vinamilk 180ml`: `THUNG → HOP`, factor `48`, confidence CONFIRMED;
- `Sữa Milo 180ml`: `HOP → THUNG`, factor `0,020833`, confidence CONFIRMED;
- `Nấm đùi gà`: `GOI → KG`, factor `0,3`, nhưng chỉ MEDIUM;
- nhiều dòng còn lại BLOCKED vì thiếu nhãn/quy cách/NCC.

Các factor này chỉ là evidence/recommendation, chưa được áp dụng. Nếu tự đổi unit
hoặc factor sẽ làm sai lineage và quantity lịch sử.

## Phân loại đúng/sai cho các ví dụ

| Ví dụ | Kết luận |
|---|---|
| `0,3 kg` | Bình thường; là 0,3 kg và dấu phẩy là locale Việt Nam. |
| `0,3 g` | Có thể bình thường nếu cân/định lượng đạt độ phân giải đó; cần kiểm tra nghiệp vụ. |
| `0,3 Quả chuối` trong BOM | Không phù hợp nếu `Quả` nghĩa là quả nguyên chiếc; nếu là định lượng trung bình của chuối cắt/chia suất thì unit phải đổi sang khối lượng hoặc mô hình phải ghi rõ “portion equivalent”. |
| `1,024460 Quả chuối` trong BOM và quantity mua/nhập/xuất | Sai đối với quy trình cấp phát quả nguyên chiếc; đã có bằng chứng lan sang chứng từ. |
| `0,3 Miếng` | Chỉ hợp lệ nếu đơn vị thực tế là phần cắt/portion có thể chia; không hợp lệ nếu kho cấp nguyên miếng. Với `Chả cá/MIENG`, chain hiện tại có quantity lẻ lớn nên cần re-check nguồn và unit. |
| `1,2 Cây`, `1,5 Ổ` | Có thể là average recipe portion, nhưng không hợp lệ nếu chứng từ kho đang giao nguyên cây/nguyên ổ; cần đổi sang unit cân/portion hoặc áp policy operational rounding có kiểm soát. |
| `0,..` literal | Không thấy formatter/source/workbook chuẩn nào sinh chuỗi literal này. Formatter chuẩn sinh `0,3`; nếu giao diện thực sự hiện `0,..` cần capture đúng API response + DOM text để truy một nhánh render khác hoặc dữ liệu chuỗi bất thường. |

## Recommendation, chưa thực thi

1. Chốt domain matrix theo `ingredient × unit × process`: BOM, purchase request/order,
   receipt, issue, stocktake. Không áp một rule “mọi unit đếm luôn integer” vào BOM
   trước khi xác nhận recipe semantics.
2. Bổ sung metadata cho unit hoặc policy riêng: `dimension/kind`, `allowFraction`,
   `quantityStep`, `displayScale`, `operationalRoundingMode` và `baseUnit` rõ ràng.
3. Tách quantity recipe khỏi quantity procurement. Ví dụ recipe có thể tính theo g/kg,
   nhưng purchase/warehouse phải chuyển sang số quả/số gói theo quy cách và có phần dư,
   không ghi đè quantity gốc.
4. Chặn import/API khi unit đếm được nhận fraction trong các process giao dịch; với BOM,
   chỉ cho phép nếu dòng có cờ semantic được owner duyệt.
5. Xử lý riêng migration `G`: source migration dự định `G → KG × 0,001`, nhưng evidence
   hiện cho thấy `G` đang có base `G`, factor `1`. Vì đây là unit chưa có reference trong
   audit, cần preflight và migration có rollback, không sửa trực tiếp.
6. Disposition 44 unit-normalization review bằng nhãn/packing/NCC; không tự suy factor từ
   tên hàng hoặc giá.
7. Sau khi có domain decision, chạy audit readonly mới để đếm lại fraction ở BOM và toàn
   bộ document chain; chỉ sau đó mới lập plan sửa dữ liệu/code.

## Verdict

**Nguyên nhân chính là dữ liệu nghiệp vụ đã được tạo/lưu sai semantics unit, được tiếp tay
bởi mô hình quantity dùng decimal chung và importer không validate fraction theo unit.**
Locale `vi-VN` chỉ giải thích dấu phẩy trong `0,3`, không giải thích việc `Quả`, `Miếng`,
`Cây`, `Cái` có số lẻ. Không nên chỉ sửa formatter để che số lẻ; cần chốt domain unit
policy rồi mới sửa source/data theo migration và reconciliation có kiểm soát.
