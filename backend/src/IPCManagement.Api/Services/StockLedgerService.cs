using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Services;

public class StockLedgerService : IStockLedgerService
{
    private readonly ICurrentStockRepository _currentStockRepo;
    private readonly IStockMovementRepository _stockMovementRepo;

    public StockLedgerService(
        ICurrentStockRepository currentStockRepo,
        IStockMovementRepository stockMovementRepo)
    {
        _currentStockRepo = currentStockRepo;
        _stockMovementRepo = stockMovementRepo;
    }

    public async Task AddStockAsync(
        byte[] warehouseId,
        byte[] ingredientId,
        byte[] unitId,
        decimal quantity,
        string movementType,
        string refTable,
        byte[] refId,
        byte[] performedBy,
        string reason,
        string note)
    {
        quantity = DecimalPolicy.RoundQuantity(quantity);
        if (quantity <= 0)
        {
            throw new ArgumentException("Số lượng nhập kho phải lớn hơn 0.", nameof(quantity));
        }

        // 1. Ghi nhận Stock Movement
        var movement = new Stockmovement
        {
            MovementId = GuidHelper.NewId(),
            MovementDate = DateTime.UtcNow,
            WarehouseId = warehouseId,
            IngredientId = ingredientId,
            UnitId = unitId,
            MovementType = movementType,
            RefTable = refTable,
            RefId = refId,
            QuantityIn = quantity,
            QuantityOut = 0,
            PerformedBy = performedBy,
            Reason = reason,
            Note = note
        };
        _stockMovementRepo.Add(movement);

        // 2. Cập nhật hoặc thêm mới Currentstock
        var currentStock = await _currentStockRepo.GetByWarehouseAndIngredientAsync(warehouseId, ingredientId);
        if (currentStock is null)
        {
            currentStock = new Currentstock
            {
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = unitId,
                CurrentQty = quantity,
                LastUpdated = DateTime.UtcNow
            };
            _currentStockRepo.Add(currentStock);
        }
        else
        {
            currentStock.CurrentQty = DecimalPolicy.RoundQuantity(currentStock.CurrentQty + quantity);
            currentStock.LastUpdated = DateTime.UtcNow;
            _currentStockRepo.Update(currentStock);
        }
    }

    public async Task RemoveStockWithCheckAsync(
        byte[] warehouseId,
        byte[] ingredientId,
        byte[] unitId,
        decimal quantity,
        string movementType,
        string refTable,
        byte[] refId,
        byte[] performedBy,
        string reason,
        string note)
    {
        quantity = DecimalPolicy.RoundQuantity(quantity);
        if (quantity <= 0)
        {
            throw new ArgumentException("Số lượng xuất kho phải lớn hơn 0.", nameof(quantity));
        }

        // 1. Kiểm tra tồn kho trước khi xuất
        var currentStock = await _currentStockRepo.GetByWarehouseAndIngredientAsync(warehouseId, ingredientId);
        var currentQty = DecimalPolicy.RoundQuantity(currentStock?.CurrentQty ?? 0);

        if (DecimalPolicy.LessThanQuantity(currentQty, quantity))
        {
            throw new InvalidOperationException(
                $"Nguyên liệu '{GuidHelper.ToGuidString(ingredientId)}' không đủ tồn kho tại kho chỉ định. Yêu cầu: {quantity}, Hiện có: {currentQty}.");
        }

        // 2. Ghi nhận Stock Movement
        var movement = new Stockmovement
        {
            MovementId = GuidHelper.NewId(),
            MovementDate = DateTime.UtcNow,
            WarehouseId = warehouseId,
            IngredientId = ingredientId,
            UnitId = unitId,
            MovementType = movementType,
            RefTable = refTable,
            RefId = refId,
            QuantityIn = 0,
            QuantityOut = quantity,
            PerformedBy = performedBy,
            Reason = reason,
            Note = note
        };
        _stockMovementRepo.Add(movement);

        // 3. Cập nhật Currentstock
        currentStock!.CurrentQty = DecimalPolicy.RoundQuantity(currentStock.CurrentQty - quantity);
        currentStock.LastUpdated = DateTime.UtcNow;
        _currentStockRepo.Update(currentStock);
    }
}
