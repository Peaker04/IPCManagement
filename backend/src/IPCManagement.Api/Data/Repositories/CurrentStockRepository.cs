using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class CurrentStockRepository : GenericRepository<Currentstock>, ICurrentStockRepository
{
    public CurrentStockRepository(IpcManagementContext context) : base(context) { }

    public async Task<Currentstock?> GetByWarehouseAndIngredientAsync(byte[] warehouseId, byte[] ingredientId)
    {
        return await _dbSet
            .Include(c => c.Ingredient)
            .Include(c => c.Unit)
            .FirstOrDefaultAsync(c => c.WarehouseId == warehouseId && c.IngredientId == ingredientId);
    }

    public async Task<IEnumerable<Currentstock>> GetByWarehouseAsync(byte[] warehouseId)
    {
        return await _dbSet
            .AsNoTracking()
            .Include(c => c.Ingredient)
            .Include(c => c.Unit)
            .Where(c => c.WarehouseId == warehouseId)
            .ToListAsync();
    }

    public async Task<bool> ExistsAsync(byte[] warehouseId, byte[] ingredientId)
    {
        return await _dbSet.AnyAsync(c => c.WarehouseId == warehouseId && c.IngredientId == ingredientId);
    }

    public async Task<bool> TryDecreaseAsync(byte[] warehouseId, byte[] ingredientId, decimal quantity, DateTime updatedAt)
    {
        var affectedRows = await _dbSet
            .Where(c =>
                c.WarehouseId == warehouseId &&
                c.IngredientId == ingredientId &&
                c.CurrentQty >= quantity)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(c => c.CurrentQty, c => c.CurrentQty - quantity)
                .SetProperty(c => c.LastUpdated, updatedAt));

        return affectedRows == 1;
    }

    public async Task<decimal> ConvertQuantityAsync(byte[] sourceUnitId, byte[] targetUnitId, decimal quantity)
    {
        if (sourceUnitId.SequenceEqual(targetUnitId))
        {
            return quantity;
        }

        var units = await _context.Units
            .AsNoTracking()
            .Where(unit => unit.UnitId == sourceUnitId || unit.UnitId == targetUnitId)
            .ToListAsync();
        var sourceUnit = units.FirstOrDefault(unit => unit.UnitId.SequenceEqual(sourceUnitId))
            ?? throw new InvalidOperationException("Không tìm thấy đơn vị nguồn để quy đổi tồn kho.");
        var targetUnit = units.FirstOrDefault(unit => unit.UnitId.SequenceEqual(targetUnitId))
            ?? throw new InvalidOperationException("Không tìm thấy đơn vị đích để quy đổi tồn kho.");

        if (!CanConvertUnits(sourceUnit, targetUnit))
        {
            throw new InvalidOperationException(
                $"Không thể quy đổi từ đơn vị '{sourceUnit.UnitName}' sang '{targetUnit.UnitName}' cho tồn kho.");
        }

        return DecimalPolicy.RoundQuantity(quantity * sourceUnit.ConvertRateToBase / targetUnit.ConvertRateToBase);
    }

    private static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
        => sourceUnit.ConvertRateToBase > 0 &&
           targetUnit.ConvertRateToBase > 0 &&
           string.Equals(NormalizedBaseUnitCode(sourceUnit), NormalizedBaseUnitCode(targetUnit), StringComparison.OrdinalIgnoreCase);

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();
}
