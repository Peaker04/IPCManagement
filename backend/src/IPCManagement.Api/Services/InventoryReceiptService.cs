using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class InventoryReceiptService : IInventoryReceiptService
{
    private readonly IInventoryReceiptRepository _receiptRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IpcManagementContext? _context;

    public InventoryReceiptService(
        IInventoryReceiptRepository receiptRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IpcManagementContext? context = null)
    {
        _receiptRepository = receiptRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _context = context;
    }

    public async Task<PagedResponseDto<InventoryReceiptDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _receiptRepository.GetPagedAsync(
            request.PageNumber,
            request.PageSize);

        return PagedResponseDto<InventoryReceiptDto>.Create(
            items.Select(receipt => InventoryMapper.MapReceipt(receipt)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<InventoryReceiptDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var receipt = await _receiptRepository.GetByIdWithLinesAsync(bytes);
        return receipt is null ? null : InventoryMapper.MapReceipt(receipt, includeLines: true);
    }

    public async Task<InventoryReceiptCreatedDto?> CreateAsync(CreateInventoryReceiptDto dto, string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var supplierBytes = GuidHelper.ParseGuidString(dto.SupplierId)
            ?? throw new ArgumentException("SupplierId không hợp lệ.");
        var warehouseBytes = GuidHelper.ParseGuidString(dto.WarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");

        using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var receipt = new Inventoryreceipt
            {
                ReceiptId = GuidHelper.NewId(),
                ReceiptCode = $"RCP-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
                ReceiptDate = dto.ReceiptDate,
                SupplierId = supplierBytes,
                WarehouseId = warehouseBytes,
                PurchaseRequestId = dto.PurchaseRequestId is not null
                    ? GuidHelper.ParseGuidString(dto.PurchaseRequestId)
                    : null,
                CreatedBy = userIdBytes,
                CreatedAt = DateTime.UtcNow
            };

            receipt.Inventoryreceiptlines = dto.Lines.Select(line => new Inventoryreceiptline
            {
                ReceiptLineId = GuidHelper.NewId(),
                ReceiptId = receipt.ReceiptId,
                IngredientId = GuidHelper.ParseGuidString(line.IngredientId)
                    ?? throw new ArgumentException($"IngredientId '{line.IngredientId}' không hợp lệ."),
                Quantity = DecimalPolicy.RoundQuantity(line.Quantity),
                UnitId = GuidHelper.ParseGuidString(line.UnitId)
                    ?? throw new ArgumentException($"UnitId '{line.UnitId}' không hợp lệ."),
                UnitPrice = DecimalPolicy.RoundMoney(line.UnitPrice),
                LotNumber = line.LotNumber,
                ManufactureDate = line.ManufactureDate,
                ExpiredDate = line.ExpiredDate
            }).ToList();

            // Add receipt using sync change tracking
            _receiptRepository.Add(receipt);

            // Cập nhật tồn kho hiện tại + ghi nhận stock movements
            foreach (var line in receipt.Inventoryreceiptlines)
            {
                await _stockLedgerService.AddStockAsync(
                    warehouseBytes,
                    line.IngredientId,
                    line.UnitId,
                    line.Quantity,
                    "RECEIPT",
                    "inventoryreceipts",
                    receipt.ReceiptId,
                    userIdBytes,
                    "Nhập kho mua hàng",
                    $"Phiếu nhập {receipt.ReceiptCode}",
                    line.LotNumber,
                    line.ManufactureDate,
                    line.ExpiredDate);
            }

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return new InventoryReceiptCreatedDto
            {
                ReceiptId = GuidHelper.ToGuidString(receipt.ReceiptId),
                ReceiptCode = receipt.ReceiptCode
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<InventoryReceiptCreatedDto?> CreateFromPurchaseRequestAsync(
        CreateInventoryReceiptFromPurchaseDto dto,
        string? userId)
    {
        if (_context is null)
        {
            throw new InvalidOperationException("Chưa cấu hình dữ liệu để nhập kho từ phiếu mua.");
        }

        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var purchaseRequestId = GuidHelper.ParseGuidString(dto.PurchaseRequestId)
            ?? throw new ArgumentException("PurchaseRequestId không hợp lệ.");
        var supplierId = GuidHelper.ParseGuidString(dto.SupplierId)
            ?? throw new ArgumentException("SupplierId không hợp lệ.");
        var warehouseId = GuidHelper.ParseGuidString(dto.WarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        if (dto.Lines.Count == 0)
        {
            throw new ArgumentException("Cần ít nhất một dòng nguyên liệu để nhập kho.");
        }

        var request = await _context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
            .FirstOrDefaultAsync(item => item.PurchaseRequestId == purchaseRequestId);
        if (request is null)
        {
            throw new ArgumentException("Không tìm thấy phiếu mua.");
        }

        if (request.Status is not "SENTTOSUPPLIER" and not "PARTIALRECEIVED")
        {
            throw new InvalidOperationException("Chỉ nhập kho từ phiếu mua đã gửi nhà cung cấp hoặc đang nhận một phần.");
        }

        using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var receipt = new Inventoryreceipt
            {
                ReceiptId = GuidHelper.NewId(),
                ReceiptCode = $"RCP-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
                ReceiptDate = dto.ReceiptDate,
                SupplierId = supplierId,
                WarehouseId = warehouseId,
                PurchaseRequestId = request.PurchaseRequestId,
                CreatedBy = userIdBytes,
                CreatedAt = DateTime.UtcNow
            };

            var requestedLineIds = new HashSet<string>(StringComparer.Ordinal);
            var linesById = request.Purchaserequestlines.ToDictionary(
                line => GuidHelper.ToGuidString(line.PurchaseRequestLineId),
                StringComparer.Ordinal);
            var existingReceived = await LoadReceivedQuantitiesAsync(request.PurchaseRequestId);

            foreach (var input in dto.Lines)
            {
                var purchaseLineId = GuidHelper.ParseGuidString(input.PurchaseRequestLineId)
                    ?? throw new ArgumentException("PurchaseRequestLineId không hợp lệ.");
                var purchaseLineKey = GuidHelper.ToGuidString(purchaseLineId);
                if (!requestedLineIds.Add(purchaseLineKey))
                {
                    throw new ArgumentException("Một dòng mua chỉ được nhập một lần trong cùng phiếu nhập.");
                }

                if (!linesById.TryGetValue(purchaseLineKey, out var purchaseLine))
                {
                    throw new ArgumentException("Dòng nhập không thuộc phiếu mua đã chọn.");
                }

                if (purchaseLine.SupplierId is null || !purchaseLine.SupplierId.SequenceEqual(supplierId))
                {
                    throw new InvalidOperationException("Nhà cung cấp trên dòng nhập không khớp phiếu mua.");
                }

                var unitId = GuidHelper.ParseGuidString(input.UnitId)
                    ?? throw new ArgumentException("UnitId không hợp lệ.");
                if (!purchaseLine.UnitId.SequenceEqual(unitId))
                {
                    throw new InvalidOperationException("Đơn vị nhập phải khớp đơn vị trên phiếu mua.");
                }

                var receivedQty = DecimalPolicy.RoundQuantity(input.ReceivedQty);
                if (receivedQty <= 0)
                {
                    throw new ArgumentException("Số lượng nhận phải lớn hơn 0.");
                }

                var receivedKey = BuildReceiptLineMatchKey(purchaseLine.PurchaseRequestLineId);
                var alreadyReceived = existingReceived.TryGetValue(receivedKey, out var value) ? value : 0m;
                var remainingQty = DecimalPolicy.RoundQuantity(purchaseLine.PurchaseQty - alreadyReceived);
                if (DecimalPolicy.GreaterThanQuantity(receivedQty, remainingQty))
                {
                    throw new InvalidOperationException(
                        $"Số lượng nhận vượt số còn lại của dòng mua. Còn lại: {remainingQty}, nhập: {receivedQty}.");
                }

                var unitPrice = DecimalPolicy.RoundMoney(input.UnitPrice ?? purchaseLine.EstimatedUnitPrice);
                receipt.Inventoryreceiptlines.Add(new Inventoryreceiptline
                {
                    ReceiptLineId = GuidHelper.NewId(),
                    ReceiptId = receipt.ReceiptId,
                    PurchaseRequestLineId = purchaseLine.PurchaseRequestLineId,
                    IngredientId = purchaseLine.IngredientId,
                    UnitId = purchaseLine.UnitId,
                    Quantity = receivedQty,
                    UnitPrice = unitPrice,
                    Amount = DecimalPolicy.RoundMoney(receivedQty * unitPrice),
                    LotNumber = string.IsNullOrWhiteSpace(input.LotNumber) ? null : input.LotNumber.Trim(),
                    ManufactureDate = input.ManufactureDate,
                    ExpiredDate = input.ExpiredDate
                });
                existingReceived[receivedKey] = DecimalPolicy.RoundQuantity(alreadyReceived + receivedQty);
            }

            _receiptRepository.Add(receipt);
            foreach (var line in receipt.Inventoryreceiptlines)
            {
                await _stockLedgerService.AddStockAsync(
                    warehouseId,
                    line.IngredientId,
                    line.UnitId,
                    line.Quantity,
                    "RECEIPT",
                    "inventoryreceipts",
                    receipt.ReceiptId,
                    userIdBytes,
                    "Nhập kho từ phiếu mua",
                    $"Phiếu nhập {receipt.ReceiptCode} từ {request.PurchaseRequestCode}",
                    line.LotNumber,
                    line.ManufactureDate,
                    line.ExpiredDate);
            }

            var oldStatus = request.Status;
            var newStatus = ResolvePurchaseReceiptStatus(request.Purchaserequestlines, existingReceived);
            if (!string.Equals(oldStatus, newStatus, StringComparison.OrdinalIgnoreCase))
            {
                request.Status = newStatus;
                _context.Auditlogs.Add(new Auditlog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = DateTime.UtcNow,
                    ChangedBy = userIdBytes,
                    BusinessArea = "Receipt",
                    EntityName = nameof(Purchaserequest),
                    EntityId = request.PurchaseRequestId,
                    FieldName = nameof(Purchaserequest.Status),
                    OldValue = oldStatus,
                    NewValue = newStatus,
                    Reason = $"Nhập kho từ phiếu mua {request.PurchaseRequestCode}."
                });
            }

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return new InventoryReceiptCreatedDto
            {
                ReceiptId = GuidHelper.ToGuidString(receipt.ReceiptId),
                ReceiptCode = receipt.ReceiptCode
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task<Dictionary<string, decimal>> LoadReceivedQuantitiesAsync(byte[] purchaseRequestId)
    {
        var receivedQuantities = await _context!.Inventoryreceiptlines
            .AsNoTracking()
            .Where(line =>
                line.Receipt.PurchaseRequestId != null &&
                line.Receipt.PurchaseRequestId.SequenceEqual(purchaseRequestId) &&
                line.PurchaseRequestLineId != null)
            .GroupBy(line => line.PurchaseRequestLineId!)
            .Select(group => new
            {
                PurchaseRequestLineId = group.Key,
                Quantity = group.Sum(line => line.Quantity)
            })
            .ToListAsync();

        return receivedQuantities
            .ToDictionary(
                item => BuildReceiptLineMatchKey(item.PurchaseRequestLineId),
                item => DecimalPolicy.RoundQuantity(item.Quantity),
                StringComparer.Ordinal);
    }

    private static string ResolvePurchaseReceiptStatus(
        IEnumerable<Purchaserequestline> purchaseLines,
        IReadOnlyDictionary<string, decimal> receivedQuantities)
    {
        var lines = purchaseLines.ToList();
        var receivedAny = false;
        var receivedAll = lines.Count > 0;
        foreach (var line in lines)
        {
            var key = BuildReceiptLineMatchKey(line.PurchaseRequestLineId);
            var received = receivedQuantities.TryGetValue(key, out var value) ? value : 0m;
            receivedAny = receivedAny || received > 0;
            receivedAll = receivedAll && !DecimalPolicy.LessThanQuantity(received, line.PurchaseQty);
        }

        return receivedAll ? "RECEIVED" : receivedAny ? "PARTIALRECEIVED" : "SENTTOSUPPLIER";
    }

    private static string BuildReceiptLineMatchKey(byte[] purchaseRequestLineId)
        => Convert.ToBase64String(purchaseRequestLineId);

}
