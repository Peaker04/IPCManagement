using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Validators;

internal static class InventoryIssueStockValidator
{
    internal static async Task EnsureAvailableAsync(
        IpcManagementContext? context,
        byte[] warehouseId,
        DateOnly issueDate,
        MaterialRequest materialRequest,
        IEnumerable<InventoryIssueStockLine> issueLines)
    {
        if (context is null)
        {
            return;
        }

        var stocks = await context.Currentstocks
            .AsNoTracking()
            .Include(stock => stock.Warehouse)
            .Include(stock => stock.Ingredient)
            .Include(stock => stock.Unit)
            .Where(stock => stock.WarehouseId == warehouseId)
            .ToListAsync();
        var warehouse = await context.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.WarehouseId == warehouseId);
        var demandInfo = materialRequest.Materialrequestlines
            .GroupBy(line => BuildKey(line.IngredientId, line.UnitId))
            .ToDictionary(
                group => group.Key,
                group => group.First());

        var shortageLines = new List<StockShortageLineDto>();
        foreach (var line in issueLines)
        {
            var stock = stocks.FirstOrDefault(item => item.IngredientId.SequenceEqual(line.IngredientId));
            var demandLine = demandInfo.GetValueOrDefault(BuildKey(line.IngredientId, line.UnitId));
            var availableQty = CalculateAvailableQuantity(stock, demandLine?.Unit);
            if (!DecimalPolicy.LessThanQuantity(availableQty, line.IssuedQty))
            {
                continue;
            }

            shortageLines.Add(new StockShortageLineDto
            {
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                IngredientName = demandLine?.Ingredient.IngredientName ?? stock?.Ingredient.IngredientName ?? GuidHelper.ToGuidString(line.IngredientId),
                UnitId = GuidHelper.ToGuidString(line.UnitId),
                UnitName = demandLine?.Unit.UnitName ?? stock?.Unit.UnitName ?? GuidHelper.ToGuidString(line.UnitId),
                RequiredQty = DecimalPolicy.RoundQuantity(line.IssuedQty),
                AvailableQty = availableQty,
                MissingQty = DecimalPolicy.RoundQuantity(line.IssuedQty - availableQty)
            });
        }

        if (shortageLines.Count == 0)
        {
            return;
        }

