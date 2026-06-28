using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Services;

public class InventoryReturnService : IInventoryReturnService
{
    private readonly IInventoryReturnRepository _returnRepository;
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;

    public InventoryReturnService(
        IInventoryReturnRepository returnRepository,
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService)
    {
        _returnRepository = returnRepository;
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
    }

    public async Task<PagedResponseDto<InventoryReturnDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _returnRepository.GetPagedAsync(
            request.PageNumber,
            request.PageSize);

        return PagedResponseDto<InventoryReturnDto>.Create(
            items.Select(inventoryReturn => InventoryMapper.MapReturn(inventoryReturn)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<InventoryReturnDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var inventoryReturn = await _returnRepository.GetByIdWithLinesAsync(bytes);
        return inventoryReturn is null
            ? null
            : InventoryMapper.MapReturn(inventoryReturn, includeLines: true);
    }

    public async Task<InventoryReturnCreatedDto?> CreateAsync(CreateInventoryReturnDto dto, string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var warehouseBytes = GuidHelper.ParseGuidString(dto.WarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        var issueBytes = GuidHelper.ParseGuidString(dto.IssueId)
            ?? throw new ArgumentException("IssueId không hợp lệ.");

        var issue = await _issueRepository.GetByIdWithLinesAsync(issueBytes)
            ?? throw new KeyNotFoundException($"Không tìm thấy phiếu xuất kho với ID: {dto.IssueId}");

        if (!issue.WarehouseId.SequenceEqual(warehouseBytes))
        {
            throw new InvalidOperationException("Phiếu trả phải thuộc cùng kho với phiếu xuất gốc.");
        }

        var returnedQuantities = await _returnRepository.GetReturnedQuantitiesByIssueAsync(issueBytes);
        var issueQuantities = issue.Inventoryissuelines
            .GroupBy(line => InventoryReturnRepository.BuildLineKey(line.IngredientId, line.UnitId))
            .ToDictionary(group => group.Key, group => group.Sum(line => line.IssuedQty));

        using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var inventoryReturn = new Inventoryreturn
            {
                ReturnId = GuidHelper.NewId(),
                ReturnCode = $"RET-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
                ReturnDate = dto.ReturnDate,
                ShiftName = dto.ShiftName,
                WarehouseId = warehouseBytes,
                IssueId = issueBytes,
                Reason = dto.Reason,
                CreatedBy = userIdBytes,
                CreatedAt = DateTime.UtcNow
            };

            inventoryReturn.Inventoryreturnlines = dto.Lines.Select(line =>
            {
                var ingredientBytes = GuidHelper.ParseGuidString(line.IngredientId)
                    ?? throw new ArgumentException($"IngredientId '{line.IngredientId}' không hợp lệ.");
                var unitBytes = GuidHelper.ParseGuidString(line.UnitId)
                    ?? throw new ArgumentException($"UnitId '{line.UnitId}' không hợp lệ.");

                var quantity = DecimalPolicy.RoundQuantity(line.Quantity);
                ValidateReturnQuantity(
                    issueQuantities,
                    returnedQuantities,
                    ingredientBytes,
                    unitBytes,
                    quantity);

                return new Inventoryreturnline
                {
                    ReturnLineId = GuidHelper.NewId(),
                    ReturnId = inventoryReturn.ReturnId,
                    IngredientId = ingredientBytes,
                    UnitId = unitBytes,
                    Quantity = quantity
                };
            }).ToList();

            _returnRepository.Add(inventoryReturn);

            foreach (var line in inventoryReturn.Inventoryreturnlines)
            {
                await _stockLedgerService.AddStockAsync(
                    warehouseBytes,
                    line.IngredientId,
                    line.UnitId,
                    line.Quantity,
                    "RETURN",
                    "inventoryreturns",
                    inventoryReturn.ReturnId,
                    userIdBytes,
                    "Trả nguyên liệu dư sau sản xuất",
                    $"Phiếu trả {inventoryReturn.ReturnCode}");
            }

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return new InventoryReturnCreatedDto
            {
                ReturnId = GuidHelper.ToGuidString(inventoryReturn.ReturnId),
                ReturnCode = inventoryReturn.ReturnCode
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private static void ValidateReturnQuantity(
        IReadOnlyDictionary<string, decimal> issueQuantities,
        IReadOnlyDictionary<string, decimal> returnedQuantities,
        byte[] ingredientId,
        byte[] unitId,
        decimal returnQuantity)
    {
        var key = InventoryReturnRepository.BuildLineKey(ingredientId, unitId);

        if (!issueQuantities.TryGetValue(key, out var issuedQuantity))
        {
            throw new InvalidOperationException(
                "Nguyên liệu trả phải tồn tại trong phiếu xuất gốc và cùng đơn vị tính.");
        }

        var alreadyReturned = returnedQuantities.GetValueOrDefault(key);
        if (DecimalPolicy.GreaterThanQuantity(alreadyReturned + returnQuantity, issuedQuantity))
        {
            throw new InvalidOperationException(
                $"Số lượng trả vượt quá số lượng đã xuất. Đã xuất: {issuedQuantity}, đã trả: {alreadyReturned}, trả thêm: {returnQuantity}.");
        }
    }
}
