# Audit IPC Management – Khả năng lưu trữ và scale dài hạn

**Repository:** `Peaker04/IPCManagement`  
**Branch được yêu cầu:** `dev`  
**Mục tiêu audit:** đánh giá dự án sau một thời gian phát triển, tập trung vào khả năng lưu trữ dữ liệu lâu dài, tránh lệch tồn kho/tiền/số lượng, cải thiện hiệu năng và khả năng scale theo thời gian.

---

## 1. Tổng quan nhanh

Dự án hiện là monorepo gồm:

```text
IPCManagement/
├── backend/   # .NET 9 Web API
├── frontend/  # React + Vite + TypeScript
├── .husky/
├── README.md
└── package.json
```

Backend hiện là single-project monolithic trong `IPCManagement.Api`.

Tech stack chính:

```text
Frontend   : React 19, Vite, TypeScript, Redux Toolkit
Backend    : ASP.NET Core 9, C#
Database   : MySQL 8+, Pomelo EF Core
Auth       : JWT Bearer + Refresh Token Rotation
Validation : FluentValidation
Logging    : Serilog
Testing    : xUnit, NSubstitute, FluentAssertions
```

Điểm tốt hiện có:

- Đã dùng `decimal` cho tiền và số lượng.
- Có `DecimalPolicy` để round số lượng, tiền, phần trăm.
- Có JWT auth + refresh token rotation.
- Có rate limiting cho auth và API.
- Có production configuration guard để chặn secret mẫu, CORS localhost và `AllowedHosts=*` ngoài development.
- Có soft-delete cho nguyên liệu.
- Có audit log và approval history.
- Có repository/service layer.
- Có transaction cho một số nghiệp vụ nhập/xuất kho.
- Có test project backend và script verify chung.

Tuy nhiên, nếu mục tiêu là chạy lâu dài, dữ liệu kho/tiền/chứng từ tăng theo năm, hiện có một số rủi ro cần sửa sớm.

---

# 2. Các lỗi/rủi ro nghiêm trọng cần sửa trước

## P0 — Lỗi enum trạng thái phiếu mua có thể làm hỏng luồng nhập kho

Trong `IpcManagementContext`, cột `purchaserequests.status` đang map enum gồm:

```text
DRAFT
SENTTOSUPPLIER
APPROVED
REJECTED
SENTTOWAREHOUSE
CANCELLED
```

Nhưng trong `InventoryReceiptService.CreateFromPurchaseRequestAsync`, service lại cho phép và gán thêm:

```text
PARTIALRECEIVED
RECEIVED
```

Vấn đề:

- Khi chạy MySQL strict mode, `SaveChangesAsync()` có thể fail vì giá trị không nằm trong enum.
- Nếu không strict, dữ liệu có thể bị insert/update sai hoặc bị truncate tùy cấu hình MySQL.
- Đây là lỗi rất nguy hiểm vì nó nằm trong luồng nhập kho từ phiếu mua.

### Đề xuất sửa ngay

Tạo migration hoặc chạy SQL để đồng bộ enum:

```sql
ALTER TABLE purchaserequests
MODIFY status ENUM(
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'SENTTOSUPPLIER',
  'PARTIALRECEIVED',
  'RECEIVED',
  'SENTTOWAREHOUSE',
  'CANCELLED'
) NOT NULL DEFAULT 'DRAFT';
```

### Đề xuất tốt hơn cho dài hạn

Không nên dùng MySQL `ENUM` cho trạng thái nghiệp vụ dài hạn. Workflow sẽ thay đổi liên tục khi hệ thống lớn lên.

Nên đổi sang:

```text
status varchar(30) not null
```

Sau đó validate trạng thái trong domain/application service.

---

## P0 — `Currentstock.RowVersion` có trong model nhưng migration tạo bảng không có cột này

Entity `Currentstock` có:

```csharp
[Timestamp]
public byte[] RowVersion { get; set; } = [];
```

Context cũng config:

