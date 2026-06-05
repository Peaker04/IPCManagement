using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Services;

public class InventoryReceiptService : IInventoryReceiptService
{
    private readonly IInventoryReceiptRepository _receiptRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;

    public InventoryReceiptService(
        IInventoryReceiptRepository receiptRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService)
    {
        _receiptRepository = receiptRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
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
                    $"Phiếu nhập {receipt.ReceiptCode}");
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

}
