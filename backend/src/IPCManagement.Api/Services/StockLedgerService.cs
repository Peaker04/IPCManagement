using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class StockLedgerService : IStockLedgerService
{
    private readonly ICurrentStockRepository _currentStockRepo;
    private readonly IStockMovementRepository _stockMovementRepo;
    private readonly IpcManagementContext? _context;

    public StockLedgerService(
        ICurrentStockRepository currentStockRepo,
        IStockMovementRepository stockMovementRepo,
        IpcManagementContext? context = null)
    {
        _currentStockRepo = currentStockRepo;
        _stockMovementRepo = stockMovementRepo;
        _context = context;
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
        string note,
        string? lotNumber = null,
        DateOnly? manufactureDate = null,
        DateOnly? expiredDate = null)
    {
        quantity = DecimalPolicy.RoundQuantity(quantity);
        if (quantity <= 0)
        {
            throw new ArgumentException("Số lượng nhập kho phải lớn hơn 0.", nameof(quantity));
        }

        var normalizedLotNumber = NormalizeLotNumber(lotNumber);
        var updatedAt = DateTime.UtcNow;
        var currentStock = await _currentStockRepo.GetByWarehouseAndIngredientAsync(warehouseId, ingredientId);
        var stockUnitId = unitId;
        var stockQuantity = quantity;
        var beforeQty = 0m;
        if (currentStock is null)
        {
            currentStock = new Currentstock
            {
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = unitId,
                CurrentQty = quantity,
                LastUpdated = updatedAt
            };
            _currentStockRepo.Add(currentStock);
        }
        else
        {
            stockUnitId = currentStock.UnitId;
            beforeQty = await _currentStockRepo.ConvertQuantityAsync(currentStock.UnitId, unitId, currentStock.CurrentQty);
            stockQuantity = await _currentStockRepo.ConvertQuantityAsync(unitId, currentStock.UnitId, quantity);
            currentStock.CurrentQty = DecimalPolicy.RoundQuantity(currentStock.CurrentQty + stockQuantity);
            currentStock.LastUpdated = updatedAt;
            _currentStockRepo.Update(currentStock);
        }

        var afterQty = DecimalPolicy.RoundQuantity(beforeQty + quantity);
        var movement = new Stockmovement
        {
            MovementId = GuidHelper.NewId(),
            MovementDate = updatedAt,
            WarehouseId = warehouseId,
            IngredientId = ingredientId,
            UnitId = unitId,
            MovementType = movementType,
            RefTable = refTable,
            RefId = refId,
            QuantityIn = quantity,
            QuantityOut = 0,
            BeforeQty = beforeQty,
            AfterQty = afterQty,
            LotNumber = normalizedLotNumber,
            ManufactureDate = manufactureDate,
            ExpiredDate = expiredDate,
            PerformedBy = performedBy,
            Reason = reason,
            Note = note
        };
        _stockMovementRepo.Add(movement);

        await IncreaseLotBalanceAsync(
            warehouseId,
            ingredientId,
            stockUnitId,
            stockQuantity,
            normalizedLotNumber,
            manufactureDate,
            expiredDate,
            updatedAt);
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

        var currentStock = await _currentStockRepo.GetByWarehouseAndIngredientAsync(warehouseId, ingredientId);
        if (currentStock is null)
        {
            throw new InvalidOperationException(
                $"Nguyên liệu '{GuidHelper.ToGuidString(ingredientId)}' không đủ tồn kho tại kho chỉ định. Yêu cầu: {quantity}, Hiện có: 0.");
        }

        var beforeQty = await _currentStockRepo.ConvertQuantityAsync(currentStock.UnitId, unitId, currentStock.CurrentQty);
        var stockQuantity = await _currentStockRepo.ConvertQuantityAsync(unitId, currentStock.UnitId, quantity);
        var updatedAt = DateTime.UtcNow;
        var decreased = await _currentStockRepo.TryDecreaseAsync(warehouseId, ingredientId, stockQuantity, updatedAt);
        if (!decreased)
        {
            currentStock = await _currentStockRepo.GetByWarehouseAndIngredientAsync(warehouseId, ingredientId);
            var currentQty = currentStock is null
                ? 0
                : await _currentStockRepo.ConvertQuantityAsync(currentStock.UnitId, unitId, currentStock.CurrentQty);
            throw new InvalidOperationException(
                $"Nguyên liệu '{GuidHelper.ToGuidString(ingredientId)}' không đủ tồn kho tại kho chỉ định. Yêu cầu: {quantity}, Hiện có: {currentQty}.");
        }

        var allocations = await DecreaseLotBalancesAsync(
            warehouseId,
            ingredientId,
            currentStock.UnitId,
            unitId,
            stockQuantity,
            quantity,
            updatedAt);

        // Ghi movement sau khi trừ tồn kho thành công để transaction có thể rollback cả hai thao tác.
        var runningBeforeQty = beforeQty;
        foreach (var allocation in allocations)
        {
            var runningAfterQty = DecimalPolicy.RoundQuantity(runningBeforeQty - allocation.Quantity);
            var movement = new Stockmovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = updatedAt,
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = unitId,
                MovementType = movementType,
                RefTable = refTable,
                RefId = refId,
                QuantityIn = 0,
                QuantityOut = allocation.Quantity,
                BeforeQty = runningBeforeQty,
                AfterQty = runningAfterQty,
                LotNumber = allocation.LotNumber,
                ManufactureDate = allocation.ManufactureDate,
                ExpiredDate = allocation.ExpiredDate,
                PerformedBy = performedBy,
                Reason = reason,
                Note = note
            };
            _stockMovementRepo.Add(movement);
            runningBeforeQty = runningAfterQty;
        }
    }

    private async Task IncreaseLotBalanceAsync(
        byte[] warehouseId,
        byte[] ingredientId,
        byte[] unitId,
        decimal quantity,
        string? lotNumber,
        DateOnly? manufactureDate,
        DateOnly? expiredDate,
        DateTime updatedAt)
    {
        if (_context is null || !HasLotMetadata(lotNumber, manufactureDate, expiredDate))
        {
            return;
        }

        var lot = await _context.Currentstocklots.FirstOrDefaultAsync(item =>
            item.WarehouseId == warehouseId &&
            item.IngredientId == ingredientId &&
            item.UnitId == unitId &&
            item.LotNumber == lotNumber &&
            item.ManufactureDate == manufactureDate &&
            item.ExpiredDate == expiredDate);

        if (lot is null)
        {
            _context.Currentstocklots.Add(new Currentstocklot
            {
                LotStockId = GuidHelper.NewId(),
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = unitId,
                LotNumber = lotNumber,
                ManufactureDate = manufactureDate,
                ExpiredDate = expiredDate,
                CurrentQty = quantity,
                LastUpdated = updatedAt
            });
            return;
        }

        lot.CurrentQty = DecimalPolicy.RoundQuantity(lot.CurrentQty + quantity);
        lot.LastUpdated = updatedAt;
    }

    private async Task<IReadOnlyList<LotAllocation>> DecreaseLotBalancesAsync(
        byte[] warehouseId,
        byte[] ingredientId,
        byte[] stockUnitId,
        byte[] movementUnitId,
        decimal stockQuantity,
        decimal movementQuantity,
        DateTime updatedAt)
    {
        if (_context is null)
        {
            return [new LotAllocation(movementQuantity, null, null, null)];
        }

        var remainingStockQty = stockQuantity;
        var allocations = new List<LotAllocation>();
        var lots = await _context.Currentstocklots
            .Where(item =>
                item.WarehouseId == warehouseId &&
                item.IngredientId == ingredientId &&
                item.UnitId == stockUnitId &&
                item.CurrentQty > 0)
            .OrderBy(item => item.ExpiredDate == null)
            .ThenBy(item => item.ExpiredDate)
            .ThenBy(item => item.ManufactureDate == null)
            .ThenBy(item => item.ManufactureDate)
            .ThenBy(item => item.LotNumber)
            .ToListAsync();

        foreach (var lot in lots)
        {
            if (!DecimalPolicy.GreaterThanQuantity(remainingStockQty, 0))
            {
                break;
            }

            var takeStockQty = DecimalPolicy.RoundQuantity(Math.Min(lot.CurrentQty, remainingStockQty));
            lot.CurrentQty = DecimalPolicy.RoundQuantity(lot.CurrentQty - takeStockQty);
            lot.LastUpdated = updatedAt;
            remainingStockQty = DecimalPolicy.RoundQuantity(remainingStockQty - takeStockQty);

            var movementQty = await ConvertLotAllocationToMovementUnitAsync(stockUnitId, movementUnitId, takeStockQty);
            allocations.Add(new LotAllocation(movementQty, lot.LotNumber, lot.ManufactureDate, lot.ExpiredDate));
        }

        if (DecimalPolicy.GreaterThanQuantity(remainingStockQty, 0))
        {
            var legacyMovementQty = await ConvertLotAllocationToMovementUnitAsync(stockUnitId, movementUnitId, remainingStockQty);
            allocations.Add(new LotAllocation(legacyMovementQty, null, null, null));
        }

        return allocations.Count == 0
            ? [new LotAllocation(movementQuantity, null, null, null)]
            : allocations;
    }

    private async Task<decimal> ConvertLotAllocationToMovementUnitAsync(byte[] sourceUnitId, byte[] targetUnitId, decimal quantity)
        => DecimalPolicy.RoundQuantity(await _currentStockRepo.ConvertQuantityAsync(sourceUnitId, targetUnitId, quantity));

    private static bool HasLotMetadata(string? lotNumber, DateOnly? manufactureDate, DateOnly? expiredDate)
        => !string.IsNullOrWhiteSpace(lotNumber) || manufactureDate.HasValue || expiredDate.HasValue;

    private static string? NormalizeLotNumber(string? lotNumber)
        => string.IsNullOrWhiteSpace(lotNumber) ? null : lotNumber.Trim();

    private sealed record LotAllocation(
        decimal Quantity,
        string? LotNumber,
        DateOnly? ManufactureDate,
        DateOnly? ExpiredDate);
}