```csharp
entity.Property(e => e.RowVersion)
    .IsRowVersion()
    .IsConcurrencyToken()
    .HasDefaultValueSql("CURRENT_TIMESTAMP(6)")
    .HasColumnName("rowVersion");
```

Nhưng migration `AddCurrentStockTable` chỉ tạo:

```text
warehouseId
ingredientId
unitId
currentQty
lastUpdated
```

Không có `rowVersion`.

Vấn đề:

- Nếu database được tạo từ migration trong repo, EF có thể query/update một cột mà DB không có.
- Có thể gây lỗi runtime kiểu `Unknown column rowVersion`.
- Hoặc optimistic concurrency không hoạt động như bạn tưởng.

### Đề xuất sửa ngay

Tạo migration mới:

```bash
dotnet ef migrations add AddCurrentStockRowVersion   --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj   --startup-project backend/src/IPCManagement.Api/IPCManagement.Api.csproj
```

Migration nên thêm cột tương tự:

```csharp
migrationBuilder.AddColumn<DateTime>(
    name: "rowVersion",
    table: "currentstock",
    type: "timestamp(6)",
    rowVersion: true,
    nullable: false,
    defaultValueSql: "CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
```

Lưu ý: Với MySQL/Pomelo, `[Timestamp]` không giống hoàn toàn SQL Server. Cần test thực tế. Nếu muốn chắc chắn hơn, có thể dùng:

```text
version bigint not null default 0
```

Mỗi lần update stock thì tăng `version = version + 1`, sau đó tự kiểm tra concurrency bằng version.

---

## P0 — Tồn kho hiện tại chưa an toàn khi nhiều người nhập/xuất cùng lúc

`StockLedgerService.RemoveStockWithCheckAsync()` hiện đang:

1. Đọc `Currentstock`.
2. Kiểm tra đủ tồn.
3. Ghi `Stockmovement`.
4. Trừ `CurrentQty`.
5. SaveChanges sau đó.

Vấn đề xảy ra khi có 2 request xuất kho cùng lúc:

```text
Tồn ban đầu = 100

Request A đọc tồn = 100
Request B đọc tồn = 100

A thấy đủ, trừ 80
B cũng thấy đủ, trừ 80

Kết quả có thể sai tồn hoặc âm tồn nếu không lock/concurrency đúng.
```

Ngoài ra, `InventoryIssueService.CreateAsync()` còn gọi `EnsureStockAvailableAsync()` trước khi mở transaction. Check này chỉ mang tính tham khảo, không bảo vệ được race condition.

### Đề xuất sửa

Trong transaction, dùng update điều kiện nguyên tử:

```sql
UPDATE currentstock
SET currentQty = currentQty - @qty,
    lastUpdated = UTC_TIMESTAMP(6)
WHERE warehouseId = @warehouseId
  AND ingredientId = @ingredientId
  AND currentQty >= @qty;
```

Sau đó kiểm tra:

```text
rowsAffected == 1 -> xuất kho thành công
rowsAffected == 0 -> thiếu tồn hoặc stock bị người khác dùng trước
```

Ví dụ bằng EF Core:

```csharp
var affected = await _context.Currentstocks
    .Where(s => s.WarehouseId == warehouseId
             && s.IngredientId == ingredientId
             && s.CurrentQty >= quantity)
    .ExecuteUpdateAsync(setters => setters
        .SetProperty(s => s.CurrentQty, s => s.CurrentQty - quantity)
        .SetProperty(s => s.LastUpdated, DateTime.UtcNow));

if (affected == 0)
{
    throw new StockShortageException(...);
}
```

Đây là cách quan trọng nhất để tránh sai tồn kho khi có nhiều người thao tác.

---

# 3. Rủi ro thiết kế dữ liệu kho

## P1 — `currentstock` đang khóa theo `WarehouseId + IngredientId`, nhưng lại có `UnitId`

Hiện `currentstock` có primary key:

```text
warehouseId + ingredientId
```

Nhưng entity vẫn lưu:

```text
unitId
currentQty
```

Repository cũng tìm tồn theo:

```text
warehouseId + ingredientId
```

