# Đối chiếu BOM workbook với database baseline — 2026-08-12

## Phạm vi và kết luận

Đây là audit readonly. Không có `INSERT`, `UPDATE`, `DELETE`, import, seed, reset hoặc
thay đổi database.

Kết luận:

1. `.docs/IPC. Định lượng 07.2026.xlsx` là workbook BOM/định lượng cho ba tier `25k`,
   `30k`, `34k`; không phải file nhập tồn kho.
2. Workbook có `1.999` dòng nguồn. Sau khi áp dụng chuẩn hóa và quy tắc dedup hiện có,
   còn `1.957` grain BOM. Database baseline có đúng `1.957` dòng `dishbom`:
   `650/650/657` theo ba tier. Đối chiếu theo `tier + tên món + tên nguyên liệu` khớp
   `1.957/1.957`; không có source-only, database-only, quantity mismatch hoặc unit
   mismatch ở grain hiện hành.
3. Workbook không sạch về nguồn: có `24` nhóm trùng trong cùng tier, trong đó `21`
   nhóm có nhiều định lượng khác nhau. Importer bỏ qua ngữ cảnh `Supplier`,
   `Sub-column`, `Loại món`, `Menu` khi dedup và gộp theo `tier + Món + Nguyên liệu`
   bằng bình quân gia quyền. Vì vậy baseline là kết quả đã gộp, không bảo toàn mọi dòng
   nguồn.
4. Baseline BOM vẫn chứa quantity phân số trong unit đếm được: `CAI 18` dòng,
   `CAY 3`, `MIENG 3`, `QUA 3`, `LAT 12`, `O 5`. Đây là lỗi semantics/unit policy,
   không phải lỗi dấu phẩy hiển thị.
5. Luồng preset BOM không ghi trực tiếp vào `currentstock`, phiếu nhập hoặc
   `stockmovements`. Kho/chứng từ là luồng khác. Tuy vậy, demand/purchase/issue có thể
   snapshot hoặc tính tiếp từ BOM, nên quantity phân số ở BOM có thể lan sang chứng từ.
   Database không lưu source filename cho `currentstock`/receipt; muốn biết chính xác
   file kho nào phải audit file nhập kho/đặt hàng hoặc audit log riêng.

## Workbook đã đọc

| Sheet | Dòng XML | Dòng sau header | Dòng hợp lệ |
|---|---:|---:|---:|
| `định lượng suất 25k` | 666 | 664 | 664 |
| `định lượng suất 30k` | 666 | 664 | 664 |
| `định lượng suất 34k` | 673 | 671 | 671 |
| **Tổng** | **2.005** | **1.999** | **1.999** |

Các số dạng khoa học trong XLSX như `3.0000000000000001E-3` là cách Excel biểu diễn số
thực. Audit parse invariant và round tối đa 6 chữ số trước khi so sánh; không coi đó là
lỗi format riêng lẻ.

## Đối chiếu với baseline

Database baseline được đọc qua compiled readonly evidence query, dùng schema-qualified
`SELECT` và trỏ tới `ipc_lane1`.

| Tier | Workbook raw | Workbook sau dedup | Baseline `dishbom` |
|---:|---:|---:|---:|
| 25.000 | 664 | 650 | 650 |
| 30.000 | 664 | 650 | 650 |
| 34.000 | 671 | 657 | 657 |
| **Tổng** | **1.999** | **1.957** | **1.957** |

1.957 dòng BOM hiện hành đều là global (`customerId IS NULL`), `PUBLISHED`, bắt đầu hiệu
lực `2026-01-01` và chưa hết hiệu lực. Kết quả chứng minh workbook và catalog hiện hành
cùng một shape/dedup result. Do `dishbom` không có `sourceFileName`/`sourceImportBatch`,
chưa thể chứng minh mọi dòng được tạo từ đúng một lần import file này.

## Dấu hiệu nguồn bị trộn trong workbook

`PresetBomImportPolicy.ValidateAndDeduplicate` group theo:

```text
priceTier + Normalize(Món) + Normalize(Nguyên liệu chính)
```

Các cột `Supplier`, `Sub-column`, `Loại món`, `Menu` không nằm trong grain. Audit thấy:

- `24` nhóm có nhiều dòng nguồn trong cùng tier;
- `21` nhóm có định lượng khác nhau;
- ví dụ tier 25k: `Bí đao nấu tôm/Bí đao` có `0,036765` và `0,037815`;
- `Mướp xào giá/Mướp` có `0,060345`, `0,061538`, `0,073903`;
- `Trái cây/Chuối` có `1` và `1,039261`.