        throw new StockShortageException(new StockShortageIssueDto
        {
            MaterialRequestId = GuidHelper.ToGuidString(materialRequest.RequestId),
            MaterialRequestCode = materialRequest.RequestCode,
            WarehouseId = GuidHelper.ToGuidString(warehouseId),
            WarehouseName = warehouse?.WarehouseName,
            IssueDate = issueDate,
            Lines = shortageLines
        });
    }

    internal static async Task EnsureAvailableAsync(
        IpcManagementContext? context,
        byte[] warehouseId,
        DateOnly issueDate,
        byte[] sourceId,
        string sourceCode,
        IEnumerable<InventoryIssueStockLine> issueLines)
    {
        if (context is null) return;
        var requested = issueLines.ToList();
        var ingredientIds = requested.Select(line => line.IngredientId).ToList();
        var unitIds = requested.Select(line => line.UnitId).ToList();
        var inMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
        var ingredients = inMemory
            ? (await context.Ingredients.AsNoTracking().ToListAsync()).Where(item => ingredientIds.Any(id => id.SequenceEqual(item.IngredientId))).ToList()
            : await context.Ingredients.AsNoTracking().Where(item => ingredientIds.Contains(item.IngredientId)).ToListAsync();
        var units = inMemory
            ? (await context.Units.AsNoTracking().ToListAsync()).Where(item => unitIds.Any(id => id.SequenceEqual(item.UnitId))).ToList()
            : await context.Units.AsNoTracking().Where(item => unitIds.Contains(item.UnitId)).ToListAsync();
        var persistedStocks = inMemory
            ? await context.Currentstocks.AsNoTracking().Include(stock => stock.Ingredient).Include(stock => stock.Unit).ToListAsync()
            : await context.Currentstocks.AsNoTracking().Include(stock => stock.Ingredient).Include(stock => stock.Unit).Where(stock => stock.WarehouseId == warehouseId).ToListAsync();
        var stocks = persistedStocks.Concat(context.Currentstocks.Local)
            .Where(stock => stock.WarehouseId.SequenceEqual(warehouseId))
            .DistinctBy(stock => $"{Convert.ToHexString(stock.WarehouseId)}:{Convert.ToHexString(stock.IngredientId)}").ToList();
        var warehouse = inMemory
            ? (await context.Warehouses.AsNoTracking().ToListAsync()).FirstOrDefault(item => item.WarehouseId.SequenceEqual(warehouseId))
            : await context.Warehouses.AsNoTracking().FirstOrDefaultAsync(item => item.WarehouseId == warehouseId);
        var shortages = new List<StockShortageLineDto>();
        foreach (var line in requested)
        {
            var targetUnit = units.FirstOrDefault(unit => unit.UnitId.SequenceEqual(line.UnitId));
            var stock = stocks.FirstOrDefault(item => item.IngredientId.SequenceEqual(line.IngredientId));
            var available = CalculateAvailableQuantity(stock, targetUnit);
            if (!DecimalPolicy.LessThanQuantity(available, line.IssuedQty)) continue;
            var ingredient = ingredients.FirstOrDefault(item => item.IngredientId.SequenceEqual(line.IngredientId));
            shortages.Add(new StockShortageLineDto
            {
                IngredientId = GuidHelper.ToGuidString(line.IngredientId), IngredientName = ingredient?.IngredientName ?? GuidHelper.ToGuidString(line.IngredientId),
                UnitId = GuidHelper.ToGuidString(line.UnitId), UnitName = targetUnit?.UnitName ?? GuidHelper.ToGuidString(line.UnitId),
                RequiredQty = DecimalPolicy.RoundQuantity(line.IssuedQty), AvailableQty = available,
                MissingQty = DecimalPolicy.RoundQuantity(line.IssuedQty - available)
            });
        }
        if (shortages.Count == 0) return;
        throw new StockShortageException(new StockShortageIssueDto
        {
            MaterialRequestId = GuidHelper.ToGuidString(sourceId), MaterialRequestCode = sourceCode,
            WarehouseId = GuidHelper.ToGuidString(warehouseId), WarehouseName = warehouse?.WarehouseName,
            IssueDate = issueDate, Lines = shortages,
            SuggestedAction = "Tồn kho không đủ cho danh sách đối chiếu; vui lòng bổ sung tồn kho trước khi xuất."
        });
    }

    private static decimal CalculateAvailableQuantity(CurrentStock? stock, Unit? targetUnit)
    {
        if (stock is null)
        {
            return 0m;
        }

        if (targetUnit is not null)
        {
            return TryConvertQuantity(stock.CurrentQty, stock.Unit, targetUnit, out var convertedQty)
                ? convertedQty
                : 0m;
        }

        return DecimalPolicy.RoundQuantity(stock.CurrentQty);
    }

    private static bool TryConvertQuantity(decimal quantity, Unit sourceUnit, Unit targetUnit, out decimal convertedQty)
    {
        if (sourceUnit.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            convertedQty = DecimalPolicy.RoundQuantity(quantity);
            return true;
        }

        if (!CanConvertUnits(sourceUnit, targetUnit))
        {
            convertedQty = 0m;
            return false;
        }

        convertedQty = DecimalPolicy.RoundQuantity(quantity * sourceUnit.ConvertRateToBase / targetUnit.ConvertRateToBase);
        return true;
    }

    private static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
        => sourceUnit.ConvertRateToBase > 0 &&
           targetUnit.ConvertRateToBase > 0 &&
           string.Equals(NormalizedBaseUnitCode(sourceUnit), NormalizedBaseUnitCode(targetUnit), StringComparison.OrdinalIgnoreCase);

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();

    private static string BuildKey(byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToHexString(ingredientId)}:{Convert.ToHexString(unitId)}";
}

internal sealed record InventoryIssueStockLine(
    byte[] IngredientId,
    byte[] UnitId,
    decimal IssuedQty);