bỏ qua `unitId`.

Vấn đề:

```text
Nhập 10 kg thịt
Sau đó nhập 500 g thịt

Nếu không quy đổi unit, hệ thống có thể cộng 10 + 500.
```

Đây là lỗi rất hay gặp trong hệ thống kho nếu không chuẩn hóa đơn vị.

### Đề xuất hướng tốt nhất

Lưu tồn kho theo base unit duy nhất:

```text
currentstock
- warehouseId
- ingredientId
- baseUnitId
- currentBaseQty
- lastUpdated
- version/rowVersion
```

Mọi nhập/xuất đều convert về base unit bằng:

```text
units.convertRateToBase
```

Ví dụ:

```text
1 kg = 1000 g
0.5 kg = 500 g
500 g = 500 g
```

Tồn kho chỉ lưu một đơn vị chuẩn, tránh lệch số.

### Hướng khác

Nếu thật sự cần tồn theo nhiều đơn vị, đổi primary key thành:

```text
warehouseId + ingredientId + unitId
```

Nhưng với hệ thống kho thực tế, base unit ổn định và dễ báo cáo hơn.

---

## P1 — Chưa có tồn kho theo lô/hạn sử dụng

`Inventoryreceiptline` có:

```text
LotNumber
ManufactureDate
ExpiredDate
```

Nhưng `Currentstock` không có lot/expiry. `Stockmovement` cũng không gắn lot-level quantity.

Với bếp ăn công nghiệp, dữ liệu lâu dài cần:

- FIFO/FEFO.
- Truy xuất lô khi có sự cố thực phẩm.
- Cảnh báo hết hạn.
- Kiểm kê theo lô.
- Đối chiếu số lượng nhập/xuất theo lô.

### Đề xuất thêm bảng

```text
inventory_lots
- lotId
- warehouseId
- ingredientId
- baseUnitId
- lotNumber
- manufactureDate
- expiredDate
- receivedQty
- currentQty
- receiptLineId
- status
- createdAt
- updatedAt
```

Và thêm vào `stockmovements`:

```text
lotId nullable
beforeQty
afterQty
```

Khi xuất kho, hệ thống nên:

- Tự chọn lot theo FEFO.
- Hoặc cho thủ kho chọn lot.
- Ghi rõ movement đã trừ từ lot nào.

---

## P1 — `stockmovements` là ledger quan trọng nhưng chưa có snapshot/partition

`stockmovements` đã có các index tốt:

```text
warehouseId + ingredientId + movementDate
ingredientId + movementDate
movementType + movementDate
refTable + refId
```

Tuy nhiên, bảng này sẽ tăng rất nhanh theo thời gian.

Rủi ro:

- Báo cáo tồn kho lịch sử sẽ chậm.
- API movement nếu trả toàn bộ theo ingredient sẽ dễ nặng.
- Sau vài năm, query ledger trực tiếp có thể gây slow query.

### Đề xuất

Bắt buộc mọi API ledger có:

```text
fromDate
toDate
pageSize
cursor/page
```

Thêm bảng snapshot theo tháng:

```text
stock_snapshots
- warehouseId
- ingredientId
- periodMonth
- openingQty
- quantityIn
- quantityOut
- closingQty
- generatedAt
```

Báo cáo tồn kho lịch sử nên lấy:

```text
snapshot gần nhất + stock movements sau snapshot
```

Nếu dữ liệu lớn, partition `stockmovements` theo tháng/quý.

---

# 4. Rủi ro hiệu năng truy vấn

## P1 — Offset pagination sẽ chậm khi dữ liệu lớn

Hiện nhiều repository dùng:

```csharp
CountAsync()
Skip((pageNumber - 1) * pageSize)
Take(pageSize)
```

Cách này ổn khi dữ liệu ít, nhưng khi bảng có vài trăm nghìn đến vài triệu dòng, `Skip()` càng sâu càng chậm.

### Đề xuất

Với danh sách lớn như phiếu nhập, phiếu xuất, stock movements, audit logs, nên dùng keyset/cursor pagination.