Khi có nhiều giá trị, policy tính bình quân gia quyền theo `Số lượng suất ăn`, sau đó
`EnsureBomLine` update một dòng BOM theo `dish + ingredient + tier`. Đây là bằng chứng
mạnh cho việc nhiều source/context đã bị gộp; chủ sở hữu nghiệp vụ vẫn cần xác nhận
các dòng lặp là công thức cũ hay các block menu khác nhau.

## Tách BOM khỏi dữ liệu kho

`SampleBomImportService` đọc workbook và xử lý supplier, unit, ingredient, dish và
`DishBom`; `EnsureBomLine` chỉ tạo/cập nhật `dishbom`. Luồng này không ghi trực tiếp vào:

- `currentstock`;
- `inventoryreceiptlines`;
- `stockmovements`;
- `purchaserequestlines` hoặc `purchaseorderlines`.

Baseline có các bảng vận hành riêng: `currentstock` 697 dòng, `inventoryreceiptlines`
16.856, `stockmovements` 16.968, `materialrequestlines` 721, `purchaserequestlines`
106 và `purchaseorderlines` 54.

Chuỗi nguyên nhân phù hợp nhất là:

```text
Workbook BOM có dòng trùng + quantity/unit chưa đúng semantics
        ↓
Importer dedup và lưu vào dishbom
        ↓
Demand/purchase/issue snapshot hoặc tính tiếp từ dishbom
        ↓
Chứng từ vận hành giữ lại quantity phân số
        ↓
Kho/tồn kho là luồng khác, không phải output trực tiếp của BOM importer
```

Không được suy ra mọi số lẻ trong kho đều do file BOM. Cũng không nên sửa riêng file kho
mà bỏ qua BOM, vì audit trước đã thấy `Chuối/QUA` và `Chả cá/MIENG` có quantity phân số
lan qua request/order/receipt/issue.

### Bằng chứng hiện trạng phiếu nhập và tồn kho

Readonly baseline cho thấy `inventoryreceipts` có `4.404` phiếu:

- `4.401` phiếu có mã `RCP-SAMPLE-*`, không gắn purchase request/order, ngày từ
  `2024-07-04` đến `2026-05-21` — đây là dữ liệu mẫu/legacy, không thể coi là file BOM
  07/2026.
- `3` phiếu `RCP-PO-*`, ngày `2026-07-08` đến `2026-07-21`, có purchase request nhưng
  chưa gắn purchase order. Phiếu vận hành được đọc readonly là
  `RCP-PO-20260720-110654-9D78`, nguyên liệu `Bánh phồng tôm`, `2,67 KG`, trạng thái
  `DRAFT/PENDING_INSPECTION`.

Trong `inventoryreceiptlines`, các unit đếm `CAI`, `CAY`, `LAT`, `MIENG` đều có quantity
nguyên; phần phân số tập trung ở `KG` (`8.224` dòng) và `THUNG` (`27` dòng). Trong
`currentstock`, không có dòng phân số cho `QUA`, `MIENG`, `CAI`, `CAY`, `LAT` hoặc `O`;
phân số tồn hiện tập trung chủ yếu ở `KG`, ngoài ra có một số `GOI`, `THUNG`, `TRAI`.

Đây là bằng chứng trực tiếp rằng file BOM không phải là nguồn ghi tồn kho trực tiếp, và
quantity phân số ở kho không thể được quy toàn bộ cho các dòng `Chuối/QUA` hoặc
`Chả cá/MIENG` trong BOM. Ngược lại, BOM vẫn cần sửa policy vì nó có thể ảnh hưởng đến
định mức demand/cấp phát trước khi chứng từ được tạo.

### File mua hàng riêng

Source code định nghĩa nguồn lịch sử mua hàng riêng:
`IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx`, SHA-256
`4A91F9EA847068ABEB147EFF7ED7401B029D698F73E495641099DD9FA552BC88`.
Service đối soát nguồn này với `inventoryreceiptlines`, không dùng workbook BOM.
Tuy nhiên, baseline hiện có `0` `purchasehistoryreconciliationruns` và `0`
`purchasehistoryreconciliationactions`, nên chưa được phép kết luận file này đã được
apply vào baseline. Nó là nguồn được thiết kế cho reconciliation, không phải bằng chứng
đã ghi dữ liệu kho.

## Snapshot backup và legacy identity

