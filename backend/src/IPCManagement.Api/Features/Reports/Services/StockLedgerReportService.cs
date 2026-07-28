using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public class StockLedgerReportService : IStockLedgerReportService
{
    private const decimal StockLedgerMatchTolerance = 0.000010m;
    private const string LegacyLedgerBaselineRefTable = "LEGACY_CURRENTSTOCK_BASELINE";
    private readonly IpcManagementContext _context;

    public StockLedgerReportService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<StockLedgerReconciliationDto>> GetStockLedgerReconciliationAsync(WorkflowReportQueryDto query)
    {
        var limit = NormalizeLimit(query.Limit);
        var rows = await LoadSourceRowsAsync(query);
        return rows
            .OrderBy(item => item.IsMatched)
            .ThenBy(item => item.WarehouseName)
            .ThenBy(item => item.IngredientName)
            .Take(limit)
            .Select(item => new StockLedgerReconciliationDto
            {
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.UnitName,
                CurrentQty = item.CurrentQty,
                LedgerQty = item.LedgerQty,
                DifferenceQty = item.DifferenceQty,
                IsMatched = item.IsMatched,
                LastMovementAt = item.LastMovementAt
            })
            .ToList();
    }

    public async Task<IReadOnlyList<StockLedgerSourceRow>> LoadSourceRowsAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var stocksQuery = _context.Currentstocks
            .AsNoTracking()
            .TagWith("WorkflowReport.StockLedger.CurrentStock")
            .AsQueryable();
        var movementsQuery = _context.Stockmovements
            .AsNoTracking()
            .TagWith("WorkflowReport.StockLedger.Movements")
            .AsQueryable();

        if (warehouseId is not null)
        {
            stocksQuery = stocksQuery.Where(item => item.WarehouseId == warehouseId);
            movementsQuery = movementsQuery.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            stocksQuery = stocksQuery.Where(item => item.IngredientId == ingredientId);
            movementsQuery = movementsQuery.Where(item => item.IngredientId == ingredientId);
        }

        var stocks = await stocksQuery
            .Select(item => new StockLedgerCurrentProjection
            {
                WarehouseId = item.WarehouseId,
                WarehouseCode = item.Warehouse.WarehouseCode,
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = item.IngredientId,
                IngredientCode = item.Ingredient.IngredientCode,
                IngredientName = item.Ingredient.IngredientName,
                UnitId = item.UnitId,
                UnitName = item.Unit.UnitName,
                CurrentQty = item.CurrentQty,
                LastUpdated = item.LastUpdated
            })
            .ToListAsync();
        var movementAggregates = await movementsQuery
            .GroupBy(item => new { item.WarehouseId, item.IngredientId })
            .Select(group => new StockLedgerMovementAggregateProjection
            {
                WarehouseId = group.Key.WarehouseId,
                IngredientId = group.Key.IngredientId,
                LedgerQty = group.Sum(item => item.QuantityIn - item.QuantityOut),
                LastMovementAt = group.Max(item => item.MovementDate),
                LegacyBaselineCount = group.Sum(item => item.RefTable == LegacyLedgerBaselineRefTable ? 1 : 0)
            })
            .ToListAsync();
        var latestDatesQuery = movementsQuery
            .GroupBy(item => new { item.WarehouseId, item.IngredientId })
            .Select(group => new
            {
                group.Key.WarehouseId,
                group.Key.IngredientId,
                MovementDate = group.Max(item => item.MovementDate)
            });
        var latestCandidates = await (
                from movement in movementsQuery
                join latestDate in latestDatesQuery
                    on new { movement.WarehouseId, movement.IngredientId, movement.MovementDate }
                    equals new { latestDate.WarehouseId, latestDate.IngredientId, latestDate.MovementDate }
                select new StockLedgerLatestMovementProjection
                {
                    MovementId = movement.MovementId,
                    WarehouseId = movement.WarehouseId,
                    WarehouseCode = movement.Warehouse.WarehouseCode,
                    WarehouseName = movement.Warehouse.WarehouseName,
                    IngredientId = movement.IngredientId,
                    IngredientCode = movement.Ingredient.IngredientCode,
                    IngredientName = movement.Ingredient.IngredientName,
                    UnitId = movement.UnitId,
                    UnitName = movement.Unit.UnitName
                })
            .ToListAsync();
        var latestMovements = latestCandidates
            .GroupBy(item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId), StringComparer.Ordinal)
            .Select(group => group
                .OrderByDescending(item => Convert.ToHexString(item.MovementId), StringComparer.Ordinal)
                .First())
            .ToList();

        var stocksByKey = stocks.ToDictionary(
            item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId),
            StringComparer.Ordinal);
        var aggregatesByKey = movementAggregates.ToDictionary(
            item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId),
            StringComparer.Ordinal);
        var latestByKey = latestMovements.ToDictionary(
            item => BuildStockLedgerKey(item.WarehouseId, item.IngredientId),
            StringComparer.Ordinal);
        var keys = stocksByKey.Keys
            .Concat(aggregatesByKey.Keys)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        return keys.Select(key =>
        {
            stocksByKey.TryGetValue(key, out var stock);
            aggregatesByKey.TryGetValue(key, out var aggregate);
            latestByKey.TryGetValue(key, out var latest);
            var currentQty = DecimalPolicy.RoundQuantity(stock?.CurrentQty ?? 0m);
            var ledgerQty = DecimalPolicy.RoundQuantity(aggregate?.LedgerQty ?? 0m);
            var difference = DecimalPolicy.RoundQuantity(currentQty - ledgerQty);

            return new StockLedgerSourceRow
            {
                WarehouseId = stock?.WarehouseId ?? latest!.WarehouseId,
                WarehouseCode = stock?.WarehouseCode ?? latest?.WarehouseCode,
                WarehouseName = stock?.WarehouseName ?? latest?.WarehouseName,
                IngredientId = stock?.IngredientId ?? latest!.IngredientId,
                IngredientCode = stock?.IngredientCode ?? latest?.IngredientCode,
                IngredientName = stock?.IngredientName ?? latest?.IngredientName,
                UnitId = stock?.UnitId ?? latest!.UnitId,
                UnitName = stock?.UnitName ?? latest?.UnitName,
                CurrentQty = currentQty,
                LedgerQty = ledgerQty,
                DifferenceQty = difference,
                IsMatched = Math.Abs(difference) <= StockLedgerMatchTolerance,
                LastMovementAt = aggregate?.LastMovementAt,
                CurrentLastUpdated = stock?.LastUpdated,
                HasCurrentStock = stock is not null,
                HasLegacyBaseline = aggregate?.LegacyBaselineCount > 0
            };
        }).ToList();
    }

    private static string BuildStockLedgerKey(byte[] warehouseId, byte[] ingredientId)
        => $"{Convert.ToBase64String(warehouseId)}|{Convert.ToBase64String(ingredientId)}";

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

    private sealed class StockLedgerCurrentProjection
    {
        public byte[] WarehouseId { get; init; } = [];
        public string? WarehouseCode { get; init; }
        public string? WarehouseName { get; init; }
        public byte[] IngredientId { get; init; } = [];
        public string? IngredientCode { get; init; }
        public string? IngredientName { get; init; }
        public byte[] UnitId { get; init; } = [];
        public string? UnitName { get; init; }
        public decimal CurrentQty { get; init; }
        public DateTime LastUpdated { get; init; }
    }

    private sealed class StockLedgerMovementAggregateProjection
    {
        public byte[] WarehouseId { get; init; } = [];
        public byte[] IngredientId { get; init; } = [];
        public decimal LedgerQty { get; init; }
        public DateTime LastMovementAt { get; init; }
        public int LegacyBaselineCount { get; init; }
    }

    private sealed class StockLedgerLatestMovementProjection
    {
        public byte[] MovementId { get; init; } = [];
        public byte[] WarehouseId { get; init; } = [];
        public string? WarehouseCode { get; init; }
        public string? WarehouseName { get; init; }
        public byte[] IngredientId { get; init; } = [];
        public string? IngredientCode { get; init; }
        public string? IngredientName { get; init; }
        public byte[] UnitId { get; init; } = [];
        public string? UnitName { get; init; }
    }
}

public sealed class StockLedgerSourceRow
{
    public byte[] WarehouseId { get; init; } = [];
    public string? WarehouseCode { get; init; }
    public string? WarehouseName { get; init; }
    public byte[] IngredientId { get; init; } = [];
    public string? IngredientCode { get; init; }
    public string? IngredientName { get; init; }
    public byte[] UnitId { get; init; } = [];
    public string? UnitName { get; init; }
    public decimal CurrentQty { get; init; }
    public decimal LedgerQty { get; init; }
    public decimal DifferenceQty { get; init; }
    public bool IsMatched { get; init; }
    public DateTime? LastMovementAt { get; init; }
    public DateTime? CurrentLastUpdated { get; init; }
    public bool HasCurrentStock { get; init; }
    public bool HasLegacyBaseline { get; init; }
}