API ví dụ:

```text
GET /api/inventory-receipts?cursorCreatedAt=2026-07-01T10:00:00Z&cursorId=...&limit=50
```

SQL:

```sql
WHERE (createdAt < @cursorCreatedAt)
   OR (createdAt = @cursorCreatedAt AND receiptId < @cursorId)
ORDER BY createdAt DESC, receiptId DESC
LIMIT 50;
```

Chỉ dùng `CountAsync()` khi UI thật sự cần tổng số trang.

---

## P1 — Có query gom dữ liệu bằng cách load hết vào memory

`InventoryReceiptService.LoadReceivedQuantitiesAsync()` đang load receipt + receipt lines vào memory rồi group bằng LINQ sau `ToListAsync()`.

Với dữ liệu nhiều năm, cách này tốn RAM và chậm.

### Đề xuất chuyển group xuống database

```csharp
var received = await _context.Inventoryreceiptlines
    .AsNoTracking()
    .Where(line => line.Receipt.PurchaseRequestId == purchaseRequestId)
    .GroupBy(line => new
    {
        line.Receipt.SupplierId,
        line.IngredientId,
        line.UnitId
    })
    .Select(g => new
    {
        g.Key.SupplierId,
        g.Key.IngredientId,
        g.Key.UnitId,
        Quantity = g.Sum(x => x.Quantity)
    })
    .ToListAsync();
```

---

## P1 — Search dùng `ToLower().Contains()` khó dùng index

`IngredientRepository.GetPagedAsync()` đang search bằng:

```csharp
i.IngredientName.ToLower().Contains(kw) ||
i.IngredientCode.ToLower().Contains(kw)
```

Với MySQL collation `utf8mb4_unicode_ci`, thường đã case-insensitive. Gọi `ToLower()` trên cột DB có thể làm giảm khả năng dùng index.

### Đề xuất

- Với mã nguyên liệu: dùng prefix search.
- Với tên nguyên liệu: cân nhắc fulltext index.
- Không gọi `ToLower()` trên cột DB.
- Thêm filter `IsActive == true` cho API chọn nguyên liệu đang hoạt động.

Ví dụ:

```csharp
query = query.Where(i =>
    i.IsActive == true &&
    (i.IngredientCode.StartsWith(keyword) ||
     EF.Functions.Like(i.IngredientName, $"%{keyword}%")));
```

---

# 5. Rủi ro bảo mật/auth

## P1 — Refresh token đang vừa lưu HttpOnly cookie, vừa lưu localStorage

Backend set refresh token vào cookie `HttpOnly`.

Nhưng frontend lại persist cả:

```text
token
refreshToken
user
```

vào `localStorage`.

Vấn đề:

- Nếu refresh token đã nằm trong localStorage, HttpOnly cookie không còn bảo vệ được refresh token.
- Nếu frontend bị XSS, attacker có thể lấy refresh token và dùng để lấy access token mới.

### Đề xuất

- Refresh token chỉ lưu trong HttpOnly cookie.
- API `/auth/refresh` lấy refresh token từ cookie, không cần body.
- Access token nên lưu trong memory/Redux, không persist lâu dài.
- Nếu vẫn cần giữ qua reload, dùng sessionStorage và TTL ngắn.
- Production nên set cookie `Secure = true` cố định.
- Nếu chạy sau reverse proxy, cần cấu hình forwarded headers để `Request.IsHttps` đúng.

---

## P2 — Rate limit hiện là in-memory theo từng instance

Hiện API dùng ASP.NET Core rate limiter. Cách này ổn cho 1 instance.

Nếu scale thành nhiều API instance sau load balancer:

```text
Instance A: cho phép 5 login/minute
Instance B: cho phép 5 login/minute
Instance C: cho phép 5 login/minute
```

Tổng quota thực tế bị nhân lên.

### Đề xuất

- Dùng Redis/distributed rate limiting cho auth endpoint.
- Hoặc đặt rate limit ở API Gateway/Nginx/Cloudflare.