Snapshot `backup_dishbom_20260717_141300` cũng có 1.957 dòng. ID vật lý khác nhau nên
không join bằng `bomId`; đối chiếu natural grain cho thấy shape tương ứng. Baseline có
một số variant tên món viết hoa/thường; ví dụ `Chả CÁ Rim Tóp Mỡ` là dish inactive không
còn BOM hiện hành, còn variant chữ thường là dish active có 9 dòng BOM. Đây là legacy
catalog identity, không phải bằng chứng có thêm BOM active trùng grain.

## Nguyên nhân kỹ thuật

1. Importer mất context source khi dedup, vì group không bao gồm `Supplier/Sub-column/
   Loại món/Menu`.
2. Policy đọc `Định lượng (gram) / khay`, có nhánh chia `/1000`, rồi lưu vào
   `GrossQtyPerServing`; sau đó map Chuối, Chả cá, Căn cuộn, Trứng, Bánh mì sang
   `QUA`, `MIENG`, `CAY`, `CAI`, `O` mà không validate fraction theo unit.
3. `GrossQtyPerServing` dùng `decimal(18,6)` chung cho mọi unit; không có `unitKind`,
   `allowFraction` hoặc `quantityStep`.
4. Inventory tables không có source filename tương đương; file kho cụ thể cần được
   xác nhận từ audit log, request payload hoặc workbook nhập kho/đặt hàng.

## Verdict và bước tiếp theo

### Quyết định nghiệp vụ của Kỳ — 2026-08-12

Workbook `IPC. Định lượng 07.2026.xlsx` là nguồn BOM được giữ nguyên. Không force mọi
quantity BOM về số nguyên và không làm tròn các dòng `CAI`, `CAY`, `LAT`, `MIENG`,
`O`, `QUA` chỉ vì unit có dạng đếm. Phạm vi cleanup hiện hành chỉ là dữ liệu kho vật
lý cũ: receipt, issue, return, supplemental, stocktake, movement, snapshot và tồn hiện
tại. Menu, planning, demand, PR/PO và BOM được bảo toàn.

Quyết định này ghi đè mọi đề xuất trước đó về việc bắt BOM unit đếm phải nguyên. Nếu
sau này cần validation số nguyên, validation đó phải thuộc một quy trình kho cụ thể và
không được làm thay đổi BOM nguồn.

**Đúng:** file này là BOM, không phải file tồn kho; kho được tạo/cập nhật qua luồng khác.

**Cần sửa cách hiểu:** lỗi quantity không nằm chỉ ở file kho. BOM hiện tại đã có unit
đếm gắn với số phân số và workbook có source rows trùng bị gộp; các lỗi đó có thể lan
sang chứng từ vận hành.

Trước khi sửa dữ liệu, cần audit readonly file nhập kho/đặt hàng và nối lineage theo
`ingredientId + unitId + source line/document`, sau đó owner xác nhận:

1. recipe average hợp lệ hay phải đổi sang `KG/G`;
2. vật thể nguyên chiếc phải integer hay có portion/packaging rule;
3. dữ liệu kho là opening balance, receipt hay document phát sinh;
4. dòng nào legacy cần disposition, dòng nào là operational data hiện hành.

Chưa tự động round, đổi unit, xóa BOM cũ hoặc backfill chứng từ.

## Nguồn nội bộ

- Workbook: [.docs/IPC. Định lượng 07.2026.xlsx](../../.docs/IPC.%20%C4%90%E1%BB%8Bnh%20l%C6%B0%E1%BB%A3ng%2007.2026.xlsx)
- Importer: [SampleBomImportService.cs](../../backend/src/IPCManagement.Api/Features/SampleData/Services/SampleBomImportService.cs:89)
- Dedup policy: [PresetBomImportPolicy.cs](../../backend/src/IPCManagement.Api/Features/SampleData/Services/PresetBomImportPolicy.cs:15)
- BOM entity/configuration: [DishBom.cs](../../backend/src/IPCManagement.Api/Models/Entities/DishBom.cs:6), [CatalogEntityConfigurations.cs](../../backend/src/IPCManagement.Api/Features/Catalog/Persistence/CatalogEntityConfigurations.cs:54)
- Unit/quantity research: [unit-measurement-vietnam-project-reconciliation-2026-08-12.md](unit-measurement-vietnam-project-reconciliation-2026-08-12.md)
- Readonly runner: [bom-reconcile-readonly.ps1](../../.artifacts/shipyard-live/bom-reconcile-readonly.ps1)
