using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Inventory;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Repositories;
using IPCManagement.Application.Interfaces.Services;
using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Services;

public class InventoryReceiptService : IInventoryReceiptService
{
    private readonly IInventoryReceiptRepository _receiptRepository;

    public InventoryReceiptService(IInventoryReceiptRepository receiptRepository)
    {
        _receiptRepository = receiptRepository;
    }

    public async Task<PagedResponseDto<InventoryReceiptDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _receiptRepository.GetPagedAsync(
            request.PageNumber,
            request.PageSize);

        return PagedResponseDto<InventoryReceiptDto>.Create(
            items.Select(receipt => MapReceipt(receipt)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<InventoryReceiptDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var receipt = await _receiptRepository.GetByIdWithLinesAsync(bytes);
        return receipt is null ? null : MapReceipt(receipt, includeLines: true);
    }

    public async Task<InventoryReceiptCreatedDto?> CreateAsync(CreateInventoryReceiptDto dto, string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var supplierBytes = GuidHelper.ParseGuidString(dto.SupplierId)
            ?? throw new ArgumentException("SupplierId không hợp lệ.");
        var warehouseBytes = GuidHelper.ParseGuidString(dto.WarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");

        var receipt = new Inventoryreceipt
        {
            ReceiptId = GuidHelper.NewId(),
            ReceiptCode = $"RCP-{DateTime.Now:yyyyMMdd-HHmmss}",
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
            Quantity = line.Quantity,
            UnitId = GuidHelper.ParseGuidString(line.UnitId)
                ?? throw new ArgumentException($"UnitId '{line.UnitId}' không hợp lệ."),
            UnitPrice = line.UnitPrice,
            LotNumber = line.LotNumber,
            ManufactureDate = line.ManufactureDate,
            ExpiredDate = line.ExpiredDate
        }).ToList();

        await _receiptRepository.AddAsync(receipt);

        return new InventoryReceiptCreatedDto
        {
            ReceiptId = GuidHelper.ToGuidString(receipt.ReceiptId),
            ReceiptCode = receipt.ReceiptCode
        };
    }

    private static InventoryReceiptDto MapReceipt(Inventoryreceipt receipt, bool includeLines = false) => new()
    {
        ReceiptId = GuidHelper.ToGuidString(receipt.ReceiptId),
        ReceiptCode = receipt.ReceiptCode,
        ReceiptDate = receipt.ReceiptDate,
        SupplierId = GuidHelper.ToGuidString(receipt.SupplierId),
        SupplierName = receipt.Supplier?.SupplierName,
        WarehouseId = GuidHelper.ToGuidString(receipt.WarehouseId),
        WarehouseName = receipt.Warehouse?.WarehouseName,
        PurchaseRequestId = receipt.PurchaseRequestId is not null
            ? GuidHelper.ToGuidString(receipt.PurchaseRequestId)
            : null,
        CreatedBy = GuidHelper.ToGuidString(receipt.CreatedBy),
        CreatedByName = receipt.CreatedByNavigation?.FullName,
        CreatedAt = receipt.CreatedAt,
        Lines = includeLines
            ? receipt.Inventoryreceiptlines.Select(MapLine).ToList()
            : new List<InventoryReceiptLineDto>()
    };

    private static InventoryReceiptLineDto MapLine(Inventoryreceiptline line) => new()
    {
        ReceiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
        IngredientId = GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line.Ingredient?.IngredientName,
        Quantity = line.Quantity,
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName,
        UnitPrice = line.UnitPrice,
        Amount = line.Amount ?? 0,
        LotNumber = line.LotNumber,
        ManufactureDate = line.ManufactureDate,
        ExpiredDate = line.ExpiredDate
    };
}