---

# 6. Rủi ro kiến trúc/maintainability

## P1 — Backend single-project đang bắt đầu quá lớn

Hiện backend là single-project monolithic. `DependencyInjection.cs` đã đăng ký nhiều nhóm nghiệp vụ:

```text
Auth
Admin
Approval
Ingredient
Dish
Warehouse
Inventory
Production
Coordination
Purchase
Supplier
Quotation
```

Với giai đoạn đầu thì ổn, nhưng càng làm lâu sẽ khó test, khó tách domain, khó kiểm soát dependency.

### Đề xuất refactor dần

Không cần làm một lần. Nên tách theo hướng:

```text
backend/
├── IPCManagement.Api
├── IPCManagement.Application
├── IPCManagement.Domain
├── IPCManagement.Infrastructure
└── IPCManagement.Tests
```

Vai trò:

```text
IPCManagement.Api
- Controllers
- Middlewares
- Auth wiring
- Swagger
- HTTP concerns

IPCManagement.Application
- Use cases
- Services
- DTOs
- Validators
- Interfaces

IPCManagement.Domain
- Entities
- Value objects
- Domain rules
- Domain events

IPCManagement.Infrastructure
- EF DbContext
- Repositories
- External services
- File storage
- Email/SMS integrations
```

Thứ tự tách nên làm:

1. Tách `Models/Entities` sang `Domain`.
2. Tách `Services/*` sang `Application`.
3. Tách `Data/*` sang `Infrastructure`.
4. API chỉ gọi application service, không đụng trực tiếp DbContext.

---

## P1 — `IpcManagementContext` quá lớn, nên tách configuration theo entity

`IpcManagementContext` hiện chứa nhiều `DbSet` và toàn bộ mapping trong một class.

Về lâu dài, file này sẽ khó review, khó tìm lỗi schema, dễ bỏ sót migration.

### Đề xuất

Tách mỗi entity config thành file riêng:

```text
Infrastructure/Persistence/Configurations/
- CurrentStockConfiguration.cs
- StockMovementConfiguration.cs
- PurchaseRequestConfiguration.cs
- InventoryReceiptConfiguration.cs
- InventoryIssueConfiguration.cs
- UserConfiguration.cs
- RefreshTokenConfiguration.cs
```

