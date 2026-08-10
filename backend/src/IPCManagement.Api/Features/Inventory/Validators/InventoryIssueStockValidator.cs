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
