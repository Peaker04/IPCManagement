using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public class StockSnapshotReportService : IStockSnapshotReportService
{
    private readonly IpcManagementContext _context;

    public StockSnapshotReportService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<StockSnapshotDto>> GetStockSnapshotsAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var periodMonth = ResolveSnapshotPeriodMonth(query);

        var snapshots = _context.Stocksnapshots
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .Where(item => item.PeriodMonth == periodMonth)
            .AsQueryable();

        if (warehouseId is not null)
        {
            snapshots = snapshots.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            snapshots = snapshots.Where(item => item.IngredientId == ingredientId);
        }

        return await snapshots
            .OrderBy(item => item.Warehouse.WarehouseName)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Take(NormalizeLimit(query.Limit))
            .Select(item => new StockSnapshotDto
            {
                SnapshotId = GuidHelper.ToGuidString(item.SnapshotId),
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                PeriodMonth = item.PeriodMonth,
                OpeningQty = item.OpeningQty,
                QuantityIn = item.QuantityIn,
                QuantityOut = item.QuantityOut,
                ClosingQty = item.ClosingQty,
                GeneratedAt = item.GeneratedAt
            })
            .ToListAsync();
    }

    public async Task<IReadOnlyList<StockSnapshotDto>> GenerateMonthlyStockSnapshotAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var periodMonth = ResolveSnapshotPeriodMonth(query);
        var periodStart = periodMonth.ToDateTime(TimeOnly.MinValue);
        var periodEnd = periodMonth.AddMonths(1).ToDateTime(TimeOnly.MinValue);
        var generatedAt = DateTime.UtcNow;

        var movementsQuery = _context.Stockmovements
            .AsNoTracking()
            .Where(item => item.MovementDate < periodEnd)
            .AsQueryable();

        if (warehouseId is not null)
        {
            movementsQuery = movementsQuery.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            movementsQuery = movementsQuery.Where(item => item.IngredientId == ingredientId);
        }

        var movements = await movementsQuery
            .OrderBy(item => item.MovementDate)
            .ToListAsync();
        var snapshotRows = movements
            .GroupBy(item => BuildStockSnapshotKey(item.WarehouseId, item.IngredientId, item.UnitId))
            .Select(group => BuildSnapshotRow(group, periodMonth, periodStart, periodEnd, generatedAt))
            .ToList();
        var existingRows = await _context.Stocksnapshots
            .Where(item => item.PeriodMonth == periodMonth)
            .ToListAsync();
        var existingByKey = existingRows.ToDictionary(
            item => BuildStockSnapshotKey(item.WarehouseId, item.IngredientId, item.UnitId),
            StringComparer.Ordinal);

        foreach (var row in snapshotRows)
        {
            var key = BuildStockSnapshotKey(row.WarehouseId, row.IngredientId, row.UnitId);
            if (!existingByKey.TryGetValue(key, out var existing))
            {
                _context.Stocksnapshots.Add(row);
                continue;
            }

            existing.OpeningQty = row.OpeningQty;
            existing.QuantityIn = row.QuantityIn;
            existing.QuantityOut = row.QuantityOut;
            existing.ClosingQty = row.ClosingQty;
            existing.GeneratedAt = row.GeneratedAt;
        }

        await _context.SaveChangesAsync();

        return await GetStockSnapshotsAsync(new WorkflowReportQueryDto
        {
            DateFrom = periodMonth.ToString("yyyy-MM-dd"),
            WarehouseId = query.WarehouseId,
            IngredientId = query.IngredientId,
            Limit = query.Limit
        });
    }

    private static string BuildStockSnapshotKey(byte[] warehouseId, byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToBase64String(warehouseId)}|{Convert.ToBase64String(ingredientId)}|{Convert.ToBase64String(unitId)}";

    private static StockSnapshot BuildSnapshotRow(
        IGrouping<string, StockMovement> movementGroup,
        DateOnly periodMonth,
        DateTime periodStart,
        DateTime periodEnd,
        DateTime generatedAt)
    {
        var orderedMovements = movementGroup
            .OrderBy(item => item.MovementDate)
            .ThenBy(item => Convert.ToBase64String(item.MovementId))
            .ToList();
        var firstMovement = orderedMovements[0];
        var priorMovement = orderedMovements.LastOrDefault(item => item.MovementDate < periodStart);
        var periodMovements = orderedMovements
            .Where(item => item.MovementDate >= periodStart && item.MovementDate < periodEnd)
            .ToList();
        var openingQty = priorMovement?.AfterQty
            ?? periodMovements.FirstOrDefault()?.BeforeQty
            ?? 0m;
        var quantityIn = DecimalPolicy.RoundQuantity(periodMovements.Sum(item => item.QuantityIn));
        var quantityOut = DecimalPolicy.RoundQuantity(periodMovements.Sum(item => item.QuantityOut));
        var closingQty = periodMovements.LastOrDefault()?.AfterQty ?? openingQty;

        return new StockSnapshot
        {
            SnapshotId = GuidHelper.NewId(),
            WarehouseId = firstMovement.WarehouseId,
            IngredientId = firstMovement.IngredientId,
            UnitId = firstMovement.UnitId,
            PeriodMonth = periodMonth,
            OpeningQty = DecimalPolicy.RoundQuantity(openingQty),
            QuantityIn = quantityIn,
            QuantityOut = quantityOut,
            ClosingQty = DecimalPolicy.RoundQuantity(closingQty),
            GeneratedAt = generatedAt
        };
    }

    private static DateOnly ResolveSnapshotPeriodMonth(WorkflowReportQueryDto query)
    {
        var date = ParseDateOnly(query.ServiceDate)
            ?? ParseDateOnly(query.DateFrom)
            ?? ParseDateOnly(query.DateTo)
            ?? ServiceCalendar.Today();
        return new DateOnly(date.Year, date.Month, 1);
    }

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var parsed) ? parsed : null;

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);
}