Trong DbContext:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder
        .UseCollation("utf8mb4_unicode_ci")
        .HasCharSet("utf8mb4");

    modelBuilder.ApplyConfigurationsFromAssembly(typeof(IpcManagementContext).Assembly);
}
```

Lợi ích:

- Dễ review migration.
- Dễ tìm lỗi enum/status.
- Dễ maintain khi schema lớn.
- Giảm rủi ro sửa một entity làm ảnh hưởng file DbContext khổng lồ.

---

# 7. Đề xuất thiết kế lưu trữ scale dài hạn

## 7.1. Chuẩn hóa tiền và số lượng

Hiện dự án đã có `DecimalPolicy`:

```text
QuantityScale = 6
MoneyScale = 2
PercentScale = 2
```

Đây là hướng đúng.

Nên bổ sung rule rõ ràng:

```text
Quantity        : decimal(18,6)
Money unit price: decimal(18,2) hoặc decimal(19,4) nếu giá/kg cần lẻ
Amount          : decimal(19,2)
Percent         : decimal(9,4) nếu dùng công thức dài hạn
```

Hiện `Inventoryreceiptline.Amount` nullable. Nên chọn một hướng rõ ràng:

### Hướng A — Không lưu amount

Luôn tính:

```text
Amount = Quantity * UnitPrice
```

Ưu điểm: không lệch dữ liệu.  
Nhược điểm: báo cáo lịch sử có thể khó audit nếu công thức thay đổi.

### Hướng B — Lưu amount bắt buộc

Backend tính bằng:

```csharp
DecimalPolicy.CalculateLineAmount(quantity, unitPrice)
```

Ưu điểm: audit tốt hơn.  
Nhược điểm: phải đảm bảo không cho frontend tự gửi amount sai.

Khuyến nghị: với hệ thống kho/mua hàng dài hạn, nên lưu `Amount` bắt buộc, nhưng chỉ backend được tính.

---

## 7.2. Thêm bảng audit nghiệp vụ dạng event

Hiện `Auditlog` đang lưu dạng field-level:

```text
EntityName
EntityId
FieldName
OldValue
NewValue
Reason
```

Cách này tốt để biết field nào đổi.

Nhưng nghiệp vụ kho/mua hàng cần biết event nào đã xảy ra.

### Đề xuất thêm bảng

```text
business_events
- eventId
- eventType
- aggregateType
- aggregateId
- occurredAt
- actorId
- payloadJson
- correlationId
```

Ví dụ event:

```text
PURCHASE_REQUEST_APPROVED
INVENTORY_RECEIPT_CREATED
STOCK_ISSUED
KITCHEN_RECEIPT_CONFIRMED
STOCK_SHORTAGE_DETECTED
```

Field-level audit trả lời:

```text
Field nào đổi?
```

Business event trả lời:

```text
Nghiệp vụ gì đã xảy ra?
Ai làm?
Lúc nào?
Liên quan chứng từ nào?
Payload cụ thể là gì?
```

---

## 7.3. Thêm outbox nếu sau này có notification/report/email

Khi hệ thống scale, bạn sẽ có nhu cầu:

- Gửi thông báo khi thiếu tồn.
- Gửi phiếu mua cho supplier.
- Gửi cảnh báo hết hạn.
- Đồng bộ báo cáo.
- Gửi email/slack/zalo nội bộ.

Không nên gửi trực tiếp trong transaction.

### Đề xuất thêm bảng

```text
outbox_messages
- id
- type
- payloadJson
- status
- createdAt
- processedAt
- retryCount
- lastError
```

Trong transaction chỉ insert outbox. Worker xử lý sau.

Lợi ích:

- DB lưu thành công nhưng email fail vẫn không mất event.
- Có thể retry.
- Dễ scale worker riêng.
- Không làm chậm API chính.

---

## 7.4. Chiến lược archive/partition

Chia dữ liệu thành 2 nhóm.

### Hot data

```text
currentstock
inventoryreceipts
inventoryissues
purchaserequests
materialrequests
productionplans
```

Đây là dữ liệu còn dùng thường xuyên.

### Ledger/event data

```text
stockmovements
auditlogs
approvalhistories
business_events
outbox_messages
```

Đây là dữ liệu tăng rất nhanh.

### Đề xuất

- `stockmovements`: partition theo `movementDate` tháng/quý.
- `auditlogs`: partition theo `changedAt`.
- `approvalhistories`: index theo `targetType + targetId + actionAt`.
- Sau 2–3 năm, archive dữ liệu cũ sang bảng `_archive` hoặc storage riêng.
- Báo cáo lịch sử dùng snapshot thay vì scan ledger từ ngày đầu tiên.

---

# 8. Roadmap chỉnh sửa đề xuất

## Giai đoạn 1 — Sửa lỗi dữ liệu có thể gây fail ngay

Ưu tiên cao nhất:

```text
1. Sửa enum purchaserequests.status hoặc đổi sang varchar(30).
2. Tạo migration đồng bộ currentstock.rowVersion.
3. Sửa trừ tồn kho bằng atomic update trong transaction.
4. Không lưu refresh token vào localStorage.
5. Thêm test cho nhập kho partial/received.
6. Thêm test cho xuất kho đồng thời.
7. Thêm test cho unit conversion.
8. Thêm test đảm bảo tồn kho không âm.
```

---

## Giai đoạn 2 — Làm sạch storage kho

```text
1. Chuẩn hóa tồn kho theo base unit.
2. Thêm inventory_lots.
3. Bắt buộc stock movement có beforeQty, afterQty.
4. Thêm snapshot tồn kho theo tháng.
5. Phân trang bắt buộc cho stock movements.
6. Thêm filter ngày bắt buộc cho báo cáo ledger.
```

---

## Giai đoạn 3 — Scale kiến trúc

```text
1. Tách project Domain/Application/Infrastructure/API.
2. Tách entity configuration khỏi DbContext.
3. Thêm background worker cho outbox.
4. Thêm CI GitHub Actions.
5. Thêm integration test với MySQL container.
```

CI nên chạy:

```text
- backend build
- backend test
- frontend lint
- frontend build
- migration smoke test trên MySQL container
```

---

## Giai đoạn 4 — Production hardening

```text
1. Redis cache/rate limit nếu scale nhiều instance.
2. Structured logs + centralized logging.
3. Backup MySQL tự động.
4. Restore drill định kỳ.
5. Read replica cho report nếu dữ liệu lớn.
6. Dashboard theo dõi slow queries.
7. Alert khi có stock negative attempts.
8. Alert khi migration fail.
9. Alert khi refresh token reuse bất thường.
```

---

# 9. Checklist sửa nhanh

## Database

- [ ] Sửa enum `purchaserequests.status`.
- [ ] Thêm hoặc sửa `currentstock.rowVersion`.
- [ ] Chuẩn hóa đơn vị tồn kho.
- [ ] Thêm bảng `inventory_lots`.
- [ ] Thêm `beforeQty`, `afterQty` cho `stockmovements`.
- [ ] Thêm `stock_snapshots`.
- [ ] Xem lại index cho các bảng chứng từ lớn.
- [ ] Thiết kế archive/partition cho `stockmovements`, `auditlogs`.

## Backend

- [ ] Sửa xuất kho sang atomic update.
- [ ] Đưa check tồn kho vào trong transaction.
- [ ] Không query ledger không phân trang.
- [ ] Chuyển group received quantities xuống database.
- [ ] Không dùng `ToLower()` trên cột DB khi search.
- [ ] Thêm filter `IsActive == true` cho danh mục.
- [ ] Tách configuration entity khỏi DbContext.
- [ ] Tách dần Domain/Application/Infrastructure.

## Frontend/Auth

- [ ] Không lưu refresh token trong localStorage.
- [ ] Refresh token chỉ dùng HttpOnly cookie.
- [ ] Access token nên để memory hoặc sessionStorage ngắn hạn.
- [ ] Xử lý refresh token bằng cookie.
- [ ] Kiểm tra lại flow logout/clear cookie.

## Test

- [ ] Test nhập kho từ phiếu mua `PARTIALRECEIVED`.
- [ ] Test nhập kho đủ thành `RECEIVED`.
- [ ] Test xuất kho đồng thời.
- [ ] Test không cho tồn âm.
- [ ] Test quy đổi đơn vị.
- [ ] Test soft-delete nguyên liệu không mất lịch sử.
- [ ] Test migration MySQL thật.

---

# 10. Kết luận ưu tiên

Dự án hiện có nền tốt để phát triển tiếp:

```text
- Có decimal policy.
- Có service/repository.
- Có JWT + refresh token rotation.
- Có audit log.
- Có rate limit.
- Có production config guard.
- Có soft-delete cho dữ liệu danh mục.
```

Nhưng để lưu trữ dài hạn và scale ổn định, cần sửa ngay 3 điểm quan trọng nhất:

```text
1. Enum trạng thái phiếu mua đang lệch với service.
2. Currentstock RowVersion lệch migration.
3. Trừ tồn kho chưa atomic, dễ sai tồn khi nhiều request đồng thời.
```

Sau đó ưu tiên:

```text
4. Chuẩn hóa unit/base unit.
5. Thêm lot/expiry.
6. Phân trang ledger.
7. Thêm snapshot tồn kho.
8. Tách kiến trúc backend.
9. Hardening auth token storage.
```

Nếu chỉ sửa UI hoặc thêm tính năng mà chưa xử lý các điểm này, dự án có thể vẫn chạy được trong demo, nhưng khi dữ liệu tăng theo tháng/năm sẽ dễ gặp lỗi lệch tồn, query chậm, khó audit và khó mở rộng.
