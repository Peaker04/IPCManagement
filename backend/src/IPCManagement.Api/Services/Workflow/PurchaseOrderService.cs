using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Workflow;

public class PurchaseOrderService : IPurchaseOrderService
{
    private const string StatusOrdered = "ORDERED";
    private const string StatusPartiallyReceived = "PARTIALLY_RECEIVED";
    private const string StatusReceived = "RECEIVED";
    private const string StatusCancelled = "CANCELLED";

    private readonly IpcManagementContext _context;
    private readonly IStockLedgerService _stockLedgerService;

    public PurchaseOrderService(IpcManagementContext context, IStockLedgerService stockLedgerService)
    {
        _context = context;
        _stockLedgerService = stockLedgerService;
    }

    public async Task<IReadOnlyList<PurchaseOrderDto>> CreateFromApprovedRequestAsync(
        string purchaseRequestId,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var purchaseRequestIdBytes = GuidHelper.ParseGuidString(purchaseRequestId)
            ?? throw new ArgumentException("Đề xuất mua hàng không hợp lệ.");
        var userIdBytes = GuidHelper.ParseGuidString(userId)
            ?? throw new ArgumentException("Không xác định được người tạo đơn mua hàng.");

        var purchaseRequest = await _context.Purchaserequests
            .Include(pr => pr.Purchaserequestlines)
                .ThenInclude(line => line.Purchaseorderline)
            .FirstOrDefaultAsync(pr => pr.PurchaseRequestId == purchaseRequestIdBytes, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy đề xuất mua hàng.");

        if (purchaseRequest.Status != "APPROVED")
        {
            throw new InvalidOperationException("Chỉ có thể tạo đơn mua hàng từ đề xuất mua hàng đã được duyệt.");
        }

        var linesToConvert = purchaseRequest.Purchaserequestlines
            .Where(line => line.Purchaseorderline is null)
            .ToList();
        if (linesToConvert.Count == 0)
        {
            throw new InvalidOperationException("Tất cả các dòng của đề xuất mua hàng này đã được tạo đơn mua hàng.");
        }
        if (linesToConvert.Any(line => line.SupplierId is null))
        {
            throw new InvalidOperationException("Mọi dòng mua phải được chọn nhà cung cấp trước khi tạo đơn mua hàng.");
        }

        var supplierReadyLines = linesToConvert
            .Select(line => new { Line = line, SupplierId = line.SupplierId! })
            .ToList();

        var existingOrdersBySupplier = await _context.Purchaseorders
            .Where(po => po.PurchaseRequestId == purchaseRequestIdBytes)
            .ToDictionaryAsync(po => Convert.ToBase64String(po.SupplierId), cancellationToken);

        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        foreach (var supplierGroup in supplierReadyLines.GroupBy(item => Convert.ToBase64String(item.SupplierId)))
        {
            if (!existingOrdersBySupplier.TryGetValue(supplierGroup.Key, out var order))
            {
                order = new Purchaseorder
                {
                    PurchaseOrderId = GuidHelper.NewId(),
                    PurchaseOrderCode = BuildPurchaseOrderCode(purchaseRequest.PurchaseRequestCode, supplierGroup.First().SupplierId),
                    PurchaseRequestId = purchaseRequestIdBytes,
                    SupplierId = supplierGroup.First().SupplierId,
                    OrderDate = today,
                    Status = StatusOrdered,
                    CreatedBy = userIdBytes,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                _context.Purchaseorders.Add(order);
                existingOrdersBySupplier[supplierGroup.Key] = order;
            }

            foreach (var item in supplierGroup)
            {
                var line = item.Line;
                _context.Purchaseorderlines.Add(new Purchaseorderline
                {
                    PurchaseOrderLineId = GuidHelper.NewId(),
                    PurchaseOrderId = order.PurchaseOrderId,
                    PurchaseRequestLineId = line.PurchaseRequestLineId,
                    IngredientId = line.IngredientId,
                    UnitId = line.UnitId,
                    OrderedQty = DecimalPolicy.RoundQuantity(line.PurchaseQty),
                    ReceivedQty = 0,
                    UnitPrice = DecimalPolicy.RoundMoney(line.EstimatedUnitPrice)
                });
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return await GetByPurchaseRequestAsync(purchaseRequestIdBytes, cancellationToken);
    }

    public async Task<IReadOnlyList<PurchaseOrderDto>> GetListAsync(string? status, CancellationToken cancellationToken = default)
    {
        var query = _context.Purchaseorders
            .AsNoTracking()
            .Include(po => po.Supplier)
            .Include(po => po.PurchaseRequest)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Ingredient)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Unit)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(po => po.Status == status.Trim().ToUpperInvariant());
        }

        var orders = await query
            .OrderByDescending(po => po.CreatedAt)
            .ToListAsync(cancellationToken);

        return orders.Select(MapToDto).ToList();
    }

    public async Task<PurchaseOrderPageDto> GetPageAsync(PurchaseOrderPageQueryDto query, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, query.PageNumber);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var filteredQuery = BuildOrderQuery(query.Status);
        var totalCount = await filteredQuery.CountAsync(cancellationToken);
        var orderIdsByRequest = await filteredQuery
            .Select(order => new { order.PurchaseRequestId })
            .ToListAsync(cancellationToken);
        var counts = orderIdsByRequest
            .GroupBy(order => GuidHelper.ToGuidString(order.PurchaseRequestId))
            .ToDictionary(group => group.Key, group => group.Count());
        var orders = await filteredQuery
            .OrderByDescending(order => order.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PurchaseOrderPageDto
        {
            Page = PagedResponseDto<PurchaseOrderDto>.Create(orders.Select(MapToDto).ToList(), totalCount, pageNumber, pageSize),
            OrderCountByRequest = counts,
        };
    }

    public async Task<PurchaseOrderDto?> GetByIdAsync(string purchaseOrderId, CancellationToken cancellationToken = default)
    {
        var purchaseOrderIdBytes = GuidHelper.ParseGuidString(purchaseOrderId);
        if (purchaseOrderIdBytes is null)
        {
            return null;
        }

        var order = await LoadOrderAsync(purchaseOrderIdBytes, cancellationToken);
        return order is null ? null : MapToDto(order);
    }

    public async Task<PurchaseOrderDto> RecordReceiptAsync(
        string purchaseOrderId,
        RecordPurchaseOrderReceiptDto request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var purchaseOrderIdBytes = GuidHelper.ParseGuidString(purchaseOrderId)
            ?? throw new ArgumentException("Đơn mua hàng không hợp lệ.");
        var warehouseId = GuidHelper.ParseGuidString(request.WarehouseId)
            ?? throw new ArgumentException("Kho nhập hàng không hợp lệ.");
        var userIdBytes = GuidHelper.ParseGuidString(userId)
            ?? throw new ArgumentException("Không xác định được người ghi nhận nhập kho.");

        var order = await LoadOrderAsync(purchaseOrderIdBytes, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy đơn mua hàng.");

        if (order.Status == StatusCancelled)
        {
            throw new InvalidOperationException("Đơn mua hàng đã bị hủy, không thể ghi nhận nhận hàng.");
        }

        if (request.Lines.Count == 0)
        {
            throw new ArgumentException("Vui lòng nhập số lượng nhận cho ít nhất một dòng.");
        }

        var linesById = order.Purchaseorderlines.ToDictionary(line => GuidHelper.ToGuidString(line.PurchaseOrderLineId));
        var now = DateTime.UtcNow;
        var receipt = new Inventoryreceipt
        {
            ReceiptId = GuidHelper.NewId(),
            ReceiptCode = $"RCP-PO-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
            ReceiptDate = DateOnly.FromDateTime(now),
            SupplierId = order.SupplierId,
            WarehouseId = warehouseId,
            PurchaseRequestId = order.PurchaseRequestId,
            CreatedBy = userIdBytes,
            CreatedAt = now
        };

        foreach (var receiptLine in request.Lines)
        {
            if (!linesById.TryGetValue(receiptLine.PurchaseOrderLineId, out var line))
            {
                throw new KeyNotFoundException("Không tìm thấy dòng đơn mua hàng.");
            }

            var receivedQty = DecimalPolicy.RoundQuantity(receiptLine.ReceivedQty);
            if (receivedQty <= 0)
            {
                throw new ArgumentException($"Số lượng nhận cho '{line.Ingredient.IngredientName}' phải lớn hơn 0.");
            }

            var newTotal = DecimalPolicy.RoundQuantity(line.ReceivedQty + receivedQty);
            if (DecimalPolicy.GreaterThanQuantity(newTotal, line.OrderedQty))
            {
                throw new InvalidOperationException(
                    $"Số lượng nhận cho '{line.Ingredient.IngredientName}' ({newTotal}) vượt quá số lượng đã đặt ({line.OrderedQty}).");
            }

            line.ReceivedQty = newTotal;
            receipt.Inventoryreceiptlines.Add(new Inventoryreceiptline
            {
                ReceiptLineId = GuidHelper.NewId(),
                ReceiptId = receipt.ReceiptId,
                PurchaseRequestLineId = line.PurchaseRequestLineId,
                IngredientId = line.IngredientId,
                UnitId = line.UnitId,
                Quantity = receivedQty,
                UnitPrice = DecimalPolicy.RoundMoney(line.UnitPrice),
                Amount = DecimalPolicy.RoundMoney(receivedQty * line.UnitPrice)
            });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        _context.Inventoryreceipts.Add(receipt);

        foreach (var line in receipt.Inventoryreceiptlines)
        {
            await _stockLedgerService.AddStockAsync(
                warehouseId,
                line.IngredientId,
                line.UnitId,
                line.Quantity,
                "RECEIPT",
                "purchaseorders",
                order.PurchaseOrderId,
                userIdBytes,
                "Nhập kho từ đơn mua hàng",
                $"PO {order.PurchaseOrderCode}");
        }

        order.Status = ComputeOrderStatus(order.Purchaseorderlines);
        order.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return MapToDto(order);
    }

    public async Task<PurchaseOrderDto> CancelAsync(string purchaseOrderId, CancellationToken cancellationToken = default)
    {
        var purchaseOrderIdBytes = GuidHelper.ParseGuidString(purchaseOrderId)
            ?? throw new ArgumentException("Đơn mua hàng không hợp lệ.");

        var order = await LoadOrderAsync(purchaseOrderIdBytes, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy đơn mua hàng.");

        if (order.Purchaseorderlines.Any(line => line.ReceivedQty > 0))
        {
            throw new InvalidOperationException("Không thể hủy đơn mua hàng đã có dòng nhận hàng.");
        }

        order.Status = StatusCancelled;
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return MapToDto(order);
    }

    private async Task<Purchaseorder?> LoadOrderAsync(byte[] purchaseOrderId, CancellationToken cancellationToken)
        => await _context.Purchaseorders
            .Include(po => po.Supplier)
            .Include(po => po.PurchaseRequest)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Ingredient)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(po => po.PurchaseOrderId == purchaseOrderId, cancellationToken);

    private IQueryable<Purchaseorder> BuildOrderQuery(string? status)
    {
        var query = _context.Purchaseorders
            .AsNoTracking()
            .Include(po => po.Supplier)
            .Include(po => po.PurchaseRequest)
            .Include(po => po.Purchaseorderlines).ThenInclude(line => line.Ingredient)
            .Include(po => po.Purchaseorderlines).ThenInclude(line => line.Unit)
            .AsQueryable();

        return string.IsNullOrWhiteSpace(status)
            ? query
            : query.Where(po => po.Status == status.Trim().ToUpperInvariant());
    }

    private async Task<IReadOnlyList<PurchaseOrderDto>> GetByPurchaseRequestAsync(byte[] purchaseRequestId, CancellationToken cancellationToken)
    {
        var orders = await _context.Purchaseorders
            .AsNoTracking()
            .Include(po => po.Supplier)
            .Include(po => po.PurchaseRequest)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Ingredient)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Unit)
            .Where(po => po.PurchaseRequestId == purchaseRequestId)
            .OrderBy(po => po.PurchaseOrderCode)
            .ToListAsync(cancellationToken);

        return orders.Select(MapToDto).ToList();
    }

    private static string ComputeOrderStatus(IEnumerable<Purchaseorderline> lines)
    {
        var lineList = lines.ToList();
        if (lineList.All(line => !DecimalPolicy.LessThanQuantity(line.ReceivedQty, line.OrderedQty)))
        {
            return StatusReceived;
        }

        return lineList.Any(line => line.ReceivedQty > 0) ? StatusPartiallyReceived : StatusOrdered;
    }

    private static string BuildPurchaseOrderCode(string purchaseRequestCode, byte[] supplierId)
        => $"PO-{purchaseRequestCode}-{GuidHelper.ToGuidString(supplierId)[..8]}";

    private static PurchaseOrderDto MapToDto(Purchaseorder order) => new()
    {
        PurchaseOrderId = GuidHelper.ToGuidString(order.PurchaseOrderId),
        PurchaseOrderCode = order.PurchaseOrderCode,
        PurchaseRequestId = GuidHelper.ToGuidString(order.PurchaseRequestId),
        PurchaseRequestCode = order.PurchaseRequest.PurchaseRequestCode,
        SupplierId = GuidHelper.ToGuidString(order.SupplierId),
        SupplierName = order.Supplier.SupplierName,
        OrderDate = order.OrderDate.ToString("yyyy-MM-dd"),
        Status = order.Status,
        Lines = order.Purchaseorderlines
            .OrderBy(line => line.Ingredient.IngredientName)
            .Select(line => new PurchaseOrderLineDto
            {
                PurchaseOrderLineId = GuidHelper.ToGuidString(line.PurchaseOrderLineId),
                PurchaseRequestLineId = GuidHelper.ToGuidString(line.PurchaseRequestLineId),
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                IngredientName = line.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(line.UnitId),
                UnitName = line.Unit.UnitName,
                OrderedQty = line.OrderedQty,
                ReceivedQty = line.ReceivedQty,
                UnitPrice = line.UnitPrice
            })
            .ToList()
    };
}
